/**
 * Playlist Listeners Module
 * Handles playlist browser interactions: selection, play, shuffle, delete, context menu
 *
 * @module ui/listeners/playlist-listeners
 */

import { localize, format, has } from '../../utils/i18n.js';

const CONTEXT_MENU_SELECTOR = '.nj-playlist-context-menu';
const CONTEXT_MENU_NAMESPACE = '.njPlaylistContextMenu';

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
            jukebox.togglePlay('music');
            app.render();
        } else {
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

    // ========== PLAYLIST LOOP TOGGLE ==========
    html.on('click', '.playlist-loop-btn', async e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const newState = await jukebox.togglePlaylistLoop(id);
        const label = newState ? 'Loop Playlist (On)' : 'Loop Playlist (Off)';
        ui.notifications.info(label);
        app.render();
    });

    // ========== PER-TRACK LOOP TOGGLE ==========
    html.on('click', '.track-loop-btn', async e => {
        e.stopPropagation();
        const musicId = e.currentTarget.dataset.musicId;
        const playlistId = e.currentTarget.dataset.playlistId;
        if (!musicId || !playlistId) return;

        await jukebox.togglePlaylistTrackLoop(playlistId, musicId);
        app.render();
    });

    // ========== DELETE PLAYLIST BUTTON ==========
    html.on('click', '.playlist-delete-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const playlist = jukebox.playlists.find(p => p.id === id);
        if (!playlist) return;

        confirmPlaylistDeletion(app, jukebox, playlist);
    });

    // ========== CONTEXT MENU ==========
    html.on('contextmenu', '.playlist-browser-item', e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const id = e.currentTarget.dataset.playlistId;
        if (!id) return false;

        const playlist = jukebox.playlists.find(p => p.id === id);
        if (!playlist) return false;

        app.selectedPlaylistId = id;
        showPlaylistContextMenu(app, jukebox, playlist, e.clientX, e.clientY);
        return false;
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
    closePlaylistContextMenu();

    const playlistIndex = jukebox.playlists.findIndex(p => p.id === playlist.id);
    const isCurrentPlaylist = jukebox.currentPlaylist?.id === playlist.id;
    const isPlaying = isCurrentPlaylist && jukebox.isPlaying;
    const isGM = game.user?.isGM;
    const tracksCountLabel = format('Dialog.Playlist.TracksCount', { count: playlist.musicIds.length });

    const menu = $(`
        <div class="nj-context-menu nj-playlist-context-menu" role="menu" aria-label="${escapeHtml(playlist.name)}">
            <div class="nj-context-header">
                <div class="nj-context-title">${escapeHtml(playlist.name)}</div>
                <div class="nj-context-subtitle">${escapeHtml(tracksCountLabel)}</div>
            </div>
            ${buildMenuItem({
                action: 'play',
                icon: isPlaying ? 'fas fa-pause' : 'fas fa-play',
                label: isPlaying ? contextText('ContextMenu.Pause', 'Pause') : localize('ContextMenu.Play'),
                description: isPlaying
                    ? contextText('ContextMenu.PauseHint', 'Pause this playlist')
                    : contextText('ContextMenu.PlayHint', 'Start this playlist')
            })}
            ${buildMenuItem({
                action: 'shuffle',
                icon: 'fas fa-random',
                label: localize('ContextMenu.ShufflePlay'),
                description: contextText('ContextMenu.ShuffleHint', 'Start with shuffle enabled')
            })}
            ${isGM ? '<div class="nj-context-divider"></div>' : ''}
            ${isGM ? buildMenuItem({
                action: 'edit',
                icon: 'fas fa-edit',
                label: contextText('ContextMenu.EditPlaylist', 'Edit Details'),
                description: contextText('ContextMenu.EditPlaylistHint', 'Rename or change the cover')
            }) : ''}
            ${isGM ? buildMenuItem({
                action: 'duplicate',
                icon: 'fas fa-copy',
                label: contextText('ContextMenu.DuplicatePlaylist', 'Duplicate Playlist'),
                description: contextText('ContextMenu.DuplicatePlaylistHint', 'Create a copy with the same tracks')
            }) : ''}
            ${isGM ? buildMenuItem({
                action: 'move-up',
                icon: 'fas fa-arrow-up',
                label: contextText('ContextMenu.MoveUp', 'Move Up'),
                description: contextText('ContextMenu.MoveUpHint', 'Move this playlist higher in the list'),
                disabled: playlistIndex <= 0
            }) : ''}
            ${isGM ? buildMenuItem({
                action: 'move-down',
                icon: 'fas fa-arrow-down',
                label: contextText('ContextMenu.MoveDown', 'Move Down'),
                description: contextText('ContextMenu.MoveDownHint', 'Move this playlist lower in the list'),
                disabled: playlistIndex === -1 || playlistIndex >= jukebox.playlists.length - 1
            }) : ''}
            ${isGM ? '<div class="nj-context-divider"></div>' : ''}
            ${isGM ? buildMenuItem({
                action: 'delete',
                icon: 'fas fa-trash',
                label: localize('ContextMenu.DeletePlaylist'),
                description: contextText('ContextMenu.DeletePlaylistHint', 'Remove this playlist'),
                danger: true
            }) : ''}
        </div>
    `);

    menu.css({ left: 0, top: 0, visibility: 'hidden' });
    $('body').append(menu);
    positionContextMenu(menu, x, y);

    menu.on('click', '.nj-context-item', async evt => {
        const button = evt.currentTarget;
        if (button.disabled) return;

        const action = button.dataset.action;
        closePlaylistContextMenu();
        await handlePlaylistContextAction(app, jukebox, playlist, action);
    });

    window.setTimeout(() => {
        $(document).on(`mousedown${CONTEXT_MENU_NAMESPACE} contextmenu${CONTEXT_MENU_NAMESPACE}`, event => {
            if (!menu[0]?.contains(event.target)) {
                closePlaylistContextMenu();
            }
        });

        $(window).on(`resize${CONTEXT_MENU_NAMESPACE} scroll${CONTEXT_MENU_NAMESPACE}`, () => {
            closePlaylistContextMenu();
        });
    }, 0);
}

