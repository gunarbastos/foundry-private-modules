/**
 * SessionFlow - Paragraph Widget
 * Rich text block for narrative content. Click-to-edit using Foundry's
 * built-in ProseMirror editor; view mode renders enriched HTML.
 * @module widgets/paragraph-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

export class ParagraphWidget extends Widget {

  static TYPE = 'paragraph';
  static LABEL = 'SESSIONFLOW.Canvas.Paragraph';
  static ICON = 'fas fa-paragraph';
  static MIN_WIDTH = 200;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 360;
  static DEFAULT_HEIGHT = 280;

  /** @type {boolean} */
  #isEditing = false;

  /** @type {object|null} ProseMirror editor instance */
  #proseMirrorEditor = null;

  /** @type {Function|null} Bound outside-click handler */
  #outsideClickHandler = null;

  /** @type {Function|null} Bound escape key handler */
  #escapeHandler = null;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Paragraph');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    // Guard: if called externally (e.g. refreshBody) while editing, don't destroy editor
    if (this.#isEditing && this.#proseMirrorEditor) return;

    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-paragraph';

    if (this.#isEditing) {
      this.#buildEditMode(container);
    } else {
      this.#buildViewMode(container);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  View Mode                               */
  /* ---------------------------------------- */

  #buildViewMode(container) {
    const content = this.config.content ?? '';
    const stripped = content.replace(/<[^>]*>/g, '').trim();

    if (!stripped) {
      // Placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'sessionflow-widget-paragraph__placeholder';
      placeholder.innerHTML = `<i class="fas fa-feather-pointed"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.ParagraphPlaceholder')}</span>`;
      container.appendChild(placeholder);
    } else {
      // Enriched HTML content
      const contentEl = document.createElement('div');
      contentEl.className = 'sessionflow-widget-paragraph__content';

      // Show raw content first, then enrich asynchronously
      contentEl.innerHTML = content;
      container.appendChild(contentEl);

      const TE = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;
      TE.enrichHTML(content, { async: true }).then(enriched => {
        // Guard: widget may have been destroyed or mode changed
        if (this.element && !this.#isEditing) {
          contentEl.innerHTML = enriched;
        }
      }).catch(() => {
        // Keep raw content on failure
      });
    }

    // Click to edit (GM only)
    if (game.user.isGM) {
      container.classList.add('is-editable');
      container.addEventListener('click', (e) => {
        // Don't enter edit mode if user clicked a link inside enriched content
        if (e.target.closest('a')) return;
        this.#enterEditMode();
      });
    }
  }

  /* ---------------------------------------- */
  /*  Edit Mode                               */
  /* ---------------------------------------- */

  async #buildEditMode(container) {
    // Foundry's ProseMirror expects: .editor wrapper > .editor-content target
    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'sessionflow-widget-paragraph__editor editor';

    const editorContent = document.createElement('div');
    editorContent.className = 'editor-content';
    editorWrapper.appendChild(editorContent);

    container.appendChild(editorWrapper);

    // Defer ProseMirror initialization to next frame so the DOM is attached
    requestAnimationFrame(() => this.#initProseMirror(editorContent));
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

      // Focus the editor
      this.#proseMirrorEditor.view?.focus();
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to create ProseMirror editor:`, err);
      this.#buildTextareaFallback(targetEl);
      return;
    }

    // Register outside-click handler (delayed to avoid the triggering click)
    setTimeout(() => {
      this.#outsideClickHandler = (e) => this.#onOutsideClick(e);
      document.addEventListener('pointerdown', this.#outsideClickHandler, true);
    }, 50);

    // Register escape handler
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape' && this.#isEditing) {
        e.stopPropagation();
        e.preventDefault();
        this.#exitEditMode();
      }
    };
    document.addEventListener('keydown', this.#escapeHandler, true);
  }

  /**
   * Fallback if ProseMirror is unavailable.
   */
  #buildTextareaFallback(targetEl) {
    targetEl.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.className = 'sessionflow-widget-paragraph__textarea-fallback';
    textarea.value = this.config.content ?? '';
    textarea.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.ParagraphPlaceholder');
    textarea.addEventListener('input', () => {
      this.updateConfig({ content: textarea.value });
      this.engine.scheduleSave();
    });
    targetEl.appendChild(textarea);
    textarea.focus();
  }

  /* ---------------------------------------- */
  /*  Mode Transitions                        */
  /* ---------------------------------------- */

  #enterEditMode() {
    if (this.#isEditing) return;
    this.#isEditing = true;

    // Mark widget element for transparent-frame editing state
    const widgetEl = this.element?.closest('.sessionflow-widget');
    widgetEl?.classList.add('is-editing');

    // Re-render body into edit mode
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  #exitEditMode() {
    if (!this.#isEditing) return;

    // Serialize content from ProseMirror
    if (this.#proseMirrorEditor?.view) {
      try {
        const html = foundry.prosemirror.dom.serializeString(this.#proseMirrorEditor.view.state.doc);
        this.updateConfig({ content: html });
      } catch (err) {
        console.warn(`[${MODULE_ID}] Failed to serialize ProseMirror content:`, err);
      }
    }

    // Destroy editor
    this.#destroyEditor();

    this.#isEditing = false;

    // Remove editing state from widget element
    const widgetEl = this.element?.closest('.sessionflow-widget');
    widgetEl?.classList.remove('is-editing');

    // Save and re-render into view mode
    this.engine.scheduleSave();
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  /* ---------------------------------------- */
  /*  Event Handlers                          */
  /* ---------------------------------------- */

  #onOutsideClick(event) {
    if (!this.#isEditing) return;
    if (!this.element) return;

    // If click is inside this widget, ignore
    if (this.element.contains(event.target)) return;

    // Foundry's ProseMirror renders dropdown popups as direct children of <body>
    // (e.g. #prosemirror-dropdown). Clicking them should not close the editor.
    if (event.target.closest('#prosemirror-dropdown, .pm-dropdown')) return;

    this.#exitEditMode();
  }

  /* ---------------------------------------- */
  /*  Cleanup                                 */
  /* ---------------------------------------- */

  #destroyEditor() {
    // Remove listeners
    if (this.#outsideClickHandler) {
      document.removeEventListener('pointerdown', this.#outsideClickHandler, true);
      this.#outsideClickHandler = null;
    }
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler, true);
      this.#escapeHandler = null;
    }

    // Destroy ProseMirror
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
   * Serialize ProseMirror content into config before the engine persists state.
   */
  beforeSave() {
    if (this.#isEditing && this.#proseMirrorEditor?.view) {
      try {
        const html = foundry.prosemirror.dom.serializeString(this.#proseMirrorEditor.view.state.doc);
        this.updateConfig({ content: html });
      } catch {
        // Best effort
      }
    }
  }

  destroy() {
    // Serialize any unsaved editor content before teardown
    this.beforeSave();
    this.#destroyEditor();
    super.destroy();
  }
}

// Auto-register
registerWidgetType(ParagraphWidget.TYPE, ParagraphWidget);
