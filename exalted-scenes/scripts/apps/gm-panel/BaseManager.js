/**
 * @file BaseManager.js
 * @description Base class for all GMPanel managers. Provides common interface
 * and utility methods for managing specific functionality domains within the panel.
 *
 * Each manager is responsible for:
 * - Setting up event listeners in setup()
 * - Cleaning up event listeners in cleanup()
 * - Providing action handlers as static methods
 *
 * @module gm-panel/BaseManager
 */

/**
 * Base class for GMPanel managers.
 * Managers handle specific domains of functionality (drag-drop, keyboard, etc.)
 * and are coordinated by the main GMPanel class.
 *
 * @abstract
 */
export class BaseManager {
  /**
   * Creates a new manager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    /** @type {ExaltedScenesGMPanel} */
    this.panel = panel;

    /** @type {AbortController|null} - For cleaning up event listeners */
    this._abortController = null;
  }

  /**
   * Convenient access to the panel's UI state.
   * @returns {Object} The current UI state object
   */
  get uiState() {
    return this.panel.uiState;
  }

  /**
   * Convenient access to the panel's DOM element.
   * @returns {HTMLElement|null} The panel's root element
   */
  get element() {
    return this.panel.element;
  }

  /**
   * Sets up event listeners and initializes the manager.
   * Called during panel render.
   *
   * @param {HTMLElement} element - The panel's root element
   * @abstract
   */
  setup(element) {
    // Create new abort controller for this setup cycle
    this._abortController = new AbortController();
  }

  /**
   * Cleans up event listeners and releases resources.
   * Called before panel close or re-render.
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

  /**
   * Triggers a panel re-render.
   * @protected
   */
  render() {
    this.panel.render();
  }
}
