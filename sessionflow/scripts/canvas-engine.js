/**
 * SessionFlow - Canvas Engine
 * Core engine that manages the free-form widget canvas. Handles drag-to-move,
 * resize, z-index management, snap-to-grid, panel height resize, multi-select,
 * keyboard shortcuts, clipboard (copy/cut/paste/duplicate), and debounced
 * persistence of widget layout.
 * @module canvas-engine
 */

import { createWidget, getRegisteredTypes } from './widget.js';

const MODULE_ID = 'sessionflow';
const GRID_SIZE = 20;
const SAVE_DEBOUNCE_MS = 500;
const DRAG_DEAD_ZONE = 3;
const MIN_PANEL_HEIGHT = 280;
const PANEL_HEIGHT_MARGIN = 60;
const WIDGET_VISIBLE_MIN = 40;
const PASTE_OFFSET = 20;

/** Global clipboard shared across all CanvasEngine instances (survives panel close/open) */
let globalClipboard = [];

/** Interactive elements that should not trigger drag */
const INTERACTIVE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']);

/** Selector for interactive widget internals — prevents drag initiation AND keyboard shortcut activation */
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, .ProseMirror, .editor-content, .sessionflow-widget-paragraph__content, .sessionflow-widget-paragraph__editor, .sessionflow-teleprompter-popover, .sessionflow-inspiration-popover, .sessionflow-widget-free-image__timer-dropdown, .sessionflow-widget-checklist__drag-handle, .sessionflow-widget-music__selector-dropdown, .sessionflow-widget-music__volume-slider, .sessionflow-widget-ambience__selector-list, .sessionflow-widget-ambience__volume-slider, .sessionflow-widget-soundboard__selector-list, .sessionflow-widget-soundboard__volume-slider, .sessionflow-widget-timer__custom-input, .sessionflow-widget-sticky__text, .sessionflow-widget-sticky__colors, .sessionflow-widget-relationships__slider, .sessionflow-widget-relationships__note, .sessionflow-widget-relationships__note-input, .sessionflow-widget-relationships__dropdown, .sessionflow-widget-relationships__owner-list, .sessionflow-widget-clock__seg-select, .sessionflow-widget-clock__color-input, .sessionflow-widget-clock__title-input, .sessionflow-widget-clock__segment, .sessionflow-widget-clock__style-select, .sessionflow-widget-clock__dot, .sessionflow-widget-clock__broadcast-btn, .sessionflow-widget-clock__flash-btn, .sessionflow-widget-clock__bar-segment, .sessionflow-widget-clock__mode-select, .sessionflow-widget-clock__link-select, .sessionflow-widget-clock__settings-btn, .sessionflow-widget-clock__settings-popover, .sessionflow-widget-clock__reset-btn, .sessionflow-widget-clock__save-btn, .sessionflow-widget-clock__library-panel, .sessionflow-widget-clock__library-btn, .sessionflow-widget-clock__label-input, .sessionflow-widget-faction__slider, .sessionflow-widget-faction__note, .sessionflow-widget-faction__note-input, .sessionflow-widget-faction__banner, .sessionflow-widget-faction__banner-name, .sessionflow-widget-faction__banner-name-input, .sessionflow-widget-faction__dropdown, .sessionflow-widget-faction__level-editor, .sessionflow-widget-faction__library-panel, .sessionflow-widget-faction__gear-btn, .sessionflow-widget-faction__library-btn, .sessionflow-widget-timetracker__label, .sessionflow-widget-timetracker__label-input, .sessionflow-widget-timetracker__secondary-label, .sessionflow-widget-timetracker__secondary-label-input, .sessionflow-widget-timetracker__note-input, .sessionflow-widget-timetracker__history-toggle, .sessionflow-widget-timetracker__ring-overlay, .sessionflow-widget-timetracker__gear-btn, .sessionflow-widget-timetracker__settings-popover, .sessionflow-widget-journal__search-input, .sessionflow-widget-journal__dropdown, .sessionflow-widget-journal__list-item, .sessionflow-widget-journal__card, .sessionflow-widget-macropad__tile, .sessionflow-widget-macropad__dropdown, .sessionflow-widget-macropad__grid, .sessionflow-widget-scenelink__dropdown, .sessionflow-widget-scenelink__activate-btn, .sessionflow-widget-scenelink__change-btn, .sessionflow-widget-scenelink__empty, .sessionflow-widget-daynight__advance-btn, .sessionflow-widget-daynight__set-btn, .sessionflow-widget-daynight__set-popover, .sessionflow-widget-daynight__set-input, .sessionflow-widget-daynight__set-confirm, .sessionflow-widget-daynight__format-btn, .sessionflow-widget-daynight__broadcast-btn, .sessionflow-widget-daynight__flash-btn, .sessionflow-widget-daynight__label, .sessionflow-widget-daynight__label-input, .sessionflow-widget-sequence__filmstrip-track, .sessionflow-widget-sequence__dropdown, .sessionflow-widget-sequence__empty, .sessionflow-widget-slideshow__controls, .sessionflow-widget-slideshow__dropdown, .sessionflow-widget-slideshow__empty, .sessionflow-widget-slideshow__now-playing, .sessionflow-widget-map__viewport, .sessionflow-widget-map__toolbar, .sessionflow-widget-map__popover, .sessionflow-widget-map__marker, .sessionflow-widget-map__scale-bar, .sessionflow-widget-map__grid-settings, .sessionflow-widget-map__empty, .sessionflow-currency__transactions-header, .sessionflow-currency__char-actions, .sessionflow-currency__toolbar, .sessionflow-currency__balances, .sessionflow-currency__shop, .sessionflow-currency__tx-list, .sessionflow-currency__wealth, .sessionflow-currency__debug, .sessionflow-currency__split-recipients, .sessionflow-currency__popover, .sessionflow-currency__empty, .sessionflow-widget-characters__search, .sessionflow-widget-characters__dropdown-search, .sessionflow-widget-characters__dropdown-list, .sessionflow-widget-characters__list-row, .sessionflow-widget-characters__folder-header, .sessionflow-scribe__color-row, .sessionflow-scribe__color-dot, .sessionflow-scribe__color-dots';

