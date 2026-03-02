/**
 * Narrator's Jukebox - Jukebox State (Main Singleton)
 * Central orchestrator that coordinates all services
 * Maintains backward-compatible interface with original NarratorJukebox class
 */

import { JUKEBOX } from './constants.js';
import { AudioChannel } from './audio-channel.js';
import { dataService } from '../services/data-service.js';
import { playbackService, ambienceLayerManager } from '../services/playback-service.js';
import { syncService } from '../services/sync-service.js';
import { debugLog } from '../utils/debug.js';

/**
 * NarratorJukebox - Main singleton class
 * Orchestrates all jukebox functionality and maintains global state
 */
class NarratorJukebox {
  constructor() {
    // Audio channels
    this.channels = {
      music: new AudioChannel('music'),
      ambience: new AudioChannel('ambience'),
      soundboard: new AudioChannel('soundboard')
    };

    // Initialize services with dependencies
    playbackService.initialize(this.channels, dataService, syncService);
    syncService.initialize(playbackService, dataService);

    // Socket reference (set by socketlib.ready hook)
    this._socket = null;
  }

  // ==========================================
  // Static Properties and Methods
  // ==========================================

  static instance = null;
  static socket = null;
  static _hooksRegistered = false;

  static initialize() {
    if (!NarratorJukebox.instance) {
      NarratorJukebox.instance = new NarratorJukebox();
    }

    // Initialize Channels
    Object.values(NarratorJukebox.instance.channels).forEach(c => c.initialize());

    // Load saved volumes from settings
    const savedMusicVolume = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME);
    const savedAmbienceVolume = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_VOLUME);
    const savedMusicMuted = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED);
    const savedAmbienceMuted = game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED);

    // Apply saved volumes to channels
    NarratorJukebox.instance.channels.music.volume = savedMusicVolume;
    NarratorJukebox.instance.channels.ambience.volume = savedAmbienceVolume;

    // Apply saved mute states
    playbackService.isMuted = savedMusicMuted;
    playbackService.isAmbienceMuted = savedAmbienceMuted;
    playbackService.volumeBeforeMute = savedMusicVolume;
    playbackService.ambienceVolumeBeforeMute = savedAmbienceVolume;

    // If muted, set channel volume to 0 (but keep volumeBeforeMute for unmute)
    if (savedMusicMuted) {
      NarratorJukebox.instance.channels.music.volume = 0;
    }
    if (savedAmbienceMuted) {
      NarratorJukebox.instance.channels.ambience.volume = 0;
    }

    debugLog(`Restored volumes - Music: ${savedMusicVolume} (muted: ${savedMusicMuted}), Ambience: ${savedAmbienceVolume} (muted: ${savedAmbienceMuted})`);

    // Request Initial State (if player)
    if (!game.user.isGM) {
      syncService.requestState();
    }

    // Listen for Track End to trigger Next/Loop (only register once)
    if (!NarratorJukebox._hooksRegistered) {
      NarratorJukebox._hooksRegistered = true;

      Hooks.on('narratorJukeboxTrackEnded', (channel) => {
        if (!NarratorJukebox.instance) return;

        if (channel === 'music') {
          // Check if loop is enabled - if so, replay the same track
          if (playbackService.musicLoop) {
            const currentTrack = NarratorJukebox.instance.channels.music.currentTrack;
            if (currentTrack) {
              debugLog("Looping music:", currentTrack.name);
              NarratorJukebox.instance.playMusic(currentTrack.id, 'music');
            }
          } else {
            debugLog("Music track ended, calling next()");
            NarratorJukebox.instance.next();
          }
        } else if (channel === 'ambience') {
          debugLog("Ambience track ended");
          if (playbackService.ambienceLoop) {
            const currentTrack = NarratorJukebox.instance.channels.ambience.currentTrack;
            if (currentTrack) {
              debugLog("Looping ambience:", currentTrack.name);
              NarratorJukebox.instance.playMusic(currentTrack.id, 'ambience');
            }
          } else {
            playbackService.isAmbiencePlaying = false;
            Hooks.call('narratorJukeboxStateChanged');
          }
        }
      });

      // Listen for remote command UI updates
      Hooks.on('narratorJukeboxRemoteCommand', () => {
        Hooks.call('narratorJukeboxStateChanged');
      });
    }
  }

  /**
   * Static method for socket handler
   */
  static handleRemoteCommandStatic(payload) {
    syncService._handleRemoteCommand(payload);
  }

  /**
   * Static method for suggestion handler
   */
  static async suggestTrack(track, userName) {
    await syncService._handleSuggestTrack(track, userName);
  }

  // ==========================================
  // Data Access (Delegated to DataService)
  // ==========================================

  get music() { return dataService.music; }
  set music(val) { dataService.music = val; }

  get ambience() { return dataService.ambience; }
  set ambience(val) { dataService.ambience = val; }

  get soundboard() { return dataService.soundboard; }
  set soundboard(val) { dataService.soundboard = val; }

  get playlists() { return dataService.playlists; }
  set playlists(val) { dataService.playlists = val; }

  // ==========================================
  // Playback State (Delegated to PlaybackService)
  // ==========================================

  get isPlaying() { return playbackService.isPlaying; }
  set isPlaying(val) { playbackService.isPlaying = val; }

  get isAmbiencePlaying() { return playbackService.isAmbiencePlaying; }
  set isAmbiencePlaying(val) { playbackService.isAmbiencePlaying = val; }

  get shuffle() { return playbackService.shuffle; }
  set shuffle(val) { playbackService.shuffle = val; }

  get musicLoop() { return playbackService.musicLoop; }
  set musicLoop(val) { playbackService.musicLoop = val; }

  get ambienceLoop() { return playbackService.ambienceLoop; }
  set ambienceLoop(val) { playbackService.ambienceLoop = val; }

  get isPreviewMode() { return playbackService.isPreviewMode; }
  set isPreviewMode(val) { playbackService.isPreviewMode = val; }

  get isMuted() { return playbackService.isMuted; }
  set isMuted(val) { playbackService.isMuted = val; }

  get isAmbienceMuted() { return playbackService.isAmbienceMuted; }
  set isAmbienceMuted(val) { playbackService.isAmbienceMuted = val; }

  get volumeBeforeMute() { return playbackService.volumeBeforeMute; }
  set volumeBeforeMute(val) { playbackService.volumeBeforeMute = val; }

  get ambienceVolumeBeforeMute() { return playbackService.ambienceVolumeBeforeMute; }
  set ambienceVolumeBeforeMute(val) { playbackService.ambienceVolumeBeforeMute = val; }

  get currentPlaylist() { return playbackService.currentPlaylist; }
  set currentPlaylist(val) { playbackService.currentPlaylist = val; }

  get activeSoundboardSounds() { return playbackService.activeSoundboardSounds; }
  get soundboardBroadcastMode() { return playbackService.soundboardBroadcastMode; }
  set soundboardBroadcastMode(val) { playbackService.soundboardBroadcastMode = val; }

  get soundboardLoopState() { return playbackService.soundboardLoopState; }

  // ==========================================
  // Data Operations (Delegated to DataService)
  // ==========================================

  async loadData() {
    await dataService.loadAllData();
  }

  async saveData() {
    await dataService.saveAllData();
  }

  async addMusic(data) {
    return await dataService.addMusic(data);
  }

  async updateMusic(id, data) {
    return await dataService.updateMusic(id, data);
  }

  async deleteMusic(id) {
    return await dataService.deleteMusic(id);
  }

  async addAmbience(data) {
    return await dataService.addAmbience(data);
  }

  async updateAmbience(id, data) {
    return await dataService.updateAmbience(id, data);
  }

  async deleteAmbience(id) {
    return await dataService.deleteAmbience(id);
  }

  async addSoundboardSound(data) {
    return await dataService.addSoundboardSound(data);
  }

  async updateSoundboardSound(id, data) {
    return await dataService.updateSoundboardSound(id, data);
  }

  async deleteSoundboardSound(id) {
    // Stop the sound if playing
    this.stopSoundboardSound(id);
    return await dataService.deleteSoundboardSound(id);
  }

  async createPlaylist(name) {
    return await dataService.createPlaylist(name);
  }

  async deletePlaylist(id) {
    return await dataService.deletePlaylist(id);
  }

  async addToPlaylist(playlistId, musicId) {
    const result = await dataService.addToPlaylist(playlistId, musicId);
    if (result) {
      const playlist = dataService.getPlaylist(playlistId);
      ui.notifications.info(`Added track to playlist "${playlist.name}"`);
    }
    return result;
  }

  async addMultipleToPlaylist(playlistId, musicIds) {
    return await dataService.addMultipleToPlaylist(playlistId, musicIds);
  }

  async removeFromPlaylist(playlistId, musicId) {
    const result = await dataService.removeFromPlaylist(playlistId, musicId);
    if (result) {
      const playlist = dataService.getPlaylist(playlistId);
      ui.notifications.info(`Removed track from playlist "${playlist.name}"`);
    }
    return result;
  }

  // ==========================================
  // Playback Operations (Delegated to PlaybackService)
  // ==========================================

  async playMusic(id, channel = 'music') {
    try {
      const result = await playbackService.playMusic(id, channel);
      // Notify UI to update
      Hooks.call('narratorJukeboxStateChanged');
      return result;
    } catch (err) {
      // Handle autoplay policy
      if (err.name === 'NotAllowedError') {
        ui.notifications.warn("Narrator Jukebox: Click anywhere to enable audio playback.");
      } else {
        ui.notifications.error(`Playback failed: ${err.message}`);
      }
      throw err;
    }
  }

  playPlaylist(id) {
    const result = playbackService.playPlaylist(id);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  togglePlay(channel = 'music') {
    playbackService.togglePlayPause(channel);
    Hooks.call('narratorJukeboxStateChanged');
  }

  stop(channel = 'music') {
    playbackService.stop(channel);
    Hooks.call('narratorJukeboxStateChanged');
  }

  next(wrap = false) {
    const result = playbackService.next(wrap);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  prev() {
    const result = playbackService.prev();
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  setVolume(vol, channel) {
    playbackService.setVolume(channel, vol);
  }

  toggleMute(channel = 'music') {
    playbackService.toggleMute(channel);
    Hooks.call('narratorJukeboxStateChanged');
  }

  toggleShuffle() {
    return playbackService.toggleShuffle();
  }

  toggleMusicLoop() {
    return playbackService.toggleMusicLoop();
  }

  toggleAmbienceLoop() {
    return playbackService.toggleAmbienceLoop();
  }

  playRandomByTag(tag) {
    const result = playbackService.playRandomByTag(tag);
    if (result) Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  // ==========================================
  // Soundboard Operations
  // ==========================================

  async playSoundboardSound(id, options = {}) {
    const result = await playbackService.playSoundboardSound(id, options);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  stopSoundboardSound(id, broadcast = true) {
    playbackService.stopSoundboardSound(id, broadcast);
    Hooks.call('narratorJukeboxStateChanged');
  }

  stopAllSoundboardSounds() {
    playbackService.stopAllSoundboardSounds();
    Hooks.call('narratorJukeboxStateChanged');
  }

  isSoundboardSoundPlaying(id) {
    return playbackService.isSoundboardSoundPlaying(id);
  }

  // ==========================================
  // Ambience Layer Operations
  // ==========================================

  /**
   * Play an ambience track as a layer (multi-layer system)
   * @param {string} trackId - Track ID to add as layer
   * @returns {Promise<object|null>} The created layer or null if failed
   */
  async playAmbienceLayer(trackId) {
    const result = await playbackService.playAmbienceLayer(trackId);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  /**
   * Stop an ambience layer
   * @param {string} trackId - Track ID to stop
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  stopAmbienceLayer(trackId, broadcast = true) {
    playbackService.stopAmbienceLayer(trackId, broadcast);
    Hooks.call('narratorJukeboxStateChanged');
  }

  /**
   * Toggle an ambience layer on/off
   * @param {string} trackId - Track ID to toggle
   * @returns {Promise<boolean>} New state (true = playing)
   */
  async toggleAmbienceLayer(trackId) {
    const result = await playbackService.toggleAmbienceLayer(trackId);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  /**
   * Set volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @param {number} volume - Volume value (0-1)
   */
  setAmbienceLayerVolume(trackId, volume) {
    playbackService.setAmbienceLayerVolume(trackId, volume);
  }

  /**
   * Get volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @returns {number} Volume value (0-1)
   */
  getAmbienceLayerVolume(trackId) {
    return playbackService.getAmbienceLayerVolume(trackId);
  }

  /**
   * Set master volume for all ambience layers
   * @param {number} volume - Volume value (0-1)
   */
  setAmbienceMasterVolume(volume) {
    playbackService.setAmbienceMasterVolume(volume);
    // Note: Don't call narratorJukeboxStateChanged to avoid re-render during slider drag
  }

  /**
   * Get master volume for ambience layers
   * @returns {number} Volume value (0-1)
   */
  getAmbienceMasterVolume() {
    return playbackService.getAmbienceMasterVolume();
  }

  /**
   * Toggle master mute for all ambience layers
   * @returns {boolean} New mute state
   */
  toggleAmbienceMasterMute() {
    const result = playbackService.toggleAmbienceMasterMute();
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  /**
   * Check if ambience master is muted
   * @returns {boolean}
   */
  isAmbienceMasterMuted() {
    return playbackService.isAmbienceMasterMuted();
  }

  /**
   * Get all active ambience layers
   * @returns {Array<{trackId: string, track: object, volume: number}>}
   */
  getActiveAmbienceLayers() {
    return playbackService.getActiveAmbienceLayers();
  }

  /**
   * Get the number of active ambience layers
   * @returns {number}
   */
  getAmbienceLayerCount() {
    return playbackService.getAmbienceLayerCount();
  }

  /**
   * Check if an ambience track is currently playing as a layer
   * @param {string} trackId - Track ID to check
   * @returns {boolean}
   */
  isAmbienceLayerActive(trackId) {
    return playbackService.isAmbienceLayerActive(trackId);
  }

  /**
   * Stop all ambience layers
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  stopAllAmbienceLayers(broadcast = true) {
    playbackService.stopAllAmbienceLayers(broadcast);
    Hooks.call('narratorJukeboxStateChanged');
  }

  /**
   * Get the serializable state of all ambience layers (for sync/presets)
   * @returns {object}
   */
  getAmbienceLayersState() {
    return playbackService.getAmbienceLayersState();
  }

  /**
   * Restore ambience layers state (for sync/presets)
   * @param {object} state - State object from getAmbienceLayersState()
   * @param {boolean} broadcast - Whether to broadcast after restore
   */
  async restoreAmbienceLayersState(state, broadcast = false) {
    await playbackService.restoreAmbienceLayersState(state, broadcast);
    Hooks.call('narratorJukeboxStateChanged');
  }

  /**
   * Check if we can add more ambience layers
   * @returns {boolean}
   */
  canAddAmbienceLayer() {
    return playbackService.canAddAmbienceLayer();
  }

  // ==========================================
  // Ambience Preset Operations
  // ==========================================

  /**
   * Get all ambience presets (sync)
   * @returns {Array} Array of preset objects
   */
  getAmbiencePresets() {
    return dataService.getAllAmbiencePresets();
  }

  /**
   * Get a single ambience preset by ID (sync)
   * @param {string} id - Preset ID
   * @returns {object|null} The preset or null
   */
  getAmbiencePreset(id) {
    return dataService.getAmbiencePreset(id);
  }

  /**
   * Save current ambience layers as a preset
   * @param {string} name - Preset name
   * @returns {Promise<object>} The saved preset
   */
  async saveAmbiencePreset(name) {
    const layersState = this.getAmbienceLayersState();
    const preset = await dataService.saveAmbiencePreset({ name, layersState });
    Hooks.call('narratorJukeboxStateChanged');
    return preset;
  }

  /**
   * Update an existing ambience preset
   * @param {string} id - Preset ID
   * @param {object} data - Updated data
   * @returns {Promise<object|null>} The updated preset or null
   */
  async updateAmbiencePreset(id, data) {
    const preset = await dataService.updateAmbiencePreset(id, data);
    Hooks.call('narratorJukeboxStateChanged');
    return preset;
  }

  /**
   * Delete an ambience preset
   * @param {string} id - Preset ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteAmbiencePreset(id) {
    const result = await dataService.deleteAmbiencePreset(id);
    Hooks.call('narratorJukeboxStateChanged');
    return result;
  }

  /**
   * Load an ambience preset (applies the layers state)
   * @param {string} id - Preset ID
   * @param {boolean} broadcast - Whether to broadcast the change
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadAmbiencePreset(id, broadcast = true) {
    const preset = dataService.getAmbiencePreset(id);
    if (!preset) {
      ui.notifications.warn('Preset not found');
      return false;
    }

    await this.restoreAmbienceLayersState(preset.layersState, broadcast);
    ui.notifications.info(`Loaded preset: ${preset.name}`);
    Hooks.call('narratorJukeboxAmbiencePresetLoaded', { preset });
    return true;
  }

  // ==========================================
  // Sync Operations (Delegated to SyncService)
  // ==========================================

  async handleRemoteCommand(payload) {
    await syncService._handleRemoteCommand(payload);
  }

  // ==========================================
  // Utility Methods (kept for compatibility)
  // ==========================================

  /**
   * Extract YouTube video ID from URL
   * @deprecated Use extractYouTubeVideoId from youtube-utils.js
   */
  _extractYouTubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }
}

// Export the class
export { NarratorJukebox };

// Export services for direct access if needed
export { dataService, playbackService, syncService, ambienceLayerManager };
