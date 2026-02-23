/**
 * @file TransitionHandler.js
 * @description Handles CSS transitions and animations for scene/background changes
 * in the PlayerView. Manages entrance animations, slideshow transitions, sequence
 * background transitions, and closing animations.
 *
 * @module player-view/TransitionHandler
 */

import { BaseHandler } from './BaseHandler.js';
import { CONFIG } from '../../config.js';

/**
 * Handles all CSS transitions and animations for PlayerView.
 * Includes scene entrance animations, background-only transitions for slideshows,
 * sequence background transitions, and view closing animations.
 *
 * @extends BaseHandler
 */
export class TransitionHandler extends BaseHandler {
  /**
   * Sets up the handler and applies entrance animations if transitioning scenes.
   * Called during each view render.
   *
   * @param {HTMLElement} element - The view's root element
   * @override
   */
  setup(element) {
    super.setup(element);

    // Handle smart fit mode - calculate aspect ratio when image loads
    this._setupSmartFitMode();

    // Apply entrance animations only when transitioning to a new scene
    if (this.uiState.isSceneTransition) {
      this._applySceneEntranceAnimations();
      // Reset flag after applying animations
      this.uiState.isSceneTransition = false;
    }
  }

  /**
   * Sets up the "smart" fit mode that dynamically chooses cover or contain
   * based on the aspect ratio difference between image and viewport.
   * @private
   */
  _setupSmartFitMode() {
    const bgContainer = this.$('.es-pv-background');
    if (!bgContainer || bgContainer.dataset.fitMode !== 'smart') return;

    const media = bgContainer.querySelector('img.es-pv-bg-media');
    if (!media) return;

    // If image is already loaded, calculate immediately
    if (media.complete && media.naturalWidth > 0) {
      this._applySmartFit(bgContainer, media);
    } else {
      // Wait for image to load
      media.addEventListener('load', () => {
        this._applySmartFit(bgContainer, media);
      }, { once: true });
    }
  }

  /**
   * Applies the smart fit decision based on aspect ratio comparison.
   * Uses 'contain' if the aspect ratio difference is significant (>20%),
   * otherwise uses 'cover' for a cleaner full-bleed look.
   *
   * @param {HTMLElement} container - The background container element
   * @param {HTMLImageElement} img - The loaded image element
   * @private
   */
  _applySmartFit(container, img) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const viewportAspect = window.innerWidth / window.innerHeight;

    // Calculate how different the aspect ratios are
    // If the difference is more than 20%, use contain to avoid excessive cropping
    const aspectDifference = Math.abs(imgAspect - viewportAspect) / Math.max(imgAspect, viewportAspect);

