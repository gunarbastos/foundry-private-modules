/**
 * @file SceneService.js
 * @description Service for scene CRUD operations and cast member management.
 * Handles all scene-related data operations and live updates.
 *
 * @module data/store/SceneService
 */

import { BaseService } from './BaseService.js';
import { SceneModel } from '../SceneModel.js';
import { SocketHandler } from '../SocketHandler.js';
import { CONFIG, getDefaultSceneLayoutSettings } from '../../config.js';

/**
 * Service for managing scenes and their cast members.
 * Provides CRUD operations for scenes and methods for cast manipulation.
 *
 * @extends BaseService
 */
export class SceneService extends BaseService {
  /**
   * Creates a new SceneService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE QUERIES
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get scenes with optional filtering.
   *
   * @param {Object} options - Filter options
   * @param {string} [options.search] - Search term for scene name
   * @param {boolean} [options.favorite] - Filter to favorites only
   * @param {string[]} [options.tags] - Tags to filter by (AND logic)
   * @param {string[]} [options.excludedTags] - Tags to exclude (NOT logic)
   * @returns {SceneModel[]} Array of filtered scenes
   */
  getScenes(options = {}) {
    let scenes = this.scenes.contents;

    // Search by name
    if (options.search) {
      const search = options.search.toLowerCase();
      scenes = scenes.filter(s => s.name.toLowerCase().includes(search));
    }

    // Filter favorites
    if (options.favorite) {
      scenes = scenes.filter(s => s.favorite);
    }

    // Tag Filtering (AND Logic)
    if (options.tags && options.tags.length > 0) {
      scenes = scenes.filter(s => options.tags.every(tag => s.tags.includes(tag)));
    }

    // Tag Exclusion (NOT Logic)
    if (options.excludedTags && options.excludedTags.length > 0) {
      scenes = scenes.filter(s => !options.excludedTags.some(tag => s.tags.includes(tag)));
    }

    return scenes;
  }

  /**
   * Get a single scene by ID.
   *
   * @param {string} id - Scene ID
   * @returns {SceneModel|undefined} The scene or undefined if not found
   */
  getScene(id) {
    return this.scenes.get(id);
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE CRUD
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Create a new scene.
   *
   * @param {Object} data - Scene data
   * @param {string} data.name - Scene name
   * @param {string} [data.background] - Background image path
   * @param {string} [data.folder] - Folder ID
   * @returns {SceneModel} The created scene
   */
  createScene(data) {
    const layoutSettings = foundry.utils.mergeObject(
      getDefaultSceneLayoutSettings(),
      foundry.utils.deepClone(data.layoutSettings || {}),
      { inplace: false, insertKeys: true, overwrite: true }
    );
    const scene = new SceneModel({
      ...data,
      layoutSettings
    });
    this.scenes.set(scene.id, scene);
    this.saveData();
    return scene;
  }

  /**
   * Duplicate an existing scene, preserving its configuration and cast.
   *
   * @param {string} id - Scene ID to duplicate
   * @param {Object} [options={}] - Duplicate options
   * @param {string} [options.name] - Optional explicit name for the duplicate
   * @param {string|null} [options.folder] - Optional destination folder override
   * @returns {SceneModel|undefined} The duplicated scene or undefined if not found
   */
  duplicateScene(id, options = {}) {
    const source = this.scenes.get(id);
    if (!source) {
      return undefined;
    }

    const existingNames = this.scenes.contents.map(scene => scene.name);
    const duplicateData = foundry.utils.deepClone(source.toJSON());
    delete duplicateData.id;

    duplicateData.name = options.name?.trim() || this._buildDuplicateName(source.name, existingNames);
    duplicateData.folder = options.folder !== undefined ? options.folder : source.folder;
    duplicateData.createdAt = Date.now();
    duplicateData.lastUsed = null;
    duplicateData.playCount = 0;
    duplicateData.cast = (source.cast || []).map(castMember => {
      const character = this.characters.get(castMember.id);
      return character
        ? { id: character.id, name: character.name, image: character.image }
        : foundry.utils.deepClone(castMember);
    });
    duplicateData.sequenceBackgrounds = (duplicateData.sequenceBackgrounds || []).map(bg => ({
      ...bg,
      id: foundry.utils.randomID()
    }));

    const duplicate = new SceneModel(duplicateData);
    this.scenes.set(duplicate.id, duplicate);
    this.saveData();
    return duplicate;
  }

  /**
   * Update an existing scene.
   *
   * @param {string} id - Scene ID
   * @param {Object} data - Data to update
   * @returns {SceneModel|undefined} The updated scene or undefined if not found
   */
  updateScene(id, data) {
    const scene = this.scenes.get(id);
    if (scene) {
      Object.assign(scene, data);
      this.saveData();

      // Live update if this is the active scene
      // Note: Remote clients will receive the update via the updateSetting hook in Store.js
      // which triggers _loadScenes() and PlayerView.refresh(). Here we refresh the local view.
      if (this.activeSceneId === id) {
        import('../../apps/PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
          ExaltedScenesPlayerView.refresh();
        }).catch(e => console.error('Exalted Scenes | Failed to load PlayerView:', e));
      }
    }
    return scene;
  }

