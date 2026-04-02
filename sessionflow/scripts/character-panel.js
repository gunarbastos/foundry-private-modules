/**
 * SessionFlow - Character Panel Controller
 * Manages the left slide-in panel with a hero image and free-form widget canvas
 * for a single character from Exalted Scenes.
 * @module character-panel
 */

import {
  getCharacterCanvas, updateCharacterCanvas,
  resolveCharacterPageData, createCharacterPage, updateCharacterPageCanvas,
  updateCharacterPageMeta, deleteCharacterPage, reorderCharacterPages, setCharacterActivePage
} from './session-store.js';
import { CanvasEngine, buildShortcutsPopover } from './canvas-engine.js';
import { getRegisteredTypes } from './widget.js';
import { IconPicker } from './icon-picker.js';
import { resumeManagedVideos, suspendManagedVideos } from './media-utils.js';

// Import widget types so they self-register (shared with scene-panel)
import './widgets/paragraph-widget.js';
import './widgets/teleprompter-widget.js';
import './widgets/free-image-widget.js';
import './widgets/inspiration-widget.js';
import './widgets/checklist-widget.js';
import './widgets/divider-widget.js';
import './widgets/music-widget.js';
import './widgets/ambience-widget.js';
import './widgets/soundboard-widget.js';
import './widgets/sticky-widget.js';
import './widgets/relationships-widget.js';
import './widgets/progress-clock-widget.js';
import './widgets/faction-widget.js';
import './widgets/time-tracker-widget.js';
import './widgets/journal-board-widget.js';
import './widgets/macro-widget.js';
import './widgets/day-night-widget.js';
import './widgets/quest-tracker-widget.js';
import './widgets/currency-widget.js';

const MODULE_ID = 'sessionflow';

/** Widget types excluded from the character panel toolbar */
const EXCLUDED_TYPES = new Set(['scene-image', 'characters', 'timer', 'scene-link', 'sequence', 'slideshow', 'cast-display', 'quick-scenes']);

/** Panel width constraints */
const DEFAULT_PANEL_WIDTH = 580;
const MIN_PANEL_WIDTH = 380;
const PANEL_WIDTH_MARGIN = 40;
const WIDTH_SAVE_DEBOUNCE_MS = 400;

/* ---------------------------------------- */
/*  Built-in Character Templates            */
/* ---------------------------------------- */

