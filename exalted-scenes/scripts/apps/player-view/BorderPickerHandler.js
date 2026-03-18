/**
 * @file BorderPickerHandler.js
 * @description Handles border picker functionality for the PlayerView.
 * Manages border style selection UI and context preparation.
 *
 * Note: The actual action handlers (open-border-picker, close-border-picker,
 * back-to-emotions, select-effect, select-border-color, select-border-color2)
 * remain in PlayerView.js as they are static ApplicationV2 action handlers.
 *
 * @module player-view/BorderPickerHandler
 */

import { BaseHandler } from './BaseHandler.js';
import { borderStyleToInline } from '../../utils/border-utils.js';

/**
 * Handles border picker UI logic for the PlayerView.
 * Manages the border style selection interface that allows players
 * to customize character portrait borders.
 *
 * @extends BaseHandler
 */
export class BorderPickerHandler extends BaseHandler {
  /**
   * Sets up the border picker behavior.
   * Currently no dynamic setup is needed as all interactions are
   * handled through ApplicationV2 static actions.
   *
   * @param {HTMLElement} element - The view's root element
   * @override
   */
  setup(element) {
    super.setup(element);

    /** @type {{ effect: string, cssText: string }|null} Stored original state for hover preview revert */
    this._previewOriginal = null;

    // Custom color input listeners for live preview
    const colorInputs = element.querySelectorAll('.es-border-color-input');
    for (const input of colorInputs) {
      const target = input.dataset.target; // 'color1' or 'color2'

      // Live preview on input (local-only, no socket)
      input.addEventListener('input', (e) => {
        const charId = this.uiState.borderPicker.characterId;
        if (!charId) return;

        const charEl = element.querySelector(`.es-pv-character[data-id="${charId}"]`);
        const portrait = charEl?.querySelector('.es-pv-portrait');
        if (!portrait) return;

        const currentBorder = { ...this.getPickerBorderStyle(charId) };
        if (target === 'color2') {
          currentBorder.color2 = e.target.value;
        } else {
          currentBorder.color = e.target.value;
        }

        const normalized = this.setPickerBorderStyle(currentBorder);
        this._applyPreviewToPortrait(portrait, normalized);
      });

      // Final commit on change (socket emit)
      input.addEventListener('change', (e) => {
        const charId = this.uiState.borderPicker.characterId;
        if (!charId) return;

        const currentBorder = { ...this.getPickerBorderStyle(charId) };
        if (target === 'color2') {
          currentBorder.color2 = e.target.value;
        } else {
          currentBorder.color = e.target.value;
        }

        const normalized = this.setPickerBorderStyle(currentBorder);
        this.view.constructor._applyLocalBorderUpdate(charId, normalized);

        import('../../data/SocketHandler.js').then(({ SocketHandler }) => {
          SocketHandler.emitUpdateBorder(charId, normalized);
        }).catch(err => console.error('Exalted Scenes | Failed to load SocketHandler:', err));
      });
    }

    // Live preview on hover — effects
    this._setupEffectHoverPreview(element);

    // Live preview on hover — color swatches
    this._setupSwatchHoverPreview(element);

    this.syncPickerUi();
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTEXT PREPARATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Prepares the border picker context for template rendering.
   * Organizes effects and color swatches for the new effect+color picker UI.
   *
   * @returns {Object|null} Border picker context object, or null if picker is closed
   */
  prepareBorderPickerContext() {
    const { borderPicker } = this.uiState;

    // Return null if picker is not open or no character selected
    if (!borderPicker.open || !borderPicker.characterId) {
      return null;
    }

    const char = this.getCharacter(borderPicker.characterId);
    if (!char) {
      return null;
    }

    const currentBorder = this.getPickerBorderStyle(borderPicker.characterId);

    // Build effects list
    const effects = Object.entries(this.config.BORDER_EFFECTS).map(([key, effect]) => ({
      key,
      name: effect.name,
      icon: effect.icon,
      animated: effect.animated,
      colorCount: effect.colorCount,
      active: currentBorder.effect === key
    }));

    // Build color swatches (separate arrays for color1 and color2 active states)
    const swatches = Object.entries(this.config.BORDER_COLORS).map(([key, hex]) => ({
      key,
      hex,
      active: currentBorder.color === hex
    }));

    const swatches2 = Object.entries(this.config.BORDER_COLORS).map(([key, hex]) => ({
      key,
      hex,
      active: currentBorder.color2 === hex
    }));

    const currentEffect = this.config.BORDER_EFFECTS[currentBorder.effect];
    const currentAccent = currentBorder.color || currentBorder.color2 || this.config.BORDER_DEFAULT.color;

    return {
      character: char,
      effects,
      swatches,
      swatches2,
      previewBorder: currentBorder,
      currentEffect: currentBorder.effect,
      activeEffectName: currentEffect?.name || this.config.BORDER_EFFECTS[this.config.BORDER_DEFAULT.effect]?.name,
      activeEffectIcon: currentEffect?.icon || this.config.BORDER_EFFECTS[this.config.BORDER_DEFAULT.effect]?.icon,
      currentColor: currentBorder.color || this.config.BORDER_DEFAULT.color,
      currentColor2: currentBorder.color2 || this.config.BORDER_DEFAULT.color,
      currentAccent,
      currentAccentRgb: this._hexToRgb(currentAccent),
      showColor2: currentEffect?.colorCount === 2,
      noColor: currentEffect?.colorCount === 0,
      x: borderPicker.x,
      y: borderPicker.y,
      pickerBelow: borderPicker.pickerBelow || false
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     LIVE PREVIEW ON HOVER
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up hover preview for effect options.
   * Hovering an effect temporarily applies it to the character portrait.
   *
   * @param {HTMLElement} element - The view's root element
   * @private
   */
  _setupEffectHoverPreview(element) {
    const effectOptions = element.querySelectorAll('.es-border-effect-option');

    for (const option of effectOptions) {
      option.addEventListener('mouseenter', () => {
        const portrait = this._getPickerPortrait(element);
        if (!portrait) return;

        this._storeOriginal(portrait);

        const effectKey = option.dataset.effect;
        const currentBorder = { ...this.getPickerBorderStyle() };
        currentBorder.effect = effectKey;

        // Adjust colors for preview
        this._applyPreviewToPortrait(portrait, this._normalizeBorderStyle(currentBorder));
      }, { signal: this.signal });

      option.addEventListener('mouseleave', () => {
        this._revertPreview(element);
      }, { signal: this.signal });
    }
  }

  /**
   * Sets up hover preview for color swatches.
   * Hovering a swatch temporarily applies the color to the character portrait.
   *
   * @param {HTMLElement} element - The view's root element
   * @private
   */
  _setupSwatchHoverPreview(element) {
    const swatches = element.querySelectorAll('.es-border-picker .es-border-swatch');

    for (const swatch of swatches) {
      swatch.addEventListener('mouseenter', () => {
        const portrait = this._getPickerPortrait(element);
        if (!portrait) return;

        this._storeOriginal(portrait);

        const currentBorder = { ...this.getPickerBorderStyle() };
        const color = swatch.dataset.color;
        const isColor2 = swatch.dataset.action === 'select-border-color2';

        if (isColor2) {
          currentBorder.color2 = color;
        } else {
          currentBorder.color = color;
        }

        this._applyPreviewToPortrait(portrait, this._normalizeBorderStyle(currentBorder));
      }, { signal: this.signal });

      swatch.addEventListener('mouseleave', () => {
        this._revertPreview(element);
      }, { signal: this.signal });
    }
  }

  /**
   * Gets the portrait element for the character currently in the border picker.
   *
   * @param {HTMLElement} element - The view's root element
   * @returns {HTMLElement|null} The portrait element
   * @private
   */
  _getPickerPortrait(element) {
    const charId = this.uiState.borderPicker?.characterId;
    if (!charId) return null;
    const charEl = element.querySelector(`.es-pv-character[data-id="${charId}"]`);
    return charEl?.querySelector('.es-pv-portrait') || null;
  }

  /**
   * Stores the portrait's original border state for later revert.
   * Only stores on first call (doesn't overwrite during drag/multi-hover).
   *
   * @param {HTMLElement} portrait - The portrait element
   * @private
   */
  _storeOriginal(portrait) {
    if (!this._previewOriginal) {
      this._previewOriginal = {
        effect: portrait.dataset.effect,
        cssText: portrait.style.cssText
      };
    }
  }

  /**
   * Applies a border style to the portrait as a temporary preview.
   *
   * @param {HTMLElement} portrait - The portrait element
   * @param {Object} borderStyle - The border style to preview
   * @private
   */
  _applyPreviewToPortrait(portrait, borderStyle) {
    portrait.dataset.effect = borderStyle.effect || this.config.BORDER_DEFAULT.effect;
    const inlineStyle = borderStyleToInline(borderStyle);
    const existing = portrait.style.cssText.replace(/--es-border[^;]*;?\s*/g, '');
    portrait.style.cssText = existing + (existing && inlineStyle ? '; ' : '') + inlineStyle;
  }

  /**
   * Reverts the portrait to its original state before hover preview.
   *
   * @param {HTMLElement} element - The view's root element
   * @private
   */
  _revertPreview(element) {
    if (!this._previewOriginal) return;
    const portrait = this._getPickerPortrait(element);
    if (portrait) {
      portrait.dataset.effect = this._previewOriginal.effect;
      portrait.style.cssText = this._previewOriginal.cssText;
    }
    this._previewOriginal = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Gets the currently selected border style for a character.
   *
   * @param {string} characterId - The character ID
   * @returns {Object} The border style object { effect, color?, color2? }
   */
  getCurrentBorderStyle(characterId) {
    const char = this.getCharacter(characterId);
    return char?.borderStyle || { ...this.config.BORDER_DEFAULT };
  }

  /**
   * Gets the in-flight picker style when available, otherwise the persisted character style.
   *
   * @param {string} [characterId]
   * @returns {Object}
   */
  getPickerBorderStyle(characterId = this.uiState.borderPicker?.characterId) {
    const char = characterId ? this.getCharacter(characterId) : null;
    return this._normalizeBorderStyle(
      this.uiState.borderPicker?.currentStyle
      || char?.borderStyle
      || { ...this.config.BORDER_DEFAULT }
    );
  }

  /**
   * Stores the picker's current draft style and optionally syncs the popover UI.
   *
   * @param {Object} borderStyle
   * @param {{ syncUi?: boolean }} [options]
   * @returns {Object}
   */
  setPickerBorderStyle(borderStyle, { syncUi = true } = {}) {
    const normalized = this._normalizeBorderStyle(borderStyle);
    if (this.uiState.borderPicker) {
      this.uiState.borderPicker.currentStyle = normalized;
    }
    if (syncUi) {
      this.syncPickerUi(normalized);
    }
    return normalized;
  }

  /**
   * Syncs the border picker DOM to match the current draft style.
   *
   * @param {Object} [borderStyle]
   */
  syncPickerUi(borderStyle = this.getPickerBorderStyle()) {
    const picker = this.element?.querySelector('.es-border-picker');
    if (!picker) return;

    const normalized = this._normalizeBorderStyle(borderStyle);
    const effectKey = normalized.effect || this.config.BORDER_DEFAULT.effect;
    const effectDef = this.config.BORDER_EFFECTS[effectKey] || this.config.BORDER_EFFECTS[this.config.BORDER_DEFAULT.effect];
    const accent = normalized.color || normalized.color2 || this.config.BORDER_DEFAULT.color;
    const color1 = normalized.color || this.config.BORDER_DEFAULT.color;
    const color2 = normalized.color2 || this.config.BORDER_DEFAULT.color;
    const showColor = effectDef?.colorCount > 0;
    const showColor2 = effectDef?.colorCount === 2;

    picker.dataset.effect = effectKey;
    picker.style.setProperty('--es-border-picker-accent', accent);
    picker.style.setProperty('--es-border-picker-accent-rgb', this._hexToRgb(accent));

    picker.querySelectorAll('.es-border-effect-option').forEach((option) => {
      option.classList.toggle('es-border-effect-option--active', option.dataset.effect === effectKey);
    });

    const colorSection = picker.querySelector('.es-border-color-section');
    if (colorSection) {
      colorSection.style.display = showColor ? '' : 'none';
    }

    const color2Section = picker.querySelector('.es-border-color2-section');
    if (color2Section) {
      color2Section.style.display = showColor2 ? '' : 'none';
    }

    this._syncColorRow(picker.querySelector('.es-border-color-section .es-border-color-row'), color1, 'color1');
    this._syncColorRow(picker.querySelector('.es-border-color2-section .es-border-color-row'), color2, 'color2');

    const effectLabel = picker.querySelector('.es-border-current-effect');
    if (effectLabel) {
      effectLabel.textContent = game.i18n.localize(effectDef.name);
    }

    const effectIcon = picker.querySelector('.es-border-current-effect-icon');
    if (effectIcon) {
      effectIcon.className = `fas ${effectDef.icon} es-border-current-effect-icon`;
    }

    const colorChip1 = picker.querySelector('[data-border-color-preview="color1"]');
    if (colorChip1) {
      colorChip1.hidden = !showColor;
      colorChip1.style.setProperty('--es-color-chip', color1);
    }

    const colorChip2 = picker.querySelector('[data-border-color-preview="color2"]');
    if (colorChip2) {
      colorChip2.hidden = !showColor2;
      colorChip2.style.setProperty('--es-color-chip', color2);
    }

    const palettePill = picker.querySelector('.es-border-picker__palette-pill');
    if (palettePill) {
      palettePill.hidden = !showColor;
    }
  }

  /**
   * Gets information about a specific border effect.
   *
   * @param {string} effectKey - The border effect key
   * @returns {Object|undefined} The effect configuration object
   */
  getEffectInfo(effectKey) {
    return this.config.BORDER_EFFECTS[effectKey];
  }

  /**
   * Checks if a border effect exists.
   *
   * @param {string} effectKey - The effect key to check
   * @returns {boolean} True if the effect exists
   */
  isValidEffect(effectKey) {
    return effectKey in this.config.BORDER_EFFECTS;
  }

  /**
   * Normalizes a border style object so UI state and socket payloads stay consistent.
   *
   * @param {Object} borderStyle
   * @returns {Object}
   * @private
   */
  _normalizeBorderStyle(borderStyle) {
    const effect = this.isValidEffect(borderStyle?.effect)
      ? borderStyle.effect
      : this.config.BORDER_DEFAULT.effect;
    const effectDef = this.config.BORDER_EFFECTS[effect];
    const normalized = { effect };

    if (effectDef?.colorCount > 0) {
      normalized.color = borderStyle?.color || this.config.BORDER_DEFAULT.color;
    }

    if (effectDef?.colorCount === 2) {
      normalized.color2 = borderStyle?.color2 || '#a8a9ad';
    }

    return normalized;
  }

  /**
   * Syncs a color row, its active swatch state, and the custom-color control.
   *
   * @param {HTMLElement|null} row
   * @param {string} color
   * @param {'color1'|'color2'} target
   * @private
   */
  _syncColorRow(row, color, target) {
    if (!row) return;

    let matchesPreset = false;
    row.querySelectorAll('.es-border-swatch').forEach((swatch) => {
      const active = swatch.dataset.color === color;
      matchesPreset ||= active;
      swatch.classList.toggle('es-border-swatch--active', active);
    });

    const input = row.querySelector(`.es-border-color-input[data-target="${target}"]`);
    if (input) {
      input.value = color;
      const custom = input.closest('.es-border-custom-color');
      if (custom) {
        custom.style.backgroundColor = color;
        custom.classList.toggle('es-border-custom-color--active', !matchesPreset);
      }
    }

    row.classList.toggle('es-border-color-row--custom', !matchesPreset);
  }

  /**
   * Converts a hex color to an RGB string for CSS custom properties.
   *
   * @param {string} hex
   * @returns {string}
   * @private
   */
  _hexToRgb(hex) {
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) {
      return '201, 162, 39';
    }

    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }
}
