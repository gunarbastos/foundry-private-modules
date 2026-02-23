/**
 * Narrator's Jukebox - Public API
 *
 * A comprehensive, well-documented API for integrating with the Narrator's Jukebox module.
 * Enables other modules (like Exalted Scenes) to control music, ambience, and soundboard.
 *
 * @module NarratorJukeboxAPI
 * @version 1.0.0
 *
 * @example
 * // Access the API (recommended pattern)
 * const api = game.modules.get('narrator-jukebox').api;
 *
 * // Play a playlist by name
 * await api.playPlaylistByName('Combat Music');
 *
 * // Play random track with tag
 * await api.playRandomByTag('tavern', 'ambience');
 *
 * // Listen for events
 * Hooks.on('narratorJukebox.trackChanged', ({ track, channel }) => {
 *   console.log(`Now playing: ${track.name}`);
 * });
 */

/**
 * @typedef {Object} Track
 * @property {string} id - Unique track identifier
 * @property {string} name - Display name
 * @property {string} url - Audio file URL or YouTube URL
 * @property {string} source - 'local' or 'youtube'
 * @property {string[]} [tags] - Tags for categorization
 * @property {string} [thumbnail] - Thumbnail image URL
 * @property {number} [volume] - Track-specific volume (0-1)
 * @property {number} [startTime] - Start time in seconds
 * @property {number} [endTime] - End time in seconds
 */

/**
 * @typedef {Object} Playlist
 * @property {string} id - Unique playlist identifier
 * @property {string} name - Display name
 * @property {string[]} musicIds - Array of track IDs
 */

/**
 * @typedef {Object} SoundboardSound
 * @property {string} id - Unique sound identifier
 * @property {string} name - Display name
 * @property {string} url - Audio file URL or YouTube URL
 * @property {string} source - 'local' or 'youtube'
 * @property {number} volume - Sound volume (0-1)
 * @property {string} color - Hex color for UI card
 * @property {string} [icon] - FontAwesome icon class
 * @property {string} [thumbnail] - Thumbnail image URL
 * @property {number} [startTime] - Start time in seconds
 * @property {number} [endTime] - End time in seconds
 */

/**
 * @typedef {Object} PlaybackState
 * @property {boolean} isPlaying - Music channel is playing
 * @property {boolean} isAmbiencePlaying - Ambience channel is playing
 * @property {Track|null} currentMusicTrack - Current music track
 * @property {Track|null} currentAmbienceTrack - Current ambience track
 * @property {Playlist|null} currentPlaylist - Active playlist
 * @property {boolean} shuffle - Shuffle mode enabled
 * @property {boolean} musicLoop - Music loop enabled
 * @property {boolean} ambienceLoop - Ambience loop enabled
 * @property {boolean} isPreviewMode - Preview mode (GM only, no broadcast)
 * @property {number} musicVolume - Music volume (0-1)
 * @property {number} ambienceVolume - Ambience volume (0-1)
 * @property {boolean} isMusicMuted - Music is muted
 * @property {boolean} isAmbienceMuted - Ambience is muted
 * @property {Object} musicProgress - {current, duration, percent}
 * @property {Object} ambienceProgress - {current, duration, percent}
 * @property {string[]} activeSoundboardSounds - IDs of playing soundboard sounds
 * @property {AmbienceLayer[]} activeAmbienceLayers - Active ambience layers
 * @property {number} ambienceLayerCount - Number of active ambience layers (0-8)
 * @property {number} ambienceMasterVolume - Master volume for ambience layers (0-1)
 * @property {boolean} isAmbienceMasterMuted - Whether ambience master is muted
 */

/**
 * @typedef {Object} SearchOptions
 * @property {boolean} [fuzzy=true] - Use fuzzy matching
 * @property {boolean} [caseSensitive=false] - Case-sensitive search
 * @property {number} [limit=10] - Maximum results to return
 */

/**
 * @typedef {'music'|'ambience'|'both'} Library
 */

/**
 * @typedef {'music'|'ambience'} Channel
 */

/**
 * @typedef {Object} AmbienceLayer
 * @property {string} id - Track ID being played as layer
 * @property {string} name - Track display name
 * @property {number} volume - Layer volume (0-1)
 * @property {boolean} isPlaying - Whether the layer is currently playing
 */

/**
 * @typedef {Object} AmbiencePreset
 * @property {string} id - Unique preset identifier
 * @property {string} name - Display name
 * @property {Object[]} layers - Array of layer states
 * @property {number} masterVolume - Master volume when preset was saved
 * @property {number} createdAt - Timestamp when preset was created
 */

import { debugLog, debugWarn, debugError } from '../utils/debug.js';

/**
 * Public API for Narrator's Jukebox
 * Provides a clean, documented interface for external module integration.
 */
export class NarratorJukeboxAPI {

  /**
   * API version (semver)
   * @type {string}
   * @readonly
   */
  static VERSION = '1.1.0';

  /**
   * Minimum compatible module version
   * @type {string}
   * @readonly
   */
  static MIN_MODULE_VERSION = '3.0.0';

  /** @private */
  _jukebox = null;
  /** @private */
  _dataService = null;
  /** @private */
  _playbackService = null;
  /** @private */
  _syncService = null;
  /** @private */
  _ready = false;
  /** @private */
  _previousMusicTrack = null;
  /** @private */
  _previousAmbienceTrack = null;

  /**
   * Create a new API instance
   * @param {Object} jukebox - NarratorJukebox singleton instance
   * @param {Object} dataService - DataService instance
   * @param {Object} playbackService - PlaybackService instance
   * @param {Object} syncService - SyncService instance
   */
  constructor(jukebox, dataService, playbackService, syncService) {
    this._jukebox = jukebox;
    this._dataService = dataService;
    this._playbackService = playbackService;
    this._syncService = syncService;
    this._ready = true;

    debugLog(`API v${NarratorJukeboxAPI.VERSION} initialized`);
  }

  // ==========================================
  // API Metadata
  // ==========================================

