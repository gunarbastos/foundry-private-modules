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
    const scene = new SceneModel(data);
    this.scenes.set(scene.id, scene);
    this.saveData();
    return scene;
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
        });
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
    }

    return true;
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
}
