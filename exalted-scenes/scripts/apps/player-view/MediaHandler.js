/**
 * @file MediaHandler.js
 * @description Handles media (images/videos) loading, playback, and error handling
 * for the PlayerView. Ensures video autoplay works across browsers and manages
 * media loading errors.
 *
 * @module player-view/MediaHandler
 */

import { BaseHandler } from './BaseHandler.js';

/**
 * Handles all media-related functionality for PlayerView.
 * Includes video autoplay enforcement, media error handling,
 * and media type detection utilities.
 *
 * @extends BaseHandler
 */
export class MediaHandler extends BaseHandler {
  /**
   * Sets up the handler and ensures videos play.
   * Called during each view render.
   *
   * @param {HTMLElement} element - The view's root element
   * @override
   */
  setup(element) {
    super.setup(element);

    // Ensure video backgrounds play (some browsers block autoplay)
    this.ensureVideoPlays();

    // Setup error handlers for media elements
    this._setupMediaErrorHandlers();
  }

  /* ═══════════════════════════════════════════════════════════════
     VIDEO AUTOPLAY
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Ensures all videos (backgrounds and portraits) play correctly.
   * Some browsers block autoplay even with muted attribute.
   * Forces muted state and adds fallback click-to-play handler.
   */
  ensureVideoPlays() {
    // Handle background videos
    const bgVideo = this.$('video.es-pv-bg-media');
    if (bgVideo) {
      this._ensureSingleVideoPlays(bgVideo);
    }

    // Handle portrait videos (character emotions)
    const portraitVideos = this.$$('.es-pv-portrait video');
    for (const video of portraitVideos) {
      this._ensureSingleVideoPlays(video);
    }

    // Handle emotion picker thumbnail videos
    const pickerVideos = this.$$('.es-picker-item video');
    for (const video of pickerVideos) {
      this._ensureSingleVideoPlays(video);
    }
  }

  /**
   * Ensures a single video element plays correctly.
   * @param {HTMLVideoElement} video - The video element
   * @private
   */
  _ensureSingleVideoPlays(video) {
    if (!video) return;

    // Force muted state (required for autoplay in most browsers)
    video.muted = true;

    // Try to play the video
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        this._warn('Video autoplay was blocked:', error);
        // Add click handler to play on user interaction
        this._addClickToPlayHandler(video);
      });
    }
  }

  /**
   * Adds a one-time click handler to play video when autoplay is blocked.
   *
   * @param {HTMLVideoElement} video - The video element
   * @private
   */
  _addClickToPlayHandler(video) {
    const playOnClick = () => {
      video.play().catch(() => {
        // Still failed, nothing more we can do
        this._warn('Video failed to play even after user interaction');
      });
    };
    // Use signal so listener is cleaned up when handler is destroyed
    document.addEventListener('click', playOnClick, { once: true, signal: this.signal });
  }

  /* ═══════════════════════════════════════════════════════════════
     MEDIA ERROR HANDLING
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up error handlers for all media elements in the view.
   *
   * @private
   */
  _setupMediaErrorHandlers() {
    const mediaElements = this.$$('.es-pv-bg-media');

    for (const media of mediaElements) {
      media.addEventListener('error', (e) => this._handleMediaError(e, media), {
        signal: this.signal
      });
    }
  }

  /**
   * Handles media loading errors.
   *
   * @param {Event} event - The error event
   * @param {HTMLElement} media - The media element that failed
   * @private
   */
  _handleMediaError(event, media) {
    const src = media.src || media.currentSrc || 'unknown';
    this._warn(`Failed to load media: ${src}`);

    // Add error class for styling
    media.classList.add('es-media-error');

    // For videos, we could show a fallback image
    if (media.tagName === 'VIDEO') {
      this._handleVideoError(media);
    }
  }

  /**
   * Handles video-specific errors.
   * Could show a fallback or placeholder.
   *
   * @param {HTMLVideoElement} video - The video element that failed
   * @private
   */
  _handleVideoError(video) {
    // Add indicator that video failed
    video.setAttribute('data-load-failed', 'true');

    // Optionally, we could replace with a placeholder image
    // but for now we just add a class for CSS styling
  }

  /* ═══════════════════════════════════════════════════════════════
     MEDIA TYPE UTILITIES
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Determines if a file path points to a video.
   *
   * @param {string} path - File path or URL
   * @returns {boolean} True if the path points to a video file
   */
  static isVideo(path) {
    if (!path) return false;
    const ext = path.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  }

  /**
   * Determines if a file path points to an image.
   *
   * @param {string} path - File path or URL
   * @returns {boolean} True if the path points to an image file
   */
  static isImage(path) {
    if (!path) return false;
    const ext = path.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext);
  }

  /**
   * Gets the media type from a file path.
   *
   * @param {string} path - File path or URL
   * @returns {'video'|'image'|'unknown'} The media type
   */
  static getMediaType(path) {
    if (MediaHandler.isVideo(path)) return 'video';
    if (MediaHandler.isImage(path)) return 'image';
    return 'unknown';
  }

  /**
   * Preloads a media file to improve transition smoothness.
   *
   * @param {string} path - File path or URL
   * @returns {Promise<HTMLElement>} Promise resolving to the loaded element
   */
  static preloadMedia(path) {
    return new Promise((resolve, reject) => {
      const isVideo = MediaHandler.isVideo(path);

      if (isVideo) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.src = path;
        video.addEventListener('canplaythrough', () => resolve(video), { once: true });
        video.addEventListener('error', reject, { once: true });
        video.load();
      } else {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = path;
      }
    });
  }
}
