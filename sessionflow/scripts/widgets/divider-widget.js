/**
 * SessionFlow - Divider Widget
 * Decorative line separator for visually organizing the canvas.
 * Supports horizontal/vertical orientation, multiple line styles, and custom color.
 * @module widgets/divider-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const STYLE_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'double', label: 'Double' },
  { id: 'ornamental', label: 'Ornamental' },
  { id: 'fade', label: 'Fade' }
];

export class DividerWidget extends Widget {

  static TYPE = 'divider';
  static LABEL = 'SESSIONFLOW.Canvas.Divider';
  static ICON = 'fas fa-grip-lines';
  static MIN_WIDTH = 40;
  static MIN_HEIGHT = 16;
  static DEFAULT_WIDTH = 300;
  static DEFAULT_HEIGHT = 20;

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  #getOrientation() {
    return this.config.orientation ?? 'horizontal';
  }

  #getStyle() {
    return this.config.style ?? 'solid';
  }

  #getColor() {
    return this.config.color ?? '';
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Divider');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const orientation = this.#getOrientation();
    const style = this.#getStyle();
    const color = this.#getColor();

    const container = document.createElement('div');
    container.className = `sessionflow-widget-divider sessionflow-widget-divider--${orientation} sessionflow-widget-divider--${style}`;

    // Set custom color via CSS variable
    if (color) {
      container.style.setProperty('--sf-divider-color', color);
    }

    // The line element
    const line = document.createElement('div');
    line.className = 'sessionflow-widget-divider__line';
    container.appendChild(line);

    // Controls overlay (GM only)
    if (game.user.isGM) {
      container.appendChild(this.#buildControls(style, orientation, color));
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Controls                                */
  /* ---------------------------------------- */

  #buildControls(currentStyle, currentOrientation, currentColor) {
    const controls = document.createElement('div');
    controls.className = 'sessionflow-widget-divider__controls';
    controls.style.setProperty(
      '--sf-divider-preview-color',
      currentColor || 'var(--sf-beat-color, var(--sf-session-color, var(--sf-color-primary)))'
    );

    const styleGroup = document.createElement('div');
    styleGroup.className = 'sessionflow-widget-divider__style-group';

    for (const option of STYLE_OPTIONS) {
      const styleBtn = document.createElement('button');
      styleBtn.className = 'sessionflow-widget-divider__style-option';
      styleBtn.type = 'button';
      styleBtn.title = option.label;
      if (option.id === currentStyle) styleBtn.classList.add('is-active');
      styleBtn.innerHTML = `<span class="sessionflow-widget-divider__style-preview sessionflow-widget-divider__style-preview--${option.id}"></span>`;
      styleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#setStyle(option.id);
      });
      styleGroup.appendChild(styleBtn);
    }

    controls.appendChild(styleGroup);

    // Toggle orientation button
    const orientBtn = document.createElement('button');
    orientBtn.className = 'sessionflow-widget-divider__orient-btn';
    orientBtn.type = 'button';
    orientBtn.title = currentOrientation === 'horizontal' ? 'Switch to vertical' : 'Switch to horizontal';
    orientBtn.innerHTML = `<i class="fas ${currentOrientation === 'horizontal' ? 'fa-arrows-up-down' : 'fa-arrows-left-right'}"></i>`;
    orientBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleOrientation();
    });
    controls.appendChild(orientBtn);

    // Color picker
    const colorWrapper = document.createElement('label');
    colorWrapper.className = 'sessionflow-widget-divider__color-wrapper';
    colorWrapper.title = 'Divider color';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'sessionflow-widget-divider__color-input';
    colorInput.value = currentColor || '#888888';
    colorInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#applyColor(e.target.value, colorDot, controls);
    });
    colorInput.addEventListener('change', (e) => {
      e.stopPropagation();
      this.#applyColor(e.target.value, colorDot, controls);
    });

    const colorDot = document.createElement('span');
    colorDot.className = 'sessionflow-widget-divider__color-dot';
    colorDot.style.background = currentColor || 'var(--sf-beat-color, var(--sf-session-color, var(--sf-color-primary)))';

    colorWrapper.appendChild(colorInput);
    colorWrapper.appendChild(colorDot);
    controls.appendChild(colorWrapper);

    return controls;
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #setStyle(style) {
    if (style === this.#getStyle()) return;
    this.updateConfig({ style });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #toggleOrientation() {
    const current = this.#getOrientation();
    const next = current === 'horizontal' ? 'vertical' : 'horizontal';

    // Swap width and height
    const w = this.width;
    const h = this.height;
    this.updateSize(h, w);

    this.updateConfig({ orientation: next });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #applyColor(color, dotEl, controlsEl) {
    this.updateConfig({ color });
    this.engine.scheduleSave();

    dotEl.style.background = color;
    controlsEl.style.setProperty('--sf-divider-preview-color', color);

    const container = this.element?.querySelector('.sessionflow-widget-divider');
    if (container) {
      container.style.setProperty('--sf-divider-color', color);
    }
  }

  /* ---------------------------------------- */
  /*  Resize hook                             */
  /* ---------------------------------------- */

  onResize(width, height) {
    // Clamp the perpendicular dimension to keep the divider thin
    const orientation = this.#getOrientation();
    if (orientation === 'horizontal' && height > 40) {
      this.updateSize(width, 20);
    } else if (orientation === 'vertical' && width > 40) {
      this.updateSize(20, height);
    }
  }

  /* ---------------------------------------- */
  /*  Re-render helper                        */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }
}

// Auto-register
registerWidgetType(DividerWidget.TYPE, DividerWidget);
