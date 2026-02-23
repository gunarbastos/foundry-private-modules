/**
 * Narrator's Jukebox - Ambience Layer Manager
 * Manages multiple simultaneous ambience layers for creating complex soundscapes
 */

import { MAX_AMBIENCE_LAYERS } from './constants.js';
import { AudioChannel } from './audio-channel.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';

/**
 * Represents a single ambience layer with its own audio channel
 */
class AmbienceLayer {
  constructor(trackId, track, channel) {
    this.trackId = trackId;
    this.track = track;
    this.channel = channel;
    this.volume = 0.8;
    this.isPlaying = true;
    this.addedAt = Date.now();
  }
}

/**
 * AmbienceLayerManager - Manages multiple simultaneous ambience layers
 * Allows GMs to create complex soundscapes by combining multiple ambient sounds
 */
class AmbienceLayerManager {
  constructor() {
    /** @type {Map<string, AmbienceLayer>} */
    this.layers = new Map();

    /** @type {number} Master volume multiplier for all layers (0-1) */
    this.masterVolume = 0.8;

    /** @type {boolean} Master mute state */
    this.isMasterMuted = false;

    /** @type {number} Volume before mute for restore */
    this.volumeBeforeMute = 0.8;

    // Dependencies (injected)
    this.dataService = null;
    this.syncService = null;
    this.isPreviewMode = true;

    // Pending layers (blocked by autoplay policy)
    this._pendingLayers = [];

    // Deferred state (when user hasn't interacted yet)
    this._deferredState = null;
    this._userHasInteracted = game.user?.isGM ?? false; // GM always "interacted"
  }

  /**
   * Initialize the manager with dependencies
   * @param {object} dataService - DataService instance
   * @param {object} syncService - SyncService instance (optional)
   */
  initialize(dataService, syncService = null) {
    this.dataService = dataService;
    this.syncService = syncService;
    // Reset interaction state - GM is always considered "interacted"
    this._userHasInteracted = game.user?.isGM ?? false;
  }

  /**
   * Mark that the user has interacted with the page (unlocks audio)
   * Call this after user clicks/keydown
   */
  markUserInteracted() {
    if (this._userHasInteracted) return;

    debugLog(' User interaction detected, audio unlocked');
    this._userHasInteracted = true;

    // If we have deferred state, apply it now
    if (this._deferredState) {
      debugLog(' Applying deferred ambience state after interaction');
      this._applyDeferredState();
    }
  }

  /**
   * Check if user has interacted
   * @returns {boolean}
   */
  hasUserInteracted() {
    return this._userHasInteracted;
  }

  /**
   * Check if there's deferred state waiting for interaction
   * @returns {boolean}
   */
  hasDeferredState() {
    return this._deferredState !== null;
  }

  /**
   * Get the expected layer count from deferred state
   * @returns {number}
   */
  getDeferredLayerCount() {
    return this._deferredState?.layers?.length ?? 0;
  }

  /**
   * Apply the deferred state (internal)
   * @private
   */
  async _applyDeferredState() {
    if (!this._deferredState) return;

    const state = this._deferredState;
    this._deferredState = null;

    debugLog(`Creating ${state.layers?.length ?? 0} deferred layers`);

    // Restore master volume
    this.masterVolume = state.masterVolume ?? 0.8;
    this.isMasterMuted = state.isMasterMuted ?? false;

    // Create each layer
    for (const layerState of (state.layers || [])) {
      try {
        await this._createLayer(layerState.trackId, layerState.volume ?? 0.8);
      } catch (err) {
        debugWarn(` Failed to create deferred layer ${layerState.trackId}:`, err);
      }
    }

    Hooks.call('narratorJukeboxStateChanged');
    Hooks.call('narratorJukeboxDeferredStateApplied', { layerCount: this.layerCount });
  }

  /**
   * Set preview mode (affects broadcasting)
   * @param {boolean} mode - Preview mode state
   */
  setPreviewMode(mode) {
    this.isPreviewMode = mode;
  }

