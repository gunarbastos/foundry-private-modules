/**
 * SessionFlow - Teleprompter Widget
 * Compact chip on canvas; click to open a premium popover with auto-scrolling
 * teleprompter for GM narration. ProseMirror editor for content editing.
 * @module widgets/teleprompter-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

/* ---------------------------------------- */
/*  Constants                               */
/* ---------------------------------------- */

const POPOVER_WIDTH = 480;
const POPOVER_HEIGHT = 360;
const FONT_SIZE_MIN = 16;
const FONT_SIZE_MAX = 48;
const FONT_SIZE_STEP = 2;
const SCROLL_SPEED_MIN = 10;
const SCROLL_SPEED_MAX = 100;
const SCROLL_SPEED_STEP = 10;
const DEFAULT_FONT_SIZE = 24;
const DEFAULT_SCROLL_SPEED = 30;

export class TeleprompterWidget extends Widget {

  static TYPE = 'teleprompter';
  static LABEL = 'SESSIONFLOW.Canvas.Teleprompter';
  static ICON = 'fas fa-scroll';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 42;
  static DEFAULT_WIDTH = 210;
  static DEFAULT_HEIGHT = 44;

  /* -- Private state -- */

  /** @type {boolean} */
  #isExpanded = false;

  /** @type {boolean} */
  #isEditing = false;

  /** @type {HTMLElement|null} */
  #popoverEl = null;

  /** @type {object|null} ProseMirror editor instance */
  #proseMirrorEditor = null;

  /** @type {number|null} requestAnimationFrame ID */
  #scrollAnimId = null;

  /** @type {boolean} */
  #isScrolling = false;

  /** @type {Function|null} */
  #outsideClickHandler = null;

  /** @type {Function|null} */
  #escapeHandler = null;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.Teleprompter');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-teleprompter';

