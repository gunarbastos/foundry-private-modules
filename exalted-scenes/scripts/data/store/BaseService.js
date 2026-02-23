/**
 * @file BaseService.js
 * @description Base class for Store services. Provides common functionality
 * and access patterns for all specialized services.
 *
 * @module data/store/BaseService
 */

import { CONFIG } from '../../config.js';

/**
 * Base class for Store services.
 * All services that handle specific domains (scenes, characters, slideshows, etc.)
 * should extend this class.
 *
 * @abstract
 */
export class BaseService {
  /**
   * Creates a new service instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    if (!store) {
      throw new Error(`${this.constructor.name}: Store reference is required`);
    }

    /**
     * Reference to the main store
     * @type {ExaltedStore}
     * @protected
     */
    this.store = store;
  }

  /* ═══════════════════════════════════════════════════════════════
     CONVENIENCE ACCESSORS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Access to scenes collection
   * @returns {foundry.utils.Collection}
   */
  get scenes() {
    return this.store.scenes;
  }

  /**
   * Access to characters collection
   * @returns {foundry.utils.Collection}
   */
  get characters() {
    return this.store.characters;
  }

  /**
   * Access to folders collection
   * @returns {foundry.utils.Collection}
   */
  get folders() {
    return this.store.folders;
  }

  /**
   * Access to slideshows collection
   * @returns {foundry.utils.Collection}
   */
  get slideshows() {
    return this.store.slideshows;
  }

  /**
   * Access to slideshow playback state
   * @returns {Object}
   */
  get slideshowState() {
    return this.store.slideshowState;
  }

  /**
   * Access to sequence playback state
   * @returns {Object}
   */
  get sequenceState() {
    return this.store.sequenceState;
  }

  /**
   * Access to cast-only mode state
   * @returns {Object}
   */
  get castOnlyState() {
    return this.store.castOnlyState;
  }

  /**
   * Access to custom order state
   * @returns {Object}
   */
  get customOrder() {
    return this.store.customOrder;
  }

  /**
   * Access to active scene ID
   * @returns {string|null}
   */
  get activeSceneId() {
    return this.store.activeSceneId;
  }

  /**
   * Check if store is initialized
   * @returns {boolean}
   */
  get isInitialized() {
    return this.store.isInitialized;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Parse data from various formats (string, object, array) into an array.
   * Handles edge cases from Foundry settings storage.
   *
   * @param {string|Object|Array} data - Data to parse
   * @returns {Array|null} Parsed array or null if invalid
   * @protected
   */
  _parseData(data) {
    let parsed = data;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.warn(`${CONFIG.MODULE_NAME} | Failed to parse data string:`, e);
      }
    }
    if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
      parsed = Object.values(parsed);
    }
    return Array.isArray(parsed) ? parsed : null;
  }

  /**
   * Log a message with the module prefix
   * @param {string} message - Message to log
   * @protected
   */
  _log(message) {
    console.log(`${CONFIG.MODULE_NAME} | ${message}`);
  }

  /**
   * Log a warning with the module prefix
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   * @protected
   */
  _warn(message, ...args) {
    console.warn(`${CONFIG.MODULE_NAME} | ${message}`, ...args);
  }

  /* ═══════════════════════════════════════════════════════════════
     STORE DELEGATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Save all main data (scenes, characters, folders)
   * Delegates to store.saveData()
   * @returns {Promise<void>}
   * @protected
   */
  async saveData() {
    return this.store.saveData();
  }

  /**
   * Set the active scene ID
   * @param {string} id - Scene ID
   * @protected
   */
  setActiveScene(id) {
    this.store.setActiveScene(id);
  }

  /**
   * Clear the active scene
   * @protected
   */
  clearActiveScene() {
    this.store.clearActiveScene();
  }
}
