/**
 * SessionFlow - Scene Panel Controller
 * Manages the bottom slide-up panel with a free-form widget canvas.
 * @module scene-panel
 */

import { getScenes, getSession, updateSceneCanvas } from './session-store.js';
import { CanvasEngine } from './canvas-engine.js';
import { getRegisteredTypes } from './widget.js';

// Import widget types so they self-register
import './widgets/scene-image-widget.js';
import './widgets/characters-widget.js';
import './widgets/paragraph-widget.js';
import './widgets/teleprompter-widget.js';
import './widgets/free-image-widget.js';
import './widgets/inspiration-widget.js';
import './widgets/checklist-widget.js';
import './widgets/divider-widget.js';
import './widgets/music-widget.js';
import './widgets/ambience-widget.js';
import './widgets/soundboard-widget.js';
import './widgets/timer-widget.js';
import './widgets/sticky-widget.js';
import './widgets/progress-clock-widget.js';
import './widgets/faction-widget.js';
import './widgets/time-tracker-widget.js';
import './widgets/journal-board-widget.js';

const MODULE_ID = 'sessionflow';

/**
 * Generate default widgets for scenes that don't have any yet.
 * Preserves the visual appearance of the old two-column layout.
 * @returns {object[]}
 */
function createDefaultWidgets() {
  return [
    {
      id: foundry.utils.randomID(),
      type: 'scene-image',
      x: 24, y: 16,
      width: 480, height: 340,
      zIndex: 0,
      collapsed: false,
      config: {}
    },
    {
      id: foundry.utils.randomID(),
      type: 'characters',
      x: 528, y: 16,
      width: 240, height: 340,
      zIndex: 1,
      collapsed: false,
      config: {}
    }
  ];
}

/* ---------------------------------------- */
/*  Built-in Scene Templates                */
/* ---------------------------------------- */

/**
 * Generate widgets from a template definition.
 * Each entry is { type, x, y, width, height, config? }.
 * @param {{ type: string, x: number, y: number, width: number, height: number, config?: object }[]} defs
 * @returns {object[]}
 */
function widgetsFromTemplate(defs) {
  return defs.map((d, i) => ({
    id: foundry.utils.randomID(),
    type: d.type,
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
    zIndex: i,
    collapsed: false,
    config: d.config ? foundry.utils.deepClone(d.config) : {}
  }));
}

const BUILTIN_TEMPLATES = [
  {
    id: '_classic',
    name: 'SESSIONFLOW.Canvas.TemplateClassic',
    icon: 'fas fa-columns',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 540, height: 340 },
      { type: 'divider', x: 580, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'characters', x: 620, y: 20, width: 400, height: 340 }
    ])
  },
  {
    id: '_storyteller',
    name: 'SESSIONFLOW.Canvas.TemplateStoryteller',
    icon: 'fas fa-book-open',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 480, height: 340 },
      { type: 'divider', x: 520, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'ornamental' } },
      { type: 'teleprompter', x: 560, y: 20, width: 460, height: 36 },
      { type: 'divider', x: 560, y: 76, width: 460, height: 20, config: { orientation: 'horizontal', style: 'dotted' } },
      { type: 'paragraph', x: 560, y: 116, width: 460, height: 244 }
    ])
  },
  {
    id: '_combat',
    name: 'SESSIONFLOW.Canvas.TemplateCombat',
    icon: 'fas fa-swords',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 400, height: 340 },
      { type: 'divider', x: 440, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'solid' } },
      { type: 'characters', x: 480, y: 20, width: 300, height: 340 },
      { type: 'divider', x: 800, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'solid' } },
      { type: 'timer', x: 840, y: 20, width: 280, height: 200 }
    ])
  },
  {
    id: '_exploration',
    name: 'SESSIONFLOW.Canvas.TemplateExploration',
    icon: 'fas fa-compass',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 420, height: 340 },
      { type: 'divider', x: 460, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'checklist', x: 500, y: 20, width: 280, height: 340 },
      { type: 'divider', x: 800, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'time-tracker', x: 840, y: 20, width: 280, height: 340 }
    ])
  },
  {
    id: '_social',
    name: 'SESSIONFLOW.Canvas.TemplateSocial',
    icon: 'fas fa-comments',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 440, height: 340 },
      { type: 'divider', x: 480, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'ornamental' } },
      { type: 'characters', x: 520, y: 20, width: 500, height: 140 },
      { type: 'inspiration', x: 520, y: 180, width: 240, height: 36 },
      { type: 'paragraph', x: 520, y: 236, width: 500, height: 124 }
    ])
  },
  {
    id: '_blank',
    name: 'SESSIONFLOW.Canvas.TemplateBlank',
    icon: 'fas fa-border-none',
    widgets: () => []
  }
];

