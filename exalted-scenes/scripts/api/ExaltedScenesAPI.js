/**
 * @file ExaltedScenesAPI.js
 * @description Public API for the Exalted Scenes module.
 * Provides a comprehensive, namespaced interface for other modules and macros
 * to interact with scenes, characters, folders, slideshows, broadcasting, and more.
 *
 * Access via: game.modules.get('exalted-scenes').api
 *
 * @module api/ExaltedScenesAPI
 */

import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { SocketHandler } from '../data/SocketHandler.js';
import { normalizeMediaFocusMap } from '../utils/media-focus.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';

/**
 * Hook event name constants.
 * Use these with Foundry's Hooks.on() to react to Exalted Scenes events.
 *
 * @example
 * const api = game.modules.get('exalted-scenes').api;
 * Hooks.on(api.hooks.SCENE_BROADCAST, ({ sceneId, scene }) => {
 *   console.log('Scene broadcasted:', scene.name);
 * });
 *
 * @readonly
 * @enum {string}
 */
const HOOK_NAMES = Object.freeze({
  SCENE_CREATE: 'exalted-scenes.sceneCreate',
  SCENE_UPDATE: 'exalted-scenes.sceneUpdate',
  SCENE_DELETE: 'exalted-scenes.sceneDelete',
  PRE_SCENE_DELETE: 'exalted-scenes.preSceneDelete',
  SCENE_BROADCAST: 'exalted-scenes.sceneBroadcast',
  BROADCAST_STOP: 'exalted-scenes.broadcastStop',
  CHARACTER_CREATE: 'exalted-scenes.characterCreate',
  CHARACTER_UPDATE: 'exalted-scenes.characterUpdate',
  CHARACTER_DELETE: 'exalted-scenes.characterDelete',
  PRE_CHARACTER_DELETE: 'exalted-scenes.preCharacterDelete',
  EMOTION_CHANGE: 'exalted-scenes.emotionChange',
  BORDER_CHANGE: 'exalted-scenes.borderChange',
  LOCK_CHANGE: 'exalted-scenes.lockChange',
  CAST_UPDATE: 'exalted-scenes.castUpdate',
  SLIDESHOW_START: 'exalted-scenes.slideshowStart',
  SLIDESHOW_SCENE: 'exalted-scenes.slideshowScene',
  SLIDESHOW_PAUSE: 'exalted-scenes.slideshowPause',
  SLIDESHOW_RESUME: 'exalted-scenes.slideshowResume',
  SLIDESHOW_STOP: 'exalted-scenes.slideshowStop',
  SEQUENCE_START: 'exalted-scenes.sequenceStart',
  SEQUENCE_CHANGE: 'exalted-scenes.sequenceChange',
  SEQUENCE_STOP: 'exalted-scenes.sequenceStop',
  CAST_ONLY_START: 'exalted-scenes.castOnlyStart',
  CAST_ONLY_UPDATE: 'exalted-scenes.castOnlyUpdate',
  CAST_ONLY_STOP: 'exalted-scenes.castOnlyStop',
  FOLDER_CREATE: 'exalted-scenes.folderCreate',
  FOLDER_UPDATE: 'exalted-scenes.folderUpdate',
  FOLDER_DELETE: 'exalted-scenes.folderDelete'
});

/**
 * Public API for the Exalted Scenes module.
 *
 * Provides a namespaced interface for all module operations:
 * - {@link ExaltedScenesAPI#scenes api.scenes} - Scene CRUD and cast management
 * - {@link ExaltedScenesAPI#characters api.characters} - Character CRUD, emotions, borders, permissions
 * - {@link ExaltedScenesAPI#folders api.folders} - Folder CRUD and item organization
 * - {@link ExaltedScenesAPI#slideshows api.slideshows} - Slideshow CRUD and playback
 * - {@link ExaltedScenesAPI#sequences api.sequences} - Sequence playback control
 * - {@link ExaltedScenesAPI#broadcast api.broadcast} - Scene broadcasting control
 * - {@link ExaltedScenesAPI#castOnly api.castOnly} - Cast-only mode control
 * - {@link ExaltedScenesAPI#audio api.audio} - Narrator Jukebox audio integration
 * - {@link ExaltedScenesAPI#castPresets api.castPresets} - Cast preset management (save/load/delete)
 * - {@link ExaltedScenesAPI#config api.config} - Read-only configuration constants
 * - {@link ExaltedScenesAPI#hooks api.hooks} - Hook event name constants
 *
 * @class ExaltedScenesAPI
 * @example
 * const api = game.modules.get('exalted-scenes').api;
 *
 * // Get all scenes
 * const scenes = api.scenes.getAll();
 *
 * // Broadcast a scene
 * await api.broadcast.scene(scenes[0].id);
 *
 * // Listen to events
 * Hooks.on(api.hooks.EMOTION_CHANGE, (data) => { ... });
 */
