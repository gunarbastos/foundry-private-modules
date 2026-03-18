/**
 * @file NarratorJukeboxIntegration.js
 * @description Integration service for Narrator Jukebox module.
 * Provides access to playlists, tracks, ambience layers, soundboard, and playback controls.
 *
 * @module data/NarratorJukeboxIntegration
 */

import { CONFIG, log, logWarn } from '../config.js';
import { extractYouTubeVideoId, normalizeYouTubeUrl } from '../utils/youtube-embed-validator.js';

/**
 * Integration service for Narrator Jukebox module.
 * Handles API access, availability checks, and playback control.
 * All methods guard against NJ being unavailable.
 *
 * @class NarratorJukeboxIntegration
 */
export class NarratorJukeboxIntegration {
  /** @type {Object} Internal cache for NJ API data to avoid repeated lookups */
  static _cache = {
    available: undefined,
    api: undefined,
    jukebox: undefined,
    playlists: null,
    playlistIndex: null,
    music: null,
    musicIndex: null,
    ambiencePresets: null,
    ambienceSounds: null,
    soundboardSounds: null,
    playlistTracks: null
  };

  /**
   * Clear cached NJ library data. Call when NJ content may have changed
   * (e.g., when opening AudioBrowser).
   */
  static invalidateCache() {
    this._cache.playlists = null;
    this._cache.playlistIndex = null;
    this._cache.music = null;
    this._cache.musicIndex = null;
    this._cache.ambiencePresets = null;
    this._cache.ambienceSounds = null;
    this._cache.soundboardSounds = null;
    this._cache.playlistTracks = null;
  }

  /**
   * Check if Narrator Jukebox module is available and active.
   * Cached — module state doesn't change during a session.
   * @returns {boolean}
   */
  static get isAvailable() {
    if (this._cache.available !== undefined) return this._cache.available;
    this._cache.available = !!game.modules.get('narrator-jukebox')?.active;
    return this._cache.available;
  }

  /**
   * Get the Narrator Jukebox API instance.
   * Cached — the API object persists once NJ is ready.
   * @returns {Object|null} The API object or null if unavailable
   */
  static get api() {
    if (this._cache.api !== undefined) return this._cache.api;
    if (!this.isAvailable) return null;
    const api = game.modules.get('narrator-jukebox')?.api ?? null;
    if (api) this._cache.api = api;
    return api;
  }

  /**
   * Get the underlying Narrator Jukebox singleton.
   * Prefer this for player-requested add/play flows so we mirror the module's
   * own UI behavior instead of going through the API normalization layer.
   * @returns {Object|null}
   */
  static get jukebox() {
    if (this._cache.jukebox !== undefined) return this._cache.jukebox;
    if (!this.isAvailable) return null;

    const jukebox = globalThis.NarratorJukebox?.instance ?? null;
    if (jukebox) this._cache.jukebox = jukebox;
    return jukebox;
  }

