/**
 * Narrator's Jukebox - Playback Service
 * Handles all playback control operations for music, ambience, and soundboard
 */

import { JUKEBOX, SOUNDBOARD_END_CHECK } from '../core/constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { extractYouTubeVideoId } from '../utils/youtube-utils.js';
import { ambienceLayerManager } from '../core/ambience-layer-manager.js';
import { debugLog, debugError } from '../utils/debug.js';

/**
 * PlaybackService - Manages audio playback across all channels
 * Requires channels and dataService to be injected
 */
class PlaybackService {
  constructor() {
    this.channels = null;      // Injected: { music, ambience, soundboard }
    this.dataService = null;   // Injected: DataService instance
    this.syncService = null;   // Injected: SyncService instance

    // Playback state
    this.isPlaying = false;
    this.isAmbiencePlaying = false;
    this.shuffle = false;
    this.musicLoop = false;
    this.ambienceLoop = true;
    this.isPreviewMode = true;
    this.isMuted = false;
    this.isAmbienceMuted = false;
    this.volumeBeforeMute = 0.8;
    this.ambienceVolumeBeforeMute = 0.5;

    // Current playlist context
    this.currentPlaylist = null;

    // Soundboard active sounds
    this.activeSoundboardSounds = new Map();
    this.soundboardBroadcastMode = false;
    this.soundboardLoopState = new Map();
  }

  /**
   * Initialize the service with dependencies
   * @param {object} channels - Audio channels { music, ambience, soundboard }
   * @param {object} dataService - DataService instance
   * @param {object} syncService - SyncService instance (optional)
   */
  initialize(channels, dataService, syncService = null) {
    this.channels = channels;
    this.dataService = dataService;
    this.syncService = syncService;

    // Initialize the Ambience Layer Manager
    ambienceLayerManager.initialize(dataService, syncService);
  }

  // ==========================================
  // Music Playback
  // ==========================================

  /**
   * Play a music track
   * @param {string} id - Track ID
   * @param {string} channel - 'music' or 'ambience'
   */
  async playMusic(id, channel = 'music') {
    debugLog(` PlaybackService.playMusic: ${id} on ${channel}`);

    const track = this.dataService.findTrack(id, channel);

    if (!track) {
      debugError(` Track not found: ${id}`);
      throw new Error('Track not found');
    }

    if (channel === 'music') this.isPlaying = true;
    if (channel === 'ambience') this.isAmbiencePlaying = true;

    try {
      await this.channels[channel].play(track);
      debugLog(` Playback started for ${track.name}`);

      // Broadcast if not in preview mode
      if (game.user.isGM && !this.isPreviewMode && this.syncService) {
        const volume = this.channels[channel].volume;
        this.syncService.broadcastPlay(id, channel, volume);
        ui.notifications.info(`Broadcasting: ${track.name}`);
      }

      return track;
    } catch (err) {
      debugError(" Playback failed:", err);

      if (channel === 'music') this.isPlaying = false;
      if (channel === 'ambience') this.isAmbiencePlaying = false;

      throw err;
    }
  }

  /**
   * Play a playlist
   * @param {string} id - Playlist ID
   * @param {boolean} shuffleStart - Start with shuffle
   */
  playPlaylist(id, shuffleStart = false) {
    const playlist = this.dataService.getPlaylist(id);
    if (!playlist || !playlist.musicIds.length) return null;

    this.currentPlaylist = playlist;

    let trackIndex = 0;
    if (shuffleStart || this.shuffle) {
      trackIndex = Math.floor(Math.random() * playlist.musicIds.length);
    }

    this.playMusic(playlist.musicIds[trackIndex]);
    return playlist;
  }

  /**
   * Play a random track by tag
   * @param {string} tag - Tag to filter by
   */
  playRandomByTag(tag) {
    const candidates = this.dataService.getTracksByTag(tag, 'music');
    if (candidates.length) {
      const random = candidates[Math.floor(Math.random() * candidates.length)];
      this.playMusic(random.id);
      return random;
    } else {
      ui.notifications.warn(`No music found with tag: ${tag}`);
      return null;
    }
  }

