/**
 * SessionFlow - Inspiration Widget
 * Compact chip on canvas; click to open a popover with colorful inspiration
 * pills for GM narration aids (sounds, smells, visuals, curiosities).
 * @module widgets/inspiration-widget
 */

import { Widget, registerWidgetType } from '../widget.js';
import { isCustomImage, getImagePath } from '../icon-picker.js';

const MODULE_ID = 'sessionflow';

/* ---------------------------------------- */
/*  Constants                               */
/* ---------------------------------------- */

const POPOVER_WIDTH = 640;
const POPOVER_HEIGHT = 500;
const DEFAULT_PILL_COLOR = '#3b82f6';
const DEFAULT_CHIP_COLOR = '#d97706';

/** Quick-access color+icon presets for consistent categorization */
const PRESETS = [
  { icon: 'fa-solid fa-eye',            color: '#3b82f6', label: 'Sight' },
  { icon: 'fa-solid fa-volume-high',    color: '#8b5cf6', label: 'Sound' },
  { icon: 'fa-solid fa-wind',           color: '#14b8a6', label: 'Smell' },
  { icon: 'fa-solid fa-hand',           color: '#f97316', label: 'Touch' },
  { icon: 'fa-solid fa-utensils',       color: '#e11d48', label: 'Taste' },
  { icon: 'fa-solid fa-comments',       color: '#22c55e', label: 'Dialogue' },
  { icon: 'fa-solid fa-skull',          color: '#dc2626', label: 'Danger' },
  { icon: 'fa-solid fa-heart',          color: '#ec4899', label: 'Emotion' },
  { icon: 'fa-solid fa-location-dot',   color: '#d97706', label: 'Location' },
  { icon: 'fa-solid fa-scroll',         color: '#ca8a04', label: 'Lore' },
  { icon: 'fa-solid fa-puzzle-piece',   color: '#10b981', label: 'Clue' },
  { icon: 'fa-solid fa-wand-sparkles',  color: '#6366f1', label: 'Magic' },
  { icon: 'fa-solid fa-shield-halved',  color: '#64748b', label: 'Combat' },
  { icon: 'fa-solid fa-gem',            color: '#f59e0b', label: 'Treasure' },
  { icon: 'fa-solid fa-masks-theater',  color: '#a855f7', label: 'NPC' },
  { icon: 'fa-solid fa-leaf',           color: '#16a34a', label: 'Nature' },
];

export class InspirationWidget extends Widget {

  static TYPE = 'inspiration';
  static LABEL = 'SESSIONFLOW.Canvas.Inspiration';
  static ICON = 'fas fa-lightbulb';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 42;
  static DEFAULT_WIDTH = 210;
  static DEFAULT_HEIGHT = 44;

  /* -- Private state -- */

  /** @type {boolean} */
  #isExpanded = false;

  /** @type {HTMLElement|null} */
  #popoverEl = null;

  /** @type {string|null} ID of item being edited */
  #editingItemId = null;

  /** @type {Function|null} */
  #outsideClickHandler = null;

  /** @type {Function|null} */
  #escapeHandler = null;

  /** @type {{ startX: number, startY: number, origLeft: number, origTop: number }|null} */
  #dragState = null;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.Inspiration');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-inspiration';

    const chip = document.createElement('div');
    chip.className = 'sessionflow-widget-inspiration__chip';
    if (this.#isExpanded) chip.classList.add('is-expanded');

    // Apply custom chip color
    const chipColor = this.config.chipColor;
    if (chipColor) {
      chip.style.setProperty('--sf-chip-color', chipColor);
      chip.classList.add('has-color');
    }

    // Color dot
    const dot = document.createElement('span');
    dot.className = 'sessionflow-widget-inspiration__chip-dot';
    chip.appendChild(dot);

    // Icon
    const icon = document.createElement('i');
    icon.className = 'fas fa-lightbulb';
    chip.appendChild(icon);

    // Title
    const title = document.createElement('span');
    title.className = 'sessionflow-widget-inspiration__chip-title';
    title.textContent = this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.Inspiration');
    chip.appendChild(title);

    // Count badge
    const count = this.config.items?.length || 0;
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'sessionflow-widget-inspiration__chip-count';
      badge.textContent = count;
      chip.appendChild(badge);
    }

