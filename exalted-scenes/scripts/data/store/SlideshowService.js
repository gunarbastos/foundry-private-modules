/**
 * @file SlideshowService.js
 * @description Service for slideshow CRUD operations.
 * Handles all slideshow-related data operations (no playback logic).
 * Playback logic is handled by SlideshowPlaybackService (C6).
 *
 * @module data/store/SlideshowService
 */

import { CONFIG } from '../../config.js';
import { BaseService } from './BaseService.js';
import { SlideshowModel } from '../SlideshowModel.js';

/**
 * Service for managing slideshow data.
 * Provides CRUD operations for slideshows without playback logic.
 *
 * @extends BaseService
 */
export class SlideshowService extends BaseService {
  /**
   * Creates a new SlideshowService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW QUERIES
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all slideshows.
   *
   * @returns {SlideshowModel[]} Array of all slideshows
   */
  getSlideshows() {
    return this.slideshows.contents;
  }

  /**
   * Get a slideshow by ID.
   *
   * @param {string} id - Slideshow ID
   * @returns {SlideshowModel|undefined} The slideshow or undefined if not found
   */
  getSlideshow(id) {
    return this.slideshows.get(id);
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW CRUD
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Create a new slideshow.
   *
   * @param {Object} data - Slideshow data
   * @param {string} data.name - Slideshow name
   * @param {Array} [data.scenes] - Array of scene references
   * @param {string} [data.transitionType] - Transition type
   * @param {number} [data.transitionDuration] - Transition duration in seconds
   * @param {boolean} [data.loop] - Whether to loop
   * @param {boolean} [data.cinematicMode] - Whether to use cinematic mode
   * @returns {SlideshowModel} The created slideshow
   */
  createSlideshow(data) {
    const slideshow = new SlideshowModel(data);
    this.slideshows.set(slideshow.id, slideshow);
    this.saveSlideshows();
    return slideshow;
  }

  /**
   * Update an existing slideshow.
   *
   * @param {string} id - Slideshow ID
   * @param {Object} data - Data to update
   * @returns {SlideshowModel|undefined} The updated slideshow or undefined if not found
   */
  updateSlideshow(id, data) {
    const slideshow = this.slideshows.get(id);
    if (slideshow) {
      Object.assign(slideshow, data);
      this.saveSlideshows();
    }
    return slideshow;
  }

  /**
   * Delete a slideshow.
   * If the slideshow is currently playing, it will be stopped first.
   *
   * @param {string} id - Slideshow ID to delete
   */
  deleteSlideshow(id) {
    // Stop if currently playing (delegate to store which will handle playback service)
    if (this.slideshowState.slideshowId === id) {
      this.store.stopSlideshow();
    }
    this.slideshows.delete(id);
    this.saveSlideshows();
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW SCENE MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Add a scene to a slideshow.
   *
   * @param {string} slideshowId - Slideshow ID
   * @param {string} sceneId - Scene ID to add
   * @param {number} [duration=5000] - Scene duration in milliseconds
   * @returns {boolean} True if added, false if slideshow not found
   */
  addSceneToSlideshow(slideshowId, sceneId, duration = 5000) {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) return false;

    // Check if scene exists
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;

    // Add scene reference
    slideshow.scenes.push({
      sceneId,
      duration
    });

    this.saveSlideshows();
    return true;
  }

  /**
   * Remove a scene from a slideshow.
   *
   * @param {string} slideshowId - Slideshow ID
   * @param {number} index - Index of scene to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeSceneFromSlideshow(slideshowId, index) {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) return false;

    if (index < 0 || index >= slideshow.scenes.length) return false;

    slideshow.scenes.splice(index, 1);
    this.saveSlideshows();
    return true;
  }

  /**
   * Reorder scenes in a slideshow.
   *
   * @param {string} slideshowId - Slideshow ID
   * @param {number} fromIndex - Current index
   * @param {number} toIndex - Target index
   * @returns {boolean} True if reordered, false if not found
   */
  reorderSlideshowScenes(slideshowId, fromIndex, toIndex) {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) return false;

    if (fromIndex < 0 || fromIndex >= slideshow.scenes.length) return false;
    if (toIndex < 0 || toIndex >= slideshow.scenes.length) return false;

    const [scene] = slideshow.scenes.splice(fromIndex, 1);
    slideshow.scenes.splice(toIndex, 0, scene);

    this.saveSlideshows();
    return true;
  }

  /**
   * Update scene duration in a slideshow.
   *
   * @param {string} slideshowId - Slideshow ID
   * @param {number} index - Scene index
   * @param {number} duration - New duration in milliseconds
   * @returns {boolean} True if updated, false if not found
   */
  updateSceneDuration(slideshowId, index, duration) {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) return false;

    if (index < 0 || index >= slideshow.scenes.length) return false;

    slideshow.scenes[index].duration = duration;
    this.saveSlideshows();
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     PERSISTENCE
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Save all slideshows to Foundry settings.
   *
   * @returns {Promise<void>}
   */
  async saveSlideshows() {
    if (!this.isInitialized) return;
    const data = this.slideshows.map(s => s.toJSON());
    await game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.SLIDESHOWS, data);
  }

  /**
   * Load slideshows from data (used during sync).
   *
   * @param {string|Object|Array} data - Slideshow data to load
   */
  loadSlideshows(data) {
    const slideshows = this._parseData(data);
    if (!slideshows) return;
    this.slideshows.clear();
    slideshows.forEach(d => this.slideshows.set(d.id, new SlideshowModel(d)));
    this._log(`Loaded ${this.slideshows.size} slideshows`);
  }

  /* ═══════════════════════════════════════════════════════════════
     STATISTICS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Update usage statistics for a slideshow.
   *
   * @param {string} id - Slideshow ID
   */
  updateStats(id) {
    const slideshow = this.slideshows.get(id);
    if (slideshow) {
      slideshow.lastUsed = Date.now();
      slideshow.playCount++;
      this.saveSlideshows();
    }
  }
}