  /**
   * Delete a scene.
   *
   * @param {string} id - Scene ID to delete
   * @returns {boolean} True if deleted, false if not found
   */
  deleteScene(id) {
    if (!this.scenes.has(id)) {
      return false;
    }

    // Clear active scene if deleting the active one
    if (this.activeSceneId === id) {
      this.clearActiveScene();
      SocketHandler.emitStopBroadcast();
    }

    this.scenes.delete(id);
    this.saveData();
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST MEMBER OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Add a character to a scene's cast.
   * Prevents duplicates and broadcasts live updates.
   *
   * @param {string} sceneId - Scene ID
   * @param {string} charId - Character ID to add
   * @returns {boolean} True if added, false if duplicate or not found
   */
  addCastMember(sceneId, charId) {
    const scene = this.scenes.get(sceneId);
    const character = this.characters.get(charId);

    if (!scene || !character) {
      return false;
    }

    // Prevent duplicates
    if (scene.cast.some(c => c.id === charId)) {
      return false;
    }

    scene.cast.push({
      id: character.id,
      name: character.name,
      image: character.image
    });
    this.saveData();

    // Live Update
    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);

      // Play entrance sound if character has one configured (GM triggers, NJ broadcasts)
      if (game.user.isGM && character.music?.entranceSoundId) {
        import('../NarratorJukeboxIntegration.js').then(({ NarratorJukeboxIntegration }) => {
          if (NarratorJukeboxIntegration.isAvailable) {
            NarratorJukeboxIntegration.playSoundboardSound(character.music.entranceSoundId);
          }
        }).catch(e => console.error('Exalted Scenes | Failed to play entrance sound:', e));
      }
    }

