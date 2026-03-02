/**
 * Edit Ambience Dialog
 * Dialog for editing existing ambience tracks
 */

import { JUKEBOX } from '../core/constants.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { applyDarkTheme, applyDialogClasses, DIALOG_CLASSES } from './base-dialog.js';
import { validateField, validateUrl } from '../services/validation-service.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Edit Ambience dialog
 * @param {Object} options - Dialog options
 * @param {string} options.trackId - The track ID to edit
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful save
 * @returns {Dialog|null} The dialog instance or null if track not found
 */
export function showEditAmbienceDialog({ trackId, jukebox, onSuccess }) {
  const track = jukebox.ambience.find(a => a.id === trackId);
  if (!track) {
    ui.notifications.error(localize('Notifications.AmbienceNotFound'));
    return null;
  }

  const thumbnailPreview = track.thumbnail
    ? `<img src="${track.thumbnail}" alt="Thumbnail">`
    : '<i class="fas fa-cloud-sun"></i>';

  const content = `
    <div class="add-track-dialog ambience-dialog">
      <div class="dialog-header">
        <div class="header-icon ambience-icon">
          <i class="fas fa-edit"></i>
        </div>
        <div class="header-info">
          <h2>${localize('Dialog.Ambience.EditTitle')}</h2>
          <p>${format('Dialog.Ambience.EditSubtitle', { name: escapeHtml(track.name) })}</p>
        </div>
      </div>

      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.Name')}</label>
            <input type="text" name="name" value="${escapeHtml(track.name)}" spellcheck="false">
          </div>

          <div class="form-group url-group">
            <label><i class="fas fa-link"></i> ${track.source === 'youtube' ? localize('Labels.YouTubeURL') : localize('Labels.FilePath')}</label>
            <div class="url-input-wrapper">
              <input type="text" name="url" value="${escapeHtml(track.url)}" spellcheck="false">
              ${track.source !== 'youtube' ? '<button type="button" class="browse-btn file-picker-btn"><i class="fas fa-folder-open"></i></button>' : ''}
            </div>
          </div>

          <div class="form-group">
            <label><i class="fas fa-tags"></i> ${localize('Labels.Tags')}</label>
            <input type="text" name="tags" value="${escapeHtml((track.tags || []).join(', '))}" spellcheck="false">
          </div>

          <div class="form-group thumbnail-group">
            <label><i class="fas fa-image"></i> ${localize('Labels.Thumbnail')} <span class="optional">${localize('Common.Optional')}</span></label>
            <div class="thumbnail-wrapper">
              <div class="thumbnail-preview ambience-preview">
                ${thumbnailPreview}
              </div>
              <div class="thumbnail-input">
                <input type="text" name="thumbnail" value="${escapeHtml(track.thumbnail || '')}" spellcheck="false">
                <button type="button" class="browse-btn thumbnail-picker-btn">
                  <i class="fas fa-folder-open"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  `;

  const dialog = new Dialog({
    title: localize('Dialog.Ambience.EditTitle'),
    content: content,
    classes: DIALOG_CLASSES.ambience,
    render: (html) => {
      applyDialogClasses(html, DIALOG_CLASSES.ambience);
      applyDarkTheme(html);
      setupEditAmbienceListeners(html);
    },
    buttons: {
      save: {
        label: localize('Common.Save'),
        callback: async (html) => {
          const result = await handleEditAmbienceSubmit(html, trackId, track, jukebox);
          if (result === false) return false;
          if (onSuccess) onSuccess();
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

/**
 * Sets up event listeners for the edit ambience dialog
 * @param {jQuery} html - Dialog HTML
 */
function setupEditAmbienceListeners(html) {
  const thumbnailPreview = html.find('.thumbnail-preview');

  // File Picker for URL (if local)
  html.find('.file-picker-btn').click(() => {
    new (getFilePicker())({
      type: "audio",
      current: html.find('input[name="url"]').val(),
      callback: (path) => {
        html.find('input[name="url"]').val(path);
      }
    }).browse();
  });

  // Thumbnail Picker
  html.find('.thumbnail-picker-btn').click(() => {
    new (getFilePicker())({
      type: "image",
      current: html.find('input[name="thumbnail"]').val(),
      callback: (path) => {
        html.find('input[name="thumbnail"]').val(path);
        thumbnailPreview.html(`<img src="${path}" alt="Thumbnail">`);
      }
    }).browse();
  });

  // Update thumbnail preview on input
  html.find('input[name="thumbnail"]').on('input', (e) => {
    const url = e.target.value;
    if (url) {
      thumbnailPreview.html(`<img src="${url}" alt="Thumbnail">`);
    } else {
      thumbnailPreview.html('<i class="fas fa-cloud-sun"></i>');
    }
  });
}

/**
 * Handles the edit ambience form submission
 * @param {jQuery} html - Dialog HTML
 * @param {string} trackId - The track ID being edited
 * @param {Object} track - The original track data
 * @param {Object} jukebox - The NarratorJukebox instance
 * @returns {boolean|void} - Returns false to prevent dialog from closing
 */
async function handleEditAmbienceSubmit(html, trackId, track, jukebox) {
  const form = html.find('form')[0];

  const nameInput = form.name;
  const urlInput = form.url;

  let isValid = true;

  if (!validateField(nameInput, localize('Validation.AmbienceNameRequired'))) {
    isValid = false;
  }

  if (!validateUrl(urlInput.value, track.source || 'local')) {
    if (!validateField(urlInput, localize('Validation.ValidURLRequired'))) {
      isValid = false;
    }
  }

  if (!isValid) {
    ui.notifications.warn(localize('Validation.FixValidationErrorsSave'));
    return false;
  }

  const data = {
    name: form.name.value.trim(),
    url: form.url.value.trim(),
    tags: form.tags.value.split(',').map(t => t.trim()).filter(t => t),
    thumbnail: form.thumbnail.value.trim()
  };

  try {
    await jukebox.updateAmbience(trackId, data);
    ui.notifications.info(format('Notifications.Updated', { name: data.name }));
  } catch (err) {
    debugError("Failed to update ambience:", err);
    ui.notifications.error(format('Notifications.FailedToUpdate', { error: err.message }));
  }
}

export default showEditAmbienceDialog;
