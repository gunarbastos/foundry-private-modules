/**
 * @file LayoutCalculator.js
 * @description Handler for layout calculations and Foundry UI offset management.
 * Calculates positions for cast members and prevents overlap with Foundry VTT's
 * sidebar and control elements.
 *
 * Responsibilities:
 * - Calculate Foundry UI offsets (sidebar, controls)
 * - Provide size value calculations for layout presets
 * - Prepare layout context for templates
 *
 * @module player-view/LayoutCalculator
 */

import { BaseHandler } from './BaseHandler.js';

/**
 * Handler for layout calculations and positioning.
 * Manages Foundry UI offsets and cast member positioning.
 *
 * @extends BaseHandler
 */
export class LayoutCalculator extends BaseHandler {
  /**
   * Sets up the layout calculator and applies Foundry UI offsets.
   * Called during view render.
   *
   * @param {HTMLElement} element - The view's root element
   * @override
   */
  setup(element) {
    super.setup(element);

    // Calculate and set Foundry UI offset CSS variables
    this.setFoundryUIOffsets();

    // Listen for sidebar collapse/expand to recalculate offsets
    this._setupSidebarObserver();
  }

  /**
   * Cleanup observer and event listeners.
   * @override
   */
  cleanup() {
    if (this._sidebarObserver) {
      this._sidebarObserver.disconnect();
      this._sidebarObserver = null;
    }
    super.cleanup();
  }

  /* ═══════════════════════════════════════════════════════════════
     FOUNDRY UI OFFSET CALCULATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Calculate Foundry VTT UI element widths and set CSS variables.
   * This prevents cast layouts from overlapping with Foundry's sidebar/controls.
   *
   * Sets the following CSS variables on the root element:
   * - --foundry-left-offset: Width of left controls + padding
   * - --foundry-right-offset: Width of sidebar (if expanded) + padding
   */
  setFoundryUIOffsets() {
    const root = this.element;
    if (!root) return;

    // Calculate left offset (scene controls width)
    // In FoundryVTT, the left controls (#controls) is typically 50-60px wide
    let leftOffset = 10; // Minimal padding
    const controls = document.getElementById('controls');

    if (controls) {
      const controlsRect = controls.getBoundingClientRect();
      // Use the WIDTH of controls, not position
      if (controlsRect.width > 0) {
        leftOffset = controlsRect.width + 15;
      }
    }

    // Calculate right offset (sidebar)
    let rightOffset = 0;
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (sidebarRect.width > 0) {
        rightOffset = sidebarRect.width + 15;
      }
    }

    // Set CSS variables on the root element
    root.style.setProperty('--foundry-left-offset', `${leftOffset}px`);
    root.style.setProperty('--foundry-right-offset', `${rightOffset}px`);
  }

  /**
   * Sets up a MutationObserver to watch for sidebar collapse/expand.
   * Recalculates offsets when sidebar state changes.
   * @private
   */
  _setupSidebarObserver() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    this._sidebarObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Sidebar collapsed/expanded - recalculate offsets
          this.setFoundryUIOffsets();
        }
      }
    });

    this._sidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SIZE VALUE CALCULATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the CSS value for a size preset or custom value.
   *
   * @param {string|number} size - Size preset key (e.g., 'small', 'medium', 'large') or custom vh value
   * @returns {string} CSS value (e.g., '18vh')
   */
  getSizeValue(size) {
    const preset = this.config.SIZE_PRESETS[size];
    if (preset) return preset.value;

    // If it's a number, assume vh units
    if (typeof size === 'number') return `${size}vh`;

    // If it already has units, use as-is
    if (typeof size === 'string' && size.match(/^\d+/)) return size;

    // Default fallback
    return this.config.SIZE_PRESETS.medium.value;
  }

  /* ═══════════════════════════════════════════════════════════════
     LAYOUT CONTEXT PREPARATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Prepare layout context for the template.
   * Creates CSS-ready layout settings based on scene or cast-only mode settings.
   *
   * @param {Object} scene - The current scene object (optional)
   * @returns {Object} Layout context with preset, size, spacing, and offsets
   */
  prepareLayoutContext(scene = null) {
    // In cast-only mode, use castOnlyLayoutSettings
    const layoutSettings = this.uiState.castOnlyMode && this.uiState.castOnlyLayoutSettings
      ? this.uiState.castOnlyLayoutSettings
      : (scene?.layoutSettings || this.config.DEFAULT_LAYOUT);

    return {
      preset: layoutSettings.preset || 'bottom-center',
      size: this.getSizeValue(layoutSettings.size),
      spacing: layoutSettings.spacing || 24,
      offsetX: layoutSettings.offsetX || 0,
      offsetY: layoutSettings.offsetY || 5
    };
  }

  /**
   * Get the current Foundry UI offsets.
   * Useful for external calculations that need to account for Foundry's UI.
   *
   * @returns {Object} Object with leftOffset and rightOffset values in pixels
   */
  getFoundryOffsets() {
    let leftOffset = 10;
    let rightOffset = 0;

    const controls = document.getElementById('controls');
    if (controls) {
      const controlsRect = controls.getBoundingClientRect();
      if (controlsRect.width > 0) {
        leftOffset = controlsRect.width + 15;
      }
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (sidebarRect.width > 0) {
        rightOffset = sidebarRect.width + 15;
      }
    }

    return { leftOffset, rightOffset };
  }

  /**
   * Calculate available width for cast positioning.
   * Takes into account Foundry UI elements.
   *
   * @returns {number} Available width in pixels
   */
  getAvailableWidth() {
    const { leftOffset, rightOffset } = this.getFoundryOffsets();
    return window.innerWidth - leftOffset - rightOffset;
  }
}
