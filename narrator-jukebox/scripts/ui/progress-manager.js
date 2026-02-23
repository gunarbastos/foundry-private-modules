/**
 * Progress Manager Module
 * Handles RAF-based progress bar updates for music and ambience channels
 *
 * @module ui/progress-manager
 */

import { formatTime } from '../utils/time-format.js';

// Update interval in milliseconds (throttle updates)
const UPDATE_INTERVAL = 500;

/**
 * Start the music progress timer using requestAnimationFrame
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function startMusicProgress(app) {
    if (app._progressRAF) return;

    if (!app.element || !app.element.length) return;

    let lastUpdate = 0;

    const updateProgress = (timestamp) => {
        // Check if app is still open
        if (!app.element || !app.element.length) {
            stopMusicProgress(app);
            return;
        }

        // Throttle updates
        if (timestamp - lastUpdate >= UPDATE_INTERVAL) {
            lastUpdate = timestamp;

            // Query DOM elements fresh each time (they may be recreated by render)
            const html = app.element;
            const progressFill = html.find('#progress-fill')[0];
            const progressBar = html.find('#progress-bar')[0];
            const currentTimeEl = html.find('#current-time')[0];
            const totalTimeEl = html.find('#total-time')[0];

            const channel = app.jukebox.channels.music;
            const current = channel.currentTime;
            const total = channel.duration;

            // Update progress bar
            if (total && total > 0) {
                const percent = (current / total) * 100;

                // Only update slider position if user is NOT dragging
                if (!app.isDragging) {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressBar) progressBar.value = percent;
                    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
                }

                if (totalTimeEl) totalTimeEl.textContent = formatTime(total);
            }
        }

        // Continue the animation loop
        app._progressRAFId = requestAnimationFrame(updateProgress);
    };

    // Start the animation loop
    app._progressRAF = true;
    app._progressRAFId = requestAnimationFrame(updateProgress);
}

/**
 * Stop the music progress timer
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function stopMusicProgress(app) {
    if (app._progressRAFId) {
        cancelAnimationFrame(app._progressRAFId);
        app._progressRAFId = null;
    }
    app._progressRAF = false;
}

/**
 * Start the ambience progress timer using requestAnimationFrame
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function startAmbienceProgress(app) {
    if (app._ambienceProgressRAF) return;

    if (!app.element || !app.element.length) return;

    let lastUpdate = 0;

    const updateAmbienceProgress = (timestamp) => {
        // Check if app is still open
        if (!app.element || !app.element.length) {
            stopAmbienceProgress(app);
            return;
        }

        // Throttle updates
        if (timestamp - lastUpdate >= UPDATE_INTERVAL) {
            lastUpdate = timestamp;

            // Query DOM elements fresh each time (they may be recreated by render)
            const html = app.element;
            const progressFill = html.find('#ambience-progress-fill')[0];
            const progressBar = html.find('#ambience-progress-bar')[0];
            const currentTimeEl = html.find('#ambience-current-time')[0];
            const totalTimeEl = html.find('#ambience-total-time')[0];

            const channel = app.jukebox.channels.ambience;
            const current = channel.currentTime;
            const total = channel.duration;

            if (total && total > 0 && isFinite(total)) {
                const percent = (current / total) * 100;

                // Only update slider position if user is NOT dragging
                if (!app.isAmbienceDragging) {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressBar) progressBar.value = percent;
                    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
                }

                if (totalTimeEl) totalTimeEl.textContent = formatTime(total);
            } else {
                // For looping/infinite ambience
                if (currentTimeEl) currentTimeEl.textContent = formatTime(current || 0);
                if (totalTimeEl) totalTimeEl.textContent = '∞';
            }
        }

        // Continue the animation loop
        app._ambienceProgressRAFId = requestAnimationFrame(updateAmbienceProgress);
    };

    // Start the animation loop
    app._ambienceProgressRAF = true;
    app._ambienceProgressRAFId = requestAnimationFrame(updateAmbienceProgress);
}

/**
 * Stop the ambience progress timer
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function stopAmbienceProgress(app) {
    if (app._ambienceProgressRAFId) {
        cancelAnimationFrame(app._ambienceProgressRAFId);
        app._ambienceProgressRAFId = null;
    }
    app._ambienceProgressRAF = false;
}

/**
 * Stop all progress timers (cleanup)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function stopAllProgress(app) {
    stopMusicProgress(app);
    stopAmbienceProgress(app);
}

/**
 * Update progress bar element directly
 * @param {HTMLElement} element - Progress bar element
 * @param {number} percent - Progress percentage (0-100)
 */
export function updateProgressBar(element, percent) {
    if (!element) return;
    element.style.width = `${percent}%`;
}

/**
 * Update time display element
 * @param {HTMLElement} element - Time display element
 * @param {number} seconds - Time in seconds
 */
export function updateTimeDisplay(element, seconds) {
    if (!element) return;
    element.textContent = formatTime(seconds);
}
