/**
 * SessionFlow - Scene Panel Controller
 * Manages the bottom slide-up panel with a free-form widget canvas.
 * @module scene-panel
 */

import {
  getScenes, getSession, updateSceneCanvas,
  resolveScenePageData, createScenePage, updateScenePageCanvas,
  updateScenePageMeta, deleteScenePage, reorderScenePages, setSceneActivePage
} from './session-store.js';
import { CanvasEngine, buildShortcutsPopover } from './canvas-engine.js';
import { getRegisteredTypes } from './widget.js';
import { IconPicker } from './icon-picker.js';
import { resumeManagedVideos, suspendManagedVideos } from './media-utils.js';

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
import './widgets/macro-widget.js';
import './widgets/scene-link-widget.js';
import './widgets/day-night-widget.js';
import './widgets/sequence-widget.js';
import './widgets/slideshow-widget.js';
import './widgets/relationships-widget.js';
import './widgets/map-widget.js';
import './widgets/quest-tracker-widget.js';
import './widgets/currency-widget.js';
import './widgets/cast-display-widget.js';
import './widgets/quick-scenes-widget.js';

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

function serializeWidgetForTemplate(widgetState) {
  return {
    type: widgetState.type,
    x: widgetState.x,
    y: widgetState.y,
    width: widgetState.width,
    height: widgetState.height,
    zIndex: widgetState.zIndex ?? 0,
    collapsed: widgetState.collapsed ?? false,
    config: foundry.utils.deepClone(widgetState.config ?? {})
  };
}

