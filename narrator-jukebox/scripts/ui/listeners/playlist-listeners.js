/**
 * Playlist Listeners Module
 * Handles playlist browser interactions: selection, play, shuffle, delete, context menu
 *
 * @module ui/listeners/playlist-listeners
 */

import { localize, format } from '../../utils/i18n.js';

/**
 * Activate playlist-related listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activatePlaylistListeners(app, html) {
    const jukebox = app.jukebox;

    // ========== PLAYLIST BROWSER ITEM CLICK ==========
    html.on('click', '.playlist-browser-item', e => {
        e.stopPropagation();
        // Don't trigger if clicking on play button
        if ($(e.target).closest('.playlist-browser-play').length) return;

        const id = e.currentTarget.dataset.playlistId;
        if (id) {
            app.selectedPlaylistId = id;
            app.render();
        }
    });

    // ========== INLINE PLAY BUTTON IN BROWSER ==========
    html.on('click', '.playlist-browser-play', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const isThisPlaylist = jukebox.currentPlaylist?.id === id;

        if (isThisPlaylist) {
            // Toggle play/pause for the current playlist
            jukebox.togglePlay('music');
            app.render();
        } else {
            // Start playing this playlist
            jukebox.playPlaylist(id);
        }
    });

    // ========== DEDICATED PLAY BUTTON ==========
    html.on('click', '.play-playlist-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const isThisPlaylist = jukebox.currentPlaylist?.id === id;

        if (isThisPlaylist) {
            jukebox.togglePlay('music');
            app.render();
        } else {
            jukebox.playPlaylist(id);
        }
    });

    // ========== SHUFFLE PLAY BUTTON ==========
    html.on('click', '.playlist-shuffle-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (id) {
            jukebox.shuffle = true;
            jukebox.playPlaylist(id);
            ui.notifications.info(localize('Notifications.ShuffleModeEnabled'));
        }
    });

    // ========== DELETE PLAYLIST BUTTON ==========
    html.on('click', '.playlist-delete-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const playlist = jukebox.playlists.find(p => p.id === id);
        if (!playlist) return;

        Dialog.confirm({
            title: localize('Dialog.Confirm.DeletePlaylist'),
            content: `<p>${format('Dialog.Confirm.DeletePlaylistContent', { name: playlist.name })}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                jukebox.deletePlaylist(id);
                // Clear selection and select next available playlist
                if (app.selectedPlaylistId === id) {
                    const remainingPlaylists = jukebox.playlists.filter(p => p.id !== id);
                    app.selectedPlaylistId = remainingPlaylists.length > 0 ? remainingPlaylists[0].id : null;
                }
                app.render();
            }
        });
    });

    // ========== CONTEXT MENU ==========
    html.on('contextmenu', '.playlist-browser-item', e => {
        e.preventDefault();
        e.stopPropagation();

        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const playlist = jukebox.playlists.find(p => p.id === id);
        if (!playlist) return;

        showPlaylistContextMenu(app, jukebox, playlist, e.clientX, e.clientY);
    });
}

/**
 * Show context menu for playlist item
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {NarratorJukebox} jukebox - The jukebox instance
 * @param {Object} playlist - The playlist object
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 */
function showPlaylistContextMenu(app, jukebox, playlist, x, y) {
    // Remove any existing context menu
    $('.nj-context-menu').remove();

    // Create context menu
    const menu = $(`
        <div class="nj-context-menu">
            <div class="nj-context-item" data-action="play">
                <i class="fas fa-play"></i> ${localize('ContextMenu.Play')}
            </div>
            <div class="nj-context-item" data-action="shuffle">
                <i class="fas fa-random"></i> ${localize('ContextMenu.ShufflePlay')}
            </div>
            <div class="nj-context-divider"></div>
            <div class="nj-context-item danger" data-action="delete">
                <i class="fas fa-trash"></i> ${localize('ContextMenu.DeletePlaylist')}
            </div>
        </div>
    `);

    // Position menu at cursor
    menu.css({
        top: y + 'px',
        left: x + 'px'
    });

    // Add to body
    $('body').append(menu);

    // Handle menu item clicks
    menu.on('click', '.nj-context-item', evt => {
        const action = evt.currentTarget.dataset.action;
        menu.remove();

        switch (action) {
            case 'play':
                jukebox.playPlaylist(playlist.id);
                break;
            case 'shuffle':
                jukebox.shuffle = true;
                jukebox.playPlaylist(playlist.id);
                ui.notifications.info(localize('Notifications.ShuffleModeEnabled'));
                break;
            case 'delete':
                Dialog.confirm({
                    title: localize('Dialog.Confirm.DeletePlaylist'),
                    content: `<p>${format('Dialog.Confirm.DeletePlaylistContent', { name: playlist.name })}</p>`,
                    classes: ['narrator-jukebox-dialog'],
                    yes: () => {
                        jukebox.deletePlaylist(playlist.id);
                        if (app.selectedPlaylistId === playlist.id) {
                            app.selectedPlaylistId = null;
                        }
                        app.render();
                    }
                });
                break;
        }
    });

    // Close menu when clicking outside
    $(document).one('click', () => menu.remove());
}

export { showPlaylistContextMenu };