  /**
   * Get the current number of active layers
   * @returns {number}
   */
  get layerCount() {
    return this.layers.size;
  }

  /**
   * Check if we can add more layers
   * @returns {boolean}
   */
  canAddLayer() {
    return this.layers.size < MAX_AMBIENCE_LAYERS;
  }

  /**
   * Internal method to create and start a layer
   * @private
   */
  async _createLayer(trackId, initialVolume = 0.8) {
    // Check if already at max layers
    if (!this.canAddLayer()) {
      debugWarn(` Cannot add layer: maximum ${MAX_AMBIENCE_LAYERS} layers reached`);
      return null;
    }

    // Check if this track is already playing
    if (this.layers.has(trackId)) {
      debugLog(`Layer already exists for track: ${trackId}`);
      return this.layers.get(trackId);
    }

    // Get track data
    const track = this.dataService.findTrack(trackId, 'ambience');
    if (!track) {
      debugError(` Ambience track not found: ${trackId}`);
      return null;
    }

    // Create a new audio channel for this layer
    const channel = new AudioChannel(`ambience-layer-${trackId}`);
    await channel.initialize();

    // Create the layer with the specified initial volume
    const layer = new AmbienceLayer(trackId, track, channel);
    layer.volume = initialVolume;

    // Apply effective volume to channel (individual * master)
    const effectiveVolume = this.isMasterMuted ? 0 : layer.volume * this.masterVolume;
    channel.volume = effectiveVolume;

    // Start playback
    await channel.play(track);

    // Store the layer
    this.layers.set(trackId, layer);

    debugLog(`Added ambience layer: ${track.name} (${this.layerCount}/${MAX_AMBIENCE_LAYERS})`);

    return layer;
  }

  /**
   * Add a new ambience layer (with broadcast)
   * @param {string} trackId - Track ID to add
   * @param {number} initialVolume - Optional initial volume (0-1), defaults to 0.8
   * @returns {Promise<AmbienceLayer|null>} The created layer or null if failed
   */
  async addLayer(trackId, initialVolume = 0.8) {
    try {
      const layer = await this._createLayer(trackId, initialVolume);
      if (!layer) {
        if (!this.canAddLayer()) {
          ui.notifications.warn(`Maximum ${MAX_AMBIENCE_LAYERS} ambience layers reached`);
        } else if (!this.layers.has(trackId)) {
          ui.notifications.error('Ambience track not found');
        }
        return null;
      }

      // Broadcast incrementally if not in preview mode
      if (game.user.isGM && !this.isPreviewMode && this.syncService) {
        this.syncService.broadcastAmbienceLayerAdd(trackId, initialVolume);
        ui.notifications.info(`Broadcasting ambience: ${layer.track.name}`);
      }

      // Notify UI
      Hooks.call('narratorJukeboxStateChanged');
      Hooks.call('narratorJukeboxAmbienceLayerAdded', { trackId, track: layer.track });

      return layer;
    } catch (err) {
      debugError(` Failed to add ambience layer:`, err);
      throw err;
    }
  }

  /**
   * Add a layer without broadcasting (for sync handler)
   * @param {string} trackId - Track ID to add
   * @param {number} initialVolume - Initial volume (0-1)
   */
  async addLayerWithoutBroadcast(trackId, initialVolume = 0.8) {
    // If user hasn't interacted, defer this layer
    if (!this._userHasInteracted) {
      debugLog(`Deferring layer ${trackId} until user interaction`);

      // Add to deferred state
      if (!this._deferredState) {
        this._deferredState = {
          masterVolume: this.masterVolume,
          isMasterMuted: this.isMasterMuted,
          layers: []
        };
      }

      // Check if already in deferred
      const existing = this._deferredState.layers.find(l => l.trackId === trackId);
      if (!existing) {
        this._deferredState.layers.push({ trackId, volume: initialVolume });
      }

      // Notify UI
      Hooks.call('narratorJukeboxAutoplayBlocked', {
        count: this._deferredState.layers.length,
        expected: this._deferredState.layers.length,
        actual: this.layers.size,
        deferred: true
      });

      return null;
    }

    try {
      const layer = await this._createLayer(trackId, initialVolume);
      if (layer) {
        Hooks.call('narratorJukeboxAmbienceLayerAdded', { trackId, track: layer.track });
      }
      return layer;
    } catch (err) {
      debugError(` Failed to add synced layer:`, err);
      return null;
    }
  }

