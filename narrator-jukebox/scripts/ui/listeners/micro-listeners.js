/**
 * Micro Mode Listeners Module
 * Handles micro player interactions: play/pause, prev/next, expand, click artwork, drag
 *
 * @module ui/listeners/micro-listeners
 */

/**
 * Activate micro mode listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateMicroListeners(app, html) {
    const jukebox = app.jukebox;

    // Initialize drag tracking first
    initMicroDrag(app);

    // ========== PLAYBACK CONTROLS ==========

    // Play/pause
    html.find('#micro-play-pause').click(e => {
        e.stopPropagation();
        jukebox.togglePlay('music');
        app.render(false);
    });

    // Prev
    html.find('#micro-prev').click(e => {
        e.stopPropagation();
        jukebox.prev();
    });

    // Next
    html.find('#micro-next').click(e => {
        e.stopPropagation();
        jukebox.next();
    });

    // ========== EXPAND CONTROLS ==========

    // Expand button -> Mini mode
    html.find('.micro-expand').click(e => {
        e.stopPropagation();
        app._exitMicroMode();
    });

    // Click on artwork -> Mini mode (but not if we were dragging)
    html.find('.micro-artwork').click(e => {
        // Ignore click if we just finished dragging
        if (app._microIsDragging) return;
        app._exitMicroMode();
    });

    // Double-click on artwork -> Normal mode
    html.find('.micro-artwork').dblclick(e => {
        if (app._microIsDragging) return;
        e.preventDefault();
        e.stopPropagation();
        app._exitMicroToNormal();
    });
}

/**
 * Initialize micro mode drag functionality
 * @param {NarratorsJukeboxApp} app - The application instance
 */
function initMicroDrag(app) {
    // This sets up the drag tracking variables
    // The actual drag implementation is handled in the app class
    // because it needs access to the window element position
    if (app._initMicroDrag) {
        app._initMicroDrag();
    }
}

export { initMicroDrag };
