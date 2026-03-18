/**
 * @file MusicRequestManager.js
 * @description Manages music requests from players to GMs.
 * Shows beautiful toast notifications for incoming requests with approve/deny actions.
 *
 * @module data/MusicRequestManager
 */

import { CONFIG } from '../config.js';
import { SocketHandler } from './SocketHandler.js';
import { format, localize } from '../utils/i18n.js';
import {
  isYouTubeEmbedBlockedCode,
  normalizeYouTubeUrl,
  validateYouTubeEmbed
} from '../utils/youtube-embed-validator.js';

/**
 * Manages music request notifications and actions.
 * Shows non-intrusive but noticeable toast notifications for GMs.
 *
 * @class MusicRequestManager
 */
export class MusicRequestManager {
  /** @type {Map<string, Object>} Active pending requests */
  static pendingRequests = new Map();

  /** @type {HTMLElement|null} Toast container element */
  static container = null;

  /**
   * Escape dynamic text before injecting into toast HTML.
   * @param {string} value - Dynamic text value
   * @returns {string} Escaped string
   */
  static _escapeText(value) {
    return foundry.utils.escapeHTML(`${value ?? ''}`);
  }

  /**
   * Shared localized labels used by GM request toasts.
   * @returns {{close: string, play: string, cancel: string, requestTitle: string, addTitle: string, playIntent: string, addIntent: string}}
   */
  static _getToastLabels() {
    return {
      close: localize('Common.Close'),
      play: localize('Common.Play'),
      cancel: localize('Common.Cancel'),
      requestTitle: localize('Picker.RequestMusic'),
      addTitle: format('MusicRequest.YouTubeAddTitle'),
      playIntent: format('MusicRequest.WantsToPlay'),
      addIntent: format('MusicRequest.WantsToAddAndPlay')
    };
  }