  /**
   * Toggle play/pause
   * @param {string} channel - 'music' or 'ambience'
   */
  togglePlayPause(channel = 'music') {
    const isPlaying = (channel === 'music') ? this.isPlaying : this.isAmbiencePlaying;

    if (isPlaying) {
      this.channels[channel].pause();
      if (channel === 'music') this.isPlaying = false;
      else this.isAmbiencePlaying = false;

      if (game.user.isGM && !this.isPreviewMode && this.syncService) {
        this.syncService.broadcastPause(channel);
      }
    } else {
      this.channels[channel].resume();
      if (channel === 'music') this.isPlaying = true;
      else this.isAmbiencePlaying = true;

      if (game.user.isGM && !this.isPreviewMode && this.syncService) {
        this.syncService.broadcastResume(channel);
      }
    }
  }

  /**
   * Stop playback
   * @param {string} channel - 'music' or 'ambience'
   */
  stop(channel = 'music') {
    debugLog(` PlaybackService.stop: ${channel}`);
    this.channels[channel].stop();

    if (channel === 'music') {
      this.isPlaying = false;
    } else if (channel === 'ambience') {
      this.isAmbiencePlaying = false;
    }

    if (game.user.isGM && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastStop(channel);
    }
  }

  /**
   * Skip to next track
   * @param {boolean} wrap - If true, always wrap around at end (for manual next button).
   *                         If false, stop at end when musicLoop is off (for auto-advance).
   */
  next(wrap = false) {
    const currentId = this.channels.music.currentTrack?.id;

    // 1. Handle Playlist Logic
    if (this.currentPlaylist && this.currentPlaylist.musicIds.length) {
      let nextIndex = 0;

      if (this.shuffle) {
        // Smart shuffle: avoid repeating the same track consecutively
        nextIndex = this._getShuffleIndex(this.currentPlaylist.musicIds, currentId);
      } else {
        const currentIndex = this.currentPlaylist.musicIds.indexOf(currentId);
        nextIndex = currentIndex + 1;
        if (nextIndex >= this.currentPlaylist.musicIds.length) {
          if (this.musicLoop || wrap) {
            nextIndex = 0;
          } else {
            debugLog(" Playlist ended, no loop");
            this.isPlaying = false;
            return null;
          }
        }
      }

      return this.playMusic(this.currentPlaylist.musicIds[nextIndex]);
    }

    // 2. No playlist: Navigate through full music library
    const music = this.dataService.getAllMusic();
    if (music && music.length > 0) {
      const currentIndex = music.findIndex(m => m.id === currentId);

      if (this.shuffle) {
        // Smart shuffle: avoid repeating the same track consecutively
        const musicIds = music.map(m => m.id);
        const nextIndex = this._getShuffleIndex(musicIds, currentId);
        return this.playMusic(musicIds[nextIndex]);
      }

      let nextIndex = currentIndex + 1;
      if (nextIndex >= music.length) {
        if (this.musicLoop || wrap) {
          nextIndex = 0;
        } else {
          debugLog(" End of library, no loop");
          this.isPlaying = false;
          return null;
        }
      }

      return this.playMusic(music[nextIndex].id);
    }

    // 3. Single Track Loop (Fallback)
    if (this.musicLoop && currentId) {
      debugLog(" Looping single track:", currentId);
      return this.playMusic(currentId);
    }

    // 4. Nothing to play
    debugLog(" No next track available");
    this.isPlaying = false;
    return null;
  }

  /**
   * Skip to previous track or restart current
   */
  prev() {
    // Restart track if playing for more than 3 seconds
    if (this.channels.music.currentTime > 3) {
      this.channels.music.seek(0);
      return;
    }

    const currentId = this.channels.music.currentTrack?.id;

    // 1. Handle Playlist Logic
    if (this.currentPlaylist && this.currentPlaylist.musicIds.length) {
      const currentIndex = this.currentPlaylist.musicIds.indexOf(currentId);
      let prevIndex = currentIndex - 1;

      if (prevIndex < 0) {
        if (this.musicLoop) prevIndex = this.currentPlaylist.musicIds.length - 1;
        else prevIndex = 0;
      }

      return this.playMusic(this.currentPlaylist.musicIds[prevIndex]);
    }

    // 2. No playlist: Navigate through full music library
    const music = this.dataService.getAllMusic();
    if (music && music.length > 0) {
      const currentIndex = music.findIndex(m => m.id === currentId);
      let prevIndex = currentIndex - 1;

      if (prevIndex < 0) {
        if (this.musicLoop) {
          prevIndex = music.length - 1;
        } else {
          prevIndex = 0;
        }
      }

      return this.playMusic(music[prevIndex].id);
    }

    debugLog(" No previous track available");
    return null;
  }

