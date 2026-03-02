/**
 * Player Widget - Compact player for non-GM users
 * Shows current track, progress, and volume control with tabs for Music/Ambience
 */

import { JUKEBOX, PROGRESS_UPDATE_INTERVAL } from '../core/constants.js';
import { formatTime } from '../utils/time-format.js';
import { playbackService } from '../services/playback-service.js';
import { ambienceLayerManager } from '../core/ambience-layer-manager.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';

const WIDGET_POSITION_KEY = 'narrator-jukebox-player-widget-position';

export class PlayerWidget {
  constructor() {
    this.element = null;
    this.isVisible = false;
    this.isDragging = false;
    this.isCompact = false; // Compact mode (micro bar)
    this.activeTab = 'music';
    this.position = this._loadPosition() || { left: window.innerWidth - 160, top: 100 };
    this._progressInterval = null;
    this._audioBlocked = false; // True if autoplay was blocked
    this._expectedLayerCount = 0; // Expected layer count when autoplay blocked
    this._userHasInteracted = false; // True after first user interaction
    this._pendingSync = null; // Pending sync state to apply after interaction

    // Bind methods
    this._onRemoteCommand = this._onRemoteCommand.bind(this);
    this._onStateChanged = this._onStateChanged.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onAutoplayBlocked = this._onAutoplayBlocked.bind(this);
    this._onFirstInteraction = this._onFirstInteraction.bind(this);
  }

  /**
   * Initialize the widget - call this for non-GM users only
   */
  initialize() {
    // Only for non-GM players
    if (game.user.isGM) {
      return;
    }

    debugLog('Initializing PlayerWidget for player');

    // Register hook listeners
    Hooks.on('narratorJukeboxRemoteCommand', this._onRemoteCommand);
    Hooks.on('narratorJukeboxStateChanged', this._onStateChanged);
    Hooks.on('narratorJukeboxAutoplayBlocked', this._onAutoplayBlocked);

    // Listen for window resize
    window.addEventListener('resize', this._onWindowResize);

    // Listen for first user interaction to unlock audio
    document.addEventListener('click', this._onFirstInteraction, { once: true });
    document.addEventListener('keydown', this._onFirstInteraction, { once: true });

    // Create the DOM element (hidden initially)
    this._createWidget();

    // Check if something is already playing (player joined mid-session)
    const layerCount = this._getAmbienceLayerCount();
    if (playbackService.isPlaying || layerCount > 0) {
      this.show();
      // If layers are active but no music, switch to ambience tab
      if (!playbackService.isPlaying && layerCount > 0) {
        this.activeTab = 'ambience';
        this._render();
      }
    }
  }

  /**
   * Handle first user interaction - unlocks audio context
   */
  _onFirstInteraction() {
    if (this._userHasInteracted) return;

    debugLog('First user interaction detected, audio unlocked');
    this._userHasInteracted = true;

    // Mark interaction in the ambience layer manager - this will apply deferred state
    ambienceLayerManager.markUserInteracted();

    // Clear our local pending state since ambienceLayerManager handles it now
    this._pendingSync = null;
    this._audioBlocked = false;
    this._expectedLayerCount = 0;

    // Remove the other listener
    document.removeEventListener('click', this._onFirstInteraction);
    document.removeEventListener('keydown', this._onFirstInteraction);

    // Re-render to update UI
    this._render();
  }

  /**
   * Create the widget DOM element
   */
  _createWidget() {
    this.element = document.createElement('div');
    this.element.className = 'narrator-jukebox-player-widget hidden';
    this.element.innerHTML = this._renderHTML();

    // Set initial position
    this._applyPosition();

    // Append to body
    document.body.appendChild(this.element);

    // Activate listeners
    this._activateListeners();
  }

  /**
   * Apply position to element with bounds checking
   */
  _applyPosition() {
    const maxLeft = window.innerWidth - 150;
    const maxTop = window.innerHeight - 250;

    this.position.left = Math.max(10, Math.min(this.position.left, maxLeft));
    this.position.top = Math.max(10, Math.min(this.position.top, maxTop));

    this.element.style.left = `${this.position.left}px`;
    this.element.style.top = `${this.position.top}px`;
  }

