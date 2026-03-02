/**
 * Add Ambience Dialog
 * Dialog for adding new ambience tracks
 */

import { JUKEBOX } from '../core/constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { applyDarkTheme, applyDialogClasses, DIALOG_CLASSES } from './base-dialog.js';
import { validateField, validateUrl } from '../services/validation-service.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Ambience-specific theme (purple accent)
 */
const AMBIENCE_THEME = {
  app: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'border-radius': '12px'
  },
  header: {
    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
    'background-color': '#1a1a1a',
    'border-bottom': '1px solid rgba(102, 126, 234, 0.3)',
    'border-radius': '12px 12px 0 0'
  },
  headerTitle: {
    'color': '#fff'
  },
  content: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'color': '#ffffff'
  },
  dialogContent: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'color': '#ffffff'
  },
  buttons: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'border-top': '1px solid rgba(255, 255, 255, 0.06)',
    'padding': '16px 24px'
  },
  button: {
    'background': '#667eea',
    'color': '#fff',
    'border': 'none',
    'border-radius': '20px',
    'padding': '10px 24px',
    'font-weight': '600'
  }
};

/**
 * Shows the Add Ambience dialog
 * @param {Object} options - Dialog options
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful add
 * @returns {Dialog|null} The dialog instance or null if not GM
 */
export function showAddAmbienceDialog({ jukebox, onSuccess }) {
  const isGM = game.user.isGM;
  if (!isGM) {
    ui.notifications.warn(localize('Notifications.OnlyGMCanAdd'));
    return null;
  }

  const content = `
    <div class="add-track-dialog ambience-dialog">
      <div class="dialog-header">
        <div class="header-icon ambience-icon">
          <i class="fas fa-cloud-sun"></i>
        </div>
        <div class="header-info">
          <h2>${localize('Dialog.Ambience.AddTitle')}</h2>
          <p>${localize('Dialog.Ambience.AddSubtitle')}</p>
        </div>
      </div>

      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.AmbienceName')}</label>
            <input type="text" name="name" placeholder="${localize('Placeholders.EnterAmbienceName')}" spellcheck="false">
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
            <input type="text" name="tags" placeholder="${localize('Placeholders.AmbienceTags')}" spellcheck="false">
            <span class="field-hint">${localize('Hints.TagsHelpOrganizeAmbience')}</span>
          </div>

          <div class="form-group thumbnail-group">
            <label><i class="fas fa-image"></i> ${localize('Labels.Thumbnail')} <span class="optional">${localize('Common.Optional')}</span></label>
            <div class="thumbnail-wrapper">
              <div class="thumbnail-preview ambience-preview">
                <i class="fas fa-cloud-sun"></i>
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
    title: localize('Dialog.Ambience.AddTitle'),
    content: content,
    classes: DIALOG_CLASSES.ambience,
    render: (html) => {
      applyDialogClasses(html, DIALOG_CLASSES.ambience);
      applyDarkTheme(html, AMBIENCE_THEME);
      setupAddAmbienceListeners(html);
    },
    buttons: {
      add: {
        icon: '<i class="fas fa-plus"></i>',
        label: localize('Dialog.Ambience.AddButton'),
        callback: async (html) => {
          const result = await handleAddAmbienceSubmit(html, jukebox);
          if (result === false) return false;
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
 * Sets up event listeners for the add ambience dialog
 * @param {jQuery} html - Dialog HTML
 */
function setupAddAmbienceListeners(html) {
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
        const nameInput = html.find('input[name="name"]');
        if (!nameInput.val()) {
          let filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
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
      thumbnailPreview.html('<i class="fas fa-cloud-sun"></i>');
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
 * Handles the add ambience form submission
 * @param {jQuery} html - Dialog HTML
 * @param {Object} jukebox - The NarratorJukebox instance
 * @returns {boolean|void} - Returns false to prevent dialog from closing
 */
async function handleAddAmbienceSubmit(html, jukebox) {
  const formElement = html.find('form')[0];
  if (!formElement) return;

  const nameInput = formElement.name;
  const urlInput = formElement.url;
  const sourceValue = formElement.source.value;

  let isValid = true;

  if (!validateField(nameInput, localize('Validation.AmbienceNameRequired'))) {
    isValid = false;
  }

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
    return false;
  }

  const data = {
    id: foundry.utils.randomID(),
    name: formElement.name.value.trim(),
    source: formElement.source.value,
    url: formElement.url.value.trim(),
    tags: formElement.tags.value.split(',').map(t => t.trim()).filter(t => t),
    thumbnail: formElement.thumbnail.value.trim()
  };

  try {
    await jukebox.addAmbience(data);
    ui.notifications.info(format('Notifications.AddedAmbience', { name: data.name }));
  } catch (err) {
    debugError("Failed to add ambience:", err);
    ui.notifications.error(format('Notifications.FailedToAddAmbience', { error: err.message }));
  }
}

export default showAddAmbienceDialog;
