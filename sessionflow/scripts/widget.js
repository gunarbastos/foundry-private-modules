/**
 * SessionFlow - Widget Base Class & Factory
 * Abstract base for all canvas widgets. Provides rendering contract,
 * position/size state management, and the widget type registry.
 * @module widget
 */

const MODULE_ID = 'sessionflow';

/* ---------------------------------------- */
/*  Widget Registry                         */
/* ---------------------------------------- */

/** @type {Map<string, typeof Widget>} */
const WIDGET_REGISTRY = new Map();

/**
 * Register a widget type so the factory can instantiate it.
 * @param {string} type - Unique type identifier (e.g. 'scene-image').
 * @param {typeof Widget} WidgetClass - Class extending Widget.
 */
export function registerWidgetType(type, WidgetClass) {
  WIDGET_REGISTRY.set(type, WidgetClass);
}

/**
 * Create a widget instance from a persisted state object.
 * @param {object} state - Widget state from storage.
 * @param {object} context - { sessionId, beatId, sceneId }.
 * @param {object} engine - CanvasEngine reference.
 * @returns {Widget|null}
 */
export function createWidget(state, context, engine) {
  const WidgetClass = WIDGET_REGISTRY.get(state.type);
  if (!WidgetClass) {
    console.warn(`[${MODULE_ID}] Unknown widget type: ${state.type}`);
    return null;
  }
  return new WidgetClass(state, context, engine);
}

/**
 * Get metadata for all registered widget types.
 * @returns {{ type: string, label: string, icon: string, minWidth: number, minHeight: number, defaultWidth: number, defaultHeight: number }[]}
 */
export function getRegisteredTypes() {
  const types = [];
  for (const [type, WidgetClass] of WIDGET_REGISTRY) {
    types.push({
      type,
      label: WidgetClass.LABEL ?? type,
      icon: WidgetClass.ICON ?? 'fas fa-cube',
      minWidth: WidgetClass.MIN_WIDTH ?? 120,
      minHeight: WidgetClass.MIN_HEIGHT ?? 80,
      defaultWidth: WidgetClass.DEFAULT_WIDTH ?? 280,
      defaultHeight: WidgetClass.DEFAULT_HEIGHT ?? 200,
      maxInstances: WidgetClass.MAX_INSTANCES ?? null
    });
  }
  return types;
}

/* ---------------------------------------- */
/*  Widget Base Class                       */
/* ---------------------------------------- */

export class Widget {

  /* -- Static metadata (override in subclasses) -- */

  /** @type {string} Widget type identifier */
  static TYPE = '';

  /** @type {string} i18n key for the widget label */
  static LABEL = 'Widget';

  /** @type {string} FontAwesome icon class */
  static ICON = 'fas fa-cube';

  /** @type {number} */
  static MIN_WIDTH = 120;

  /** @type {number} */
  static MIN_HEIGHT = 80;

  /** @type {number} */
  static DEFAULT_WIDTH = 280;

  /** @type {number} */
  static DEFAULT_HEIGHT = 200;

  /** @type {number|null} Max instances of this widget type per canvas (null = unlimited) */
  static MAX_INSTANCES = null;

  /* -- Private fields -- */

  /** @type {string} */
  #id;

  /** @type {string} */
  #type;

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {{ x: number, y: number, width: number, height: number, zIndex: number, collapsed: boolean }} */
  #state;

  /** @type {object} */
  #config;

  /** @type {object} CanvasEngine back-reference */
  #engine;

  /** @type {{ sessionId: string, beatId: string, sceneId: string }} */
  #context;

  /* ---------------------------------------- */
  /*  Constructor                             */
  /* ---------------------------------------- */

