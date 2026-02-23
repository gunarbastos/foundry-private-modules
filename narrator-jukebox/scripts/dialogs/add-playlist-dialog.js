/**
 * Add Playlist Dialog
 * Dialog for creating new playlists
 */

import { JUKEBOX } from '../core/constants.js';
import { applyDarkTheme, DIALOG_CLASSES } from './base-dialog.js';
import { validateField } from '../services/validation-service.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Add Playlist dialog
 * @param {Object} options - Dialog options
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful create
 * @returns {Dialog} The dialog instance
 */
export function showAddPlaylistDialog({ jukebox, onSuccess }) {
  const content = `
    <div class="add-track-dialog playlist-dialog">
      <div class="dialog-header">
        <div class="header-icon playlist-icon">
          <i class="fas fa-list"></i>
        </div>
        <div class="header-info">
          <h2>${localize('Dialog.Playlist.CreateHeader')}</h2>
          <p>${localize('Dialog.Playlist.CreateSubtitle')}</p>
        </div>
      </div>

      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.PlaylistName')}</label>
            <input type="text" id="pl-name" name="name" placeholder="${localize('Placeholders.MyAwesomePlaylist')}" spellcheck="false">
          </div>
        </div>
      </form>
    </div>
  `;

  const dialog = new Dialog({
    title: localize('Dialog.Playlist.NewTitle'),
    content: content,
    classes: DIALOG_CLASSES.playlist,
    render: (html) => {
      applyDarkTheme(html);
    },
    buttons: {
      create: {
        label: localize('Dialog.Playlist.CreateButton'),
        callback: async (html) => {
          const nameInput = html.find('#pl-name')[0];

          // Validate playlist name
          if (!validateField(nameInput, localize('Validation.PlaylistNameRequired'))) {
            ui.notifications.warn(localize('Notifications.PlaylistNameEmpty'));
            return false; // Prevent dialog from closing
          }

          const name = nameInput.value.trim();

          try {
            await jukebox.createPlaylist(name);
            ui.notifications.info(format('Notifications.CreatedPlaylist', { name }));
            if (onSuccess) onSuccess();
          } catch (err) {
            debugError("Failed to create playlist:", err);
            ui.notifications.error(format('Notifications.FailedToCreatePlaylist', { error: err.message }));
          }
        }
      }
    }
  });

  dialog.render(true);
  return dialog;
}

export default showAddPlaylistDialog;