function instantiateTemplateWidgets(widgetStates) {
  const ordered = [...(widgetStates ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return ordered.map((widgetState, index) => ({
    id: foundry.utils.randomID(),
    type: widgetState.type,
    x: widgetState.x,
    y: widgetState.y,
    width: widgetState.width,
    height: widgetState.height,
    zIndex: index,
    collapsed: widgetState.collapsed ?? false,
    config: foundry.utils.deepClone(widgetState.config ?? {})
  }));
}

const BUILTIN_TEMPLATES = [
  {
    id: '_classic',
    name: 'SESSIONFLOW.Canvas.TemplateClassic',
    icon: 'fas fa-columns',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 520, height: 340 },
      { type: 'divider', x: 560, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'characters', x: 600, y: 20, width: 460, height: 340 }
    ])
  },
  {
    id: '_storyteller',
    name: 'SESSIONFLOW.Canvas.TemplateStoryteller',
    icon: 'fas fa-book-open',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 480, height: 340 },
      { type: 'divider', x: 520, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'ornamental' } },
      { type: 'teleprompter', x: 560, y: 20, width: 500, height: 44 },
      { type: 'divider', x: 600, y: 84, width: 420, height: 20, config: { orientation: 'horizontal', style: 'dotted' } },
      { type: 'paragraph', x: 560, y: 120, width: 500, height: 240 }
    ])
  },
  {
    id: '_combat',
    name: 'SESSIONFLOW.Canvas.TemplateCombat',
    icon: 'fas fa-swords',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 420, height: 340 },
      { type: 'divider', x: 460, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'solid' } },
      { type: 'characters', x: 500, y: 20, width: 300, height: 340 },
      { type: 'timer', x: 820, y: 20, width: 260, height: 200 }
    ])
  },
  {
    id: '_exploration',
    name: 'SESSIONFLOW.Canvas.TemplateExploration',
    icon: 'fas fa-compass',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 440, height: 340 },
      { type: 'divider', x: 480, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'checklist', x: 520, y: 20, width: 280, height: 140 },
      { type: 'time-tracker', x: 520, y: 180, width: 280, height: 180 }
    ])
  },
  {
    id: '_social',
    name: 'SESSIONFLOW.Canvas.TemplateSocial',
    icon: 'fas fa-comments',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 440, height: 340 },
      { type: 'divider', x: 480, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'ornamental' } },
      { type: 'characters', x: 520, y: 20, width: 540, height: 160 },
      { type: 'inspiration', x: 520, y: 200, width: 260, height: 44 },
      { type: 'paragraph', x: 520, y: 260, width: 540, height: 120 }
    ])
  },
  {
    id: '_intrigue',
    name: 'SESSIONFLOW.Canvas.TemplateIntrigue',
    icon: 'fas fa-magnifying-glass',
    widgets: () => widgetsFromTemplate([
      { type: 'progress-clock', x: 20, y: 20, width: 280, height: 340 },
      { type: 'divider', x: 320, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'dotted' } },
      { type: 'journal-board', x: 360, y: 20, width: 340, height: 340 },
      { type: 'divider', x: 720, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'dotted' } },
      { type: 'paragraph', x: 760, y: 20, width: 300, height: 340 }
    ])
  },
  {
    id: '_atmosphere',
    name: 'SESSIONFLOW.Canvas.TemplateAtmosphere',
    icon: 'fas fa-cloud-moon',
    widgets: () => widgetsFromTemplate([
      { type: 'scene-image', x: 20, y: 20, width: 380, height: 340 },
      { type: 'divider', x: 420, y: 60, width: 20, height: 260, config: { orientation: 'vertical', style: 'fade' } },
      { type: 'music', x: 460, y: 20, width: 300, height: 160 },
      { type: 'ambience', x: 460, y: 200, width: 300, height: 160 },
      { type: 'soundboard', x: 780, y: 20, width: 280, height: 340 }
    ])
  },
  {
    id: '_theater',
    name: 'SESSIONFLOW.Canvas.TemplateTheaterOfMind',
    icon: 'fas fa-masks-theater',
    widgets: () => widgetsFromTemplate([
      { type: 'teleprompter', x: 20, y: 20, width: 300, height: 44 },
      { type: 'inspiration', x: 340, y: 20, width: 300, height: 44 },
      { type: 'divider', x: 60, y: 84, width: 940, height: 20, config: { orientation: 'horizontal', style: 'ornamental' } },
      { type: 'paragraph', x: 20, y: 120, width: 1040, height: 240 }
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

  /** @type {string|null} Active page ID (null = single-page / flat mode) */
  #activePageId = null;

  /** @type {AbortController|null} */
  #pageTabAbort = null;

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
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    this.#sessionId = sessionId;
    this.#beatId = beatId;
    this.#sceneId = sceneId;
    this.#activePageId = null; // Reset — will be resolved from stored data

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
    resumeManagedVideos(this.#element);
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    this.#engine?.clearSelection();
    this.#engine?.flushPendingSave();
    suspendManagedVideos(this.#element);
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
    this.#pageTabAbort?.abort();
    this.#pageTabAbort = null;
    this.#engine?.flushPendingSave();
    this.#engine?.destroy({ persist: false });
    this.#engine = null;
    suspendManagedVideos(this.#element);
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
    this.#sessionId = null;
    this.#beatId = null;
    this.#sceneId = null;
    this.#activePageId = null;
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
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
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

    if (this.#isOpen) {
      resumeManagedVideos(this.#element);
    }
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
      templateLabel: game.i18n.localize('SESSIONFLOW.Canvas.TemplateLoad'),
      shortcutsLabel: game.i18n.localize('SESSIONFLOW.Canvas.KeyboardShortcuts')
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

    // Resolve page data (handles backward compat with flat fields)
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === this.#sceneId);
    const pageData = resolveScenePageData(scene, this.#activePageId);

    this.#activePageId = pageData.pageId;
    const widgets = pageData.widgets.length ? pageData.widgets : (pageData.pages.length ? [] : createDefaultWidgets());
    const canvasHeight = pageData.canvasHeight;
    const nextZIndex = pageData.nextZIndex ?? widgets.length;

    // Save function: route to page or flat depending on mode
    const saveFn = this.#activePageId
      ? (data) => updateScenePageCanvas(this.#sessionId, this.#beatId, this.#sceneId, this.#activePageId, data)
      : (data) => updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, data);

    // Create and initialize engine
    const context = { sessionId: this.#sessionId, beatId: this.#beatId, sceneId: this.#sceneId };

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

    // Toolbar listeners + page tabs
    this.#activateToolbarListeners();
    this.#renderPageTabs(pageData.pages);
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

    // Escape key — skip if a Foundry dialog/window is open above us,
    // or if canvas has selected widgets (Escape deselects first, then closes on next press)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        const openDialog = document.querySelector('.dialog .window-content, .app.window-app');
        if (openDialog) return;
        if (this.#engine?.hasSelection) return;
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

    // Keyboard shortcuts help button
    toolbar.querySelector('[data-action="show-shortcuts"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleShortcutsPopover(e.currentTarget);
      }, { signal });
  }

  /* ---------------------------------------- */
  /*  Page Tabs                               */
  /* ---------------------------------------- */

  /**
   * Render the page tab strip. Always visible so the GM can discover the feature.
   * When in flat mode (no pages array), shows "Page 1" + [+] button.
   * @param {object[]} pages - Sorted array of page objects.
   */
  #renderPageTabs(pages) {
    const container = this.#element?.querySelector('.sessionflow-page-tabs');
    if (!container) return;

    // Abort previous tab listeners
    this.#pageTabAbort?.abort();
    this.#pageTabAbort = new AbortController();
    const signal = this.#pageTabAbort.signal;

    container.style.display = '';
    container.innerHTML = '';

    // If flat mode (no pages), show a single "Page 1" label + add button
    if (pages.length === 0) {
      const label = document.createElement('span');
      label.className = 'sessionflow-page-tab is-active is-solo';
      label.innerHTML = `<i class="fas fa-file"></i><span class="sessionflow-page-tab__name">Page 1</span>`;
      container.appendChild(label);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'sessionflow-page-tab sessionflow-page-tab--add';
      addBtn.title = game.i18n.localize('SESSIONFLOW.Pages.AddPage');
      addBtn.innerHTML = '<i class="fas fa-plus"></i>';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#addPage();
      }, { signal });
      container.appendChild(addBtn);
      return;
    }

    for (const page of pages) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'sessionflow-page-tab';
      if (page.id === this.#activePageId) tab.classList.add('is-active');
      tab.dataset.pageId = page.id;
      if (page.color) tab.style.setProperty('--sf-page-color', page.color);

      const icon = page.icon || 'fas fa-file';
      const iconHtml = icon.startsWith('img:')
        ? `<img class="sessionflow-page-tab__icon-img" src="${icon.slice(4)}" />`
        : `<i class="${icon}"></i>`;
      tab.innerHTML = `${iconHtml}<span class="sessionflow-page-tab__name">${page.name}</span>`;

      // Click to switch
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        if (page.id !== this.#activePageId) this.#switchPage(page.id);
      }, { signal });

      // Double-click to rename
      tab.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.#startInlineRename(tab, page.id);
      }, { signal });

      // Right-click context menu
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.#openPageContextMenu(e, page);
      }, { signal });

      // Drag to reorder
      tab.draggable = true;
      tab.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', page.id);
        e.dataTransfer.effectAllowed = 'move';
        tab.classList.add('is-dragging');
      }, { signal });
      tab.addEventListener('dragend', () => {
        tab.classList.remove('is-dragging');
        container.querySelectorAll('.sessionflow-page-tab').forEach(t => t.classList.remove('drag-over'));
      }, { signal });
      tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tab.classList.add('drag-over');
      }, { signal });
      tab.addEventListener('dragleave', () => {
        tab.classList.remove('drag-over');
      }, { signal });
      tab.addEventListener('drop', async (e) => {
        e.preventDefault();
        tab.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === page.id) return;
        await this.#reorderPageDrop(draggedId, page.id, pages);
      }, { signal });

      container.appendChild(tab);
    }

    // Add page button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-page-tab sessionflow-page-tab--add';
    addBtn.title = game.i18n.localize('SESSIONFLOW.Pages.AddPage');
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#addPage();
    }, { signal });
    container.appendChild(addBtn);

    // Register page keyboard shortcuts on the panel
    this.#activatePageKeyboard(signal);
  }

  /**
   * Switch to a different page within the current scene.
   * @param {string} pageId
   */
  async #switchPage(pageId) {
    if (pageId === this.#activePageId) return;
    if (!this.#engine) return;

    // Save current page
    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    // Persist active page preference
    this.#activePageId = pageId;
    await setSceneActivePage(this.#sessionId, this.#beatId, this.#sceneId, pageId);

    // Re-initialize canvas for the new page
    this.#initializeCanvas();
  }

  /**
   * Add a new page to the current scene.
   */
  async #addPage() {
    // Save current engine state first
    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    const page = await createScenePage(this.#sessionId, this.#beatId, this.#sceneId);
    if (!page) return;

    this.#activePageId = page.id;
    this.#initializeCanvas();
  }

  /**
   * Duplicate a page (copy all widgets).
   * @param {object} page - The page to duplicate.
   */
  async #duplicatePage(page) {
    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    // Deep clone widgets with new IDs
    const clonedWidgets = (page.widgets ?? []).map(w => ({
      ...foundry.utils.deepClone(w),
      id: foundry.utils.randomID()
    }));

    const newPage = await createScenePage(this.#sessionId, this.#beatId, this.#sceneId, {
      name: `${page.name} (copy)`,
      icon: page.icon,
      color: page.color,
      widgets: clonedWidgets,
      canvasHeight: page.canvasHeight ?? 420,
      nextZIndex: page.nextZIndex ?? clonedWidgets.length
    });

    if (!newPage) return;
    this.#activePageId = newPage.id;
    this.#initializeCanvas();
  }

  /**
   * Delete a page.
   * @param {object} page
   */
  async #deletePageConfirm(page) {
    const hasWidgets = (page.widgets?.length ?? 0) > 0;
    const confirmed = hasWidgets
      ? await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize('SESSIONFLOW.Pages.DeletePage') },
          content: `<p>${game.i18n.localize('SESSIONFLOW.Pages.DeleteConfirm')}</p>`,
          modal: true
        })
      : true;
    if (!confirmed) return;

    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    const result = await deleteScenePage(this.#sessionId, this.#beatId, this.#sceneId, page.id);
    if (!result.deleted) return;

    this.#activePageId = result.activePageId;
    this.#initializeCanvas();
  }

  /**
   * Start inline rename on a page tab.
   * @param {HTMLElement} tabEl
   * @param {string} pageId
   */
  #startInlineRename(tabEl, pageId) {
    const nameEl = tabEl.querySelector('.sessionflow-page-tab__name');
    if (!nameEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-page-tab__rename-input';
    input.value = nameEl.textContent;
    input.size = Math.max(input.value.length, 4);

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== nameEl.textContent) {
        await updateScenePageMeta(this.#sessionId, this.#beatId, this.#sceneId, pageId, { name: newName });
        nameEl.textContent = newName;
      }
      input.replaceWith(nameEl);
    };

    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = nameEl.textContent; input.blur(); }
    });
  }

  /**
   * Open a context menu for a page tab.
   * @param {MouseEvent} event
   * @param {object} page
   */
  #openPageContextMenu(event, page) {
    // Remove any existing context menu
    document.querySelector('.sessionflow-page-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'sessionflow-page-context-menu';

    const items = [
      { label: game.i18n.localize('SESSIONFLOW.Pages.RenamePage'), icon: 'fas fa-pen', action: () => {
        const tab = this.#element?.querySelector(`[data-page-id="${page.id}"]`);
        if (tab) this.#startInlineRename(tab, page.id);
      }},
      { label: game.i18n.localize('SESSIONFLOW.Pages.ChangeIcon'), icon: 'fas fa-icons', action: () => this.#changePageIcon(page) },
      { label: game.i18n.localize('SESSIONFLOW.Pages.ChangeColor'), icon: 'fas fa-palette', action: () => this.#changePageColor(page) },
      { label: game.i18n.localize('SESSIONFLOW.Pages.DuplicatePage'), icon: 'fas fa-copy', action: () => this.#duplicatePage(page) },
      { divider: true },
      { label: game.i18n.localize('SESSIONFLOW.Pages.DeletePage'), icon: 'fas fa-trash', action: () => this.#deletePageConfirm(page), danger: true }
    ];

    for (const item of items) {
      if (item.divider) {
        const hr = document.createElement('hr');
        hr.className = 'sessionflow-page-context-menu__divider';
        menu.appendChild(hr);
        continue;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sessionflow-page-context-menu__item';
      if (item.danger) btn.classList.add('is-danger');
      btn.innerHTML = `<i class="${item.icon}"></i><span>${item.label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        item.action();
      });
      menu.appendChild(btn);
    }

    // Position at cursor
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    document.body.appendChild(menu);

    // Close on outside click
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  /**
   * Change page icon via the visual icon picker.
   * @param {object} page
   */
  #changePageIcon(page) {
    const tab = this.#element?.querySelector(`[data-page-id="${page.id}"]`);
    if (!tab) return;

    const picker = new IconPicker({
      anchor: tab,
      currentIcon: page.icon || 'fas fa-file',
      onSelect: async (icon) => {
        await updateScenePageMeta(this.#sessionId, this.#beatId, this.#sceneId, page.id, { icon });
        this.#refreshPageTabs();
      }
    });
    picker.open();
  }

  /**
   * Change page color via a color picker dialog.
   * @param {object} page
   */
  async #changePageColor(page) {
    const color = await new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('SESSIONFLOW.Pages.ChangeColor') },
        content: `
          <form>
            <div class="form-group">
              <label>${game.i18n.localize('SESSIONFLOW.Pages.ColorPrompt')}</label>
              <input type="color" name="pageColor" value="${page.color || '#7c5cbf'}" />
            </div>
          </form>
        `,
        buttons: [{
          action: 'save',
          label: game.i18n.localize('Save'),
          icon: 'fas fa-check',
          default: true,
          callback: (event, button, dialog) => resolve(button.form.elements.pageColor?.value || null)
        }, {
          action: 'clear',
          label: game.i18n.localize('SESSIONFLOW.Pages.ClearColor'),
          icon: 'fas fa-eraser',
          callback: () => resolve('')
        }, {
          action: 'cancel',
          label: game.i18n.localize('Cancel'),
          callback: () => resolve(null)
        }],
        close: () => resolve(null),
        modal: true
      });
      dialog.render(true);
    });
    if (color === null) return;

    await updateScenePageMeta(this.#sessionId, this.#beatId, this.#sceneId, page.id, { color });
    this.#refreshPageTabs();
  }

  /**
   * Reorder pages after a drag-and-drop.
   * @param {string} draggedId
   * @param {string} targetId
   * @param {object[]} currentPages
   */
  async #reorderPageDrop(draggedId, targetId, currentPages) {
    const ids = currentPages.map(p => p.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    await reorderScenePages(this.#sessionId, this.#beatId, this.#sceneId, ids);
    this.#refreshPageTabs();
  }

  /**
   * Re-read pages from store and re-render the tab strip (without touching the canvas).
   */
  #refreshPageTabs() {
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === this.#sceneId);
    const pageData = resolveScenePageData(scene, this.#activePageId);
    this.#renderPageTabs(pageData.pages);
  }

  /**
   * Register page navigation keyboard shortcuts.
   * @param {AbortSignal} signal
   */
  #activatePageKeyboard(signal) {
    const handler = (e) => {
      if (!this.#isOpen) return;
      // Skip if focus is on an interactive element
      if (e.target.closest('input, textarea, select, .ProseMirror')) return;

      const scenes = getScenes(this.#sessionId, this.#beatId);
      const scene = scenes.find(sc => sc.id === this.#sceneId);
      const pages = [...(scene?.pages ?? [])].sort((a, b) => a.order - b.order);
      if (pages.length < 2) return;

      const currentIdx = pages.findIndex(p => p.id === this.#activePageId);

      if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        const next = pages[(currentIdx + 1) % pages.length];
        if (next) this.#switchPage(next.id);
      } else if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        const prev = pages[(currentIdx - 1 + pages.length) % pages.length];
        if (prev) this.#switchPage(prev.id);
      } else if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < pages.length) {
          e.preventDefault();
          e.stopPropagation();
          this.#switchPage(pages[idx].id);
        }
      }
    };

    document.addEventListener('keydown', handler, { signal });
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

    let closeHandler = null;
    const closePicker = () => {
      picker.remove();
      if (closeHandler) {
        document.removeEventListener('mousedown', closeHandler);
        closeHandler = null;
      }
    };

    for (const template of BUILTIN_TEMPLATES) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sessionflow-template-picker__item';
      item.innerHTML = `<i class="${template.icon}"></i><span>${game.i18n.localize(template.name)}</span>`;
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        closePicker();
        await this.#applyTemplate(template);
      });
      list.appendChild(item);
    }

    // Save current as template
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sessionflow-template-picker__save';
    saveBtn.innerHTML = `<i class="fas fa-floppy-disk"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.TemplateSaveCurrent')}</span>`;
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closePicker();
      await this.#saveCurrentAsTemplate();
    });

    // Custom templates section
    const customs = this.#getCustomTemplates();
    if (customs.length > 0) {
      const customHeader = document.createElement('div');
      customHeader.className = 'sessionflow-template-picker__subheader';
      customHeader.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TemplateCustom');
      list.appendChild(customHeader);

      for (const ct of customs) {
        const item = document.createElement('div');
        item.className = 'sessionflow-template-picker__item sessionflow-template-picker__item--custom';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'sessionflow-template-picker__item-main';
        loadBtn.innerHTML = `<i class="fas fa-bookmark"></i><span>${ct.name}</span>`;
        loadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          closePicker();
          await this.#applyCustomTemplate(ct);
        });
        item.appendChild(loadBtn);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'sessionflow-template-picker__item-delete';
        delBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
        delBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          await this.#deleteCustomTemplate(ct.id);
          closePicker();
        });
        item.appendChild(delBtn);
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
    closeHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorBtn) {
        closePicker();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  /**
   * Apply a built-in template to the current scene (active page only).
   * @param {{ widgets: () => object[] }} template
   */
  async #applyTemplate(template) {
    if (!this.#engine) return;

    const newWidgets = template.widgets();

    // Destroy current engine, save new widgets, re-initialize
    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    const changes = { widgets: newWidgets, nextZIndex: newWidgets.length };
    if (this.#activePageId) {
      await updateScenePageCanvas(this.#sessionId, this.#beatId, this.#sceneId, this.#activePageId, changes);
    } else {
      await updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, changes);
    }

    this.#initializeCanvas();
  }

  /**
   * Apply a custom template (active page only).
   * @param {{ widgets: object[] }} ct
   */
  async #applyCustomTemplate(ct) {
    if (!this.#engine) return;

    const newWidgets = instantiateTemplateWidgets(ct.widgets);
    const canvasHeight = ct.canvasHeight ?? 420;

    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    const changes = { widgets: newWidgets, canvasHeight, nextZIndex: newWidgets.length };
    if (this.#activePageId) {
      await updateScenePageCanvas(this.#sessionId, this.#beatId, this.#sceneId, this.#activePageId, changes);
    } else {
      await updateSceneCanvas(this.#sessionId, this.#beatId, this.#sceneId, changes);
    }

    this.#initializeCanvas();
  }

  /**
   * Save the current canvas layout as a custom template.
   */
  async #saveCurrentAsTemplate() {
    if (!this.#engine) return;

    const name = await this.#promptTemplateName();
    if (!name) return;

    await this.#engine.flushPendingSave();

    // Read from the active page or flat data
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === this.#sceneId);
    const pageData = resolveScenePageData(scene, this.#activePageId);
    const currentWidgets = pageData.widgets;
    const canvasHeight = pageData.canvasHeight;

    const templateWidgets = currentWidgets.map(serializeWidgetForTemplate);

    const customs = this.#getCustomTemplates();
    customs.push({
      id: foundry.utils.randomID(),
      name: name,
      canvasHeight,
      widgets: templateWidgets
    });

    await game.settings.set(MODULE_ID, 'sceneTemplates', customs);
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.TemplateSaved'));
  }

  /**
   * Show a Foundry-native dialog to prompt for a template name.
   * @returns {Promise<string|null>} The trimmed name, or null if cancelled.
   */
  async #promptTemplateName() {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('SESSIONFLOW.Canvas.TemplateSaveCurrent') },
        content: `
          <form>
            <div class="form-group">
              <label>${game.i18n.localize('SESSIONFLOW.Canvas.TemplateSavePrompt')}</label>
              <input type="text" name="templateName" autofocus />
            </div>
          </form>
        `,
        buttons: [{
          action: 'save',
          label: game.i18n.localize('Save'),
          icon: 'fas fa-floppy-disk',
          default: true,
          callback: (event, button, dialog) => {
            const input = button.form.elements.templateName;
            resolve(input?.value?.trim() || null);
          }
        }, {
          action: 'cancel',
          label: game.i18n.localize('Cancel'),
          icon: 'fas fa-times',
          callback: () => resolve(null)
        }],
        close: () => resolve(null),
        modal: true
      });
      dialog.render(true);
    });
  }

  /** @returns {object[]} */
  #getCustomTemplates() {
    try {
      return game.settings.get(MODULE_ID, 'sceneTemplates') ?? [];
    } catch {
      return [];
    }
  }

  async #deleteCustomTemplate(id) {
    const customs = this.#getCustomTemplates().filter(t => t.id !== id);
    await game.settings.set(MODULE_ID, 'sceneTemplates', customs);
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.TemplateDeleted'));
  }

  /* ---------------------------------------- */
  /*  Keyboard Shortcuts Help                 */
  /* ---------------------------------------- */

  #toggleShortcutsPopover(anchorBtn) {
    // Close existing popover if any
    const existing = this.#element?.querySelector('.sessionflow-shortcuts-popover');
    if (existing) { existing.remove(); return; }

    const hasPages = !!this.#activePageId;
    const popover = buildShortcutsPopover({ showPageShortcuts: hasPages });

    const toolbar = this.#element?.querySelector('.sessionflow-scene-panel__toolbar');
    if (toolbar) {
      toolbar.style.position = 'relative';
      toolbar.appendChild(popover);
    }

    // Close on outside click
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorBtn) {
        popover.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
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
