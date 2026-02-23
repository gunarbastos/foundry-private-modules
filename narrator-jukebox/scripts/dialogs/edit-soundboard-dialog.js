/**
 * Edit Soundboard Dialog
 * Dialog for editing existing soundboard sounds
 */

import { JUKEBOX } from '../core/constants.js';
import { formatTimeForInput } from '../utils/time-format.js';
import { applyDarkTheme, DIALOG_CLASSES } from './base-dialog.js';
import { validateField, validateUrl } from '../services/validation-service.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

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
 * Shows the Edit Soundboard dialog
 * @param {Object} options - Dialog options
 * @param {string} options.soundId - The sound ID to edit
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful save
 * @returns {Dialog|null} The dialog instance or null if sound not found
 */
export function showEditSoundboardDialog({ soundId, jukebox, onSuccess }) {
  const sound = jukebox.soundboard.find(s => s.id === soundId);
  if (!sound) {
    ui.notifications.error(localize('Notifications.SoundNotFound'));
    return null;
  }

  const startTimeValue = formatTimeForInputLocal(sound.startTime);
  const endTimeValue = formatTimeForInputLocal(sound.endTime);

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
            <input type="text" name="name" value="${escapeHtml(sound.name)}" spellcheck="false">
          </div>

          <div class="form-group url-group">
            <label><i class="fas fa-link"></i> ${localize('Labels.URL')}</label>
            <input type="text" name="url" value="${escapeHtml(sound.url)}" spellcheck="false">
          </div>

          <div class="form-group">
            <label><i class="fas fa-volume-up"></i> ${localize('Labels.DefaultVolume')}</label>
            <div class="volume-input-wrapper">
              <input type="range" name="volume" min="0" max="100" value="${Math.round((sound.volume || 0.8) * 100)}" class="volume-range">
              <span class="volume-value">${Math.round((sound.volume || 0.8) * 100)}%</span>
            </div>
          </div>

          <div class="form-group trim-group">
            <label><i class="fas fa-cut"></i> ${localize('Dialog.Soundboard.TrimLabel')} <span class="optional">${localize('Common.Optional')}</span></label>
            <div class="trim-inputs">
              <div class="trim-input-group">
                <label>${localize('Dialog.Soundboard.StartIn')}</label>
                <div class="time-input-wrapper">
                  <input type="text" name="startTime" value="${startTimeValue}" placeholder="0:00" class="time-input" spellcheck="false">
                  <span class="time-hint">${localize('Hints.TimeFormat')}</span>
                </div>
              </div>
              <div class="trim-input-group">
                <label>${localize('Dialog.Soundboard.EndOut')}</label>
                <div class="time-input-wrapper">
                  <input type="text" name="endTime" value="${endTimeValue}" placeholder="${localize('Dialog.Soundboard.EndPlaceholder')}" class="time-input" spellcheck="false">
                  <span class="time-hint">${localize('Hints.TimeFormat')}</span>
                </div>
              </div>
            </div>
            <small class="trim-help">${localize('Hints.TrimHelpShort')}</small>
          </div>

          <div class="form-group">
            <label><i class="fas fa-palette"></i> ${localize('Labels.CardColor')}</label>
            <div class="color-picker-wrapper">
              <input type="color" name="color" value="${sound.color || '#ff6b35'}" class="color-picker">
              <div class="color-presets">
                ${colorPresetsHtml}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label><i class="fas fa-icons"></i> ${localize('Labels.Icon')}</label>
            <div class="icon-picker-wrapper">
              <input type="hidden" name="icon" value="${sound.icon || 'fas fa-volume-up'}">
              <div class="icon-preview">
                <i class="${sound.icon || 'fas fa-volume-up'}"></i>
              </div>
              <div class="icon-presets">
                ${iconPresetsHtml}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label><i class="fas fa-image"></i> ${localize('Labels.Thumbnail')}</label>
            <input type="text" name="thumbnail" value="${escapeHtml(sound.thumbnail || '')}" spellcheck="false">
          </div>
        </div>
      </form>
    </div>
  `;

  const dialog = new Dialog({
    title: localize('Dialog.Soundboard.EditTitle'),
    content: content,
    classes: ['narrator-jukebox-dialog', 'soundboard-theme'],
    render: (html) => {
      applyDarkTheme(html);
      setupEditSoundboardListeners(html);
    },
    buttons: {
      save: {
        icon: '<i class="fas fa-save"></i>',
        label: localize('Common.Save'),
        callback: async (html) => {
          const result = await handleEditSoundboardSubmit(html, soundId, sound, jukebox);
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
 * Format seconds to mm:ss for input fields
 * @param {number|null} seconds - Seconds to format
 * @returns {string} Formatted time string
 */
function formatTimeForInputLocal(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
 * Sets up event listeners for the edit soundboard dialog
 * @param {jQuery} html - Dialog HTML
 */
function setupEditSoundboardListeners(html) {
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
}

/**
 * Handles the edit soundboard form submission
 * @param {jQuery} html - Dialog HTML
 * @param {string} soundId - The sound ID being edited
 * @param {Object} sound - The original sound data
 * @param {Object} jukebox - The NarratorJukebox instance
 * @returns {boolean|void} - Returns false to prevent dialog from closing
 */
async function handleEditSoundboardSubmit(html, soundId, sound, jukebox) {
  const form = html.find('form')[0];

  const nameInput = form.name;
  const urlInput = form.url;

  let isValid = true;

  if (!validateField(nameInput, localize('Validation.SoundNameRequired'))) {
    isValid = false;
  }

  if (!validateUrl(urlInput.value, sound.source || 'local')) {
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
    volume: parseInt(form.volume.value) / 100,
    color: form.color.value,
    icon: form.icon.value,
    thumbnail: form.thumbnail.value.trim(),
    startTime: parseTime(form.startTime.value),
    endTime: parseTime(form.endTime.value)
  };

  try {
    await jukebox.updateSoundboardSound(soundId, data);
    ui.notifications.info(format('Notifications.Updated', { name: data.name }));
  } catch (err) {
    debugError("Failed to update sound:", err);
    ui.notifications.error(format('Notifications.FailedToUpdate', { error: err.message }));
  }
}

export default showEditSoundboardDialog;
