/**
 * SessionFlow - Canvas Engine
 * Core engine that manages the free-form widget canvas. Handles drag-to-move,
 * resize, z-index management, snap-to-grid, panel height resize, and
 * debounced persistence of widget layout.
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

/** Interactive elements that should not trigger drag */
const INTERACTIVE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']);

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

  /** @type {string|null} Currently selected widget ID */
  #selectedWidgetId = null;

  /* -- Drag state -- */

  /** @type {{ widgetId: string, startX: number, startY: number, originX: number, originY: number, hasMoved: boolean }|null} */
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

    // Apply canvas height
    this.#panelContentEl.style.setProperty('--sf-scene-panel-height', `${this.#canvasHeight}px`);

    // Create widget instances (rescue any stuck at negative positions)
    for (const state of widgetStates) {
      // Rescue: clamp position so header is always accessible
      if (state.y < 0) state.y = 0;
      if (state.x < 0) state.x = 0;

      const widget = createWidget(state, this.#context, this);
      if (!widget) continue;

      this.#widgets.set(widget.id, widget);
      const el = widget.render();
      this.#canvasEl.appendChild(el);
    }

    // Show empty state if needed
    this.#updateEmptyState();

    // Setup listeners
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    // Canvas pointer events
    this.#canvasEl.addEventListener('pointerdown', (e) => this.#onCanvasPointerDown(e), { signal });

    // Document-level move/up (only active during drag/resize)
    document.addEventListener('pointermove', (e) => this.#onPointerMove(e), { signal });
    document.addEventListener('pointerup', (e) => this.#onPointerUp(e), { signal });

    // Shift key for snap-to-grid
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift' && !this.#isShiftHeld) {
        this.#isShiftHeld = true;
        this.#canvasEl?.classList.add('is-snapping');
      }
    }, { signal });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.#isShiftHeld = false;
        this.#canvasEl?.classList.remove('is-snapping');
      }
    }, { signal });
  }

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Destroy the engine, removing all listeners and widgets.
   */
  destroy() {
    this.#abortController?.abort();
    this.#abortController = null;

    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }

    // Persist final widget state before destruction (e.g. running timer elapsed time)
    this.#persistNow();

    for (const widget of this.#widgets.values()) {
      widget.destroy();
    }
    this.#widgets.clear();

    this.#canvasEl = null;
    this.#panelContentEl = null;
    this.#context = null;
    this.#saveFn = null;
    this.#dragState = null;
    this.#resizeState = null;
    this.#panelResizeState = null;
    this.#selectedWidgetId = null;
  }

  /**
   * Add a new widget to the canvas.
   * @param {string} type - Widget type identifier.
   * @param {object} [config={}] - Type-specific config.
   */
  addWidget(type, config = {}) {
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

    // Animate out
    const el = widget.element;
    if (el) {
      el.classList.add('is-removing');
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    widget.destroy();
    this.#widgets.delete(widgetId);

    if (this.#selectedWidgetId === widgetId) {
      this.#selectedWidgetId = null;
    }

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
    if (target.closest('button, a, input, select, textarea, .ProseMirror, .sessionflow-teleprompter-popover, .sessionflow-inspiration-popover, .sessionflow-widget-free-image__timer-dropdown, .sessionflow-widget-checklist__drag-handle, .sessionflow-widget-music__selector-dropdown, .sessionflow-widget-music__volume-slider, .sessionflow-widget-ambience__selector-list, .sessionflow-widget-ambience__volume-slider, .sessionflow-widget-soundboard__selector-list, .sessionflow-widget-soundboard__volume-slider, .sessionflow-widget-timer__custom-input, .sessionflow-widget-sticky__text, .sessionflow-widget-sticky__colors, .sessionflow-widget-relationships__slider, .sessionflow-widget-relationships__note, .sessionflow-widget-relationships__note-input, .sessionflow-widget-relationships__dropdown, .sessionflow-widget-relationships__owner-list, .sessionflow-widget-clock__seg-select, .sessionflow-widget-clock__color-input, .sessionflow-widget-clock__title-input, .sessionflow-widget-clock__segment, .sessionflow-widget-clock__style-select, .sessionflow-widget-clock__dot, .sessionflow-widget-clock__broadcast-btn, .sessionflow-widget-clock__flash-btn, .sessionflow-widget-faction__slider, .sessionflow-widget-faction__note, .sessionflow-widget-faction__note-input, .sessionflow-widget-faction__banner, .sessionflow-widget-faction__banner-name, .sessionflow-widget-faction__banner-name-input, .sessionflow-widget-faction__dropdown, .sessionflow-widget-faction__level-editor, .sessionflow-widget-faction__gear-btn, .sessionflow-widget-timetracker__label, .sessionflow-widget-timetracker__label-input, .sessionflow-widget-timetracker__secondary-label, .sessionflow-widget-timetracker__secondary-label-input, .sessionflow-widget-timetracker__note-input, .sessionflow-widget-timetracker__history-toggle, .sessionflow-widget-timetracker__ring-overlay, .sessionflow-widget-timetracker__gear-btn, .sessionflow-widget-timetracker__settings-popover, .sessionflow-widget-journal__search-input, .sessionflow-widget-journal__dropdown, .sessionflow-widget-journal__list-item, .sessionflow-widget-journal__card, .sessionflow-widget-macropad__tile, .sessionflow-widget-macropad__dropdown, .sessionflow-widget-macropad__grid, .sessionflow-widget-scenelink__dropdown, .sessionflow-widget-scenelink__activate-btn, .sessionflow-widget-scenelink__change-btn, .sessionflow-widget-scenelink__empty, .sessionflow-widget-daynight__advance-btn, .sessionflow-widget-daynight__set-btn, .sessionflow-widget-daynight__set-popover, .sessionflow-widget-daynight__set-input, .sessionflow-widget-daynight__set-confirm, .sessionflow-widget-daynight__format-btn, .sessionflow-widget-daynight__broadcast-btn, .sessionflow-widget-daynight__flash-btn, .sessionflow-widget-daynight__label, .sessionflow-widget-daynight__label-input, .sessionflow-widget-sequence__filmstrip-track, .sessionflow-widget-sequence__dropdown, .sessionflow-widget-sequence__empty, .sessionflow-widget-slideshow__controls, .sessionflow-widget-slideshow__dropdown, .sessionflow-widget-slideshow__empty, .sessionflow-widget-slideshow__now-playing')) return;

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

    // Bring to front on any click
    this.#bringToFront(widgetId);
    this.#selectWidget(widgetId);

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
  /*  Drag-to-Move                            */
  /* ---------------------------------------- */

  #onDragStart(event, widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    event.preventDefault();

    this.#dragState = {
      widgetId,
      startX: event.clientX,
      startY: event.clientY,
      originX: widget.x,
      originY: widget.y,
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

      // Add dragging visual
      const widget = this.#widgets.get(this.#dragState.widgetId);
      widget?.element?.classList.add('is-dragging');
    }

    event.preventDefault();

    let newX = this.#dragState.originX + dx;
    let newY = this.#dragState.originY + dy;

    // Snap to grid
    if (this.#isShiftHeld) {
      newX = this.#snapToGrid(newX);
      newY = this.#snapToGrid(newY);
    }

    // Clamp: ensure header (drag handle) stays accessible
    const widget = this.#widgets.get(this.#dragState.widgetId);
    if (widget && this.#canvasEl) {
      const canvasRect = this.#canvasEl.getBoundingClientRect();
      const maxX = canvasRect.width - WIDGET_VISIBLE_MIN;
      const maxY = this.#canvasEl.scrollHeight - WIDGET_VISIBLE_MIN;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    // Set position directly during drag
    if (widget?.element) {
      widget.element.style.left = `${newX}px`;
      widget.element.style.top = `${newY}px`;
    }
  }

  #onDragEnd(event) {
    if (!this.#dragState) return;

    const { widgetId, hasMoved, originX, originY, startX, startY } = this.#dragState;
    const widget = this.#widgets.get(widgetId);

    if (widget) {
      widget.element?.classList.remove('is-dragging');

      if (hasMoved) {
        // Commit final position
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        let newX = originX + dx;
        let newY = originY + dy;

        if (this.#isShiftHeld) {
          newX = this.#snapToGrid(newX);
          newY = this.#snapToGrid(newY);
        }

        // Clamp: ensure header stays accessible
        if (this.#canvasEl) {
          const canvasRect = this.#canvasEl.getBoundingClientRect();
          const maxX = canvasRect.width - WIDGET_VISIBLE_MIN;
          const maxY = this.#canvasEl.scrollHeight - WIDGET_VISIBLE_MIN;
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
        }

        widget.updatePosition(newX, newY);
        this.scheduleSave();
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
  /*  Z-Index Management                      */
  /* ---------------------------------------- */

  #bringToFront(widgetId) {
    const widget = this.#widgets.get(widgetId);
    if (!widget) return;

    const newZ = this.#nextZIndex++;
    widget.updateZIndex(newZ);
    // Save batched with next scheduled save
  }

  #selectWidget(widgetId) {
    // Deselect previous
    if (this.#selectedWidgetId && this.#selectedWidgetId !== widgetId) {
      const prev = this.#widgets.get(this.#selectedWidgetId);
      prev?.element?.classList.remove('is-selected');
    }

    this.#selectedWidgetId = widgetId;
    const widget = this.#widgets.get(widgetId);
    widget?.element?.classList.add('is-selected');
  }

  #deselectAll() {
    if (this.#selectedWidgetId) {
      const widget = this.#widgets.get(this.#selectedWidgetId);
      widget?.element?.classList.remove('is-selected');
      this.#selectedWidgetId = null;
    }
  }

  /* ---------------------------------------- */
  /*  Snap to Grid                            */
  /* ---------------------------------------- */

  #snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
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