  /**
   * Check if the API is ready for use
   * @returns {boolean}
   */
  isReady() {
    return this._ready && this._jukebox !== null;
  }

  /**
   * Get the API version
   * @returns {string}
   */
  getVersion() {
    return NarratorJukeboxAPI.VERSION;
  }

  /**
   * Check if current user is GM
   * @returns {boolean}
   */
  isGM() {
    return game.user?.isGM ?? false;
  }

  /**
   * Register a callback for when API is ready
   * @param {Function} callback - Function to call when ready
   * @deprecated Use Hooks.once('narratorJukebox.ready') instead
   */
  onReady(callback) {
    if (this.isReady()) {
      callback(this);
    } else {
      Hooks.once('narratorJukebox.ready', ({ api }) => callback(api));
    }
  }

  // ==========================================
  // Input Validation (Private)
  // ==========================================

  /**
   * Validate channel parameter
   * @private
   * @param {string} channel
   * @returns {Channel}
   */
  _validateChannel(channel) {
    const valid = ['music', 'ambience'];
    const normalized = String(channel).toLowerCase();
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid channel: "${channel}". Must be 'music' or 'ambience'.`);
    }
    return normalized;
  }

  /**
   * Validate library parameter
   * @private
   * @param {string} library
   * @returns {Library}
   */
  _validateLibrary(library) {
    const valid = ['music', 'ambience', 'both'];
    const normalized = String(library).toLowerCase();
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid library: "${library}". Must be 'music', 'ambience', or 'both'.`);
    }
    return normalized;
  }

  /**
   * Validate volume parameter
   * @private
   * @param {number} volume
   * @returns {number}
   */
  _validateVolume(volume) {
    const num = Number(volume);
    if (isNaN(num) || num < 0 || num > 1) {
      throw new Error(`Invalid volume: "${volume}". Must be a number between 0 and 1.`);
    }
    return num;
  }

  /**
   * Validate percent parameter
   * @private
   * @param {number} percent
   * @returns {number}
   */
  _validatePercent(percent) {
    const num = Number(percent);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error(`Invalid percent: "${percent}". Must be a number between 0 and 100.`);
    }
    return num;
  }

  /**
   * Require string parameter
   * @private
   * @param {*} value
   * @param {string} name
   * @returns {string}
   */
  _requireString(value, name) {
    if (!value || typeof value !== 'string') {
      throw new Error(`${name} is required and must be a non-empty string.`);
    }
    return value;
  }

  /**
   * Fire error hook and optionally re-throw
   * @private
   * @param {Error} error
   * @param {string} context
   * @param {Object} [params]
   */
  _handleError(error, context, params = {}) {
    Hooks.call('narratorJukebox.error', { error, context, params });
    throw error;
  }

  // ==========================================
  // Playback Control
  // ==========================================

  /**
   * Play a track by ID
   * @param {string} id - Track ID
   * @param {Channel} [channel='music'] - Target channel
   * @returns {Promise<Track>} The track that started playing
   * @throws {Error} If track not found or playback fails
   * @fires narratorJukebox.play
   * @fires narratorJukebox.trackChanged
   */
  async playMusic(id, channel = 'music') {
    try {
      this._requireString(id, 'Track ID');
      channel = this._validateChannel(channel);

      const previousTrack = channel === 'music'
        ? this._previousMusicTrack
        : this._previousAmbienceTrack;

      const track = await this._playbackService.playMusic(id, channel);

      if (track) {
        Hooks.call('narratorJukebox.play', { track, channel });
        Hooks.call('narratorJukebox.trackChanged', { track, previousTrack, channel });

        if (channel === 'music') {
          this._previousMusicTrack = track;
        } else {
          this._previousAmbienceTrack = track;
        }
      }

      return track;
    } catch (error) {
      this._handleError(error, 'playMusic', { id, channel });
    }
  }

  /**
   * Play a track by name (fuzzy search)
   * @param {string} name - Track name to search
   * @param {Channel} [channel='music'] - Target channel
   * @returns {Promise<Track|null>} The track that started, or null if not found
   * @fires narratorJukebox.play
   * @fires narratorJukebox.trackChanged
   */
  async playTrackByName(name, channel = 'music') {
    try {
      this._requireString(name, 'Track name');
      channel = this._validateChannel(channel);

      const tracks = this.findTrackByName(name, channel, { limit: 1 });
      if (tracks.length === 0) {
        debugWarn(` No track found matching: "${name}"`);
        return null;
      }

      return await this.playMusic(tracks[0].id, channel);
    } catch (error) {
      this._handleError(error, 'playTrackByName', { name, channel });
    }
  }

  /**
   * Play a playlist by ID
   * @param {string} id - Playlist ID
   * @param {boolean} [shuffleStart=false] - Start with random track
   * @returns {Promise<Playlist>} The playlist that started
   * @throws {Error} If playlist not found or empty
   * @fires narratorJukebox.playlistStarted
   * @fires narratorJukebox.play
   */
  async playPlaylist(id, shuffleStart = false) {
    try {
      this._requireString(id, 'Playlist ID');

      const playlist = await this._playbackService.playPlaylist(id, shuffleStart);

      if (playlist) {
        Hooks.call('narratorJukebox.playlistStarted', { playlist });
      }

      return playlist;
    } catch (error) {
      this._handleError(error, 'playPlaylist', { id, shuffleStart });
    }
  }

  /**
   * Play a playlist by name (case-insensitive search)
   * @param {string} name - Playlist name
   * @param {boolean} [shuffleStart=false] - Start with random track
   * @returns {Promise<Playlist>} The playlist that started
   * @throws {Error} If playlist not found
   * @example
   * await api.playPlaylistByName('Combat Music');
   * await api.playPlaylistByName('Tavern Songs', true); // Start shuffled
   */
  async playPlaylistByName(name, shuffleStart = false) {
    try {
      this._requireString(name, 'Playlist name');

      const playlist = this.findPlaylistByName(name);
      if (!playlist) {
        throw new Error(`Playlist not found: "${name}"`);
      }

      return await this.playPlaylist(playlist.id, shuffleStart);
    } catch (error) {
      this._handleError(error, 'playPlaylistByName', { name, shuffleStart });
    }
  }

  /**
   * Play a random track with a specific tag
   * @param {string} tag - Tag to filter by
   * @param {Library} [library='music'] - Which library to search
   * @returns {Promise<Track|null>} The track that started, or null if none found
   * @fires narratorJukebox.play
   * @example
   * await api.playRandomByTag('combat');
   * await api.playRandomByTag('forest', 'ambience');
   */
  async playRandomByTag(tag, library = 'music') {
    try {
      this._requireString(tag, 'Tag');
      library = this._validateLibrary(library);

      // For 'both', pick a random library first
      let targetLibrary = library;
      if (library === 'both') {
        const musicTracks = this._dataService.getTracksByTag(tag, 'music');
        const ambienceTracks = this._dataService.getTracksByTag(tag, 'ambience');

        if (musicTracks.length === 0 && ambienceTracks.length === 0) {
          debugWarn(` No tracks found with tag: "${tag}"`);
          return null;
        }

        // Weighted random based on count
        const total = musicTracks.length + ambienceTracks.length;
        targetLibrary = Math.random() < (musicTracks.length / total) ? 'music' : 'ambience';
      }

      const tracks = this._dataService.getTracksByTag(tag, targetLibrary);
      if (tracks.length === 0) {
        debugWarn(` No ${targetLibrary} tracks found with tag: "${tag}"`);
        return null;
      }

      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      const channel = targetLibrary === 'ambience' ? 'ambience' : 'music';

      return await this.playMusic(randomTrack.id, channel);
    } catch (error) {
      this._handleError(error, 'playRandomByTag', { tag, library });
    }
  }

  /**
   * Toggle play/pause for a channel
   * @param {Channel} [channel='music'] - Target channel
   * @returns {boolean} New playing state (true = playing, false = paused)
   * @fires narratorJukebox.pause or narratorJukebox.resume
   */
  togglePlayPause(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const wasPlaying = channel === 'music'
        ? this._playbackService.isPlaying
        : this._playbackService.isAmbiencePlaying;

      this._playbackService.togglePlayPause(channel);

      const isNowPlaying = channel === 'music'
        ? this._playbackService.isPlaying
        : this._playbackService.isAmbiencePlaying;

      if (wasPlaying && !isNowPlaying) {
        Hooks.call('narratorJukebox.pause', { channel });
      } else if (!wasPlaying && isNowPlaying) {
        Hooks.call('narratorJukebox.resume', { channel });
      }

      return isNowPlaying;
    } catch (error) {
      this._handleError(error, 'togglePlayPause', { channel });
    }
  }

  /**
   * Pause playback on a channel
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.pause
   */
  pause(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const isPlaying = channel === 'music'
        ? this._playbackService.isPlaying
        : this._playbackService.isAmbiencePlaying;

      if (isPlaying) {
        this._playbackService.togglePlayPause(channel);
        Hooks.call('narratorJukebox.pause', { channel });
      }
    } catch (error) {
      this._handleError(error, 'pause', { channel });
    }
  }

  /**
   * Resume playback on a channel
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.resume
   */
  resume(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const isPlaying = channel === 'music'
        ? this._playbackService.isPlaying
        : this._playbackService.isAmbiencePlaying;

      if (!isPlaying) {
        this._playbackService.togglePlayPause(channel);
        Hooks.call('narratorJukebox.resume', { channel });
      }
    } catch (error) {
      this._handleError(error, 'resume', { channel });
    }
  }

  /**
   * Stop playback on a channel
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.stop
   */
  stop(channel = 'music') {
    try {
      channel = this._validateChannel(channel);
      this._playbackService.stop(channel);
      Hooks.call('narratorJukebox.stop', { channel });
    } catch (error) {
      this._handleError(error, 'stop', { channel });
    }
  }

  /**
   * Stop all playback (music, ambience, and soundboard)
   * @fires narratorJukebox.stop
   * @fires narratorJukebox.soundboard.stopAll
   */
  stopAll() {
    try {
      this._playbackService.stop('music');
      this._playbackService.stop('ambience');
      this._playbackService.stopAllSoundboardSounds();

      Hooks.call('narratorJukebox.stop', { channel: 'music' });
      Hooks.call('narratorJukebox.stop', { channel: 'ambience' });
      Hooks.call('narratorJukebox.soundboard.stopAll', {});
    } catch (error) {
      this._handleError(error, 'stopAll', {});
    }
  }

  /**
   * Skip to next track
   * @returns {Promise<Track|null>} Next track, or null if at end
   * @fires narratorJukebox.trackChanged
   */
  async next() {
    try {
      const previousTrack = this._previousMusicTrack;
      const track = await this._playbackService.next();

      if (track) {
        Hooks.call('narratorJukebox.trackChanged', {
          track,
          previousTrack,
          channel: 'music'
        });
        this._previousMusicTrack = track;
      }

      return track;
    } catch (error) {
      this._handleError(error, 'next', {});
    }
  }

  /**
   * Go to previous track (or restart current if >3 seconds in)
   * @returns {Promise<Track|null>} Previous track
   * @fires narratorJukebox.trackChanged
   */
  async prev() {
    try {
      const previousTrack = this._previousMusicTrack;
      const track = await this._playbackService.prev();

      if (track && track.id !== previousTrack?.id) {
        Hooks.call('narratorJukebox.trackChanged', {
          track,
          previousTrack,
          channel: 'music'
        });
        this._previousMusicTrack = track;
      }

      return track;
    } catch (error) {
      this._handleError(error, 'prev', {});
    }
  }

  /**
   * Seek to position in current track
   * @param {number} percent - Position as percentage (0-100)
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.seek
   */
  seek(percent, channel = 'music') {
    try {
      percent = this._validatePercent(percent);
      channel = this._validateChannel(channel);

      this._playbackService.seek(channel, percent);

      const progress = channel === 'music'
        ? this._playbackService.getMusicProgress()
        : this._playbackService.getAmbienceProgress();

      Hooks.call('narratorJukebox.seek', {
        channel,
        percent,
        time: progress?.current ?? 0
      });
    } catch (error) {
      this._handleError(error, 'seek', { percent, channel });
    }
  }

  // ==========================================
  // Volume Control
  // ==========================================

  /**
   * Set volume for a channel
   * @param {number} volume - Volume level (0-1)
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.volumeChanged
   */
  setVolume(volume, channel = 'music') {
    try {
      volume = this._validateVolume(volume);
      channel = this._validateChannel(channel);

      this._playbackService.setVolume(channel, volume);
      Hooks.call('narratorJukebox.volumeChanged', { channel, volume });
    } catch (error) {
      this._handleError(error, 'setVolume', { volume, channel });
    }
  }

  /**
   * Get volume for a channel
   * @param {Channel} [channel='music'] - Target channel
   * @returns {number} Volume level (0-1)
   */
  getVolume(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      if (channel === 'music') {
        return this._jukebox?.channels?.music?.volume ?? 0.8;
      } else {
        return this._jukebox?.channels?.ambience?.volume ?? 0.5;
      }
    } catch (error) {
      this._handleError(error, 'getVolume', { channel });
    }
  }

  /**
   * Toggle mute for a channel
   * @param {Channel} [channel='music'] - Target channel
   * @returns {boolean} New muted state
   * @fires narratorJukebox.muteChanged
   */
  toggleMute(channel = 'music') {
    try {
      channel = this._validateChannel(channel);
      this._playbackService.toggleMute(channel);

      const muted = channel === 'music'
        ? this._playbackService.isMuted
        : this._playbackService.isAmbienceMuted;

      Hooks.call('narratorJukebox.muteChanged', { channel, muted });
      return muted;
    } catch (error) {
      this._handleError(error, 'toggleMute', { channel });
    }
  }

  /**
   * Mute a channel
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.muteChanged
   */
  mute(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const isMuted = channel === 'music'
        ? this._playbackService.isMuted
        : this._playbackService.isAmbienceMuted;

      if (!isMuted) {
        this._playbackService.toggleMute(channel);
        Hooks.call('narratorJukebox.muteChanged', { channel, muted: true });
      }
    } catch (error) {
      this._handleError(error, 'mute', { channel });
    }
  }

  /**
   * Unmute a channel
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.muteChanged
   */
  unmute(channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const isMuted = channel === 'music'
        ? this._playbackService.isMuted
        : this._playbackService.isAmbienceMuted;

      if (isMuted) {
        this._playbackService.toggleMute(channel);
        Hooks.call('narratorJukebox.muteChanged', { channel, muted: false });
      }
    } catch (error) {
      this._handleError(error, 'unmute', { channel });
    }
  }

  // ==========================================
  // Playback Options
  // ==========================================

  /**
   * Toggle shuffle mode
   * @returns {boolean} New shuffle state
   * @fires narratorJukebox.shuffleChanged
   */
  toggleShuffle() {
    try {
      this._playbackService.toggleShuffle();
      const enabled = this._playbackService.shuffle;
      Hooks.call('narratorJukebox.shuffleChanged', { enabled });
      return enabled;
    } catch (error) {
      this._handleError(error, 'toggleShuffle', {});
    }
  }

  /**
   * Set shuffle mode
   * @param {boolean} enabled
   * @fires narratorJukebox.shuffleChanged
   */
  setShuffle(enabled) {
    try {
      if (this._playbackService.shuffle !== enabled) {
        this._playbackService.toggleShuffle();
        Hooks.call('narratorJukebox.shuffleChanged', { enabled });
      }
    } catch (error) {
      this._handleError(error, 'setShuffle', { enabled });
    }
  }

  /**
   * Toggle music loop mode
   * @returns {boolean} New loop state
   * @fires narratorJukebox.loopChanged
   */
  toggleMusicLoop() {
    try {
      this._playbackService.toggleMusicLoop();
      const enabled = this._playbackService.musicLoop;
      Hooks.call('narratorJukebox.loopChanged', { channel: 'music', enabled });
      return enabled;
    } catch (error) {
      this._handleError(error, 'toggleMusicLoop', {});
    }
  }

  /**
   * Toggle ambience loop mode
   * @returns {boolean} New loop state
   * @fires narratorJukebox.loopChanged
   */
  toggleAmbienceLoop() {
    try {
      this._playbackService.toggleAmbienceLoop();
      const enabled = this._playbackService.ambienceLoop;
      Hooks.call('narratorJukebox.loopChanged', { channel: 'ambience', enabled });
      return enabled;
    } catch (error) {
      this._handleError(error, 'toggleAmbienceLoop', {});
    }
  }

  /**
   * Set loop mode for a channel
   * @param {boolean} enabled
   * @param {Channel} [channel='music'] - Target channel
   * @fires narratorJukebox.loopChanged
   */
  setLoop(enabled, channel = 'music') {
    try {
      channel = this._validateChannel(channel);

      const currentLoop = channel === 'music'
        ? this._playbackService.musicLoop
        : this._playbackService.ambienceLoop;

      if (currentLoop !== enabled) {
        if (channel === 'music') {
          this._playbackService.toggleMusicLoop();
        } else {
          this._playbackService.toggleAmbienceLoop();
        }
        Hooks.call('narratorJukebox.loopChanged', { channel, enabled });
      }
    } catch (error) {
      this._handleError(error, 'setLoop', { enabled, channel });
    }
  }

  /**
   * Toggle preview mode (GM only - prevents broadcasting to players)
   * @returns {boolean} New preview mode state
   * @fires narratorJukebox.previewModeChanged
   */
  togglePreviewMode() {
    try {
      this._playbackService.togglePreviewMode();
      const enabled = this._playbackService.isPreviewMode;
      Hooks.call('narratorJukebox.previewModeChanged', { enabled });
      return enabled;
    } catch (error) {
      this._handleError(error, 'togglePreviewMode', {});
    }
  }

  /**
   * Set preview mode
   * @param {boolean} enabled
   * @fires narratorJukebox.previewModeChanged
   */
  setPreviewMode(enabled) {
    try {
      if (this._playbackService.isPreviewMode !== enabled) {
        this._playbackService.togglePreviewMode();
        Hooks.call('narratorJukebox.previewModeChanged', { enabled });
      }
    } catch (error) {
      this._handleError(error, 'setPreviewMode', { enabled });
    }
  }

  // ==========================================
  // Soundboard
  // ==========================================

  /**
   * Play a soundboard sound
   * @param {string} id - Sound ID
   * @param {Object} [options={}]
   * @param {boolean} [options.loop=false] - Loop the sound
   * @param {boolean} [options.preview=false] - Preview only (don't broadcast)
   * @returns {Promise<void>}
   * @throws {Error} If sound not found
   * @fires narratorJukebox.soundboard.play
   */
  async playSoundboardSound(id, options = {}) {
    try {
      this._requireString(id, 'Sound ID');
      const { loop = false, preview = false } = options;

      await this._playbackService.playSoundboardSound(id, { loop, preview });

      const sound = this._dataService.getSoundboardSound(id);
      Hooks.call('narratorJukebox.soundboard.play', { sound, loop });
    } catch (error) {
      this._handleError(error, 'playSoundboardSound', { id, options });
    }
  }

  /**
   * Play a soundboard sound by name
   * @param {string} name - Sound name (case-insensitive search)
   * @param {Object} [options={}] - Same as playSoundboardSound
   * @returns {Promise<void>}
   * @throws {Error} If sound not found
   */
  async playSoundboardSoundByName(name, options = {}) {
    try {
      this._requireString(name, 'Sound name');

      const sound = this.findSoundboardSoundByName(name);
      if (!sound) {
        throw new Error(`Soundboard sound not found: "${name}"`);
      }

      await this.playSoundboardSound(sound.id, options);
    } catch (error) {
      this._handleError(error, 'playSoundboardSoundByName', { name, options });
    }
  }

  /**
   * Stop a soundboard sound
   * @param {string} id - Sound ID
   * @fires narratorJukebox.soundboard.stop
   */
  stopSoundboardSound(id) {
    try {
      this._requireString(id, 'Sound ID');
      this._playbackService.stopSoundboardSound(id);
      Hooks.call('narratorJukebox.soundboard.stop', { soundId: id });
    } catch (error) {
      this._handleError(error, 'stopSoundboardSound', { id });
    }
  }

  /**
   * Stop all soundboard sounds
   * @fires narratorJukebox.soundboard.stopAll
   */
  stopAllSoundboardSounds() {
    try {
      this._playbackService.stopAllSoundboardSounds();
      Hooks.call('narratorJukebox.soundboard.stopAll', {});
    } catch (error) {
      this._handleError(error, 'stopAllSoundboardSounds', {});
    }
  }

  /**
   * Check if a soundboard sound is playing
   * @param {string} id - Sound ID
   * @returns {boolean}
   */
  isSoundboardSoundPlaying(id) {
    try {
      return this._playbackService.isSoundboardSoundPlaying(id);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all active soundboard sounds (currently playing)
   * @returns {string[]} Array of sound IDs
   */
  getActiveSoundboardSounds() {
    try {
      const active = this._playbackService.activeSoundboardSounds;
      return active ? Array.from(active.keys()) : [];
    } catch (error) {
      return [];
    }
  }

  // ==========================================
  // Ambience Layer Control
  // ==========================================

  /**
   * Play a track as an ambience layer
   * Allows multiple ambience tracks to play simultaneously (up to 8 layers).
   * @param {string} trackId - Track ID from the ambience library
   * @returns {Promise<AmbienceLayer|null>} The layer that started, or null if limit reached
   * @throws {Error} If track not found
   * @fires narratorJukebox.ambienceLayer.play
   * @example
   * await api.playAmbienceLayer('rain-ambient');
   * await api.playAmbienceLayer('tavern-chatter');
   */
  async playAmbienceLayer(trackId) {
    try {
      this._requireString(trackId, 'Track ID');

      if (!this.canAddAmbienceLayer() && !this.isAmbienceLayerActive(trackId)) {
        debugWarn(' Maximum ambience layers reached (8)');
        return null;
      }

      const result = await this._jukebox.playAmbienceLayer(trackId);

      if (result) {
        const track = this._dataService.getAmbience(trackId);
        Hooks.call('narratorJukebox.ambienceLayer.play', {
          trackId,
          track,
          layerCount: this.getAmbienceLayerCount()
        });
      }

      return result;
    } catch (error) {
      this._handleError(error, 'playAmbienceLayer', { trackId });
    }
  }

  /**
   * Stop an ambience layer
   * @param {string} trackId - Track ID to stop
   * @fires narratorJukebox.ambienceLayer.stop
   */
  stopAmbienceLayer(trackId) {
    try {
      this._requireString(trackId, 'Track ID');

      this._jukebox.stopAmbienceLayer(trackId);

      Hooks.call('narratorJukebox.ambienceLayer.stop', {
        trackId,
        layerCount: this.getAmbienceLayerCount()
      });
    } catch (error) {
      this._handleError(error, 'stopAmbienceLayer', { trackId });
    }
  }

  /**
   * Toggle an ambience layer on/off
   * @param {string} trackId - Track ID to toggle
   * @returns {Promise<boolean>} New state (true = playing, false = stopped)
   * @fires narratorJukebox.ambienceLayer.play or narratorJukebox.ambienceLayer.stop
   * @example
   * const isPlaying = await api.toggleAmbienceLayer('rain-ambient');
   */
  async toggleAmbienceLayer(trackId) {
    try {
      this._requireString(trackId, 'Track ID');

      const wasActive = this.isAmbienceLayerActive(trackId);

      if (wasActive) {
        this.stopAmbienceLayer(trackId);
        return false;
      } else {
        const result = await this.playAmbienceLayer(trackId);
        return result !== null;
      }
    } catch (error) {
      this._handleError(error, 'toggleAmbienceLayer', { trackId });
    }
  }

  /**
   * Set volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @param {number} volume - Volume level (0-1)
   * @fires narratorJukebox.ambienceLayer.volumeChanged
   */
  setAmbienceLayerVolume(trackId, volume) {
    try {
      this._requireString(trackId, 'Track ID');
      volume = this._validateVolume(volume);

      this._jukebox.setAmbienceLayerVolume(trackId, volume);

      Hooks.call('narratorJukebox.ambienceLayer.volumeChanged', {
        trackId,
        volume
      });
    } catch (error) {
      this._handleError(error, 'setAmbienceLayerVolume', { trackId, volume });
    }
  }

  /**
   * Get volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @returns {number} Volume level (0-1), or 0 if layer not active
   */
  getAmbienceLayerVolume(trackId) {
    try {
      return this._jukebox.getAmbienceLayerVolume(trackId) ?? 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all active ambience layers
   * @returns {AmbienceLayer[]} Array of active layer objects
   * @example
   * const layers = api.getActiveAmbienceLayers();
   * layers.forEach(layer => console.log(`${layer.name}: ${layer.volume}`));
   */
  getActiveAmbienceLayers() {
    try {
      return this._jukebox.getActiveAmbienceLayers() ?? [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get the count of active ambience layers
   * @returns {number} Number of active layers (0-8)
   */
  getAmbienceLayerCount() {
    try {
      return this._jukebox.getAmbienceLayerCount() ?? 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if a specific track is active as an ambience layer
   * @param {string} trackId - Track ID to check
   * @returns {boolean}
   */
  isAmbienceLayerActive(trackId) {
    try {
      return this._jukebox.isAmbienceLayerActive(trackId) ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if more ambience layers can be added (limit: 8)
   * @returns {boolean}
   */
  canAddAmbienceLayer() {
    try {
      return this._jukebox.canAddAmbienceLayer() ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop all ambience layers
   * @fires narratorJukebox.ambienceLayer.stopAll
   */
  stopAllAmbienceLayers() {
    try {
      this._jukebox.stopAllAmbienceLayers();
      Hooks.call('narratorJukebox.ambienceLayer.stopAll', {});
    } catch (error) {
      this._handleError(error, 'stopAllAmbienceLayers', {});
    }
  }

  /**
   * Set the master volume for all ambience layers
   * @param {number} volume - Volume level (0-1)
   * @fires narratorJukebox.ambienceMaster.volumeChanged
   */
  setAmbienceMasterVolume(volume) {
    try {
      volume = this._validateVolume(volume);
      this._jukebox.setAmbienceMasterVolume(volume);
      Hooks.call('narratorJukebox.ambienceMaster.volumeChanged', { volume });
    } catch (error) {
      this._handleError(error, 'setAmbienceMasterVolume', { volume });
    }
  }

  /**
   * Get the master volume for ambience layers
   * @returns {number} Volume level (0-1)
   */
  getAmbienceMasterVolume() {
    try {
      return this._jukebox.getAmbienceMasterVolume() ?? 0.5;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Toggle master mute for all ambience layers
   * @returns {boolean} New muted state
   * @fires narratorJukebox.ambienceMaster.muteChanged
   */
  toggleAmbienceMasterMute() {
    try {
      this._jukebox.toggleAmbienceMasterMute();
      const muted = this._jukebox.isAmbienceMasterMuted() ?? false;
      Hooks.call('narratorJukebox.ambienceMaster.muteChanged', { muted });
      return muted;
    } catch (error) {
      this._handleError(error, 'toggleAmbienceMasterMute', {});
    }
  }

  /**
   * Check if ambience master is muted
   * @returns {boolean}
   */
  isAmbienceMasterMuted() {
    try {
      return this._jukebox.isAmbienceMasterMuted() ?? false;
    } catch (error) {
      return false;
    }
  }

  // ==========================================
  // Ambience Presets
  // ==========================================

  /**
   * Get all saved ambience presets
   * @returns {AmbiencePreset[]}
   * @example
   * const presets = api.getAmbiencePresets();
   * presets.forEach(p => console.log(p.name));
   */
  getAmbiencePresets() {
    try {
      return this._jukebox.getAmbiencePresets() ?? [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get a specific ambience preset by ID
   * @param {string} presetId - Preset ID
   * @returns {AmbiencePreset|null}
   */
  getAmbiencePreset(presetId) {
    try {
      this._requireString(presetId, 'Preset ID');
      return this._jukebox.getAmbiencePreset(presetId) ?? null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load an ambience preset (restores saved layer configuration)
   * @param {string} presetId - Preset ID to load
   * @returns {Promise<boolean>} True if loaded successfully
   * @fires narratorJukebox.ambiencePreset.loaded
   * @example
   * await api.loadAmbiencePreset('tavern-preset-id');
   */
  async loadAmbiencePreset(presetId) {
    try {
      this._requireString(presetId, 'Preset ID');

      const preset = this.getAmbiencePreset(presetId);
      if (!preset) {
        throw new Error(`Ambience preset not found: "${presetId}"`);
      }

      await this._jukebox.loadAmbiencePreset(presetId);

      Hooks.call('narratorJukebox.ambiencePreset.loaded', {
        presetId,
        preset
      });

      return true;
    } catch (error) {
      this._handleError(error, 'loadAmbiencePreset', { presetId });
    }
  }

  /**
   * Save the current ambience layer configuration as a preset
   * @param {string} name - Name for the preset
   * @returns {Promise<AmbiencePreset>} The saved preset
   * @fires narratorJukebox.ambiencePreset.saved
   * @example
   * const preset = await api.saveAmbiencePreset('My Tavern Mix');
   */
  async saveAmbiencePreset(name) {
    try {
      this._requireString(name, 'Preset name');

      const preset = await this._jukebox.saveAmbiencePreset(name);

      if (preset) {
        Hooks.call('narratorJukebox.ambiencePreset.saved', { preset });
      }

      return preset;
    } catch (error) {
      this._handleError(error, 'saveAmbiencePreset', { name });
    }
  }

  /**
   * Delete an ambience preset
   * @param {string} presetId - Preset ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   * @fires narratorJukebox.ambiencePreset.deleted
   */
  async deleteAmbiencePreset(presetId) {
    try {
      this._requireString(presetId, 'Preset ID');

      const preset = this.getAmbiencePreset(presetId);
      const result = await this._jukebox.deleteAmbiencePreset(presetId);

      if (result) {
        Hooks.call('narratorJukebox.ambiencePreset.deleted', {
          presetId,
          preset
        });
      }

      return result;
    } catch (error) {
      this._handleError(error, 'deleteAmbiencePreset', { presetId });
    }
  }

  // ==========================================
  // State & Information
  // ==========================================

  /**
   * Get complete playback state snapshot
   * @returns {PlaybackState}
   */
  getState() {
    try {
      return {
        isPlaying: this._playbackService.isPlaying ?? false,
        isAmbiencePlaying: this._playbackService.isAmbiencePlaying ?? false,
        currentMusicTrack: this._playbackService.getCurrentMusicTrack() ?? null,
        currentAmbienceTrack: this._playbackService.getCurrentAmbienceTrack() ?? null,
        currentPlaylist: this._playbackService.currentPlaylist ?? null,
        shuffle: this._playbackService.shuffle ?? false,
        musicLoop: this._playbackService.musicLoop ?? false,
        ambienceLoop: this._playbackService.ambienceLoop ?? true,
        isPreviewMode: this._playbackService.isPreviewMode ?? true,
        musicVolume: this.getVolume('music'),
        ambienceVolume: this.getVolume('ambience'),
        isMusicMuted: this._playbackService.isMuted ?? false,
        isAmbienceMuted: this._playbackService.isAmbienceMuted ?? false,
        musicProgress: this._playbackService.getMusicProgress() ?? { current: 0, duration: 0, percent: 0 },
        ambienceProgress: this._playbackService.getAmbienceProgress() ?? { current: 0, duration: 0, percent: 0 },
        activeSoundboardSounds: this.getActiveSoundboardSounds(),
        // Ambience Layer Mixer state
        activeAmbienceLayers: this.getActiveAmbienceLayers(),
        ambienceLayerCount: this.getAmbienceLayerCount(),
        ambienceMasterVolume: this.getAmbienceMasterVolume(),
        isAmbienceMasterMuted: this.isAmbienceMasterMuted()
      };
    } catch (error) {
      debugError(' Error getting state:', error);
      return {
        isPlaying: false,
        isAmbiencePlaying: false,
        currentMusicTrack: null,
        currentAmbienceTrack: null,
        currentPlaylist: null,
        shuffle: false,
        musicLoop: false,
        ambienceLoop: true,
        isPreviewMode: true,
        musicVolume: 0.8,
        ambienceVolume: 0.5,
        isMusicMuted: false,
        isAmbienceMuted: false,
        musicProgress: { current: 0, duration: 0, percent: 0 },
        ambienceProgress: { current: 0, duration: 0, percent: 0 },
        activeSoundboardSounds: [],
        // Ambience Layer Mixer state
        activeAmbienceLayers: [],
        ambienceLayerCount: 0,
        ambienceMasterVolume: 0.5,
        isAmbienceMasterMuted: false
      };
    }
  }

  /**
   * Get current music track
   * @returns {Track|null}
   */
  getCurrentMusicTrack() {
    return this._playbackService.getCurrentMusicTrack() ?? null;
  }

  /**
   * Get current ambience track
   * @returns {Track|null}
   */
  getCurrentAmbienceTrack() {
    return this._playbackService.getCurrentAmbienceTrack() ?? null;
  }

  /**
   * Get current active playlist
   * @returns {Playlist|null}
   */
  getCurrentPlaylist() {
    return this._playbackService.currentPlaylist ?? null;
  }

  /**
   * Get music playback progress
   * @returns {{current: number, duration: number, percent: number}}
   */
  getMusicProgress() {
    return this._playbackService.getMusicProgress() ?? { current: 0, duration: 0, percent: 0 };
  }

  /**
   * Get ambience playback progress
   * @returns {{current: number, duration: number, percent: number}}
   */
  getAmbienceProgress() {
    return this._playbackService.getAmbienceProgress() ?? { current: 0, duration: 0, percent: 0 };
  }

  /**
   * Check if music is currently playing
   * @returns {boolean}
   */
  isPlaying() {
    return this._playbackService.isPlaying ?? false;
  }

  /**
   * Check if ambience is currently playing
   * @returns {boolean}
   */
  isAmbiencePlaying() {
    return this._playbackService.isAmbiencePlaying ?? false;
  }

  // ==========================================
  // Data Access - Tracks
  // ==========================================

  /**
   * Get all music tracks
   * @returns {Track[]}
   */
  getAllMusic() {
    return this._dataService.getAllMusic() ?? [];
  }

  /**
   * Get all ambience tracks
   * @returns {Track[]}
   */
  getAllAmbience() {
    return this._dataService.getAllAmbience() ?? [];
  }

  /**
   * Get a track by ID from a specific library
   * @param {string} id - Track ID
   * @param {Library} [library='music'] - Which library to search
   * @returns {Track|null}
   */
  getTrack(id, library = 'music') {
    try {
      library = this._validateLibrary(library);

      if (library === 'music') {
        return this._dataService.getMusic(id) ?? null;
      } else if (library === 'ambience') {
        return this._dataService.getAmbience(id) ?? null;
      } else {
        // 'both' - search music first, then ambience
        return this._dataService.getMusic(id) ?? this._dataService.getAmbience(id) ?? null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Find a track by ID in any library
   * @param {string} id - Track ID
   * @returns {{track: Track, library: Library}|null}
   */
  findTrack(id) {
    try {
      const musicTrack = this._dataService.getMusic(id);
      if (musicTrack) return { track: musicTrack, library: 'music' };

      const ambienceTrack = this._dataService.getAmbience(id);
      if (ambienceTrack) return { track: ambienceTrack, library: 'ambience' };

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find tracks by name (fuzzy search)
   * @param {string} name - Search query
   * @param {Library} [library='both'] - Which library to search
   * @param {SearchOptions} [options={}] - Search options
   * @returns {Track[]} Matching tracks sorted by relevance
   * @example
   * const tracks = api.findTrackByName('battle');
   * const ambience = api.findTrackByName('forest', 'ambience', { limit: 5 });
   */
  findTrackByName(name, library = 'both', options = {}) {
    try {
      this._requireString(name, 'Search name');
      library = this._validateLibrary(library);

      const { fuzzy = true, caseSensitive = false, limit = 10 } = options;
      const searchName = caseSensitive ? name : name.toLowerCase();

      let tracks = [];
      if (library === 'music' || library === 'both') {
        tracks = tracks.concat(this._dataService.getAllMusic() ?? []);
      }
      if (library === 'ambience' || library === 'both') {
        tracks = tracks.concat(this._dataService.getAllAmbience() ?? []);
      }

      const results = tracks
        .map(track => {
          const trackName = caseSensitive ? track.name : track.name.toLowerCase();

          // Exact match
          if (trackName === searchName) {
            return { track, score: 1.0 };
          }

          // Starts with
          if (trackName.startsWith(searchName)) {
            return { track, score: 0.9 };
          }

          // Contains match
          if (trackName.includes(searchName)) {
            return { track, score: 0.8 };
          }

          // Fuzzy: word overlap
          if (fuzzy) {
            const searchWords = searchName.split(/\s+/);
            const trackWords = trackName.split(/\s+/);
            const matches = searchWords.filter(sw =>
              trackWords.some(tw => tw.includes(sw) || sw.includes(tw))
            );
            if (matches.length > 0) {
              return { track, score: (matches.length / searchWords.length) * 0.6 };
            }
          }

          return null;
        })
        .filter(r => r !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.track);

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get tracks by tag
   * @param {string} tag - Tag to filter by
   * @param {Library} [library='music'] - Which library to search
   * @returns {Track[]}
   */
  getTracksByTag(tag, library = 'music') {
    try {
      library = this._validateLibrary(library);
      return this._dataService.getTracksByTag(tag, library) ?? [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all unique tags from music library
   * @returns {string[]} Sorted array of tags
   */
  getAllMusicTags() {
    return this._dataService.getAllMusicTags() ?? [];
  }

  /**
   * Get all unique tags from ambience library
   * @returns {string[]} Sorted array of tags
   */
  getAllAmbienceTags() {
    return this._dataService.getAllAmbienceTags() ?? [];
  }

  /**
   * Get all unique tags from both libraries
   * @returns {string[]} Sorted array of unique tags
   */
  getAllTags() {
    const musicTags = this.getAllMusicTags();
    const ambienceTags = this.getAllAmbienceTags();
    const allTags = [...new Set([...musicTags, ...ambienceTags])];
    return allTags.sort();
  }

  // ==========================================
  // Data Access - Playlists
  // ==========================================

  /**
   * Get all playlists
   * @returns {Playlist[]}
   */
  getAllPlaylists() {
    return this._dataService.getAllPlaylists() ?? [];
  }

  /**
   * Get a playlist by ID
   * @param {string} id - Playlist ID
   * @returns {Playlist|null}
   */
  getPlaylist(id) {
    return this._dataService.getPlaylist(id) ?? null;
  }

  /**
   * Find a playlist by name (case-insensitive)
   * @param {string} name - Playlist name
   * @returns {Playlist|null}
   * @example
   * const playlist = api.findPlaylistByName('Combat Music');
   */
  findPlaylistByName(name) {
    try {
      this._requireString(name, 'Playlist name');
      const searchName = name.toLowerCase();
      const playlists = this._dataService.getAllPlaylists() ?? [];
      return playlists.find(p => p.name.toLowerCase() === searchName) ?? null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get playlist with resolved track objects
   * @param {string} id - Playlist ID
   * @returns {{id: string, name: string, musicIds: string[], tracks: Track[]}|null}
   */
  getPlaylistWithTracks(id) {
    return this._dataService.getPlaylistWithTracks(id) ?? null;
  }

  // ==========================================
  // Data Access - Soundboard
  // ==========================================

  /**
   * Get all soundboard sounds
   * @returns {SoundboardSound[]}
   */
  getAllSoundboardSounds() {
    return this._dataService.getAllSoundboardSounds() ?? [];
  }

  /**
   * Get a soundboard sound by ID
   * @param {string} id - Sound ID
   * @returns {SoundboardSound|null}
   */
  getSoundboardSound(id) {
    return this._dataService.getSoundboardSound(id) ?? null;
  }

  /**
   * Find soundboard sound by name (case-insensitive)
   * @param {string} name - Sound name
   * @returns {SoundboardSound|null}
   */
  findSoundboardSoundByName(name) {
    try {
      this._requireString(name, 'Sound name');
      const searchName = name.toLowerCase();
      const sounds = this._dataService.getAllSoundboardSounds() ?? [];
      return sounds.find(s => s.name.toLowerCase() === searchName) ?? null;
    } catch (error) {
      return null;
    }
  }

  // ==========================================
  // UI Control
  // ==========================================

  /**
   * Open the Jukebox window
   */
  open() {
    try {
      this._jukebox?.openApp?.();
    } catch (error) {
      // Fallback to render
      const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
      if (app) {
        app.render(true, { focus: true });
      } else {
        new window.NarratorsJukeboxApp().render(true);
      }
    }
  }

  /**
   * Close the Jukebox window
   */
  close() {
    const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
    if (app) {
      app.close();
    }
  }

  /**
   * Toggle the Jukebox window open/closed
   */
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if Jukebox window is currently open
   * @returns {boolean}
   */
  isOpen() {
    return Object.values(ui.windows).some(w => w.id === 'narrator-jukebox');
  }
}