export class ScenePanel {

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {string|null} Session ID that owns the beat */
  #sessionId = null;

  /** @type {string|null} Beat ID that owns the scene */
  #beatId = null;

  /** @type {string|null} Scene ID being displayed */
  #sceneId = null;

  /** @type {CanvasEngine|null} */
  #engine = null;

  /** @type {AbortController|null} */
  #toolbarAbort = null;

  /** @type {string} */
  #templatePath = `modules/${MODULE_ID}/templates/scene-panel.hbs`;

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Open the panel for a given scene.
   * @param {string} sessionId
   * @param {string} beatId
   * @param {string} sceneId
   */
  async open(sessionId, beatId, sceneId) {
    if (!sessionId || !beatId || !sceneId) return;

    // If already open for the same scene, skip
    if (this.#isOpen && this.#sessionId === sessionId &&
        this.#beatId === beatId && this.#sceneId === sceneId) return;

    // If open for a different scene, tear down the old engine
    if (this.#engine) {
      this.#engine.flushPendingSave();
      this.#engine.destroy();
      this.#engine = null;
    }

    this.#sessionId = sessionId;
    this.#beatId = beatId;
    this.#sceneId = sceneId;

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    this.#engine?.flushPendingSave();
    this.#isOpen = false;
    this.#element.dataset.open = 'false';
  }

  /** Close without firing any hook (prevents circular calls). */
  closeQuiet() {
    this.close();
  }

  /** Re-render widget content (not layout). */
  async rerender() {
    if (!this.#element) return;

    // If canvas engine exists, just refresh widget content
    if (this.#engine) {
      this.#engine.refreshAllWidgets();
      this.#updateAnchorState();
      return;
    }

    // Fallback: full re-render body
    await this.#rerenderBody();
    this.#updateAnchorState();
  }

  /** Remove the panel from DOM entirely. */
  destroy() {
    this.#toolbarAbort?.abort();
    this.#toolbarAbort = null;
    this.#engine?.flushPendingSave();
    this.#engine?.destroy();
    this.#engine = null;
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
    this.#sessionId = null;
    this.#beatId = null;
    this.#sceneId = null;
  }

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** @returns {string|null} */
  get sessionId() { return this.#sessionId; }

  /** @returns {string|null} */
  get beatId() { return this.#beatId; }

  /** @returns {string|null} */
  get sceneId() { return this.#sceneId; }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  async #render() {
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    document.body.insertAdjacentHTML('beforeend', html);
    this.#element = document.body.querySelector('.sessionflow-scene-panel');

    if (!this.#element) {
      console.error(`[${MODULE_ID}] Failed to find scene panel element after render!`);
      return;
    }

    this.#activateShellListeners();
    this.#initializeCanvas();
  }

  async #rerenderBody() {
    if (!this.#element) return;
    if (!document.body.contains(this.#element)) {
      console.warn(`[${MODULE_ID}] Scene panel element detached from DOM, re-attaching.`);
      document.body.appendChild(this.#element);
    }

    // Destroy old canvas engine
    if (this.#engine) {
      this.#engine.flushPendingSave();
      this.#engine.destroy();
      this.#engine = null;
    }

    // Re-render the body from template
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    // Guard: panel may have been closed/destroyed during the await
    if (!this.#element) return;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const body = this.#element.querySelector('.sessionflow-scene-panel__body');
    const newBody = temp.querySelector('.sessionflow-scene-panel__body');
    if (body && newBody) body.replaceWith(newBody);

    // Update colors on root element
    const session = getSession(this.#sessionId);
    const beats = session?.beats ?? [];
    const beat = beats.find(b => b.id === this.#beatId);
    if (beat?.color) {
      this.#element.style.setProperty('--sf-beat-color', beat.color);
    }
    if (session?.color) {
      this.#element.style.setProperty('--sf-session-color', session.color);
    }

    // Re-initialize canvas
    this.#initializeCanvas();
  }

  #getTemplateData() {
    const session = getSession(this.#sessionId);
    const beats = session?.beats ?? [];
    const beat = beats.find(b => b.id === this.#beatId);
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');

    // Get registered widget types for toolbar
    const widgetTypes = getRegisteredTypes().map(t => ({
      type: t.type,
      icon: t.icon,
      label: game.i18n.localize(t.label)
    }));

    return {
      // Colors
      beatColor: beat?.color || session?.color || '#7c5cbf',
      sessionColor: session?.color || '#7c5cbf',

      // Panel chrome
      title: game.i18n.localize('SESSIONFLOW.ScenePanel.Title'),
      backLabel: game.i18n.localize('SESSIONFLOW.ScenePanel.Back'),
      anchorLabel: game.i18n.localize('SESSIONFLOW.Panel.AnchorPanel'),
      isAnchored: anchor?.panel === 'scene' &&
                  anchor?.sessionId === this.#sessionId &&
                  anchor?.beatId === this.#beatId &&
                  anchor?.sceneId === this.#sceneId,
      canEdit: game.user.isGM,

      // Toolbar
      widgetTypes,
      addWidgetLabel: game.i18n.localize('SESSIONFLOW.Canvas.AddWidget'),
      templateLabel: game.i18n.localize('SESSIONFLOW.Canvas.TemplateLoad')
    };
  }

  /* ---------------------------------------- */
  /*  Canvas Initialization                   */
  /* ---------------------------------------- */

  #initializeCanvas() {
    if (!this.#element) return;

    const canvasEl = this.#element.querySelector('.sessionflow-canvas');
    const panelContentEl = this.#element.querySelector('.sessionflow-scene-panel__content');
    if (!canvasEl || !panelContentEl) return;

    // Load widget states from scene data (with backward compatibility)
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === this.#sceneId);
    const widgets = scene?.widgets ?? createDefaultWidgets();
    const canvasHeight = scene?.canvasHeight ?? 420;
    const nextZIndex = scene?.nextZIndex ?? widgets.length;

    // Create and initialize engine
    const context = { sessionId: this.#sessionId, beatId: this.#beatId, sceneId: this.#sceneId };
    const saveFn = (data) => updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, data);

    this.#engine = new CanvasEngine();
    this.#engine.initialize(
      canvasEl, panelContentEl,
      context, widgets, canvasHeight, nextZIndex, saveFn
    );

    // Attach panel resize handle
    const resizeEdge = this.#element.querySelector('.sessionflow-scene-panel__resize-edge');
    if (resizeEdge) {
      this.#engine.attachPanelResize(resizeEdge);
    }

    // Toolbar listeners
    this.#activateToolbarListeners();
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Shell (once)          */
  /* ---------------------------------------- */

  #activateShellListeners() {
    if (!this.#element) return;

    // Close button
    this.#element.querySelector('[data-action="close"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromScene');
      });

    // Backdrop click
    this.#element.querySelector('.sessionflow-scene-panel__backdrop')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromScene');
      });

    // Back button
    this.#element.querySelector('[data-action="navigate-back"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromScene');
      });

    // Anchor button
    this.#element.querySelector('[data-action="toggle-anchor"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:setAnchor', 'scene', this.#sessionId, this.#beatId, this.#sceneId);
      });

    // Escape key — skip if a Foundry dialog/window is open above us
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        const openDialog = document.querySelector('.dialog .window-content, .app.window-app');
        if (openDialog) return;
        event.stopPropagation();
        Hooks.call('sessionflow:navigateBackFromScene');
      }
    });
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Toolbar               */
  /* ---------------------------------------- */

