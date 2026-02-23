/**
 * @file ContextMenuManager.js
 * @description Manages the context menu (right-click) functionality for the GMPanel.
 * Handles showing/hiding the menu and providing quick create options for scenes,
 * characters, and folders.
 *
 * @module gm-panel/ContextMenuManager
 */

import { BaseManager } from './BaseManager.js';
import { SmartCreator } from '../SmartCreator.js';
import { SceneEditor } from '../SceneEditor.js';
import { localize } from '../../utils/i18n.js';

/**
 * Manages context menu interactions in the GMPanel.
 * @extends BaseManager
 */
export class ContextMenuManager extends BaseManager {
  /**
   * Creates a new ContextMenuManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);

    /** @type {HTMLElement|null} - The context menu DOM element */
    this._contextMenuElement = null;

    /** @type {Function|null} - Handler for clicks outside the menu */
    this._contextMenuOutsideHandler = null;

    /** @type {Function|null} - Handler for Escape key */
    this._contextMenuEscHandler = null;

    /** @type {Function|null} - Handler for contextmenu event on grid */
    this._gridContextHandler = null;

    /** @type {AbortController|null} - For context menu document listeners */
    this._contextMenuAbortController = null;
  }

  /**
   * Sets up context menu event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupGridContextMenu();
  }

  /**
   * Cleans up event listeners and closes any open menu.
   */
  cleanup() {
    this.closeContextMenu();
    super.cleanup();
  }

  /**
   * Sets up the context menu listener on the grid/library area.
   * Right-clicking on empty space shows options to create new items.
   * @private
   */
  _setupGridContextMenu() {
    // Use the whole library area (includes padding) so empty zones respond
    const container = this.element?.querySelector('.es-library') || this.element?.querySelector('.es-grid');
    if (!container) return;

    this._gridContextHandler = (e) => {
      // Ignore clicks on cards, folders, inspector, and inputs
      const isOnItem = e.target.closest('.es-card, .es-folder-card, .es-cast-strip, .es-sort-dropdown, .es-search-container, .es-filter-bar, .es-inspector, input, textarea, select, button');
      if (isOnItem) return;

      // Ensure the click occurred inside the library area (not sidebar)
      if (!container.contains(e.target)) return;

      e.preventDefault();
      this.openContextMenu(e.clientX, e.clientY);
    };

    // Use AbortSignal from BaseManager for automatic cleanup on re-render
    container.addEventListener('contextmenu', this._gridContextHandler, { signal: this.signal });
  }

  /**
   * Opens the context menu at the specified position.
   * @param {number} x - The X coordinate (clientX)
   * @param {number} y - The Y coordinate (clientY)
   */
  openContextMenu(x, y) {
    const isScenes = this.uiState.currentView.startsWith('scenes');
    const isFavorites = this.uiState.currentView.includes('favorites');

    const options = [];

    // Add "New Scene" or "New Character" option
    options.push({
      label: isScenes ? localize('GMPanel.NewScene') : localize('GMPanel.NewCharacter'),
      icon: isScenes ? 'fas fa-plus-circle' : 'fas fa-user-plus',
      action: () => {
        if (isScenes) {
          new SceneEditor().render(true);
        } else {
          new SmartCreator().render(true);
        }
      }
    });

    // Add "New Folder" option (not in favorites view)
    if (!isFavorites) {
      options.push({
        label: localize('GMPanel.CreateFolder'),
        icon: 'fas fa-folder-plus',
        action: () => {
          // Call the panel's create folder method
          this.panel.constructor._onCreateFolder.call(this.panel, {}, null);
        }
      });
    }

    if (!options.length) return;

    // Close any existing menu first
    this.closeContextMenu();

    // Create the menu element
    const menu = document.createElement('div');
    menu.className = 'es-context-menu';

    options.forEach(opt => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'es-context-menu-item';
      item.innerHTML = `<i class="${opt.icon}"></i><span>${opt.label}</span>`;
      item.addEventListener('click', () => {
        this.closeContextMenu();
        opt.action();
      });
      menu.appendChild(item);
    });

    // Position the menu (hidden initially for measurement)
    menu.style.visibility = 'hidden';
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    const left = Math.max(padding, Math.min(x, window.innerWidth - rect.width - padding));
    const top = Math.max(padding, Math.min(y, window.innerHeight - rect.height - padding));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';

    this._contextMenuElement = menu;

    // Set up handlers to close the menu
    this._contextMenuOutsideHandler = (evt) => {
      if (!this._contextMenuElement) return;
      if (evt.type === 'click' && this._contextMenuElement.contains(evt.target)) return;
      this.closeContextMenu();
    };

    this._contextMenuEscHandler = (evt) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        this.closeContextMenu();
      }
    };

    // Create a dedicated abort controller for context menu document listeners
    this._contextMenuAbortController = new AbortController();
    const menuSignal = this._contextMenuAbortController.signal;

    // Delay adding listeners to avoid immediate close
    setTimeout(() => {
      document.addEventListener('click', this._contextMenuOutsideHandler, { signal: menuSignal });
      document.addEventListener('contextmenu', this._contextMenuOutsideHandler, { signal: menuSignal });
      document.addEventListener('keydown', this._contextMenuEscHandler, { signal: menuSignal });
    }, 0);
  }

  /**
   * Closes the context menu and removes event listeners.
   */
  closeContextMenu() {
    if (this._contextMenuElement) {
      this._contextMenuElement.remove();
      this._contextMenuElement = null;
    }

    // Abort all document-level listeners at once
    if (this._contextMenuAbortController) {
      this._contextMenuAbortController.abort();
      this._contextMenuAbortController = null;
    }

    this._contextMenuOutsideHandler = null;
    this._contextMenuEscHandler = null;
  }
}