  /**
   * Build track data that matches the NJ add dialog payload shape.
   * @param {Object} trackData
   * @returns {Object}
   */
  static _buildManualMusicTrackData(trackData) {
    const rawUrl = String(trackData?.url ?? '').trim();
    const inferredYoutubeId = extractYouTubeVideoId(rawUrl);
    const source = String(trackData?.source || (inferredYoutubeId ? 'youtube' : 'local')).trim().toLowerCase();
    const url = source === 'youtube' ? normalizeYouTubeUrl(rawUrl) : rawUrl;
    const videoId = extractYouTubeVideoId(url);
    const thumbnail = trackData?.thumbnail
      ? String(trackData.thumbnail).trim()
      : (videoId ? `https://img.youtube.com/vi/${videoId}/0.jpg` : '');

    return {
      id: foundry.utils.randomID(),
      name: String(trackData?.name ?? '').trim(),
      source,
      url,
      tags: Array.isArray(trackData?.tags) ? trackData.tags : [],
      thumbnail
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYLIST METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available playlists from Narrator Jukebox.
   * @returns {Array<{id: string, name: string}>} Array of playlist objects
   */
  static getAllPlaylists() {
    if (this._cache.playlists) return this._cache.playlists;

    const api = this.api;
    if (!api?.getAllPlaylists) return [];

    try {
      const playlists = api.getAllPlaylists();
      this._cache.playlists = playlists.map(p => ({
        id: p._id ?? p.id,
        name: p.name,
        musicIds: p.musicIds ?? []
      }));
      this._cache.playlistIndex = new Map(
        this._cache.playlists.map(p => [p.id, p])
      );
      return this._cache.playlists;
    } catch (e) {
      logWarn('Failed to get playlists:', e);
      return [];
    }
  }

  /**
   * Get a specific playlist by ID. Uses cached Map index for O(1) lookup.
   * @param {string} id - Playlist ID
   * @returns {Object|null} Playlist object or null if not found
   */
  static getPlaylist(id) {
    if (!id) return null;
    if (!this._cache.playlistIndex) this.getAllPlaylists();
    return this._cache.playlistIndex?.get(id) ?? null;
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
      log(`Playing playlist: ${playlistId}`);
      return true;
    } catch (e) {
      logWarn('Failed to play playlist:', e);
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
      logWarn('Failed to stop music:', e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     AMBIENCE PRESET METHODS (legacy — single preset at a time)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available ambience presets from Narrator Jukebox.
   * @returns {Array<{id: string, name: string}>} Array of preset objects
   */
  static getAmbiencePresets() {
    if (this._cache.ambiencePresets) return this._cache.ambiencePresets;

    const api = this.api;
    if (!api?.getAmbiencePresets) return [];

    try {
      const presets = api.getAmbiencePresets();
      this._cache.ambiencePresets = presets.map(p => ({
        id: p.id,
        name: p.name
      }));
      return this._cache.ambiencePresets;
    } catch (e) {
      logWarn('Failed to get ambience presets:', e);
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
    this.getAmbiencePresets();
    return this._cache.ambiencePresets?.find(p => p.id === id) ?? null;
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
      log(`Loaded ambience preset: ${presetId}`);
      return true;
    } catch (e) {
      logWarn('Failed to load ambience preset:', e);
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
      logWarn('Failed to stop ambience:', e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     AMBIENCE LAYER CONTROL (v6.0 — individual layer management)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available ambience sounds that can be used as layers.
   * @returns {Array<{id: string, name: string, path: string}>} Array of ambience sound objects
   */
  static getAllAmbienceSounds() {
    if (this._cache.ambienceSounds) return this._cache.ambienceSounds;

    const api = this.api;
    if (!api?.getAllAmbience) return [];

    try {
      const sounds = api.getAllAmbience();
      this._cache.ambienceSounds = sounds.map(s => ({
        id: s._id ?? s.id,
        name: s.name ?? s.title ?? 'Unknown',
        path: s.path ?? s.src ?? ''
      }));
      return this._cache.ambienceSounds;
    } catch (e) {
      logWarn('Failed to get ambience sounds:', e);
      return [];
    }
  }

  /**
   * Add an ambience layer by sound ID.
   * NJ supports up to MAX_AMBIENCE_LAYERS simultaneous layers.
   * @param {string} soundId - The ambience sound ID to add as a layer
   * @param {number} [volume=1.0] - Volume level (0-1)
   * @returns {Promise<boolean>} True if layer was added
   */
  static async addAmbienceLayer(soundId, volume = 1.0) {
    const api = this.api;
    if (!api?.playAmbienceLayer || !soundId) return false;

    try {
      await api.playAmbienceLayer(soundId);
      // Set volume after starting the layer (NJ API doesn't accept volume in playAmbienceLayer)
      const clamped = Math.max(0, Math.min(1, volume));
      if (clamped !== 1.0 && api.setAmbienceLayerVolume) {
        api.setAmbienceLayerVolume(soundId, clamped);
      }
      log(`Added ambience layer: ${soundId} at volume ${volume}`);
      return true;
    } catch (e) {
      logWarn('Failed to add ambience layer:', e);
      return false;
    }
  }

  /**
   * Remove an active ambience layer by its index or ID.
   * @param {number|string} layerRef - Layer index (0-based) or layer ID
   * @returns {Promise<boolean>} True if layer was removed
   */
  static async removeAmbienceLayer(layerRef) {
    const api = this.api;
    if (!api?.stopAmbienceLayer) return false;

    try {
      api.stopAmbienceLayer(layerRef);
      log(`Removed ambience layer: ${layerRef}`);
      return true;
    } catch (e) {
      logWarn('Failed to remove ambience layer:', e);
      return false;
    }
  }

  /**
   * Set the volume of an active ambience layer.
   * @param {number|string} layerRef - Layer index (0-based) or layer ID
   * @param {number} volume - Volume level (0-1)
   * @returns {Promise<boolean>} True if volume was set
   */
  static async setAmbienceLayerVolume(layerRef, volume) {
    const api = this.api;
    if (!api?.setAmbienceLayerVolume) return false;

    try {
      await api.setAmbienceLayerVolume(layerRef, Math.max(0, Math.min(1, volume)));
      return true;
    } catch (e) {
      logWarn('Failed to set ambience layer volume:', e);
      return false;
    }
  }

  /**
   * Get the master volume for all ambience layers.
   * @returns {number} Volume level 0-1, defaults to 0.5
   */
  static getAmbienceMasterVolume() {
    const api = this.api;
    if (!api?.getAmbienceMasterVolume) return 0.5;

    try {
      return api.getAmbienceMasterVolume() ?? 0.5;
    } catch (e) {
      logWarn('Failed to get ambience master volume:', e);
      return 0.5;
    }
  }

  /**
   * Set the master volume for all ambience layers.
   * @param {number} volume - Volume level (0-1)
   * @returns {boolean} True if volume was set
   */
  static setAmbienceMasterVolume(volume) {
    const api = this.api;
    if (!api?.setAmbienceMasterVolume) return false;

    try {
      api.setAmbienceMasterVolume(Math.max(0, Math.min(1, volume)));
      log(`Set ambience master volume: ${volume}`);
      return true;
    } catch (e) {
      logWarn('Failed to set ambience master volume:', e);
      return false;
    }
  }

  /**
   * Get currently active ambience layers.
   * @returns {Array<{id: string, name: string, volume: number}>} Active layer info
   */
  static getActiveAmbienceLayers() {
    const api = this.api;
    if (!api?.getActiveAmbienceLayers) return [];

    try {
      const layers = api.getActiveAmbienceLayers();
      return (layers ?? []).map(l => ({
        id: l.trackId ?? l._id ?? l.id ?? '',
        name: l.track?.name ?? l.name ?? 'Unknown',
        volume: l.volume ?? 1.0
      }));
    } catch (e) {
      logWarn('Failed to get active ambience layers:', e);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SOUNDBOARD METHODS (v6.0)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all available soundboard sounds from Narrator Jukebox.
   * @returns {Array<{id: string, name: string, path: string}>} Array of sound objects
   */
  static getSoundboardSounds() {
    if (this._cache.soundboardSounds) return this._cache.soundboardSounds;

    const api = this.api;
    if (!api?.getAllSoundboardSounds) return [];

    try {
      const sounds = api.getAllSoundboardSounds();
      this._cache.soundboardSounds = sounds.map(s => ({
        id: s._id ?? s.id,
        name: s.name ?? s.title ?? 'Unknown',
        path: s.path ?? s.src ?? ''
      }));
      return this._cache.soundboardSounds;
    } catch (e) {
      logWarn('Failed to get soundboard sounds:', e);
      return [];
    }
  }

  /**
   * Play a soundboard sound by ID.
   * @param {string} soundId - The soundboard sound ID to play
   * @returns {Promise<boolean>} True if sound played successfully
   */
  static async playSoundboardSound(soundId) {
    const api = this.api;
    if (!api?.playSoundboardSound || !soundId) return false;

    try {
      await api.playSoundboardSound(soundId);
      log(`Played soundboard sound: ${soundId}`);
      return true;
    } catch (e) {
      logWarn('Failed to play soundboard sound:', e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK STATE (v6.0)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the current NJ playback state.
   * @returns {{isPlaying: boolean, currentTrack: Object|null, isPreviewMode: boolean}|null}
   */
  static getPlaybackState() {
    const api = this.api;
    if (!api?.getState) return null;

    try {
      const state = api.getState();
      return {
        isPlaying: !!state?.isPlaying,
        currentTrack: state?.currentTrack ?? null,
        isPreviewMode: !!state?.isPreviewMode
      };
    } catch (e) {
      logWarn('Failed to get playback state:', e);
      return null;
    }
  }

  /**
   * Check if NJ is currently playing music.
   * @returns {boolean}
   */
  static isPlaying() {
    return !!this.getPlaybackState()?.isPlaying;
  }

  /* ═══════════════════════════════════════════════════════════════
     TRACK BROWSING (v6.0 — expanded from existing)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get all music tracks from Narrator Jukebox's library.
   * @returns {Array<{id: string, name: string, path: string}>} All available tracks
   */
  static getAllMusic() {
    if (this._cache.music) return this._cache.music;

    const api = this.api;
    if (!api?.getAllMusic) return [];

    try {
      const music = api.getAllMusic();
      this._cache.music = (music ?? []).map(m => ({
        id: m._id ?? m.id,
        name: m.name ?? m.title ?? 'Unknown Track',
        path: m.path ?? m.src ?? ''
      }));
      this._cache.musicIndex = new Map(
        this._cache.music.map(m => [m.id, m])
      );
      return this._cache.music;
    } catch (e) {
      logWarn('Failed to get all music:', e);
      return [];
    }
  }

  /**
   * Search tracks by name across all playlists.
   * @param {string} query - Search string (case-insensitive)
   * @returns {Array<{id: string, name: string, path: string}>} Matching tracks
   */
  static searchTracks(query) {
    if (!query) return [];
    const allMusic = this.getAllMusic();
    const lowerQuery = query.toLowerCase();
    return allMusic.filter(t => t.name.toLowerCase().includes(lowerQuery));
  }

  /**
   * Get all tracks from a specific playlist via Narrator Jukebox API.
   * NJ playlists have their own structure with musicIds that reference tracks.
   * @param {string} playlistId - Playlist ID
   * @returns {Array<{id: string, name: string, path: string}>} Array of track objects
   */
  static getPlaylistTracks(playlistId) {
    if (!playlistId || !this.isAvailable) return [];

    // Check per-playlist cache
    if (!this._cache.playlistTracks) this._cache.playlistTracks = new Map();
    if (this._cache.playlistTracks.has(playlistId)) {
      return this._cache.playlistTracks.get(playlistId);
    }

    try {
      // Use cached playlist (includes musicIds from getAllPlaylists)
      const playlist = this.getPlaylist(playlistId);
      if (!playlist) {
        logWarn('NJ Playlist not found:', playlistId);
        this._cache.playlistTracks.set(playlistId, []);
        return [];
      }

      const musicIds = playlist.musicIds ?? [];
      if (musicIds.length === 0) {
        log('NJ Playlist has no musicIds');
        this._cache.playlistTracks.set(playlistId, []);
        return [];
      }

      // Use cached music index for O(1) lookups per track
      this.getAllMusic();
      if (this._cache.musicIndex?.size > 0) {
        const tracks = [];
        for (const musicId of musicIds) {
          const track = this._cache.musicIndex.get(musicId);
          if (track) tracks.push(track);
        }
        log(`Found ${tracks.length} tracks for playlist ${playlist.name}`);
        this._cache.playlistTracks.set(playlistId, tracks);
        return tracks;
      }

      // Fallback: Try getting tracks from Foundry playlists
      const tracks = [];
      for (const musicId of musicIds) {
        for (const foundryPlaylist of game.playlists) {
          const sound = foundryPlaylist.sounds.get(musicId);
          if (sound) {
            tracks.push({ id: sound.id, name: sound.name, path: sound.path });
            break;
          }
        }
      }

      if (tracks.length > 0) {
        log(`Found ${tracks.length} tracks via Foundry fallback`);
      } else {
        log('Could not resolve tracks. musicIds:', musicIds);
      }

      this._cache.playlistTracks.set(playlistId, tracks);
      return tracks;
    } catch (e) {
      logWarn('Failed to get playlist tracks:', e);
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
    const jukebox = this.jukebox;
    if (!trackId) return false;

    try {
      log(`Attempting to play track via NJ API: trackId=${trackId}`);

      // Ensure preview mode is OFF so the track is broadcast to players
      if (api?.setPreviewMode) {
        const state = api.getState?.();
        if (state?.isPreviewMode) {
          log('Disabling preview mode for broadcast');
          api.setPreviewMode(false);
        }
      }

      // Prefer the singleton path used by NJ's own UI.
      if (jukebox?.playMusic) {
        const track = await jukebox.playMusic(trackId, 'music');
        log('Playing track via NJ singleton playMusic:', track?.name || trackId);
        return true;
      }

      // Fall back to the public API when needed.
      if (api?.playMusic) {
        const track = await api.playMusic(trackId, 'music');
        log('Playing track via NJ API playMusic:', track?.name || trackId);
        return true;
      }

      logWarn('NJ playMusic method not available');
      return false;
    } catch (e) {
      logWarn('Failed to play track:', e);
      return false;
    }
  }

  /**
   * Add a music track to an NJ playlist. GM-only.
   * @param {string} playlistId - Target playlist ID
   * @param {Object} trackData - { name, url, source }
   * @returns {Promise<Object|null>} { track, playlist, created, reusedExisting } or null
   */
  static async addMusicToPlaylist(playlistId, trackData) {
    const api = this.api;
    const jukebox = this.jukebox;
    if (!playlistId || !trackData?.url) return null;

    try {
      const manualTrackData = this._buildManualMusicTrackData(trackData);

      // Mirror the NJ UI flow as closely as possible: use the singleton's
      // raw addMusic/addToPlaylist methods before falling back to API helpers.
      let track = null;
      if (jukebox?.addMusic) {
        track = await jukebox.addMusic(manualTrackData);
      } else if (api?.addMusic) {
        track = await api.addMusic(manualTrackData);
      } else {
        logWarn('NJ addMusic method not available');
        return null;
      }

      const created = true;

      const trackId = track?.id || track?._id;
      if (!trackId) {
        logWarn('NJ track add returned no track ID');
        return null;
      }

      let playlist = null;
      if (jukebox?.addToPlaylist) {
        playlist = await jukebox.addToPlaylist(playlistId, trackId);
      } else if (api?.addToPlaylist) {
        playlist = await api.addToPlaylist(playlistId, trackId);
      } else if (api?.addMusicToPlaylist) {
        const fallbackResult = await api.addMusicToPlaylist(playlistId, manualTrackData, { reuseExisting: false });
        playlist = fallbackResult?.playlist ?? null;
        track = fallbackResult?.track ?? track;
      } else {
        logWarn('NJ addToPlaylist method not available');
        return null;
      }

      const result = {
        track,
        playlist,
        created,
        reusedExisting: false
      };
      log('Added music to playlist:', result?.track?.name);
      return result;
    } catch (e) {
      logWarn('Failed to add music to playlist:', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYBACK CONTROLS (v6.0 — new scene-level playback)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Play a scene's soundtrack using the new tracks[] array.
   * Plays the first track in the array (future phases will add playback mode support).
   * @param {Array<{id: string, playlistId?: string}>} tracks - Soundtrack tracks
   * @param {string} [playbackMode='sequential'] - How to play tracks
   * @returns {Promise<boolean>} True if playback started
   */
  static async playSoundtrack(tracks, playbackMode = 'sequential') {
    if (!tracks?.length || !this.isAvailable) return false;

    // For now, play the first track's playlist. Future phases will add full multi-track support.
    const firstTrack = tracks[0];
    if (firstTrack.playlistId) {
      return this.playPlaylist(firstTrack.playlistId);
    }
    if (firstTrack.id) {
      return this.playTrack(null, firstTrack.id);
    }
    return false;
  }

  /**
   * Play a scene's ambience layers from the layers[] array.
   * Stops existing layers first, then adds each configured layer.
   * @param {Array<{id: string, name: string, volume?: number}>} layers - Ambience layers to activate
   * @returns {Promise<boolean>} True if at least one layer was activated
   */
  static async playAmbienceLayers(layers) {
    if (!layers?.length || !this.isAvailable) return false;

    // Stop existing layers first for clean slate
    await this.stopAmbience();

    let anySuccess = false;
    for (const layer of layers.slice(0, CONFIG.MAX_AMBIENCE_LAYERS)) {
      const success = await this.addAmbienceLayer(layer.id, layer.volume ?? 1.0);
      if (success) anySuccess = true;
    }
    return anySuccess;
  }

  /**
   * Fade out and stop all audio.
   * @param {number} [fadeDuration=0] - Fade-out duration in seconds (0 = instant)
   * @returns {Promise<boolean>} True if stopped
   */
  static async fadeOutAndStop(fadeDuration = 0) {
    const api = this.api;
    if (!this.isAvailable) return false;

    // If NJ supports fade and duration > 0, use it
    if (fadeDuration > 0 && api?.fadeOut) {
      try {
        await api.fadeOut(fadeDuration);
        log(`Fading out audio over ${fadeDuration}s`);
        return true;
      } catch (e) {
        logWarn('Fade out failed, falling back to instant stop:', e);
      }
    }

    // Instant stop fallback
    return this.stopAll();
  }

  /**
   * Set the music channel volume.
   * @param {number} volume - Volume level (0-1)
   * @returns {boolean} True if volume was set
   */
  static setMusicVolume(volume) {
    const api = this.api;
    if (!api) return false;
    const clamped = Math.max(0, Math.min(1, volume));

    if (api.setVolume) {
      try {
        api.setVolume(clamped, 'music');
        log(`Set music volume: ${clamped}`);
        return true;
      } catch (e) {
        logWarn('Failed to set music volume:', e);
      }
    }

    logWarn('No volume control method available in NJ API');
    return false;
  }

  /**
   * Get the current music channel volume.
   * @returns {number} Volume level 0-1, defaults to 1.0
   */
  static getMusicVolume() {
    const api = this.api;
    if (api?.getVolume) {
      try {
        return api.getVolume('music') ?? 1.0;
      } catch (e) {
        logWarn('Failed to get music volume:', e);
      }
    }
    return 1.0;
  }

  /* ═══════════════════════════════════════════════════════════════
     COMBINED / SCENE METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Stop all audio (music and ambience).
   * Always stops both individually to ensure both are stopped.
   * @returns {Promise<boolean>} True if at least one was stopped successfully
   */
  static async stopAll() {
    const musicStopped = await this.stopMusic();
    const ambienceStopped = await this.stopAmbience();
    return musicStopped || ambienceStopped;
  }

  /**
   * Play scene audio based on scene configuration.
   * Supports both new v6.0 schema (tracks[], layers[]) and legacy (playlistId, ambiencePresetId).
   * Checks auto-play flags before playing.
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

    const audio = scene.audio;

    // Music: prefer playlists[] > tracks[] > legacy _legacyPlaylistId
    if (music && audio.autoPlayMusic) {
      // Stop current music first to prevent stacking (NJ crossfade orphans old elements)
      await this.stopMusic();
      if (audio.playlists?.length > 0) {
        result.music = await this.playPlaylist(audio.playlists[0].id);
      } else if (audio.tracks?.length > 0) {
        result.music = await this.playSoundtrack(audio.tracks, audio.playbackMode);
      } else if (audio._legacyPlaylistId) {
        result.music = await this.playPlaylist(audio._legacyPlaylistId);
      }
      if (result.music && audio.volume !== 1.0) {
        this.setMusicVolume(audio.volume);
      }
    }

    // Ambience: prefer new layers[] over legacy _legacyAmbiencePresetId
    if (ambience && audio.autoPlayAmbience) {
      if (audio.layers?.length > 0) {
        result.ambience = await this.playAmbienceLayers(audio.layers);
      } else if (audio._legacyAmbiencePresetId) {
        result.ambience = await this.loadAmbiencePreset(audio._legacyAmbiencePresetId);
      }
    }

    return result;
  }

  /**
   * Restore scene audio without checking auto-play settings.
   * Used for manual restore buttons.
   * Supports both new v6.0 schema and legacy fallback.
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

    const audio = scene.audio;

    // Music: prefer playlists[] > tracks[] > legacy
    if (music) {
      // Stop current music first to prevent stacking (NJ crossfade orphans old elements)
      await this.stopMusic();
      if (audio.playlists?.length > 0) {
        result.music = await this.playPlaylist(audio.playlists[0].id);
      } else if (audio.tracks?.length > 0) {
        result.music = await this.playSoundtrack(audio.tracks, audio.playbackMode);
      } else if (audio._legacyPlaylistId) {
        result.music = await this.playPlaylist(audio._legacyPlaylistId);
      }
      if (result.music && audio.volume !== 1.0) {
        this.setMusicVolume(audio.volume);
      }
    }

    // Ambience: prefer new layers[] over legacy
    if (ambience) {
      if (audio.layers?.length > 0) {
        result.ambience = await this.playAmbienceLayers(audio.layers);
      } else if (audio._legacyAmbiencePresetId) {
        result.ambience = await this.loadAmbiencePreset(audio._legacyAmbiencePresetId);
      }
    }

    return result;
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILITY METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get display-friendly name for a playlist ID.
   * @param {string} playlistId - Playlist ID
   * @param {string|null} [fallbackName=null] - Stored fallback name when NJ lookup is unavailable
   * @returns {string} Playlist name or 'Unknown' if not found
   */
  static getPlaylistName(playlistId, fallbackName = null) {
    const playlist = this.getPlaylist(playlistId);
    return playlist?.name ?? fallbackName ?? 'Unknown Playlist';
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
}
