/**
 * Narrator's Jukebox - Audio Channel
 * Handles audio playback for music, ambience, and soundboard channels
 */

import { FADE_STEP, FADE_INTERVAL, YOUTUBE_VOLUME_STEP, YOUTUBE_FADE_INTERVAL } from './constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';

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
    this.crossfadeDuration = 2000; // 2 seconds

    // Robust Interval Management
    this.activeIntervals = new Set();

    // Play generation counter: prevents concurrent play() calls from creating phantom audio
    this._playGeneration = 0;
  }

  async initialize() {
    if (!document.getElementById(`jukebox-yt-${this.name}`)) {
      const div = document.createElement('div');
      div.id = `jukebox-yt-${this.name}`;
      div.style.display = 'none';
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

  async play(track, startCallback = null) {
    debugLog(`AudioChannel.play() called for ${this.name}`, track);

    // Increment play generation to invalidate any concurrent in-flight play() calls
    const generation = ++this._playGeneration;

    // 1. Atomic Reset: Stop all pending fades/actions
    this.clearAllIntervals();

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
                newAudio.pause();
                this._removeAudioListeners(newAudio);
                if (newAudio.remove) newAudio.remove();
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

    if (!this.youtubePlayer) {
        await this.createYouTubePlayer();
    }

    if (this.youtubePlayer && this.youtubePlayer.loadVideoById) {
        // If we are reusing the player, we can't "fade in" from 0 easily if it was already playing.
        // But to be safe and smooth, we set volume to 0 then fade in.
        this.youtubePlayer.setVolume(0);
        this.youtubePlayer.loadVideoById(videoId);

        // Explicitly call playVideo to ensure playback starts
        // This is needed because autoplay:0 in playerVars
        if (this.youtubePlayer.playVideo) {
          this.youtubePlayer.playVideo();
        }
        // Fade in is triggered by onStateChange -> PLAYING
    }
  }

  async createYouTubePlayer() {
    await window.NarratorJukeboxYTReady;
    return new Promise((resolve, reject) => {
        this.youtubePlayer = new YT.Player(`jukebox-yt-${this.name}`, {
            height: '1', width: '1',
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
                origin: window.location.origin,
                enablejsapi: 1,
                modestbranding: 1,
                rel: 0,
                autoplay: 0,
                controls: 0
            },
            events: {
                'onReady': () => {
                    this.youtubeReady = true;
                    Hooks.call('narratorJukeboxTrackLoaded', this.name);
                    resolve();
                },
                'onError': (e) => {
                    Hooks.call('narratorJukeboxPlaybackError', { channel: this.name, error: e });
                    reject(new Error(`YouTube Error Code: ${e.data}`));
                },
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        this.fadeInYouTube();
                        Hooks.call('narratorJukeboxTrackLoaded', this.name);
                    }
                    if (e.data === YT.PlayerState.ENDED) {
                        Hooks.call('narratorJukeboxTrackEnded', this.name);
                    }
                }
            }
        });
    });
  }

  fadeIn(audio) {
    const step = FADE_STEP;
    const targetVol = this.volume;
    let vol = 0;

    this.startInterval((id) => {
      vol += step;
      if (vol >= targetVol) {
        vol = targetVol;
        this.activeIntervals.delete(id);
        clearInterval(id);
      }
      if (audio) audio.volume = vol;
    }, FADE_INTERVAL);
  }

  fadeInYouTube() {
    if (!this.youtubePlayer) return;
    let vol = 0;
    const target = this.volume * 100;

    this.startInterval((id) => {
        vol += YOUTUBE_VOLUME_STEP;
        if (vol >= target) {
            vol = target;
            this.activeIntervals.delete(id);
            clearInterval(id);
        }
        if (this.youtubePlayer && this.youtubePlayer.setVolume) {
            this.youtubePlayer.setVolume(vol);
        }
    }, YOUTUBE_FADE_INTERVAL);
  }

  fadeOutLocal(audio) {
    if (!audio) return;
    this._removeAudioListeners(audio); // Safety: ensure no phantom triggers during fade
    let vol = audio.volume;

    // Track this interval to prevent memory leaks
    const fadeId = this.startInterval(() => {
      vol -= FADE_STEP;
      if (vol <= 0) {
        vol = 0;
        audio.pause();
        if (audio.remove) audio.remove();
        this.activeIntervals.delete(fadeId);
        clearInterval(fadeId);
      } else {
        audio.volume = vol;
      }
    }, FADE_INTERVAL);
  }

  fadeOutYouTube() {
    if (!this.youtubePlayer) return;
    const currentVol = this.youtubePlayer.getVolume ? this.youtubePlayer.getVolume() : this.volume * 100;
    let vol = currentVol;

    this.startInterval((id) => {
        vol -= YOUTUBE_VOLUME_STEP;
        if (vol <= 0) {
            vol = 0;
            if (this.youtubePlayer && this.youtubePlayer.stopVideo) {
                this.youtubePlayer.stopVideo();
            }
            this.activeIntervals.delete(id);
            clearInterval(id);
        } else {
            if (this.youtubePlayer && this.youtubePlayer.setVolume) {
                this.youtubePlayer.setVolume(vol);
            }
        }
    }, FADE_INTERVAL);
  }

  stop() {
    this.clearAllIntervals(); // Stop any fades

    if (this.audioElement) {
        this._removeAudioListeners(this.audioElement); // Prevent phantom triggers
        this.audioElement.pause();
        this.audioElement = null;
    }
    if (this.youtubePlayer) {
        // Stop the video first
        if (this.youtubePlayer.stopVideo) {
            this.youtubePlayer.stopVideo();
        }
        // Destroy the player to allow reuse of the div
        if (this.youtubePlayer.destroy) {
            this.youtubePlayer.destroy();
        }
        this.youtubePlayer = null;
        this.youtubeReady = false;

        // Remove the div from DOM so a fresh one can be created
        const div = document.getElementById(`jukebox-yt-${this.name}`);
        if (div) {
            div.remove();
        }
    }
    this.currentTrack = null;
  }

  pause() {
    this.clearAllIntervals(); // Stop fades
    if (this.audioElement) this.audioElement.pause();
    if (this.youtubePlayer && this.youtubePlayer.pauseVideo) this.youtubePlayer.pauseVideo();
  }

  resume() {
    this.clearAllIntervals(); // Stop fades
    if (this.audioElement) this.audioElement.play();
    if (this.youtubePlayer && this.youtubePlayer.playVideo) this.youtubePlayer.playVideo();
  }

  setVolume(val) {
    this.volume = val;
    // If a fade is happening, we don't want to snap volume, BUT
    // the user expects immediate feedback.
    // Decision: Clear fades and set volume immediately.
    this.clearAllIntervals();

    if (this.audioElement) this.audioElement.volume = val;
    if (this.youtubePlayer && this.youtubePlayer.setVolume) this.youtubePlayer.setVolume(val * 100);
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
    if (audio._jbOnError) {
      audio.removeEventListener('error', audio._jbOnError);
      audio._jbOnError = null;
    }
    if (audio._jbOnLoaded) {
      audio.removeEventListener('canplaythrough', audio._jbOnLoaded);
      audio._jbOnLoaded = null;
    }
  }

  extractYouTubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }
}
