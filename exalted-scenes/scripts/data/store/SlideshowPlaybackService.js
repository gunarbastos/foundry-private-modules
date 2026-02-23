/**
 * @file SlideshowPlaybackService.js
 * @description Service for slideshow playback control.
 * Handles all slideshow playback logic including start, stop, pause, resume,
 * and navigation (next/previous scene).
 *
 * @module data/store/SlideshowPlaybackService
 */

import { BaseService } from './BaseService.js';
import { SocketHandler } from '../SocketHandler.js';
import { localize } from '../../utils/i18n.js';

/**
 * Service for managing slideshow playback.
 * Provides playback controls and state management for slideshows.
 *
 * @extends BaseService
 */
export class SlideshowPlaybackService extends BaseService {
  /**
   * Creates a new SlideshowPlaybackService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK STATE ACCESS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the current slideshow playback state.
   * @returns {Object} The slideshow state object
   */
  getState() {
    return this.slideshowState;
  }

  /**
   * Check if a slideshow is currently playing.
   * @returns {boolean} True if playing
   */
  isPlaying() {
    return this.slideshowState.isPlaying;
  }

  /**
   * Check if the slideshow is paused.
   * @returns {boolean} True if paused
   */
  isPaused() {
    return this.slideshowState.isPaused;
  }

  /**
   * Reset the slideshow state to defaults.
   * @private
   */
  _resetState() {
    this.store.slideshowState = {
      isPlaying: false,
      slideshowId: null,
      currentIndex: 0,
      sequence: [],
      isPaused: false,
      timerId: null,
      startTime: null,
      pausedTime: null
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK CONTROL
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Start playing a slideshow.
   *
   * @param {string} slideshowId - ID of the slideshow to play
   * @returns {boolean} True if started successfully, false otherwise
   */
  startSlideshow(slideshowId) {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow || slideshow.scenes.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnEmptySlideshow'));
      return false;
    }

    // Stop any current playback
    this.stopSlideshow();

    // Update slideshow stats
    slideshow.lastUsed = Date.now();
    slideshow.playCount++;
    this.store._services.slideshow.saveSlideshows();

    // Get the play sequence
    const sequence = slideshow.getPlaySequence();

    // Get the cast from the FIRST scene - this will be used for the entire slideshow
    // The slideshow represents a journey where characters stay consistent across backgrounds
    const firstSceneId = sequence[0]?.sceneId;
    const firstScene = firstSceneId ? this.scenes.get(firstSceneId) : null;
    const slideshowCast = firstScene ? [...firstScene.cast] : [];

    // Initialize playback state
    this.store.slideshowState = {
      isPlaying: true,
      slideshowId: slideshowId,
      currentIndex: 0,
      sequence: sequence,
      isPaused: false,
      timerId: null,
      startTime: Date.now(),
      pausedTime: null,
      transitionType: slideshow.transitionType,
      transitionDuration: slideshow.transitionDuration,
      backgroundMotion: slideshow.backgroundMotion || 'none',
      loop: slideshow.loop,
      cinematicMode: slideshow.cinematicMode,
      cast: slideshowCast // Store the fixed cast for the entire slideshow
    };

    // Broadcast slideshow start with the fixed cast and background motion
    SocketHandler.emitSlideshowStart({
      slideshowId,
      sequence: this.slideshowState.sequence,
      transitionType: slideshow.transitionType,
      transitionDuration: slideshow.transitionDuration,
      backgroundMotion: slideshow.backgroundMotion || 'none',
      loop: slideshow.loop,
      cinematicMode: slideshow.cinematicMode,
      cast: slideshowCast // Send the cast to all clients
    });

    // Start first scene
    this._playCurrentScene();

    return true;
  }

  /**
   * Play the current scene in the sequence.
   * Schedules the next scene after the current duration.
   * @private
   */
  _playCurrentScene() {
    const state = this.slideshowState;
    if (!state.isPlaying || state.currentIndex >= state.sequence.length) {
      // End of slideshow
      if (state.loop && state.sequence.length > 0) {
        state.currentIndex = 0;
        this._playCurrentScene();
      } else {
        this.stopSlideshow();
      }
      return;
    }

    const currentScene = state.sequence[state.currentIndex];
    const sceneId = currentScene.sceneId;
    const duration = currentScene.duration;

    state.startTime = Date.now();

    // Broadcast scene change
    SocketHandler.emitSlideshowScene({
      sceneId,
      index: state.currentIndex,
      total: state.sequence.length,
      duration,
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration
    });

    // Schedule next scene
    state.timerId = setTimeout(() => {
      state.currentIndex++;
      this._playCurrentScene();
    }, duration);
  }

  /**
   * Pause the slideshow.
   * Calculates and stores remaining time for the current scene.
   */
  pauseSlideshow() {
    const state = this.slideshowState;
    if (!state.isPlaying || state.isPaused) return;

    // Bounds check before accessing sequence
    if (state.currentIndex >= state.sequence.length) return;

    // Calculate remaining time
    const elapsed = Date.now() - state.startTime;
    const currentScene = state.sequence[state.currentIndex];
    if (!currentScene) return;

    state.pausedTime = Math.max(0, currentScene.duration - elapsed);

    // Clear timer
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }

    state.isPaused = true;
    SocketHandler.emitSlideshowPause();
  }