/**
 * Generate widgets from a template definition.
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

const BUILTIN_TEMPLATES_CHARACTER = [
  {
    id: '_dossier',
    name: 'SESSIONFLOW.Canvas.TemplateDossier',
    icon: 'fas fa-id-card',
    canvasHeight: 740,
    widgets: () => widgetsFromTemplate([
      { type: 'relationships', x: 20, y: 20, width: 500, height: 300 },
      { type: 'divider', x: 60, y: 340, width: 420, height: 20, config: { orientation: 'horizontal', style: 'ornamental' } },
      { type: 'journal-board', x: 20, y: 380, width: 500, height: 340 }
    ])
  },
  {
    id: '_notes',
    name: 'SESSIONFLOW.Canvas.TemplateNotes',
    icon: 'fas fa-clipboard',
    canvasHeight: 580,
    widgets: () => widgetsFromTemplate([
      { type: 'paragraph', x: 20, y: 20, width: 500, height: 220 },
      { type: 'divider', x: 60, y: 260, width: 420, height: 20, config: { orientation: 'horizontal', style: 'fade' } },
      { type: 'checklist', x: 20, y: 300, width: 260, height: 260 },
      { type: 'sticky', x: 300, y: 300, width: 220, height: 180 }
    ])
  },
  {
    id: '_connections',
    name: 'SESSIONFLOW.Canvas.TemplateConnections',
    icon: 'fas fa-handshake',
    canvasHeight: 760,
    widgets: () => widgetsFromTemplate([
      { type: 'faction', x: 20, y: 20, width: 500, height: 360 },
      { type: 'divider', x: 60, y: 400, width: 420, height: 20, config: { orientation: 'horizontal', style: 'ornamental' } },
      { type: 'relationships', x: 20, y: 440, width: 500, height: 300 }
    ])
  },
  {
    id: '_chronicle',
    name: 'SESSIONFLOW.Canvas.TemplateChronicle',
    icon: 'fas fa-clock-rotate-left',
    canvasHeight: 620,
    widgets: () => widgetsFromTemplate([
      { type: 'time-tracker', x: 20, y: 20, width: 500, height: 240 },
      { type: 'divider', x: 60, y: 280, width: 420, height: 20, config: { orientation: 'horizontal', style: 'dotted' } },
      { type: 'progress-clock', x: 20, y: 320, width: 240, height: 280 },
      { type: 'paragraph', x: 280, y: 320, width: 240, height: 280 }
    ])
  },
  {
    id: '_blank',
    name: 'SESSIONFLOW.Canvas.TemplateBlank',
    icon: 'fas fa-border-none',
    canvasHeight: 420,
    widgets: () => []
  }
];

export class CharacterPanel {

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {string|null} Exalted Scenes character ID */
  #characterId = null;

  /** @type {{ sessionId: string, beatId: string, sceneId: string }|null} Scene context for back navigation */
  #sceneContext = null;

  /** @type {CanvasEngine|null} */
  #engine = null;

  /** @type {AbortController|null} */
  #toolbarAbort = null;

  /** @type {number} Current panel width */
  #panelWidth = DEFAULT_PANEL_WIDTH;

  /** @type {{ startX: number, originWidth: number }|null} */
  #resizeState = null;

  /** @type {number|null} Debounce timer for width save */
  #widthSaveTimer = null;

  /** @type {string|null} Active page ID (null = single-page / flat mode) */
  #activePageId = null;

  /** @type {AbortController|null} */
  #pageTabAbort = null;

  /** @type {string} */
  #templatePath = `modules/${MODULE_ID}/templates/character-panel.hbs`;

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Open the panel for a given character.
   * @param {string} characterId - Exalted Scenes character ID.
   * @param {{ sessionId: string, beatId: string, sceneId: string }|null} [sceneContext=null] - Scene context for back navigation.
   */
  async open(characterId, sceneContext = null) {
    if (!characterId) return;

    // If already open for the same character, skip
    if (this.#isOpen && this.#characterId === characterId) return;

    // If open for a different character, tear down the old engine
    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    this.#characterId = characterId;
    this.#sceneContext = sceneContext;
    this.#activePageId = null; // Reset — will be resolved from stored data

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
    resumeManagedVideos(this.#element);
    this.#updateSlotState();
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    this.#engine?.clearSelection();
    this.#engine?.flushPendingSave();
    this.#flushPendingWidthSave();
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

    if (this.#engine) {
      this.#engine.refreshAllWidgets();
      return;
    }

    await this.#rerenderBody();
  }

  /** Remove the panel from DOM entirely. */
  destroy() {
    this.#toolbarAbort?.abort();
    this.#toolbarAbort = null;
    this.#pageTabAbort?.abort();
    this.#pageTabAbort = null;
    this.#engine?.flushPendingSave();
    this.#flushPendingWidthSave();
    this.#engine?.destroy({ persist: false });
    this.#engine = null;
    suspendManagedVideos(this.#element);
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
    this.#characterId = null;
    this.#sceneContext = null;
    this.#activePageId = null;
  }

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** @returns {string|null} */
  get characterId() { return this.#characterId; }

  /** @returns {{ sessionId: string, beatId: string, sceneId: string }|null} */
  get sceneContext() { return this.#sceneContext; }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  async #render() {
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    document.body.insertAdjacentHTML('beforeend', html);
    this.#element = document.body.querySelector('.sessionflow-character-panel');

    if (!this.#element) {
      console.error(`[${MODULE_ID}] Failed to find character panel element after render!`);
      return;
    }

    this.#activateShellListeners();
    this.#initializeCanvas();
  }

  async #rerenderBody() {
    if (!this.#element) return;
    if (!document.body.contains(this.#element)) {
      console.warn(`[${MODULE_ID}] Character panel element detached from DOM, re-attaching.`);
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

    const body = this.#element.querySelector('.sessionflow-character-panel__body');
    const newBody = temp.querySelector('.sessionflow-character-panel__body');
    if (body && newBody) body.replaceWith(newBody);

    // Re-initialize canvas
    this.#initializeCanvas();

    if (this.#isOpen) {
      resumeManagedVideos(this.#element);
    }
  }

  #getTemplateData() {
    const character = this.#getExaltedCharacter(this.#characterId);

    // Get registered widget types for toolbar (filtered)
    const widgetTypes = getRegisteredTypes()
      .filter(t => !EXCLUDED_TYPES.has(t.type))
      .map(t => ({
        type: t.type,
        icon: t.icon,
        label: game.i18n.localize(t.label)
      }));

    return {
      // Character data
      characterName: character?.name ?? '',
      characterImage: character?.image ?? '',
      hasCharacterImage: !!character?.image,
      isCharacterImageVideo: this.#isVideoSource(character?.image),

      // Panel chrome
      title: game.i18n.localize('SESSIONFLOW.CharacterPanel.Title'),
      backLabel: game.i18n.localize('SESSIONFLOW.CharacterPanel.Back'),
      canEdit: game.user.isGM,

      // Quick slots (with keybinding hint)
      slot1Label: this.#getSlotLabel(1),
      slot2Label: this.#getSlotLabel(2),
      slot3Label: this.#getSlotLabel(3),

      // Toolbar
      widgetTypes,
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
    const panelContentEl = this.#element.querySelector('.sessionflow-character-panel__canvas-wrapper');
    if (!canvasEl || !panelContentEl) return;

    // Resolve page data (handles backward compat with flat fields)
    const charData = getCharacterCanvas(this.#characterId);
    const pageData = resolveCharacterPageData(charData, this.#activePageId);

    this.#activePageId = pageData.pageId;
    const widgets = pageData.widgets;
    const canvasHeight = pageData.canvasHeight;
    const nextZIndex = pageData.nextZIndex ?? widgets.length;

    // Restore saved panel width
    this.#panelWidth = charData?.panelWidth ?? DEFAULT_PANEL_WIDTH;
    this.#applyPanelWidth();

    // Save function: route to page or flat depending on mode
    const saveFn = this.#activePageId
      ? (data) => updateCharacterPageCanvas(this.#characterId, this.#activePageId, data)
      : (data) => updateCharacterCanvas(this.#characterId, data);

    // Create and initialize engine
    const context = { characterId: this.#characterId };

    this.#engine = new CanvasEngine();
    this.#engine.initialize(
      canvasEl, panelContentEl,
      context, widgets, canvasHeight, nextZIndex, saveFn
    );

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
        Hooks.call('sessionflow:navigateBackFromCharacter');
      });

    // Backdrop click
    this.#element.querySelector('.sessionflow-character-panel__backdrop')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromCharacter');
      });

    // Back button
    this.#element.querySelector('[data-action="navigate-back"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromCharacter');
      });

    // Escape key — skip if a Foundry dialog/window is open above us,
    // or if canvas has selected widgets (Escape deselects first, then closes on next press)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        const openDialog = document.querySelector('.dialog .window-content, .app.window-app');
        if (openDialog) return;
        if (this.#engine?.hasSelection) return;
        event.stopPropagation();
        Hooks.call('sessionflow:navigateBackFromCharacter');
      }
    });

    // Quick slot buttons
    this.#activateSlotListeners();

    // Panel width resize (right edge)
    const resizeEdge = this.#element.querySelector('.sessionflow-character-panel__resize-edge');
    if (resizeEdge) {
      resizeEdge.addEventListener('pointerdown', (e) => this.#onWidthResizeStart(e));
      document.addEventListener('pointermove', (e) => this.#onWidthResizeMove(e));
      document.addEventListener('pointerup', (e) => this.#onWidthResizeEnd(e));
    }
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Toolbar               */
  /* ---------------------------------------- */

  #activateToolbarListeners() {
    if (!this.#element) return;
    const toolbar = this.#element.querySelector('.sessionflow-character-panel__toolbar');
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
  /*  Quick Slots                             */
  /* ---------------------------------------- */

  /**
   * Build tooltip label for a slot, including the current keybinding.
   * E.g. "Quick Slot 1 (Shift + Q)"
   */
  #getSlotLabel(slotNumber) {
    const base = game.i18n.localize(`SESSIONFLOW.CharacterPanel.Slot${slotNumber}`);
    const bindings = game.keybindings.get(MODULE_ID, `characterSlot${slotNumber}`);
    if (!bindings?.length) return base;

    const binding = bindings[0];
    const parts = [];
    for (const mod of (binding.modifiers ?? [])) {
      parts.push(mod);
    }
    // Convert key code to readable label (e.g. 'KeyQ' → 'Q', 'Digit1' → '1')
    const key = binding.key ?? '';
    if (key.startsWith('Key')) parts.push(key.slice(3));
    else if (key.startsWith('Digit')) parts.push(key.slice(5));
    else parts.push(key);

    return `${base} (${parts.join(' + ')})`;
  }

  #activateSlotListeners() {
    if (!this.#element) return;

    this.#element.querySelectorAll('[data-action="toggle-slot"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(e.currentTarget.dataset.slot);
        if (slot) this.#toggleSlot(slot);
      });
    });
  }

  async #toggleSlot(slotNumber) {
    const slots = game.settings.get(MODULE_ID, 'characterQuickSlots');
    const key = `slot${slotNumber}`;

    if (slots[key] === this.#characterId) {
      slots[key] = null;
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.CharacterPanel.SlotCleared'));
    } else {
      slots[key] = this.#characterId;
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.CharacterPanel.SlotAssigned'));
    }

    await game.settings.set(MODULE_ID, 'characterQuickSlots', { ...slots });
    this.#updateSlotState();
  }

  #updateSlotState() {
    if (!this.#element) return;

    const slots = game.settings.get(MODULE_ID, 'characterQuickSlots');

    this.#element.querySelectorAll('[data-action="toggle-slot"]').forEach(btn => {
      const slot = parseInt(btn.dataset.slot);
      const key = `slot${slot}`;
      const assignedId = slots[key];

      const isActive = assignedId === this.#characterId;
      const isOccupied = !!assignedId && !isActive;

      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('is-occupied', isOccupied);
    });
  }

  /* ---------------------------------------- */
  /*  Panel Width Resize                      */
  /* ---------------------------------------- */

  #onWidthResizeStart(event) {
    if (event.button !== 0) return;
    event.preventDefault();

    this.#resizeState = {
      startX: event.clientX,
      originWidth: this.#panelWidth
    };

    document.body.style.cursor = 'ew-resize';
    event.target.setPointerCapture?.(event.pointerId);
  }

  #onWidthResizeMove(event) {
    if (!this.#resizeState) return;
    event.preventDefault();

    const dx = event.clientX - this.#resizeState.startX;
    const maxWidth = window.innerWidth - PANEL_WIDTH_MARGIN;
    const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, this.#resizeState.originWidth + dx));

    this.#panelWidth = newWidth;
    this.#applyPanelWidth();
  }

  #onWidthResizeEnd(event) {
    if (!this.#resizeState) return;

    document.body.style.cursor = '';
    this.#resizeState = null;
    this.#schedulePanelWidthSave();
  }

  #applyPanelWidth() {
    const contentEl = this.#element?.querySelector('.sessionflow-character-panel__content');
    if (contentEl) {
      contentEl.style.width = `${this.#panelWidth}px`;
    }
  }

  #schedulePanelWidthSave() {
    if (this.#widthSaveTimer) clearTimeout(this.#widthSaveTimer);
    this.#widthSaveTimer = setTimeout(() => {
      this.#widthSaveTimer = null;
      updateCharacterCanvas(this.#characterId, { panelWidth: this.#panelWidth });
    }, WIDTH_SAVE_DEBOUNCE_MS);
  }

  #flushPendingWidthSave() {
    if (this.#widthSaveTimer) {
      clearTimeout(this.#widthSaveTimer);
      this.#widthSaveTimer = null;
      updateCharacterCanvas(this.#characterId, { panelWidth: this.#panelWidth });
    }
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

      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        if (page.id !== this.#activePageId) this.#switchPage(page.id);
      }, { signal });

      tab.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.#startInlineRename(tab, page.id);
      }, { signal });

      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.#openPageContextMenu(e, page);
      }, { signal });

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

    this.#activatePageKeyboard(signal);
  }

  async #switchPage(pageId) {
    if (pageId === this.#activePageId) return;
    if (!this.#engine) return;

    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    this.#activePageId = pageId;
    await setCharacterActivePage(this.#characterId, pageId);

    this.#initializeCanvas();
  }

  async #addPage() {
    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    const page = await createCharacterPage(this.#characterId);
    if (!page) return;

    this.#activePageId = page.id;
    this.#initializeCanvas();
  }

  async #duplicatePage(page) {
    if (this.#engine) {
      await this.#engine.flushPendingSave();
      this.#engine.destroy({ persist: false });
      this.#engine = null;
    }

    const clonedWidgets = (page.widgets ?? []).map(w => ({
      ...foundry.utils.deepClone(w),
      id: foundry.utils.randomID()
    }));

    const newPage = await createCharacterPage(this.#characterId, {
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

    const result = await deleteCharacterPage(this.#characterId, page.id);
    if (!result.deleted) return;

    this.#activePageId = result.activePageId;
    this.#initializeCanvas();
  }

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
        await updateCharacterPageMeta(this.#characterId, pageId, { name: newName });
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

  #openPageContextMenu(event, page) {
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

    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    document.body.appendChild(menu);

    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  #changePageIcon(page) {
    const tab = this.#element?.querySelector(`[data-page-id="${page.id}"]`);
    if (!tab) return;

    const picker = new IconPicker({
      anchor: tab,
      currentIcon: page.icon || 'fas fa-file',
      onSelect: async (icon) => {
        await updateCharacterPageMeta(this.#characterId, page.id, { icon });
        this.#refreshPageTabs();
      }
    });
    picker.open();
  }

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

    await updateCharacterPageMeta(this.#characterId, page.id, { color });
    this.#refreshPageTabs();
  }

  async #reorderPageDrop(draggedId, targetId, currentPages) {
    const ids = currentPages.map(p => p.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    await reorderCharacterPages(this.#characterId, ids);
    this.#refreshPageTabs();
  }

  #refreshPageTabs() {
    const charData = getCharacterCanvas(this.#characterId);
    const pageData = resolveCharacterPageData(charData, this.#activePageId);
    this.#renderPageTabs(pageData.pages);
  }

  #activatePageKeyboard(signal) {
    const handler = (e) => {
      if (!this.#isOpen) return;
      if (e.target.closest('input, textarea, select, .ProseMirror')) return;

      const charData = getCharacterCanvas(this.#characterId);
      const pages = [...(charData?.pages ?? [])].sort((a, b) => a.order - b.order);
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

    for (const template of BUILTIN_TEMPLATES_CHARACTER) {
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
    const toolbar = this.#element?.querySelector('.sessionflow-character-panel__toolbar');
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
   * Apply a built-in template to the current character canvas (active page only).
   * @param {{ widgets: () => object[], canvasHeight?: number }} template
   */
  async #applyTemplate(template) {
    if (!this.#engine) return;

    const newWidgets = template.widgets();
    const canvasHeight = template.canvasHeight ?? 420;

    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    const changes = { widgets: newWidgets, nextZIndex: newWidgets.length, canvasHeight };
    if (this.#activePageId) {
      await updateCharacterPageCanvas(this.#characterId, this.#activePageId, changes);
    } else {
      await updateCharacterCanvas(this.#characterId, changes);
    }

    this.#initializeCanvas();
  }

  /**
   * Apply a custom template (active page only).
   * @param {{ widgets: object[], canvasHeight?: number }} ct
   */
  async #applyCustomTemplate(ct) {
    if (!this.#engine) return;

    const newWidgets = instantiateTemplateWidgets(ct.widgets);
    const canvasHeight = ct.canvasHeight ?? 420;

    await this.#engine.flushPendingSave();
    this.#engine.destroy({ persist: false });
    this.#engine = null;

    const changes = { widgets: newWidgets, nextZIndex: newWidgets.length, canvasHeight };
    if (this.#activePageId) {
      await updateCharacterPageCanvas(this.#characterId, this.#activePageId, changes);
    } else {
      await updateCharacterCanvas(this.#characterId, changes);
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
    const charData = getCharacterCanvas(this.#characterId);
    const pageData = resolveCharacterPageData(charData, this.#activePageId);
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

    await game.settings.set(MODULE_ID, 'characterTemplates', customs);
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
      return game.settings.get(MODULE_ID, 'characterTemplates') ?? [];
    } catch {
      return [];
    }
  }

  async #deleteCustomTemplate(id) {
    const customs = this.#getCustomTemplates().filter(t => t.id !== id);
    await game.settings.set(MODULE_ID, 'characterTemplates', customs);
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.TemplateDeleted'));
  }

  /* ---------------------------------------- */
  /*  Keyboard Shortcuts Help                 */
  /* ---------------------------------------- */

  #toggleShortcutsPopover(anchorBtn) {
    const existing = this.#element?.querySelector('.sessionflow-shortcuts-popover');
    if (existing) { existing.remove(); return; }

    const hasPages = !!this.#activePageId;
    const popover = buildShortcutsPopover({ showPageShortcuts: hasPages });

    const toolbar = this.#element?.querySelector('.sessionflow-character-panel__toolbar');
    if (toolbar) {
      toolbar.style.position = 'relative';
      toolbar.appendChild(popover);
    }

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorBtn) {
        popover.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  /* ---------------------------------------- */
  /*  Utilities                               */
  /* ---------------------------------------- */

  #isVideoSource(src) {
    if (!src) return false;
    const ext = src.split('.').pop()?.toLowerCase()?.split('?')[0];
    return ['mp4', 'webm', 'm4v'].includes(ext);
  }

  /* ---------------------------------------- */
  /*  Exalted Scenes Helpers                  */
  /* ---------------------------------------- */

  /**
   * Get a character from Exalted Scenes module.
   * @param {string} characterId
   * @returns {object|null}
   */
  #getExaltedCharacter(characterId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return null;
      return api.characters.get(characterId) ?? null;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Character ${characterId}:`, err);
      return null;
    }
  }
}