  /**
   * Get current track based on active tab
   */
  _getCurrentTrack() {
    if (this.activeTab === 'music') {
      return playbackService.getCurrentMusicTrack();
    } else {
      return playbackService.getCurrentAmbienceTrack();
    }
  }

  /**
   * Get current playing state based on active tab
   */
  _isCurrentlyPlaying() {
    if (this.activeTab === 'music') {
      return playbackService.isPlaying;
    } else {
      return playbackService.isAmbiencePlaying;
    }
  }

  /**
   * Get current volume based on active tab
   */
  _getCurrentVolume() {
    if (this.activeTab === 'music') {
      return playbackService.channels?.music?.volume ?? 0.8;
    } else {
      // Ambience tab uses master volume for layers
      return playbackService.getAmbienceMasterVolume?.() ?? 0.8;
    }
  }

  /**
   * Get muted state based on active tab
   */
  _isMuted() {
    if (this.activeTab === 'music') {
      return playbackService.isMuted;
    } else {
      // Ambience tab uses master mute for layers
      return playbackService.isAmbienceMasterMuted?.() ?? false;
    }
  }

  /**
   * Get active ambience layers data
   */
  _getActiveAmbienceLayers() {
    return playbackService.getActiveAmbienceLayers?.() || [];
  }

  /**
   * Get ambience layer count (includes deferred/pending layers if audio is blocked)
   */
  _getAmbienceLayerCount() {
    const active = playbackService.getAmbienceLayerCount?.() || 0;

    // Check for deferred state in ambienceLayerManager
    const deferred = ambienceLayerManager.getDeferredLayerCount?.() || 0;
    if (deferred > 0) {
      return Math.max(active, deferred);
    }

    // Fallback to local tracking if audio is blocked
    if (this._audioBlocked && this._expectedLayerCount) {
      return Math.max(active, this._expectedLayerCount);
    }
    return active;
  }