export class ExaltedScenesAPI {
  constructor() {
    const self = this;

    // ═══════════════════════════════════════════════════════════════
    // SCENES NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Scene operations: read, create, update, delete, and cast management.
     * @namespace
     */
    this.scenes = Object.freeze({
      /**
       * Gets all scenes with optional filtering.
       * @param {Object} [options={}] - Filter options
       * @param {string} [options.search] - Search term for name filtering
       * @param {string[]} [options.tags] - Filter by tags (scenes must have ALL specified tags)
       * @param {boolean} [options.favorite] - Filter by favorite status
       * @param {string} [options.folderId] - Filter by folder ID
       * @returns {Object[]} Array of scene plain objects (safe clones)
       */
      getAll(options = {}) {
        if (!self._requireInit()) return [];
        let scenes = Store.getScenes({ folderId: options.folderId, search: options.search });
        if (options.tags?.length) {
          scenes = scenes.filter(s => options.tags.every(t => s.tags?.includes(t)));
        }
        if (options.favorite !== undefined) {
          scenes = scenes.filter(s => s.favorite === options.favorite);
        }
        return scenes.map(s => self._cloneScene(s));
      },

      /**
       * Gets a single scene by ID.
       * @param {string} sceneId - The scene ID
       * @returns {Object|null} Scene plain object or null if not found
       */
      get(sceneId) {
        if (!self._requireInit()) return null;
        const scene = Store.scenes.get(sceneId);
        return scene ? self._cloneScene(scene) : null;
      },

      /**
       * Gets the cast members of a scene.
       * @param {string} sceneId - The scene ID
       * @returns {Object[]|null} Array of cast member objects or null if scene not found
       */
      getCast(sceneId) {
        if (!self._requireInit()) return null;
        const scene = Store.scenes.get(sceneId);
        if (!scene) return null;
        return [...scene.cast];
      },

      /**
       * Gets all unique tags used across scenes.
       * @returns {string[]} Sorted array of unique tag strings
       */
      getTags() {
        if (!self._requireInit()) return [];
        return Store.getAllTags('scene');
      },

      /**
       * Creates a new scene.
       * @param {Object} data - Scene creation data
       * @param {string} data.name - Scene name (required)
       * @param {string} [data.background] - Background image/video path
       * @param {string} [data.bgType='image'] - Background type ('image' or 'video')
       * @param {string} [data.folderId] - Folder ID to place scene in
       * @param {string[]} [data.tags] - Initial tags
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async create(data) {
        const guard = self._requireGM('scenes.create');
        if (guard) return guard;
        if (!data?.name) return { success: false, error: 'Scene name is required' };

        const scene = Store.createScene({
          name: data.name,
          imagePath: data.background,
          folderId: data.folderId
        });
        if (data.bgType) scene.bgType = data.bgType;
        if (data.tags) scene.tags = [...data.tags];
        await Store.saveData();
        const cloned = self._cloneScene(scene);
        Hooks.callAll(HOOK_NAMES.SCENE_CREATE, { scene: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Duplicates an existing scene.
       * @param {string} sceneId - The source scene ID
       * @param {Object} [options={}] - Duplicate options
       * @param {string} [options.name] - Optional explicit name for the duplicate
       * @param {string|null} [options.folderId] - Optional destination folder override
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async duplicate(sceneId, options = {}) {
        const guard = self._requireGM('scenes.duplicate');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        const scene = Store.duplicateScene(sceneId, {
          name: options.name,
          folder: options.folderId
        });
        await Store.saveData();
        const cloned = self._cloneScene(scene);
        Hooks.callAll(HOOK_NAMES.SCENE_CREATE, { scene: cloned, duplicatedFrom: sceneId });
        return { success: true, data: cloned };
      },

      /**
       * Updates an existing scene's properties.
       * @param {string} sceneId - The scene ID
       * @param {Object} changes - Properties to update (name, background, bgType, backgroundFit, tags, favorite, layoutSettings, audio)
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async update(sceneId, changes) {
        const guard = self._requireGM('scenes.update');
        if (guard) return guard;
        const scene = Store.scenes.get(sceneId);
        if (!scene) return { success: false, error: `Scene not found: ${sceneId}` };

        const allowed = ['name', 'background', 'bgType', 'backgroundFit', 'tags', 'favorite', 'layoutSettings', 'audio'];
        for (const key of Object.keys(changes)) {
          if (allowed.includes(key)) {
            scene[key] = key === 'tags' ? [...changes[key]] : changes[key];
          }
        }
        await Store.saveData();
        const cloned = self._cloneScene(scene);
        Hooks.callAll(HOOK_NAMES.SCENE_UPDATE, { sceneId, changes, scene: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Deletes a scene. Emits a cancellable pre-delete hook.
       * @param {string} sceneId - The scene ID
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async delete(sceneId) {
        const guard = self._requireGM('scenes.delete');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        const allowed = Hooks.call(HOOK_NAMES.PRE_SCENE_DELETE, { sceneId });
        if (allowed === false) return { success: false, error: 'Deletion cancelled by hook' };

        Store.deleteItem(sceneId, 'scene');
        await Store.saveData();
        Hooks.callAll(HOOK_NAMES.SCENE_DELETE, { sceneId });
        return { success: true };
      },

      /**
       * Adds a character to a scene's cast.
       * @param {string} sceneId - The scene ID
       * @param {string} characterId - The character ID to add
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async addCastMember(sceneId, characterId) {
        const guard = self._requireGM('scenes.addCastMember');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };
        if (!Store.characters.has(characterId)) return { success: false, error: `Character not found: ${characterId}` };

        // Store.addCastMember already calls saveData() internally
        Store.addCastMember(sceneId, characterId);
        const scene = Store.scenes.get(sceneId);
        if (scene) {
          Hooks.callAll(HOOK_NAMES.CAST_UPDATE, {
            sceneId,
            cast: foundry.utils.deepClone(scene.cast)
          });
        }
        return { success: true };
      },

      /**
       * Removes a character from a scene's cast.
       * @param {string} sceneId - The scene ID
       * @param {string} characterId - The character ID to remove
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async removeCastMember(sceneId, characterId) {
        const guard = self._requireGM('scenes.removeCastMember');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        // Store.removeCastMember already calls saveData() internally
        Store.removeCastMember(sceneId, characterId);
        const scene = Store.scenes.get(sceneId);
        if (scene) {
          Hooks.callAll(HOOK_NAMES.CAST_UPDATE, {
            sceneId,
            cast: foundry.utils.deepClone(scene.cast)
          });
        }
        return { success: true };
      },

      /**
       * Reorders a cast member within a scene.
       * @param {string} sceneId - The scene ID
       * @param {number} fromIndex - Original position index
       * @param {number} toIndex - Target position index
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async reorderCast(sceneId, fromIndex, toIndex) {
        const guard = self._requireGM('scenes.reorderCast');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        // Store.reorderCastMember already calls saveData() internally
        Store.reorderCastMember(sceneId, fromIndex, toIndex);
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CHARACTERS NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Character operations: read, create, update, delete, emotions, borders, permissions, and tags.
     * @namespace
     */
    this.characters = Object.freeze({
      /**
       * Gets all characters with optional filtering.
       * @param {Object} [options={}] - Filter options
       * @param {string} [options.search] - Search term for name filtering
       * @param {string[]} [options.tags] - Filter by tags (characters must have ALL specified tags)
       * @param {boolean} [options.favorite] - Filter by favorite status
       * @param {string} [options.folderId] - Filter by folder ID
       * @returns {Object[]} Array of character plain objects (safe clones)
       */
      getAll(options = {}) {
        if (!self._requireInit()) return [];
        let chars = Store.getCharacters({ folderId: options.folderId, search: options.search });
        if (options.tags?.length) {
          chars = chars.filter(c => {
            const charTags = c.tags instanceof Set ? c.tags : new Set(c.tags || []);
            return options.tags.every(t => charTags.has(t));
          });
        }
        if (options.favorite !== undefined) {
          chars = chars.filter(c => c.favorite === options.favorite);
        }
        return chars.map(c => self._cloneCharacter(c));
      },

      /**
       * Gets a single character by ID.
       * @param {string} characterId - The character ID
       * @returns {Object|null} Character plain object or null if not found
       */
      get(characterId) {
        if (!self._requireInit()) return null;
        const char = Store.characters.get(characterId);
        return char ? self._cloneCharacter(char) : null;
      },

      /**
       * Gets all unique tags used across characters.
       * @returns {string[]} Sorted array of unique tag strings
       */
      getTags() {
        if (!self._requireInit()) return [];
        return Store.getAllTags('character');
      },

      /**
       * Gets all characters that have a specific tag.
       * @param {string} tag - The tag to filter by
       * @returns {Object[]} Array of character plain objects
       */
      getByTag(tag) {
        if (!self._requireInit()) return [];
        const chars = Store.getCharacters({});
        return chars
          .filter(c => {
            const charTags = c.tags instanceof Set ? c.tags : new Set(c.tags || []);
            return charTags.has(tag);
          })
          .map(c => self._cloneCharacter(c));
      },

      /**
       * Gets all emotion states for a character.
       * @param {string} characterId - The character ID
       * @returns {Object|null} Map of state names to image paths, or null if not found
       */
      getEmotionStates(characterId) {
        if (!self._requireInit()) return null;
        const char = Store.characters.get(characterId);
        return char ? foundry.utils.deepClone(char.states) : null;
      },

      /**
       * Creates a new character.
       * @param {Object} data - Character creation data
       * @param {string} data.name - Character name (required)
       * @param {Object} [data.states] - Emotion states map { stateName: imagePath }
       * @param {Object} [data.stateFocus] - Emotion focus map { stateName: { x, y } }
       * @param {string[]} [data.tags] - Initial tags
       * @param {string} [data.folderId] - Folder ID to place character in
       * @param {Object} [data.borderStyle] - Border style { effect, color?, color2? }
       * @param {string} [data.actorId] - Linked Foundry Actor ID
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async create(data) {
        const guard = self._requireGM('characters.create');
        if (guard) return guard;
        if (!data?.name) return { success: false, error: 'Character name is required' };

        const imagePath = data.states ? Object.values(data.states)[0] : undefined;
        const char = Store.createCharacter({
          name: data.name,
          imagePath: imagePath
        });
         if (data.states) char.states = { ...data.states };
         if (data.stateFocus) char.stateFocus = normalizeMediaFocusMap(data.stateFocus);
         if (data.tags) char.tags = new Set(data.tags);
        if (data.folderId) char.folder = data.folderId;
        if (data.borderStyle) char.borderStyle = data.borderStyle;
        if (data.actorId) char.actorId = data.actorId;
        await Store.saveData();
        const cloned = self._cloneCharacter(char);
        Hooks.callAll(HOOK_NAMES.CHARACTER_CREATE, { character: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Duplicates an existing character.
       * @param {string} characterId - The source character ID
       * @param {Object} [options={}] - Duplicate options
       * @param {string} [options.name] - Optional explicit name for the duplicate
       * @param {string|null} [options.folderId] - Optional destination folder override
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async duplicate(characterId, options = {}) {
        const guard = self._requireGM('characters.duplicate');
        if (guard) return guard;
        if (!Store.characters.has(characterId)) return { success: false, error: `Character not found: ${characterId}` };

        const char = Store.duplicateCharacter(characterId, {
          name: options.name,
          folder: options.folderId
        });
        await Store.saveData();
        const cloned = self._cloneCharacter(char);
        Hooks.callAll(HOOK_NAMES.CHARACTER_CREATE, { character: cloned, duplicatedFrom: characterId });
        return { success: true, data: cloned };
      },

      /**
       * Updates an existing character's properties.
       * @param {string} characterId - The character ID
       * @param {Object} changes - Properties to update (name, states, stateFocus, currentState, borderStyle, favorite, actorId, musicPlaylistId, music)
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async update(characterId, changes) {
        const guard = self._requireGM('characters.update');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };

        const allowed = ['name', 'states', 'stateFocus', 'currentState', 'borderStyle', 'favorite', 'actorId', 'musicPlaylistId', 'music', 'heroStates', 'currentHeroState', 'hideNameInBroadcast'];
        for (const key of Object.keys(changes)) {
          if (allowed.includes(key)) {
            char[key] = key === 'stateFocus' ? normalizeMediaFocusMap(changes[key]) : changes[key];
          }
        }
        await Store.saveData();
        const cloned = self._cloneCharacter(char);
        Hooks.callAll(HOOK_NAMES.CHARACTER_UPDATE, { characterId, changes, character: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Deletes a character. Emits a cancellable pre-delete hook.
       * @param {string} characterId - The character ID
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async delete(characterId) {
        const guard = self._requireGM('characters.delete');
        if (guard) return guard;
        if (!Store.characters.has(characterId)) return { success: false, error: `Character not found: ${characterId}` };

        const allowed = Hooks.call(HOOK_NAMES.PRE_CHARACTER_DELETE, { characterId });
        if (allowed === false) return { success: false, error: 'Deletion cancelled by hook' };

        Store.deleteItem(characterId, 'character');
        await Store.saveData();
        Hooks.callAll(HOOK_NAMES.CHARACTER_DELETE, { characterId });
        return { success: true };
      },

      /**
       * Sets a character's emotion state. Respects permissions and lock status.
       * Broadcasts the change to all connected clients via socket.
       * @param {string} characterId - The character ID
       * @param {string} stateName - The emotion state name to set
       * @returns {{success: boolean, error?: string}} API result
       */
      setEmotion(characterId, stateName) {
        if (!self._requireInit()) return { success: false, error: 'Module not initialized' };
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };
        if (!char.states[stateName]) return { success: false, error: `Emotion state not found: ${stateName}` };

        if (!game.user.isGM) {
          if (char.locked) return { success: false, error: 'Character is locked by GM' };
          if (!char.hasPermission(game.user.id, 'emotion')) {
            return { success: false, error: 'Insufficient permission to change emotions' };
          }
        }

        SocketHandler.emitUpdateEmotion(characterId, stateName);
        return { success: true };
      },

      /**
       * Sets a character's border style. Respects permissions and lock status.
       * Broadcasts the change to all connected clients via socket.
       * @param {string} characterId - The character ID
       * @param {Object|string} borderStyle - Border style object { effect, color?, color2? } or legacy preset string
       * @returns {{success: boolean, error?: string}} API result
       */
      setBorder(characterId, borderStyle) {
        if (!self._requireInit()) return { success: false, error: 'Module not initialized' };
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };

        // Backward compat: string callers get mapped through migration map
        if (typeof borderStyle === 'string') {
          const migrated = CONFIG.BORDER_MIGRATION_MAP[borderStyle];
          if (!migrated) return { success: false, error: `Invalid border preset: ${borderStyle}` };
          borderStyle = { ...migrated };
        }

        // Validate object format
        if (!borderStyle || typeof borderStyle !== 'object' || !borderStyle.effect) {
          return { success: false, error: 'Invalid border style: must be { effect, color?, color2? }' };
        }
        if (!CONFIG.BORDER_EFFECTS[borderStyle.effect]) {
          return { success: false, error: `Invalid border effect: ${borderStyle.effect}` };
        }

        if (!game.user.isGM) {
          if (char.locked) return { success: false, error: 'Character is locked by GM' };
          if (!char.hasPermission(game.user.id, 'full')) {
            return { success: false, error: 'Insufficient permission to change border' };
          }
        }

        SocketHandler.emitUpdateBorder(characterId, borderStyle);
        return { success: true };
      },

      /**
       * Sets a character's lock status (GM only).
       * When locked, only the GM can change emotions and borders.
       * @param {string} characterId - The character ID
       * @param {boolean} locked - Whether to lock the character
       * @returns {{success: boolean, error?: string}} API result
       */
      setLocked(characterId, locked) {
        const guard = self._requireGM('characters.setLocked');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };

        SocketHandler.emitUpdateLock(characterId, !!locked);
        return { success: true };
      },

      /**
       * Sets a specific player's permission level on a character.
       * @param {string} characterId - The character ID
       * @param {string} userId - The player's user ID
       * @param {string} level - Permission level: 'none', 'view', 'emotion', or 'full'
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async setPermission(characterId, userId, level) {
        const guard = self._requireGM('characters.setPermission');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };
        const validLevels = ['none', 'view', 'emotion', 'full'];
        if (!validLevels.includes(level)) return { success: false, error: `Invalid permission level: ${level}` };

        char.setPlayerPermission(userId, level);
        await Store.saveData();
        return { success: true };
      },

      /**
       * Sets the default permission level for a character (applies to unlisted players).
       * @param {string} characterId - The character ID
       * @param {string} level - Permission level: 'none', 'view', 'emotion', or 'full'
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async setDefaultPermission(characterId, level) {
        const guard = self._requireGM('characters.setDefaultPermission');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };
        const validLevels = ['none', 'view', 'emotion', 'full'];
        if (!validLevels.includes(level)) return { success: false, error: `Invalid permission level: ${level}` };

        char.permissions.default = level;
        await Store.saveData();
        return { success: true };
      },

      /**
       * Checks if a user has a specific permission level on a character.
       * @param {string} characterId - The character ID
       * @param {string} [userId] - User ID to check (defaults to current user)
       * @param {string} [level='emotion'] - Minimum required level
       * @returns {boolean} Whether the user has the required permission
       */
      hasPermission(characterId, userId, level = 'emotion') {
        if (!self._requireInit()) return false;
        const char = Store.characters.get(characterId);
        if (!char) return false;
        return char.hasPermission(userId || game.user.id, level);
      },

      /**
       * Adds a tag to a character (GM only).
       * @param {string} characterId - The character ID
       * @param {string} tag - Tag string to add
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async addTag(characterId, tag) {
        const guard = self._requireGM('characters.addTag');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };

        if (char.tags instanceof Set) {
          char.tags.add(tag);
        } else {
          char.tags = new Set([...(char.tags || []), tag]);
        }
        await Store.saveData();
        return { success: true };
      },

      /**
       * Removes a tag from a character (GM only).
       * @param {string} characterId - The character ID
       * @param {string} tag - Tag string to remove
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async removeTag(characterId, tag) {
        const guard = self._requireGM('characters.removeTag');
        if (guard) return guard;
        const char = Store.characters.get(characterId);
        if (!char) return { success: false, error: `Character not found: ${characterId}` };

        if (char.tags instanceof Set) {
          char.tags.delete(tag);
        }
        await Store.saveData();
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // FOLDERS NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Folder operations: read, create, update, delete, and item organization.
     * @namespace
     */
    this.folders = Object.freeze({
      /**
       * Gets all folders of a specific type.
       * @param {string} type - Folder type: 'scene' or 'character'
       * @returns {Object[]} Array of folder plain objects
       */
      getAll(type) {
        if (!self._requireInit()) return [];
        return Store.folders
          .filter(f => f.type === type)
          .map(f => self._cloneFolder(f));
      },

      /**
       * Gets a single folder by ID.
       * @param {string} folderId - The folder ID
       * @returns {Object|null} Folder plain object or null if not found
       */
      get(folderId) {
        if (!self._requireInit()) return null;
        const folder = Store.folders.get(folderId);
        return folder ? self._cloneFolder(folder) : null;
      },

      /**
       * Gets child folders of a parent.
       * @param {string} type - Folder type: 'scene' or 'character'
       * @param {string|null} [parentId=null] - Parent folder ID (null for root-level folders)
       * @returns {Object[]} Array of child folder plain objects
       */
      getChildren(type, parentId = null) {
        if (!self._requireInit()) return [];
        return Store.getFolders(type, parentId).map(f => self._cloneFolder(f));
      },

      /**
       * Gets the folder path from root to target (breadcrumb).
       * @param {string} folderId - Target folder ID
       * @returns {Object[]} Array of folder objects from root to target
       */
      getPath(folderId) {
        if (!self._requireInit()) return [];
        return Store.getFolderPath(folderId).map(f => self._cloneFolder(f));
      },

      /**
       * Gets items (scenes or characters) in a folder.
       * @param {string} type - Item type: 'scene' or 'character'
       * @param {string|null} folderId - Folder ID (null for root-level items)
       * @returns {Object[]} Array of item plain objects
       */
      getItems(type, folderId) {
        if (!self._requireInit()) return [];
        const items = Store.getItemsInFolder(type, folderId);
        return items.map(item =>
          type === 'scene' ? self._cloneScene(item) : self._cloneCharacter(item)
        );
      },

      /**
       * Creates a new folder.
       * @param {Object} data - Folder creation data
       * @param {string} data.name - Folder name (required)
       * @param {string} data.type - Folder type: 'scene' or 'character' (required)
       * @param {string} [data.parentId] - Parent folder ID
       * @param {string} [data.color] - CSS color value
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async create(data) {
        const guard = self._requireGM('folders.create');
        if (guard) return guard;
        if (!data?.name) return { success: false, error: 'Folder name is required' };
        if (!data?.type || !['scene', 'character'].includes(data.type)) {
          return { success: false, error: 'Folder type must be "scene" or "character"' };
        }

        const folder = Store.createFolder({
          name: data.name,
          type: data.type,
          parentId: data.parentId || null,
          color: data.color || null
        });
        await Store.saveData();
        const cloned = self._cloneFolder(folder);
        Hooks.callAll(HOOK_NAMES.FOLDER_CREATE, { folder: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Updates a folder's properties.
       * @param {string} folderId - The folder ID
       * @param {Object} changes - Properties to update (name, color, sorting, sort, expanded)
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async update(folderId, changes) {
        const guard = self._requireGM('folders.update');
        if (guard) return guard;
        if (!Store.folders.has(folderId)) return { success: false, error: `Folder not found: ${folderId}` };

        Store.updateFolder(folderId, changes);
        await Store.saveData();
        const folder = Store.folders.get(folderId);
        const cloned = self._cloneFolder(folder);
        Hooks.callAll(HOOK_NAMES.FOLDER_UPDATE, { folderId, changes, folder: cloned });
        return { success: true, data: cloned };
      },

      /**
       * Deletes a folder.
       * @param {string} folderId - The folder ID
       * @param {boolean} [deleteContents=false] - If true, delete folder contents; if false, move to root
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async delete(folderId, deleteContents = false) {
        const guard = self._requireGM('folders.delete');
        if (guard) return guard;
        if (!Store.folders.has(folderId)) return { success: false, error: `Folder not found: ${folderId}` };

        Store.deleteFolder(folderId, deleteContents);
        await Store.saveData();
        Hooks.callAll(HOOK_NAMES.FOLDER_DELETE, { folderId });
        return { success: true };
      },

      /**
       * Moves an item into a folder.
       * @param {string} itemId - Item ID
       * @param {string} itemType - Item type: 'scene' or 'character'
       * @param {string|null} folderId - Target folder ID (null moves to root)
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async moveItem(itemId, itemType, folderId) {
        const guard = self._requireGM('folders.moveItem');
        if (guard) return guard;

        Store.moveItemToFolder(itemId, itemType, folderId);
        await Store.saveData();
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // SLIDESHOWS NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Slideshow operations: CRUD, scene management, and playback control.
     * @namespace
     */
    this.slideshows = Object.freeze({
      /**
       * Gets all slideshows.
       * @returns {Object[]} Array of slideshow plain objects
       */
      getAll() {
        if (!self._requireInit()) return [];
        return Store.getSlideshows().map(s => self._cloneSlideshow(s));
      },

      /**
       * Gets a single slideshow by ID.
       * @param {string} slideshowId - The slideshow ID
       * @returns {Object|null} Slideshow plain object or null if not found
       */
      get(slideshowId) {
        if (!self._requireInit()) return null;
        const slideshow = Store.slideshows.get(slideshowId);
        return slideshow ? self._cloneSlideshow(slideshow) : null;
      },

      /**
       * Gets the current slideshow playback progress.
       * @returns {Object|null} Progress object or null if no slideshow is playing
       */
      getProgress() {
        if (!self._requireInit()) return null;
        return Store.getSlideshowProgress();
      },

      /**
       * Creates a new slideshow.
       * @param {Object} data - Slideshow creation data
       * @param {string} data.name - Slideshow name (required)
       * @param {Array} [data.scenes] - Initial scenes array [{sceneId, duration}]
       * @param {number} [data.defaultDuration=5000] - Default scene duration in ms
       * @param {string} [data.transitionType='dissolve'] - Transition type
       * @param {boolean} [data.loop=false] - Loop setting
       * @param {boolean} [data.shuffle=false] - Shuffle setting
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async create(data) {
        const guard = self._requireGM('slideshows.create');
        if (guard) return guard;
        if (!data?.name) return { success: false, error: 'Slideshow name is required' };

        const slideshow = Store.createSlideshow(data);
        await Store.saveSlideshows();
        return { success: true, data: self._cloneSlideshow(slideshow) };
      },

      /**
       * Updates an existing slideshow's properties.
       * @param {string} slideshowId - The slideshow ID
       * @param {Object} changes - Properties to update
       * @returns {Promise<{success: boolean, data?: Object, error?: string}>} API result
       */
      async update(slideshowId, changes) {
        const guard = self._requireGM('slideshows.update');
        if (guard) return guard;
        const slideshow = Store.slideshows.get(slideshowId);
        if (!slideshow) return { success: false, error: `Slideshow not found: ${slideshowId}` };

        const allowed = ['name', 'defaultDuration', 'transitionType', 'transitionDuration', 'backgroundMotion', 'loop', 'shuffle', 'cinematicMode'];
        for (const key of Object.keys(changes)) {
          if (allowed.includes(key)) {
            slideshow[key] = changes[key];
          }
        }
        await Store.saveSlideshows();
        return { success: true, data: self._cloneSlideshow(slideshow) };
      },

      /**
       * Deletes a slideshow.
       * @param {string} slideshowId - The slideshow ID
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async delete(slideshowId) {
        const guard = self._requireGM('slideshows.delete');
        if (guard) return guard;
        if (!Store.slideshows.has(slideshowId)) return { success: false, error: `Slideshow not found: ${slideshowId}` };

        Store.deleteSlideshow(slideshowId);
        await Store.saveSlideshows();
        return { success: true };
      },

      /**
       * Adds a scene to a slideshow.
       * @param {string} slideshowId - The slideshow ID
       * @param {string} sceneId - The scene ID to add
       * @param {number} [duration] - Custom duration in ms (uses slideshow default if not specified)
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async addScene(slideshowId, sceneId, duration) {
        const guard = self._requireGM('slideshows.addScene');
        if (guard) return guard;
        const slideshow = Store.slideshows.get(slideshowId);
        if (!slideshow) return { success: false, error: `Slideshow not found: ${slideshowId}` };
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        const added = slideshow.addScene(sceneId, duration);
        if (!added) return { success: false, error: 'Scene already in slideshow' };
        await Store.saveSlideshows();
        return { success: true };
      },

      /**
       * Removes a scene from a slideshow by its scene ID.
       * @param {string} slideshowId - The slideshow ID
       * @param {string} sceneId - The scene ID to remove
       * @returns {Promise<{success: boolean, error?: string}>} API result
       */
      async removeScene(slideshowId, sceneId) {
        const guard = self._requireGM('slideshows.removeScene');
        if (guard) return guard;
        const slideshow = Store.slideshows.get(slideshowId);
        if (!slideshow) return { success: false, error: `Slideshow not found: ${slideshowId}` };

        const removed = slideshow.removeScene(sceneId);
        if (!removed) return { success: false, error: 'Scene not found in slideshow' };
        await Store.saveSlideshows();
        return { success: true };
      },

      /**
       * Starts playing a slideshow (GM only).
       * @param {string} slideshowId - The slideshow ID to play
       * @returns {{success: boolean, error?: string}} API result
       */
      play(slideshowId) {
        const guard = self._requireGM('slideshows.play');
        if (guard) return guard;
        if (!Store.slideshows.has(slideshowId)) return { success: false, error: `Slideshow not found: ${slideshowId}` };

        Store.startSlideshow(slideshowId);
        return { success: true };
      },

      /**
       * Pauses the currently playing slideshow.
       * @returns {{success: boolean, error?: string}} API result
       */
      pause() {
        const guard = self._requireGM('slideshows.pause');
        if (guard) return guard;
        if (!Store.slideshowState.isPlaying) return { success: false, error: 'No slideshow is playing' };

        Store.pauseSlideshow();
        return { success: true };
      },

      /**
       * Resumes a paused slideshow.
       * @returns {{success: boolean, error?: string}} API result
       */
      resume() {
        const guard = self._requireGM('slideshows.resume');
        if (guard) return guard;
        if (!Store.slideshowState.isPaused) return { success: false, error: 'Slideshow is not paused' };

        Store.resumeSlideshow();
        return { success: true };
      },

      /**
       * Advances to the next scene in the slideshow.
       * @returns {{success: boolean, error?: string}} API result
       */
      next() {
        const guard = self._requireGM('slideshows.next');
        if (guard) return guard;
        if (!Store.slideshowState.isPlaying) return { success: false, error: 'No slideshow is playing' };

        Store.nextScene();
        return { success: true };
      },

      /**
       * Goes back to the previous scene in the slideshow.
       * @returns {{success: boolean, error?: string}} API result
       */
      previous() {
        const guard = self._requireGM('slideshows.previous');
        if (guard) return guard;
        if (!Store.slideshowState.isPlaying) return { success: false, error: 'No slideshow is playing' };

        Store.previousScene();
        return { success: true };
      },

      /**
       * Stops the currently playing slideshow.
       * @returns {{success: boolean, error?: string}} API result
       */
      stop() {
        const guard = self._requireGM('slideshows.stop');
        if (guard) return guard;

        Store.stopSlideshow();
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // SEQUENCES NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Sequence playback control for multi-background scenes.
     * @namespace
     */
    this.sequences = Object.freeze({
      /**
       * Whether a sequence is currently active.
       * @returns {boolean}
       */
      isActive() {
        return Store.sequenceState?.isActive || false;
      },

      /**
       * Gets the current sequence playback progress.
       * @returns {Object|null} Progress object or null if no sequence is active
       */
      getProgress() {
        if (!self._requireInit()) return null;
        return foundry.utils.deepClone(Store.getSequenceProgress());
      },

      /**
       * Starts a sequence for a multi-background scene (GM only).
       * @param {string} sceneId - Scene ID (must be a sequence scene)
       * @returns {{success: boolean, error?: string}} API result
       */
      start(sceneId) {
        const guard = self._requireGM('sequences.start');
        if (guard) return guard;
        const scene = Store.scenes.get(sceneId);
        if (!scene) return { success: false, error: `Scene not found: ${sceneId}` };
        if (!scene.isSequence) return { success: false, error: 'Scene is not a sequence' };

        Store.startSequence(sceneId);
        return { success: true };
      },

      /**
       * Advances to the next background in the sequence.
       * @returns {{success: boolean, error?: string}} API result
       */
      next() {
        const guard = self._requireGM('sequences.next');
        if (guard) return guard;
        if (!Store.sequenceState.isActive) return { success: false, error: 'No sequence is active' };

        Store.sequenceNext();
        return { success: true };
      },

      /**
       * Goes back to the previous background in the sequence.
       * @returns {{success: boolean, error?: string}} API result
       */
      previous() {
        const guard = self._requireGM('sequences.previous');
        if (guard) return guard;
        if (!Store.sequenceState.isActive) return { success: false, error: 'No sequence is active' };

        Store.sequencePrevious();
        return { success: true };
      },

      /**
       * Jumps to a specific background index in the sequence.
       * @param {number} index - Target background index (0-based)
       * @returns {{success: boolean, error?: string}} API result
       */
      goTo(index) {
        const guard = self._requireGM('sequences.goTo');
        if (guard) return guard;
        if (!Store.sequenceState.isActive) return { success: false, error: 'No sequence is active' };

        Store.sequenceGoTo(index);
        return { success: true };
      },

      /**
       * Stops the current sequence playback.
       * @returns {{success: boolean, error?: string}} API result
       */
      stop() {
        const guard = self._requireGM('sequences.stop');
        if (guard) return guard;

        Store.stopSequence();
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // BROADCAST NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Broadcasting control for scenes.
     * @namespace
     */
    this.broadcast = Object.freeze({
      /**
       * Whether any content is currently being broadcast.
       * @returns {boolean}
       */
      isActive() {
        return Store.isBroadcasting;
      },

      /**
       * Gets the currently active (broadcasting) scene ID.
       * @returns {string|null}
       */
      getActiveSceneId() {
        return Store.activeSceneId || null;
      },

      /**
       * Gets the current broadcast state with mode information.
       * @returns {Object} Broadcast state: { isBroadcasting, mode, activeSceneId }
       */
      getState() {
        let mode = null;
        if (Store.slideshowState.isPlaying) mode = 'slideshow';
        else if (Store.sequenceState.isActive) mode = 'sequence';
        else if (Store.castOnlyState.isActive) mode = 'castOnly';
        else if (Store.activeSceneId) mode = 'scene';

        return {
          isBroadcasting: Store.isBroadcasting,
          mode,
          activeSceneId: Store.activeSceneId || null
        };
      },

      /**
       * Broadcasts a scene to all players (GM only).
       * @param {string} sceneId - Scene ID to broadcast
       * @returns {{success: boolean, error?: string}} API result
       */
      scene(sceneId) {
        const guard = self._requireGM('broadcast.scene');
        if (guard) return guard;
        if (!Store.scenes.has(sceneId)) return { success: false, error: `Scene not found: ${sceneId}` };

        SocketHandler.emitBroadcastScene(sceneId);
        return { success: true };
      },

      /**
       * Stops all current broadcasting (GM only).
       * Stops scenes, slideshows, sequences, and cast-only mode.
       * @returns {{success: boolean, error?: string}} API result
       */
      stop() {
        const guard = self._requireGM('broadcast.stop');
        if (guard) return guard;

        if (Store.slideshowState.isPlaying) Store.stopSlideshow();
        if (Store.sequenceState.isActive) Store.stopSequence();
        if (Store.castOnlyState.isActive) Store.stopCastOnly();
        if (Store.activeSceneId) SocketHandler.emitStopBroadcast();
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CAST-ONLY NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Cast-only mode: display character portraits without a scene background.
     * @namespace
     */
    this.castOnly = Object.freeze({
      /**
       * Whether cast-only mode is currently active.
       * @returns {boolean}
       */
      isActive() {
        return Store.castOnlyState?.isActive || false;
      },

      /**
       * Gets the current cast-only mode progress/state.
       * @returns {Object|null} Progress object or null if not active
       */
      getProgress() {
        if (!self._requireInit()) return null;
        return foundry.utils.deepClone(Store.getCastOnlyProgress());
      },

      /**
       * Starts cast-only mode with specified characters (GM only).
       * @param {string[]} characterIds - Array of character IDs to display
       * @param {Object} [layoutSettings] - Optional layout settings
       * @param {string} [layoutSettings.preset='bottom-center'] - Layout preset
       * @param {string} [layoutSettings.size='medium'] - Portrait size
       * @param {number} [layoutSettings.spacing=24] - Spacing between portraits
       * @returns {{success: boolean, error?: string}} API result
       */
      start(characterIds, layoutSettings) {
        const guard = self._requireGM('castOnly.start');
        if (guard) return guard;
        if (!characterIds?.length) return { success: false, error: 'At least one character ID is required' };

        Store.startCastOnly(characterIds, layoutSettings);
        return { success: true };
      },

      /**
       * Stops cast-only mode.
       * @returns {{success: boolean, error?: string}} API result
       */
      stop() {
        const guard = self._requireGM('castOnly.stop');
        if (guard) return guard;

        Store.stopCastOnly();
        return { success: true };
      },

      /**
       * Adds a character to the current cast-only display.
       * @param {string} characterId - Character ID to add
       * @returns {{success: boolean, error?: string}} API result
       */
      addCharacter(characterId) {
        const guard = self._requireGM('castOnly.addCharacter');
        if (guard) return guard;
        if (!Store.castOnlyState.isActive) return { success: false, error: 'Cast-only mode is not active' };
        if (!Store.characters.has(characterId)) return { success: false, error: `Character not found: ${characterId}` };

        Store.addCharacterToCastOnly(characterId);
        return { success: true };
      },

      /**
       * Removes a character from the current cast-only display.
       * @param {string} characterId - Character ID to remove
       * @returns {{success: boolean, error?: string}} API result
       */
      removeCharacter(characterId) {
        const guard = self._requireGM('castOnly.removeCharacter');
        if (guard) return guard;
        if (!Store.castOnlyState.isActive) return { success: false, error: 'Cast-only mode is not active' };

        Store.removeCharacterFromCastOnly(characterId);
        return { success: true };
      },

      /**
       * Updates the cast-only mode layout settings.
       * @param {Object} layoutSettings - Layout configuration
       * @returns {{success: boolean, error?: string}} API result
       */
      updateLayout(layoutSettings) {
        const guard = self._requireGM('castOnly.updateLayout');
        if (guard) return guard;
        if (!Store.castOnlyState.isActive) return { success: false, error: 'Cast-only mode is not active' };

        Store.updateCastOnlyLayout(layoutSettings);
        return { success: true };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // AUDIO NAMESPACE (Narrator Jukebox Integration)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Narrator Jukebox audio integration: playback state queries and GM-only controls.
     * Requires the Narrator Jukebox module to be installed and active.
     * @namespace
     */
    this.audio = Object.freeze({
      /**
       * Whether the Narrator Jukebox module is installed and active.
       * @returns {boolean}
       */
      isAvailable() {
        return NarratorJukeboxIntegration.isAvailable;
      },

      /**
       * Gets the current NJ playback state.
       * @returns {{isPlaying: boolean, currentTrack: Object|null, isPreviewMode: boolean}|null} Playback state or null if NJ unavailable
       */
      getPlaybackState() {
        if (!NarratorJukeboxIntegration.isAvailable) return null;
        return NarratorJukeboxIntegration.getPlaybackState();
      },

      /**
       * Gets a scene's audio configuration (tracks, layers, sounds, volume, fadeOut, playbackMode).
       * @param {string} sceneId - Scene ID
       * @returns {Object|null} Audio config (deep clone) or null if scene not found
       */
      getSceneAudio(sceneId) {
        if (!self._requireInit()) return null;
        const scene = Store.scenes.get(sceneId);
        if (!scene) return null;
        return foundry.utils.deepClone(scene.audio);
      },

      /**
       * Plays a scene's full audio (soundtrack + ambience). GM only.
       * @param {string} sceneId - Scene ID whose audio to play
       * @returns {Promise<{success: boolean, data?: {music: boolean, ambience: boolean}, error?: string}>}
       */
      async playSceneAudio(sceneId) {
        const guard = self._requireGM('audio.playSceneAudio');
        if (guard) return guard;
        if (!NarratorJukeboxIntegration.isAvailable) return { success: false, error: 'Narrator Jukebox is not available' };
        const scene = Store.scenes.get(sceneId);
        if (!scene) return { success: false, error: `Scene not found: ${sceneId}` };

        const result = await NarratorJukeboxIntegration.playSceneAudio(scene);
        return { success: true, data: foundry.utils.deepClone(result) };
      },

      /**
       * Restores a scene's audio (music and/or ambience) without checking auto-play flags. GM only.
       * @param {string} sceneId - Scene ID whose audio to restore
       * @param {Object} [options] - Restore options
       * @param {boolean} [options.music=true] - Whether to restore music
       * @param {boolean} [options.ambience=true] - Whether to restore ambience
       * @returns {Promise<{success: boolean, data?: {music: boolean, ambience: boolean}, error?: string}>}
       */
      async restoreSceneAudio(sceneId, options) {
        const guard = self._requireGM('audio.restoreSceneAudio');
        if (guard) return guard;
        if (!NarratorJukeboxIntegration.isAvailable) return { success: false, error: 'Narrator Jukebox is not available' };
        const scene = Store.scenes.get(sceneId);
        if (!scene) return { success: false, error: `Scene not found: ${sceneId}` };

        const result = await NarratorJukeboxIntegration.restoreSceneAudio(scene, options);
        return { success: true, data: foundry.utils.deepClone(result) };
      },

      /**
       * Stops all audio, optionally using a scene's fade-out duration. GM only.
       * @param {string} [sceneId] - Optional scene ID to read fadeOut duration from
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async stopAll(sceneId) {
        const guard = self._requireGM('audio.stopAll');
        if (guard) return guard;
        if (!NarratorJukeboxIntegration.isAvailable) return { success: false, error: 'Narrator Jukebox is not available' };

        let fadeDuration = 0;
        if (sceneId) {
          const scene = Store.scenes.get(sceneId);
          if (scene?.audio?.fadeOut) fadeDuration = scene.audio.fadeOut;
        }
        await NarratorJukeboxIntegration.fadeOutAndStop(fadeDuration);
        return { success: true };
      },

      /**
       * Triggers a one-shot soundboard sound. GM only.
       * @param {string} soundId - Soundboard sound ID to play
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async playSoundboardSound(soundId) {
        const guard = self._requireGM('audio.playSoundboardSound');
        if (guard) return guard;
        if (!NarratorJukeboxIntegration.isAvailable) return { success: false, error: 'Narrator Jukebox is not available' };
        if (!soundId) return { success: false, error: 'Sound ID is required' };

        const played = await NarratorJukeboxIntegration.playSoundboardSound(soundId);
        return played ? { success: true } : { success: false, error: 'Failed to play soundboard sound' };
      },

      /**
       * Sets the music channel volume (0–1). GM only.
       * @param {number} volume - Volume level between 0 and 1
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async setVolume(volume) {
        const guard = self._requireGM('audio.setVolume');
        if (guard) return guard;
        if (!NarratorJukeboxIntegration.isAvailable) return { success: false, error: 'Narrator Jukebox is not available' };
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
          return { success: false, error: 'Volume must be a number between 0 and 1' };
        }

        const set = NarratorJukeboxIntegration.setMusicVolume(volume);
        return set ? { success: true } : { success: false, error: 'Failed to set volume' };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CAST PRESETS NAMESPACE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Cast preset management: save, load, list, delete, and rename reusable cast + layout configurations.
     * @namespace
     */
    this.castPresets = Object.freeze({
      /**
       * Lists all saved cast presets.
       * @returns {Object[]} Array of preset objects (safe copies)
       */
      list() {
        if (!self._requireInit()) return [];
        return foundry.utils.deepClone(Store.getCastPresets());
      },

      /**
       * Saves the cast and layout of a scene as a named preset. GM only.
       * @param {string} name - Preset display name
       * @param {string} sceneId - Source scene ID
       * @returns {{success: boolean, preset?: Object, error?: string}}
       */
      save(name, sceneId) {
        const guard = self._requireGM('castPresets.save');
        if (guard) return guard;
        if (!name?.trim()) return { success: false, error: 'Preset name is required' };
        if (!sceneId) return { success: false, error: 'Scene ID is required' };
        return Store.saveCastPreset(name, sceneId);
      },

      /**
       * Loads a preset into a scene, replacing its cast and layout settings. GM only.
       * @param {string} presetId - Preset ID to load
       * @param {string} sceneId - Target scene ID
       * @returns {{success: boolean, loaded?: number, missing?: string[], error?: string}}
       */
      load(presetId, sceneId) {
        const guard = self._requireGM('castPresets.load');
        if (guard) return guard;
        if (!presetId) return { success: false, error: 'Preset ID is required' };
        if (!sceneId) return { success: false, error: 'Scene ID is required' };
        return Store.loadCastPreset(presetId, sceneId);
      },

      /**
       * Deletes a cast preset. GM only.
       * @param {string} presetId - Preset ID to delete
       * @returns {{success: boolean, error?: string}}
       */
      delete(presetId) {
        const guard = self._requireGM('castPresets.delete');
        if (guard) return guard;
        if (!presetId) return { success: false, error: 'Preset ID is required' };
        return Store.deleteCastPreset(presetId)
          ? { success: true }
          : { success: false, error: 'Preset not found' };
      },

      /**
       * Renames a cast preset. GM only.
       * @param {string} presetId - Preset ID
       * @param {string} newName - New display name
       * @returns {{success: boolean, error?: string}}
       */
      rename(presetId, newName) {
        const guard = self._requireGM('castPresets.rename');
        if (guard) return guard;
        if (!presetId) return { success: false, error: 'Preset ID is required' };
        if (!newName?.trim()) return { success: false, error: 'New name is required' };
        return Store.renameCastPreset(presetId, newName)
          ? { success: true }
          : { success: false, error: 'Preset not found' };
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CONFIG NAMESPACE (read-only)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Read-only access to module configuration constants.
     * All values are deep clones to prevent external mutation.
     * @namespace
     */
    this.config = Object.freeze({
      BORDER_EFFECTS: Object.freeze(foundry.utils.deepClone(CONFIG.BORDER_EFFECTS)),
      BORDER_COLORS: Object.freeze(foundry.utils.deepClone(CONFIG.BORDER_COLORS)),
      LAYOUT_PRESETS: Object.freeze(foundry.utils.deepClone(CONFIG.LAYOUT_PRESETS)),
      SIZE_PRESETS: Object.freeze(foundry.utils.deepClone(CONFIG.SIZE_PRESETS)),
      TRANSITIONS: Object.freeze(foundry.utils.deepClone(CONFIG.TRANSITIONS)),
      BACKGROUND_MOTION: Object.freeze(foundry.utils.deepClone(CONFIG.BACKGROUND_MOTION)),
      COLOR_THEMES: Object.freeze(foundry.utils.deepClone(CONFIG.COLOR_THEMES))
    });

    // ═══════════════════════════════════════════════════════════════
    // HOOKS NAMESPACE (constants)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Hook event name constants for use with Foundry's Hooks.on().
     * Provides discoverability - use these instead of hardcoding hook strings.
     * @namespace
     * @readonly
     */
    this.hooks = HOOK_NAMES;
  }

  // ═══════════════════════════════════════════════════════════════
  // ROOT-LEVEL METHODS (backward compatible)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Opens the appropriate panel based on user role.
   * GM users get the GM Panel; players get the Player Panel.
   */
  open() {
    import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
      import('../apps/PlayerPanel.js').then(({ ExaltedScenesPlayerPanel }) => {
        if (game.user.isGM) {
          ExaltedScenesGMPanel.show();
        } else {
          ExaltedScenesPlayerPanel.show();
        }
      }).catch(e => console.error('Exalted Scenes | Failed to load PlayerPanel:', e));
    }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
  }

  /**
   * Opens the GM Panel (GM only).
   */
  openGMPanel() {
    import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
      ExaltedScenesGMPanel.show();
    }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
  }

  /**
   * Opens the Player Panel.
   */
  openPlayerPanel() {
    import('../apps/PlayerPanel.js').then(({ ExaltedScenesPlayerPanel }) => {
      ExaltedScenesPlayerPanel.show();
    }).catch(e => console.error('Exalted Scenes | Failed to load PlayerPanel:', e));
  }

  /**
   * Closes all open Exalted Scenes panels.
   */
  close() {
    import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
      if (ExaltedScenesGMPanel._instance) ExaltedScenesGMPanel._instance.close();
    }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
    import('../apps/PlayerPanel.js').then(({ ExaltedScenesPlayerPanel }) => {
      if (ExaltedScenesPlayerPanel._instance) ExaltedScenesPlayerPanel._instance.close();
    }).catch(e => console.error('Exalted Scenes | Failed to load PlayerPanel:', e));
  }

  /**
   * The module version string.
   * @type {string}
   * @readonly
   */
  get version() {
    return game.modules.get(CONFIG.MODULE_ID)?.version ?? 'unknown';
  }

  /**
   * Whether the module data store is initialized and ready.
   * @type {boolean}
   * @readonly
   */
  get isReady() {
    return Store.isInitialized;
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Checks if the store is initialized. Logs a warning if not.
   * @private
   * @returns {boolean}
   */
  _requireInit() {
    if (!Store.isInitialized) {
      console.warn(`${CONFIG.MODULE_NAME} | API called before module initialization`);
      return false;
    }
    return true;
  }

  /**
   * Checks if the current user is a GM. Returns an error result if not.
   * @private
   * @param {string} operation - Operation name for the error message
   * @returns {{success: boolean, error: string}|null} Error result or null if GM
   */
  _requireGM(operation) {
    if (!this._requireInit()) return { success: false, error: 'Module not initialized' };
    if (!game.user.isGM) return { success: false, error: `${operation} requires GM permission` };
    return null;
  }

  /**
   * Creates a safe clone of a scene model.
   * @private
   * @param {SceneModel} scene
   * @returns {Object}
   */
  _cloneScene(scene) {
    if (!scene) return null;
    return scene.toJSON();
  }

  _cloneCharacter(char) {
    if (!char) return null;
    return char.toJSON();
  }

  _cloneFolder(folder) {
    if (!folder) return null;
    return folder.toJSON();
  }

  _cloneSlideshow(slideshow) {
    if (!slideshow) return null;
    return slideshow.toJSON();
  }
}

/**
 * Exported hook name constants for direct import by other modules.
 * @type {Object}
 */
export { HOOK_NAMES };