/**
 * Handle playlist context menu actions
 * @param {NarratorsJukeboxApp} app - App instance
 * @param {NarratorJukebox} jukebox - Jukebox instance
 * @param {Object} playlist - Playlist data
 * @param {string} action - Menu action identifier
 */
async function handlePlaylistContextAction(app, jukebox, playlist, action) {
    const playlistIndex = jukebox.playlists.findIndex(p => p.id === playlist.id);

    switch (action) {
        case 'play':
            if (jukebox.currentPlaylist?.id === playlist.id && jukebox.isPlaying) {
                jukebox.togglePlay('music');
                app.render();
            } else {
                jukebox.playPlaylist(playlist.id);
            }
            break;

        case 'shuffle':
            jukebox.shuffle = true;
            jukebox.playPlaylist(playlist.id);
            ui.notifications.info(localize('Notifications.ShuffleModeEnabled'));
            break;

        case 'edit':
            app.showEditPlaylistDialog(playlist.id);
            break;

        case 'duplicate': {
            const duplicate = await jukebox.duplicatePlaylist(playlist.id);
            if (duplicate) {
                app.selectedPlaylistId = duplicate.id;
                ui.notifications.info(format('Notifications.CreatedPlaylist', { name: duplicate.name }));
                app.render();
            }
            break;
        }

        case 'move-up':
            if (playlistIndex > 0) {
                await jukebox.reorderPlaylist(playlist.id, playlistIndex - 1);
                app.selectedPlaylistId = playlist.id;
                app.render();
            }
            break;

        case 'move-down':
            if (playlistIndex !== -1 && playlistIndex < jukebox.playlists.length - 1) {
                await jukebox.reorderPlaylist(playlist.id, playlistIndex + 1);
                app.selectedPlaylistId = playlist.id;
                app.render();
            }
            break;

        case 'delete':
            confirmPlaylistDeletion(app, jukebox, playlist);
            break;
    }
}

/**
 * Confirm playlist deletion
 * @param {NarratorsJukeboxApp} app - App instance
 * @param {NarratorJukebox} jukebox - Jukebox instance
 * @param {Object} playlist - Playlist to delete
 */
function confirmPlaylistDeletion(app, jukebox, playlist) {
    Dialog.confirm({
        title: localize('Dialog.Confirm.DeletePlaylist'),
        content: `<p>${format('Dialog.Confirm.DeletePlaylistContent', { name: playlist.name })}</p>`,
        classes: ['narrator-jukebox-dialog'],
        yes: async () => {
            await jukebox.deletePlaylist(playlist.id);

            if (jukebox.currentPlaylist?.id === playlist.id) {
                jukebox.currentPlaylist = null;
            }

            if (app.selectedPlaylistId === playlist.id) {
                const remainingPlaylists = jukebox.playlists;
                app.selectedPlaylistId = remainingPlaylists.length > 0 ? remainingPlaylists[0].id : null;
            }

            app.render();
        }
    });
}

/**
 * Remove any open playlist context menu and associated handlers
 */
function closePlaylistContextMenu() {
    $(CONTEXT_MENU_SELECTOR).remove();
    $(document).off(CONTEXT_MENU_NAMESPACE);
    $(window).off(CONTEXT_MENU_NAMESPACE);
}

/**
 * Keep the context menu within the viewport
 * @param {jQuery} menu - Context menu element
 * @param {number} x - Requested X position
 * @param {number} y - Requested Y position
 */
function positionContextMenu(menu, x, y) {
    const margin = 12;
    const width = menu.outerWidth();
    const height = menu.outerHeight();
    const left = Math.min(Math.max(margin, x), window.innerWidth - width - margin);
    const top = Math.min(Math.max(margin, y), window.innerHeight - height - margin);

    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        visibility: 'visible'
    });
}

/**
 * Build one menu item row
 * @param {Object} options - Menu item options
 * @returns {string}
 */
function buildMenuItem({ action, icon, label, description = '', shortcut = '', danger = false, disabled = false }) {
    return `
        <button type="button" class="nj-context-item ${danger ? 'danger' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''}>
            <span class="nj-context-item-main">
                <i class="${icon}"></i>
                <span class="nj-context-item-copy">
                    <span class="nj-context-label">${escapeHtml(label)}</span>
                    ${description ? `<span class="nj-context-description">${escapeHtml(description)}</span>` : ''}
                </span>
            </span>
            ${shortcut ? `<span class="nj-context-shortcut">${escapeHtml(shortcut)}</span>` : ''}
        </button>
    `;
}

/**
 * Resolve localized text for new context menu strings with safe fallback text
 * @param {string} key - Localization key
 * @param {string} fallback - Fallback string
 * @returns {string}
 */
function contextText(key, fallback) {
    return has(key) ? localize(key) : fallback;
}

/**
 * Escape HTML to safely render text inside the custom menu
 * @param {string} value - Raw string
 * @returns {string}
 */
function escapeHtml(value) {
    if (!value) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

export { showPlaylistContextMenu };