/**
 * Build the keyboard shortcuts help popover element.
 * Shared between scene-panel and character-panel.
 * @returns {HTMLElement}
 */
export function buildShortcutsPopover({ showPageShortcuts = false } = {}) {
  const i18n = (key) => game.i18n.localize(`SESSIONFLOW.Canvas.${key}`);
  const pi18n = (key) => game.i18n.localize(`SESSIONFLOW.Pages.${key}`);
  const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac');
  const mod = isMac ? '\u2318' : 'Ctrl';

  const shortcuts = [
    { keys: `${mod}+C`,       label: i18n('ShortcutCopy') },
    { keys: `${mod}+X`,       label: i18n('ShortcutCut') },
    { keys: `${mod}+V`,       label: i18n('ShortcutPaste') },
    { keys: `${mod}+D`,       label: i18n('ShortcutDuplicate') },
    { keys: `${mod}+A`,       label: i18n('ShortcutSelectAll') },
    { keys: 'Delete',         label: i18n('ShortcutDelete') },
    { keys: 'Escape',         label: i18n('ShortcutDeselect') },
    { keys: '\u2190\u2191\u2192\u2193',  label: i18n('ShortcutNudge') },
    { keys: `Shift+\u2190\u2192`,        label: i18n('ShortcutNudgeGrid') },
    { keys: `${mod}+Click`,   label: i18n('ShortcutMultiSelect') },
    { keys: ']',              label: i18n('ShortcutBringFront') },
    { keys: '[',              label: i18n('ShortcutSendBack') },
  ];

  if (showPageShortcuts) {
    shortcuts.push(
      { divider: true },
      { keys: `${mod}+PgDn`, label: pi18n('ShortcutNextPage') },
      { keys: `${mod}+PgUp`, label: pi18n('ShortcutPrevPage') },
      { keys: `${mod}+1\u20139`,   label: pi18n('ShortcutGoToPage') }
    );
  }

  const popover = document.createElement('div');
  popover.className = 'sessionflow-shortcuts-popover';

  const title = document.createElement('div');
  title.className = 'sessionflow-shortcuts-popover__title';
  title.innerHTML = `<i class="fas fa-keyboard"></i> ${i18n('KeyboardShortcuts')}`;
  popover.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'sessionflow-shortcuts-popover__grid';

  for (const item of shortcuts) {
    if (item.divider) {
      const hr = document.createElement('hr');
      hr.className = 'sessionflow-shortcuts-popover__divider';
      grid.appendChild(hr);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'sessionflow-shortcuts-popover__row';
    row.innerHTML = `<kbd class="sessionflow-shortcuts-popover__keys">${item.keys}</kbd><span class="sessionflow-shortcuts-popover__label">${item.label}</span>`;
    grid.appendChild(row);
  }

  popover.appendChild(grid);
  return popover;
}

export class CanvasEngine {

  /** @type {HTMLElement|null} The .sessionflow-canvas element */
  #canvasEl = null;

  /** @type {HTMLElement|null} The panel content element (for height resize) */
  #panelContentEl = null;

  /** @type {Map<string, import('./widget.js').Widget>} Widget instances keyed by ID */
  #widgets = new Map();

  /** @type {object} Free-form context passed to widgets (e.g. { sessionId, beatId, sceneId } or { characterId }) */
  #context = null;

  /** @type {((data: { widgets: object[], canvasHeight: number, nextZIndex: number }) => Promise<void>)|null} */
  #saveFn = null;

  /** @type {number} Monotonic z-index counter */
  #nextZIndex = 2;

  /** @type {number} Current canvas/panel height */
  #canvasHeight = 420;

  /** @type {Set<string>} Currently selected widget IDs */
  #selectedWidgetIds = new Set();

  /* -- Drag state -- */

  /** @type {{ widgetId: string, startX: number, startY: number, origins: Map<string, {x:number,y:number,topOverflow:number}>, hasMoved: boolean }|null} */
  #dragState = null;

  /* -- Resize state -- */

  /** @type {{ widgetId: string, startX: number, startY: number, originW: number, originH: number }|null} */
  #resizeState = null;

  /* -- Panel resize state -- */

  /** @type {{ startY: number, originHeight: number }|null} */
  #panelResizeState = null;

  /* -- Save debounce -- */

  /** @type {number|null} */
  #saveTimer = null;

  /* -- Snap -- */

  /** @type {boolean} */
  #isShiftHeld = false;

  /* -- Read-only mode (player panel GM base page) -- */

  /** @type {boolean} */
  #readOnly = false;

  /* -- Listener cleanup -- */

  /** @type {AbortController|null} */
  #abortController = null;

  /* ---------------------------------------- */
  /*  Initialization                          */
  /* ---------------------------------------- */

  /**
   * Initialize the canvas engine with widget states.
   * @param {HTMLElement} canvasEl - The .sessionflow-canvas element.
   * @param {HTMLElement} panelContentEl - The panel content element (for height resize).
   * @param {object} context - Free-form context passed to widgets (e.g. { sessionId, beatId, sceneId } or { characterId }).
   * @param {object[]} widgetStates - Array of persisted widget state objects.
   * @param {number} [canvasHeight=420]
   * @param {number} [nextZIndex=2]
   * @param {(data: { widgets: object[], canvasHeight: number, nextZIndex: number }) => Promise<void>} saveFn - Persistence callback.
   */
  initialize(canvasEl, panelContentEl, context, widgetStates, canvasHeight = 420, nextZIndex = 2, saveFn) {
    this.#canvasEl = canvasEl;
    this.#panelContentEl = panelContentEl;
    this.#context = context;
    this.#saveFn = saveFn;
    this.#canvasHeight = canvasHeight;
    this.#nextZIndex = nextZIndex;
    this.#readOnly = context?.readOnly ?? false;

    // Apply canvas height
    this.#panelContentEl.style.setProperty('--sf-scene-panel-height', `${this.#canvasHeight}px`);

    // Create widget instances (rescue obviously off-canvas positions first)
    for (const state of widgetStates) {
      if (state.y < 0) state.y = 0;
      if (state.x < 0) state.x = 0;

      const widget = createWidget(state, this.#context, this);
      if (!widget) continue;

      this.#widgets.set(widget.id, widget);
      const el = widget.render();
      this.#canvasEl.appendChild(el);
      this.#normalizeWidgetPosition(widget);
    }

    // Show empty state if needed
    this.#updateEmptyState();

    // Setup listeners
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    // In read-only mode, skip drag/resize/keyboard interactions
    if (!this.#readOnly) {
      // Canvas pointer events
      this.#canvasEl.addEventListener('pointerdown', (e) => this.#onCanvasPointerDown(e), { signal });

      // Document-level move/up (only active during drag/resize)
      document.addEventListener('pointermove', (e) => this.#onPointerMove(e), { signal });
      document.addEventListener('pointerup', (e) => this.#onPointerUp(e), { signal });

      // Keyboard events (shift for snap + shortcuts)
      document.addEventListener('keydown', (e) => this.#onKeyDown(e), { signal });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
          this.#isShiftHeld = false;
          this.#canvasEl?.classList.remove('is-snapping');
        }
      }, { signal });
    }

    // Mark canvas as read-only for CSS
    if (this.#readOnly) this.#canvasEl.classList.add('is-read-only');
  }

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Destroy the engine, removing all listeners and widgets.
   */
  destroy({ persist = true } = {}) {
    this.#abortController?.abort();
    this.#abortController = null;

    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }

    // Persist final widget state before destruction (e.g. running timer elapsed time)
    if (persist) this.#persistNow();

    for (const widget of this.#widgets.values()) {
      widget.destroy('engine-destroy');
    }
    this.#widgets.clear();

    this.#canvasEl = null;
    this.#panelContentEl = null;
    this.#context = null;
    this.#saveFn = null;
    this.#dragState = null;
    this.#resizeState = null;
    this.#panelResizeState = null;
    this.#selectedWidgetIds.clear();
  }

  /**
   * Whether any widgets are currently selected.
   * @returns {boolean}
   */
  get hasSelection() {
    return this.#selectedWidgetIds.size > 0;
  }

  /** @returns {boolean} Whether the canvas is in read-only mode */
  get readOnly() {
    return this.#readOnly;
  }

  /**
   * Clear the current widget selection.
   * Useful when a host panel closes and should not keep keyboard ownership.
   */
  clearSelection() {
    this.#deselectAll();
  }

  /**
   * Add a new widget to the canvas.
   * @param {string} type - Widget type identifier.
   * @param {object} [config={}] - Type-specific config.
   */
  addWidget(type, config = {}) {
    if (this.#readOnly) return;

    const types = getRegisteredTypes();
    const meta = types.find(t => t.type === type);
    if (!meta) {
      console.warn(`[${MODULE_ID}] Cannot add unknown widget type: ${type}`);
      return;
    }

    // Enforce MAX_INSTANCES limit
    if (meta.maxInstances != null) {
      let count = 0;
      for (const w of this.#widgets.values()) {
        if (w.type === type) count++;
      }
      if (count >= meta.maxInstances) {
        ui.notifications.warn(game.i18n.localize('SESSIONFLOW.Notifications.WidgetMaxReached'));
        return;
      }
    }

    // Position: cascade from top-left, offset by existing widget count
    const offset = this.#widgets.size * 24;
    const x = 24 + (offset % 200);
    const y = 16 + (offset % 160);

    const state = {
      id: foundry.utils.randomID(),
      type,
      x, y,
      width: meta.defaultWidth,
      height: meta.defaultHeight,
      zIndex: this.#nextZIndex++,
      collapsed: false,
      config
    };

    const widget = createWidget(state, this.#context, this);
    if (!widget) return;

    this.#widgets.set(widget.id, widget);
    const el = widget.render();
    this.#canvasEl.appendChild(el);
    this.#normalizeWidgetPosition(widget);

    this.#selectWidget(widget.id);
    this.#updateEmptyState();
    this.#persistNow();

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.WidgetAdded'));
  }

  /**
   * Remove a widget from the canvas with confirmation.
   * @param {string} widgetId
   */
  async removeWidget(widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.RemoveWidget') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.ConfirmRemoveWidget')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    await this.#destroyWidget(widgetId);
    this.#updateEmptyState();
    this.#persistNow();

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.WidgetRemoved'));
  }

  /**
   * Refresh the body content of all widgets (for data changes, not layout).
   */
  refreshAllWidgets() {
    for (const widget of this.#widgets.values()) {
      widget.refreshBody();
    }
  }

  /**
   * Flush any pending save immediately. Call before panel close.
   */
  flushPendingSave() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
      return this.#persistNow();
    }
    return Promise.resolve();
  }

  /**
   * Schedule a debounced save of widget layout.
   */
  scheduleSave() {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      this.#persistNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Get the panel resize edge element for external listener setup.
   * @param {HTMLElement} resizeEdgeEl
   */
  attachPanelResize(resizeEdgeEl) {
    if (!this.#abortController) return;
    const signal = this.#abortController.signal;
    resizeEdgeEl.addEventListener('pointerdown', (e) => this.#onPanelResizeStart(e), { signal });
  }

  /* ---------------------------------------- */
  /*  Canvas Pointer Events                   */
  /* ---------------------------------------- */

  #onCanvasPointerDown(event) {
    // Only primary button
    if (event.button !== 0) return;

    const target = event.target;

    // Don't initiate drag on interactive elements
    if (INTERACTIVE_TAGS.has(target.tagName)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;

    // Find the widget element
    const widgetEl = target.closest('.sessionflow-widget');
    if (!widgetEl) {
      // Clicked canvas background — deselect
      this.#deselectAll();
      return;
    }

    const widgetId = widgetEl.dataset.widgetId;
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    // Multi-select: Ctrl/Meta+Click toggles widget in selection
    const isMultiSelect = event.ctrlKey || event.metaKey;

    if (isMultiSelect) {
      if (this.#selectedWidgetIds.has(widgetId)) {
        // Toggle off
        this.#selectedWidgetIds.delete(widgetId);
        widget.element?.classList.remove('is-selected');
      } else {
        // Add to selection
        this.#selectedWidgetIds.add(widgetId);
        widget.element?.classList.add('is-selected');
      }
      this.#bringToFront(widgetId);
      return;
    }

    // Regular click on already-selected widget in a multi-selection: keep selection (for group drag)
    // Regular click on unselected widget: replace selection with just this one
    this.#bringToFront(widgetId);
    if (!this.#selectedWidgetIds.has(widgetId)) {
      this.#selectWidget(widgetId);
    }

    // Check if resize handle
    if (target.closest('.sessionflow-widget__resize-handle')) {
      this.#onResizeStart(event, widgetId);
      return;
    }

    // Check if widget header (drag zone)
    if (target.closest('.sessionflow-widget__header')) {
      this.#onDragStart(event, widgetId);
      return;
    }
  }

  #onPointerMove(event) {
    if (this.#dragState) {
      this.#handleDrag(event);
    } else if (this.#resizeState) {
      this.#handleResize(event);
    } else if (this.#panelResizeState) {
      this.#handlePanelResize(event);
    }
  }

  #onPointerUp(event) {
    if (this.#dragState) {
      this.#onDragEnd(event);
    } else if (this.#resizeState) {
      this.#onResizeEnd(event);
    } else if (this.#panelResizeState) {
      this.#onPanelResizeEnd(event);
    }
  }

  /* ---------------------------------------- */
  /*  Keyboard Shortcuts                      */
  /* ---------------------------------------- */

  #onKeyDown(event) {
    // Guard: canvas must be alive and the host panel must actually be open.
    if (!this.#isCanvasActive()) {
      if (this.#selectedWidgetIds.size > 0) this.#deselectAll();
      if (event.key === 'Shift') {
        this.#isShiftHeld = false;
        this.#canvasEl?.classList.remove('is-snapping');
      }
      return;
    }

    // Shift key for snap-to-grid (always active while the canvas is active)
    if (event.key === 'Shift' && !this.#isShiftHeld) {
      this.#isShiftHeld = true;
      this.#canvasEl?.classList.add('is-snapping');
    }

    // Guard: don't fire shortcuts when typing in interactive elements
    const target = event.target;
    if (INTERACTIVE_TAGS.has(target.tagName)) return;
    if (target.isContentEditable) return;
    if (target.closest?.('.ProseMirror, .editor-content')) return;

    const mod = event.ctrlKey || event.metaKey;

    // Ctrl/Cmd shortcuts
    if (mod) {
      switch (event.key.toLowerCase()) {
        case 'a': // Select all
          event.preventDefault();
          this.#selectAll();
          return;
        case 'c': // Copy
          event.preventDefault();
          this.#copySelected();
          return;
        case 'x': // Cut
          event.preventDefault();
          this.#cutSelected();
          return;
        case 'v': // Paste
          event.preventDefault();
          this.#pasteClipboard();
          return;
        case 'd': // Duplicate
          event.preventDefault();
          this.#duplicateSelected();
          return;
      }
    }

    // Non-modifier shortcuts (only when not in an input)
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (this.#selectedWidgetIds.size > 0) {
          event.preventDefault();
          this.#removeSelected();
        }
        return;
      case 'Escape':
        if (this.#selectedWidgetIds.size > 0) {
          event.preventDefault();
          this.#deselectAll();
        }
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.#selectedWidgetIds.size > 0) {
          event.preventDefault();
          this.#nudgeSelected(event.key, event.shiftKey);
        }
        return;
      case ']':
        if (this.#selectedWidgetIds.size > 0) {
          event.preventDefault();
          this.#bringSelectedToFront();
        }
        return;
      case '[':
        if (this.#selectedWidgetIds.size > 0) {
          event.preventDefault();
          this.#sendSelectedToBack();
        }
        return;
    }
  }

  /* ---------------------------------------- */
  /*  Drag-to-Move                            */
  /* ---------------------------------------- */

  #onDragStart(event, widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    event.preventDefault();

    // Capture origins for all selected widgets (for multi-drag)
    const origins = new Map();
    for (const id of this.#selectedWidgetIds) {
      const w = this.#widgets.get(id);
      if (w) {
        origins.set(id, {
          x: w.x,
          y: w.y,
          topOverflow: this.#getWidgetTopOverflow(w)
        });
      }
    }

    this.#dragState = {
      widgetId,
      startX: event.clientX,
      startY: event.clientY,
      origins,
      hasMoved: false
    };

    // Capture pointer for reliable tracking outside canvas
    event.target.setPointerCapture?.(event.pointerId);
  }

  #handleDrag(event) {
    if (!this.#dragState) return;

    const dx = event.clientX - this.#dragState.startX;
    const dy = event.clientY - this.#dragState.startY;

    // Dead zone: don't start visual drag until threshold crossed
    if (!this.#dragState.hasMoved) {
      if (Math.abs(dx) < DRAG_DEAD_ZONE && Math.abs(dy) < DRAG_DEAD_ZONE) return;
      this.#dragState.hasMoved = true;

      // Add dragging visual to all selected widgets
      for (const id of this.#selectedWidgetIds) {
        this.#widgets.get(id)?.element?.classList.add('is-dragging');
      }
    }

    event.preventDefault();

    // Move all selected widgets by the same delta
    for (const [id, origin] of this.#dragState.origins) {
      const w = this.#widgets.get(id);
      if (!w?.element) continue;

      let newX = origin.x + dx;
      let newY = origin.y + dy;

      if (this.#isShiftHeld) {
        newX = this.#snapToGrid(newX);
        newY = this.#snapToGrid(newY);
      }

      ({ x: newX, y: newY } = this.#clampWidgetPosition(w, newX, newY, origin.topOverflow));

      w.element.style.left = `${newX}px`;
      w.element.style.top = `${newY}px`;
    }
  }

  #onDragEnd(event) {
    if (!this.#dragState) return;

    const { hasMoved, startX, startY, origins } = this.#dragState;

    if (hasMoved) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      for (const [id, origin] of origins) {
        const w = this.#widgets.get(id);
        if (!w) continue;

        w.element?.classList.remove('is-dragging');

        let newX = origin.x + dx;
        let newY = origin.y + dy;

        if (this.#isShiftHeld) {
          newX = this.#snapToGrid(newX);
          newY = this.#snapToGrid(newY);
        }

        ({ x: newX, y: newY } = this.#clampWidgetPosition(w, newX, newY, origin.topOverflow));
        w.updatePosition(newX, newY);
      }

      this.scheduleSave();
    } else {
      // No movement — just clear dragging class
      for (const id of this.#selectedWidgetIds) {
        this.#widgets.get(id)?.element?.classList.remove('is-dragging');
      }
    }

    this.#dragState = null;
  }

  /* ---------------------------------------- */
  /*  Widget Resize                           */
  /* ---------------------------------------- */

  #onResizeStart(event, widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    event.preventDefault();
    event.stopPropagation();

    this.#resizeState = {
      widgetId,
      startX: event.clientX,
      startY: event.clientY,
      originW: widget.width,
      originH: widget.height
    };

    widget.element?.classList.add('is-resizing');
    event.target.setPointerCapture?.(event.pointerId);
  }

  #handleResize(event) {
    if (!this.#resizeState) return;
    event.preventDefault();

    const dx = event.clientX - this.#resizeState.startX;
    const dy = event.clientY - this.#resizeState.startY;

    const widget = this.#widgets.get(this.#resizeState.widgetId);
    if (!widget) return;

    // Get min sizes from widget class
    const minW = widget.constructor.MIN_WIDTH ?? 120;
    const minH = widget.constructor.MIN_HEIGHT ?? 80;

    let newW = Math.max(minW, this.#resizeState.originW + dx);
    let newH = Math.max(minH, this.#resizeState.originH + dy);

    if (this.#isShiftHeld) {
      newW = this.#snapToGrid(newW);
      newH = this.#snapToGrid(newH);
    }

    widget.updateSize(newW, newH);
    widget.onResize(newW, newH);
  }

  #onResizeEnd(event) {
    if (!this.#resizeState) return;

    const widget = this.#widgets.get(this.#resizeState.widgetId);
    widget?.element?.classList.remove('is-resizing');

    this.#resizeState = null;
    this.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Panel Height Resize                     */
  /* ---------------------------------------- */

  #onPanelResizeStart(event) {
    if (event.button !== 0) return;
    event.preventDefault();

    this.#panelResizeState = {
      startY: event.clientY,
      originHeight: this.#canvasHeight
    };

    document.body.style.cursor = 'ns-resize';
    event.target.setPointerCapture?.(event.pointerId);
  }

  #handlePanelResize(event) {
    if (!this.#panelResizeState) return;
    event.preventDefault();

    // Dragging up = negative dy = increase height
    const dy = this.#panelResizeState.startY - event.clientY;
    const maxHeight = window.innerHeight - PANEL_HEIGHT_MARGIN;
    let newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(maxHeight, this.#panelResizeState.originHeight + dy));

    if (this.#isShiftHeld) {
      newHeight = this.#snapToGrid(newHeight);
    }

    this.#canvasHeight = newHeight;
    this.#panelContentEl?.style.setProperty('--sf-scene-panel-height', `${newHeight}px`);
  }

  #onPanelResizeEnd(event) {
    if (!this.#panelResizeState) return;

    document.body.style.cursor = '';
    this.#panelResizeState = null;
    this.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Selection                               */
  /* ---------------------------------------- */

  #selectWidget(widgetId) {
    // Replace entire selection with a single widget
    if (this.#selectedWidgetIds.size === 1 && this.#selectedWidgetIds.has(widgetId)) return;

    // Deselect all previous
    for (const id of this.#selectedWidgetIds) {
      this.#widgets.get(id)?.element?.classList.remove('is-selected');
    }
    this.#selectedWidgetIds.clear();

    // Select the new widget
    this.#selectedWidgetIds.add(widgetId);
    this.#widgets.get(widgetId)?.element?.classList.add('is-selected');
  }

  #deselectAll() {
    for (const id of this.#selectedWidgetIds) {
      this.#widgets.get(id)?.element?.classList.remove('is-selected');
    }
    this.#selectedWidgetIds.clear();
  }

  #isCanvasActive() {
    if (!this.#canvasEl?.isConnected) return false;
    if (!this.#canvasEl.offsetParent) return false;

    const hostPanel = this.#canvasEl.closest('.sessionflow-root[data-open]');
    if (hostPanel && hostPanel.dataset.open !== 'true') return false;

    return true;
  }

  #selectAll() {
    for (const [id, widget] of this.#widgets) {
      this.#selectedWidgetIds.add(id);
      widget.element?.classList.add('is-selected');
    }
  }

  /** @returns {import('./widget.js').Widget[]} */
  #getSelectedWidgets() {
    const result = [];
    for (const id of this.#selectedWidgetIds) {
      const w = this.#widgets.get(id);
      if (w) result.push(w);
    }
    return result;
  }

  /* ---------------------------------------- */
  /*  Z-Index Management                      */
  /* ---------------------------------------- */

  #bringToFront(widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    const newZ = this.#nextZIndex++;
    widget.updateZIndex(newZ);
    // Save batched with next scheduled save
  }

  #bringSelectedToFront() {
    for (const id of this.#selectedWidgetIds) {
      const widget = this.#widgets.get(id);
      if (widget) widget.updateZIndex(this.#nextZIndex++);
    }
    this.scheduleSave();
  }

  #sendSelectedToBack() {
    // Set all selected to z-index 0, then bump all others above
    for (const id of this.#selectedWidgetIds) {
      const widget = this.#widgets.get(id);
      if (widget) widget.updateZIndex(0);
    }

    // Reassign z-indexes for non-selected widgets starting at 1
    let z = 1;
    const sorted = [...this.#widgets.values()]
      .filter(w => !this.#selectedWidgetIds.has(w.id))
      .sort((a, b) => a.zIndex - b.zIndex);
    for (const w of sorted) {
      w.updateZIndex(z++);
    }
    this.#nextZIndex = z;
    this.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Clipboard & Duplication                 */
  /* ---------------------------------------- */

  #copySelected() {
    const selected = this.#getSelectedWidgets();
    if (selected.length === 0) return;

    globalClipboard = selected.map(w => {
      w.beforeSave();
      return foundry.utils.deepClone(w.getState());
    });

    const count = globalClipboard.length;
    ui.notifications.info(
      game.i18n.format('SESSIONFLOW.Canvas.WidgetsCopied', { count })
    );
  }

  async #cutSelected() {
    const selected = this.#getSelectedWidgets();
    if (selected.length === 0) return;

    // Copy first
    globalClipboard = selected.map(w => {
      w.beforeSave();
      return foundry.utils.deepClone(w.getState());
    });

    // Then remove (with confirmation)
    const count = selected.length;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.RemoveWidget') },
      content: count === 1
        ? `<p>${game.i18n.localize('SESSIONFLOW.Canvas.ConfirmRemoveWidget')}</p>`
        : `<p>${game.i18n.format('SESSIONFLOW.Canvas.ConfirmRemoveWidgets', { count })}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    for (const w of selected) {
      await this.#destroyWidget(w.id);
    }
    this.#updateEmptyState();
    this.#persistNow();
  }

  #pasteClipboard() {
    if (globalClipboard.length === 0) return;

    this.#deselectAll();

    let pasteIndex = 0;
    for (const snapshot of globalClipboard) {
      const state = foundry.utils.deepClone(snapshot);
      state.id = foundry.utils.randomID();
      state.x += PASTE_OFFSET + (pasteIndex * 4);
      state.y += PASTE_OFFSET + (pasteIndex * 4);
      state.zIndex = this.#nextZIndex++;

      const widget = createWidget(state, this.#context, this);
      if (!widget) continue;

      this.#widgets.set(widget.id, widget);
      const el = widget.render();
      this.#canvasEl.appendChild(el);
      this.#normalizeWidgetPosition(widget);

      // Add to selection
      this.#selectedWidgetIds.add(widget.id);
      el.classList.add('is-selected');

      pasteIndex++;
    }

    this.#updateEmptyState();
    this.#persistNow();

    const count = pasteIndex;
    if (count > 0) {
      ui.notifications.info(
        game.i18n.format('SESSIONFLOW.Canvas.WidgetsPasted', { count })
      );
    }
  }

  #duplicateSelected() {
    const selected = this.#getSelectedWidgets();
    if (selected.length === 0) return;

    this.#deselectAll();

    let dupeIndex = 0;
    for (const w of selected) {
      w.beforeSave();
      const state = foundry.utils.deepClone(w.getState());
      state.id = foundry.utils.randomID();
      state.x += PASTE_OFFSET + (dupeIndex * 4);
      state.y += PASTE_OFFSET + (dupeIndex * 4);
      state.zIndex = this.#nextZIndex++;

      const newWidget = createWidget(state, this.#context, this);
      if (!newWidget) continue;

      this.#widgets.set(newWidget.id, newWidget);
      const el = newWidget.render();
      this.#canvasEl.appendChild(el);
      this.#normalizeWidgetPosition(newWidget);

      // Select the new duplicate
      this.#selectedWidgetIds.add(newWidget.id);
      el.classList.add('is-selected');

      dupeIndex++;
    }

    this.#updateEmptyState();
    this.#persistNow();

    const count = dupeIndex;
    if (count > 0) {
      ui.notifications.info(
        game.i18n.format('SESSIONFLOW.Canvas.WidgetsDuplicated', { count })
      );
    }
  }

  /* ---------------------------------------- */
  /*  Batch Remove                            */
  /* ---------------------------------------- */

  async #removeSelected() {
    const selected = this.#getSelectedWidgets();
    if (selected.length === 0) return;

    const count = selected.length;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.RemoveWidget') },
      content: count === 1
        ? `<p>${game.i18n.localize('SESSIONFLOW.Canvas.ConfirmRemoveWidget')}</p>`
        : `<p>${game.i18n.format('SESSIONFLOW.Canvas.ConfirmRemoveWidgets', { count })}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    for (const w of selected) {
      await this.#destroyWidget(w.id);
    }

    this.#updateEmptyState();
    this.#persistNow();

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.WidgetRemoved'));
  }

  /** Internal: animate out and remove a single widget without confirmation or persist. */
  async #destroyWidget(widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    const el = widget.element;
    if (el) {
      el.classList.add('is-removing');
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    widget.destroy('remove');
    this.#widgets.delete(widgetId);
    this.#selectedWidgetIds.delete(widgetId);
  }

  /* ---------------------------------------- */
  /*  Nudge                                   */
  /* ---------------------------------------- */

  #nudgeSelected(arrowKey, shiftHeld) {
    const step = shiftHeld ? GRID_SIZE : 1;
    let dx = 0, dy = 0;

    switch (arrowKey) {
      case 'ArrowUp':    dy = -step; break;
      case 'ArrowDown':  dy = step;  break;
      case 'ArrowLeft':  dx = -step; break;
      case 'ArrowRight': dx = step;  break;
    }

    for (const id of this.#selectedWidgetIds) {
      const widget = this.#widgets.get(id);
      if (!widget) continue;

      let newX = widget.x + dx;
      let newY = widget.y + dy;
      ({ x: newX, y: newY } = this.#clampWidgetPosition(widget, newX, newY));
      widget.updatePosition(newX, newY);
    }

    this.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Snap to Grid                            */
  /* ---------------------------------------- */

  #snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  #getWidgetTopOverflow(widget) {
    const element = widget?.element;
    const header = element?.querySelector('.sessionflow-widget__header');
    if (!element || !header) return 0;

    // Hidden headers (display:none) report zero rect — skip overflow calc
    if (!header.offsetHeight) return 0;

    const elementRect = element.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    return Math.max(0, Math.ceil(elementRect.top - headerRect.top));
  }

  #clampWidgetPosition(widget, x, y, topOverflow = this.#getWidgetTopOverflow(widget)) {
    if (!this.#canvasEl) return { x, y };

    const canvasRect = this.#canvasEl.getBoundingClientRect();
    const minX = 0;
    const minY = Math.max(0, topOverflow);
    const maxX = Math.max(minX, canvasRect.width - WIDGET_VISIBLE_MIN);
    const maxY = Math.max(minY, this.#canvasEl.scrollHeight - WIDGET_VISIBLE_MIN);

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  }

  #normalizeWidgetPosition(widget) {
    if (!widget) return false;

    const { x, y } = this.#clampWidgetPosition(widget, widget.x, widget.y);
    if (x === widget.x && y === widget.y) return false;

    widget.updatePosition(x, y);
    return true;
  }

  /* ---------------------------------------- */
  /*  Empty State                             */
  /* ---------------------------------------- */

  #updateEmptyState() {
    if (!this.#canvasEl) return;

    let emptyEl = this.#canvasEl.querySelector('.sessionflow-canvas__empty');

    if (this.#widgets.size === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'sessionflow-canvas__empty';
        emptyEl.innerHTML = `
          <i class="fas fa-wand-magic-sparkles"></i>
          <p class="sessionflow-canvas__empty-title">${game.i18n.localize('SESSIONFLOW.Canvas.EmptyCanvas')}</p>
          <p class="sessionflow-canvas__empty-subtitle">${game.i18n.localize('SESSIONFLOW.Canvas.EmptyCanvasSubtitle')}</p>
        `;
        this.#canvasEl.appendChild(emptyEl);
      }
    } else {
      emptyEl?.remove();
    }
  }

  /* ---------------------------------------- */
  /*  Persistence                             */
  /* ---------------------------------------- */

  async #persistNow() {
    // Let widgets finalize transient state (e.g. serialize active editors)
    for (const widget of this.#widgets.values()) {
      widget.beforeSave();
    }

    const widgetStates = [];
    for (const widget of this.#widgets.values()) {
      widgetStates.push(widget.getState());
    }

    try {
      if (this.#saveFn) {
        await this.#saveFn({
          widgets: widgetStates,
          canvasHeight: this.#canvasHeight,
          nextZIndex: this.#nextZIndex
        });
      }
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to save canvas state:`, err);
    }
  }
}
