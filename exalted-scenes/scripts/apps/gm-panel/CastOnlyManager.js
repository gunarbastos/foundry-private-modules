/**
 * @file CastOnlyManager.js
 * @description Manages Cast-Only mode operations for the GMPanel.
 * Handles character selection, starting/stopping cast-only mode, and layout changes.
 *
 * @module gm-panel/CastOnlyManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SocketHandler } from '../../data/SocketHandler.js';
import { localize } from '../../utils/i18n.js';

/**
 * Manages Cast-Only mode in the GMPanel.
 * Cast-Only mode displays only selected characters without a background scene.
 * @extends BaseManager
 */
export class CastOnlyManager extends BaseManager {
  /**
   * Creates a new CastOnlyManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);
  }

  /* ═══════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up cast-only mode event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    // No additional setup needed - all actions are handled via data-action
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - CHARACTER SELECTION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Toggles a character's selection for cast-only mode.
   * @param {HTMLElement} target - Element with character-id data attribute
   */
  handleToggleCastOnlyChar(target) {
    const charId = target.dataset.characterId;
    if (this.uiState.castOnlySelectedChars.has(charId)) {
      this.uiState.castOnlySelectedChars.delete(charId);
    } else {
      this.uiState.castOnlySelectedChars.add(charId);
    }

    // If cast-only is already active, update in real-time
    if (Store.castOnlyState.isActive) {
      const characterIds = Array.from(this.uiState.castOnlySelectedChars);
      if (characterIds.length === 0) {
        Store.stopCastOnly();
      } else {
        Store.castOnlyState.characterIds = characterIds;
        SocketHandler.emitCastOnlyUpdate({ characterIds });
      }
    }

    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - MODE CONTROL
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts cast-only mode with the selected characters.
   */
  handleCastOnlyStart() {
    const characterIds = Array.from(this.uiState.castOnlySelectedChars);
    if (characterIds.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnSelectCastOnlyChar'));
      return;
    }

    Store.startCastOnly(characterIds);
    ui.notifications.info(localize('Notifications.CastOnlyStarted'));
    this.render();
  }

  /**
   * Stops cast-only mode.
   */
  handleCastOnlyStop() {
    Store.stopCastOnly();
    ui.notifications.info(localize('Notifications.CastOnlyStopped'));
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - LAYOUT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Updates the cast-only layout settings.
   * @param {HTMLElement} target - Element with layout/preset/size data attributes
   */
  handleCastOnlyLayout(target) {
    const layoutKey = target.dataset.layout;
    if (!layoutKey) return;

    const currentLayout = Store.castOnlyState.layoutSettings;
    let newLayout = { ...currentLayout };

    // Handle preset change
    if (target.dataset.preset) {
      newLayout.preset = target.dataset.preset;
    }

    // Handle size change
    if (target.dataset.size) {
      newLayout.size = target.dataset.size;
    }

    Store.updateCastOnlyLayout(newLayout);
    this.render();
  }
}
