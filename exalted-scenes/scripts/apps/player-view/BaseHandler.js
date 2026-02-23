/**
 * @file BaseHandler.js
 * @description Base class for all PlayerView handlers. Provides common interface
 * and utility methods for managing specific functionality domains within the view.
 *
 * Each handler is responsible for a specific domain:
 * - TransitionHandler: CSS transitions and animations
 * - LayoutCalculator: Positioning and dimension calculations
 * - EmotionPickerHandler: Emotion picker UI logic
 * - BorderPickerHandler: Border picker UI logic
 * - MediaHandler: Image/video handling
 *
 * @module player-view/BaseHandler
 */

import { CONFIG } from '../../config.js';
import { Store } from '../../data/Store.js';

/**
 * Base class for PlayerView handlers.
 * Handlers manage specific domains of functionality and are used by PlayerView
 * to delegate complex operations.
 *
 * @abstract
 */
export class BaseHandler {
  /**
   * Creates a new handler instance.
   * @param {ExaltedScenesPlayerView} view - The parent PlayerView instance
   */
  constructor(view) {
    if (!view) {
      throw new Error(`${this.constructor.name}: View reference is required`);
    }

    /**
     * Reference to the parent view
     * @type {ExaltedScenesPlayerView}
     * @protected
     */
    this.view = view;

    /**
     * AbortController for managing event listeners
     * @type {AbortController|null}
     * @private
     */
    this._abortController = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     CONVENIENCE ACCESSORS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Access to the view's UI state.
   * @returns {Object} The current UI state object
   */
  get uiState() {
    return this.view.uiState;
  }

  /**
   * Access to the view's DOM element.
   * @returns {HTMLElement|null} The view's root element
   */
  get element() {
    return this.view.element;
  }

  /**
   * Access to the Store singleton.
   * @returns {ExaltedStore} The Store instance
   */
  get store() {
    return Store;
  }

  /**
   * Access to the module configuration.
   * @returns {Object} The CONFIG object
   */
  get config() {
    return CONFIG;
  }

  /**
   * Check if current user is GM.
   * @returns {boolean}
   */
  get isGM() {
    return game.user.isGM;
  }

  /* ═══════════════════════════════════════════════════════════════
     LIFECYCLE METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up event listeners and initializes the handler.
   * Called during view render.
   *
   * @param {HTMLElement} element - The view's root element
   * @abstract
   */
  setup(element) {
    // Create new abort controller for this setup cycle
    this._abortController = new AbortController();
  }

  /**
   * Cleans up event listeners and releases resources.
   * Called before view close or re-render.
   *
   * @abstract
   */
  cleanup() {
    // Abort all listeners registered with this controller
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Gets the abort signal for registering event listeners.
   * Using this signal ensures listeners are automatically cleaned up.
   *
   * @returns {AbortSignal|undefined}
   * @protected
   */
  get signal() {
    return this._abortController?.signal;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Triggers a view re-render.
   * @protected
   */
  render() {
    this.view.render();
  }

  /**
   * Query selector within the view element.
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null}
   * @protected
   */
  $(selector) {
    return this.element?.querySelector(selector);
  }

  /**
   * Query selector all within the view element.
   * @param {string} selector - CSS selector
   * @returns {NodeListOf<HTMLElement>}
   * @protected
   */
  $$(selector) {
    return this.element?.querySelectorAll(selector) || [];
  }

  /**
   * Log a message with the module prefix.
   * @param {string} message - Message to log
   * @protected
   */
  _log(message) {
    console.log(`${CONFIG.MODULE_NAME} | ${message}`);
  }

  /**
   * Log a warning with the module prefix.
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   * @protected
   */
  _warn(message, ...args) {
    console.warn(`${CONFIG.MODULE_NAME} | ${message}`, ...args);
  }

  /**
   * Get a character from the Store.
   * @param {string} id - Character ID
   * @returns {Object|undefined}
   * @protected
   */
  getCharacter(id) {
    return Store.characters.get(id);
  }

  /**
   * Get a scene from the Store.
   * @param {string} id - Scene ID
   * @returns {Object|undefined}
   * @protected
   */
  getScene(id) {
    return Store.scenes.get(id);
  }
}