  /**
   * Render HTML content
   */
  _renderHTML() {
    const isMusicPlaying = playbackService.isPlaying;
    const ambienceLayerCount = this._getAmbienceLayerCount();

    // Compact mode - just a tiny bar with indicators
    if (this.isCompact) {
      return `
        <div class="pw-compact-bar">
          <div class="pw-compact-indicators">
            <span class="pw-compact-icon ${isMusicPlaying ? 'active' : ''}" title="Music">
              <i class="fas fa-music"></i>
            </span>
            <span class="pw-compact-icon ${ambienceLayerCount > 0 ? 'active' : ''}" title="${ambienceLayerCount} Ambience Layer${ambienceLayerCount !== 1 ? 's' : ''}">
              <i class="fas fa-layer-group"></i>
              ${ambienceLayerCount > 0 ? `<span class="pw-layer-badge">${ambienceLayerCount}</span>` : ''}
            </span>
          </div>
          <button class="pw-expand-btn" title="Expand">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
      `;
    }

    // Expanded mode - full widget
    const activeLayers = this._getActiveAmbienceLayers();
    const layerCount = activeLayers.length;

    // Music tab data
    const currentTrack = this._getCurrentTrack();
    const isPlaying = this._isCurrentlyPlaying();
    const volume = this._getCurrentVolume();
    const isMuted = this._isMuted();

    // Get progress (only for music)
    let current = 0, duration = 0, percent = 0;
    if (this.activeTab === 'music') {
      const progress = playbackService.getMusicProgress();
      current = progress.current;
      duration = progress.duration;
      percent = progress.percent;
    }

    // Ambience master volume
    const masterVolume = playbackService.getAmbienceMasterVolume?.() ?? 0.8;
    const isMasterMuted = playbackService.isAmbienceMasterMuted?.() ?? false;

    return `
      <div class="pw-header">
        <div class="pw-tabs">
          <button class="pw-tab pw-tab-music ${this.activeTab === 'music' ? 'active' : ''}" data-tab="music" title="Music">
            <i class="fas fa-music"></i>
            <span class="pw-indicator ${isMusicPlaying ? 'active' : ''}"></span>
          </button>
          <button class="pw-tab pw-tab-ambience ${this.activeTab === 'ambience' ? 'active' : ''}" data-tab="ambience" title="Ambience Layers">
            <i class="fas fa-layer-group"></i>
            <span class="pw-indicator ${layerCount > 0 ? 'active' : ''}"></span>
            ${layerCount > 0 ? `<span class="pw-tab-badge">${layerCount}</span>` : ''}
          </button>
        </div>
        <div class="pw-header-actions">
          <button class="pw-minimize-btn" title="Minimize">
            <i class="fas fa-chevron-up"></i>
          </button>
          <button class="pw-close" title="Hide widget">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      ${this.activeTab === 'music' ? `
        <div class="pw-artwork ${isPlaying ? 'pulsing' : ''}">
          ${currentTrack?.thumbnail
            ? `<img src="${currentTrack.thumbnail}" alt="${currentTrack.name}">`
            : `<div class="pw-art-placeholder"><i class="fas fa-music"></i></div>`
          }
        </div>

        <div class="pw-track-name" title="${currentTrack?.name || 'No Track'}">${currentTrack?.name || 'No Track'}</div>

        <div class="pw-progress">
          <span class="pw-time pw-current">${formatTime(current)}</span>
          <div class="pw-progress-bar">
            <div class="pw-progress-fill" style="width: ${percent}%"></div>
          </div>
          <span class="pw-time pw-duration">${formatTime(duration)}</span>
        </div>

        <div class="pw-volume">
          <button class="pw-vol-btn" id="pw-mute" title="${isMuted ? 'Unmute' : 'Mute'}">
            <i class="fas ${this._getVolumeIcon(volume, isMuted)}"></i>
          </button>
          <input type="range" class="pw-vol-slider" id="pw-volume-slider" min="0" max="100" value="${isMuted ? 0 : volume * 100}">
        </div>
      ` : `
        <!-- Ambience Layers Tab -->
        ${(this._audioBlocked || this._pendingSync || ambienceLayerManager.hasDeferredState?.()) ? `
        <div class="pw-audio-blocked">
          <button class="pw-enable-audio-btn" title="Click to enable audio">
            <i class="fas fa-volume-up"></i>
            <span>Click to Enable Audio</span>
          </button>
          <span class="pw-audio-blocked-hint">Click anywhere to start audio</span>
        </div>
        ` : ''}
        <div class="pw-layers-section">
          ${layerCount > 0 ? `
            <div class="pw-layers-list">
              ${activeLayers.map(layer => {
                const name = layer.track?.name || 'Unknown';
                const thumbnail = layer.track?.thumbnail;
                const volume = layer.volume ?? 0.8;
                return `
                <div class="pw-layer-item">
                  <div class="pw-layer-thumb">
                    ${thumbnail
                      ? `<img src="${thumbnail}" alt="${name}">`
                      : `<i class="fas fa-layer-group"></i>`
                    }
                  </div>
                  <span class="pw-layer-name" title="${name}">${name}</span>
                  <div class="pw-layer-vol-indicator" style="--vol: ${Math.round(volume * 100)}%"></div>
                </div>
              `;
              }).join('')}
            </div>
            <div class="pw-layers-count">${layerCount} layer${layerCount !== 1 ? 's' : ''} active</div>
          ` : `
            <div class="pw-no-layers">
              <i class="fas fa-layer-group"></i>
              <span>No ambience layers</span>
            </div>
          `}
        </div>

        <div class="pw-volume">
          <button class="pw-vol-btn" id="pw-mute" title="${isMasterMuted ? 'Unmute All' : 'Mute All'}">
            <i class="fas ${this._getVolumeIcon(masterVolume, isMasterMuted)}"></i>
          </button>
          <input type="range" class="pw-vol-slider" id="pw-volume-slider" min="0" max="100" value="${isMasterMuted ? 0 : masterVolume * 100}">
        </div>
      `}
    `;
  }

