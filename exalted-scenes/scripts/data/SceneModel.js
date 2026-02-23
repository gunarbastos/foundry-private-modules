/**
 * @file SceneModel.js
 * @description Data model for scenes in the Exalted Scenes module.
 * Scenes contain backgrounds, cast members, and optional sequence support.
 *
 * @module data/SceneModel
 */

/**
 * Data model representing a scene with background and cast members.
 * Supports both single-background scenes and multi-background sequences.
 *
 * @class SceneModel
 */
export class SceneModel {
  /**
   * Creates a new SceneModel instance.
   * @param {Object} data - Scene data
   * @param {string} [data.id] - Unique identifier (auto-generated if not provided)
   * @param {string} [data.name='New Scene'] - Display name
   * @param {string} [data.background] - Background image/video path
   * @param {string} [data.bgType='image'] - Background type ('image' or 'video')
   * @param {string|null} [data.folder=null] - Parent folder ID
   * @param {boolean} [data.favorite=false] - Favorite status
   * @param {string[]} [data.tags=[]] - Tag list
   * @param {Array} [data.cast=[]] - Cast member references
   * @param {boolean} [data.isSequence=false] - Whether this is a sequence
   * @param {Array} [data.sequenceBackgrounds=[]] - Sequence backgrounds
   * @param {Object} [data.sequenceSettings] - Sequence playback settings
   * @param {Object} [data.layoutSettings] - Cast layout settings
   * @param {string|null} [data.backgroundFit=null] - Background fit mode override ('fill', 'fit', 'smart', or null for global default)
   * @param {Object} [data.audio] - Narrator Jukebox audio settings
   */
  constructor(data = {}) {
    this.id = data.id || foundry.utils.randomID();
    this.name = data.name || 'New Scene';
    this.type = 'scene';
    this.background = data.background || 'modules/exalted-scenes/assets/default-scene.jpg';
    this.bgType = data.bgType || 'image'; // 'image' or 'video'
    this.backgroundFit = data.backgroundFit || null; // null = use global setting, or 'fill'/'fit'/'smart'
    this.folder = data.folder || null;
    this.favorite = data.favorite || false;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || Date.now();
    this.lastUsed = data.lastUsed || null;
    this.playCount = data.playCount || 0;

    // Cast members (references to characters)
    this.cast = data.cast || [];

    // Sequence feature - multiple backgrounds with shared cast
    this.isSequence = data.isSequence || false;
    this.sequenceBackgrounds = data.sequenceBackgrounds || []; // Array of { id, path, bgType }
    this.sequenceSettings = data.sequenceSettings || {
      transitionType: 'dissolve', // 'dissolve' or 'cut'
      transitionDuration: 1.0,    // seconds (ignored if cut)
      onEnd: 'stop'               // 'stop' or 'loop'
    };

    // Layout settings for cast display
    this.layoutSettings = data.layoutSettings || {
      preset: 'bottom-center',    // Position preset
      size: 'medium',             // Size preset (small, medium, large, xlarge) or custom vh value
      spacing: 24,                // Gap between characters in pixels
      offsetX: 0,                 // Horizontal offset in vh
      offsetY: 5                  // Vertical offset in vh
    };

    // Narrator Jukebox audio integration
    this.audio = data.audio || {
      playlistId: null,           // Linked playlist ID from Narrator Jukebox
      ambiencePresetId: null,     // Linked ambience preset ID
      autoPlayMusic: false,       // Auto-play playlist on broadcast
      autoPlayAmbience: false,    // Auto-play ambience preset on broadcast
      stopOnEnd: false            // Stop audio when scene ends/changes
    };
  }

  /**
   * Gets the thumbnail image path.
   * For sequences, returns the first background.
   * @type {string}
   */
  get thumbnail() {
    // For sequences, show the first background
    if (this.isSequence && this.sequenceBackgrounds.length > 0) {
      return this.sequenceBackgrounds[0].path;
    }
    return this.background;
  }

  /**
   * Gets the main background image path.
   * @type {string}
   */
  get image() {
    return this.background;
  }

  /**
   * Gets the background at a specific index in the sequence.
   * @param {number} index - Background index (clamped to valid range)
   * @returns {{path: string, bgType: string}} Background data
   */
  getSequenceBackground(index) {
    if (!this.isSequence || this.sequenceBackgrounds.length === 0) {
      return { path: this.background, bgType: this.bgType };
    }
    const safeIndex = Math.max(0, Math.min(index, this.sequenceBackgrounds.length - 1));
    return this.sequenceBackgrounds[safeIndex];
  }

  /**
   * Adds a background to the sequence.
   * @param {string} path - Path to the background image/video
   * @param {string} [bgType='image'] - Background type ('image' or 'video')
   * @returns {{id: string, path: string, bgType: string}} The created background entry
   */
  addSequenceBackground(path, bgType = 'image') {
    const bg = {
      id: foundry.utils.randomID(),
      path,
      bgType
    };
    this.sequenceBackgrounds.push(bg);
    return bg;
  }

  /**
   * Removes a background from the sequence by ID.
   * @param {string} id - Background entry ID to remove
   */
  removeSequenceBackground(id) {
    this.sequenceBackgrounds = this.sequenceBackgrounds.filter(bg => bg.id !== id);
  }

  /**
   * Reorders backgrounds in the sequence by moving from one index to another.
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   */
  reorderSequenceBackground(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [moved] = this.sequenceBackgrounds.splice(fromIndex, 1);
    this.sequenceBackgrounds.splice(toIndex, 0, moved);
  }

  /**
   * Converts a regular scene to a sequence, keeping the current background as the first item.
   * Does nothing if already a sequence.
   */
  convertToSequence() {
    if (this.isSequence) return;
    this.isSequence = true;
    // Add current background as the first item
    this.sequenceBackgrounds = [{
      id: foundry.utils.randomID(),
      path: this.background,
      bgType: this.bgType
    }];
  }

  /**
   * Converts a sequence back to a regular scene, using the first background.
   * Does nothing if not a sequence.
   */
  convertToRegular() {
    if (!this.isSequence) return;
    if (this.sequenceBackgrounds.length > 0) {
      this.background = this.sequenceBackgrounds[0].path;
      this.bgType = this.sequenceBackgrounds[0].bgType;
    }
    this.isSequence = false;
    this.sequenceBackgrounds = [];
  }

  /**
   * Checks if this scene has any audio configured (playlist or ambience).
   * @type {boolean}
   */
  get hasAudio() {
    return !!(this.audio?.playlistId || this.audio?.ambiencePresetId);
  }

  /**
   * Checks if this scene has a linked playlist.
   * @type {boolean}
   */
  get hasPlaylist() {
    return !!this.audio?.playlistId;
  }

  /**
   * Checks if this scene has a linked ambience preset.
   * @type {boolean}
   */
  get hasAmbience() {
    return !!this.audio?.ambiencePresetId;
  }

  /**
   * Serializes the scene to a plain object for storage.
   * @returns {Object} Plain object representation of the scene
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      background: this.background,
      bgType: this.bgType,
      backgroundFit: this.backgroundFit,
      folder: this.folder,
      favorite: this.favorite,
      tags: this.tags,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      playCount: this.playCount,
      cast: this.cast,
      isSequence: this.isSequence,
      sequenceBackgrounds: this.sequenceBackgrounds,
      sequenceSettings: this.sequenceSettings,
      layoutSettings: this.layoutSettings,
      audio: this.audio
    };
  }
}