    // Click to toggle popover
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.#isExpanded) {
        this.#closePopover();
      } else {
        this.#openPopover();
      }
    });

    container.appendChild(chip);
    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Popover Lifecycle                       */
  /* ---------------------------------------- */

  #openPopover() {
    // Close any other inspiration popover (singleton)
    document.querySelectorAll('.sessionflow-inspiration-popover').forEach(el => el.remove());

    this.#isExpanded = true;
    this.#editingItemId = null;

    // Update chip state
    const chip = this.element?.querySelector('.sessionflow-widget-inspiration__chip');
    chip?.classList.add('is-expanded');

    // Build popover
    this.#popoverEl = document.createElement('div');
    this.#popoverEl.className = 'sessionflow-inspiration-popover';
    this.#popoverEl.dataset.widgetId = this.id;

    this.#buildPopoverHeader();
    this.#buildPopoverBody();

    document.body.appendChild(this.#popoverEl);
    this.#positionPopover();
    this.#registerPopoverListeners();
  }

  #closePopover() {
    // Exit any active edit
    if (this.#editingItemId) {
      this.#exitEditItem(true);
    }

    this.#cleanupPopoverListeners();

    // Animate out
    if (this.#popoverEl) {
      this.#popoverEl.classList.add('is-closing');
      this.#popoverEl.addEventListener('animationend', () => {
        this.#popoverEl?.remove();
        this.#popoverEl = null;
      }, { once: true });

      // Fallback if animation doesn't fire
      setTimeout(() => {
        this.#popoverEl?.remove();
        this.#popoverEl = null;
      }, 250);
    }

    this.#isExpanded = false;

    // Update chip
    const chip = this.element?.querySelector('.sessionflow-widget-inspiration__chip');
    chip?.classList.remove('is-expanded');

    // Refresh chip to update title/count
    this.refreshBody();

    // Save
    this.engine.scheduleSave();
  }

  #positionPopover() {
    if (!this.#popoverEl || !this.element) return;

    const chipRect = this.element.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const gap = 8;

    let top = chipRect.bottom + gap;
    let left = chipRect.left;

    // Flip above if not enough space below
    if (top + POPOVER_HEIGHT > viewportH - 16) {
      top = chipRect.top - POPOVER_HEIGHT - gap;
    }

    // Clamp to viewport
    if (top < 8) top = 8;
    if (left + POPOVER_WIDTH > viewportW - 16) {
      left = viewportW - POPOVER_WIDTH - 16;
    }
    if (left < 8) left = 8;

    this.#popoverEl.style.top = `${top}px`;
    this.#popoverEl.style.left = `${left}px`;
  }

  /* ---------------------------------------- */
  /*  Popover Header                          */
  /* ---------------------------------------- */

  #buildPopoverHeader() {
    const header = document.createElement('div');
    header.className = 'sessionflow-inspiration-popover__header';

    // Title input
    const titleInput = document.createElement('input');
    titleInput.className = 'sessionflow-inspiration-popover__title-input';
    titleInput.type = 'text';
    titleInput.value = this.config.title || '';
    titleInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.InspirationTitlePlaceholder');
    titleInput.addEventListener('change', () => this.#onTitleChange(titleInput.value));
    titleInput.addEventListener('blur', () => this.#onTitleChange(titleInput.value));
    header.appendChild(titleInput);

    // Chip color picker (dot style)
    const colorWrapper = document.createElement('label');
    colorWrapper.className = 'sessionflow-inspiration-popover__color-wrapper';
    colorWrapper.title = game.i18n.localize('SESSIONFLOW.Canvas.InspirationChipColor');

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'sessionflow-inspiration-popover__color-input';
    colorInput.value = this.config.chipColor || DEFAULT_CHIP_COLOR;
    colorInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#onChipColorChange(colorInput.value);
      // Update dot visual
      const dot = colorWrapper.querySelector('.sessionflow-inspiration-popover__color-dot');
      if (dot) dot.style.background = colorInput.value;
    });
    colorWrapper.appendChild(colorInput);

    const colorDot = document.createElement('span');
    colorDot.className = 'sessionflow-inspiration-popover__color-dot';
    colorDot.style.background = this.config.chipColor || 'var(--sf-beat-color, var(--sf-session-color, var(--sf-color-primary)))';
    colorWrapper.appendChild(colorDot);

    header.appendChild(colorWrapper);

    // Close button
    const controls = document.createElement('div');
    controls.className = 'sessionflow-inspiration-popover__controls';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#closePopover();
    });
    controls.appendChild(closeBtn);

    header.appendChild(controls);

    // Drag to reposition
    header.addEventListener('pointerdown', (e) => this.#onHeaderPointerDown(e));

    this.#popoverEl.appendChild(header);
  }

  /* ---------------------------------------- */
  /*  Popover Drag                            */
  /* ---------------------------------------- */

  /** @param {PointerEvent} e */
  #onHeaderPointerDown(e) {
    // Don't drag when interacting with inputs, buttons, labels
    if (e.target.closest('input, button, label')) return;
    if (!this.#popoverEl) return;

    e.preventDefault();

    const rect = this.#popoverEl.getBoundingClientRect();
    this.#dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top
    };

    const onMove = (me) => this.#onHeaderPointerMove(me);
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this.#dragState = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  /** @param {PointerEvent} e */
  #onHeaderPointerMove(e) {
    if (!this.#dragState || !this.#popoverEl) return;

    const dx = e.clientX - this.#dragState.startX;
    const dy = e.clientY - this.#dragState.startY;

    let newLeft = this.#dragState.origLeft + dx;
    let newTop = this.#dragState.origTop + dy;

    // Clamp to viewport
    const w = this.#popoverEl.offsetWidth;
    const h = this.#popoverEl.offsetHeight;
    newLeft = Math.max(0, Math.min(window.innerWidth - w, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - h, newTop));

    this.#popoverEl.style.left = `${newLeft}px`;
    this.#popoverEl.style.top = `${newTop}px`;
  }

  /* ---------------------------------------- */
  /*  Popover Body                            */
  /* ---------------------------------------- */

  #buildPopoverBody() {
    // Remove existing body if present
    this.#popoverEl?.querySelector('.sessionflow-inspiration-popover__body')?.remove();

    const body = document.createElement('div');
    body.className = 'sessionflow-inspiration-popover__body';

    // Cards grid
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'sessionflow-inspiration-popover__cards';

    const items = this.config.items || [];
    if (items.length === 0) {
      cardsContainer.appendChild(this.#buildEmptyState());
    } else {
      items.forEach(item => {
        cardsContainer.appendChild(this.#createCardElement(item));
      });
    }

    body.appendChild(cardsContainer);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-inspiration-popover__add-btn';
    addBtn.innerHTML = `<i class="fas fa-plus"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationAdd')}</span>`;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#showAddForm(body);
    });
    body.appendChild(addBtn);

    // Add form placeholder (hidden)
    const addForm = document.createElement('div');
    addForm.className = 'sessionflow-inspiration-popover__add-form';
    addForm.style.display = 'none';
    body.appendChild(addForm);

    this.#popoverEl.appendChild(body);
  }

  /** @returns {HTMLElement} */
  #buildEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'sessionflow-inspiration-popover__empty';
    empty.innerHTML = `<i class="fas fa-lightbulb"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationEmpty')}</span>`;
    return empty;
  }

  /* ---------------------------------------- */
  /*  Pill Element                            */
  /* ---------------------------------------- */

  /**
   * @param {object} item - { id, text, icon, color }
   * @returns {HTMLElement}
   */
  #createCardElement(item) {
    const card = document.createElement('div');
    card.className = 'sessionflow-inspiration-popover__card';
    card.dataset.itemId = item.id;

    // Apply card color as CSS variable
    const color = item.color || DEFAULT_PILL_COLOR;
    card.style.setProperty('--sf-card-color', color);

    // Icon area (left side, large)
    const iconArea = document.createElement('div');
    iconArea.className = 'sessionflow-inspiration-popover__card-icon';

    if (item.icon) {
      if (isCustomImage(item.icon)) {
        const img = document.createElement('img');
        img.src = getImagePath(item.icon);
        img.className = 'sessionflow-inspiration-popover__card-icon-img';
        iconArea.appendChild(img);
      } else {
        const icon = document.createElement('i');
        icon.className = item.icon;
        iconArea.appendChild(icon);
      }
    } else {
      // Default icon when no icon set
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-sparkles';
      iconArea.appendChild(icon);
    }

    card.appendChild(iconArea);

    // Text
    const text = document.createElement('span');
    text.className = 'sessionflow-inspiration-popover__card-text';
    text.textContent = item.text;
    card.appendChild(text);

    // Actions (hover overlay, top-right)
    const actions = document.createElement('div');
    actions.className = 'sessionflow-inspiration-popover__card-actions';

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.InspirationEditItem');
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#startEditItem(item.id);
    });
    actions.appendChild(editBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'sessionflow-inspiration-popover__card-delete';
    deleteBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.InspirationDeleteItem');
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleDeleteItem(item.id);
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);

    return card;
  }

  /* ---------------------------------------- */
  /*  Presets                                 */
  /* ---------------------------------------- */

  /**
   * Build a row of preset swatches for quick icon+color selection.
   * @param {string} currentIcon - Currently selected icon class
   * @param {string} currentColor - Currently selected color hex
   * @param {(icon: string, color: string) => void} onSelect - Callback when a preset is clicked
   * @returns {HTMLElement}
   */
  #buildPresetsRow(currentIcon, currentColor, onSelect) {
    const row = document.createElement('div');
    row.className = 'sessionflow-inspiration-popover__presets';

    for (const preset of PRESETS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'sessionflow-inspiration-popover__preset';
      swatch.title = preset.label;
      swatch.style.setProperty('--sf-preset-color', preset.color);

      // Check if this preset matches current selection
      if (preset.icon === currentIcon && preset.color === currentColor) {
        swatch.classList.add('is-selected');
      }

      const icon = document.createElement('i');
      icon.className = preset.icon;
      swatch.appendChild(icon);

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update selection highlight
        row.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
        swatch.classList.add('is-selected');
        onSelect(preset.icon, preset.color);
      });

      row.appendChild(swatch);
    }

    return row;
  }

  /* ---------------------------------------- */
  /*  Add Item                                */
  /* ---------------------------------------- */

  #showAddForm(bodyEl) {
    const addForm = bodyEl.querySelector('.sessionflow-inspiration-popover__add-form');
    const addBtn = bodyEl.querySelector('.sessionflow-inspiration-popover__add-btn');

    if (!addForm || !addBtn) return;

    // Hide add button
    addBtn.style.display = 'none';

    // Build form
    addForm.innerHTML = '';

    // Row 1: text input
    const row1 = document.createElement('div');
    row1.className = 'sessionflow-inspiration-popover__form-row';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'sessionflow-inspiration-popover__form-text';
    textInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.InspirationTextPlaceholder');
    // Submit on Enter
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });
    row1.appendChild(textInput);

    addForm.appendChild(row1);

    // Row 2: icon + color + cancel + save
    const row2 = document.createElement('div');
    row2.className = 'sessionflow-inspiration-popover__form-row';

    let selectedIcon = '';

    // Icon picker button
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'sessionflow-inspiration-popover__form-icon-btn';
    iconBtn.innerHTML = `<i class="fas fa-icons"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationChooseIcon')}</span>`;
    iconBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { IconPicker } = await import('../icon-picker.js');
      const picker = new IconPicker({
        anchor: iconBtn,
        currentIcon: selectedIcon,
        onSelect: (icon) => {
          selectedIcon = icon;
          if (isCustomImage(icon)) {
            iconBtn.innerHTML = `<img src="${getImagePath(icon)}" class="sessionflow-inspiration-popover__form-icon-preview"><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationIconSelected')}</span>`;
          } else {
            iconBtn.innerHTML = `<i class="${icon}"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationIconSelected')}</span>`;
          }
          // Clear preset highlight (manual override)
          presetsRow.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
        }
      });
      picker.open();
    });
    row2.appendChild(iconBtn);

    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'sessionflow-inspiration-popover__form-color';
    colorInput.value = DEFAULT_PILL_COLOR;
    colorInput.title = game.i18n.localize('SESSIONFLOW.Canvas.InspirationPillColor');
    row2.appendChild(colorInput);

    // Presets row (between text input and controls)
    const presetsRow = this.#buildPresetsRow(selectedIcon, colorInput.value, (icon, color) => {
      selectedIcon = icon;
      colorInput.value = color;
      iconBtn.innerHTML = `<i class="${icon}"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationIconSelected')}</span>`;
    });
    addForm.appendChild(presetsRow);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'sessionflow-inspiration-popover__form-cancel';
    cancelBtn.textContent = game.i18n.localize('Cancel');
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#hideAddForm();
    });
    row2.appendChild(cancelBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sessionflow-inspiration-popover__form-save';
    saveBtn.textContent = game.i18n.localize('SESSIONFLOW.Canvas.InspirationAdd');
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      const text = textInput.value.trim();
      if (!text) {
        ui.notifications.warn(game.i18n.localize('SESSIONFLOW.Canvas.InspirationTextRequired'));
        textInput.focus();
        return;
      }

      this.#handleAddSubmit({
        text,
        icon: selectedIcon,
        color: colorInput.value
      });
    });
    row2.appendChild(saveBtn);

    addForm.appendChild(row2);

    // Show form
    addForm.style.display = '';

    // Scroll form into view and focus
    requestAnimationFrame(() => {
      addForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textInput.focus();
    });
  }

  #hideAddForm() {
    if (!this.#popoverEl) return;
    const bodyEl = this.#popoverEl.querySelector('.sessionflow-inspiration-popover__body');
    if (!bodyEl) return;

    const addForm = bodyEl.querySelector('.sessionflow-inspiration-popover__add-form');
    const addBtn = bodyEl.querySelector('.sessionflow-inspiration-popover__add-btn');

    if (addForm) {
      addForm.style.display = 'none';
      addForm.innerHTML = '';
    }
    if (addBtn) addBtn.style.display = '';
  }

  /**
   * @param {{ text: string, icon: string, color: string }} formData
   */
  #handleAddSubmit(formData) {
    const newItem = {
      id: foundry.utils.randomID(),
      text: formData.text,
      icon: formData.icon || '',
      color: formData.color || DEFAULT_PILL_COLOR
    };

    // Add to config
    if (!this.config.items) this.updateConfig({ items: [] });
    this.config.items.push(newItem);

    // Hide form
    this.#hideAddForm();

    // Rebuild popover body
    this.#buildPopoverBody();

    // Scroll to the newly added card
    requestAnimationFrame(() => {
      const card = this.#popoverEl?.querySelector(`[data-item-id="${newItem.id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // Save
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Edit Item                               */
  /* ---------------------------------------- */

  /**
   * @param {string} itemId
   */
  #startEditItem(itemId) {
    // Exit previous edit if any
    if (this.#editingItemId) {
      this.#exitEditItem(false);
    }

    this.#editingItemId = itemId;
    const item = (this.config.items || []).find(i => i.id === itemId);
    if (!item) return;

    const cardEl = this.#popoverEl?.querySelector(`[data-item-id="${itemId}"]`);
    if (!cardEl) return;

    // Build inline edit form (2-row: presets + controls)
    const form = document.createElement('div');
    form.className = 'sessionflow-inspiration-popover__edit-form';

    // Icon button (needed early for preset callback)
    let editIcon = item.icon || '';
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'sessionflow-inspiration-popover__edit-icon-btn';
    if (editIcon) {
      if (isCustomImage(editIcon)) {
        iconBtn.innerHTML = `<img src="${getImagePath(editIcon)}" class="sessionflow-inspiration-popover__edit-icon-preview">`;
      } else {
        iconBtn.innerHTML = `<i class="${editIcon}"></i>`;
      }
    } else {
      iconBtn.innerHTML = '<i class="fas fa-icons"></i>';
    }

    // Color input (needed early for preset callback)
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'sessionflow-inspiration-popover__edit-color';
    colorInput.value = item.color || DEFAULT_PILL_COLOR;

    // Presets row
    const presetsRow = this.#buildPresetsRow(editIcon, item.color || DEFAULT_PILL_COLOR, (icon, color) => {
      editIcon = icon;
      colorInput.value = color;
      iconBtn.innerHTML = `<i class="${icon}"></i>`;
    });
    form.appendChild(presetsRow);

    // Controls row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'sessionflow-inspiration-popover__edit-controls';

    // Text input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'sessionflow-inspiration-popover__edit-text';
    textInput.value = item.text;
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });
    controlsRow.appendChild(textInput);

    // Icon picker (manual override clears preset highlight)
    iconBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { IconPicker } = await import('../icon-picker.js');
      const picker = new IconPicker({
        anchor: iconBtn,
        currentIcon: editIcon,
        onSelect: (icon) => {
          editIcon = icon;
          if (isCustomImage(icon)) {
            iconBtn.innerHTML = `<img src="${getImagePath(icon)}" class="sessionflow-inspiration-popover__edit-icon-preview">`;
          } else {
            iconBtn.innerHTML = `<i class="${icon}"></i>`;
          }
          presetsRow.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
        }
      });
      picker.open();
    });
    controlsRow.appendChild(iconBtn);

    controlsRow.appendChild(colorInput);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'sessionflow-inspiration-popover__edit-cancel';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#exitEditItem(false);
    });
    controlsRow.appendChild(cancelBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sessionflow-inspiration-popover__edit-save';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      const newText = textInput.value.trim();
      if (!newText) {
        ui.notifications.warn(game.i18n.localize('SESSIONFLOW.Canvas.InspirationTextRequired'));
        textInput.focus();
        return;
      }

      item.text = newText;
      item.icon = editIcon;
      item.color = colorInput.value;

      this.#exitEditItem(true);
    });
    controlsRow.appendChild(saveBtn);

    form.appendChild(controlsRow);

    // Replace card with form
    cardEl.replaceWith(form);

    // Scroll form into view and focus
    requestAnimationFrame(() => {
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textInput.focus();
      textInput.select();
    });
  }

  /**
   * @param {boolean} save
   */
  #exitEditItem(save) {
    if (!this.#editingItemId) return;

    const itemId = this.#editingItemId;
    this.#editingItemId = null;

    const item = (this.config.items || []).find(i => i.id === itemId);
    if (!item) return;

    // Replace edit form with card
    const form = this.#popoverEl?.querySelector('.sessionflow-inspiration-popover__edit-form');
    if (form) {
      const newCard = this.#createCardElement(item);
      form.replaceWith(newCard);
    }

    if (save) {
      this.engine.scheduleSave();
    }
  }

  /* ---------------------------------------- */
  /*  Delete Item                             */
  /* ---------------------------------------- */

  /**
   * @param {string} itemId
   */
  #handleDeleteItem(itemId) {
    Dialog.confirm({
      title: game.i18n.localize('SESSIONFLOW.Canvas.InspirationDeleteItem'),
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.InspirationConfirmDelete')}</p>`,
      yes: () => {
        // Remove from config
        if (this.config.items) {
          this.config.items = this.config.items.filter(i => i.id !== itemId);
        }

        // Remove card from DOM
        const card = this.#popoverEl?.querySelector(`[data-item-id="${itemId}"]`);
        card?.remove();

        // Show empty state if needed
        const cardsContainer = this.#popoverEl?.querySelector('.sessionflow-inspiration-popover__cards');
        if (cardsContainer && (!this.config.items || this.config.items.length === 0)) {
          cardsContainer.innerHTML = '';
          cardsContainer.appendChild(this.#buildEmptyState());
        }

        // Save
        this.engine.scheduleSave();
      }
    });
  }

  /* ---------------------------------------- */
  /*  Controls                                */
  /* ---------------------------------------- */

  /**
   * @param {string} newTitle
   */
  #onTitleChange(newTitle) {
    const trimmed = newTitle.trim();
    if (trimmed === (this.config.title ?? '')) return;

    this.updateConfig({ title: trimmed });

    // Update chip title
    const chipTitle = this.element?.querySelector('.sessionflow-widget-inspiration__chip-title');
    if (chipTitle) {
      chipTitle.textContent = trimmed || game.i18n.localize('SESSIONFLOW.Canvas.Inspiration');
    }

    // Update hidden header title
    const headerTitle = this.element?.querySelector('.sessionflow-widget__title');
    if (headerTitle) {
      headerTitle.textContent = trimmed || game.i18n.localize('SESSIONFLOW.Canvas.Inspiration');
    }

    this.engine.scheduleSave();
  }

  /**
   * @param {string} color
   */
  #onChipColorChange(color) {
    this.updateConfig({ chipColor: color });

    // Update chip CSS variable
    const chip = this.element?.querySelector('.sessionflow-widget-inspiration__chip');
    if (chip) {
      chip.style.setProperty('--sf-chip-color', color);
      chip.classList.add('has-color');
    }

    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Event Handlers                          */
  /* ---------------------------------------- */

  #registerPopoverListeners() {
    // Outside click (delayed to avoid the triggering click)
    setTimeout(() => {
      this.#outsideClickHandler = (e) => this.#onOutsideClick(e);
      document.addEventListener('pointerdown', this.#outsideClickHandler, true);
    }, 50);

    // Escape key
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();

        if (this.#editingItemId) {
          this.#exitEditItem(false);
        } else {
          this.#closePopover();
        }
      }
    };
    document.addEventListener('keydown', this.#escapeHandler, true);
  }

  #cleanupPopoverListeners() {
    if (this.#outsideClickHandler) {
      document.removeEventListener('pointerdown', this.#outsideClickHandler, true);
      this.#outsideClickHandler = null;
    }
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler, true);
      this.#escapeHandler = null;
    }
  }

  /**
   * @param {PointerEvent} event
   */
  #onOutsideClick(event) {
    if (!this.#isExpanded || !this.#popoverEl) return;

    // Click inside popover → ignore
    if (this.#popoverEl.contains(event.target)) return;

    // Click inside widget → ignore
    if (this.element?.contains(event.target)) return;

    // Click inside icon picker → ignore
    if (event.target.closest('.sessionflow-icon-picker')) return;

    this.#closePopover();
  }

  /* ---------------------------------------- */
  /*  Overrides                               */
  /* ---------------------------------------- */

  beforeSave() {
    if (this.#editingItemId) {
      this.#exitEditItem(true);
    }
  }

  destroy() {
    this.beforeSave();
    this.#cleanupPopoverListeners();
    this.#popoverEl?.remove();
    this.#popoverEl = null;
    super.destroy();
  }
}

// Auto-register
registerWidgetType(InspirationWidget.TYPE, InspirationWidget);
