/**
 * Mode Manager Module
 * Handles window mode transitions: Normal, Mini, Micro
 *
 * @module ui/mode-manager
 */

import { debugLog, debugWarn } from '../utils/debug.js';

// Mode constants
export const WINDOW_MODES = {
    NORMAL: 'normal',
    MINI: 'mini',
    MICRO: 'micro'
};

// Default dimensions for each mode
export const MODE_DIMENSIONS = {
    normal: { width: 1100, height: 900 },
    mini: { width: 400, height: 500 },
    micro: { width: 60, height: 60 }
};

// LocalStorage key for micro position
const MICRO_POSITION_KEY = 'narrator-jukebox-micro-position';

/**
 * Get the current window mode
 * @param {NarratorsJukeboxApp} app - The application instance
 * @returns {string} Current mode ('normal', 'mini', or 'micro')
 */
export function getCurrentMode(app) {
    return app._windowState || WINDOW_MODES.NORMAL;
}

/**
 * Enter Mini Mode (from Normal or Micro)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function enterMiniMode(app) {
    if (app._windowState === WINDOW_MODES.MINI) return;

    debugLog('Entering Mini Mode');

    // Sync broadcast modes - mini player uses unified toggle
    app.jukebox.soundboardBroadcastMode = !app.jukebox.isPreviewMode;

    // Save current position if coming from normal
    if (app._windowState === WINDOW_MODES.NORMAL) {
        app._preNormalPosition = { ...app.position };
    }

    // Exit fullscreen if active
    if (app._isFullscreen) {
        app._isFullscreen = false;
        app.element.removeClass('jb-fullscreen-mode');
    }

    app._windowState = WINDOW_MODES.MINI;
    app.element.removeClass('jb-minimized jb-fullscreen-mode jb-micro-mode');
    app.element.addClass('jb-mini-mode');

    // Set mini mode dimensions
    app.setPosition(MODE_DIMENSIONS.mini);

    // Re-render with mini template
    app.render(true);
}

/**
 * Exit Mini Mode (Mini -> Normal)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function exitMiniMode(app) {
    if (app._windowState !== WINDOW_MODES.MINI) return;

    debugLog('Exiting Mini Mode');

    app._windowState = WINDOW_MODES.NORMAL;
    app.element.removeClass('jb-mini-mode');

    // Restore position
    if (app._preNormalPosition) {
        app.setPosition(app._preNormalPosition);
    } else {
        app.setPosition(MODE_DIMENSIONS.normal);
    }

    // Re-render with normal template
    app.render(true);
}

/**
 * Enter Micro Mode (from Mini or Normal)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function enterMicroMode(app) {
    if (app._windowState === WINDOW_MODES.MICRO) return;

    debugLog('Entering Micro Mode');

    // Save position based on current state
    if (app._windowState === WINDOW_MODES.MINI) {
        app._preMiniPosition = { ...app.position };
    } else if (app._windowState === WINDOW_MODES.NORMAL) {
        app._preNormalPosition = { ...app.position };
    }

    app._windowState = WINDOW_MODES.MICRO;
    app.element.removeClass('jb-mini-mode jb-fullscreen-mode jb-minimized');
    app.element.addClass('jb-micro-mode');

    // Load saved micro position or use default
    const savedPosition = loadMicroPosition(app);
    app.setPosition({
        width: MODE_DIMENSIONS.micro.width,
        height: MODE_DIMENSIONS.micro.height,
        left: savedPosition?.left ?? (window.innerWidth - 80),
        top: savedPosition?.top ?? 100
    });

    // Re-render with micro template
    app.render(true);

    // Initialize drag tracking after render
    setTimeout(() => initMicroDrag(app), 100);
}

/**
 * Exit Micro Mode (Micro -> Mini)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function exitMicroMode(app) {
    if (app._windowState !== WINDOW_MODES.MICRO) return;

    debugLog('Exiting Micro Mode');

    // Cleanup micro drag event listeners
    cleanupMicroDrag(app);

    // Save micro position
    saveMicroPosition(app);

    app._windowState = WINDOW_MODES.MINI;
    app.element.removeClass('jb-micro-mode');
    app.element.addClass('jb-mini-mode');

    // Restore mini position
    if (app._preMiniPosition) {
        app.setPosition(app._preMiniPosition);
    } else {
        app.setPosition(MODE_DIMENSIONS.mini);
    }

    app.render(true);
}

/**
 * Exit Micro Mode directly to Normal (Micro -> Normal)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function exitMicroToNormal(app) {
    if (app._windowState !== WINDOW_MODES.MICRO) return;

    debugLog('Exiting Micro Mode to Normal');

    // Cleanup micro drag event listeners
    cleanupMicroDrag(app);

    // Save micro position
    saveMicroPosition(app);

    app._windowState = WINDOW_MODES.NORMAL;
    app.element.removeClass('jb-micro-mode');

    // Restore normal position
    if (app._preNormalPosition) {
        app.setPosition(app._preNormalPosition);
    } else {
        app.setPosition(MODE_DIMENSIONS.normal);
    }

    app.render(true);
}

/**
 * Save micro position to localStorage
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function saveMicroPosition(app) {
    const position = {
        left: app.position.left,
        top: app.position.top
    };
    localStorage.setItem(MICRO_POSITION_KEY, JSON.stringify(position));
    app._microPosition = position;
}

/**
 * Load micro position from localStorage
 * @param {NarratorsJukeboxApp} app - The application instance
 * @returns {Object|null} Position object or null
 */
