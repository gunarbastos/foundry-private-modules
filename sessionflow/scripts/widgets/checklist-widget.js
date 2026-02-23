/**
 * SessionFlow - Checklist Widget (Scene Beats)
 * A checklist of narrative beats for tracking scene progress.
 * Visible body on canvas, inline editing, drag-to-reorder, progress bar.
 * @module widgets/checklist-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

export class ChecklistWidget extends Widget {

  static TYPE = 'checklist';
  static LABEL = 'SESSIONFLOW.Canvas.Checklist';
  static ICON = 'fas fa-list-check';
  static MIN_WIDTH = 200;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 280;
  static DEFAULT_HEIGHT = 300;

  /** @type {string|null} ID of the item currently being edited inline */
  #editingItemId = null;

  /** @type {string|null} ID of the item currently being dragged */
  #draggedItemId = null;

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  /** @returns {{ id: string, text: string, checked: boolean, order: number }[]} */
  #getItems() {
    return [...(this.config.items ?? [])].sort((a, b) => a.order - b.order);
  }

  #getProgress() {
    const items = this.config.items ?? [];
    const total = items.length;
    const checked = items.filter(i => i.checked).length;
    return { checked, total, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Checklist');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-checklist';

    // Progress bar
    this.#buildProgress(container);

    // Items list
    this.#buildItems(container);

    // Add form (GM only)
    if (game.user.isGM) {
      this.#buildAddForm(container);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Progress Bar                            */
  /* ---------------------------------------- */

  #buildProgress(container) {
    const { checked, total, pct } = this.#getProgress();
    if (total === 0) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-checklist__progress';

    const bar = document.createElement('div');
    bar.className = 'sessionflow-widget-checklist__progress-bar';

    const fill = document.createElement('div');
    fill.className = 'sessionflow-widget-checklist__progress-fill';
    if (pct >= 100) fill.classList.add('is-complete');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const text = document.createElement('span');
    text.className = 'sessionflow-widget-checklist__progress-text';
    text.textContent = `${checked} / ${total}`;
    if (pct >= 100) text.classList.add('is-complete');

    wrapper.appendChild(bar);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
  }

  /* ---------------------------------------- */
  /*  Items List                              */
  /* ---------------------------------------- */

  #buildItems(container) {
    const items = this.#getItems();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-checklist__items';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-checklist__empty';
      empty.innerHTML = `<i class="fas fa-list-check"></i>`;
      list.appendChild(empty);
    }

    for (const item of items) {
      if (this.#editingItemId === item.id) {
        list.appendChild(this.#buildEditItem(item));
      } else {
        list.appendChild(this.#buildItem(item));
      }
    }

    container.appendChild(list);
  }

  /**
   * Build a single checklist item row.
   * @param {{ id: string, text: string, checked: boolean, order: number }} item
   * @returns {HTMLElement}
   */
  #buildItem(item) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-checklist__item';
    if (item.checked) row.classList.add('is-checked');
    row.dataset.itemId = item.id;

    // Drag handle (GM only)
    if (game.user.isGM) {
      row.draggable = true;
      const handle = document.createElement('span');
      handle.className = 'sessionflow-widget-checklist__drag-handle';
      handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      row.appendChild(handle);

      // Drag events
      row.addEventListener('dragstart', (e) => this.#onDragStart(e, item.id));
      row.addEventListener('dragend', () => this.#onDragEnd());
    }

    // Checkbox
    const label = document.createElement('label');
    label.className = 'sessionflow-widget-checklist__checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.checked;
    checkbox.addEventListener('change', () => this.#toggleItem(item.id));
    const checkmark = document.createElement('span');
    checkmark.className = 'sessionflow-widget-checklist__checkmark';
    label.appendChild(checkbox);
    label.appendChild(checkmark);
    row.appendChild(label);

    // Text
    const textEl = document.createElement('span');
    textEl.className = 'sessionflow-widget-checklist__text';
    textEl.textContent = item.text;
    row.appendChild(textEl);

    // Actions (GM only)
    if (game.user.isGM) {
      // Double-click to edit
      textEl.addEventListener('dblclick', () => this.#startEdit(item.id));

      const actions = document.createElement('div');
      actions.className = 'sessionflow-widget-checklist__item-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'sessionflow-widget-checklist__edit-btn';
      editBtn.type = 'button';
      editBtn.innerHTML = '<i class="fas fa-pen"></i>';
      editBtn.addEventListener('click', () => this.#startEdit(item.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'sessionflow-widget-checklist__delete-btn';
      deleteBtn.type = 'button';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.addEventListener('click', () => this.#deleteItem(item.id));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);
    }

    // Drop target
    row.addEventListener('dragover', (e) => this.#onDragOver(e, row));
    row.addEventListener('dragleave', (e) => this.#onDragLeave(e, row));
    row.addEventListener('drop', (e) => this.#onDrop(e, item.id));

    return row;
  }

  /**
   * Build an inline edit row for a checklist item.
   * @param {{ id: string, text: string }} item
   * @returns {HTMLElement}
   */
  #buildEditItem(item) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-checklist__item is-editing';
    row.dataset.itemId = item.id;

    const input = document.createElement('input');
    input.className = 'sessionflow-widget-checklist__edit-input';
    input.type = 'text';
    input.value = item.text;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sessionflow-widget-checklist__save-btn';
    saveBtn.type = 'button';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'sessionflow-widget-checklist__cancel-btn';
    cancelBtn.type = 'button';
    cancelBtn.innerHTML = '<i class="fas fa-xmark"></i>';

    const confirmEdit = () => {
      const text = input.value.trim();
      if (text) this.#saveEdit(item.id, text);
      else this.#cancelEdit();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); this.#cancelEdit(); }
    });
    saveBtn.addEventListener('click', confirmEdit);
    cancelBtn.addEventListener('click', () => this.#cancelEdit());

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);

    // Auto-focus
    requestAnimationFrame(() => { input.focus(); input.select(); });

    return row;
  }

  /* ---------------------------------------- */
  /*  Add Form                                */
  /* ---------------------------------------- */

  #buildAddForm(container) {
    const form = document.createElement('div');
    form.className = 'sessionflow-widget-checklist__add-form';

    const input = document.createElement('input');
    input.className = 'sessionflow-widget-checklist__add-input';
    input.type = 'text';
    input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.ChecklistAdd');

    const btn = document.createElement('button');
    btn.className = 'sessionflow-widget-checklist__add-btn';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-plus"></i>';

    const addItem = () => {
      const text = input.value.trim();
      if (!text) return;
      this.#addItem(text);
      input.value = '';
      input.focus();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    });
    btn.addEventListener('click', addItem);

    form.appendChild(input);
    form.appendChild(btn);
    container.appendChild(form);
  }

  /* ---------------------------------------- */
  /*  Item CRUD                               */
  /* ---------------------------------------- */

  #addItem(text) {
    const items = [...(this.config.items ?? [])];
    items.push({
      id: foundry.utils.randomID(),
      text,
      checked: false,
      order: items.length
    });
    this.updateConfig({ items });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #toggleItem(id) {
    const items = [...(this.config.items ?? [])];
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.checked = !item.checked;
    this.updateConfig({ items });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #deleteItem(id) {
    let items = [...(this.config.items ?? [])].filter(i => i.id !== id);
    // Recompute order
    items.sort((a, b) => a.order - b.order);
    items.forEach((item, idx) => item.order = idx);
    this.updateConfig({ items });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #startEdit(id) {
    this.#editingItemId = id;
    this.#rerender();
  }

  #saveEdit(id, text) {
    const items = [...(this.config.items ?? [])];
    const item = items.find(i => i.id === id);
    if (item) item.text = text;
    this.updateConfig({ items });
    this.engine.scheduleSave();
    this.#editingItemId = null;
    this.#rerender();
  }

  #cancelEdit() {
    this.#editingItemId = null;
    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  Drag-to-Reorder                         */
  /* ---------------------------------------- */

  #onDragStart(event, itemId) {
    this.#draggedItemId = itemId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    // Make the dragged row semi-transparent
    requestAnimationFrame(() => {
      const row = this.element?.querySelector(`[data-item-id="${itemId}"]`);
      row?.classList.add('is-dragging');
    });
  }

  #onDragEnd() {
    this.#draggedItemId = null;
    // Remove all drag visual states
    this.element?.querySelectorAll('.is-dragging, .drag-over').forEach(el => {
      el.classList.remove('is-dragging', 'drag-over');
    });
  }

  #onDragOver(event, row) {
    if (!this.#draggedItemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // Add visual indicator
    row.classList.add('drag-over');
  }

  #onDragLeave(event, row) {
    // Only remove if actually leaving the row (not entering a child)
    if (row.contains(event.relatedTarget)) return;
    row.classList.remove('drag-over');
  }

  #onDrop(event, targetId) {
    event.preventDefault();
    if (!this.#draggedItemId || this.#draggedItemId === targetId) return;

    const items = this.#getItems(); // sorted by order
    const dragIdx = items.findIndex(i => i.id === this.#draggedItemId);
    const dropIdx = items.findIndex(i => i.id === targetId);
    if (dragIdx === -1 || dropIdx === -1) return;

    // Move item from dragIdx to dropIdx
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, moved);

    // Recompute order
    items.forEach((item, idx) => item.order = idx);

    this.updateConfig({ items });
    this.engine.scheduleSave();
    this.#draggedItemId = null;
    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  Re-render helper                        */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  destroy() {
    super.destroy();
  }
}

// Auto-register
registerWidgetType(ChecklistWidget.TYPE, ChecklistWidget);
