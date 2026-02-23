/**
 * @file NarratorJukeboxIntegration.js
 * @description Integration service for Narrator Jukebox module.
 * Provides access to playlists, ambience presets, and playback controls.
 *
 * @module data/NarratorJukeboxIntegration
 */

import { CONFIG } from '../config.js';

/**
 * Integration service for Narrator Jukebox module.
 * Handles API access, availability checks, and playback control.
 *
 * @class NarratorJukeboxIntegration
 */
export class NarratorJukeboxIntegration {
  /**
   * Check if Narrator Jukebox module is available and active.
   * @returns {boolean}
   */
  static get isAvailable() {
    return !!game.modules.get('narrator-jukebox')?.active;
  }

  /**
   * Get the Narrator Jukebox API instance.
   * Uses the official module API pattern: game.modules.get('narrator-jukebox').api
   * @returns {Object|null} The API object or null if unavailable
   */
  static get api() {
    if (!this.isAvailable) return null;
    return game.modules.get('narrator-jukebox')?.api ?? null;
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYLIST METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available playlists from Narrator Jukebox.
   * @returns {Array<{id: string, name: string}>} Array of playlist objects
   */
  static getAllPlaylists() {
    const api = this.api;
    if (!api?.getAllPlaylists) return [];

    try {
      const playlists = api.getAllPlaylists();
      return playlists.map(p => ({
        id: p._id ?? p.id,
        name: p.name
      }));
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to get playlists:`, e);
      return [];
    }
  }

  /**
   * Get a specific playlist by ID.
   * @param {string} id - Playlist ID
   * @returns {Object|null} Playlist object or null if not found
   */
  static getPlaylist(id) {
    if (!id) return null;
    const playlists = this.getAllPlaylists();
    return playlists.find(p => p.id === id) ?? null;
  }

  /**
   * Play a playlist by ID.
   * @param {string} playlistId - The playlist ID to play
   * @returns {Promise<boolean>} True if playback started successfully
   */
  static async playPlaylist(playlistId) {
    const api = this.api;
    if (!api?.playPlaylist || !playlistId) return false;

    try {
      await api.playPlaylist(playlistId);
      console.log(`${CONFIG.MODULE_NAME} | Playing playlist: ${playlistId}`);
      return true;
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to play playlist:`, e);
      return false;
    }
  }

