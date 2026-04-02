/**
 * Narrator's Jukebox - Audio Channel
 * Handles audio playback for music, ambience, and soundboard channels
 */

import { JUKEBOX, FADE_INTERVAL, YOUTUBE_FADE_INTERVAL } from './constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';
import { getYouTubeErrorDetails, normalizeYouTubeUrl, styleHiddenYouTubeContainer } from '../utils/youtube-utils.js';

/**
 * AudioChannel class - manages playback for a single audio channel
 * Supports both local audio files and YouTube playback
 */
export class AudioChannel {
  constructor(name) {
    this.name = name; // 'music' or 'ambience'
    this.volume = 0.8;
    this.currentTrack = null;
    this.audioElement = null; // For local files
    this.youtubePlayer = null; // For YouTube
    this.youtubeReady = false;

    // Robust Interval Management
    this.activeIntervals = new Set();

    // Play generation counter: prevents concurrent play() calls from creating phantom audio
    this._playGeneration = 0;

    // Tracks an in-flight YouTube load so we can retry or fail deterministically.
    this._pendingYouTubeLoad = null;

    // Tracks an in-flight YouTube player creation so we don't stack players.
    this._pendingYouTubePlayerCreation = null;

    // Monotonic token for the active YouTube player instance.
    this._youtubePlayerToken = 0;

    // Delayed fallback that forces a fade-in if YouTube playback starts muted.
    this._youtubeFadeSafetyTimeout = null;
  }

  async initialize() {
    if (!document.getElementById(`jukebox-yt-${this.name}`)) {
      const div = document.createElement('div');
      div.id = `jukebox-yt-${this.name}`;
      styleHiddenYouTubeContainer(div);
      document.body.appendChild(div);
    }
  }

  /**
   * Starts an interval and tracks it to ensure it can be cleared later.
   */
  startInterval(callback, ms) {
    const id = setInterval(() => {
        if (!this.activeIntervals.has(id)) {
            clearInterval(id);
            return;
        }
        callback(id);
    }, ms);
    this.activeIntervals.add(id);
    return id;
  }

  /**
   * Immediately clears all active intervals (fades, etc).
   */
  clearAllIntervals() {
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals.clear();
  }