  #activateToolbarListeners() {
    if (!this.#element) return;
    const toolbar = this.#element.querySelector('.sessionflow-scene-panel__toolbar');
    if (!toolbar) return;

    // Abort previous listeners to prevent duplicate handlers
    this.#toolbarAbort?.abort();
    this.#toolbarAbort = new AbortController();
    const signal = this.#toolbarAbort.signal;

    toolbar.querySelectorAll('[data-action="add-widget"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const widgetType = e.currentTarget.dataset.widgetType;
        if (widgetType && this.#engine) {
          this.#engine.addWidget(widgetType);
        }
      }, { signal });
    });

    // Template button
    toolbar.querySelector('[data-action="open-templates"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#openTemplatePicker(e.currentTarget);
      }, { signal });
  }

  /* ---------------------------------------- */
  /*  Template Picker                         */
  /* ---------------------------------------- */

  #openTemplatePicker(anchorBtn) {
    // Close existing picker if any
    this.#element?.querySelector('.sessionflow-template-picker')?.remove();

    const picker = document.createElement('div');
    picker.className = 'sessionflow-template-picker';

    // Header
    const header = document.createElement('div');
    header.className = 'sessionflow-template-picker__header';
    header.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TemplateLoad');
    picker.appendChild(header);

    // Template list
    const list = document.createElement('div');
    list.className = 'sessionflow-template-picker__list';

    for (const template of BUILTIN_TEMPLATES) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sessionflow-template-picker__item';
      item.innerHTML = `<i class="${template.icon}"></i><span>${game.i18n.localize(template.name)}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#applyTemplate(template);
        picker.remove();
      });
      list.appendChild(item);
    }

    // Save current as template
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sessionflow-template-picker__save';
    saveBtn.innerHTML = `<i class="fas fa-floppy-disk"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.TemplateSaveCurrent')}</span>`;
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#saveCurrentAsTemplate();
      picker.remove();
    });

    // Custom templates section
    const customs = this.#getCustomTemplates();
    if (customs.length > 0) {
      const customHeader = document.createElement('div');
      customHeader.className = 'sessionflow-template-picker__subheader';
      customHeader.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TemplateCustom');
      list.appendChild(customHeader);

      for (const ct of customs) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-template-picker__item';
        item.innerHTML = `<i class="fas fa-bookmark"></i><span>${ct.name}</span>`;

        // Delete button
        const delBtn = document.createElement('span');
        delBtn.className = 'sessionflow-template-picker__item-delete';
        delBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.#deleteCustomTemplate(ct.id);
          picker.remove();
        });
        item.appendChild(delBtn);

        item.addEventListener('click', (e) => {
          if (e.target.closest('.sessionflow-template-picker__item-delete')) return;
          e.stopPropagation();
          this.#applyCustomTemplate(ct);
          picker.remove();
        });
        list.appendChild(item);
      }
    }

    picker.appendChild(list);
    picker.appendChild(saveBtn);

    // Position near the button
    const toolbar = this.#element?.querySelector('.sessionflow-scene-panel__toolbar');
    if (toolbar) {
      toolbar.style.position = 'relative';
      toolbar.appendChild(picker);
    }

    // Close on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorBtn) {
        picker.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  /**
   * Apply a built-in template to the current scene.
   * @param {{ widgets: () => object[] }} template
   */
  #applyTemplate(template) {
    if (!this.#engine) return;

    const newWidgets = template.widgets();

    // Destroy current engine, save new widgets, re-initialize
    this.#engine.flushPendingSave();
    this.#engine.destroy();
    this.#engine = null;

    updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, {
      widgets: newWidgets,
      nextZIndex: newWidgets.length
    });

    this.#initializeCanvas();
  }

  /**
   * Apply a custom template.
   * @param {{ widgets: object[] }} ct
   */
  #applyCustomTemplate(ct) {
    if (!this.#engine) return;

    // Generate fresh IDs for widgets, preserving config for dividers
    const newWidgets = ct.widgets.map((w, i) => ({
      id: foundry.utils.randomID(),
      type: w.type,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      zIndex: i,
      collapsed: false,
      config: w.config ? { ...w.config } : {}
    }));

    this.#engine.flushPendingSave();
    this.#engine.destroy();
    this.#engine = null;

    updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, {
      widgets: newWidgets,
      nextZIndex: newWidgets.length
    });

    this.#initializeCanvas();
  }

  /**
   * Save the current canvas layout as a custom template.
   */
  #saveCurrentAsTemplate() {
    if (!this.#engine) return;

    // Prompt for name
    const name = prompt(game.i18n.localize('SESSIONFLOW.Canvas.TemplateSavePrompt'));
    if (!name?.trim()) return;

    // Extract widget layout (type + position + size only, no content)
    this.#engine.flushPendingSave();
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === this.#sceneId);
    const currentWidgets = scene?.widgets ?? [];

    const layoutWidgets = currentWidgets.map(w => {
      const base = { type: w.type, x: w.x, y: w.y, width: w.width, height: w.height };
      // Preserve config for dividers (orientation/style/color are layout properties)
      if (w.type === 'divider' && w.config) base.config = { ...w.config };
      return base;
    });

    const customs = this.#getCustomTemplates();
    customs.push({
      id: foundry.utils.randomID(),
      name: name.trim(),
      widgets: layoutWidgets
    });

    game.settings.set(MODULE_ID, 'sceneTemplates', customs);
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.TemplateSaved'));
  }

  /** @returns {object[]} */
  #getCustomTemplates() {
    try {
      return game.settings.get(MODULE_ID, 'sceneTemplates') ?? [];
    } catch {
      return [];
    }
  }

  #deleteCustomTemplate(id) {
    const customs = this.#getCustomTemplates().filter(t => t.id !== id);
    game.settings.set(MODULE_ID, 'sceneTemplates', customs);
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.TemplateDeleted'));
  }

  /* ---------------------------------------- */
  /*  Anchor State                            */
  /* ---------------------------------------- */

  #updateAnchorState() {
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');
    const btn = this.#element?.querySelector('[data-action="toggle-anchor"]');
    btn?.classList.toggle('is-active',
      anchor?.panel === 'scene' &&
      anchor?.sessionId === this.#sessionId &&
      anchor?.beatId === this.#beatId &&
      anchor?.sceneId === this.#sceneId);
  }
}