  /**
   * Resume the slideshow from paused state.
   * Continues with the remaining time for the current scene.
   */
  resumeSlideshow() {
    const state = this.slideshowState;
    if (!state.isPlaying || !state.isPaused) return;

    // Prevent double-resume
    if (state.timerId) return;

    state.isPaused = false;
    state.startTime = Date.now();

    SocketHandler.emitSlideshowResume();

    // Schedule next scene with remaining time (ensure valid value)
    const remainingTime = Math.max(100, state.pausedTime || 1000);
    state.timerId = setTimeout(() => {
      state.currentIndex++;
      this._playCurrentScene();
    }, remainingTime);

    state.pausedTime = null;
  }

  /**
   * Skip to the next scene in the slideshow.
   */
  nextScene() {
    const state = this.slideshowState;
    if (!state.isPlaying) return;

    // Clear current timer
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }

    state.isPaused = false;
    state.currentIndex++;
    this._playCurrentScene();
  }

  /**
   * Go to the previous scene in the slideshow.
   */
  previousScene() {
    const state = this.slideshowState;
    if (!state.isPlaying) return;

    // Clear current timer
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }

    state.isPaused = false;
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    this._playCurrentScene();
  }

  /**
   * Stop the slideshow.
   *
   * @param {boolean} [broadcast=true] - Whether to emit socket event to clients
   */
  stopSlideshow(broadcast = true) {
    const state = this.slideshowState;

    // Clear timer FIRST before anything else
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }

    // Check if was actually playing
    const wasPlaying = state.isPlaying;

    // Reset state immediately
    this._resetState();

    // Only broadcast if we were actually playing and broadcast is requested
    if (wasPlaying && broadcast) {
      SocketHandler.emitSlideshowStop();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PROGRESS INFORMATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get current slideshow progress info.
   *
   * @returns {Object|null} Progress info or null if not playing
   * @property {boolean} isPlaying - Whether slideshow is playing
   * @property {boolean} isPaused - Whether slideshow is paused
   * @property {number} currentIndex - Current scene index
   * @property {number} totalScenes - Total scenes in slideshow
   * @property {string} sceneName - Current scene name
   * @property {string} sceneId - Current scene ID
   * @property {number} duration - Current scene duration
   * @property {number} elapsed - Time elapsed on current scene
   * @property {number} progress - Progress ratio (0-1)
   */
  getSlideshowProgress() {
    const state = this.slideshowState;
    if (!state.isPlaying) return null;

    const currentScene = state.sequence[state.currentIndex];
    if (!currentScene) return null;

    const scene = this.scenes.get(currentScene.sceneId);
    const elapsed = state.isPaused
      ? (currentScene.duration - state.pausedTime)
      : (Date.now() - state.startTime);

    return {
      isPlaying: state.isPlaying,
      isPaused: state.isPaused,
      currentIndex: state.currentIndex,
      totalScenes: state.sequence.length,
      sceneName: scene?.name || 'Unknown',
      sceneId: currentScene.sceneId,
      duration: currentScene.duration,
      elapsed: Math.min(elapsed, currentScene.duration),
      progress: Math.min(elapsed / currentScene.duration, 1)
    };
  }
}
