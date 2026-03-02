/**
 * Narrator's Jukebox - Sync Service
 * Handles multiplayer synchronization via socketlib
 */

import { JUKEBOX } from '../core/constants.js';
import { ambienceLayerManager } from '../core/ambience-layer-manager.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';

/**
 * SyncService - Manages socket communication for multiplayer sync
 */
class SyncService {
  constructor() {
    this.socket = null;
    this.playbackService = null;  // Injected
    this.dataService = null;      // Injected
    this._initialized = false;
  }

  /**
   * Initialize the sync service with dependencies
   * @param {object} playbackService - PlaybackService instance
   * @param {object} dataService - DataService instance
   */
  initialize(playbackService, dataService) {
    this.playbackService = playbackService;
    this.dataService = dataService;
  }

  /**
   * Initialize socket connection with socketlib
   * Should be called when socketlib.ready hook fires
   */
  initializeSocket() {
    if (typeof socketlib === 'undefined') {
      debugWarn(' socketlib not available');
      return false;
    }

    this.socket = socketlib.registerModule(JUKEBOX.ID);
    this.socket.register('suggestTrack', this._handleSuggestTrack.bind(this));
    this.socket.register('handleRemoteCommand', this._handleRemoteCommand.bind(this));

    this._initialized = true;
    debugLog(' SyncService socket initialized');
    return true;
  }

  /**
   * Check if socket is available
   */
  isAvailable() {
    return this.socket !== null;
  }

  // ==========================================
  // Broadcast Commands (GM -> Players)
  // ==========================================