export function loadMicroPosition(app) {
    if (app._microPosition) return app._microPosition;

    const saved = localStorage.getItem(MICRO_POSITION_KEY);
    if (saved) {
        try {
            app._microPosition = JSON.parse(saved);
            return app._microPosition;
        } catch (e) {
            debugWarn('Failed to parse micro position', e);
        }
    }
    return null;
}

/**
 * Cleanup micro mode drag event listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function cleanupMicroDrag(app) {
    if (!app.element) return;

    const container = app.element.find('.narrator-jukebox-micro');
    if (container.length) {
        container.off('mousedown.microDrag');
    }

    $(document).off('mousemove.microDrag');
    $(document).off('mouseup.microDrag');
}

/**
 * Initialize micro mode drag functionality
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function initMicroDrag(app) {
    if (!app.element) return;

    const windowEl = app.element[0];
    const container = app.element.find('.narrator-jukebox-micro');
    if (!container.length) return;

    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startLeft, startTop;

    // Store reference to check if we're dragging (used by click handlers)
    app._microIsDragging = false;

    container.on('mousedown.microDrag', e => {
        // Don't start drag from buttons
        if ($(e.target).closest('button, .micro-controls, .micro-expand').length) return;

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = app.position.left;
        startTop = app.position.top;

        windowEl.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    });

    $(document).on('mousemove.microDrag', e => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Only count as "moved" if we actually moved more than 5px
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
            app._microIsDragging = true;
        }

        // Calculate new position with bounds checking
        const newLeft = Math.max(0, Math.min(window.innerWidth - 60, startLeft + dx));
        const newTop = Math.max(0, Math.min(window.innerHeight - 60, startTop + dy));

        app.setPosition({
            left: newLeft,
            top: newTop
        });
    });

    $(document).on('mouseup.microDrag', e => {
        if (!isDragging) return;

        isDragging = false;
        windowEl.style.cursor = '';

        if (hasMoved) {
            // Save position after drag
            saveMicroPosition(app);

            // Reset dragging flag after a short delay (allows click handler to check)
            setTimeout(() => {
                app._microIsDragging = false;
            }, 100);
        } else {
            app._microIsDragging = false;
        }
    });
}

/**
 * Handle mode transition with animation
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {string} fromMode - Source mode
 * @param {string} toMode - Target mode
 */
export function handleModeTransition(app, fromMode, toMode) {
    switch (toMode) {
        case WINDOW_MODES.NORMAL:
            if (fromMode === WINDOW_MODES.MINI) {
                exitMiniMode(app);
            } else if (fromMode === WINDOW_MODES.MICRO) {
                exitMicroToNormal(app);
            }
            break;
        case WINDOW_MODES.MINI:
            if (fromMode === WINDOW_MODES.NORMAL) {
                enterMiniMode(app);
            } else if (fromMode === WINDOW_MODES.MICRO) {
                exitMicroMode(app);
            }
            break;
        case WINDOW_MODES.MICRO:
            enterMicroMode(app);
            break;
    }
}
