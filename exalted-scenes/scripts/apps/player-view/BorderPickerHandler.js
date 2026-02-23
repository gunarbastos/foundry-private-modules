/**
 * @file BorderPickerHandler.js
 * @description Handles border picker functionality for the PlayerView.
 * Manages border style selection UI and context preparation.
 *
 * Note: The actual action handlers (open-border-picker, close-border-picker,
 * back-to-emotions, select-border) remain in PlayerView.js as they are
 * static ApplicationV2 action handlers required by FoundryVTT.
 *
 * @module player-view/BorderPickerHandler
 */

import { BaseHandler } from './BaseHandler.js';

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
    // Border picker uses static ApplicationV2 actions for all interactions
    // No dynamic event listeners needed at this time
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTEXT PREPARATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Prepares the border picker context for template rendering.
   * Organizes border presets by type (solid, gradient, animated, styled)
   * and marks the currently active border style.
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

    const currentBorder = char.borderStyle || 'gold';
    const presets = this.config.BORDER_PRESETS;

    // Organize presets by type
    const solid = [];
    const gradient = [];
    const animated = [];
    const styled = [];

    for (const [key, preset] of Object.entries(presets)) {
      const item = {
        key,
        name: preset.name,
        active: currentBorder === key,
        color: preset.color || '#888'
      };

      switch (preset.type) {
        case 'solid':
          solid.push(item);
          break;
        case 'gradient':
          gradient.push(item);
          break;
        case 'animated':
          animated.push(item);
          break;
        case 'styled':
          styled.push(item);
          break;
      }
    }

    return {
      character: char,
      solid,
      gradient,
      animated,
      styled,
      x: borderPicker.x,
      y: borderPicker.y,
      pickerBelow: borderPicker.pickerBelow || false
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Gets the currently selected border style for a character.
   *
   * @param {string} characterId - The character ID
   * @returns {string} The border style key (defaults to 'gold')
   */
  getCurrentBorderStyle(characterId) {
    const char = this.getCharacter(characterId);
    return char?.borderStyle || 'gold';
  }

  /**
   * Gets information about a specific border preset.
   *
   * @param {string} presetKey - The border preset key
   * @returns {Object|undefined} The preset configuration object
   */
  getPresetInfo(presetKey) {
    return this.config.BORDER_PRESETS[presetKey];
  }

  /**
   * Checks if a border style exists in the presets.
   *
   * @param {string} styleKey - The style key to check
   * @returns {boolean} True if the style exists
   */
  isValidBorderStyle(styleKey) {
    return styleKey in this.config.BORDER_PRESETS;
  }
}