    return true;
  }

  /**
   * Add multiple characters to a scene's cast in a single save/update cycle.
   * Duplicates are ignored.
   *
   * @param {string} sceneId - Scene ID
   * @param {string[]} charIds - Character IDs to add
   * @returns {{added: string[], skipped: string[], missing: string[]}} Result summary
   */
  addCastMembers(sceneId, charIds = []) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { added: [], skipped: [], missing: Array.from(new Set(charIds.filter(Boolean))) };
    }

    const uniqueCharIds = Array.from(new Set(charIds.filter(Boolean)));
    const existingCastIds = new Set(scene.cast.map(c => c.id));
    const added = [];
    const skipped = [];
    const missing = [];

    for (const charId of uniqueCharIds) {
      const character = this.characters.get(charId);
      if (!character) {
        missing.push(charId);
        continue;
      }

      if (existingCastIds.has(charId)) {
        skipped.push(charId);
        continue;
      }

      scene.cast.push({
        id: character.id,
        name: character.name,
        image: character.image
      });

      existingCastIds.add(charId);
      added.push(charId);
    }

    if (!added.length) {
      return { added, skipped, missing };
    }

    this.saveData();

    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);
    }

    return { added, skipped, missing };
  }

  /**
   * Remove a character from a scene's cast.
   *
   * @param {string} sceneId - Scene ID
   * @param {string} charId - Character ID to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeCastMember(sceneId, charId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return false;
    }

    const initialLength = scene.cast.length;
    scene.cast = scene.cast.filter(c => c.id !== charId);

    if (scene.cast.length === initialLength) {
      return false; // Character wasn't in cast
    }

    this.saveData();

    // Live Update
    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);
    }

    return true;
  }

  /**
   * Reorder a cast member within a scene.
   *
   * @param {string} sceneId - Scene ID
   * @param {number} fromIndex - Original position
   * @param {number} toIndex - Target position
   * @returns {boolean} True if reordered, false if invalid
   */
  reorderCastMember(sceneId, fromIndex, toIndex) {
    const scene = this.scenes.get(sceneId);
    if (!scene || fromIndex === toIndex) {
      return false;
    }

    // Validate indices
    if (fromIndex < 0 || fromIndex >= scene.cast.length ||
        toIndex < 0 || toIndex >= scene.cast.length) {
      return false;
    }

    // Remove from original position
    const [movedItem] = scene.cast.splice(fromIndex, 1);

    // Insert at new position
    scene.cast.splice(toIndex, 0, movedItem);

    this.saveData();

    // Live Update
    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);
    }

    return true;
  }

  /**
   * Update a cast member's data (e.g., current emotion).
   *
   * @param {string} sceneId - Scene ID
   * @param {string} charId - Character ID
   * @param {Object} data - Data to update
   * @returns {boolean} True if updated, false if not found
   */
  updateCastMember(sceneId, charId, data) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return false;
    }

    const castMember = scene.cast.find(c => c.id === charId);
    if (!castMember) {
      return false;
    }

    Object.assign(castMember, data);
    this.saveData();

    // Live Update
    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);
    }

    return true;
  }

  /**
   * Get all cast members for a scene with full character data.
   *
   * @param {string} sceneId - Scene ID
   * @returns {Object[]|null} Array of cast data or null if scene not found
   */
  getCastMembers(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return null;
    }

    return scene.cast.map(castMember => {
      const character = this.characters.get(castMember.id);
      return {
        ...castMember,
        // Include full character data if available
        character: character ? {
          emotions: character.emotions,
          borderStyle: character.borderStyle,
          tags: character.tags
        } : null
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST PRESETS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all saved cast presets.
   * @returns {Object[]} Array of cast preset objects
   */
  getCastPresets() {
    return game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.CAST_PRESETS) || [];
  }

  /**
   * Save a cast preset from an existing scene's cast and layout settings.
   *
   * @param {string} name - Display name for the preset
   * @param {string} sceneId - Source scene ID to capture cast + layout from
   * @returns {{success: boolean, preset?: Object, error?: string}}
   */
  saveCastPreset(name, sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }
    if (!scene.cast.length) {
      return { success: false, error: 'Scene has no cast' };
    }

    const preset = {
      id: foundry.utils.randomID(),
      name: name.trim(),
      createdAt: Date.now(),
      cast: scene.cast.map(c => {
        const character = this.characters.get(c.id);
        return character
          ? { id: character.id, name: character.name, image: character.image }
          : foundry.utils.deepClone(c);
      }),
      layoutSettings: foundry.utils.deepClone(scene.layoutSettings)
    };

    const presets = this.getCastPresets();
    presets.push(preset);
    game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.CAST_PRESETS, presets);

    return { success: true, preset };
  }

  /**
   * Load a cast preset into a scene, replacing its current cast and layout.
   *
   * @param {string} presetId - Preset ID to load
   * @param {string} sceneId - Target scene ID
   * @returns {{success: boolean, loaded?: number, missing?: string[], error?: string}}
   */
  loadCastPreset(presetId, sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    const presets = this.getCastPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      return { success: false, error: 'Preset not found' };
    }

    // Resolve cast — only include characters that still exist
    const resolvedCast = [];
    const missing = [];
    for (const entry of preset.cast) {
      const character = this.characters.get(entry.id);
      if (character) {
        resolvedCast.push({
          id: character.id,
          name: character.name,
          image: character.image
        });
      } else {
        missing.push(entry.name || entry.id);
      }
    }

    // Replace cast
    scene.cast = resolvedCast;

    // Replace layout settings (deep clone to avoid shared references)
    if (preset.layoutSettings) {
      Object.assign(scene.layoutSettings, foundry.utils.deepClone(preset.layoutSettings));
    }

    this.saveData();

    // Live update if active
    if (this.activeSceneId === sceneId) {
      SocketHandler.emitUpdateCast(sceneId);
      import('../../apps/PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
        ExaltedScenesPlayerView.refresh();
      }).catch(e => console.error('Exalted Scenes | Failed to load PlayerView:', e));
    }

    return { success: true, loaded: resolvedCast.length, missing };
  }

  /**
   * Delete a cast preset.
   * @param {string} presetId - Preset ID to delete
   * @returns {boolean} True if deleted
   */
  deleteCastPreset(presetId) {
    const presets = this.getCastPresets();
    const idx = presets.findIndex(p => p.id === presetId);
    if (idx === -1) return false;

    presets.splice(idx, 1);
    game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.CAST_PRESETS, presets);
    return true;
  }

  /**
   * Rename a cast preset.
   * @param {string} presetId - Preset ID
   * @param {string} newName - New display name
   * @returns {boolean} True if renamed
   */
  renameCastPreset(presetId, newName) {
    const presets = this.getCastPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return false;

    preset.name = newName.trim();
    game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.CAST_PRESETS, presets);
    return true;
  }
}
