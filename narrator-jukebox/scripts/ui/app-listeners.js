/**
 * App Listeners Coordinator
 * Central coordinator that routes to appropriate listener modules based on window mode
 *
 * @module ui/app-listeners
 */

import { activateMainListeners } from './listeners/main-listeners.js';
import { activatePlayerListeners } from './listeners/player-listeners.js';
import { activatePlaylistListeners } from './listeners/playlist-listeners.js';
import { activateSoundboardListeners } from './listeners/soundboard-listeners.js';
import { activateAmbienceListeners } from './listeners/ambience-listeners.js';
import { activateSelectionListeners } from './listeners/selection-listeners.js';
import { activateMiniListeners } from './listeners/mini-listeners.js';
import { activateMicroListeners } from './listeners/micro-listeners.js';

/**
 * Activate all listeners based on current window mode
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateListeners(app, html) {
    // Route to appropriate listeners based on window mode
    switch (app._windowState) {
        case 'mini':
            activateMiniListeners(app, html);
            return;
        case 'micro':
            activateMicroListeners(app, html);
            return;
        default:
            // Continue with normal mode listeners
            activateNormalModeListeners(app, html);
            break;
    }
}

/**
 * Activate all normal mode listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
function activateNormalModeListeners(app, html) {
    // Main navigation and UI listeners
    activateMainListeners(app, html);

    // Player control listeners
    activatePlayerListeners(app, html);

    // Playlist-specific listeners
    activatePlaylistListeners(app, html);

    // Soundboard-specific listeners
    activateSoundboardListeners(app, html);

    // Ambience layer mixer listeners
    activateAmbienceListeners(app, html);

    // Multi-selection listeners
    activateSelectionListeners(app, html);

    // Start progress timers
    app._startProgressTimer();
    app._startAmbienceProgressTimer();

    // Load track durations asynchronously
    app._loadTrackDurations(html);
}

// Re-export individual modules for direct use if needed
export {
    activateMainListeners,
    activatePlayerListeners,
    activatePlaylistListeners,
    activateSoundboardListeners,
    activateAmbienceListeners,
    activateSelectionListeners,
    activateMiniListeners,
    activateMicroListeners
};