  /**
   * Internal method to stop and remove a layer
   * @private
   */
  _removeLayer(trackId) {
    const layer = this.layers.get(trackId);
    if (!layer) {
      debugWarn(` Layer not found for track: ${trackId}`);
      return false;
    }

    // Stop and cleanup the channel
    layer.channel.stop();
    this.layers.delete(trackId);

    debugLog(`Removed ambience layer: ${layer.track.name} (${this.layerCount}/${MAX_AMBIENCE_LAYERS})`);
    return true;
  }

  /**
   * Remove an ambience layer (with broadcast)
   * @param {string} trackId - Track ID to remove
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  removeLayer(trackId, broadcast = true) {
    if (!this._removeLayer(trackId)) return false;

    // Broadcast incrementally if not in preview mode
    if (game.user.isGM && broadcast && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceLayerRemove(trackId);
    }

    // Notify UI
    Hooks.call('narratorJukeboxStateChanged');
    Hooks.call('narratorJukeboxAmbienceLayerRemoved', { trackId });

    return true;
  }

  /**
   * Remove a layer without broadcasting (for sync handler)
   * @param {string} trackId - Track ID to remove
   */
  removeLayerWithoutBroadcast(trackId) {
    if (this._removeLayer(trackId)) {
      Hooks.call('narratorJukeboxAmbienceLayerRemoved', { trackId });
    }
  }

  /**
   * Toggle a layer on/off
   * @param {string} trackId - Track ID to toggle
   * @returns {Promise<boolean>} New state (true = playing)
   */
  async toggleLayer(trackId) {
    if (this.layers.has(trackId)) {
      this.removeLayer(trackId);
      return false;
    } else {
      const layer = await this.addLayer(trackId);
      return layer !== null;
    }
  }

  /**
   * Internal method to set layer volume
   * @private
   */
  _setLayerVolume(trackId, volume) {
    const layer = this.layers.get(trackId);
    if (!layer) return false;

    layer.volume = volume;

    // Apply effective volume (considering master volume and mute)
    const effectiveVolume = this.isMasterMuted ? 0 : volume * this.masterVolume;
    layer.channel.setVolume(effectiveVolume);
    return true;
  }

  /**
   * Set volume for a specific layer (with broadcast)
   * @param {string} trackId - Track ID
   * @param {number} volume - Volume value (0-1)
   */
  setLayerVolume(trackId, volume) {
    if (!this._setLayerVolume(trackId, volume)) return;

    // Broadcast incrementally if not in preview mode
    if (game.user.isGM && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceLayerVolume(trackId, volume);
    }
  }

  /**
   * Set layer volume without broadcasting (for sync handler)
   * @param {string} trackId - Track ID
   * @param {number} volume - Volume value (0-1)
   */
  setLayerVolumeWithoutBroadcast(trackId, volume) {
    this._setLayerVolume(trackId, volume);
  }

  /**
   * Get volume for a specific layer
   * @param {string} trackId - Track ID
   * @returns {number} Volume value (0-1)
   */
  getLayerVolume(trackId) {
    const layer = this.layers.get(trackId);
    return layer ? layer.volume : 0;
  }

  /**
   * Internal method to set master volume
   * @private
   */
  _setMasterVolume(volume) {
    this.masterVolume = volume;

    if (this.isMasterMuted && volume > 0) {
      this.isMasterMuted = false;
    }

    // Apply to all layers
    for (const layer of this.layers.values()) {
      const effectiveVolume = this.isMasterMuted ? 0 : layer.volume * volume;
      layer.channel.setVolume(effectiveVolume);
    }
  }

