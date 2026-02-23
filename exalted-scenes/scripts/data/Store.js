/**
 * @file Store.js - Central data store facade for Exalted Scenes
 * @description Manages all module data through a facade pattern, delegating to specialized services.
 *
 * This store acts as a single point of access for all data operations while internally
 * delegating to specialized services:
 * - SceneService: Scene CRUD and cast member management
 * - CharacterService: Character CRUD, tags, emotions, and permissions
 * - FolderService: Folder hierarchy and item organization
 * - SlideshowService: Slideshow CRUD operations
 * - SlideshowPlaybackService: Slideshow playback control
 * - SequencePlaybackService: Scene sequence navigation
 * - CastOnlyService: Cast-only mode management
 * - OrderingService: Custom item ordering
 *
 * @module data/Store
 */

import { CONFIG } from '../config.js';
import { SceneModel } from './SceneModel.js';
import { CharacterModel } from './CharacterModel.js';
import { FolderModel } from './FolderModel.js';
import { SlideshowModel } from './SlideshowModel.js';

import { initializeServices } from './store/index.js';

/**
 * Central data store for Exalted Scenes module.
 * Provides a facade interface to all data operations, delegating to specialized services.
 *
 * @class ExaltedStore
 * @example
 * // Access scenes
 * const scenes = Store.getScenes({ folderId: 'folder-123' });
 *
 * // Create a character
 * const character = Store.createCharacter({ name: 'Hero', imagePath: '/path/to/image.png' });
 *
 * // Start a slideshow
 * Store.startSlideshow('slideshow-id');
 */
export class ExaltedStore {
  /**
   * Creates a new ExaltedStore instance.
   * Initializes all collections and state objects.
   * Call initialize() after construction to load data and set up services.
   */
  constructor() {
    /** @type {foundry.utils.Collection<SceneModel>} Collection of all scenes */
    this.scenes = new foundry.utils.Collection();

    /** @type {foundry.utils.Collection<CharacterModel>} Collection of all characters */
    this.characters = new foundry.utils.Collection();

    /** @type {foundry.utils.Collection<FolderModel>} Collection of all folders */
    this.folders = new foundry.utils.Collection();

    /** @type {foundry.utils.Collection<SlideshowModel>} Collection of all slideshows */
    this.slideshows = new foundry.utils.Collection();

    /** @type {string|null} ID of the currently active/broadcasting scene */
    this.activeSceneId = null;

    /** @type {boolean} Whether the store has been initialized */
    this.isInitialized = false;

    /** @type {{scenes: string[], characters: string[]}} Custom ordering for items */
    this.customOrder = { scenes: [], characters: [] };

    /**
     * Flag to prevent processing our own setting updates in the updateSetting hook.
     * This prevents a race condition where saving data triggers a reload that could
     * clear collections while they're being populated.
     * @type {boolean}
     * @private
     */
    this._isSaving = false;

    /** @type {Object|null} Service instances (populated during initialize()) */
    this._services = null;

    /** @type {Object} Slideshow playback state */
    this.slideshowState = {
      isPlaying: false,
      slideshowId: null,
      currentIndex: 0,
      sequence: [],
      isPaused: false,
      timerId: null,
      startTime: null,
      pausedTime: null
    };

    /** @type {Object} Scene sequence playback state (manual GM navigation) */
    this.sequenceState = {
      isActive: false,
      sceneId: null,
      currentIndex: 0,
      totalBackgrounds: 0,
      transitionType: 'dissolve',
      transitionDuration: 1.0,
      onEnd: 'stop'
    };

    /** @type {Object} Cast-only mode state (cast without scene background) */
    this.castOnlyState = {
      isActive: false,
      characterIds: [],
      layoutSettings: {
        preset: 'bottom-center',
        size: 'medium',
        spacing: 24,
        offsetX: 0,
        offsetY: 5
      }
    };
  }