  /**
   * @param {object} state - Persisted widget state.
   * @param {object} context - { sessionId, beatId, sceneId }.
   * @param {object} engine - CanvasEngine reference.
   */
  constructor(state, context, engine) {
    this.#id = state.id;
    this.#type = state.type;
    this.#state = {
      x: state.x ?? 0,
      y: state.y ?? 0,
      width: state.width ?? this.constructor.DEFAULT_WIDTH,
      height: state.height ?? this.constructor.DEFAULT_HEIGHT,
      zIndex: state.zIndex ?? 0,
      collapsed: state.collapsed ?? false
    };
    this.#config = state.config ?? {};
    this.#context = context;
    this.#engine = engine;
  }

  /* ---------------------------------------- */
  /*  Getters                                 */
  /* ---------------------------------------- */

  /** @returns {string} */
  get id() { return this.#id; }

  /** @returns {string} */
  get type() { return this.#type; }

  /** @returns {HTMLElement|null} */
  get element() { return this.#element; }

  /** @returns {object} */
  get config() { return this.#config; }

  /** @returns {object} */
  get context() { return this.#context; }

  /** @returns {object} */
  get engine() { return this.#engine; }

  /** @returns {number} */
  get x() { return this.#state.x; }

  /** @returns {number} */
  get y() { return this.#state.y; }

  /** @returns {number} */
  get width() { return this.#state.width; }

  /** @returns {number} */
  get height() { return this.#state.height; }

  /** @returns {number} */
  get zIndex() { return this.#state.zIndex; }

  /** @returns {boolean} */
  get collapsed() { return this.#state.collapsed; }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  /**
   * Build the full widget DOM element.
   * @returns {HTMLElement}
   */
  render() {
    const el = document.createElement('div');
    el.className = 'sessionflow-widget';
    el.dataset.widgetId = this.#id;
    el.dataset.widgetType = this.#type;
    el.style.left = `${this.#state.x}px`;
    el.style.top = `${this.#state.y}px`;
    el.style.width = `${this.#state.width}px`;
    el.style.height = `${this.#state.height}px`;
    el.style.zIndex = this.#state.zIndex;

    if (this.#state.collapsed) el.classList.add('is-collapsed');

    // Header (drag zone)
    const header = document.createElement('div');
    header.className = 'sessionflow-widget__header';

    const icon = document.createElement('i');
    icon.className = this.constructor.ICON;
    header.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'sessionflow-widget__title';
    title.textContent = this.getTitle();
    header.appendChild(title);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'sessionflow-widget__collapse-btn';
    collapseBtn.type = 'button';
    collapseBtn.title = this.#state.collapsed ? 'Expand' : 'Collapse';
    collapseBtn.innerHTML = `<i class="fas ${this.#state.collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>`;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleCollapse();
    });
    header.appendChild(collapseBtn);

    if (game.user.isGM) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'sessionflow-widget__remove-btn';
      removeBtn.type = 'button';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.RemoveWidget');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#engine.removeWidget(this.#id);
      });
      header.appendChild(removeBtn);
    }

    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'sessionflow-widget__body';
    el.appendChild(body);

    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'sessionflow-widget__resize-handle';
    el.appendChild(handle);

    this.#element = el;

    // Let subclass fill the body
    this.renderBody(body);

    return el;
  }

  /**
   * Get the display title for this widget.
   * Override in subclasses for dynamic titles.
   * @returns {string}
   */
  getTitle() {
    return this.constructor.LABEL;
  }

  /**
   * Fill the widget body with content.
   * Subclasses MUST override this method.
   * @param {HTMLElement} bodyEl - The .sessionflow-widget__body element.
   */
  renderBody(bodyEl) {
    // Default: empty placeholder
    bodyEl.innerHTML = '';
  }

  /**
   * Refresh just the widget body content (preserves position/size/z-index).
   */
  refreshBody() {
    if (!this.#element) return;
    const body = this.#element.querySelector('.sessionflow-widget__body');
    if (!body) return;
    this.renderBody(body);
  }

  /* ---------------------------------------- */
  /*  State Updates                           */
  /* ---------------------------------------- */

  /**
   * Update the widget's position.
   * @param {number} x
   * @param {number} y
   */
  updatePosition(x, y) {
    this.#state.x = x;
    this.#state.y = y;
    if (this.#element) {
      this.#element.style.left = `${x}px`;
      this.#element.style.top = `${y}px`;
    }
  }

  /**
   * Update the widget's size.
   * @param {number} width
   * @param {number} height
   */
  updateSize(width, height) {
    this.#state.width = width;
    this.#state.height = height;
    if (this.#element) {
      this.#element.style.width = `${width}px`;
      this.#element.style.height = `${height}px`;
    }
  }

  /**
   * Update the widget's z-index.
   * @param {number} z
   */
  updateZIndex(z) {
    this.#state.zIndex = z;
    if (this.#element) {
      this.#element.style.zIndex = z;
    }
  }

  /**
   * Called by the engine when the widget is resized.
   * Subclasses can override for responsive layout adjustments.
   * @param {number} width
   * @param {number} height
   */
  onResize(width, height) {
    // Default: no-op
  }

  /**
   * Called by the engine before persisting widget state.
   * Subclasses can override to finalize transient state (e.g. serialize an active editor).
   */
  beforeSave() {
    // Default: no-op
  }

  /* ---------------------------------------- */
  /*  Collapse                                */
  /* ---------------------------------------- */

  #toggleCollapse() {
    this.#state.collapsed = !this.#state.collapsed;
    if (!this.#element) return;

    this.#element.classList.toggle('is-collapsed', this.#state.collapsed);

    const btn = this.#element.querySelector('.sessionflow-widget__collapse-btn');
    if (btn) {
      btn.title = this.#state.collapsed ? 'Expand' : 'Collapse';
      btn.innerHTML = `<i class="fas ${this.#state.collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>`;
    }

    this.#engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Serialization                           */
  /* ---------------------------------------- */

  /**
   * Return a plain object suitable for persistence.
   * @returns {object}
   */
  getState() {
    return {
      id: this.#id,
      type: this.#type,
      x: this.#state.x,
      y: this.#state.y,
      width: this.#state.width,
      height: this.#state.height,
      zIndex: this.#state.zIndex,
      collapsed: this.#state.collapsed,
      config: { ...this.#config }
    };
  }

  /**
   * Update the config object (for subclasses that store data in config).
   * @param {object} changes - Partial config to merge.
   */
  updateConfig(changes) {
    Object.assign(this.#config, changes);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /**
   * Remove the widget from the DOM and clean up.
   */
  destroy() {
    this.#element?.remove();
    this.#element = null;
  }
}