  // ==========================================
  // Volume Control
  // ==========================================

  /**
   * Set volume for a channel
   * @param {string} channel - 'music' or 'ambience'
   * @param {number} value - Volume value (0-1)
   */
  setVolume(channel, value) {
    this.channels[channel].setVolume(value);

    if (channel === 'music' && this.isMuted && value > 0) {
      this.isMuted = false;
      game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED, false);
    }
    if (channel === 'ambience' && this.isAmbienceMuted && value > 0) {
      this.isAmbienceMuted = false;
      game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED, false);
    }

    // Persist volume to settings (only if not muting - mute sets volume to 0)
    if (value > 0) {
      if (channel === 'music') {
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME, value);
      } else if (channel === 'ambience') {
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_VOLUME, value);
      }
    }

    if (game.user.isGM && !this.isPreviewMode && this.syncService) {
      this.syncService.broadcastVolume(channel, value);
    }
  }

  /**
   * Toggle mute for a channel
   * @param {string} channel - 'music' or 'ambience'
   */
  toggleMute(channel = 'music') {
    if (channel === 'music') {
      if (this.isMuted) {
        this.setVolume(channel, this.volumeBeforeMute);
        this.isMuted = false;
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED, false);
      } else {
        this.volumeBeforeMute = this.channels[channel].volume;
        this.setVolume(channel, 0);
        this.isMuted = true;
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED, true);
      }
    } else if (channel === 'ambience') {
      if (this.isAmbienceMuted) {
        this.setVolume(channel, this.ambienceVolumeBeforeMute);
        this.isAmbienceMuted = false;
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED, false);
      } else {
        this.ambienceVolumeBeforeMute = this.channels[channel].volume;
        this.setVolume(channel, 0);
        this.isAmbienceMuted = true;
        game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED, true);
      }
    }
  }

  /**
   * Seek to a position in the current track
   * @param {string} channel - 'music' or 'ambience'
   * @param {number} percent - Position as percentage (0-100)
   */
  seek(channel, percent) {
    this.channels[channel].seek(percent);
  }

  /**
   * Get a random index that avoids the current track
   * Smart shuffle: prevents the same track from playing consecutively
   * @param {string[]} trackIds - Array of track IDs
   * @param {string} currentId - Current track ID to avoid
   * @returns {number} Random index different from current (if possible)
   */
  _getShuffleIndex(trackIds, currentId) {
    const length = trackIds.length;

    // If only one track, no choice but to repeat
    if (length <= 1) {
      return 0;
    }

    // Find current index
    const currentIndex = trackIds.indexOf(currentId);

    // If current track not found, just pick random
    if (currentIndex === -1) {
      return Math.floor(Math.random() * length);
    }

    // Pick a random index that's different from current
    // Generate random offset (1 to length-1), then add to current index
    const offset = 1 + Math.floor(Math.random() * (length - 1));
    return (currentIndex + offset) % length;
  }

  // ==========================================
  // Playback State Toggles
  // ==========================================

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    return this.shuffle;
  }

  toggleMusicLoop() {
    this.musicLoop = !this.musicLoop;
    return this.musicLoop;
  }

  toggleAmbienceLoop() {
    this.ambienceLoop = !this.ambienceLoop;
    return this.ambienceLoop;
  }

  togglePreviewMode() {
    this.isPreviewMode = !this.isPreviewMode;
    this.soundboardBroadcastMode = !this.isPreviewMode;
    return this.isPreviewMode;
  }

  // ==========================================
  // Soundboard Playback
  // ==========================================

  /**
   * Play a soundboard sound
   * @param {string} id - Sound ID
   * @param {object} options - { loop, preview }
   */
  async playSoundboardSound(id, options = {}) {
    const { loop = false, preview = true } = options;
    const sound = this.dataService.getSoundboardSound(id);

    if (!sound) {
      debugError(` Soundboard sound not found: ${id}`);
      ui.notifications.error('Sound not found');
      return;
    }

    // Check format compatibility
    if (sound.source !== 'youtube' && !JukeboxBrowser.isFormatSupported(sound.url)) {
      const ext = sound.url.split('.').pop().toLowerCase();
      const browser = JukeboxBrowser.getBrowserInfo();
      ui.notifications.warn(`Your browser (${browser.name}) may not support .${ext} files.`);
    }

    const startTime = sound.startTime || 0;
    const endTime = sound.endTime || null;

    debugLog(` Playing soundboard: ${sound.name}, loop: ${loop}`);

    // Stop if already playing
    if (this.activeSoundboardSounds.has(id)) {
      this.stopSoundboardSound(id);
    }

    try {
      if (sound.source === 'youtube') {
        await this._playSoundboardYouTube(id, sound, loop, preview, startTime, endTime);
      } else {
        await this._playSoundboardLocal(id, sound, loop, preview, startTime, endTime);
      }

      // Broadcast if not preview
      if (game.user.isGM && !preview && this.syncService) {
        this.syncService.broadcastSoundboardPlay(id, loop);
        ui.notifications.info(`Broadcasting sound: ${sound.name}`);
      }
    } catch (err) {
      debugError(" Soundboard playback failed:", err);
      ui.notifications.error(`Failed to play: ${sound.name}`);
    }
  }

  async _playSoundboardLocal(id, sound, loop, preview, startTime, endTime) {
    const audioElement = new Audio(sound.url);
    audioElement.volume = sound.volume || 0.8;

    if (startTime > 0) {
      audioElement.currentTime = startTime;
    }

    const shouldManualLoop = loop && (startTime > 0 || endTime !== null);
    if (!shouldManualLoop) {
      audioElement.loop = loop;
    }

    let endTimeHandler = null;
    if (endTime !== null) {
      endTimeHandler = () => {
        if (audioElement.currentTime >= endTime) {
          if (shouldManualLoop) {
            audioElement.currentTime = startTime;
          } else {
            this.stopSoundboardSound(id);
          }
        }
      };
      audioElement.addEventListener('timeupdate', endTimeHandler);
    }

    audioElement.addEventListener('ended', () => {
      if (shouldManualLoop) {
        audioElement.currentTime = startTime;
        audioElement.play();
      } else if (!loop) {
        this.stopSoundboardSound(id);
      }
    });

    const errorHandler = (e) => {
      debugError(" Soundboard audio error:", e);
      this.stopSoundboardSound(id);
      ui.notifications.error(`Failed to play: ${sound.name}`);
    };
    audioElement.addEventListener('error', errorHandler);

    await audioElement.play();

    this.activeSoundboardSounds.set(id, {
      type: 'local',
      audio: audioElement,
      isLooping: loop,
      isPreview: preview,
      startTime,
      endTime,
      endTimeHandler,
      errorHandler
    });
  }

  async _playSoundboardYouTube(id, sound, loop, preview, startTime, endTime) {
    const containerId = `jukebox-sb-yt-${id}`;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    await window.NarratorJukeboxYTReady;

    const videoId = extractYouTubeVideoId(sound.url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const volume = (sound.volume || 0.8) * 100;
    const shouldManualLoop = loop && (startTime > 0 || endTime !== null);

    const player = new YT.Player(containerId, {
      height: '1', width: '1',
      host: 'https://www.youtube-nocookie.com',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        start: Math.floor(startTime),
        end: endTime ? Math.floor(endTime) : undefined,
        loop: (loop && !shouldManualLoop) ? 1 : 0,
        playlist: (loop && !shouldManualLoop) ? videoId : undefined
      },
      events: {
        'onReady': (e) => {
          e.target.setVolume(volume);
          if (startTime > 0 && startTime % 1 !== 0) {
            e.target.seekTo(startTime, true);
          }
        },
        'onStateChange': (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            if (shouldManualLoop) {
              e.target.seekTo(startTime, true);
              e.target.playVideo();
            } else if (!loop) {
              this.stopSoundboardSound(id);
            }
          } else if (e.data === YT.PlayerState.PLAYING && endTime !== null) {
            const activeSound = this.activeSoundboardSounds.get(id);
            if (activeSound && !activeSound.endTimeInterval) {
              activeSound.endTimeInterval = setInterval(() => {
                const currentTime = e.target.getCurrentTime();
                if (currentTime >= endTime) {
                  if (shouldManualLoop) {
                    e.target.seekTo(startTime, true);
                  } else {
                    this.stopSoundboardSound(id);
                  }
                }
              }, SOUNDBOARD_END_CHECK);
            }
          }
        },
        'onError': (e) => {
          debugError(" YouTube soundboard error:", e);
          this.stopSoundboardSound(id);
        }
      }
    });

    this.activeSoundboardSounds.set(id, {
      type: 'youtube',
      player,
      containerId,
      isLooping: loop,
      isPreview: preview,
      startTime,
      endTime
    });
  }

  /**
   * Stop a soundboard sound
   * @param {string} id - Sound ID
   * @param {boolean} broadcast - Whether to broadcast the stop
   */
  stopSoundboardSound(id, broadcast = true) {
    const activeSound = this.activeSoundboardSounds.get(id);
    if (!activeSound) return;

    debugLog(` Stopping soundboard sound: ${id}`);

    if (activeSound.endTimeInterval) {
      clearInterval(activeSound.endTimeInterval);
    }

    if (activeSound.type === 'local' && activeSound.audio) {
      if (activeSound.endTimeHandler) {
        activeSound.audio.removeEventListener('timeupdate', activeSound.endTimeHandler);
      }
      // Remove error handler before clearing src to prevent false "Failed to play" errors
      if (activeSound.errorHandler) {
        activeSound.audio.removeEventListener('error', activeSound.errorHandler);
      }
      activeSound.audio.pause();
      activeSound.audio.currentTime = 0;
      activeSound.audio.src = '';
    } else if (activeSound.type === 'youtube' && activeSound.player) {
      if (activeSound.player.stopVideo) activeSound.player.stopVideo();
      if (activeSound.player.destroy) activeSound.player.destroy();
      const container = document.getElementById(activeSound.containerId);
      if (container) container.remove();
    }

    const wasPreview = activeSound.isPreview;
    this.activeSoundboardSounds.delete(id);

    if (game.user.isGM && broadcast && !wasPreview && this.syncService) {
      this.syncService.broadcastSoundboardStop(id);
    }
  }

  /**
   * Stop all soundboard sounds
   */
  stopAllSoundboardSounds() {
    debugLog(" Stopping all soundboard sounds");
    for (const [id] of this.activeSoundboardSounds) {
      this.stopSoundboardSound(id, false);
    }

    if (game.user.isGM && this.syncService) {
      this.syncService.broadcastSoundboardStopAll();
    }
  }

  /**
   * Check if a soundboard sound is playing
   * @param {string} id - Sound ID
   */
  isSoundboardSoundPlaying(id) {
    return this.activeSoundboardSounds.has(id);
  }

  // ==========================================
  // Ambience Layer Playback
  // ==========================================

  /**
   * Play an ambience track as a layer (multi-layer system)
   * @param {string} trackId - Track ID to add as layer
   * @returns {Promise<object|null>} The created layer or null if failed
   */
  async playAmbienceLayer(trackId) {
    // Update preview mode in layer manager
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    return await ambienceLayerManager.addLayer(trackId);
  }

  /**
   * Stop an ambience layer
   * @param {string} trackId - Track ID to stop
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  stopAmbienceLayer(trackId, broadcast = true) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    ambienceLayerManager.removeLayer(trackId, broadcast);
  }

  /**
   * Toggle an ambience layer on/off
   * @param {string} trackId - Track ID to toggle
   * @returns {Promise<boolean>} New state (true = playing)
   */
  async toggleAmbienceLayer(trackId) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    return await ambienceLayerManager.toggleLayer(trackId);
  }

  /**
   * Set volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @param {number} volume - Volume value (0-1)
   */
  setAmbienceLayerVolume(trackId, volume) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    ambienceLayerManager.setLayerVolume(trackId, volume);
  }

  /**
   * Get volume for a specific ambience layer
   * @param {string} trackId - Track ID
   * @returns {number} Volume value (0-1)
   */
  getAmbienceLayerVolume(trackId) {
    return ambienceLayerManager.getLayerVolume(trackId);
  }

  /**
   * Set master volume for all ambience layers
   * @param {number} volume - Volume value (0-1)
   */
  setAmbienceMasterVolume(volume) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    ambienceLayerManager.setMasterVolume(volume);
  }

  /**
   * Get master volume for ambience layers
   * @returns {number} Volume value (0-1)
   */
  getAmbienceMasterVolume() {
    return ambienceLayerManager.masterVolume;
  }

  /**
   * Toggle master mute for all ambience layers
   * @returns {boolean} New mute state
   */
  toggleAmbienceMasterMute() {
    return ambienceLayerManager.toggleMasterMute();
  }

  /**
   * Check if ambience master is muted
   * @returns {boolean}
   */
  isAmbienceMasterMuted() {
    return ambienceLayerManager.isMasterMuted;
  }

  /**
   * Get all active ambience layers
   * @returns {Array<{trackId: string, track: object, volume: number}>}
   */
  getActiveAmbienceLayers() {
    return ambienceLayerManager.getActiveLayers();
  }

  /**
   * Get the number of active ambience layers
   * @returns {number}
   */
  getAmbienceLayerCount() {
    return ambienceLayerManager.layerCount;
  }

  /**
   * Check if an ambience track is currently playing as a layer
   * @param {string} trackId - Track ID to check
   * @returns {boolean}
   */
  isAmbienceLayerActive(trackId) {
    return ambienceLayerManager.isLayerActive(trackId);
  }

  /**
   * Stop all ambience layers
   * @param {boolean} broadcast - Whether to broadcast the change
   */
  stopAllAmbienceLayers(broadcast = true) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    ambienceLayerManager.stopAll(broadcast);
  }

  /**
   * Get the serializable state of all ambience layers (for sync/presets)
   * @returns {object}
   */
  getAmbienceLayersState() {
    return ambienceLayerManager.getLayersState();
  }

  /**
   * Restore ambience layers state (for sync/presets)
   * @param {object} state - State object from getAmbienceLayersState()
   * @param {boolean} broadcast - Whether to broadcast after restore
   */
  async restoreAmbienceLayersState(state, broadcast = false) {
    ambienceLayerManager.setPreviewMode(this.isPreviewMode);
    await ambienceLayerManager.restoreState(state, broadcast);
  }

  /**
   * Check if we can add more ambience layers
   * @returns {boolean}
   */
  canAddAmbienceLayer() {
    return ambienceLayerManager.canAddLayer();
  }

  /**
   * Get the Ambience Layer Manager instance (for advanced use)
   * @returns {AmbienceLayerManager}
   */
  getAmbienceLayerManager() {
    return ambienceLayerManager;
  }

  /**
   * Check if there are pending ambience layers waiting for user interaction
   * (blocked by autoplay policy)
   * @returns {boolean}
   */
  hasAmbiencePendingLayers() {
    return ambienceLayerManager.hasPendingLayers();
  }

  /**
   * Retry playing ambience layers that were blocked by autoplay policy
   * Call this after user interaction (e.g., click)
   */
  async retryAmbiencePendingLayers() {
    await ambienceLayerManager.retryPendingLayers();
  }

  // ==========================================
  // Getters for current state
  // ==========================================

  getCurrentMusicTrack() {
    return this.channels?.music?.currentTrack || null;
  }

  getCurrentAmbienceTrack() {
    return this.channels?.ambience?.currentTrack || null;
  }

  getMusicProgress() {
    if (!this.channels?.music) return { current: 0, duration: 0, percent: 0 };
    const current = this.channels.music.currentTime || 0;
    const duration = this.channels.music.duration || 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    return { current, duration, percent };
  }

  getAmbienceProgress() {
    if (!this.channels?.ambience) return { current: 0, duration: 0, percent: 0 };
    const current = this.channels.ambience.currentTime || 0;
    const duration = this.channels.ambience.duration || 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    return { current, duration, percent };
  }
}

// Export singleton instance
export const playbackService = new PlaybackService();

// Also export the class for testing
export { PlaybackService };

// Re-export ambienceLayerManager for direct access
export { ambienceLayerManager };