  /**
   * Stop music playback.
   * @returns {Promise<boolean>} True if stopped successfully
   */
  static async stopMusic() {
    const api = this.api;
    if (!api?.stop) return false;

    try {
      await api.stop();
      return true;
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to stop music:`, e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     AMBIENCE METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available ambience presets from Narrator Jukebox.
   * @returns {Array<{id: string, name: string}>} Array of preset objects
   */
  static getAmbiencePresets() {
    const api = this.api;
    if (!api?.getAmbiencePresets) return [];

    try {
      const presets = api.getAmbiencePresets();
      return presets.map(p => ({
        id: p.id,
        name: p.name
      }));
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to get ambience presets:`, e);
      return [];
    }
  }

  /**
   * Get a specific ambience preset by ID.
   * @param {string} id - Preset ID
   * @returns {Object|null} Preset object or null if not found
   */
  static getAmbiencePreset(id) {
    if (!id) return null;
    const presets = this.getAmbiencePresets();
    return presets.find(p => p.id === id) ?? null;
  }

  /**
   * Load an ambience preset by ID.
   * @param {string} presetId - The preset ID to load
   * @returns {Promise<boolean>} True if preset loaded successfully
   */
  static async loadAmbiencePreset(presetId) {
    const api = this.api;
    if (!api?.loadAmbiencePreset || !presetId) return false;

    try {
      await api.loadAmbiencePreset(presetId);
      console.log(`${CONFIG.MODULE_NAME} | Loaded ambience preset: ${presetId}`);
      return true;
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to load ambience preset:`, e);
      return false;
    }
  }

  /**
   * Stop all ambience layers.
   * @returns {Promise<boolean>} True if stopped successfully
   */
  static async stopAmbience() {
    const api = this.api;
    if (!api?.stopAllAmbienceLayers) return false;

    try {
      await api.stopAllAmbienceLayers();
      return true;
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to stop ambience:`, e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     COMBINED METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Stop all audio (music and ambience).
   * Always stops both individually to ensure both are stopped.
   * @returns {Promise<boolean>} True if at least one was stopped successfully
   */
  static async stopAll() {
    // Always stop both individually to ensure both music AND ambience are stopped
    // The api.stopAll method (if it exists) may only stop music, not ambience layers
    const musicStopped = await this.stopMusic();
    const ambienceStopped = await this.stopAmbience();
    return musicStopped || ambienceStopped;
  }

  /**
   * Play scene audio based on scene configuration.
   * @param {Object} scene - Scene object with audio settings
   * @param {Object} [options={}] - Playback options
   * @param {boolean} [options.music=true] - Whether to play music if configured
   * @param {boolean} [options.ambience=true] - Whether to play ambience if configured
   * @returns {Promise<{music: boolean, ambience: boolean}>} Results of playback attempts
   */
  static async playSceneAudio(scene, options = {}) {
    const { music = true, ambience = true } = options;
    const result = { music: false, ambience: false };

    if (!scene?.audio || !this.isAvailable) {
      return result;
    }

    const { playlistId, ambiencePresetId, autoPlayMusic, autoPlayAmbience } = scene.audio;

    // Play playlist if configured and enabled
    if (music && playlistId && autoPlayMusic) {
      result.music = await this.playPlaylist(playlistId);
    }

    // Load ambience preset if configured and enabled
    if (ambience && ambiencePresetId && autoPlayAmbience) {
      result.ambience = await this.loadAmbiencePreset(ambiencePresetId);
    }

    return result;
  }

  /**
   * Restore scene audio without checking auto-play settings.
   * Used for manual restore buttons.
   * @param {Object} scene - Scene object with audio settings
   * @param {Object} [options={}] - Playback options
   * @param {boolean} [options.music=true] - Whether to play music if configured
   * @param {boolean} [options.ambience=true] - Whether to play ambience if configured
   * @returns {Promise<{music: boolean, ambience: boolean}>} Results of playback attempts
   */
  static async restoreSceneAudio(scene, options = {}) {
    const { music = true, ambience = true } = options;
    const result = { music: false, ambience: false };

    if (!scene?.audio || !this.isAvailable) {
      return result;
    }

    const { playlistId, ambiencePresetId } = scene.audio;

    // Play playlist if configured
    if (music && playlistId) {
      result.music = await this.playPlaylist(playlistId);
    }

    // Load ambience preset if configured
    if (ambience && ambiencePresetId) {
      result.ambience = await this.loadAmbiencePreset(ambiencePresetId);
    }

    return result;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get display-friendly name for a playlist ID.
   * @param {string} playlistId - Playlist ID
   * @returns {string} Playlist name or 'Unknown' if not found
   */
  static getPlaylistName(playlistId) {
    const playlist = this.getPlaylist(playlistId);
    return playlist?.name ?? 'Unknown Playlist';
  }

  /**
   * Get display-friendly name for an ambience preset ID.
   * @param {string} presetId - Preset ID
   * @returns {string} Preset name or 'Unknown' if not found
   */
  static getAmbiencePresetName(presetId) {
    const preset = this.getAmbiencePreset(presetId);
    return preset?.name ?? 'Unknown Preset';
  }

  /* ═══════════════════════════════════════════════════════════════
     TRACK METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all tracks from a specific playlist via Narrator Jukebox API.
   * NJ playlists have their own structure with musicIds that reference tracks.
   * @param {string} playlistId - Playlist ID
   * @returns {Array<{id: string, name: string, path: string}>} Array of track objects
   */
  static getPlaylistTracks(playlistId) {
    if (!playlistId || !this.isAvailable) return [];

    try {
      const api = this.api;

      // First, get the NJ playlist object which contains musicIds
      const njPlaylists = api?.getAllPlaylists?.() ?? [];
      const njPlaylist = njPlaylists.find(p => (p._id ?? p.id) === playlistId);

      if (!njPlaylist) {
        console.warn(`${CONFIG.MODULE_NAME} | NJ Playlist not found:`, playlistId);
        return [];
      }

      // NJ playlists have musicIds array
      const musicIds = njPlaylist.musicIds ?? [];

      if (musicIds.length === 0) {
        console.log(`${CONFIG.MODULE_NAME} | NJ Playlist has no musicIds`);
        return [];
      }

      // Try to get music data from NJ API
      const allMusic = api?.getAllMusic?.() ?? [];
      console.log(`${CONFIG.MODULE_NAME} | NJ getAllMusic returned:`, allMusic.length, 'tracks');

      if (allMusic.length > 0) {
        // Filter music by the playlist's musicIds
        const tracks = [];
        for (const musicId of musicIds) {
          const track = allMusic.find(m => (m._id ?? m.id) === musicId);
          if (track) {
            tracks.push({
              id: track._id ?? track.id,
              name: track.name ?? track.title ?? 'Unknown Track',
              path: track.path ?? track.src ?? ''
            });
          }
        }
        console.log(`${CONFIG.MODULE_NAME} | Found ${tracks.length} tracks for playlist ${njPlaylist.name}`);
        return tracks;
      }

      // Fallback: Try getting tracks from Foundry playlists
      // The musicIds might be Foundry PlaylistSound IDs
      const tracks = [];
      for (const musicId of musicIds) {
        for (const foundryPlaylist of game.playlists) {
          const sound = foundryPlaylist.sounds.get(musicId);
          if (sound) {
            tracks.push({
              id: sound.id,
              name: sound.name,
              path: sound.path
            });
            break;
          }
        }
      }

      if (tracks.length > 0) {
        console.log(`${CONFIG.MODULE_NAME} | Found ${tracks.length} tracks via Foundry fallback`);
        return tracks;
      }

      // Debug: Log what we have to help troubleshoot
      console.log(`${CONFIG.MODULE_NAME} | Could not resolve tracks. musicIds:`, musicIds);
      console.log(`${CONFIG.MODULE_NAME} | Available API methods:`, api ? Object.keys(api) : 'none');

      return [];
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to get playlist tracks:`, e);
      return [];
    }
  }

  /**
   * Play a specific track via Narrator Jukebox API.
   * Uses the NJ API playMusic(id, channel) method.
   * @param {string} playlistId - The playlist ID (not used, kept for compatibility)
   * @param {string} trackId - The track ID to play (from NJ's music library)
   * @returns {Promise<boolean>} True if playback started successfully
   */
  static async playTrack(playlistId, trackId) {
    const api = this.api;
    if (!trackId) return false;

    try {
      console.log(`${CONFIG.MODULE_NAME} | Attempting to play track via NJ API: trackId=${trackId}`);

      // Ensure preview mode is OFF so the track is broadcast to players
      // Preview mode prevents sync to players - we want all players to hear the music
      if (api?.setPreviewMode) {
        const state = api.getState?.();
        if (state?.isPreviewMode) {
          console.log(`${CONFIG.MODULE_NAME} | Disabling preview mode for broadcast`);
          api.setPreviewMode(false);
        }
      }

      // Use Narrator Jukebox API playMusic(id, channel) method
      // This is the correct method according to the NJ API (line 312-338 of narrator-jukebox-api.js)
      if (api?.playMusic) {
        const track = await api.playMusic(trackId, 'music');
        console.log(`${CONFIG.MODULE_NAME} | Playing track via NJ playMusic:`, track?.name || trackId);
        return true;
      }

      console.warn(`${CONFIG.MODULE_NAME} | NJ playMusic method not available`);
      return false;
    } catch (e) {
      console.warn(`${CONFIG.MODULE_NAME} | Failed to play track:`, e);
      return false;
    }
  }
}