  /**
   * Whether any scene is currently being broadcast to players.
   * @type {boolean}
   */
  get isBroadcasting() {
    return !!this.activeSceneId || this.castOnlyState.isActive || this.slideshowState.isPlaying;
  }

  /**
   * Sets the active scene ID for broadcasting.
   * @param {string} id - The scene ID to set as active
   */
  setActiveScene(id) {
    this.activeSceneId = id;
  }

  /**
   * Clears the active scene ID.
   */
  clearActiveScene() {
    this.activeSceneId = null;
  }

  /**
   * Initializes the store by loading data from settings and setting up services.
   * Should be called once during module initialization.
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    console.log(`${CONFIG.MODULE_NAME} | Initializing Data Store`);

    await this._loadData();

    // Initialize services
    this._services = initializeServices(this);

    this.isInitialized = true;

    // Listen for external changes (Sync)
    // Note: This hook fires for ALL setting updates, including our own saves.
    // We use _isSaving flag to skip processing our own updates to prevent race conditions.
    Hooks.on('updateSetting', (setting, data, options, userId) => {
      // Skip if we triggered this update ourselves (prevents race condition)
      if (this._isSaving) {
        return;
      }

      // In Foundry V10+, setting updates are passed as {value: newValue}
      const newValue = data.value !== undefined ? data.value : data;

      if (setting.key === `${CONFIG.MODULE_ID}.${CONFIG.SETTINGS.SCENES}`) {
        this._loadScenes(newValue);
        // If active scene was updated, refresh views
        if (this.activeSceneId) {
           import('../apps/PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
               ExaltedScenesPlayerView.refresh();
           });
        }
      }
      if (setting.key === `${CONFIG.MODULE_ID}.${CONFIG.SETTINGS.CHARACTERS}`) {
        this._loadCharacters(newValue);
      }
      if (setting.key === `${CONFIG.MODULE_ID}.${CONFIG.SETTINGS.FOLDERS}`) {
        this._loadFolders(newValue);
      }
    });
  }

  _parseData(data) {
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch (e) { 
        console.warn(`${CONFIG.MODULE_NAME} | Failed to parse data string:`, e);
      }
    }
    if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
      parsed = Object.values(parsed);
    }
    return Array.isArray(parsed) ? parsed : null;
  }

  _loadScenes(data) {
    const scenes = this._parseData(data);
    if (!scenes) {
      console.warn(`${CONFIG.MODULE_NAME} | Received invalid scenes data (type: ${typeof data}):`, data);
      return;
    }

    // DEFENSIVE: Don't clear existing data if new data is empty
    // This prevents accidental data loss from race conditions or corrupted sync messages
    if (scenes.length === 0 && this.scenes.size > 0) {
      console.warn(`${CONFIG.MODULE_NAME} | Ignoring empty scenes sync (current: ${this.scenes.size} scenes)`);
      return;
    }

    this.scenes.clear();
    scenes.forEach(d => this.scenes.set(d.id, new SceneModel(d)));
    console.log(`${CONFIG.MODULE_NAME} | Synced Scenes (${this.scenes.size})`);
  }

  _loadCharacters(data) {
    const chars = this._parseData(data);
    if (!chars) {
      console.warn(`${CONFIG.MODULE_NAME} | Received invalid characters data (type: ${typeof data}):`, data);
      return;
    }

    // DEFENSIVE: Don't clear existing data if new data is empty
    // This prevents accidental data loss from race conditions or corrupted sync messages
    if (chars.length === 0 && this.characters.size > 0) {
      console.warn(`${CONFIG.MODULE_NAME} | Ignoring empty characters sync (current: ${this.characters.size} characters)`);
      return;
    }

    this.characters.clear();
    chars.forEach(d => this.characters.set(d.id, new CharacterModel(d)));
    console.log(`${CONFIG.MODULE_NAME} | Synced Characters (${this.characters.size})`);
  }

  _loadFolders(data) {
    const folders = this._parseData(data);
    if (!folders) {
      console.warn(`${CONFIG.MODULE_NAME} | Received invalid folders data (type: ${typeof data}):`, data);
      return;
    }

    // DEFENSIVE: Don't clear existing data if new data is empty
    // This prevents accidental data loss from race conditions or corrupted sync messages
    if (folders.length === 0 && this.folders.size > 0) {
      console.warn(`${CONFIG.MODULE_NAME} | Ignoring empty folders sync (current: ${this.folders.size} folders)`);
      return;
    }

    this.folders.clear();
    folders.forEach(d => this.folders.set(d.id, new FolderModel(d)));
    console.log(`${CONFIG.MODULE_NAME} | Synced Folders (${this.folders.size})`);
  }

  /* ═══════════════════════════════════════════════════════════════
     DATA LOADING & SAVING
     ═══════════════════════════════════════════════════════════════ */

