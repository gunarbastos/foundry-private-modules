/**
 * @file ContextMenuManager.js
 * @description Manages the context menu (right-click) functionality for the GMPanel.
 * Handles right-click on empty grid space (create options) and on cards
 * (broadcast, edit, rename, favorite, delete).
 *
 * @module gm-panel/ContextMenuManager
 */

import { BaseManager } from './BaseManager.js';
import { CharacterEditor } from '../CharacterEditor.js';
import { SceneEditor } from '../SceneEditor.js';
import { ExaltedScenesDialog } from '../ThemedDialog.js';
import { Store } from '../../data/Store.js';
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
   * Right-clicking on a card shows card actions; on empty space shows create options.
   * @private
   */
  _setupGridContextMenu() {
    const container = this.element?.querySelector('.es-library') || this.element?.querySelector('.es-grid');
    if (!container) return;

    this._gridContextHandler = (e) => {
      // Check if right-click is on a card
      const card = e.target.closest('.es-card');
      if (card) {
        e.preventDefault();
        this.openCardContextMenu(e.clientX, e.clientY, card);
        return;
      }

      // Ignore clicks on other interactive elements
      const isOnItem = e.target.closest('.es-folder-card, .es-cast-strip, .es-sort-dropdown, .es-search-container, .es-filter-bar, .es-inspector, input, textarea, select, button');
      if (isOnItem) return;

      // Ensure the click occurred inside the library area (not sidebar)
      if (!container.contains(e.target)) return;

      e.preventDefault();
      this.openContextMenu(e.clientX, e.clientY);
    };

    container.addEventListener('contextmenu', this._gridContextHandler, { signal: this.signal });
  }

  /* ═══════════════════════════════════════════════════════════════
     GRID CONTEXT MENU (empty space)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens the grid context menu (right-click on empty space).
   * Shows options to create new scenes, characters, or folders.
   * @param {number} x - The X coordinate (clientX)
   * @param {number} y - The Y coordinate (clientY)
   */
  openContextMenu(x, y) {
    const isScenes = this.uiState.currentView.startsWith('scenes');
    const isFavorites = this.uiState.currentView.includes('favorites');

    const options = [];

    options.push({
      label: isScenes ? localize('GMPanel.NewScene') : localize('GMPanel.NewCharacter'),
      icon: isScenes ? 'fas fa-plus-circle' : 'fas fa-user-plus',
      action: () => {
        this.panel.constructor._onCreate.call(this.panel, {}, null);
      }
    });

    if (!isFavorites) {
      options.push({
        label: localize('GMPanel.CreateFolder'),
        icon: 'fas fa-folder-plus',
        action: () => {
          this.panel.constructor._onCreateFolder.call(this.panel, {}, null);
        }
      });
    }

    if (!options.length) return;
    this._renderMenu(options, x, y);
  }

  /* ═══════════════════════════════════════════════════════════════
     CARD CONTEXT MENU (right-click on card)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens a context menu for a specific card.
   * @param {number} x - The X coordinate (clientX)
   * @param {number} y - The Y coordinate (clientY)
   * @param {HTMLElement} cardEl - The .es-card element
   */
  openCardContextMenu(x, y, cardEl) {
    const id = cardEl.dataset.id;
    const type = cardEl.dataset.type;
    if (!id || !type) return;

    const isScene = type === 'scene';
    const isBroadcasting = Store.activeSceneId === id;
    const item = isScene ? Store.scenes.get(id) : Store.characters.get(id);
    if (!item) return;

    const options = [];

    // Scene: Broadcast / Stop Broadcast
    if (isScene) {
      if (isBroadcasting) {
        options.push({
          label: localize('ContextMenu.StopBroadcast'),
          icon: 'fas fa-stop',
          action: () => this._invokeAction('StopBroadcast', cardEl)
        });
      } else {
        options.push({
          label: localize('ContextMenu.Broadcast'),
          icon: 'fas fa-play',
          action: () => this._invokeAction('Broadcast', cardEl)
        });
      }
    }

    // Scene: Cast Presets
    if (isScene) {
      // Save Cast Preset (only if scene has cast)
      if (item.cast && item.cast.length > 0) {
        options.push({
          label: localize('ContextMenu.SaveCastPreset'),
          icon: 'fas fa-bookmark',
          action: () => this._saveCastPreset(id)
        });
      }

      // Load Cast Preset (only if presets exist)
      const presets = Store.getCastPresets();
      if (presets.length > 0) {
        options.push({
          label: localize('ContextMenu.LoadCastPreset'),
          icon: 'fas fa-bookmark',
          submenu: presets.map(p => ({
            label: `${p.name} (${p.cast.length})`,
            icon: 'fas fa-users',
            action: () => this._loadCastPreset(p.id, id)
          }))
        });
      }
    }

    // Character: Add to Active Scene (only when broadcasting)
    if (!isScene && Store.activeSceneId) {
      options.push({
        label: localize('ContextMenu.AddToScene'),
        icon: 'fas fa-plus-circle',
        action: () => this._invokeAction('QuickAdd', cardEl)
      });
    }

    // Edit
    options.push({
      label: localize('ContextMenu.Edit'),
      icon: 'fas fa-edit',
      action: () => {
        if (isScene) {
          new SceneEditor(id).render(true);
        } else {
          new CharacterEditor(id).render(true);
        }
      }
    });

    options.push({
      label: localize('ContextMenu.Duplicate'),
      icon: 'fas fa-copy',
      action: () => this._invokeAction('Duplicate', cardEl)
    });

    // Rename
    options.push({
      label: localize('ContextMenu.Rename'),
      icon: 'fas fa-i-cursor',
      action: () => this.panel.startInlineRename(cardEl)
    });

    // Favorite / Unfavorite
    options.push({
      label: item.favorite ? localize('ContextMenu.Unfavorite') : localize('ContextMenu.Favorite'),
      icon: item.favorite ? 'fas fa-star' : 'far fa-star',
      action: () => this._invokeAction('ToggleFavorite', cardEl)
    });

    // Separator + Delete
    options.push({ separator: true });

    options.push({
      label: localize('ContextMenu.Delete'),
      icon: 'fas fa-trash',
      danger: true,
      action: () => this._invokeAction('Delete', cardEl)
    });

    this._renderMenu(options, x, y);
  }

  /**
   * Invokes a GMPanel static action handler with a synthetic event.
   * @param {string} actionName - Handler suffix (e.g., 'Broadcast' → '_onBroadcast')
   * @param {HTMLElement} cardEl - The card element to act on
   * @private
   */
  _invokeAction(actionName, cardEl) {
    const handlerName = `_on${actionName}`;
    const handler = this.panel.constructor[handlerName];
    if (!handler) return;

    const syntheticEvent = {
      stopPropagation: () => {},
      preventDefault: () => {},
      target: cardEl
    };

    handler.call(this.panel, syntheticEvent, cardEl);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST PRESET HELPERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Prompts for a name and saves the scene's cast as a preset.
   * @param {string} sceneId - Scene to save from
   * @private
   */
  async _saveCastPreset(sceneId) {
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    const name = await ExaltedScenesDialog.promptText({
      title: localize('CastPreset.SaveTitle'),
      label: localize('CastPreset.NameLabel'),
      value: '',
      placeholder: localize('CastPreset.NamePlaceholder'),
      confirmLabel: localize('CastPreset.Save')
    });

    if (!name) return;

    const result = Store.saveCastPreset(name, sceneId);
    if (result.success) {
      ui.notifications.info(game.i18n.format('EXALTED-SCENES.CastPreset.Saved', { name }));
    } else {
      ui.notifications.warn(result.error);
    }
  }

  /**
   * Loads a cast preset into a scene.
   * @param {string} presetId - Preset to load
   * @param {string} sceneId - Target scene
   * @private
   */
  _loadCastPreset(presetId, sceneId) {
    const result = Store.loadCastPreset(presetId, sceneId);
    if (result.success) {
      ui.notifications.info(game.i18n.format('EXALTED-SCENES.CastPreset.Loaded', { count: result.loaded }));
      if (result.missing?.length) {
        ui.notifications.warn(game.i18n.format('EXALTED-SCENES.CastPreset.Missing', {
          names: result.missing.join(', ')
        }));
      }
      this.panel.render();
    } else {
      ui.notifications.warn(result.error);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SHARED MENU RENDERING
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Renders a context menu from an options array and positions it.
   * @param {Array<{label?: string, icon?: string, action?: Function, separator?: boolean, danger?: boolean}>} options
   * @param {number} x - clientX
   * @param {number} y - clientY
   * @private
   */
  _renderMenu(options, x, y) {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'exalted-scenes es-context-menu';

    for (const opt of options) {
      if (opt.separator) {
        const sep = document.createElement('div');
        sep.className = 'es-context-menu-separator';
        menu.appendChild(sep);
        continue;
      }

      const item = document.createElement('button');
      item.type = 'button';
      item.className = `es-context-menu-item${opt.danger ? ' es-context-menu-item--danger' : ''}`;

      if (opt.submenu) {
        item.innerHTML = `<i class="${opt.icon}"></i><span>${opt.label}</span><i class="fas fa-caret-right es-context-submenu-arrow"></i>`;
        item.addEventListener('mouseenter', (e) => this._showSubmenu(e.currentTarget, opt.submenu));
        item.addEventListener('mouseleave', () => this._hideSubmenuDelayed());
      } else {
        item.innerHTML = `<i class="${opt.icon}"></i><span>${opt.label}</span>`;
        item.addEventListener('click', () => {
          this.closeContextMenu();
          opt.action();
        });
        // Hide any open submenu when hovering over non-submenu items
        item.addEventListener('mouseenter', () => this._hideSubmenu());
      }

      menu.appendChild(item);
    }

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

    // Close handlers
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

    this._contextMenuAbortController = new AbortController();
    const menuSignal = this._contextMenuAbortController.signal;

    setTimeout(() => {
      document.addEventListener('click', this._contextMenuOutsideHandler, { signal: menuSignal });
      document.addEventListener('contextmenu', this._contextMenuOutsideHandler, { signal: menuSignal });
      document.addEventListener('keydown', this._contextMenuEscHandler, { signal: menuSignal });
    }, 0);
  }

  /**
   * Shows a submenu beside a parent menu item.
   * @param {HTMLElement} parentItem - The menu item that has a submenu
   * @param {Array} submenuOptions - Array of submenu option objects
   * @private
   */
  _showSubmenu(parentItem, submenuOptions) {
    this._hideSubmenu();
    clearTimeout(this._submenuHideTimer);

    const sub = document.createElement('div');
    sub.className = 'exalted-scenes es-context-menu es-context-submenu';

    for (const opt of submenuOptions) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'es-context-menu-item';
      item.innerHTML = `<i class="${opt.icon}"></i><span>${opt.label}</span>`;
      item.addEventListener('click', () => {
        this.closeContextMenu();
        opt.action();
      });
      sub.appendChild(item);
    }

    document.body.appendChild(sub);

    // Position to the right of the parent item
    const parentRect = parentItem.getBoundingClientRect();
    const subRect = sub.getBoundingClientRect();
    const padding = 4;

    let left = parentRect.right + padding;
    // If it would go off-screen, show to the left instead
    if (left + subRect.width > window.innerWidth - padding) {
      left = parentRect.left - subRect.width - padding;
    }

    let top = parentRect.top;
    if (top + subRect.height > window.innerHeight - padding) {
      top = window.innerHeight - subRect.height - padding;
    }

    sub.style.left = `${left}px`;
    sub.style.top = `${top}px`;

    sub.addEventListener('mouseenter', () => clearTimeout(this._submenuHideTimer));
    sub.addEventListener('mouseleave', () => this._hideSubmenuDelayed());

    this._submenuElement = sub;
  }

  /**
   * Hides the active submenu after a short delay (allows mouse to travel to submenu).
   * @private
   */
  _hideSubmenuDelayed() {
    this._submenuHideTimer = setTimeout(() => this._hideSubmenu(), 150);
  }

  /**
   * Immediately hides and removes the active submenu.
   * @private
   */
  _hideSubmenu() {
    clearTimeout(this._submenuHideTimer);
    if (this._submenuElement) {
      this._submenuElement.remove();
      this._submenuElement = null;
    }
  }

  /**
   * Closes the context menu and removes event listeners.
   */
  closeContextMenu() {
    this._hideSubmenu();

    if (this._contextMenuElement) {
      this._contextMenuElement.remove();
      this._contextMenuElement = null;
    }

    if (this._contextMenuAbortController) {
      this._contextMenuAbortController.abort();
      this._contextMenuAbortController = null;
    }

    this._contextMenuOutsideHandler = null;
    this._contextMenuEscHandler = null;
  }
}
