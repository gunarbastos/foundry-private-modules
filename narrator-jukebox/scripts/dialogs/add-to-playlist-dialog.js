/**
 * Add to Playlist Dialog
 * Dialog for adding tracks to existing playlists
 */

import { JUKEBOX } from '../core/constants.js';
import { applyDarkTheme, applyDialogClasses, DIALOG_CLASSES } from './base-dialog.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Add to Playlist dialog
 * @param {Object} options - Dialog options
 * @param {string} options.musicId - The music track ID to add
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful add
 * @returns {Dialog|null} The dialog instance or null if no playlists/track not found
 */
export function showAddToPlaylistDialog({ musicId, jukebox, onSuccess }) {
  const track = jukebox.music.find(m => m.id === musicId);
  if (!track) {
    ui.notifications.error(localize('Notifications.TrackNotFound'));
    return null;
  }

  const playlists = jukebox.playlists;

  if (!playlists || playlists.length === 0) {
    ui.notifications.warn(localize('Notifications.NoPlaylistsAvailable'));
    return null;
  }

  const playlistOptions = playlists.map(pl => `
    <div class="playlist-option" data-playlist-id="${pl.id}">
      <div class="playlist-option-icon">
        <i class="fas fa-list"></i>
      </div>
      <div class="playlist-option-info">
        <span class="playlist-option-name">${escapeHtml(pl.name)}</span>
        <span class="playlist-option-count">${format('Dialog.Playlist.TracksCount', { count: pl.tracks?.length || 0 })}</span>
      </div>
      <div class="playlist-option-check">
        <i class="fas fa-plus"></i>
      </div>
    </div>
  `).join('');

  const content = `
    <div class="add-track-dialog playlist-select-dialog">
      <div class="dialog-header">
        <div class="header-icon music-icon">
          <i class="fas fa-plus"></i>
        </div>
        <div class="header-info">
          <h2>${localize('Dialog.Playlist.AddToTitle')}</h2>
          <p>${format('Dialog.Playlist.AddToSubtitle', { name: escapeHtml(track.name) })}</p>
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
      applyDialogClasses(html, DIALOG_CLASSES.playlist);
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
        label: localize('Dialog.Playlist.AddToButton'),
        callback: async (html) => {
          const playlistId = html.find('#playlist-select').val();
          if (playlistId) {
            try {
              await jukebox.addToPlaylist(playlistId, musicId);
              const playlist = playlists.find(p => p.id === playlistId);
              ui.notifications.info(format('Notifications.AddedToPlaylist', { track: track.name, playlist: playlist?.name || 'playlist' }));
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

export default showAddToPlaylistDialog;