    if (aspectDifference > 0.20) {
      // Significant difference - use contain to show full image
      container.classList.add('es-pv-background--smart-contain');
    } else {
      // Similar aspect ratios - use cover for full-bleed
      container.classList.remove('es-pv-background--smart-contain');
    }
  }

  /**
   * Re-evaluates the smart fit mode for a newly created media element.
   * Called after slideshow/sequence transitions create new background elements,
   * since _setupSmartFitMode() only runs on full re-render.
   *
   * @param {HTMLElement} media - The newly created media element
   * @private
   */
  _reapplySmartFitForNewMedia(media) {
    const bgContainer = this.$('.es-pv-background');
    if (!bgContainer || bgContainer.dataset.fitMode !== 'smart') return;

    // Only applies to images (videos always use cover)
    if (media.tagName !== 'IMG') return;

    if (media.complete && media.naturalWidth > 0) {
      this._applySmartFit(bgContainer, media);
    } else {
      media.addEventListener('load', () => {
        this._applySmartFit(bgContainer, media);
      }, { once: true });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE ENTRANCE ANIMATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Applies entrance animations to background and characters.
   * Called when transitioning to a new scene.
   *
   * @private
   */
  _applySceneEntranceAnimations() {
    const background = this.$('.es-pv-bg-media');
    const characters = this.$$('.es-pv-character');

    // Animate background with fade transition
    if (background) {
      background.classList.add('es-transition-fade');
      background.addEventListener('animationend', () => {
        background.classList.remove('es-transition-fade');
      }, { once: true });

      // Apply background motion (Ken Burns) for first slide in slideshow mode
      if (this.uiState.slideshowMode && this.uiState.backgroundMotion && this.uiState.backgroundMotion !== 'none') {
        const duration = this.uiState.currentSlideDuration || 5000;
        this._applyBackgroundMotion(background, {
          preset: this.uiState.backgroundMotion,
          duration: duration
        });
      }
    }

    // Animate characters with staggered entrance
    characters.forEach((char, index) => {
      char.style.setProperty('--char-index', index);
      char.classList.add('es-entering');
      char.addEventListener('animationend', () => {
        char.classList.remove('es-entering');
      }, { once: true });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW BACKGROUND TRANSITIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Updates background during slideshow without full re-render.
   * Preserves picker state and keeps the fixed slideshow cast.
   * Characters persist across all background changes in slideshow mode.
   *
   * @param {string} sceneId - ID of the scene to transition to
   * @param {string} [transitionType='dissolve'] - Type of transition ('fade', 'dissolve', 'cut', etc.)
   * @param {number} [transitionDuration=500] - Duration in milliseconds
   * @param {Object} [motionSettings=null] - Background motion settings
   * @param {string} [motionSettings.preset] - Motion preset name
   * @param {number} [motionSettings.duration] - Slide duration in milliseconds
   */
  updateBackgroundOnly(sceneId, transitionType = 'dissolve', transitionDuration = 500, motionSettings = null) {
    if (!this.element) return;

    const scene = this.getScene(sceneId);
    if (!scene) return;

    // NOTE: We do NOT update the cast here!
    // In slideshow mode, the cast is fixed from the first scene and persists across all backgrounds
    // This represents a journey where the same characters travel through different locations

    const bgContainer = this.$('.es-pv-background');
    if (!bgContainer) return;

    const currentMedia = bgContainer.querySelector('.es-pv-bg-media:not(.es-bg-outgoing)');
    const isVideo = scene.bgType === 'video';
    const transitionClass = `es-bg-transition-${transitionType}`;

    // Create new background element with motion settings
    const newMedia = this._createMediaElement(scene.background, isVideo, motionSettings);
    newMedia.classList.add('es-bg-incoming', transitionClass);

    // Re-evaluate smart fit mode for the new image (aspect ratio may differ)
    this._reapplySmartFitForNewMedia(newMedia);

    // Set transition duration on both elements
    newMedia.style.setProperty('--transition-duration', `${transitionDuration}ms`);

    // Also add transition class to old element so it animates out properly
    if (currentMedia) {
      currentMedia.style.setProperty('--transition-duration', `${transitionDuration}ms`);
      currentMedia.classList.add(transitionClass);
    }

    // Insert new background
    bgContainer.appendChild(newMedia);

    // Trigger transition after a frame (for CSS transition to work)
    this._triggerBackgroundTransition(newMedia, currentMedia, transitionClass, transitionDuration);
  }

  /* ═══════════════════════════════════════════════════════════════
     SEQUENCE BACKGROUND TRANSITIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Updates the background during a sequence without re-rendering everything.
   * Supports 'cut' (instant) and 'dissolve' (fade) transitions.
   *
   * @param {Object} background - Background object with path and bgType
   * @param {string} background.path - Path to the media file
   * @param {string} background.bgType - Type of media ('image' or 'video')
   * @param {string} [transitionType='dissolve'] - Type of transition ('cut' or 'dissolve')
   * @param {number} [transitionDuration=1.0] - Duration in seconds
   */
  updateSequenceBackground(background, transitionType = 'dissolve', transitionDuration = 1.0) {
    if (!this.element) return;

    // Store new background in uiState
    this.uiState.sequenceBackground = background;

    const bgContainer = this.$('.es-pv-background');
    if (!bgContainer) return;

    const currentMedia = bgContainer.querySelector('.es-pv-bg-media:not(.es-bg-outgoing)');
    const isVideo = background.bgType === 'video';

    // Convert duration from seconds to milliseconds
    const durationMs = transitionType === 'cut' ? 0 : (transitionDuration * 1000);
    const transitionClass = transitionType === 'cut' ? 'es-bg-transition-cut' : 'es-bg-transition-dissolve';

    // Create new background element
    const newMedia = this._createMediaElement(background.path, isVideo);
    newMedia.classList.add('es-bg-incoming');

    // Re-evaluate smart fit mode for the new image (aspect ratio may differ)
    this._reapplySmartFitForNewMedia(newMedia);

    // Handle cut transition (instant)
    if (transitionType === 'cut') {
      if (currentMedia) {
        currentMedia.remove();
      }
      bgContainer.appendChild(newMedia);
      return;
    }

    // Handle dissolve transition
    newMedia.style.setProperty('--transition-duration', `${durationMs}ms`);
    newMedia.classList.add(transitionClass);

    if (currentMedia) {
      currentMedia.style.setProperty('--transition-duration', `${durationMs}ms`);
      currentMedia.classList.add(transitionClass);
    }

    bgContainer.appendChild(newMedia);

    this._triggerBackgroundTransition(newMedia, currentMedia, transitionClass, durationMs);
  }

  /* ═══════════════════════════════════════════════════════════════
     CLOSING ANIMATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Animates the view closing and executes callback when complete.
   * Adds the es-player-view--closing class and waits for animation.
   *
   * @param {Function} callback - Function to call after animation completes
   * @returns {boolean} True if animation was started, false if no element found
   */
  animateClose(callback) {
    const playerView = this.$('.es-player-view');
    if (!playerView) {
      // No element found, execute callback immediately
      if (callback) callback();
      return false;
    }

    playerView.classList.add('es-player-view--closing');

    // Wait for animation to complete before executing callback
    setTimeout(() => {
      if (callback) callback();
    }, 600);

    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     PRIVATE HELPER METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Creates a media element (video or image) for backgrounds.
   *
   * @param {string} src - Source URL for the media
   * @param {boolean} isVideo - Whether to create a video element
   * @param {Object} [motionSettings=null] - Background motion settings for Ken Burns effect
   * @param {string} [motionSettings.preset] - Motion preset name from CONFIG.BACKGROUND_MOTION
   * @param {number} [motionSettings.duration] - Animation duration in milliseconds
   * @returns {HTMLElement} The created media element
   * @private
   */
  _createMediaElement(src, isVideo, motionSettings = null) {
    const newMedia = document.createElement(isVideo ? 'video' : 'img');
    newMedia.className = 'es-pv-bg-media';
    newMedia.src = src;

    if (isVideo) {
      newMedia.autoplay = true;
      newMedia.loop = true;
      newMedia.muted = true;
      newMedia.playsInline = true;
      newMedia.disablePictureInPicture = true;
      // Force play after append
      newMedia.addEventListener('loadeddata', () => {
        newMedia.play().catch(() => {});
      }, { once: true });
    } else if (motionSettings && motionSettings.preset && motionSettings.preset !== 'none') {
      // Apply background motion (Ken Burns) to images only
      this._applyBackgroundMotion(newMedia, motionSettings);
    }

    return newMedia;
  }

  /**
   * Applies background motion (Ken Burns effect) CSS variables to an element.
   * Handles random preset selection when 'random' is specified.
   *
   * @param {HTMLElement} element - The image element to apply motion to
   * @param {Object} settings - Motion settings
   * @param {string} settings.preset - Motion preset name from CONFIG.BACKGROUND_MOTION
   * @param {number} settings.duration - Animation duration in milliseconds
   * @private
   */
  _applyBackgroundMotion(element, { preset, duration }) {
    let motion = CONFIG.BACKGROUND_MOTION[preset];

    // Handle random: pick one of the non-random presets
    if (!motion || motion.isRandom) {
      const options = Object.keys(CONFIG.BACKGROUND_MOTION)
        .filter(k => k !== 'none' && k !== 'random');
      const randomPreset = options[Math.floor(Math.random() * options.length)];
      motion = CONFIG.BACKGROUND_MOTION[randomPreset];
      preset = randomPreset;
    }

    if (!motion) return;

    // Set data attribute for CSS targeting
    element.dataset.motion = preset;

    // Extend animation duration by 1 second to continue through transition
    // This prevents the jarring effect of animation stopping exactly when slide ends
    const extendedDuration = duration + 1000;

    // Set CSS variables for the animation
    element.style.setProperty('--kb-scale-start', motion.scale[0]);
    element.style.setProperty('--kb-scale-end', motion.scale[1]);
    element.style.setProperty('--kb-x-start', `${motion.translate[0]}%`);
    element.style.setProperty('--kb-x-end', `${motion.translate[1]}%`);
    element.style.setProperty('--kb-y-start', `${motion.translate[2]}%`);
    element.style.setProperty('--kb-y-end', `${motion.translate[3]}%`);
    element.style.setProperty('--kb-duration', `${extendedDuration}ms`);
  }

  /**
   * Triggers the background transition animation using requestAnimationFrame.
   * Handles adding/removing classes and cleanup after transition.
   *
   * @param {HTMLElement} newMedia - The incoming media element
   * @param {HTMLElement|null} currentMedia - The outgoing media element
   * @param {string} transitionClass - CSS class for the transition type
   * @param {number} durationMs - Duration in milliseconds
   * @private
   */
  _triggerBackgroundTransition(newMedia, currentMedia, transitionClass, durationMs) {
    // Cancel any pending cleanup from a previous transition
    if (this._transitionCleanupTimer) {
      clearTimeout(this._transitionCleanupTimer);
      this._transitionCleanupTimer = null;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Add active state to trigger animation
        newMedia.classList.add('es-bg-active');

        if (currentMedia) {
          currentMedia.classList.add('es-bg-outgoing');
        }

        // Remove old background after transition completes
        this._transitionCleanupTimer = setTimeout(() => {
          this._transitionCleanupTimer = null;
          if (currentMedia && currentMedia.parentNode) {
            currentMedia.remove();
          }
          // Clean up transition classes from new media (only if still in DOM)
          if (newMedia.parentNode) {
            newMedia.classList.remove('es-bg-incoming', transitionClass, 'es-bg-active');
          }
        }, durationMs + 50);
      });
    });
  }
}
