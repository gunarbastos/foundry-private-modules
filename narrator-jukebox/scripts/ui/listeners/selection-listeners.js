/**
 * Selection Listeners
 * Handles multi-selection functionality for tracks in the library
 *
 * @module ui/listeners/selection-listeners
 */

import { localize } from '../../utils/i18n.js';

/**
 * Activate selection listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateSelectionListeners(app, html) {
    const jukebox = app.jukebox;

    // Only GMs can use selection mode
    if (!game.user.isGM) return;

    // Toggle selection mode button
    html.on('click', '.selection-mode-btn', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.toggleSelectionMode();
    });

    // Individual track checkbox
    html.on('click', '.track-select-checkbox', (e) => {
        e.stopPropagation(); // Don't trigger play
        const row = $(e.currentTarget).closest('.track-row');
        const id = row.data('musicId');
        if (id) {
            app.toggleTrackSelection(id);
        }
    });

    // Select all checkbox
    html.on('click', '.select-all-checkbox', (e) => {
        e.stopPropagation();
        const checked = e.currentTarget.checked;
        const visibleIds = getVisibleTrackIds(html);

        if (checked) {
            app.selectAllVisible(visibleIds);
        } else {
            app.deselectAll();
        }
    });

    // Ctrl+Click on track row to toggle selection
    html.on('click', '.track-row[data-music-id]', (e) => {
        // Only in library view
        if (app.view !== 'library') return;

        const id = $(e.currentTarget).data('musicId');
        if (!id) return;

        // Ctrl+Click: Toggle selection
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            if (!app.selectionMode) {
                app.selectTrack(id);
            } else {
                app.toggleTrackSelection(id);
            }
            return;
        }

        // Shift+Click: Select range
        if (e.shiftKey && app.selectionMode) {
            e.preventDefault();
            e.stopPropagation();

            const visibleIds = getVisibleTrackIds(html);
            app.selectRange(id, visibleIds);
            return;
        }
    });

    // Clear selection button in toolbar
    html.on('click', '.btn-clear-selection', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.deselectAll();
    });

    // Add to playlist button in toolbar
    html.on('click', '.selection-toolbar .btn-add-to-playlist', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        app.showAddSelectedToPlaylistDialog(selectedIds);
    });

    // Add All Visible button (when filter is active)
    html.on('click', '.btn-add-all-visible', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const visibleIds = getVisibleTrackIds(html);
        if (visibleIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksToAdd'));
            return;
        }

        app.showAddSelectedToPlaylistDialog(visibleIds);
    });

    // Keyboard shortcuts (when library view is active)
    html.on('keydown', (e) => {
        // Only in library view
        if (app.view !== 'library') return;

        // Don't interfere with input fields
        if ($(e.target).is('input, textarea, select')) return;

        // Escape: Exit selection mode
        if (e.key === 'Escape' && app.selectionMode) {
            e.preventDefault();
            app.exitSelectionMode();
            return;
        }

        // Ctrl+A: Select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            if (app.selectionMode) {
                e.preventDefault();
                const visibleIds = getVisibleTrackIds(html);
                app.selectAllVisible(visibleIds);
            }
        }
    });
}

/**
 * Get all visible track IDs in order
 * @param {jQuery} html - The HTML element
 * @returns {string[]} Array of track IDs
 */
function getVisibleTrackIds(html) {
    const ids = [];
    html.find('#view-library .track-row[data-music-id]').each((_, el) => {
        const id = $(el).data('musicId');
        if (id) ids.push(id);
    });
    return ids;
}
