/**
 * Main Listeners Module
 * Handles navigation, search, tag filter, mode toggle, mood cards, load more, and suggestions
 *
 * @module ui/listeners/main-listeners
 */

import { debounce } from '../../utils/debounce.js';
import { localize } from '../../utils/i18n.js';

/**
 * Activate main navigation and UI listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateMainListeners(app, html) {
    const jukebox = app.jukebox;

    // Cache frequently accessed elements
    const viewSections = html.find('.view-section');
    const navItems = html.find('.nav-item');

    // ========== NAVIGATION ==========
    navItems.click(e => {
        const view = e.currentTarget.dataset.view;
        app.view = view;
        viewSections.addClass('hidden');
        html.find(`#view-${view}`).removeClass('hidden');
        navItems.removeClass('active');
        $(e.currentTarget).addClass('active');
    });

    // ========== LOAD MORE PAGINATION ==========
    html.find('.load-more-btn').click(e => {
        const type = e.currentTarget.dataset.type;
        if (type === 'music') {
            app._musicDisplayLimit += 50;
        } else if (type === 'ambience') {
            app._ambienceDisplayLimit += 50;
        }
        app.render(false);
    });

    // ========== MOOD CARDS ==========
    html.find('.mood-card').click(async e => {
        const tag = e.currentTarget.dataset.tag;
        await jukebox.playRandomByTag(tag);
        // Partial update instead of full render
        app._updateNowPlaying(jukebox.channels.music.currentTrack);
        app._updatePlaybackState();
    });

    html.find('.edit-moods-btn').click(() => app.showEditMoodsDialog());

    // ========== SUGGESTIONS ==========
    html.find('.approve-suggestion').click(async e => {
        const index = e.currentTarget.dataset.index;
        await app.approveSuggestion(index);
    });

    html.find('.reject-suggestion').click(async e => {
        const index = e.currentTarget.dataset.index;
        await app.rejectSuggestion(index);
    });

    // ========== SEARCH ==========
    activateSearchListeners(app, html);

    // ========== TAG FILTER ==========
    html.find('.tag-filter').on('change', e => {
        app.tagFilter = e.target.value;
        // Reset pagination when filter changes
        app._musicDisplayLimit = 50;
        app.render();
    });

    // ========== MODE TOGGLE ==========
    activateModeToggleListeners(app, html, jukebox);

    // ========== ADD BUTTONS ==========
    html.find('.add-music-btn').not('.bulk-import-btn').click(() => app.showAddMusicDialog());
    html.find('.add-playlist-btn').click(() => app.showAddPlaylistDialog());
    html.find('.add-ambience-btn').click(() => app.showAddAmbienceDialog());
    html.find('.add-soundboard-btn').click(() => app.showAddSoundboardDialog());

    // ========== BULK IMPORT ==========
    html.find('.bulk-import-btn').click(e => {
        const type = $(e.currentTarget).data('type');
        app.showBulkImportDialog(type);
    });
}

/**
 * Activate search input listeners with debounce
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
function activateSearchListeners(app, html) {
    const searchInput = html.find('.search-input');
    const searchClear = html.find('.search-clear');
    const searchBar = html.find('.search-bar');

    // Debounced render for search
    const debouncedRender = debounce(() => app.render(false), 300);

    searchInput.on('input', e => {
        app.searchQuery = e.target.value;

        // Reset pagination when search changes (for the current view)
        app._musicDisplayLimit = 50;
        app._ambienceDisplayLimit = 50;

        // Update clear button visibility immediately
        if (app.searchQuery) {
            searchClear.removeClass('hidden');
            searchBar.addClass('has-query');
        } else {
            searchClear.addClass('hidden');
            searchBar.removeClass('has-query');
        }

        // Debounced filter update
        debouncedRender();
    });

    // Clear search button
    searchClear.on('click', () => {
        app.searchQuery = '';
        searchInput.val('');
        searchClear.addClass('hidden');
        searchBar.removeClass('has-query');
        searchInput.focus();
        app.render();
    });

    // ESC key to clear search
    searchInput.on('keydown', e => {
        if (e.key === 'Escape') {
            if (app.searchQuery) {
                app.searchQuery = '';
                searchInput.val('');
                searchClear.addClass('hidden');
                searchBar.removeClass('has-query');
                app.render();
            }
        }
    });
}

/**
 * Activate mode toggle (Preview/Broadcast) listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 */
function activateModeToggleListeners(app, html, jukebox) {
    // Toggle switch click
    html.find('.toggle-switch').click(e => {
        jukebox.isPreviewMode = !jukebox.isPreviewMode;
        // Sync soundboard broadcast mode for consistency
        jukebox.soundboardBroadcastMode = !jukebox.isPreviewMode;

        // Update toggle with animation
        app._updateModeToggle();

        // Show notification
        const modeText = jukebox.isPreviewMode ? localize('Mode.PreviewMode') : localize('Mode.BroadcastMode');
        const modeDesc = jukebox.isPreviewMode
            ? localize('Mode.PreviewDescription')
            : localize('Mode.BroadcastDescription');
        ui.notifications.info(`${modeText}: ${modeDesc}`);
    });

    // Clicking on labels to toggle
    html.find('.mode-label').click(e => {
        const isPreviewLabel = $(e.currentTarget).hasClass('preview-label');
        const isBroadcastLabel = $(e.currentTarget).hasClass('broadcast-label');

        // Only toggle if clicking the inactive label
        if ((isPreviewLabel && !jukebox.isPreviewMode) ||
            (isBroadcastLabel && jukebox.isPreviewMode)) {
            jukebox.isPreviewMode = isPreviewLabel;
            jukebox.soundboardBroadcastMode = !isPreviewLabel;
            app._updateModeToggle();

            const modeText = isPreviewLabel ? localize('Mode.PreviewMode') : localize('Mode.BroadcastMode');
            const modeDesc = isPreviewLabel
                ? localize('Mode.PreviewDescription')
                : localize('Mode.BroadcastDescription');
            ui.notifications.info(`${modeText}: ${modeDesc}`);
        }
    });
}
