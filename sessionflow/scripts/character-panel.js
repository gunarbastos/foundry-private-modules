/**
 * SessionFlow - Character Panel Controller
 * Manages the left slide-in panel with a hero image and free-form widget canvas
 * for a single character from Exalted Scenes.
 * @module character-panel
 */

import { getCharacterCanvas, updateCharacterCanvas } from './session-store.js';
import { CanvasEngine } from './canvas-engine.js';
import { getRegisteredTypes } from './widget.js';

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

const MODULE_ID = 'sessionflow';

/** Widget types excluded from the character panel toolbar */
const EXCLUDED_TYPES = new Set(['scene-image', 'characters', 'timer', 'scene-link', 'sequence', 'slideshow']);

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
      this.#engine.flushPendingSave();
      this.#engine.destroy();
      this.#engine = null;
    }

    this.#characterId = characterId;
    this.#sceneContext = sceneContext;

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
    this.#updateSlotState();
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    this.#engine?.flushPendingSave();
    this.#flushPendingWidthSave();
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
    this.#engine?.flushPendingSave();
    this.#flushPendingWidthSave();
    this.#engine?.destroy();
    this.#engine = null;
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
    this.#characterId = null;
    this.#sceneContext = null;
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

    const body = this.#element.querySelector('.sessionflow-character-panel__body');
    const newBody = temp.querySelector('.sessionflow-character-panel__body');
    if (body && newBody) body.replaceWith(newBody);

    // Re-initialize canvas
    this.#initializeCanvas();
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
      templateLabel: game.i18n.localize('SESSIONFLOW.Canvas.TemplateLoad')
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

    // Load widget states from character data
    const charData = getCharacterCanvas(this.#characterId);
    const widgets = charData?.widgets ?? [];
    const canvasHeight = charData?.canvasHeight ?? 420;
    const nextZIndex = charData?.nextZIndex ?? widgets.length;

    // Restore saved panel width
    this.#panelWidth = charData?.panelWidth ?? DEFAULT_PANEL_WIDTH;
    this.#applyPanelWidth();

    // Create and initialize engine
    const context = { characterId: this.#characterId };
    const saveFn = (data) => updateCharacterCanvas(this.#characterId, data);

    this.#engine = new CanvasEngine();
    this.#engine.initialize(
      canvasEl, panelContentEl,
      context, widgets, canvasHeight, nextZIndex, saveFn
    );

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

    // Escape key — skip if a Foundry dialog/window is open above us
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        const openDialog = document.querySelector('.dialog .window-content, .app.window-app');
        if (openDialog) return;
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

    for (const template of BUILTIN_TEMPLATES_CHARACTER) {
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
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      picker.remove();
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
    const toolbar = this.#element?.querySelector('.sessionflow-character-panel__toolbar');
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
   * Apply a built-in template to the current character canvas.
   * @param {{ widgets: () => object[], canvasHeight?: number }} template
   */
  #applyTemplate(template) {
    if (!this.#engine) return;

    const newWidgets = template.widgets();
    const canvasHeight = template.canvasHeight ?? 420;

    // Destroy current engine, save new widgets, re-initialize
    this.#engine.flushPendingSave();
    this.#engine.destroy();
    this.#engine = null;

    updateCharacterCanvas(this.#characterId, {
      widgets: newWidgets,
      nextZIndex: newWidgets.length,
      canvasHeight
    });

    this.#initializeCanvas();
  }

  /**
   * Apply a custom template.
   * @param {{ widgets: object[], canvasHeight?: number }} ct
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
    const canvasHeight = ct.canvasHeight ?? 420;

    this.#engine.flushPendingSave();
    this.#engine.destroy();
    this.#engine = null;

    updateCharacterCanvas(this.#characterId, {
      widgets: newWidgets,
      nextZIndex: newWidgets.length,
      canvasHeight
    });

    this.#initializeCanvas();
  }

  /**
   * Save the current canvas layout as a custom template.
   */
  async #saveCurrentAsTemplate() {
    if (!this.#engine) return;

    // Prompt for name using Foundry-native dialog (prompt() is unreliable in Electron)
    const name = await this.#promptTemplateName();
    if (!name) return;

    // Flush pending save and WAIT for it to complete before reading
    await this.#engine.flushPendingSave();

    // Now read the fresh data from settings
    const charData = getCharacterCanvas(this.#characterId);
    const currentWidgets = charData?.widgets ?? [];
    const canvasHeight = charData?.canvasHeight ?? 420;

    // Extract layout-only data (strip content, keep structure)
    const layoutWidgets = currentWidgets.map(w => {
      const base = { type: w.type, x: w.x, y: w.y, width: w.width, height: w.height };
      // Preserve config for dividers (orientation/style/color are layout properties)
      if (w.type === 'divider' && w.config) base.config = { ...w.config };
      return base;
    });

    const customs = this.#getCustomTemplates();
    customs.push({
      id: foundry.utils.randomID(),
      name: name,
      canvasHeight,
      widgets: layoutWidgets
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