  /**
   * Set master volume for all layers (with broadcast)
   * @param {number} volume - Volume value (0-1)
   */
  setMasterVolume(volume) {
    this._setMasterVolume(volume);

    // Broadcast incrementally if not in preview mode
    if (game.user.isGM && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceMasterVolume(volume);
    }

    // Note: Don't call narratorJukeboxStateChanged here to avoid re-render during slider drag
    // The UI updates the display value directly in the listener
  }

  /**
   * Set master volume without broadcasting (for sync handler)
   * @param {number} volume - Volume value (0-1)
   */
  setMasterVolumeWithoutBroadcast(volume) {
    this._setMasterVolume(volume);
  }

  /**
   * Internal method to set mute state
   * @private
   */
  _setMasterMute(muted) {
    if (muted) {
      // Mute
      this.volumeBeforeMute = this.masterVolume;
      this.isMasterMuted = true;
      for (const layer of this.layers.values()) {
        layer.channel.setVolume(0);
      }
    } else {
      // Unmute
      this.isMasterMuted = false;
      this._setMasterVolume(this.volumeBeforeMute);
    }
  }

  /**
   * Toggle master mute (with broadcast)
   * @returns {boolean} New mute state
   */
  toggleMasterMute() {
    const newMuted = !this.isMasterMuted;
    this._setMasterMute(newMuted);

    // Broadcast incrementally if not in preview mode
    if (game.user.isGM && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceMasterMute(newMuted);
    }

    Hooks.call('narratorJukeboxStateChanged');
    return this.isMasterMuted;
  }

  /**
   * Set master mute without broadcasting (for sync handler)
   * @param {boolean} muted - Mute state
   */
  setMasterMuteWithoutBroadcast(muted) {
    this._setMasterMute(muted);
  }

  /**
   * Stop all ambience layers
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  stopAll(broadcast = true) {
    debugLog(`Stopping all ${this.layerCount} ambience layers`);

    for (const [trackId, layer] of this.layers) {
      layer.channel.stop();
    }
    this.layers.clear();

    // Broadcast if not in preview mode
    if (game.user.isGM && broadcast && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceLayersStopAll();
    }

    Hooks.call('narratorJukeboxStateChanged');
    Hooks.call('narratorJukeboxAmbienceStoppedAll');
  }

  /**
   * Check if a track is currently playing as a layer
   * @param {string} trackId - Track ID to check
   * @returns {boolean}
   */
  isLayerActive(trackId) {
    return this.layers.has(trackId);
  }

  /**
   * Get all active layers as an array
   * @returns {Array<{trackId: string, track: object, volume: number}>}
   */
  getActiveLayers() {
    return Array.from(this.layers.values()).map(layer => ({
      trackId: layer.trackId,
      track: layer.track,
      volume: layer.volume,
      addedAt: layer.addedAt
    }));
  }

  /**
   * Get a serializable state object for sync/presets
   * @returns {object}
   */
  getLayersState() {
    return {
      masterVolume: this.masterVolume,
      isMasterMuted: this.isMasterMuted,
      layers: Array.from(this.layers.values()).map(layer => ({
        trackId: layer.trackId,
        volume: layer.volume
      }))
    };
  }

