/**
 * @file MusicRequestManager.js
 * @description Manages music requests from players to GMs.
 * Shows beautiful toast notifications for incoming requests with approve/deny actions.
 *
 * @module data/MusicRequestManager
 */

import { CONFIG } from '../config.js';
import { SocketHandler } from './SocketHandler.js';
import { format } from '../utils/i18n.js';

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

    // Store the pending request
    this.pendingRequests.set(request.requestId, request);

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'es-music-request';
    toast.dataset.requestId = request.requestId;

    toast.innerHTML = `
      <div class="es-music-request__icon">
        <i class="fas fa-music"></i>
      </div>
      <div class="es-music-request__content">
        <div class="es-music-request__header">
          <span class="es-music-request__title">Music Request</span>
          <button class="es-music-request__close" data-action="dismiss" title="Dismiss">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="es-music-request__body">
          <span class="es-music-request__player">${request.characterName || request.userName}</span>
          <span class="es-music-request__wants">wants to play</span>
          <span class="es-music-request__track">"${request.trackName}"</span>
        </div>
        <div class="es-music-request__actions">
          <button class="es-music-request__btn es-music-request__btn--approve" data-action="approve">
            <i class="fas fa-check"></i>
            Approve
          </button>
          <button class="es-music-request__btn es-music-request__btn--deny" data-action="deny">
            <i class="fas fa-times"></i>
            Deny
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
