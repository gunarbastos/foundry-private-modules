/**
 * @file SequencePlaybackService.js
 * @description Service for scene sequence playback control.
 * Handles manual navigation through sequence backgrounds by the GM.
 * Unlike slideshows (auto-advance), sequences are manually controlled.
 *
 * @module data/store/SequencePlaybackService
 */

import { BaseService } from './BaseService.js';
import { SocketHandler } from '../SocketHandler.js';
import { localize } from '../../utils/i18n.js';

/**
 * Service for managing scene sequence playback.
 * Provides navigation controls and state management for sequences.
 * Sequences are scenes with multiple backgrounds that the GM navigates manually.
 *
 * @extends BaseService
 */
export class SequencePlaybackService extends BaseService {
  /**
   * Creates a new SequencePlaybackService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK STATE ACCESS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the current sequence playback state.
   * @returns {Object} The sequence state object
   */
  getState() {
    return this.sequenceState;
  }

  /**
   * Check if a sequence is currently active.
   * @returns {boolean} True if active
   */
  isActive() {
    return this.sequenceState.isActive;
  }

  /**
   * Reset the sequence state to defaults.
   * @private
   */
  _resetState() {
    this.store.sequenceState = {
      isActive: false,
      sceneId: null,
      currentIndex: 0,
      totalBackgrounds: 0,
      transitionType: 'dissolve',
      transitionDuration: 1.0,
      onEnd: 'stop'
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK CONTROL
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Start broadcasting a scene sequence.
   *
   * @param {string} sceneId - ID of the scene to start as sequence
   * @returns {boolean} True if started successfully, false otherwise
   */
  startSequence(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene || !scene.isSequence || scene.sequenceBackgrounds.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnInvalidSequence'));
      return false;
    }

    // Stop any slideshow that might be playing
    this.store.stopSlideshow(false);

    // Set as active scene
    this.setActiveScene(sceneId);

    // Update scene stats
    scene.lastUsed = Date.now();
    scene.playCount++;
    this.saveData();

    // Initialize sequence state
    this.store.sequenceState = {
      isActive: true,
      sceneId: sceneId,
      currentIndex: 0,
      totalBackgrounds: scene.sequenceBackgrounds.length,
      transitionType: scene.sequenceSettings.transitionType,
      transitionDuration: scene.sequenceSettings.transitionDuration,
      onEnd: scene.sequenceSettings.onEnd
    };

    // Broadcast to players
    SocketHandler.emitSequenceStart({
      sceneId,
      backgroundIndex: 0,
      background: scene.sequenceBackgrounds[0],
      cast: scene.cast,
      transitionType: scene.sequenceSettings.transitionType,
      transitionDuration: scene.sequenceSettings.transitionDuration
    });

    return true;
  }

  /**
   * Navigate to next background in sequence.
   *
   * @returns {boolean} True if navigated, false if at end or not active
   */
  sequenceNext() {
    const state = this.sequenceState;
    if (!state.isActive) return false;

    const scene = this.scenes.get(state.sceneId);
    if (!scene) return false;

    let nextIndex = state.currentIndex + 1;

    // Check if we've reached the end
    if (nextIndex >= state.totalBackgrounds) {
      if (state.onEnd === 'loop') {
        nextIndex = 0;
      } else {
        // Stop the sequence
        this.stopSequence();
        return false;
      }
    }

    state.currentIndex = nextIndex;
    const background = scene.sequenceBackgrounds[nextIndex];

    // Broadcast change to players
    SocketHandler.emitSequenceChange({
      sceneId: state.sceneId,
      backgroundIndex: nextIndex,
      background: background,
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration
    });

    return true;
  }

  /**
   * Navigate to previous background in sequence.
   *
   * @returns {boolean} True if navigated, false if at start or not active
   */
  sequencePrevious() {
    const state = this.sequenceState;
    if (!state.isActive) return false;

    const scene = this.scenes.get(state.sceneId);
    if (!scene) return false;

    let prevIndex = state.currentIndex - 1;

    // Check if we've reached the beginning
    if (prevIndex < 0) {
      if (state.onEnd === 'loop') {
        prevIndex = state.totalBackgrounds - 1;
      } else {
        prevIndex = 0; // Stay at first
      }
    }

    if (prevIndex === state.currentIndex) return false;

    state.currentIndex = prevIndex;
    const background = scene.sequenceBackgrounds[prevIndex];

    // Broadcast change to players
    SocketHandler.emitSequenceChange({
      sceneId: state.sceneId,
      backgroundIndex: prevIndex,
      background: background,
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration
    });

    return true;
  }

  /**
   * Jump to specific index in sequence.
   *
   * @param {number} index - Target background index
   * @returns {boolean} True if jumped, false if invalid or not active
   */
  sequenceGoTo(index) {
    const state = this.sequenceState;
    if (!state.isActive) return false;

    const scene = this.scenes.get(state.sceneId);
    if (!scene) return false;

    // Clamp index to valid range
    const targetIndex = Math.max(0, Math.min(index, state.totalBackgrounds - 1));
    if (targetIndex === state.currentIndex) return false;

    state.currentIndex = targetIndex;
    const background = scene.sequenceBackgrounds[targetIndex];

    // Broadcast change to players
    SocketHandler.emitSequenceChange({
      sceneId: state.sceneId,
      backgroundIndex: targetIndex,
      background: background,
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration
    });

    return true;
  }

  /**
   * Stop the sequence broadcast.
   *
   * @param {boolean} [broadcast=true] - Whether to emit socket event to clients
   */
  stopSequence(broadcast = true) {
    const wasActive = this.sequenceState.isActive;

    // Reset state
    this._resetState();

    // Clear active scene
    this.clearActiveScene();

    // Broadcast stop to players
    if (wasActive && broadcast) {
      SocketHandler.emitSequenceStop();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PROGRESS INFORMATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get current sequence progress info.
   *
   * @returns {Object|null} Progress info or null if not active
   * @property {boolean} isActive - Whether sequence is active
   * @property {string} sceneId - Current scene ID
   * @property {string} sceneName - Current scene name
   * @property {number} currentIndex - Current background index
   * @property {number} totalBackgrounds - Total backgrounds in sequence
   * @property {Object} currentBackground - Current background data
   * @property {string} transitionType - Transition type
   * @property {number} transitionDuration - Transition duration in seconds
   * @property {string} onEnd - Behavior at end ('stop' or 'loop')
   * @property {boolean} isFirst - Whether at first background
   * @property {boolean} isLast - Whether at last background
   */
  getSequenceProgress() {
    const state = this.sequenceState;
    if (!state.isActive) return null;

    const scene = this.scenes.get(state.sceneId);
    if (!scene) return null;

    return {
      isActive: state.isActive,
      sceneId: state.sceneId,
      sceneName: scene.name,
      currentIndex: state.currentIndex,
      totalBackgrounds: state.totalBackgrounds,
      currentBackground: scene.sequenceBackgrounds[state.currentIndex],
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration,
      onEnd: state.onEnd,
      isFirst: state.currentIndex === 0,
      isLast: state.currentIndex === state.totalBackgrounds - 1
    };
  }
}