    const chip = document.createElement('div');
    chip.className = 'sessionflow-widget-teleprompter__chip';
    if (this.#isExpanded) chip.classList.add('is-expanded');

    // Apply custom color as CSS variable
    const chipColor = this.config.chipColor;
    if (chipColor) {
      chip.style.setProperty('--sf-chip-color', chipColor);
      chip.classList.add('has-color');
    }

    // Color dot (visible when custom color is set)
    const dot = document.createElement('span');
    dot.className = 'sessionflow-widget-teleprompter__chip-dot';
    chip.appendChild(dot);

    const icon = document.createElement('i');
    icon.className = 'fas fa-scroll';
    chip.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-teleprompter__chip-title';
    title.textContent = this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.Teleprompter');
    chip.appendChild(title);

    // Click to expand
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
    // Close any other teleprompter popover
    document.querySelectorAll('.sessionflow-teleprompter-popover').forEach(el => {
      el.remove();
    });

    this.#isExpanded = true;
    this.#isEditing = false;

    // Update chip state
    const chip = this.element?.querySelector('.sessionflow-widget-teleprompter__chip');
    chip?.classList.add('is-expanded');

    // Build popover
    this.#popoverEl = document.createElement('div');
    this.#popoverEl.className = 'sessionflow-teleprompter-popover';
    this.#popoverEl.dataset.widgetId = this.id;

    this.#buildPopoverHeader();
    this.#buildPopoverViewMode();

    document.body.appendChild(this.#popoverEl);
    this.#positionPopover();

    // Register listeners
    this.#registerPopoverListeners();
  }

  #closePopover() {
    // Stop auto-scroll
    this.#stopAutoScroll();

    // Serialize if editing
    if (this.#isEditing) {
      this.#serializeEditor();
      this.#destroyEditor();
      this.#isEditing = false;
    }

    // Cleanup listeners
    this.#cleanupPopoverListeners();

    // Remove popover
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

    // Update chip state
    const chip = this.element?.querySelector('.sessionflow-widget-teleprompter__chip');
    chip?.classList.remove('is-expanded');

    // Update chip title in case it changed
    const chipTitle = this.element?.querySelector('.sessionflow-widget-teleprompter__chip-title');
    if (chipTitle) {
      chipTitle.textContent = this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.Teleprompter');
    }

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
    header.className = 'sessionflow-teleprompter-popover__header';

    // Title input
    const titleInput = document.createElement('input');
    titleInput.className = 'sessionflow-teleprompter-popover__title-input';
    titleInput.type = 'text';
    titleInput.value = this.config.title || '';
    titleInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterTitlePlaceholder');
    titleInput.addEventListener('change', () => this.#onTitleChange(titleInput.value));
    titleInput.addEventListener('blur', () => this.#onTitleChange(titleInput.value));
    header.appendChild(titleInput);

    // Color picker (styled as a small dot)
    const colorWrapper = document.createElement('label');
    colorWrapper.className = 'sessionflow-teleprompter-popover__color-wrapper';
    colorWrapper.title = game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterColor');

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'sessionflow-teleprompter-popover__color-input';
    colorInput.value = this.config.chipColor || '#7c5cbf';
    colorInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#onColorChange(colorInput.value);
    });
    colorWrapper.appendChild(colorInput);

    const colorDot = document.createElement('span');
    colorDot.className = 'sessionflow-teleprompter-popover__color-dot';
    colorDot.style.background = this.config.chipColor || 'var(--sf-beat-color, var(--sf-session-color, var(--sf-color-primary)))';
    colorWrapper.appendChild(colorDot);

    header.appendChild(colorWrapper);

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'sessionflow-teleprompter-popover__controls';

    // Font size controls
    const fontSize = this.config.fontSize ?? DEFAULT_FONT_SIZE;

    controls.appendChild(this.#createControlBtn('fas fa-minus', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterFontDecrease'), () => this.#onFontSizeChange(-FONT_SIZE_STEP)));

    const fontLabel = document.createElement('span');
    fontLabel.className = 'sessionflow-teleprompter-popover__font-size';
    fontLabel.textContent = `${fontSize}px`;
    controls.appendChild(fontLabel);

    controls.appendChild(this.#createControlBtn('fas fa-plus', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterFontIncrease'), () => this.#onFontSizeChange(FONT_SIZE_STEP)));

    // Divider
    controls.appendChild(this.#createDivider());

    // Scroll speed controls
    const speed = this.config.scrollSpeed ?? DEFAULT_SCROLL_SPEED;

    controls.appendChild(this.#createControlBtn('fas fa-backward', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterSpeedDecrease'), () => this.#onSpeedChange(-SCROLL_SPEED_STEP)));

    const speedLabel = document.createElement('span');
    speedLabel.className = 'sessionflow-teleprompter-popover__speed-label';
    speedLabel.textContent = `${speed}`;
    controls.appendChild(speedLabel);

    controls.appendChild(this.#createControlBtn('fas fa-forward', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterSpeedIncrease'), () => this.#onSpeedChange(SCROLL_SPEED_STEP)));

    // Divider
    controls.appendChild(this.#createDivider());

    // Play/Pause
    const playBtn = this.#createControlBtn('fas fa-play', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterPlay'), () => this.#toggleAutoScroll());
    playBtn.classList.add('sessionflow-teleprompter-popover__play-btn');
    controls.appendChild(playBtn);

    // Edit
    const editBtn = this.#createControlBtn('fas fa-pen', game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterEdit'), () => {
      if (this.#isEditing) {
        this.#exitEditMode();
      } else {
        this.#enterEditMode();
      }
    });
    editBtn.classList.add('sessionflow-teleprompter-popover__edit-btn');
    controls.appendChild(editBtn);

    // Divider
    controls.appendChild(this.#createDivider());

    // Close
    controls.appendChild(this.#createControlBtn('fas fa-times', 'Close', () => this.#closePopover()));

    header.appendChild(controls);
    this.#popoverEl.appendChild(header);
  }

  /**
   * @param {string} iconClass
   * @param {string} tooltip
   * @param {Function} onClick
   * @returns {HTMLButtonElement}
   */
  #createControlBtn(iconClass, tooltip, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = tooltip;
    btn.innerHTML = `<i class="${iconClass}"></i>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  /** @returns {HTMLElement} */
  #createDivider() {
    const div = document.createElement('div');
    div.className = 'sessionflow-teleprompter-popover__divider';
    return div;
  }

  /* ---------------------------------------- */
  /*  Popover View Mode                       */
  /* ---------------------------------------- */

  #buildPopoverViewMode() {
    // Remove existing body if present
    this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__body')?.remove();

    const body = document.createElement('div');
    body.className = 'sessionflow-teleprompter-popover__body';

    const content = this.config.content ?? '';
    const stripped = content.replace(/<[^>]*>/g, '').trim();

    if (!stripped) {
      // Placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'sessionflow-teleprompter-popover__placeholder';
      placeholder.innerHTML = `
        <i class="fas fa-feather-pointed"></i>
        <span>${game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterPlaceholder')}</span>
      `;
      body.appendChild(placeholder);
    } else {
      const contentEl = document.createElement('div');
      contentEl.className = 'sessionflow-teleprompter-popover__content';
      contentEl.style.fontSize = `${this.config.fontSize ?? DEFAULT_FONT_SIZE}px`;
      contentEl.innerHTML = content;
      body.appendChild(contentEl);

      // Enrich HTML asynchronously (v13 namespaced API)
      const TE = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;
      TE.enrichHTML(content, { async: true }).then(enriched => {
        if (this.#popoverEl && !this.#isEditing) {
          contentEl.innerHTML = enriched;
        }
      }).catch(() => { /* keep raw */ });
    }

    this.#popoverEl.appendChild(body);

    // Update edit button icon
    this.#updateEditButton(false);
  }

  /* ---------------------------------------- */
  /*  Edit Mode                               */
  /* ---------------------------------------- */

  #enterEditMode() {
    if (this.#isEditing || !this.#popoverEl) return;

    // Stop auto-scroll
    this.#stopAutoScroll();

    this.#isEditing = true;
    this.#popoverEl.classList.add('is-editing');

    // Replace body with editor
    const existingBody = this.#popoverEl.querySelector('.sessionflow-teleprompter-popover__body');
    if (existingBody) existingBody.remove();

    const body = document.createElement('div');
    body.className = 'sessionflow-teleprompter-popover__body';

    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'sessionflow-teleprompter-popover__editor editor';

    const editorContent = document.createElement('div');
    editorContent.className = 'editor-content';
    editorWrapper.appendChild(editorContent);

    body.appendChild(editorWrapper);
    this.#popoverEl.appendChild(body);

    // Update edit button to save icon
    this.#updateEditButton(true);

    // Defer ProseMirror init
    requestAnimationFrame(() => this.#initProseMirror(editorContent));
  }

  #exitEditMode() {
    if (!this.#isEditing) return;

    // Serialize content
    this.#serializeEditor();

    // Destroy editor
    this.#destroyEditor();

    this.#isEditing = false;
    this.#popoverEl?.classList.remove('is-editing');

    // Rebuild view mode
    this.#buildPopoverViewMode();

    // Save
    this.engine.scheduleSave();
  }

  async #initProseMirror(targetEl) {
    if (!targetEl || !document.body.contains(targetEl)) return;

    const PMEditor = foundry.applications.ux?.ProseMirrorEditor;
    const PMMenu = foundry.prosemirror?.ProseMirrorMenu;
    const PMSchema = foundry.prosemirror?.defaultSchema;

    if (!PMEditor || !PMMenu || !PMSchema) {
      console.warn(`[${MODULE_ID}] ProseMirror not available, falling back to textarea`);
      this.#buildTextareaFallback(targetEl);
      return;
    }

    const content = this.config.content ?? '';

    try {
      this.#proseMirrorEditor = await PMEditor.create(targetEl, content, {
        plugins: {
          menu: PMMenu.build(PMSchema, {
            destroyOnSave: false,
            onSave: () => this.#exitEditMode()
          })
        }
      });

      this.#proseMirrorEditor.view?.focus();
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to create ProseMirror editor:`, err);
      this.#buildTextareaFallback(targetEl);
    }
  }

  /**
   * Fallback if ProseMirror is unavailable.
   */
  #buildTextareaFallback(targetEl) {
    targetEl.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.className = 'sessionflow-teleprompter-popover__textarea-fallback';
    textarea.value = this.config.content ?? '';
    textarea.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterPlaceholder');
    textarea.addEventListener('input', () => {
      this.updateConfig({ content: textarea.value });
      this.engine.scheduleSave();
    });
    targetEl.appendChild(textarea);
    textarea.focus();
  }

  #serializeEditor() {
    if (this.#proseMirrorEditor?.view) {
      try {
        const html = foundry.prosemirror.dom.serializeString(this.#proseMirrorEditor.view.state.doc);
        this.updateConfig({ content: html });
      } catch (err) {
        console.warn(`[${MODULE_ID}] Failed to serialize ProseMirror content:`, err);
      }
    }
  }

  #destroyEditor() {
    if (this.#proseMirrorEditor) {
      try {
        this.#proseMirrorEditor.destroy();
      } catch {
        // Ignore cleanup errors
      }
      this.#proseMirrorEditor = null;
    }
  }

  /**
   * Toggle the edit button between pen and check icon.
   * @param {boolean} editing
   */
  #updateEditButton(editing) {
    const editBtn = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__edit-btn');
    if (!editBtn) return;
    const icon = editBtn.querySelector('i');
    if (icon) {
      icon.className = editing ? 'fas fa-check' : 'fas fa-pen';
    }
    editBtn.title = editing ? 'Save' : game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterEdit');
  }

  /* ---------------------------------------- */
  /*  Auto-Scroll                             */
  /* ---------------------------------------- */

  #startAutoScroll() {
    if (this.#isScrolling || !this.#popoverEl) return;

    const scrollEl = this.#popoverEl.querySelector('.sessionflow-teleprompter-popover__body');
    if (!scrollEl) return;

    this.#isScrolling = true;

    let lastTime = performance.now();
    let accumulator = 0;

    const step = (now) => {
      if (!this.#isScrolling) return;

      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const speed = this.config.scrollSpeed ?? DEFAULT_SCROLL_SPEED;
      accumulator += speed * dt;

      // Only apply when we have at least 1 pixel accumulated
      if (accumulator >= 1) {
        const px = Math.floor(accumulator);
        accumulator -= px;
        scrollEl.scrollTop += px;
      }

      // Stop at bottom
      if (scrollEl.scrollTop >= scrollEl.scrollHeight - scrollEl.clientHeight - 1) {
        this.#stopAutoScroll();
        return;
      }

      this.#scrollAnimId = requestAnimationFrame(step);
    };

    this.#scrollAnimId = requestAnimationFrame(step);

    // Update play button
    const playBtn = this.#popoverEl.querySelector('.sessionflow-teleprompter-popover__play-btn');
    if (playBtn) {
      playBtn.classList.add('is-playing');
      const icon = playBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-pause';
      playBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterPause');
    }
  }

  #stopAutoScroll() {
    this.#isScrolling = false;
    if (this.#scrollAnimId) {
      cancelAnimationFrame(this.#scrollAnimId);
      this.#scrollAnimId = null;
    }

    // Update play button
    const playBtn = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__play-btn');
    if (playBtn) {
      playBtn.classList.remove('is-playing');
      const icon = playBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-play';
      playBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TeleprompterPlay');
    }
  }

  #toggleAutoScroll() {
    if (this.#isScrolling) {
      this.#stopAutoScroll();
    } else {
      this.#startAutoScroll();
    }
  }

  /* ---------------------------------------- */
  /*  Controls                                */
  /* ---------------------------------------- */

  #onFontSizeChange(delta) {
    const current = this.config.fontSize ?? DEFAULT_FONT_SIZE;
    const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, current + delta));
    if (next === current) return;

    this.updateConfig({ fontSize: next });

    // Update display
    const label = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__font-size');
    if (label) label.textContent = `${next}px`;

    const contentEl = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__content');
    if (contentEl) contentEl.style.fontSize = `${next}px`;

    this.engine.scheduleSave();
  }

  #onSpeedChange(delta) {
    const current = this.config.scrollSpeed ?? DEFAULT_SCROLL_SPEED;
    const next = Math.max(SCROLL_SPEED_MIN, Math.min(SCROLL_SPEED_MAX, current + delta));
    if (next === current) return;

    this.updateConfig({ scrollSpeed: next });

    // Update display
    const label = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__speed-label');
    if (label) label.textContent = `${next}`;

    this.engine.scheduleSave();
  }

  #onColorChange(color) {
    this.updateConfig({ chipColor: color });

    // Update chip dot + CSS variable
    const chip = this.element?.querySelector('.sessionflow-widget-teleprompter__chip');
    if (chip) {
      chip.style.setProperty('--sf-chip-color', color);
      chip.classList.add('has-color');
    }

    // Update popover color dot
    const popoverDot = this.#popoverEl?.querySelector('.sessionflow-teleprompter-popover__color-dot');
    if (popoverDot) popoverDot.style.background = color;

    // Update popover accent
    if (this.#popoverEl) {
      this.#popoverEl.style.setProperty('--sf-chip-color', color);
    }

    this.engine.scheduleSave();
  }

  #onTitleChange(newTitle) {
    const trimmed = newTitle.trim();
    if (trimmed === (this.config.title ?? '')) return;

    this.updateConfig({ title: trimmed });

    // Update chip title
    const chipTitle = this.element?.querySelector('.sessionflow-widget-teleprompter__chip-title');
    if (chipTitle) {
      chipTitle.textContent = trimmed || game.i18n.localize('SESSIONFLOW.Canvas.Teleprompter');
    }

    // Update hidden header title
    const headerTitle = this.element?.querySelector('.sessionflow-widget__title');
    if (headerTitle) {
      headerTitle.textContent = trimmed || game.i18n.localize('SESSIONFLOW.Canvas.Teleprompter');
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

        if (this.#isEditing) {
          this.#exitEditMode();
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

  #onOutsideClick(event) {
    if (!this.#isExpanded || !this.#popoverEl) return;

    // Click inside popover → ignore
    if (this.#popoverEl.contains(event.target)) return;

    // Click inside widget → ignore
    if (this.element?.contains(event.target)) return;

    // ProseMirror dropdown popups (rendered at body level)
    if (event.target.closest('#prosemirror-dropdown, .pm-dropdown')) return;

    this.#closePopover();
  }

  /* ---------------------------------------- */
  /*  Overrides                               */
  /* ---------------------------------------- */

  /**
   * Serialize ProseMirror content before the engine persists state.
   */
  beforeSave() {
    if (this.#isEditing && this.#proseMirrorEditor?.view) {
      this.#serializeEditor();
    }
  }

  destroy() {
    this.beforeSave();
    this.#stopAutoScroll();
    this.#destroyEditor();
    this.#cleanupPopoverListeners();
    this.#popoverEl?.remove();
    this.#popoverEl = null;
    super.destroy();
  }
}

// Auto-register
registerWidgetType(TeleprompterWidget.TYPE, TeleprompterWidget);
