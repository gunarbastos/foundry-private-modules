/**
 * @file SlideshowModel.js
 * @description Data model for slideshows in the Exalted Scenes module.
 * Slideshows are sequences of scenes that play automatically with transitions.
 *
 * @module data/SlideshowModel
 */

/**
 * Data model representing a slideshow configuration.
 * A slideshow is a sequence of scenes that can be played automatically
 * with configurable timing, transitions, and playback options.
 *
 * @class SlideshowModel
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {Array<{sceneId: string, duration: number}>} scenes - Scene sequence
 * @property {number} defaultDuration - Default scene duration in milliseconds
 * @property {string} transitionType - Transition type ('dissolve' or 'none')
 * @property {number} transitionDuration - Transition duration in milliseconds
 * @property {string} backgroundMotion - Background motion preset ('none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'ken-burns', 'random')
 * @property {boolean} loop - Whether to loop the slideshow
 * @property {boolean} shuffle - Whether to shuffle scene order
 * @property {boolean} cinematicMode - Whether to use cinematic mode
 */
export class SlideshowModel {
  /**
   * Creates a new SlideshowModel instance.
   * @param {Object} data - Slideshow data
   * @param {string} [data.id] - Unique identifier (auto-generated if not provided)
   * @param {string} [data.name='New Slideshow'] - Display name
   * @param {Array} [data.scenes=[]] - Scene sequence array
   * @param {number} [data.defaultDuration=5000] - Default duration in ms
   * @param {string} [data.transitionType='dissolve'] - Transition type
   * @param {number} [data.transitionDuration=500] - Transition duration in ms
   * @param {boolean} [data.loop=false] - Loop setting
   * @param {boolean} [data.shuffle=false] - Shuffle setting
   * @param {boolean} [data.cinematicMode=false] - Cinematic mode setting
   */
  constructor(data = {}) {
    this.id = data.id || foundry.utils.randomID();
    this.name = data.name || 'New Slideshow';
    this.type = 'slideshow';

    // Scene sequence: array of { sceneId, duration (ms) }
    this.scenes = data.scenes || [];

    // Timing settings
    this.defaultDuration = data.defaultDuration || 5000; // 5 seconds default

    // Transition settings
    this.transitionType = data.transitionType || 'dissolve'; // dissolve or none
    this.transitionDuration = data.transitionDuration || 500; // ms

    // Background motion (Ken Burns effect)
    this.backgroundMotion = data.backgroundMotion || 'none';

    // Playback options
    this.loop = data.loop !== undefined ? data.loop : false;
    this.shuffle = data.shuffle !== undefined ? data.shuffle : false;
    this.cinematicMode = data.cinematicMode !== undefined ? data.cinematicMode : false;

    // Metadata
    this.createdAt = data.createdAt || Date.now();
    this.lastUsed = data.lastUsed || null;
    this.playCount = data.playCount || 0;
  }

  /**
   * Adds a scene to the slideshow.
   * Prevents duplicate scenes.
   * @param {string} sceneId - ID of scene to add
   * @param {number|null} [duration=null] - Custom duration in ms (uses defaultDuration if null)
   * @returns {boolean} True if scene was added, false if duplicate
   */
  addScene(sceneId, duration = null) {
    // Prevent duplicates
    if (this.scenes.some(s => s.sceneId === sceneId)) return false;

    this.scenes.push({
      sceneId,
      duration: duration || this.defaultDuration
    });
    return true;
  }

  /**
   * Removes a scene from the slideshow.
   * @param {string} sceneId - ID of scene to remove
   * @returns {boolean} True if scene was removed, false if not found
   */
  removeScene(sceneId) {
    const index = this.scenes.findIndex(s => s.sceneId === sceneId);
    if (index !== -1) {
      this.scenes.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Reorders scenes by moving from one index to another.
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   */
  reorderScene(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [moved] = this.scenes.splice(fromIndex, 1);
    this.scenes.splice(toIndex, 0, moved);
  }

  /**
   * Updates the duration for a specific scene in the slideshow.
   * @param {string} sceneId - ID of scene to update
   * @param {number} duration - New duration in milliseconds
   * @returns {boolean} True if scene was found and updated
   */
  setSceneDuration(sceneId, duration) {
    const scene = this.scenes.find(s => s.sceneId === sceneId);
    if (scene) {
      scene.duration = duration;
      return true;
    }
    return false;
  }

  /**
   * Gets the total duration of all scenes in milliseconds.
   * @type {number}
   */
  get totalDuration() {
    return this.scenes.reduce((sum, s) => sum + s.duration, 0);
  }

  /**
   * Gets the total duration formatted as "M:SS".
   * @type {string}
   */
  get formattedDuration() {
    const total = this.totalDuration;
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Gets the scene sequence for playback, optionally shuffled.
   * @returns {Array<{sceneId: string, duration: number}>} Copy of scenes array
   */
  getPlaySequence() {
    if (this.shuffle) {
      return [...this.scenes].sort(() => Math.random() - 0.5);
    }
    return [...this.scenes];
  }

  /**
   * Serializes the slideshow to a plain object for storage.
   * @returns {Object} Plain object representation of the slideshow
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      scenes: this.scenes,
      defaultDuration: this.defaultDuration,
      transitionType: this.transitionType,
      transitionDuration: this.transitionDuration,
      backgroundMotion: this.backgroundMotion,
      loop: this.loop,
      shuffle: this.shuffle,
      cinematicMode: this.cinematicMode,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      playCount: this.playCount
    };
  }
}
