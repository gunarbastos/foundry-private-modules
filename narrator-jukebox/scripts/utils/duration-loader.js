/**
 * Duration Loader Module
 * Handles loading audio durations for tracks (local and YouTube)
 *
 * @module utils/duration-loader
 */

import { formatTime } from './time-format.js';
import { extractYouTubeVideoId } from './youtube-utils.js';
import { debugWarn } from './debug.js';

// Cache for YouTube durations (keyed by video ID)
const youtubeDurationCache = new Map();

// Cache for local audio durations (keyed by URL)
const localDurationCache = new Map();

/**
 * Load duration for a local audio file
 * @param {string} url - URL of the audio file
 * @returns {Promise<number>} Duration in seconds
 */
export function loadLocalDuration(url) {
    // Check cache first
    if (localDurationCache.has(url)) {
        return Promise.resolve(localDurationCache.get(url));
    }

    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            audio.src = ''; // Cleanup
            localDurationCache.set(url, duration);
            resolve(duration);
        };

        audio.onerror = (e) => {
            reject(new Error('Could not load audio'));
        };

        // Set crossOrigin for CORS if needed
        audio.crossOrigin = 'anonymous';
        audio.src = url;
    });
}

/**
 * Load duration for a YouTube video
 * @param {string} url - YouTube URL
 * @returns {Promise<number>} Duration in seconds
 */
export function loadYouTubeDuration(url) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return Promise.resolve(null);

    // Check cache first
    if (youtubeDurationCache.has(videoId)) {
        return Promise.resolve(youtubeDurationCache.get(videoId));
    }

    return new Promise((resolve, reject) => {
        // Create a temporary hidden container
        const containerId = `yt-duration-${videoId}-${Date.now()}`;
        const container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;top:-9999px;';
        document.body.appendChild(container);

        // Check if YouTube API is available
        if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
            container.remove();
            reject(new Error('YouTube API not available'));
            return;
        }

        // Create player just to get duration
        const player = new YT.Player(containerId, {
            videoId: videoId,
            width: 1,
            height: 1,
            playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1
            },
            events: {
                onReady: (event) => {
                    const duration = event.target.getDuration();
                    youtubeDurationCache.set(videoId, duration);
                    // Cleanup
                    event.target.destroy();
                    container.remove();
                    resolve(duration);
                },
                onError: () => {
                    container.remove();
                    reject(new Error('Could not load YouTube video'));
                }
            }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (container.parentNode) {
                container.remove();
                reject(new Error('YouTube duration timeout'));
            }
        }, 10000);
    });
}

/**
 * Load durations for multiple tracks
 * @param {Array} tracks - Array of track objects
 * @returns {Promise<Map>} Map of track IDs to durations
 */
export async function loadTrackDurations(tracks) {
    const results = new Map();

    const promises = tracks.map(async (track) => {
        try {
            let duration;
            if (track.source === 'youtube') {
                duration = await loadYouTubeDuration(track.url);
            } else {
                duration = await loadLocalDuration(track.url);
            }
            if (duration) {
                results.set(track.id, duration);
                track.cachedDuration = duration;
            }
        } catch (e) {
            // Silently fail for individual tracks
            debugWarn(`Could not load duration for ${track.name}:`, e);
        }
    });

    await Promise.allSettled(promises);
    return results;
}

/**
 * Load track durations and update DOM elements
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export async function loadAndDisplayDurations(app, html) {
    const durationCells = html.find('.col-duration[data-music-id], .col-duration[data-ambience-id]');

    for (const cell of durationCells) {
        const $cell = $(cell);
        const musicId = $cell.attr('data-music-id');
        const ambienceId = $cell.attr('data-ambience-id');

        if (musicId) {
            const track = app.jukebox.music.find(m => m.id === musicId);
            if (track) {
                await loadAndDisplayTrackDuration($cell, track);
            }
        } else if (ambienceId) {
            const track = app.jukebox.ambience.find(a => a.id === ambienceId);
            if (track) {
                await loadAndDisplayTrackDuration($cell, track);
            }
        }
    }
}

/**
 * Load and display duration for a single track
 * @param {jQuery} $cell - The DOM cell element
 * @param {Object} track - The track object
 */
async function loadAndDisplayTrackDuration($cell, track) {
    // Check if we already have duration cached
    if (track.cachedDuration) {
        $cell.text(formatTime(track.cachedDuration));
        return;
    }

    try {
        let duration;
        if (track.source === 'youtube') {
            duration = await loadYouTubeDuration(track.url);
        } else {
            duration = await loadLocalDuration(track.url);
        }

        if (duration) {
            track.cachedDuration = duration;
            $cell.text(formatTime(duration));
        }
    } catch (e) {
        $cell.text('--:--');
    }
}

/**
 * Clear duration caches
 */
export function clearDurationCache() {
    youtubeDurationCache.clear();
    localDurationCache.clear();
}

/**
 * Get cached duration for a track
 * @param {Object} track - The track object
 * @returns {number|null} Duration in seconds or null
 */
export function getCachedDuration(track) {
    if (track.cachedDuration) return track.cachedDuration;

    if (track.source === 'youtube') {
        const videoId = extractYouTubeVideoId(track.url);
        return videoId ? youtubeDurationCache.get(videoId) : null;
    } else {
        return localDurationCache.get(track.url) || null;
    }
}