  _getVolumeIcon(volume, isMuted) {
    if (isMuted || volume === 0) return 'fa-volume-mute';
    if (volume > 0.5) return 'fa-volume-up';
    return 'fa-volume-down';
  }

  /**
   * Activate widget event listeners
   */
  _activateListeners() {
    // Compact mode listeners
    if (this.isCompact) {
      // Expand button
      const expandBtn = this.element.querySelector('.pw-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          this.isCompact = false;
          this._updateCompactClass();
          this._render();
        });
      }
      // Drag functionality
      this._initDrag();
      return;
    }

    // Expanded mode listeners

    // Tab switching
    this.element.querySelectorAll('.pw-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const newTab = e.currentTarget.dataset.tab;
        if (newTab !== this.activeTab) {
          this.activeTab = newTab;
          this._render();
        }
      });
    });

    // Minimize button
    const minimizeBtn = this.element.querySelector('.pw-minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        this.isCompact = true;
        this._updateCompactClass();
        this._render();
      });
    }

    // Close button
    this.element.querySelector('.pw-close').addEventListener('click', () => {
      this.hide();
    });

    // Volume slider
    const volSlider = this.element.querySelector('#pw-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value) / 100;

        if (this.activeTab === 'music') {
          playbackService.setVolume('music', vol);
          // Persist preference
          game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME, vol);
        } else {
          // Ambience tab - use master volume for layers
          playbackService.setAmbienceMasterVolume?.(vol);
        }

        this._updateVolumeIcon();
      });
    }

    // Mute button
    const muteBtn = this.element.querySelector('#pw-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (this.activeTab === 'music') {
          playbackService.toggleMute('music');
        } else {
          // Ambience tab - use master mute for layers
          playbackService.toggleAmbienceMasterMute?.();
        }
        this._updateVolumeIcon();
        this._updateVolumeSlider();
      });
    }

    // Enable audio button (for autoplay blocked)
    const enableAudioBtn = this.element.querySelector('.pw-enable-audio-btn');
    if (enableAudioBtn) {
      enableAudioBtn.addEventListener('click', () => this._enableAudio());
    }

    // Drag functionality
    this._initDrag();
  }

  /**
   * Update compact class on element
   */
  _updateCompactClass() {
    if (this.isCompact) {
      this.element.classList.add('compact');
    } else {
      this.element.classList.remove('compact');
    }
  }

  /**
   * Initialize drag functionality (entire widget is draggable)
   */
  _initDrag() {
    let startX, startY, startLeft, startTop;

    const onMouseDown = (e) => {
      // Skip if clicking on interactive elements
      if (e.target.closest('button, input, .pw-tab')) {
        return;
      }

      this.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.position.left;
      startTop = this.position.top;
      this.element.classList.add('dragging');
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Bounds checking
      const maxLeft = window.innerWidth - 150;
      const maxTop = window.innerHeight - 250;

      this.position.left = Math.max(10, Math.min(maxLeft, startLeft + dx));
      this.position.top = Math.max(10, Math.min(maxTop, startTop + dy));

      this.element.style.left = `${this.position.left}px`;
      this.element.style.top = `${this.position.top}px`;
    };

    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.element.classList.remove('dragging');
        this._savePosition();
      }
    };

    this.element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Save position to localStorage
   */
  _savePosition() {
    localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(this.position));
  }

  /**
   * Load position from localStorage
   */
  _loadPosition() {
    const saved = localStorage.getItem(WIDGET_POSITION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        debugWarn('Failed to parse player widget position');
      }
    }
    return null;
  }

  /**
   * Show the widget
   */
  show() {
    if (this.isVisible) return;

    this.isVisible = true;
    this.element.classList.remove('hidden');
    this.element.classList.add('appearing');

    // Remove animation class after it completes
    setTimeout(() => {
      this.element.classList.remove('appearing');
    }, 300);

    // Start progress updates
    this._startProgressUpdates();

    // Re-render to get latest state
    this._render();
  }

  /**
   * Hide the widget
   */
  hide() {
    this.isVisible = false;
    this.element.classList.add('hidden');
    this._stopProgressUpdates();
  }

  /**
   * Re-render the widget content
   */
  _render() {
    if (!this.element) return;
    this.element.innerHTML = this._renderHTML();
    this._activateListeners();
  }

  /**
   * Start progress bar updates
   */
  _startProgressUpdates() {
    if (this._progressInterval) return;

    this._progressInterval = setInterval(() => {
      if (this.isVisible && this.activeTab === 'music') {
        this._updateProgress();
      }
    }, PROGRESS_UPDATE_INTERVAL);
  }

  /**
   * Stop progress bar updates
   */
  _stopProgressUpdates() {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
  }

  /**
   * Update just the progress bar (partial update for performance)
   */
  _updateProgress() {
    const { current, duration, percent } = playbackService.getMusicProgress();

    const fillEl = this.element.querySelector('.pw-progress-fill');
    const currentEl = this.element.querySelector('.pw-current');
    const durationEl = this.element.querySelector('.pw-duration');

    if (fillEl) fillEl.style.width = `${percent}%`;
    if (currentEl) currentEl.textContent = formatTime(current);
    if (durationEl) durationEl.textContent = formatTime(duration);
  }

  /**
   * Update tab indicators
   */
  _updateTabIndicators() {
    const musicIndicator = this.element.querySelector('.pw-tab-music .pw-indicator');
    const ambienceIndicator = this.element.querySelector('.pw-tab-ambience .pw-indicator');
    const ambienceBadge = this.element.querySelector('.pw-tab-ambience .pw-tab-badge');
    const layerCount = this._getAmbienceLayerCount();

    if (musicIndicator) {
      musicIndicator.classList.toggle('active', playbackService.isPlaying);
    }
    if (ambienceIndicator) {
      ambienceIndicator.classList.toggle('active', layerCount > 0);
    }
    // Update layer count badge
    if (ambienceBadge) {
      ambienceBadge.textContent = layerCount;
      ambienceBadge.style.display = layerCount > 0 ? '' : 'none';
    }
  }

  /**
   * Update volume icon based on current state
   */
  _updateVolumeIcon() {
    const vol = this._getCurrentVolume();
    const isMuted = this._isMuted();
    const icon = this.element.querySelector('#pw-mute i');
    if (icon) {
      icon.className = `fas ${this._getVolumeIcon(vol, isMuted)}`;
    }
  }

  /**
   * Update volume slider value
   */
  _updateVolumeSlider() {
    const vol = this._getCurrentVolume();
    const isMuted = this._isMuted();
    const slider = this.element.querySelector('#pw-volume-slider');
    if (slider) {
      slider.value = isMuted ? 0 : vol * 100;
    }
  }

  // ==========================================
  // Event Handlers
  // ==========================================

  /**
   * Handle remote command received from GM
   */
  _onRemoteCommand(payload) {
    // Show widget when playback starts
    if (payload.action === 'play' || payload.action === 'resume') {
      this.show();
      // Auto-switch to the channel that started playing
      if (payload.channel) {
        this.activeTab = payload.channel;
      }
      this._render();
    }
    // Keep visible but update when paused
    else if (payload.action === 'pause') {
      this._render();
    }
    // Update on stop
    else if (payload.action === 'stop') {
      this._render();
    }
    // Update slider when GM broadcasts volume change
    else if (payload.action === 'volume') {
      this._updateVolumeSlider();
      this._updateVolumeIcon();
    }
    // Handle ambience layers sync
    else if (payload.action === 'ambienceLayers' || payload.action === 'ambienceLayersStopAll') {
      const layerCount = this._getAmbienceLayerCount();
      if (layerCount > 0) {
        this.show();
        this.activeTab = 'ambience';
      }
      this._render();
    }
    // Handle state sync (player joining mid-session)
    else if (payload.action === 'syncState') {
      const layerCount = this._getAmbienceLayerCount();
      const expectedLayers = payload.ambienceLayersState?.layers?.length || 0;

      // Check if ambienceLayerManager has deferred state (audio blocked)
      if (ambienceLayerManager.hasDeferredState?.()) {
        debugLog(`Deferred state detected, showing audio banner`);
        this._audioBlocked = true;
        this._expectedLayerCount = ambienceLayerManager.getDeferredLayerCount?.() || expectedLayers;
        this.activeTab = 'ambience';
      }
      // Fallback: If there are expected layers but none playing and user hasn't interacted
      else if (expectedLayers > 0 && !this._userHasInteracted) {
        debugLog(`Sync received before interaction, expected ${expectedLayers} layers`);
        this._pendingSync = { expectedLayers, pendingCount: expectedLayers };
        this._audioBlocked = true;
        this._expectedLayerCount = expectedLayers;
        this.activeTab = 'ambience';
      }

      if (payload.isPlaying || layerCount > 0 || payload.musicTrackId || expectedLayers > 0) {
        this.show();
      }
      this._render();
    }

    // Always update indicators
    this._updateTabIndicators();
  }

  /**
   * Handle general state changes
   */
  _onStateChanged() {
    if (this.isVisible) {
      // If on ambience tab, do a full re-render to update layer list
      if (this.activeTab === 'ambience') {
        this._render();
        return;
      }

      this._updateTabIndicators();
      // Update artwork pulsing state
      const artworkEl = this.element.querySelector('.pw-artwork');
      if (artworkEl) {
        const isPlaying = this._isCurrentlyPlaying();
        artworkEl.classList.toggle('pulsing', isPlaying);
      }
    }
  }

  /**
   * Handle autoplay blocked event
   */
  _onAutoplayBlocked({ count, expected, actual, deferred }) {
    debugLog(`Autoplay blocked - expected: ${expected}, actual: ${actual}, pending: ${count}, deferred: ${deferred}`);

    // Store pending sync info
    this._pendingSync = {
      expectedLayers: expected || count,
      pendingCount: count,
      deferred: deferred || false
    };

    this._audioBlocked = true;
    this._expectedLayerCount = expected || count;
    this.show();
    this.activeTab = 'ambience';
    this._render();
  }

  /**
   * Handle click to enable audio after autoplay block
   */
  async _enableAudio() {
    debugLog('User clicked to enable audio');
    this._audioBlocked = false;
    this._pendingSync = null;
    this._userHasInteracted = true;

    try {
      // Mark interaction - this will apply deferred state in ambienceLayerManager
      ambienceLayerManager.markUserInteracted();

      // Also try any pending layers from playbackService (fallback)
      await playbackService.retryAmbiencePendingLayers?.();

      // Check if we have layers now
      const currentCount = playbackService.getAmbienceLayerCount?.() || 0;
      if (currentCount > 0) {
        ui.notifications.info('Narrator Jukebox: Audio enabled!');
      } else if (this._expectedLayerCount > 0) {
        // If still no layers, request a full re-sync from GM
        debugLog('No layers after retry, requesting full re-sync');
        const syncService = game.modules.get('narrator-jukebox')?.api?._syncService;
        if (syncService) {
          syncService.requestState();
        }
        ui.notifications.info('Narrator Jukebox: Syncing audio...');
      }

      this._expectedLayerCount = 0;
    } catch (err) {
      debugError('Failed to enable audio:', err);
      // Still try re-sync as fallback
      const syncService = game.modules.get('narrator-jukebox')?.api?._syncService;
      if (syncService) {
        syncService.requestState();
      }
    }

    this._render();
  }

  /**
   * Handle window resize
   */
  _onWindowResize() {
    if (this.isVisible) {
      this._applyPosition();
    }
  }

  /**
   * Cleanup - call when module is disabled
   */
  destroy() {
    this._stopProgressUpdates();
    Hooks.off('narratorJukeboxRemoteCommand', this._onRemoteCommand);
    Hooks.off('narratorJukeboxStateChanged', this._onStateChanged);
    Hooks.off('narratorJukeboxAutoplayBlocked', this._onAutoplayBlocked);
    window.removeEventListener('resize', this._onWindowResize);
    document.removeEventListener('click', this._onFirstInteraction);
    document.removeEventListener('keydown', this._onFirstInteraction);
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

// Export singleton
export const playerWidget = new PlayerWidget();
