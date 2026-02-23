/**
 * @file CastOnlyService.js
 * @description Service for Cast-Only mode management.
 * Handles displaying characters without a scene background.
 * Useful for character introductions, dialogue scenes, or focused conversations.
 *
 * @module data/store/CastOnlyService
 */

import { BaseService } from './BaseService.js';
import { SocketHandler } from '../SocketHandler.js';
import { localize } from '../../utils/i18n.js';

/**
 * Service for managing Cast-Only mode.
 * Provides controls for displaying characters without scene backgrounds.
 * Unlike scenes, cast-only mode shows only character portraits with layout options.
 *
 * @extends BaseService
 */
export class CastOnlyService extends BaseService {
  /**
   * Creates a new CastOnlyService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     STATE ACCESS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the current cast-only state.
   * @returns {Object} The cast-only state object
   */
  getState() {
    return this.castOnlyState;
  }

  /**
   * Check if cast-only mode is currently active.
   * @returns {boolean} True if active
   */
  isActive() {
    return this.castOnlyState.isActive;
  }

  /**
   * Reset the cast-only state while preserving layout settings.
   * @private
   */
  _resetState() {
    const preservedLayout = { ...this.castOnlyState.layoutSettings };
    this.store.castOnlyState = {
      isActive: false,
      characterIds: [],
      layoutSettings: preservedLayout
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY CONTROL
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Start Cast-Only Mode with selected characters.
   *
   * @param {string[]} characterIds - Array of character IDs to display
   * @param {Object} [layoutSettings=null] - Optional layout settings override
   * @returns {boolean} True if started successfully, false otherwise
   */
  startCastOnly(characterIds, layoutSettings = null) {
    if (!characterIds || characterIds.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnSelectCastOnlyChar'));
      return false;
    }

    // Stop any other active broadcasts
    this.store.stopSlideshow(false);
    this.store.stopSequence(false);
    if (this.activeSceneId) {
      this.clearActiveScene();
      SocketHandler.emitStopBroadcast();
    }

    // Initialize cast-only state
    this.store.castOnlyState = {
      isActive: true,
      characterIds: [...characterIds],
      layoutSettings: layoutSettings || this.castOnlyState.layoutSettings
    };

    // Broadcast to players
    SocketHandler.emitCastOnlyStart({
      characterIds: this.store.castOnlyState.characterIds,
      layoutSettings: this.store.castOnlyState.layoutSettings
    });

    return true;
  }

  /**
   * Stop Cast-Only Mode.
   *
   * @param {boolean} [broadcast=true] - Whether to emit socket event to clients
   */
  stopCastOnly(broadcast = true) {
    const wasActive = this.castOnlyState.isActive;

    // Reset state (preserves layout settings for next use)
    this._resetState();

    if (wasActive && broadcast) {
      SocketHandler.emitCastOnlyStop();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     CHARACTER MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Add a character to Cast-Only Mode.
   *
   * @param {string} characterId - Character ID to add
   * @returns {boolean} True if added, false if not active or already present
   */
  addCharacterToCastOnly(characterId) {
    if (!this.castOnlyState.isActive) return false;
    if (this.castOnlyState.characterIds.includes(characterId)) return false;

    this.castOnlyState.characterIds.push(characterId);

    // Broadcast update
    SocketHandler.emitCastOnlyUpdate({
      characterIds: this.castOnlyState.characterIds
    });

    return true;
  }

  /**
   * Remove a character from Cast-Only Mode.
   *
   * @param {string} characterId - Character ID to remove
   * @returns {boolean} True if removed, false if not active or not found
   */
  removeCharacterFromCastOnly(characterId) {
    if (!this.castOnlyState.isActive) return false;

    const index = this.castOnlyState.characterIds.indexOf(characterId);
    if (index === -1) return false;

    this.castOnlyState.characterIds.splice(index, 1);

    // If no characters left, stop cast-only mode
    if (this.castOnlyState.characterIds.length === 0) {
      this.stopCastOnly();
      return true;
    }

    // Broadcast update
    SocketHandler.emitCastOnlyUpdate({
      characterIds: this.castOnlyState.characterIds
    });

    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     LAYOUT MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Update Cast-Only layout settings.
   *
   * @param {Object} layoutSettings - New layout settings (merged with existing)
   * @param {string} [layoutSettings.preset] - Layout preset ('bottom-center', etc.)
   * @param {string} [layoutSettings.size] - Size preset ('small', 'medium', 'large')
   * @param {number} [layoutSettings.spacing] - Spacing between characters in pixels
   * @param {number} [layoutSettings.offsetX] - Horizontal offset in pixels
   * @param {number} [layoutSettings.offsetY] - Vertical offset in percentage
   */
  updateCastOnlyLayout(layoutSettings) {
    this.store.castOnlyState.layoutSettings = {
      ...this.castOnlyState.layoutSettings,
      ...layoutSettings
    };

    // Broadcast update if active
    if (this.castOnlyState.isActive) {
      SocketHandler.emitCastOnlyUpdate({
        characterIds: this.castOnlyState.characterIds,
        layoutSettings: this.store.castOnlyState.layoutSettings
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PROGRESS INFORMATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get current Cast-Only progress info.
   *
   * @returns {Object|null} Progress info or null if not active
   * @property {boolean} isActive - Whether cast-only mode is active
   * @property {string[]} characterIds - IDs of characters being displayed
   * @property {Object[]} characters - Character data objects
   * @property {Object} layoutSettings - Current layout settings
   */
  getCastOnlyProgress() {
    const state = this.castOnlyState;
    if (!state.isActive) return null;

    // Build character list with current data
    const characters = state.characterIds
      .map(id => this.characters.get(id))
      .filter(c => c !== undefined)
      .map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        borderStyle: c.borderStyle || 'gold',
        locked: c.locked || false
      }));

    return {
      isActive: state.isActive,
      characterIds: state.characterIds,
      characters: characters,
      layoutSettings: state.layoutSettings
    };
  }
}