  /**
   * Crossfade duration in ms, read from module settings.
   * Falls back to 2000ms if settings are not yet registered.
   */
  get crossfadeDuration() {
    try {
      return game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.CROSSFADE_DURATION) ?? 2000;
    } catch {
      return 2000;
    }
  }

  _clampVolume(value) {
    const numeric = Number.isFinite(value) ? value : parseFloat(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(numeric, 1));
  }

  /**
   * Keep the slider value for UI/settings, but shape music playback so
   * low values are easier to control and max volume is less aggressive.
   */
  _getEffectiveVolume(value = this.volume) {
    const normalized = this._clampVolume(value);

    if (this.name !== 'music') {
      return normalized;
    }

    return Math.min(Math.pow(normalized, 2) * 0.7, 1);
  }

  _getEffectiveYouTubeVolume(value = this.volume) {
    return Math.round(this._getEffectiveVolume(value) * 100);
  }

  /**
   * Start an interval that is NOT tracked in activeIntervals.
   * Used for fade-outs on detached audio elements that must complete
   * independently even when the channel starts new playback.
   */
  _startDetachedInterval(callback, ms) {
    const id = setInterval(() => callback(id), ms);
    return id;
  }

  async play(track, startCallback = null) {
    debugLog(`AudioChannel.play() called for ${this.name}`, track);

    // Increment play generation to invalidate any concurrent in-flight play() calls
    const generation = ++this._playGeneration;

    // 1. Atomic Reset: Stop all pending fades/actions
    this.clearAllIntervals();
    this._clearYouTubeCrossfade();
    this._clearYouTubeFadeSafetyTimeout();

    // Normalize legacy/embedded track shapes before validating.
    // Older suggestion payloads used `path` instead of `url` and sometimes omitted `source`.
    track = this._normalizeTrack(track);

    // Validate track data
    if (!track || !track.url) {
      debugError(`Invalid track provided to play()`);
      throw new Error("Invalid track");
    }

    // Check format compatibility for local files
    if (track.source !== 'youtube' && !JukeboxBrowser.isFormatSupported(track.url)) {
      const ext = track.url.split('.').pop().toLowerCase();
      const browser = JukeboxBrowser.getBrowserInfo();
      const supported = browser.formats.join(', ');
      ui.notifications.warn(`Narrator Jukebox: Your browser (${browser.name}) may not support .${ext} files. Supported formats: ${supported}`);
      debugWarn(`Format .${ext} may not be supported in ${browser.name}`);
    }

    const oldTrack = this.currentTrack;
    this.currentTrack = track;

    // 2. Handle Transitions
    // If we have an existing local audio element, we must fade it out and destroy it
    if (this.audioElement) {
        this._removeAudioListeners(this.audioElement); // Prevent phantom triggers during fade-out
        this.fadeOutLocal(this.audioElement);
        this.audioElement = null; // Detach from channel immediately
    }

    // If we have a YouTube player, we have to be careful.
    // If we are switching TO YouTube, we just load the new video (no crossfade possible on same player).
    // If we are switching FROM YouTube TO Local, we fade out YouTube.
    if (this.youtubePlayer && track.source !== 'youtube') {
        this.fadeOutYouTube();
    }

    // 3. Start New Playback
    try {
        if (track.source === 'youtube') {
            await this.playYouTube(track.url);
        } else {
            const newAudio = await this.playLocal(track.url);

            // Check if this play was superseded by a newer play() call during the await
            if (this._playGeneration !== generation) {
                debugLog(`Play superseded for ${track.name}, cleaning up stale audio`);
                this._teardownLocalAudio(newAudio);
                return;
            }

            this.audioElement = newAudio;
            this.fadeIn(newAudio);
        }

        if (startCallback) startCallback();

    } catch (err) {
        // Only handle error if this is still the active play
        if (this._playGeneration !== generation) return;
        debugError(`Playback failed:`, err);
        this.currentTrack = null; // Revert state
        throw err;
    }
  }

  async playLocal(url) {
    const newAudio = new Audio(url);
    newAudio.volume = 0; // Start silent for fade in
    newAudio.loop = (this.name === 'ambience');

    // Store named references so we can remove them later (prevents phantom audio)
    newAudio._jbOnEnded = () => {
      debugLog(`Track ended on ${this.name}`);
      Hooks.call('narratorJukeboxTrackEnded', this.name);
    };
    newAudio._jbOnError = (e) => {
      debugError(`Audio error on ${this.name}:`, e);
      Hooks.call('narratorJukeboxPlaybackError', { channel: this.name, error: e });
    };
    newAudio._jbOnLoaded = () => {
      Hooks.call('narratorJukeboxTrackLoaded', this.name);
    };

    // Crossfade pre-scheduling: fire track-ended early so the next track
    // starts while this one is still playing, enabling true crossfade.
    const crossfadeMs = this.crossfadeDuration;
    if (crossfadeMs > 0 && !newAudio.loop) {
      newAudio._jbOnCrossfade = () => {
        const remaining = (newAudio.duration - newAudio.currentTime) * 1000;
        // Only trigger if we know the duration and track is long enough for crossfade
        if (!isFinite(newAudio.duration) || newAudio.duration * 1000 <= crossfadeMs) return;
        if (remaining <= crossfadeMs && remaining > 0) {
          debugLog(`Crossfade pre-trigger on ${this.name}: ${Math.round(remaining)}ms remaining`);
          // Remove both listeners to prevent double-advance
          newAudio.removeEventListener('timeupdate', newAudio._jbOnCrossfade);
          newAudio._jbOnCrossfade = null;
          newAudio.removeEventListener('ended', newAudio._jbOnEnded);
          newAudio._jbOnEnded = null;
          Hooks.call('narratorJukeboxTrackEnded', this.name);
        }
      };
      newAudio.addEventListener('timeupdate', newAudio._jbOnCrossfade);
    }

    newAudio.addEventListener('ended', newAudio._jbOnEnded);
    newAudio.addEventListener('error', newAudio._jbOnError);
    newAudio.addEventListener('canplaythrough', newAudio._jbOnLoaded);

    await newAudio.play();
    // Return the element — play() handles assignment after generation check
    return newAudio;
  }

  async playYouTube(url) {
    const videoId = this.extractYouTubeId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    await window.NarratorJukeboxYTReady;

    // Ensure YouTube container div exists (stop() removes it from DOM)
    this._ensureYouTubeDiv();
    await this._loadYouTubeVideo(videoId);

    this._scheduleYouTubeFadeSafety();
  }

  _clearPendingYouTubeLoad() {
    const pending = this._pendingYouTubeLoad;
    if (!pending) return null;
    clearTimeout(pending.timeoutId);
    this._pendingYouTubeLoad = null;
    return pending;
  }

  _resolvePendingYouTubeLoad() {
    const pending = this._clearPendingYouTubeLoad();
    pending?.resolve?.();
  }

  _rejectPendingYouTubeLoad(error) {
    const pending = this._clearPendingYouTubeLoad();
    pending?.reject?.(error);
  }

  _clearPendingYouTubePlayerCreation() {
    const pending = this._pendingYouTubePlayerCreation;
    if (!pending) return null;
    clearTimeout(pending.timeoutId);
    this._pendingYouTubePlayerCreation = null;
    return pending;
  }

  _rejectPendingYouTubePlayerCreation(error) {
    const pending = this._clearPendingYouTubePlayerCreation();
    pending?.reject?.(error);
  }

  _clearYouTubeFadeSafetyTimeout() {
    if (this._youtubeFadeSafetyTimeout) {
      clearTimeout(this._youtubeFadeSafetyTimeout);
      this._youtubeFadeSafetyTimeout = null;
    }
  }

  _scheduleYouTubeFadeSafety() {
    this._clearYouTubeFadeSafetyTimeout();

    const player = this.youtubePlayer;
    const token = this._youtubePlayerToken;

    this._youtubeFadeSafetyTimeout = setTimeout(() => {
      this._youtubeFadeSafetyTimeout = null;

      if (!player || this.youtubePlayer !== player || token !== this._youtubePlayerToken || !this.currentTrack) {
        return;
      }

      try {
        const currentVol = player.getVolume?.() || 0;
        if (currentVol === 0) {
          debugWarn(`YouTube ${this.name}: volume still 0 after 3s, forcing fade-in`);
          this.fadeInYouTube();
        }
      } catch (e) {
        debugWarn(`YouTube ${this.name}: volume check failed:`, e);
      }
    }, 3000);
  }

  _destroyYouTubePlayer() {
    this._youtubePlayerToken++;
    this._clearYouTubeFadeSafetyTimeout();
    this._rejectPendingYouTubePlayerCreation(new Error(`YouTube player reset for ${this.name}`));
    this._rejectPendingYouTubeLoad(new Error(`YouTube player reset for ${this.name}`));
    this._clearYouTubeCrossfade();

    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.stopVideo?.();
      } catch (error) {}
      try {
        this.youtubePlayer.destroy?.();
      } catch (error) {}
    }

    this.youtubePlayer = null;
    this.youtubeReady = false;

    const div = document.getElementById(`jukebox-yt-${this.name}`);
    if (div) div.remove();
  }

  async _loadYouTubeVideo(videoId, attempt = 0) {
    try {
      if (!this.youtubePlayer || !this.youtubeReady || !this.youtubePlayer.loadVideoById) {
        await this.createYouTubePlayer();
      }

      if (!this.youtubePlayer || !this.youtubePlayer.loadVideoById) {
        throw new Error(`YouTube player not ready for ${this.name}`);
      }

      await new Promise((resolve, reject) => {
        this._rejectPendingYouTubeLoad(new Error(`Superseded YouTube load on ${this.name}`));

        const timeoutId = setTimeout(() => {
          this._rejectPendingYouTubeLoad(new Error(`YouTube video load timed out for ${this.name}`));
        }, 12000);

        this._pendingYouTubeLoad = { resolve, reject, timeoutId, videoId };

        try {
          // Start at volume 0 then fade in via onStateChange -> PLAYING
          this.youtubePlayer.setVolume(0);
          this.youtubePlayer.loadVideoById(videoId);

          // Explicitly call playVideo to ensure playback starts.
          if (this.youtubePlayer.playVideo) {
            this.youtubePlayer.playVideo();
          }
        } catch (error) {
          this._rejectPendingYouTubeLoad(error);
        }
      });
    } catch (error) {
      if (attempt < 1 && !error?.isPermanent) {
        debugWarn(`YouTube load failed on ${this.name}, recreating player once`, error);
        this._destroyYouTubePlayer();
        this._ensureYouTubeDiv();
        return this._loadYouTubeVideo(videoId, attempt + 1);
      }

      throw error;
    }
  }

  async createYouTubePlayer() {
    await window.NarratorJukeboxYTReady;

    if (this.youtubePlayer && this.youtubeReady && this.youtubePlayer.loadVideoById) {
      return;
    }

    if (this._pendingYouTubePlayerCreation?.promise) {
      return this._pendingYouTubePlayerCreation.promise;
    }

    if (this.youtubePlayer && !this.youtubeReady) {
      this._destroyYouTubePlayer();
    }

    // Ensure container div exists
    this._ensureYouTubeDiv();

    const token = ++this._youtubePlayerToken;

    let creationPromise;
    creationPromise = new Promise((resolve, reject) => {
        let settled = false;

        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            if (this._pendingYouTubePlayerCreation?.token === token) {
                this._clearPendingYouTubePlayerCreation();
            }
            callback(value);
        };

        // Note: Do NOT use host: 'youtube-nocookie.com' — it causes error 150
        // on HTTP pages (cross-origin postMessage fails HTTP↔HTTPS).
        // Do NOT set origin on HTTP pages — causes same postMessage mismatch.
        // `origin` is intentionally omitted here. Forcing it caused some
        // player clients to hit YouTube embed error 150 during remote sync.
        const playerConfig = {
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            autoplay: 0,
            controls: 0
        };
        const player = new YT.Player(`jukebox-yt-${this.name}`, {
            height: '200', width: '200',
            playerVars: playerConfig,
            events: {
                'onReady': () => {
                    if (token !== this._youtubePlayerToken || this.youtubePlayer !== player) {
                        try {
                            player.destroy?.();
                        } catch (error) {}
                        return;
                    }

                    this.youtubeReady = true;
                    debugLog(`YouTube player ready for ${this.name}`);
                    Hooks.call('narratorJukeboxTrackLoaded', this.name);
                    finish(resolve);
                },
                'onError': (e) => {
                    if (token !== this._youtubePlayerToken || this.youtubePlayer !== player) {
                        try {
                            player.destroy?.();
                        } catch (error) {}
                        return;
                    }

                    const failingUrl = this.currentTrack?.url || this.currentTrack?.path || null;
                    const failingVideoId = failingUrl ? this.extractYouTubeId(failingUrl) : null;
                    const error = this._createYouTubeError(e.data);
                    debugError(`YouTube error on ${this.name}: code ${e.data}`, {
                        track: this.currentTrack,
                        url: failingUrl,
                        videoId: failingVideoId,
                        reason: error.reason,
                        permanent: error.isPermanent
                    });
                    Hooks.call('narratorJukeboxPlaybackError', {
                        channel: this.name,
                        error: e,
                        classifiedError: error
                    });
                    this._rejectPendingYouTubeLoad(error);
                    finish(reject, error);
                    // Errors after player was ready are logged but don't crash
                },
                'onStateChange': (e) => {
                    if (token !== this._youtubePlayerToken || this.youtubePlayer !== player) {
                        return;
                    }

                    if (e.data === YT.PlayerState.PLAYING) {
                        this._resolvePendingYouTubeLoad();
                        this.fadeInYouTube();
                        this._scheduleYouTubeCrossfade();
                        Hooks.call('narratorJukeboxTrackLoaded', this.name);
                    }
                    if (e.data === YT.PlayerState.ENDED) {
                        // Only fire if crossfade didn't already trigger it
                        if (!this._ytCrossfadeFired) {
                            Hooks.call('narratorJukeboxTrackEnded', this.name);
                        }
                        this._ytCrossfadeFired = false;
                    }
                }
            }
        });

        this.youtubePlayer = player;
        this.youtubeReady = false;

        const timeoutId = setTimeout(() => {
            if (settled || token !== this._youtubePlayerToken || this.youtubePlayer !== player) {
                return;
            }

            debugError(`YouTube player creation timed out for ${this.name}`);
            this.youtubePlayer = null;
            this.youtubeReady = false;
            finish(reject, new Error(`YouTube player creation timed out for ${this.name}`));
        }, 15000);

        this._pendingYouTubePlayerCreation = {
            promise: null,
            reject,
            timeoutId,
            token
        };
    });

    this._pendingYouTubePlayerCreation.promise = creationPromise;

    return creationPromise;
  }

  /**
   * Equal-power fade-in for local audio using sin(progress * π/2) curve.
   * Tracked interval — killed by clearAllIntervals() if a new play starts.
   */
  fadeIn(audio) {
    const duration = this.crossfadeDuration;
    const targetVol = this._getEffectiveVolume();

    if (duration <= 0) {
      if (audio) audio.volume = targetVol;
      return;
    }

    const startTime = performance.now();

    this.startInterval((id) => {
      const progress = Math.min((performance.now() - startTime) / duration, 1.0);
      const curve = Math.sin(progress * Math.PI / 2);

      if (audio) audio.volume = Math.min(targetVol * curve, 1.0);

      if (progress >= 1.0) {
        if (audio) audio.volume = targetVol;
        this.activeIntervals.delete(id);
        clearInterval(id);
      }
    }, FADE_INTERVAL);
  }

  /**
   * Equal-power fade-in for YouTube using sin(progress * π/2) curve.
   * Tracked interval — killed by clearAllIntervals() if a new play starts.
   */
  fadeInYouTube() {
    if (!this.youtubePlayer) return;

    const duration = this.crossfadeDuration;
    const target = this._getEffectiveYouTubeVolume();

    if (duration <= 0) {
      if (this.youtubePlayer?.setVolume) this.youtubePlayer.setVolume(target);
      return;
    }

    const startTime = performance.now();

    this.startInterval((id) => {
      const progress = Math.min((performance.now() - startTime) / duration, 1.0);
      const curve = Math.sin(progress * Math.PI / 2);

      if (this.youtubePlayer?.setVolume) {
        this.youtubePlayer.setVolume(Math.round(target * curve));
      }

      if (progress >= 1.0) {
        if (this.youtubePlayer?.setVolume) this.youtubePlayer.setVolume(target);
        this.activeIntervals.delete(id);
        clearInterval(id);
      }
    }, YOUTUBE_FADE_INTERVAL);
  }

  /**
   * Equal-power fade-out for local audio using cos(progress * π/2) curve.
   * Uses DETACHED interval — survives clearAllIntervals() so the old audio
   * element fades to silence independently while the new track starts.
   */
  fadeOutLocal(audio) {
    if (!audio) return;
    this._removeAudioListeners(audio);

    const duration = this.crossfadeDuration;
    const initialVol = audio.volume;

    if (duration <= 0) {
      this._teardownLocalAudio(audio, { removeListeners: false });
      return;
    }

    const startTime = performance.now();

    this._startDetachedInterval((id) => {
      const progress = Math.min((performance.now() - startTime) / duration, 1.0);
      const curve = Math.cos(progress * Math.PI / 2);

      if (progress >= 1.0) {
        audio.volume = 0;
        this._teardownLocalAudio(audio, { removeListeners: false });
        clearInterval(id);
      } else {
        audio.volume = Math.max(initialVol * curve, 0);
      }
    }, FADE_INTERVAL);
  }

  /**
   * Equal-power fade-out for YouTube using cos(progress * π/2) curve.
   * Uses DETACHED interval — survives clearAllIntervals() for YT→Local transitions.
   */
  fadeOutYouTube() {
    if (!this.youtubePlayer) return;

    const duration = this.crossfadeDuration;
    const currentVol = this.youtubePlayer.getVolume?.() ?? this._getEffectiveYouTubeVolume();

    if (duration <= 0) {
      this.youtubePlayer.stopVideo?.();
      return;
    }

    const player = this.youtubePlayer;
    const startTime = performance.now();

    this._startDetachedInterval((id) => {
      const progress = Math.min((performance.now() - startTime) / duration, 1.0);
      const curve = Math.cos(progress * Math.PI / 2);

      if (progress >= 1.0) {
        if (player?.setVolume) player.setVolume(0);
        if (player?.stopVideo) player.stopVideo();
        clearInterval(id);
      } else {
        if (player?.setVolume) player.setVolume(Math.max(Math.round(currentVol * curve), 0));
      }
    }, YOUTUBE_FADE_INTERVAL);
  }

  stop() {
    this._playGeneration++; // Cancel any play() call that is still resolving on this channel.
    this.clearAllIntervals(); // Stop any fades
    this._clearYouTubeFadeSafetyTimeout();

    if (this.audioElement) {
        this._teardownLocalAudio(this.audioElement);
        this.audioElement = null;
    }
    if (this.youtubePlayer) {
        this._destroyYouTubePlayer();
    }
    this.currentTrack = null;
  }

  pause() {
    this.clearAllIntervals(); // Stop fades
    this._clearYouTubeFadeSafetyTimeout();
    if (this.audioElement) this.audioElement.pause();
    if (this.youtubePlayer && this.youtubePlayer.pauseVideo) this.youtubePlayer.pauseVideo();
  }

  resume() {
    this.clearAllIntervals(); // Stop fades
    if (this.audioElement) this.audioElement.play();
    if (this.youtubePlayer && this.youtubePlayer.playVideo) this.youtubePlayer.playVideo();
  }

  setVolume(val) {
    this.volume = this._clampVolume(val);
    // If a fade is happening, we don't want to snap volume, BUT
    // the user expects immediate feedback.
    // Decision: Clear fades and set volume immediately.
    this.clearAllIntervals();

    const effectiveVolume = this._getEffectiveVolume();
    const youtubeVolume = this._getEffectiveYouTubeVolume();

    if (this.audioElement) this.audioElement.volume = effectiveVolume;
    if (this.youtubePlayer && this.youtubePlayer.setVolume) this.youtubePlayer.setVolume(youtubeVolume);
  }

  get currentTime() {
    if (this.audioElement) return this.audioElement.currentTime;
    if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) return this.youtubePlayer.getCurrentTime();
    return 0;
  }

  get duration() {
    if (this.audioElement) return this.audioElement.duration;
    if (this.youtubePlayer && this.youtubePlayer.getDuration) return this.youtubePlayer.getDuration();
    return 0;
  }

  seek(percent) {
    const duration = this.duration;
    if (!duration) return;

    const targetTime = (percent / 100) * duration;

    if (this.audioElement) {
        this.audioElement.currentTime = targetTime;
    }
    if (this.youtubePlayer && this.youtubePlayer.seekTo) {
        this.youtubePlayer.seekTo(targetTime, true);
    }
  }

  /**
   * Schedule a periodic check on the YouTube player to fire trackEnded early
   * for crossfade, similar to the timeupdate approach for local audio.
   */
  _scheduleYouTubeCrossfade() {
    this._clearYouTubeCrossfade();

    const crossfadeMs = this.crossfadeDuration;
    if (crossfadeMs <= 0 || this.name === 'ambience') return;

    this._ytCrossfadeFired = false;
    this._ytCrossfadeInterval = setInterval(() => {
      try {
        if (!this.youtubePlayer?.getCurrentTime || !this.youtubePlayer?.getDuration) return;
        const duration = this.youtubePlayer.getDuration();
        const current = this.youtubePlayer.getCurrentTime();
        if (!duration || duration * 1000 <= crossfadeMs) return;

        const remaining = (duration - current) * 1000;
        if (remaining <= crossfadeMs && remaining > 0) {
          debugLog(`YT crossfade pre-trigger on ${this.name}: ${Math.round(remaining)}ms remaining`);
          this._ytCrossfadeFired = true;
          this._clearYouTubeCrossfade();
          Hooks.call('narratorJukeboxTrackEnded', this.name);
        }
      } catch (e) {
        // YT player may have been destroyed mid-check
        this._clearYouTubeCrossfade();
      }
    }, 250);
  }

  /**
   * Clear the YouTube crossfade pre-scheduling interval.
   */
  _clearYouTubeCrossfade() {
    if (this._ytCrossfadeInterval) {
      clearInterval(this._ytCrossfadeInterval);
      this._ytCrossfadeInterval = null;
    }
  }

  /**
   * Remove stored event listeners from an audio element.
   * Prevents phantom audio: old elements firing 'ended' during fade-out
   * would trigger next() and start a second track playing simultaneously.
   * @param {HTMLAudioElement} audio - The audio element to clean up
   */
  _removeAudioListeners(audio) {
    if (!audio) return;
    if (audio._jbOnEnded) {
      audio.removeEventListener('ended', audio._jbOnEnded);
      audio._jbOnEnded = null;
    }
    if (audio._jbOnCrossfade) {
      audio.removeEventListener('timeupdate', audio._jbOnCrossfade);
      audio._jbOnCrossfade = null;
    }
    if (audio._jbOnError) {
      audio.removeEventListener('error', audio._jbOnError);
      audio._jbOnError = null;
    }
    if (audio._jbOnLoaded) {
      audio.removeEventListener('canplaythrough', audio._jbOnLoaded);
      audio._jbOnLoaded = null;
    }
  }

  /**
   * Fully tear down a local audio element so browsers don't keep ghost playback alive.
   * @param {HTMLAudioElement} audio
   * @param {object} [options]
   * @param {boolean} [options.removeListeners=true]
   */
  _teardownLocalAudio(audio, { removeListeners = true } = {}) {
    if (!audio) return;

    if (removeListeners) {
      this._removeAudioListeners(audio);
    }

    try {
      audio.pause();
    } catch (error) {}

    try {
      audio.currentTime = 0;
    } catch (error) {}

    try {
      audio.removeAttribute?.('src');
      audio.src = '';
      audio.load?.();
    } catch (error) {}

    try {
      audio.remove?.();
    } catch (error) {}
  }

  /**
   * Ensure the YouTube container div exists in the DOM.
   * stop() removes the div, so it must be recreated before creating a new player.
   */
  _ensureYouTubeDiv() {
    const existingDiv = document.getElementById(`jukebox-yt-${this.name}`);
    if (existingDiv) {
      styleHiddenYouTubeContainer(existingDiv);
      return;
    }

    debugLog(`Recreating YouTube container div for ${this.name}`);
    const div = document.createElement('div');
    div.id = `jukebox-yt-${this.name}`;
    styleHiddenYouTubeContainer(div);
    document.body.appendChild(div);
  }

  _createYouTubeError(code) {
    const details = getYouTubeErrorDetails(code);
    const error = new Error(details.userMessage);
    error.code = details.code;
    error.reason = details.reason;
    error.isPermanent = details.isPermanent;
    error.originalMessage = `YouTube Error Code: ${details.code}`;
    return error;
  }

  extractYouTubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  /**
   * Normalize track data from legacy suggestions or embedded sync payloads.
   * @param {object} track
   * @returns {object|null}
   */
  _normalizeTrack(track) {
    if (!track) return null;

    const normalized = { ...track };
    normalized.url = normalized.url || normalized.path || '';
    const youtubeId = normalized.url ? this.extractYouTubeId(normalized.url) : null;

    if (youtubeId) {
      normalized.source = 'youtube';
      normalized.url = normalizeYouTubeUrl(normalized.url);
    } else if (!normalized.source) {
      normalized.source = 'local';
    }

    return normalized;
  }
}