  /**
   * Restore state from a state object (for sync/presets)
   * @param {object} state - State object from getLayersState()
   * @param {boolean} broadcast - Whether to broadcast after restore (sends full state)
   */
  async restoreState(state, broadcast = false) {
    const expectedLayers = (state.layers || []).length;

    // CRITICAL: If user hasn't interacted yet, defer the entire state
    // This prevents silent autoplay failures
    if (!this._userHasInteracted && expectedLayers > 0) {
      debugLog(`Deferring ${expectedLayers} layers until user interaction`);

      // Stop any existing layers
      for (const [, layer] of this.layers) {
        layer.channel.stop();
      }
      this.layers.clear();
      this._pendingLayers = [];

      // Store state for later
      this._deferredState = {
        masterVolume: state.masterVolume ?? 0.8,
        isMasterMuted: state.isMasterMuted ?? false,
        layers: state.layers || []
      };

      // Notify UI that audio is blocked and waiting for interaction
      Hooks.call('narratorJukeboxAutoplayBlocked', {
        count: expectedLayers,
        expected: expectedLayers,
        actual: 0,
        deferred: true
      });

      Hooks.call('narratorJukeboxStateChanged');
      return;
    }

    // User has interacted - proceed normally
    // Stop all current layers without broadcasting
    for (const [, layer] of this.layers) {
      layer.channel.stop();
    }
    this.layers.clear();

    // Clear any pending/deferred state
    this._pendingLayers = [];
    this._deferredState = null;

    // Restore master volume
    this.masterVolume = state.masterVolume ?? 0.8;
    this.isMasterMuted = state.isMasterMuted ?? false;

    // Restore each layer without individual broadcasts
    for (const layerState of (state.layers || [])) {
      try {
        const volume = layerState.volume ?? 0.8;
        await this._createLayer(layerState.trackId, volume);
      } catch (err) {
        // Check if it's an autoplay policy error (various names for this error)
        const isAutoplayError = err.name === 'NotAllowedError' ||
                                err.message?.includes('play()') ||
                                err.message?.includes('user gesture') ||
                                err.message?.includes('autoplay');

        if (isAutoplayError) {
          debugWarn(` Autoplay blocked for layer ${layerState.trackId}:`, err.message);
          this._pendingLayers.push({ trackId: layerState.trackId, volume });
        } else {
          debugWarn(` Failed to restore layer ${layerState.trackId}:`, err);
          // Also add to pending in case it's a silent autoplay failure
          this._pendingLayers.push({ trackId: layerState.trackId, volume });
        }
      }
    }

    // Notify if there are pending layers (autoplay blocked) or if we have fewer layers than expected
    const actualLayers = this.layers.size;
    if (this._pendingLayers.length > 0 || (expectedLayers > 0 && actualLayers < expectedLayers)) {
      debugLog(`Autoplay detection: expected ${expectedLayers}, got ${actualLayers}, pending ${this._pendingLayers.length}`);
      Hooks.call('narratorJukeboxAutoplayBlocked', {
        count: this._pendingLayers.length,
        expected: expectedLayers,
        actual: actualLayers
      });
    }

    // Broadcast full state if requested (for presets loaded by GM)
    if (game.user.isGM && broadcast && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastAmbienceLayers(this.getLayersState());
    }

    Hooks.call('narratorJukeboxStateChanged');
  }

  /**
   * Retry playing layers that were blocked by autoplay policy
   * Call this after user interaction
   */
  async retryPendingLayers() {
    if (!this._pendingLayers || this._pendingLayers.length === 0) return;

    debugLog(`Retrying ${this._pendingLayers.length} pending layers after user interaction`);

    const pending = [...this._pendingLayers];
    this._pendingLayers = [];

    for (const { trackId, volume } of pending) {
      try {
        await this._createLayer(trackId, volume);
      } catch (err) {
        debugWarn(` Still failed to play layer ${trackId}:`, err);
      }
    }

    Hooks.call('narratorJukeboxStateChanged');
  }

  /**
   * Check if there are pending layers waiting for user interaction
   * @returns {boolean}
   */
  hasPendingLayers() {
    return this._pendingLayers && this._pendingLayers.length > 0;
  }

  /**
   * Get track IDs of all active layers
   * @returns {string[]}
   */
  getActiveTrackIds() {
    return Array.from(this.layers.keys());
  }
}

// Export singleton instance
export const ambienceLayerManager = new AmbienceLayerManager();

// Also export the class for testing
export { AmbienceLayerManager, AmbienceLayer };
