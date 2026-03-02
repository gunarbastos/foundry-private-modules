/**
 * Add Music Dialog
 * Dialog for adding new music tracks to the library
 */

import { JUKEBOX } from '../core/constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { applyDarkTheme, applyDialogClasses, DIALOG_CLASSES } from './base-dialog.js';
import { validateField, validateUrl } from '../services/validation-service.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Add Music dialog
 * @param {Object} options - Dialog options
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful add
 * @returns {Dialog} The dialog instance
 */
export function showAddMusicDialog({ jukebox, onSuccess }) {
  const isGM = game.user.isGM;
  const btnLabel = isGM ? localize('Dialog.Music.AddButton') : localize('Dialog.Music.SuggestButton');
  const dialogTitle = isGM ? localize('Dialog.Music.AddTitle') : localize('Dialog.Music.AddTitlePlayer');
  const dialogSubtitle = isGM ? localize('Dialog.Music.AddSubtitle') : localize('Dialog.Music.AddSubtitlePlayer');

  const content = `
    <div class="add-track-dialog music-dialog">
      <div class="dialog-header">
        <div class="header-icon music-icon">
          <i class="fas fa-music"></i>
        </div>
        <div class="header-info">
          <h2>${dialogTitle}</h2>
          <p>${dialogSubtitle}</p>
        </div>
      </div>

      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.TrackName')}</label>
            <input type="text" name="name" placeholder="${localize('Placeholders.EnterTrackName')}" spellcheck="false">
          </div>

          <div class="form-row">
            <div class="form-group source-group">
              <label><i class="fas fa-database"></i> ${localize('Labels.Source')}</label>
              <div class="source-selector">
                <button type="button" class="source-btn active" data-source="local">
                  <i class="fas fa-folder"></i> ${localize('Labels.LocalFile')}
                </button>
                <button type="button" class="source-btn" data-source="youtube">
                  <i class="fab fa-youtube"></i> ${localize('Labels.YouTube')}
                </button>
              </div>
              <input type="hidden" name="source" value="local">
            </div>
          </div>

          <div class="form-group url-group">
            <label><i class="fas fa-link"></i> <span class="url-label">${localize('Labels.FilePath')}</span>${JukeboxBrowser.getFormatsTagHTML()}</label>
            <div class="url-input-wrapper">
              <input type="text" name="url" placeholder="${localize('Placeholders.SelectFileOrPastePath')}" spellcheck="false">
              <button type="button" class="browse-btn file-picker-btn">
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label><i class="fas fa-tags"></i> ${localize('Labels.Tags')}</label>
            <input type="text" name="tags" placeholder="${localize('Placeholders.MusicTags')}" spellcheck="false">
            <span class="field-hint">${localize('Hints.TagsHelpOrganize')}</span>
          </div>

          <div class="form-group thumbnail-group">
            <label><i class="fas fa-image"></i> ${localize('Labels.Thumbnail')} <span class="optional">${localize('Common.Optional')}</span></label>
            <div class="thumbnail-wrapper">
              <div class="thumbnail-preview">
                <i class="fas fa-music"></i>
              </div>
              <div class="thumbnail-input">
                <input type="text" name="thumbnail" placeholder="${localize('Placeholders.ImageURLAutoFilled')}" spellcheck="false">
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
    title: dialogTitle,
    content: content,
    classes: DIALOG_CLASSES.music,
    render: (html) => {
      applyDialogClasses(html, DIALOG_CLASSES.music);
      applyDarkTheme(html);
      setupAddMusicListeners(html);
    },
    buttons: {
      add: {
        label: btnLabel,
        callback: async (html) => {
          const result = await handleAddMusicSubmit(html, jukebox, isGM);
          if (result === false) return false; // Prevent dialog from closing
          if (onSuccess) onSuccess();
        }
      },
      cancel: {
        label: localize('Common.Cancel')
      }
    }
  });

  dialog.render(true);
  return dialog;
}

/**
 * Sets up event listeners for the add music dialog
 * @param {jQuery} html - Dialog HTML
 */
function setupAddMusicListeners(html) {
  const urlInput = html.find('input[name="url"]');
  const sourceHidden = html.find('input[name="source"]');
  const sourceButtons = html.find('.source-btn');
  const urlLabel = html.find('.url-label');
  const browseBtn = html.find('.file-picker-btn');
  const thumbnailPreview = html.find('.thumbnail-preview');

  // Source selector buttons
  sourceButtons.click((e) => {
    e.preventDefault();
    const btn = $(e.currentTarget);
    const source = btn.data('source');

    sourceButtons.removeClass('active');
    btn.addClass('active');
    sourceHidden.val(source);

    // Update UI based on source
    if (source === 'youtube') {
      urlLabel.text(localize('Labels.YouTubeURL'));
      urlInput.attr('placeholder', localize('Placeholders.PasteYouTubeURL'));
      browseBtn.hide();
    } else {
      urlLabel.text(localize('Labels.FilePath'));
      urlInput.attr('placeholder', localize('Placeholders.SelectFileOrPastePath'));
      browseBtn.show();
    }
  });

  // File Picker
  html.find('.file-picker-btn').click(() => {
    new (getFilePicker())({
      type: "audio",
      current: urlInput.val(),
      callback: (path) => {
        urlInput.val(path);
        // Auto-fill name from filename if empty
        const nameInput = html.find('input[name="name"]');
        if (!nameInput.val()) {
          let filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
          // Decode URL-encoded characters (%20 = space, %5B = [, etc.)
          try { filename = decodeURIComponent(filename); } catch(e) {}
          nameInput.val(filename.replace(/[-_]/g, ' '));
        }
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

  // Update thumbnail preview
  html.find('input[name="thumbnail"]').on('input', (e) => {
    const url = e.target.value;
    if (url) {
      thumbnailPreview.html(`<img src="${url}" alt="Thumbnail">`);
    } else {
      thumbnailPreview.html('<i class="fas fa-music"></i>');
    }
  });

  // Auto-fill YouTube data
  urlInput.on('input', async (e) => {
    const url = e.target.value;
    const source = sourceHidden.val();

    if (source === 'youtube' && url) {
      const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      const match = url.match(regExp);
      const id = (match && match[7].length === 11) ? match[7] : null;

      if (id) {
        debugLog(`Found YouTube ID: ${id}`);
        const thumbUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
        html.find('input[name="thumbnail"]').val(thumbUrl);
        thumbnailPreview.html(`<img src="${thumbUrl}" alt="Thumbnail">`);

        try {
          const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
          const data = await response.json();
          if (data.title) {
            html.find('input[name="name"]').val(data.title);
          }
        } catch (err) {
          debugWarn("Could not fetch YouTube title", err);
        }
      }
    }
  });
}

/**
 * Handles the add music form submission
 * @param {jQuery} html - Dialog HTML
 * @param {Object} jukebox - The NarratorJukebox instance
 * @param {boolean} isGM - Whether the user is a GM
 * @returns {boolean|void} - Returns false to prevent dialog from closing
 */
async function handleAddMusicSubmit(html, jukebox, isGM) {
  const formElement = html.find('form')[0];
  if (!formElement) {
    debugError("Form element not found in dialog!");
    return;
  }

  // Validate required fields
  const nameInput = formElement.name;
  const urlInput = formElement.url;
  const sourceValue = formElement.source.value;

  let isValid = true;

  // Validate name
  if (!validateField(nameInput, localize('Validation.TrackNameRequired'))) {
    isValid = false;
  }

  // Validate URL
  if (!validateUrl(urlInput.value, sourceValue)) {
    const errorMsg = sourceValue === 'youtube'
      ? localize('Validation.InvalidYouTubeURL')
      : localize('Validation.URLRequired');
    if (!validateField(urlInput, errorMsg)) {
      isValid = false;
    }
  }

  if (!isValid) {
    ui.notifications.warn(localize('Validation.FixValidationErrors'));
    return false; // Prevent dialog from closing
  }

  const data = {
    id: foundry.utils.randomID(),
    name: formElement.name.value.trim(),
    source: formElement.source.value,
    url: formElement.url.value.trim(),
    tags: formElement.tags.value.split(',').map(t => t.trim()).filter(t => t),
    thumbnail: formElement.thumbnail.value.trim()
  };

  debugLog("Adding Music Data:", data);

  try {
    if (isGM) {
      await jukebox.addMusic(data);
      ui.notifications.info(format('Notifications.AddedTrack', { name: data.name }));
    } else {
      if (!NarratorJukebox.socket) {
        debugError("Socketlib not available!");
        ui.notifications.error(localize('Notifications.SocketlibNotActive'));
        return;
      }

      data.user = game.user.name;
      await NarratorJukebox.socket.executeAsGM('suggestTrack', data, game.user.name);
      ui.notifications.info(localize('Notifications.SuggestionSent'));
    }
  } catch (err) {
    debugError("Failed to add music:", err);
    ui.notifications.error(format('Notifications.FailedToAdd', { error: err.message }));
  }
}

export default showAddMusicDialog;
