/**
 * Add Soundboard Dialog
 * Dialog for adding new soundboard sounds
 */

import { JUKEBOX } from '../core/constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { parseTimeInput } from '../utils/time-format.js';
import { applyDarkTheme, DIALOG_CLASSES } from './base-dialog.js';
import { validateField, validateUrl } from '../services/validation-service.js';
import { debugLog, debugWarn, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Soundboard-specific theme (orange accent)
 */
const SOUNDBOARD_THEME = {
  app: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'border-radius': '12px'
  },
  header: {
    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
    'background-color': '#1a1a1a',
    'border-bottom': '1px solid rgba(255, 107, 53, 0.3)',
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
    'background': '#ff6b35',
    'color': '#fff',
    'border': 'none',
    'border-radius': '20px',
    'padding': '10px 24px',
    'font-weight': '600'
  }
};

/**
 * Color presets for soundboard cards
 */
const COLOR_PRESETS = [
  { color: '#ff6b35', titleKey: 'Colors.Orange' },
  { color: '#e74c3c', titleKey: 'Colors.Red' },
  { color: '#9b59b6', titleKey: 'Colors.Purple' },
  { color: '#3498db', titleKey: 'Colors.Blue' },
  { color: '#1abc9c', titleKey: 'Colors.Teal' },
  { color: '#2ecc71', titleKey: 'Colors.Green' },
  { color: '#f39c12', titleKey: 'Colors.Yellow' },
  { color: '#e91e63', titleKey: 'Colors.Pink' }
];

/**
 * Icon presets for soundboard cards
 */
const ICON_PRESETS = [
  { icon: 'fas fa-volume-up', titleKey: 'Icons.Sound' },
  { icon: 'fas fa-bolt', titleKey: 'Icons.Thunder' },
  { icon: 'fas fa-wind', titleKey: 'Icons.Wind' },
  { icon: 'fas fa-water', titleKey: 'Icons.Water' },
  { icon: 'fas fa-fire', titleKey: 'Icons.Fire' },
  { icon: 'fas fa-door-open', titleKey: 'Icons.Door' },
  { icon: 'fas fa-skull', titleKey: 'Icons.Skull' },
  { icon: 'fas fa-paw', titleKey: 'Icons.Animal' },
  { icon: 'fas fa-sword', titleKey: 'Icons.Sword' },
  { icon: 'fas fa-magic', titleKey: 'Icons.Magic' },
  { icon: 'fas fa-bell', titleKey: 'Icons.Bell' },
  { icon: 'fas fa-ghost', titleKey: 'Icons.Ghost' },
  { icon: 'fas fa-heart-broken', titleKey: 'Icons.Heartbreak' },
  { icon: 'fas fa-bomb', titleKey: 'Icons.Explosion' },
  { icon: 'fas fa-crow', titleKey: 'Icons.Bird' },
  { icon: 'fas fa-clock', titleKey: 'Icons.Clock' }
];

/**
 * Shows the Add Soundboard dialog
 * @param {Object} options - Dialog options
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful add
 * @returns {Dialog} The dialog instance
 */