  /**
   * Initialize the music request manager.
   * Creates the toast container if needed.
   */
  static initialize() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'es-music-requests';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show a music request notification to the GM.
   * @param {Object} request - The request data
   * @param {string} request.requestId - Unique request ID
   * @param {string} request.userId - Requesting user ID
   * @param {string} request.userName - Requesting user name
   * @param {string} request.characterId - Character ID
   * @param {string} request.characterName - Character name
   * @param {string} request.playlistId - Playlist ID
   * @param {string} request.trackId - Track ID
   * @param {string} request.trackName - Track name
   */
  static showRequest(request) {
    this.initialize();
    const labels = this._getToastLabels();
    const requesterName = this._escapeText(request.characterName || request.userName);
    const trackName = this._escapeText(request.trackName);

    // Store the pending request
    this.pendingRequests.set(request.requestId, request);

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'es-music-request';
    toast.dataset.requestId = request.requestId;

    toast.innerHTML = `
      <div class="es-music-request__icon">
        <i class="fas fa-play-circle"></i>
      </div>
      <div class="es-music-request__content">
        <div class="es-music-request__header">
          <span class="es-music-request__title">${labels.requestTitle}</span>
          <button class="es-music-request__close" data-action="dismiss" title="${labels.close}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="es-music-request__body">
          <span class="es-music-request__player">${requesterName}</span>
          <span class="es-music-request__wants">${labels.playIntent}</span>
          <span class="es-music-request__track">"${trackName}"</span>
        </div>
        <div class="es-music-request__actions">
          <button class="es-music-request__btn es-music-request__btn--approve" data-action="approve">
            <i class="fas fa-check"></i>
            ${labels.play}
          </button>
          <button class="es-music-request__btn es-music-request__btn--deny" data-action="deny">
            <i class="fas fa-times"></i>
            ${labels.cancel}
          </button>
        </div>
      </div>
      <div class="es-music-request__progress"></div>
    `;

    // Add event listeners
    toast.querySelector('[data-action="approve"]').addEventListener('click', () => {
      this.approveRequest(request.requestId);
    });

    toast.querySelector('[data-action="deny"]').addEventListener('click', () => {
      this.denyRequest(request.requestId);
    });

    toast.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
      this.dismissRequest(request.requestId);
    });

    // Add to container with animation
    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('es-music-request--visible');
    });

    // Play a subtle notification sound
    this.playNotificationSound();

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (this.pendingRequests.has(request.requestId)) {
        this.dismissRequest(request.requestId);
      }
    }, 30000);
  }

  /**
   * Approve a music request.
   * @param {string} requestId - The request ID to approve
   */
  static approveRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    SocketHandler.emitMusicRequestApprove({
      requestId: request.requestId,
      playlistId: request.playlistId,
      trackId: request.trackId,
      trackName: request.trackName,
      userId: request.userId
    });

    this.removeToast(requestId);
    this.pendingRequests.delete(requestId);

    ui.notifications.info(format('Notifications.MusicRequestPlaying', { track: request.trackName, player: request.userName }));
  }

  /**
   * Deny a music request.
   * @param {string} requestId - The request ID to deny
   */
  static denyRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    SocketHandler.emitMusicRequestDeny({
      requestId: request.requestId,
      trackName: request.trackName,
      userId: request.userId
    });

    this.removeToast(requestId);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Dismiss a request without approving or denying.
   * @param {string} requestId - The request ID to dismiss
   */
  static dismissRequest(requestId) {
    this.removeToast(requestId);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Remove a toast from the DOM.
   * @param {string} requestId - The request ID
   */
  static removeToast(requestId) {
    const toast = this.container?.querySelector(`[data-request-id="${requestId}"]`);
    if (toast) {
      toast.classList.remove('es-music-request--visible');
      toast.classList.add('es-music-request--leaving');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }

  /**
   * Show a YouTube music add request notification to the GM.
   * @param {Object} request - The request data
   * @param {string} request.requestId - Unique request ID
   * @param {string} request.userId - Requesting user ID
   * @param {string} request.userName - Requesting user name
   * @param {string} request.characterId - Character ID
   * @param {string} request.characterName - Character name
   * @param {string} request.playlistId - Target playlist ID
   * @param {string} request.trackName - Track display name
   * @param {string} request.trackUrl - YouTube URL
   */
  static showAddRequest(request) {
    this.initialize();
    const labels = this._getToastLabels();
    this.pendingRequests.set(request.requestId, { ...request, _isAddRequest: true });

    const requesterName = this._escapeText(request.characterName || request.userName);
    const trackName = this._escapeText(request.trackName);
    const truncatedUrl = request.trackUrl.length > 45
      ? request.trackUrl.substring(0, 45) + '...'
      : request.trackUrl;
    const safeUrl = this._escapeText(truncatedUrl);

    const toast = document.createElement('div');
    toast.className = 'es-music-request';
    toast.dataset.requestId = request.requestId;

    toast.innerHTML = `
      <div class="es-music-request__icon es-music-request__icon--youtube">
        <i class="fab fa-youtube"></i>
      </div>
      <div class="es-music-request__content">
        <div class="es-music-request__header">
          <span class="es-music-request__title es-music-request__title--youtube">${labels.addTitle}</span>
          <button class="es-music-request__close" data-action="dismiss" title="${labels.close}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="es-music-request__body">
          <span class="es-music-request__player">${requesterName}</span>
          <span class="es-music-request__wants">${labels.addIntent}</span>
          <span class="es-music-request__track">"${trackName}"</span>
        </div>
        <div class="es-music-request__url-preview">
          <i class="fab fa-youtube"></i>
          <span>${safeUrl}</span>
        </div>
        <div class="es-music-request__actions">
          <button class="es-music-request__btn es-music-request__btn--approve" data-action="approve">
            <i class="fas fa-check"></i>
            ${labels.play}
          </button>
          <button class="es-music-request__btn es-music-request__btn--deny" data-action="deny">
            <i class="fas fa-times"></i>
            ${labels.cancel}
          </button>
        </div>
      </div>
      <div class="es-music-request__progress"></div>
    `;

    toast.querySelector('[data-action="approve"]').addEventListener('click', () => {
      this.approveAddRequest(request.requestId);
    });
    toast.querySelector('[data-action="deny"]').addEventListener('click', () => {
      this.denyAddRequest(request.requestId);
    });
    toast.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
      this.dismissRequest(request.requestId);
    });

    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('es-music-request--visible'));
    this.playNotificationSound();

    setTimeout(() => {
      if (this.pendingRequests.has(request.requestId)) {
        this.dismissRequest(request.requestId);
      }
    }, 30000);
  }

  /**
   * Approve a YouTube music add request.
   * Adds the track to the NJ playlist and starts playing it.
   * @param {string} requestId - The request ID to approve
   */
  static async approveAddRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    this.removeToast(requestId);
    this.pendingRequests.delete(requestId);

    try {
      const { NarratorJukeboxIntegration } = await import('./NarratorJukeboxIntegration.js');
      const rawTrackUrl = String(request.trackUrl ?? '').trim();
      const normalizedTrackUrl = normalizeYouTubeUrl(rawTrackUrl);
      const validation = await validateYouTubeEmbed(normalizedTrackUrl);

      if (!validation.ok && isYouTubeEmbedBlockedCode(validation.code)) {
        ui.notifications.warn(format('MusicPicker.AddYouTubeBlocked', { code: validation.code ?? 'unknown' }));
        SocketHandler.emitMusicAddDeny({
          requestId: request.requestId,
          trackName: request.trackName,
          userId: request.userId
        });
        return;
      }

      if (!validation.ok && validation.reason !== 'invalid-url') {
        ui.notifications.warn(localize('MusicPicker.AddValidationUnavailable'));
      }

      const result = await NarratorJukeboxIntegration.addMusicToPlaylist(
        request.playlistId,
        { name: request.trackName, url: normalizedTrackUrl, source: 'youtube' }
      );

      if (result?.track) {
        const trackId = result.track.id || result.track._id;
        SocketHandler.emitMusicAddApprove({
          requestId: request.requestId,
          playlistId: request.playlistId,
          trackName: request.trackName,
          trackUrl: normalizedTrackUrl,
          userId: request.userId,
          newTrackId: trackId
        });

        // World setting propagation to player clients lags behind the GM write path.
        // Give NJ a fuller window here so playback starts closer to the "manual add,
        // then play a moment later" flow that is known to be stable.
        await new Promise(resolve => setTimeout(resolve, 2000));
        await NarratorJukeboxIntegration.playTrack(request.playlistId, trackId);
        NarratorJukeboxIntegration.invalidateCache();

        ui.notifications.info(format('Notifications.MusicAddPlaying', { track: request.trackName, player: request.userName }));
      } else {
        ui.notifications.error(format('Notifications.MusicAddFailed', { track: request.trackName }));
      }
    } catch (e) {
      console.error('Exalted Scenes | Failed to add YouTube track:', e);
      ui.notifications.error(format('Notifications.MusicAddFailed', { track: request.trackName }));
    }
  }

  /**
   * Deny a YouTube music add request.
   * @param {string} requestId - The request ID to deny
   */
  static denyAddRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    SocketHandler.emitMusicAddDeny({
      requestId: request.requestId,
      trackName: request.trackName,
      userId: request.userId
    });

    this.removeToast(requestId);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Play a subtle notification sound.
   */
  static playNotificationSound() {
    try {
      // Use Foundry's built-in notification sound or a subtle beep
      const sound = new Audio('sounds/notify.wav');
      sound.volume = 0.3;
      sound.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch (e) {
      // Ignore sound errors
    }
  }
}
