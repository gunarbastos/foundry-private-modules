/**
 * SessionFlow - Sticky Note Widget (Quick Notes)
 * Lightweight post-it style notes on the canvas. Plain textarea, no ProseMirror.
 * Predefined color palette, always-editable, multiple per canvas.
 * @module widgets/sticky-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

/** Post-it color palette */
const STICKY_COLORS = [
  { bg: '#FEF3C7', border: '#F59E0B', name: 'Yellow' },
  { bg: '#FCE7F3', border: '#EC4899', name: 'Pink' },
  { bg: '#DBEAFE', border: '#3B82F6', name: 'Blue' },
  { bg: '#D1FAE5', border: '#10B981', name: 'Green' },
  { bg: '#FFEDD5', border: '#F97316', name: 'Orange' },
  { bg: '#EDE9FE', border: '#8B5CF6', name: 'Purple' }
];

export class StickyWidget extends Widget {

  static TYPE = 'sticky';
  static LABEL = 'SESSIONFLOW.Canvas.Sticky';
  static ICON = 'fas fa-note-sticky';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 100;
  static DEFAULT_WIDTH = 220;
  static DEFAULT_HEIGHT = 180;

  /** @type {number|null} Debounce timer for text saves */
  #saveTimer = null;

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  /** @returns {{ bg: string, border: string, name: string }} */
  #getColor() {
    const idx = this.config.colorIndex ?? 0;
    return STICKY_COLORS[idx] ?? STICKY_COLORS[0];
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Sticky');
  }

  /** @override */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const color = this.#getColor();
    this.element?.style.setProperty('--sf-sticky-bg', color.bg);
    this.element?.style.setProperty('--sf-sticky-border', color.border);

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-sticky';

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'sessionflow-widget-sticky__text';
    textarea.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.Sticky') + '...';
    textarea.setAttribute('aria-label', game.i18n.localize('SESSIONFLOW.Canvas.Sticky'));
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocapitalize', 'off');
    textarea.setAttribute('data-gramm', 'false');
    textarea.setAttribute('data-enable-grammarly', 'false');
    textarea.spellcheck = false;
    textarea.value = this.config.text ?? '';
    textarea.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#onTextInput(e.target.value);
    });
    container.appendChild(textarea);
    container.appendChild(this.#buildColorFooter());

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Color Dots                              */
  /* ---------------------------------------- */

  #buildColorFooter() {
    const footer = document.createElement('div');
    footer.className = 'sessionflow-widget-sticky__footer';

    const dots = document.createElement('div');
    dots.className = 'sessionflow-widget-sticky__colors';

    const currentIdx = this.config.colorIndex ?? 0;

    STICKY_COLORS.forEach((color, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'sessionflow-widget-sticky__color-dot';
      if (idx === currentIdx) dot.classList.add('is-active');
      dot.setAttribute('aria-label', color.name);
      dot.setAttribute('aria-pressed', idx === currentIdx ? 'true' : 'false');
      dot.style.background = color.border;
      dot.title = color.name;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#setColor(idx);
      });
      dots.appendChild(dot);
    });

    footer.appendChild(dots);
    return footer;
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #onTextInput(text) {
    this.updateConfig({ text });

    // Debounced save (500ms)
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.engine.scheduleSave();
      this.#saveTimer = null;
    }, 500);
  }

  #setColor(idx) {
    this.updateConfig({ colorIndex: idx });
    this.engine.scheduleSave();

    // Update CSS vars without full re-render (preserve textarea focus/selection)
    const color = STICKY_COLORS[idx] ?? STICKY_COLORS[0];
    this.element?.style.setProperty('--sf-sticky-bg', color.bg);
    this.element?.style.setProperty('--sf-sticky-border', color.border);
    const container = this.element?.querySelector('.sessionflow-widget-sticky');
    if (container) {
      container.style.setProperty('--sf-sticky-bg', color.bg);
      container.style.setProperty('--sf-sticky-border', color.border);
    }

    // Update active dot
    const dots = this.element?.querySelectorAll('.sessionflow-widget-sticky__color-dot');
    dots?.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === idx);
      dot.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
    });
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    // Snapshot current textarea value into config
    const textarea = this.element?.querySelector('.sessionflow-widget-sticky__text');
    if (textarea) {
      this.updateConfig({ text: textarea.value });
    }
  }

  /** @override */
  destroy() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    super.destroy();
  }
}

// Self-register
registerWidgetType(StickyWidget.TYPE, StickyWidget);
