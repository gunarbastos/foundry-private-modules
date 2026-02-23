/**
 * Add Selected to Playlist Dialog
 * Dialog for adding multiple selected tracks to a playlist
 */

import { JUKEBOX } from '../core/constants.js';
import { applyDarkTheme, DIALOG_CLASSES } from './base-dialog.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Add Selected to Playlist dialog
 * @param {Object} options - Dialog options
 * @param {string[]} options.musicIds - Array of music track IDs to add
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful add
 * @returns {Dialog|null} The dialog instance or null if no playlists
 */
export function showAddSelectedToPlaylistDialog({ musicIds, jukebox, onSuccess }) {
  if (!musicIds || musicIds.length === 0) {
    ui.notifications.warn(localize('Notifications.NoTracksSelected'));
    return null;
  }

  const playlists = jukebox.playlists;

  if (!playlists || playlists.length === 0) {
    ui.notifications.warn(localize('Notifications.NoPlaylistsAvailable'));
    return null;
  }

  // Get track names for display
  const tracks = musicIds.map(id => jukebox.music.find(m => m.id === id)).filter(t => t);
  const trackCount = tracks.length;

  // Preview: show first 3 track names
  const previewTracks = tracks.slice(0, 3);
  const remainingCount = trackCount - previewTracks.length;

  const trackPreview = previewTracks.map(t => `<span class="track-preview-name">${escapeHtml(t.name)}</span>`).join('');
  const moreText = remainingCount > 0 ? `<span class="track-preview-more">${format('Dialog.Playlist.AndMore', { count: remainingCount })}</span>` : '';

  const playlistOptions = playlists.map(pl => {
    // Check how many of the selected tracks are already in this playlist
    const alreadyInPlaylist = musicIds.filter(id => pl.musicIds.includes(id)).length;
    const willAdd = trackCount - alreadyInPlaylist;

    return `
      <div class="playlist-option" data-playlist-id="${pl.id}" data-already="${alreadyInPlaylist}" data-will-add="${willAdd}">
        <div class="playlist-option-icon">
          <i class="fas fa-list"></i>
        </div>
        <div class="playlist-option-info">
          <span class="playlist-option-name">${escapeHtml(pl.name)}</span>
          <span class="playlist-option-count">${format('Dialog.Playlist.TracksCount', { count: pl.musicIds?.length || 0 })}</span>
          ${alreadyInPlaylist > 0 ? `<span class="playlist-option-warning">${format('Dialog.Playlist.AlreadyInPlaylist', { count: alreadyInPlaylist })}</span>` : ''}
        </div>
        <div class="playlist-option-badge">
          ${willAdd > 0 ? `<span class="will-add-badge">+${willAdd}</span>` : `<span class="all-exist-badge">${localize('Dialog.Playlist.AllExist')}</span>`}
        </div>
        <div class="playlist-option-check">
          <i class="fas fa-plus"></i>
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <div class="add-track-dialog playlist-select-dialog multi-select-dialog">
      <div class="dialog-header">
        <div class="header-icon music-icon">
          <i class="fas fa-list-check"></i>
        </div>
        <div class="header-info">
          <h2>${format('Dialog.Playlist.AddMultipleHeader', { count: trackCount })}</h2>
          <div class="track-preview">
            ${trackPreview}
            ${moreText}
          </div>
        </div>
      </div>

      <div class="playlist-options-container">
        ${playlistOptions}
      </div>

      <input type="hidden" id="playlist-select" value="${playlists[0]?.id || ''}">
    </div>
  `;

  const dialog = new Dialog({
    title: localize('Dialog.Playlist.AddToTitle'),
    content: content,
    classes: DIALOG_CLASSES.playlist,
    render: (html) => {
      applyDarkTheme(html);

      // Playlist selection
      const playlistOptionsEl = html.find('.playlist-option');
      const hiddenInput = html.find('#playlist-select');

      // Select first by default
      playlistOptionsEl.first().addClass('selected');

      playlistOptionsEl.click((e) => {
        const option = $(e.currentTarget);
        playlistOptionsEl.removeClass('selected');
        option.addClass('selected');
        hiddenInput.val(option.data('playlist-id'));
      });
    },
    buttons: {
      add: {
        label: format('Dialog.Playlist.AddMultipleButton', { count: trackCount }),
        callback: async (html) => {
          const playlistId = html.find('#playlist-select').val();
          if (playlistId) {
            try {
              const result = await jukebox.addMultipleToPlaylist(playlistId, musicIds);
              const playlist = playlists.find(p => p.id === playlistId);

              if (result.added > 0) {
                if (result.skipped > 0) {
                  ui.notifications.info(format('Notifications.AddedMultipleWithSkipped', { added: result.added, playlist: playlist?.name || 'playlist', skipped: result.skipped }));
                } else {
                  ui.notifications.info(format('Notifications.AddedMultipleToPlaylist', { count: result.added, playlist: playlist?.name || 'playlist' }));
                }
              } else if (result.skipped > 0) {
                ui.notifications.warn(format('Notifications.AllTracksAlreadyExist', { count: result.skipped, playlist: playlist?.name || 'playlist' }));
              }

              if (onSuccess) onSuccess();
            } catch (err) {
              debugError("Failed to add to playlist:", err);
              ui.notifications.error(format('Notifications.FailedToAddToPlaylist', { error: err.message }));
            }
          }
        }
      }
    }
  });

  dialog.render(true);
  return dialog;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default showAddSelectedToPlaylistDialog;