  /**
   * Broadcast play command
   * @param {string} trackId - Track ID to play
   * @param {string} channel - 'music' or 'ambience'
   * @param {number} volume - Current volume level (0-1)
   */
  broadcastPlay(trackId, channel = 'music', volume = 0.8) {
    if (!this.socket) return;
    const payload = {
      action: 'play',
      trackId,
      channel,
      volume,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast pause command
   * @param {string} channel - 'music' or 'ambience'
   */
  broadcastPause(channel = 'music') {
    if (!this.socket) return;
    const payload = {
      action: 'pause',
      channel,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast resume command
   * @param {string} channel - 'music' or 'ambience'
   */
  broadcastResume(channel = 'music') {
    if (!this.socket) return;
    const payload = {
      action: 'resume',
      channel,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast stop command
   * @param {string} channel - 'music' or 'ambience'
   */
  broadcastStop(channel = 'music') {
    if (!this.socket) return;
    const payload = {
      action: 'stop',
      channel,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast volume change
   * @param {string} channel - 'music' or 'ambience'
   * @param {number} volume - Volume level (0-1)
   */
  broadcastVolume(channel, volume) {
    if (!this.socket) return;
    const payload = {
      action: 'volume',
      channel,
      volume,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast seek/scrub position
   * @param {string} channel - 'music' or 'ambience'
   * @param {number} percent - Seek position (0-100)
   */
  broadcastSeek(channel, percent) {
    if (!this.socket) return;
    const payload = {
      action: 'seek',
      channel,
      percent,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast soundboard play
   * @param {string} soundId - Soundboard sound ID
   * @param {boolean} loop - Whether to loop
   */
  broadcastSoundboardPlay(soundId, loop = false) {
    if (!this.socket) return;
    const payload = {
      action: 'soundboard',
      subAction: 'play',
      soundId,
      loop,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast soundboard stop
   * @param {string} soundId - Soundboard sound ID
   */
  broadcastSoundboardStop(soundId) {
    if (!this.socket) return;
    const payload = {
      action: 'soundboard',
      subAction: 'stop',
      soundId,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast stop all soundboard sounds
   */
  broadcastSoundboardStopAll() {
    if (!this.socket) return;
    const payload = {
      action: 'soundboard',
      subAction: 'stopAll',
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  // ==========================================
  // Ambience Layers Broadcast (Incremental)
  // ==========================================

  /**
   * Broadcast adding a single ambience layer
   * @param {string} trackId - Track ID to add
   * @param {number} volume - Initial volume (0-1)
   */
  broadcastAmbienceLayerAdd(trackId, volume = 0.8) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'addLayer',
      trackId,
      volume,
      timestamp: Date.now()
    };
    debugLog(' Broadcasting add layer:', trackId);
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast removing a single ambience layer
   * @param {string} trackId - Track ID to remove
   */
  broadcastAmbienceLayerRemove(trackId) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'removeLayer',
      trackId,
      timestamp: Date.now()
    };
    debugLog(' Broadcasting remove layer:', trackId);
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast volume change for a single layer
   * @param {string} trackId - Track ID
   * @param {number} volume - New volume (0-1)
   */
  broadcastAmbienceLayerVolume(trackId, volume) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'layerVolume',
      trackId,
      volume,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast master volume change
   * @param {number} volume - New master volume (0-1)
   */
  broadcastAmbienceMasterVolume(volume) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'masterVolume',
      volume,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast master mute toggle
   * @param {boolean} muted - New mute state
   */
  broadcastAmbienceMasterMute(muted) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'masterMute',
      muted,
      timestamp: Date.now()
    };
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast stop all ambience layers
   */
  broadcastAmbienceLayersStopAll() {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'stopAll',
      timestamp: Date.now()
    };
    debugLog(' Broadcasting stop all layers');
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast full ambience layers state (for initial sync when player joins)
   * @param {object} layersState - State from ambienceLayerManager.getLayersState()
   */
  broadcastAmbienceLayers(layersState) {
    if (!this.socket) return;
    const payload = {
      action: 'ambienceLayers',
      subAction: 'fullSync',
      layersState,
      timestamp: Date.now()
    };
    debugLog(' Broadcasting full ambience state:', layersState);
    this.socket.executeForOthers('handleRemoteCommand', payload);
  }

  /**
   * Broadcast current state to all players
   */
  broadcastState() {
    if (!this.socket || !this.playbackService) return;

    const state = {
      action: 'syncState',
      musicTrackId: this.playbackService.getCurrentMusicTrack()?.id,
      musicTime: this.playbackService.channels?.music?.currentTime || 0,
      isPlaying: this.playbackService.isPlaying,
      ambienceTrackId: this.playbackService.getCurrentAmbienceTrack()?.id,
      isAmbiencePlaying: this.playbackService.isAmbiencePlaying,
      volume: this.playbackService.channels?.music?.volume || 0.8,
      ambienceVolume: this.playbackService.channels?.ambience?.volume || 0.5,
      // Include ambience layers state
      ambienceLayersState: ambienceLayerManager.getLayersState(),
      timestamp: Date.now()
    };

    this.socket.executeForEveryone('handleRemoteCommand', state);
  }

  /**
   * Request current state from GM (for players joining)
   */
  requestState() {
    if (!this.socket) return;
    this.socket.executeForEveryone('handleRemoteCommand', { action: 'requestState' });
  }

  // ==========================================
  // Player Suggestions
  // ==========================================

  /**
   * Send a track suggestion to the GM
   * @param {object} track - Track data to suggest
   */
  async suggestTrack(track) {
    if (!this.socket) {
      ui.notifications.warn('Socket not available. Cannot send suggestion.');
      return;
    }

    const userName = game.user.name;
    track.user = userName;
    track.suggestedAt = Date.now();

    // Execute for GM only
    await this.socket.executeAsGM('suggestTrack', track, userName);
    ui.notifications.info('Suggestion sent to GM!');
  }

  // ==========================================
  // Handle Incoming Commands
  // ==========================================

  /**
   * Handle suggestion received (GM only)
   */
  async _handleSuggestTrack(track, userName) {
    debugLog(" GM receiving suggestion:", track, "from:", userName);

    try {
      if (!track.user) {
        track.user = userName;
      }

      await this.dataService.addSuggestion(track);

      debugLog(" Suggestion saved");
      ui.notifications.info(`Narrator Jukebox: New music suggestion from ${userName}`);

      // Trigger UI update
      Hooks.call('narratorJukeboxSuggestionReceived', track);
    } catch (err) {
      debugError(" Failed to save suggestion:", err);
    }
  }

  /**
   * Handle remote command
   * @param {object} payload - Command payload
   */
  async _handleRemoteCommand(payload) {
    debugLog(" Received Socket Payload:", payload);

    // Handle requestState (only GM responds)
    if (payload.action === 'requestState') {
      if (game.user.isGM) {
        this.broadcastState();
      }
      return;
    }

    // Skip execution for GM in preview mode
    if (game.user.isGM && this.playbackService?.isPreviewMode) {
      debugLog(" GM in preview mode, ignoring remote command");
      return;
    }

    // Process command
    await this._processCommand(payload);

    // Trigger UI update
    Hooks.call('narratorJukeboxRemoteCommand', payload);
  }

  async _processCommand(payload) {
    if (!this.playbackService) {
      debugWarn(' PlaybackService not available for remote command');
      return;
    }

    switch (payload.action) {
      case 'play':
        await this._handlePlayCommand(payload);
        break;

      case 'pause':
        this.playbackService.channels[payload.channel].pause();
        if (payload.channel === 'music') this.playbackService.isPlaying = false;
        if (payload.channel === 'ambience') this.playbackService.isAmbiencePlaying = false;
        break;

      case 'resume':
        this.playbackService.channels[payload.channel].resume();
        if (payload.channel === 'music') this.playbackService.isPlaying = true;
        if (payload.channel === 'ambience') this.playbackService.isAmbiencePlaying = true;
        break;

      case 'stop':
        this.playbackService.channels[payload.channel].stop();
        if (payload.channel === 'music') this.playbackService.isPlaying = false;
        if (payload.channel === 'ambience') this.playbackService.isAmbiencePlaying = false;
        break;

      case 'volume':
        this.playbackService.channels[payload.channel].setVolume(payload.volume);
        // Persist GM's volume broadcast to player's client settings
        // so it's preserved across track changes
        if (!game.user.isGM && payload.volume > 0) {
          const settingKey = payload.channel === 'music'
            ? JUKEBOX.SETTINGS.VOLUME
            : JUKEBOX.SETTINGS.AMBIENCE_VOLUME;
          game.settings.set(JUKEBOX.ID, settingKey, payload.volume);
        }
        break;

      case 'seek':
        this.playbackService.channels[payload.channel].seek(payload.percent);
        break;

      case 'syncState':
        await this._handleSyncState(payload);
        break;

      case 'soundboard':
        await this._handleSoundboardCommand(payload);
        break;

      case 'ambienceLayers':
        await this._handleAmbienceLayersCommand(payload);
        break;
    }
  }

  async _handlePlayCommand(payload) {
    let track = this.dataService.findTrack(payload.trackId, payload.channel);

    // Reload data if track not found
    if (!track) {
      debugWarn(` Track ${payload.trackId} not found. Reloading data...`);
      await this.dataService.loadAllData();
      track = this.dataService.findTrack(payload.trackId, payload.channel);

      if (!track) {
        debugError(`Track ${payload.trackId} not found even after reload.`);
        ui.notifications.error(`Failed to sync: track not found`);
        return;
      }
    }

    debugLog(`Playing synced track: ${track.name}`);

    if (payload.channel === 'music') this.playbackService.isPlaying = true;
    if (payload.channel === 'ambience') this.playbackService.isAmbiencePlaying = true;

    // Apply volume before playing
    if (payload.volume !== undefined) {
      if (game.user.isGM) {
        // GM uses broadcast volume directly
        this.playbackService.channels[payload.channel].setVolume(payload.volume);
      } else {
        // Players use their own saved volume preference (persisted from widget/app slider)
        // This prevents GM's volume from overriding the player's choice on every track change
        const settingKey = payload.channel === 'music'
          ? JUKEBOX.SETTINGS.VOLUME
          : JUKEBOX.SETTINGS.AMBIENCE_VOLUME;
        const muteKey = payload.channel === 'music'
          ? JUKEBOX.SETTINGS.MUSIC_MUTED
          : JUKEBOX.SETTINGS.AMBIENCE_MUTED;
        const playerVolume = game.settings.get(JUKEBOX.ID, settingKey);
        const isMuted = game.settings.get(JUKEBOX.ID, muteKey);
        this.playbackService.channels[payload.channel].setVolume(isMuted ? 0 : playerVolume);
      }
    }

    try {
      await this.playbackService.channels[payload.channel].play(track);
    } catch (err) {
      debugError(" Remote play failed:", err);
      ui.notifications.error(`Failed to play synced music: ${err.message}`);
      if (payload.channel === 'music') this.playbackService.isPlaying = false;
      if (payload.channel === 'ambience') this.playbackService.isAmbiencePlaying = false;
    }
  }

  async _handleSyncState(payload) {
    // Ensure data is loaded (use || to ensure both are loaded)
    if (this.dataService.music.length === 0 || this.dataService.ambience.length === 0) {
      await this.dataService.loadAllData();
    }

    // Sync Music
    if (payload.musicTrackId) {
      const track = this.dataService.getMusic(payload.musicTrackId);
      const currentId = this.playbackService.channels.music.currentTrack?.id;

      if (track && currentId !== payload.musicTrackId) {
        // Set playing state BEFORE calling play() (matches _handlePlayCommand pattern)
        if (payload.isPlaying) {
          this.playbackService.isPlaying = true;
        }

        // Apply volume: players use their own saved preference, GM uses broadcast volume
        if (game.user.isGM) {
          if (payload.volume !== undefined) {
            this.playbackService.channels.music.setVolume(payload.volume);
          }
        } else {
          const playerVolume = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME);
          const isMuted = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED);
          this.playbackService.channels.music.setVolume(isMuted ? 0 : playerVolume);
        }

        this.playbackService.channels.music.play(track, () => {
          // Seek to GM's current position after track loads
          const duration = this.playbackService.channels.music.duration;
          if (duration && payload.musicTime) {
            this.playbackService.channels.music.seek(payload.musicTime / duration * 100);
          }
          if (!payload.isPlaying) {
            this.playbackService.channels.music.pause();
            this.playbackService.isPlaying = false;
          }
        });
      }
    }

    // Sync Ambience (legacy single-track mode)
    if (payload.ambienceTrackId) {
      let track = this.dataService.getAmbience(payload.ambienceTrackId);
      if (!track) track = this.dataService.getMusic(payload.ambienceTrackId);
      const currentId = this.playbackService.channels.ambience.currentTrack?.id;

      if (track && currentId !== payload.ambienceTrackId) {
        // Set playing state BEFORE calling play()
        if (payload.isAmbiencePlaying) {
          this.playbackService.isAmbiencePlaying = true;
        }

        // Apply volume: players use their own saved preference
        if (game.user.isGM) {
          if (payload.ambienceVolume !== undefined) {
            this.playbackService.channels.ambience.setVolume(payload.ambienceVolume);
          }
        } else {
          const playerVolume = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_VOLUME);
          const isMuted = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED);
          this.playbackService.channels.ambience.setVolume(isMuted ? 0 : playerVolume);
        }

        this.playbackService.channels.ambience.play(track, () => {
          if (!payload.isAmbiencePlaying) {
            this.playbackService.channels.ambience.pause();
            this.playbackService.isAmbiencePlaying = false;
          }
        });
      }
    }

    // Sync Ambience Layers (new multi-layer mode)
    // Handle both cases: layers present OR explicit empty state (GM cleared layers)
    if (payload.ambienceLayersState) {
      const hasLayers = payload.ambienceLayersState.layers?.length > 0;
      const playerHasLayers = ambienceLayerManager.layerCount > 0;

      // Restore state if GM has layers, OR if player has layers but GM doesn't (clear them)
      if (hasLayers || playerHasLayers) {
        try {
          await ambienceLayerManager.restoreState(payload.ambienceLayersState, false);
          debugLog(' Synced ambience layers:', ambienceLayerManager.layerCount);
        } catch (err) {
          debugError(' Failed to sync ambience layers:', err);
        }
      }
    }
  }

  async _handleSoundboardCommand(payload) {
    if (payload.subAction === 'play') {
      let sound = this.dataService.getSoundboardSound(payload.soundId);

      if (!sound) {
        debugWarn(` Soundboard sound not found. Reloading...`);
        await this.dataService.loadAllData();
        sound = this.dataService.getSoundboardSound(payload.soundId);

        if (!sound) {
          debugError(" Soundboard sound not found after reload");
          ui.notifications.error('Failed to play soundboard: sound not found');
          return;
        }
      }

      try {
        await this.playbackService.playSoundboardSound(payload.soundId, {
          loop: payload.loop,
          preview: true  // Don't re-broadcast
        });
      } catch (err) {
        debugError(" Remote soundboard play failed:", err);
        ui.notifications.error(`Failed to play soundboard: ${err.message}`);
      }
    } else if (payload.subAction === 'stop') {
      this.playbackService.stopSoundboardSound(payload.soundId, false);
    } else if (payload.subAction === 'stopAll') {
      for (const [id] of this.playbackService.activeSoundboardSounds) {
        this.playbackService.stopSoundboardSound(id, false);
      }
    }
  }

  /**
   * Handle ambience layers command (incremental sync)
   * @param {object} payload - Command payload
   */
  async _handleAmbienceLayersCommand(payload) {
    debugLog(' Handling ambience layers command:', payload.subAction || 'unknown');

    // Ensure data is loaded for any operation that needs track data
    const ensureData = async () => {
      if (this.dataService.ambience.length === 0) {
        await this.dataService.loadAllData();
      }
    };

    switch (payload.subAction) {
      case 'addLayer':
        await ensureData();
        try {
          // Only add if not already present
          if (!ambienceLayerManager.isLayerActive(payload.trackId)) {
            await ambienceLayerManager.addLayerWithoutBroadcast(payload.trackId, payload.volume);
            debugLog(' Added synced layer:', payload.trackId);
          }
        } catch (err) {
          debugError(' Failed to add synced layer:', err);
        }
        break;

      case 'removeLayer':
        ambienceLayerManager.removeLayerWithoutBroadcast(payload.trackId);
        debugLog(' Removed synced layer:', payload.trackId);
        break;

      case 'layerVolume':
        ambienceLayerManager.setLayerVolumeWithoutBroadcast(payload.trackId, payload.volume);
        break;

      case 'masterVolume':
        ambienceLayerManager.setMasterVolumeWithoutBroadcast(payload.volume);
        break;

      case 'masterMute':
        ambienceLayerManager.setMasterMuteWithoutBroadcast(payload.muted);
        break;

      case 'stopAll':
        ambienceLayerManager.stopAll(false);
        debugLog(' Stopped all synced layers');
        break;

      case 'fullSync':
        // Full state sync (for player joining mid-session)
        await ensureData();
        try {
          await ambienceLayerManager.restoreState(payload.layersState, false);
          debugLog(' Full sync completed:', ambienceLayerManager.layerCount, 'layers');
        } catch (err) {
          debugError(' Failed full sync:', err);
        }
        break;

      default:
        // Legacy: handle old format with layersState directly
        if (payload.layersState) {
          await ensureData();
          try {
            await ambienceLayerManager.restoreState(payload.layersState, false);
            debugLog(' Legacy sync completed');
          } catch (err) {
            debugError(' Failed legacy sync:', err);
          }
        }
    }

    Hooks.call('narratorJukeboxStateChanged');
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Also export the class for testing
export { SyncService };