  async _loadData() {
    // Load Scenes
    const scenesData = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.SCENES) || [];
    this.scenes.clear();
    scenesData.forEach(d => this.scenes.set(d.id, new SceneModel(d)));

    // Load Characters
    const charsData = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.CHARACTERS) || [];
    this.characters.clear();
    charsData.forEach(d => this.characters.set(d.id, new CharacterModel(d)));

    // Load Folders
    const foldersData = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.FOLDERS) || [];
    this.folders.clear();
    foldersData.forEach(d => this.folders.set(d.id, new FolderModel(d)));

    // Load Custom Order
    const customOrderData = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.CUSTOM_ORDER) || { scenes: [], characters: [] };
    this.customOrder = customOrderData;

    // Load Slideshows
    const slideshowsData = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.SLIDESHOWS) || [];
    this.slideshows.clear();
    slideshowsData.forEach(d => this.slideshows.set(d.id, new SlideshowModel(d)));

    console.log(`${CONFIG.MODULE_NAME} | Loaded ${this.scenes.size} scenes, ${this.characters.size} characters, ${this.slideshows.size} slideshows.`);
  }

  /**
   * Saves all data (scenes, characters, folders) to Foundry settings.
   * Uses _isSaving flag to prevent the updateSetting hook from processing
   * our own updates, which could cause a race condition.
   * @async
   * @returns {Promise<void>}
   */
  async saveData() {
    if (!this.isInitialized) return;

    // Set flag to prevent updateSetting hook from processing our own save
    this._isSaving = true;

    try {
      const scenesData = this.scenes.map(s => s.toJSON());
      const charsData = this.characters.map(c => c.toJSON());
      const foldersData = this.folders.map(f => f.toJSON());

      await Promise.all([
        game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.SCENES, scenesData),
        game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.CHARACTERS, charsData),
        game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.FOLDERS, foldersData)
      ]);

      console.log(`${CONFIG.MODULE_NAME} | Data Saved`);
    } finally {
      // Always reset flag, even if save fails
      this._isSaving = false;
    }
  }


  /* ═══════════════════════════════════════════════════════════════
     ACCESSORS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Gets scenes with optional filtering.
   * @param {Object} [options={}] - Filter options
   * @param {string} [options.folderId] - Filter by folder ID
   * @param {string} [options.search] - Search term for name filtering
   * @returns {SceneModel[]} Array of matching scenes
   */
  getScenes(options = {}) {
    return this._services.scene.getScenes(options);
  }

  /**
   * Gets characters with optional filtering.
   * @param {Object} [options={}] - Filter options
   * @param {string} [options.folderId] - Filter by folder ID
   * @param {string} [options.search] - Search term for name filtering
   * @param {string} [options.tag] - Filter by tag
   * @returns {CharacterModel[]} Array of matching characters
   */
  getCharacters(options = {}) {
    return this._services.character.getCharacters(options);
  }

  /**
   * Gets all unique tags from scenes and/or characters.
   * @param {string} [type='all'] - Type filter: 'all', 'character', or 'scene'
   * @returns {string[]} Sorted array of unique tags
   */
  getAllTags(type = 'all') {
    const tags = new Set();

    if (type === 'all' || type === 'character') {
      const characterTags = this._services.character.getAllCharacterTags();
      characterTags.forEach(t => tags.add(t));
    }

    if (type === 'all' || type === 'scene') {
      this.scenes.forEach(s => {
        if (s.tags) s.tags.forEach(t => tags.add(t));
      });
    }

    return Array.from(tags).sort();
  }

  /* ═══════════════════════════════════════════════════════════════
     CRUD OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Creates a new scene.
   * @param {Object} data - Scene data
   * @param {string} data.name - Scene name
   * @param {string} [data.imagePath] - Background image path
   * @param {string} [data.folderId] - Folder ID to place scene in
   * @returns {SceneModel} The created scene
   */
  createScene(data) {
    return this._services.scene.createScene(data);
  }

  /**
   * Adds a character to a scene's cast.
   * @param {string} sceneId - Scene ID
   * @param {string} charId - Character ID to add
   */
  addCastMember(sceneId, charId) {
    return this._services.scene.addCastMember(sceneId, charId);
  }

  /**
   * Removes a character from a scene's cast.
   * @param {string} sceneId - Scene ID
   * @param {string} charId - Character ID to remove
   */
  removeCastMember(sceneId, charId) {
    return this._services.scene.removeCastMember(sceneId, charId);
  }

  /**
   * Reorders a cast member within a scene.
   * @param {string} sceneId - Scene ID
   * @param {number} fromIndex - Original index
   * @param {number} toIndex - Target index
   */
  reorderCastMember(sceneId, fromIndex, toIndex) {
    return this._services.scene.reorderCastMember(sceneId, fromIndex, toIndex);
  }

  /**
   * Creates a new character.
   * @param {Object} data - Character data
   * @param {string} data.name - Character name
   * @param {string} data.imagePath - Character image path
   * @param {string[]} [data.tags] - Character tags
   * @returns {CharacterModel} The created character
   */
  createCharacter(data) {
    return this._services.character.createCharacter(data);
  }

  /**
   * Deletes a scene or character.
   * @param {string} id - Item ID
   * @param {string} type - Item type: 'scene' or 'character'
   */
  deleteItem(id, type) {
    if (type === 'scene') {
      return this._services.scene.deleteScene(id);
    } else {
      return this._services.character.deleteCharacter(id);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     FOLDER OPERATIONS (delegated to FolderService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Creates a new folder.
   * @param {Object} data - Folder data
   * @param {string} data.name - Folder name
   * @param {string} data.type - Folder type: 'scene' or 'character'
   * @param {string} [data.parentId] - Parent folder ID
   * @param {string} [data.color] - Folder color
   * @returns {FolderModel} The created folder
   */
  createFolder(data) {
    return this._services.folder.createFolder(data);
  }

  /**
   * Updates a folder's properties.
   * @param {string} id - Folder ID
   * @param {Object} data - Properties to update
   */
  updateFolder(id, data) {
    return this._services.folder.updateFolder(id, data);
  }

  /**
   * Deletes a folder.
   * @param {string} id - Folder ID
   * @param {boolean} [deleteContents=false] - Whether to delete folder contents
   */
  deleteFolder(id, deleteContents = false) {
    return this._services.folder.deleteFolder(id, deleteContents);
  }

  /**
   * Toggles a folder's expanded/collapsed state.
   * @param {string} id - Folder ID
   */
  toggleFolderExpanded(id) {
    return this._services.folder.toggleFolderExpanded(id);
  }

  /**
   * Moves an item to a folder.
   * @param {string} itemId - Item ID
   * @param {string} itemType - Item type: 'scene' or 'character'
   * @param {string|null} folderId - Target folder ID (null for root)
   */
  moveItemToFolder(itemId, itemType, folderId) {
    return this._services.folder.moveItemToFolder(itemId, itemType, folderId);
  }

  /**
   * Gets folders of a specific type.
   * @param {string} type - Folder type: 'scene' or 'character'
   * @param {string|null} [parentId=null] - Parent folder ID (null for root)
   * @returns {FolderModel[]} Array of folders
   */
  getFolders(type, parentId = null) {
    return this._services.folder.getFolders(type, parentId);
  }

  /**
   * Gets the path from root to a folder (breadcrumb).
   * @param {string} folderId - Target folder ID
   * @returns {FolderModel[]} Array of folders from root to target
   */
  getFolderPath(folderId) {
    return this._services.folder.getFolderPath(folderId);
  }

  /**
   * Gets items in a folder.
   * @param {string} type - Item type: 'scene' or 'character'
   * @param {string|null} folderId - Folder ID (null for root)
   * @returns {Array} Array of items in the folder
   */
  getItemsInFolder(type, folderId) {
    return this._services.folder.getItemsInFolder(type, folderId);
  }

  /* ═══════════════════════════════════════════════════════════════
     CUSTOM ORDER (delegated to OrderingService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Gets the custom order for a type.
   * @param {string} type - Order type: 'scenes' or 'characters'
   * @returns {string[]} Array of item IDs in custom order
   */
  getCustomOrder(type) {
    return this._services.ordering.getCustomOrder(type);
  }

  /**
   * Sets the custom order for a type.
   * @param {string} type - Order type: 'scenes' or 'characters'
   * @param {string[]} orderedIds - Array of item IDs in desired order
   */
  setCustomOrder(type, orderedIds) {
    return this._services.ordering.setCustomOrder(type, orderedIds);
  }

  /**
   * Persists custom order to Foundry settings.
   * @async
   * @returns {Promise<void>}
   */
  async saveCustomOrder() {
    return this._services.ordering.saveCustomOrder();
  }

  /**
   * Applies custom order to an array of items.
   * @param {Array} items - Items to sort
   * @param {string} type - Order type: 'scenes' or 'characters'
   * @returns {Array} Items sorted by custom order
   */
  applyCustomOrder(items, type) {
    return this._services.ordering.applyCustomOrder(items, type);
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW OPERATIONS (delegated to SlideshowService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Creates a new slideshow.
   * @param {Object} data - Slideshow data
   * @param {string} data.name - Slideshow name
   * @param {Array} [data.scenes] - Initial scenes
   * @returns {SlideshowModel} The created slideshow
   */
  createSlideshow(data) {
    return this._services.slideshow.createSlideshow(data);
  }

  /**
   * Deletes a slideshow.
   * @param {string} id - Slideshow ID
   */
  deleteSlideshow(id) {
    return this._services.slideshow.deleteSlideshow(id);
  }

  /**
   * Gets all slideshows.
   * @returns {SlideshowModel[]} Array of slideshows
   */
  getSlideshows() {
    return this._services.slideshow.getSlideshows();
  }

  /**
   * Persists slideshows to Foundry settings.
   * @async
   * @returns {Promise<void>}
   */
  async saveSlideshows() {
    return this._services.slideshow.saveSlideshows();
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW PLAYBACK (delegated to SlideshowPlaybackService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts playing a slideshow.
   * @param {string} slideshowId - Slideshow ID to play
   */
  startSlideshow(slideshowId) {
    return this._services.slideshowPlayback.startSlideshow(slideshowId);
  }

  /**
   * Pauses the currently playing slideshow.
   */
  pauseSlideshow() {
    return this._services.slideshowPlayback.pauseSlideshow();
  }

  /**
   * Resumes a paused slideshow.
   */
  resumeSlideshow() {
    return this._services.slideshowPlayback.resumeSlideshow();
  }

  /**
   * Advances to the next scene in the slideshow.
   */
  nextScene() {
    return this._services.slideshowPlayback.nextScene();
  }

  /**
   * Goes back to the previous scene in the slideshow.
   */
  previousScene() {
    return this._services.slideshowPlayback.previousScene();
  }

  /**
   * Stops the currently playing slideshow.
   * @param {boolean} [broadcast=true] - Whether to broadcast stop to players
   */
  stopSlideshow(broadcast = true) {
    return this._services.slideshowPlayback.stopSlideshow(broadcast);
  }

  /**
   * Gets the current slideshow playback progress.
   * @returns {Object} Progress object with isPlaying, isPaused, currentIndex, total, name
   */
  getSlideshowProgress() {
    return this._services.slideshowPlayback.getSlideshowProgress();
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE OPERATIONS (delegated to SequencePlaybackService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts a scene sequence for manual background navigation.
   * @param {string} sceneId - Scene ID with sequence backgrounds
   */
  startSequence(sceneId) {
    return this._services.sequencePlayback.startSequence(sceneId);
  }

  /**
   * Advances to the next background in the sequence.
   */
  sequenceNext() {
    return this._services.sequencePlayback.sequenceNext();
  }

  /**
   * Goes back to the previous background in the sequence.
   */
  sequencePrevious() {
    return this._services.sequencePlayback.sequencePrevious();
  }

  /**
   * Jumps to a specific background index in the sequence.
   * @param {number} index - Target background index
   */
  sequenceGoTo(index) {
    return this._services.sequencePlayback.sequenceGoTo(index);
  }

  /**
   * Stops the current sequence playback.
   * @param {boolean} [broadcast=true] - Whether to broadcast stop to players
   */
  stopSequence(broadcast = true) {
    return this._services.sequencePlayback.stopSequence(broadcast);
  }

  /**
   * Gets the current sequence playback progress.
   * @returns {Object} Progress object with isActive, currentIndex, total, sceneName
   */
  getSequenceProgress() {
    return this._services.sequencePlayback.getSequenceProgress();
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE OPERATIONS (delegated to CastOnlyService)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts cast-only mode (displays characters without a scene background).
   * @param {string[]} characterIds - Character IDs to display
   * @param {Object} [layoutSettings=null] - Optional layout configuration
   */
  startCastOnly(characterIds, layoutSettings = null) {
    return this._services.castOnly.startCastOnly(characterIds, layoutSettings);
  }

  /**
   * Stops cast-only mode.
   * @param {boolean} [broadcast=true] - Whether to broadcast stop to players
   */
  stopCastOnly(broadcast = true) {
    return this._services.castOnly.stopCastOnly(broadcast);
  }

  /**
   * Adds a character to the current cast-only display.
   * @param {string} characterId - Character ID to add
   */
  addCharacterToCastOnly(characterId) {
    return this._services.castOnly.addCharacterToCastOnly(characterId);
  }

  /**
   * Removes a character from the current cast-only display.
   * @param {string} characterId - Character ID to remove
   */
  removeCharacterFromCastOnly(characterId) {
    return this._services.castOnly.removeCharacterFromCastOnly(characterId);
  }

  /**
   * Updates the cast-only mode layout settings.
   * @param {Object} layoutSettings - Layout configuration
   * @param {string} [layoutSettings.preset] - Layout preset name
   * @param {string} [layoutSettings.size] - Character size
   * @param {number} [layoutSettings.spacing] - Spacing between characters
   */
  updateCastOnlyLayout(layoutSettings) {
    return this._services.castOnly.updateCastOnlyLayout(layoutSettings);
  }

  /**
   * Gets the current cast-only mode progress/state.
   * @returns {Object} Progress object with isActive, characterCount, layoutSettings
   */
  getCastOnlyProgress() {
    return this._services.castOnly.getCastOnlyProgress();
  }
}




// Singleton Instance
export const Store = new ExaltedStore();