export function showAddSoundboardDialog({ jukebox, onSuccess }) {
  const colorPresetsHtml = COLOR_PRESETS.map(p =>
    `<button type="button" class="color-preset" data-color="${p.color}" style="background: ${p.color};" title="${localize(p.titleKey)}"></button>`
  ).join('');

  const iconPresetsHtml = ICON_PRESETS.map(p =>
    `<button type="button" class="icon-preset" data-icon="${p.icon}" title="${localize(p.titleKey)}"><i class="${p.icon}"></i></button>`
  ).join('');

  const content = `
    <div class="add-track-dialog soundboard-dialog">
      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.SoundName')}</label>
            <input type="text" name="name" placeholder="${localize('Placeholders.SoundNameExamples')}" spellcheck="false">
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
            <label><i class="fas fa-volume-up"></i> ${localize('Labels.DefaultVolume')}</label>
            <div class="volume-input-wrapper">
              <input type="range" name="volume" min="0" max="100" value="80" class="volume-range">
              <span class="volume-value">80%</span>
            </div>
          </div>

          <div class="form-group trim-group">
            <label><i class="fas fa-cut"></i> ${localize('Dialog.Soundboard.TrimOptional')}</label>
            <div class="trim-inputs">
              <div class="trim-input-group">
                <label>${localize('Dialog.Soundboard.StartIn')}</label>
                <div class="time-input-wrapper">
                  <input type="text" name="startTime" placeholder="0:00" class="time-input" spellcheck="false">
                  <span class="time-hint">${localize('Hints.TimeFormat')}</span>
                </div>
              </div>
              <div class="trim-input-group">
                <label>${localize('Dialog.Soundboard.EndOut')}</label>
                <div class="time-input-wrapper">
                  <input type="text" name="endTime" placeholder="${localize('Dialog.Soundboard.EndPlaceholder')}" class="time-input" spellcheck="false">
                  <span class="time-hint">${localize('Hints.TimeFormat')}</span>
                </div>
              </div>
            </div>
            <small class="trim-help">${localize('Hints.TrimHelp')}</small>
          </div>

          <div class="form-group">
            <label><i class="fas fa-palette"></i> ${localize('Labels.CardColor')}</label>
            <div class="color-picker-wrapper">
              <input type="color" name="color" value="#ff6b35" class="color-picker">
              <div class="color-presets">
                ${colorPresetsHtml}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label><i class="fas fa-icons"></i> ${localize('Labels.Icon')}</label>
            <div class="icon-picker-wrapper">
              <input type="hidden" name="icon" value="fas fa-volume-up">
              <div class="icon-preview">
                <i class="fas fa-volume-up"></i>
              </div>
              <div class="icon-presets">
                ${iconPresetsHtml}
              </div>
            </div>
          </div>

          <div class="form-group thumbnail-group">
            <label><i class="fas fa-image"></i> ${localize('Labels.Thumbnail')} <span class="optional">${localize('Common.Optional')}</span></label>
            <div class="thumbnail-wrapper">
              <div class="thumbnail-preview soundboard-preview">
                <i class="fas fa-volume-up"></i>
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
    title: localize('Dialog.Soundboard.AddTitle'),
    content: content,
    classes: DIALOG_CLASSES.soundboard,
    render: (html) => {
      applyDarkTheme(html, SOUNDBOARD_THEME);
      setupAddSoundboardListeners(html);
    },
    buttons: {
      add: {
        icon: '<i class="fas fa-plus"></i>',
        label: localize('Dialog.Soundboard.AddButton'),
        callback: async (html) => {
          const result = await handleAddSoundboardSubmit(html, jukebox);
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
 * Sets up event listeners for the add soundboard dialog
 * @param {jQuery} html - Dialog HTML
 */
function setupAddSoundboardListeners(html) {
  const urlInput = html.find('input[name="url"]');
  const sourceHidden = html.find('input[name="source"]');
  const sourceButtons = html.find('.source-btn');
  const urlLabel = html.find('.url-label');
  const browseBtn = html.find('.file-picker-btn');
  const thumbnailPreview = html.find('.thumbnail-preview');
  const volumeRange = html.find('input[name="volume"]');
  const volumeValue = html.find('.volume-value');
  const colorPicker = html.find('input[name="color"]');
  const iconHidden = html.find('input[name="icon"]');
  const iconPreview = html.find('.icon-preview i');

  // Volume slider update
  volumeRange.on('input', (e) => {
    volumeValue.text(`${e.target.value}%`);
  });

  // Color presets
  html.find('.color-preset').click((e) => {
    e.preventDefault();
    const color = $(e.currentTarget).data('color');
    colorPicker.val(color);
  });

  // Icon presets
  html.find('.icon-preset').click((e) => {
    e.preventDefault();
    const icon = $(e.currentTarget).data('icon');
    iconHidden.val(icon);
    iconPreview.attr('class', icon);
    html.find('.icon-preset').removeClass('active');
    $(e.currentTarget).addClass('active');
  });

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
 * Parse time string (mm:ss or hh:mm:ss) to seconds
 * @param {string} timeStr - Time string to parse
 * @returns {number|null} Seconds or null if empty/invalid
 */
function parseTime(timeStr) {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length === 1) {
    return parseFloat(parts[0]) || null;
  } else if (parts.length === 2) {
    const mins = parseInt(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  return null;
}

/**
 * Handles the add soundboard form submission
 * @param {jQuery} html - Dialog HTML
 * @param {Object} jukebox - The NarratorJukebox instance
 * @returns {boolean|void} - Returns false to prevent dialog from closing
 */
async function handleAddSoundboardSubmit(html, jukebox) {
  const formElement = html.find('form')[0];
  if (!formElement) return;

  const nameInput = formElement.name;
  const urlInput = formElement.url;
  const sourceValue = formElement.source.value;

  let isValid = true;

  if (!validateField(nameInput, localize('Validation.SoundNameRequired'))) {
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

  const startTime = parseTime(formElement.startTime.value);
  const endTime = parseTime(formElement.endTime.value);

  const data = {
    id: foundry.utils.randomID(),
    name: formElement.name.value.trim(),
    source: formElement.source.value,
    url: formElement.url.value.trim(),
    volume: parseInt(formElement.volume.value) / 100,
    color: formElement.color.value,
    icon: formElement.icon.value,
    thumbnail: formElement.thumbnail.value.trim(),
    startTime: startTime,
    endTime: endTime
  };

  try {
    await jukebox.addSoundboardSound(data);
    ui.notifications.info(format('Notifications.AddedSound', { name: data.name }));
  } catch (err) {
    debugError("Failed to add soundboard sound:", err);
    ui.notifications.error(format('Notifications.FailedToAddSound', { error: err.message }));
  }
}

export default showAddSoundboardDialog;
