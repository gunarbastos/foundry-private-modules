/**
 * Save Ambience Preset Dialog
 * Dialog for saving current ambience layers as a preset
 */

import { JUKEBOX } from '../core/constants.js';
import { applyDarkTheme, applyDialogClasses, DIALOG_CLASSES } from './base-dialog.js';
import { validateField } from '../services/validation-service.js';
import { debugLog, debugError } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Shows the Save Ambience Preset dialog
 * @param {Object} options - Dialog options
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful save
 * @returns {Dialog} The dialog instance
 */
export function showSavePresetDialog({ jukebox, onSuccess }) {
  const activeLayers = jukebox.getActiveAmbienceLayers();
  const layerCount = activeLayers.length;

  // Build the layer preview list
  const layerListHtml = activeLayers.map(layer => `
    <div class="preset-layer-item">
      <i class="fas fa-layer-group"></i>
      <span class="layer-name">${layer.track?.name || 'Unknown'}</span>
      <span class="layer-volume">${Math.round(layer.volume * 100)}%</span>
    </div>
  `).join('');

  const content = `
    <div class="add-track-dialog preset-dialog">
      <div class="dialog-header">
        <div class="header-icon ambience-icon">
          <i class="fas fa-bookmark"></i>
        </div>
        <div class="header-info">
          <h2>${localize('Dialog.Preset.SaveHeader')}</h2>
          <p>${format('Dialog.Preset.SaveSubtitle', { count: layerCount })}</p>
        </div>
      </div>

      <form class="track-form">
        <div class="form-section">
          <div class="form-group">
            <label><i class="fas fa-heading"></i> ${localize('Labels.PresetName')}</label>
            <input type="text" id="preset-name" name="name" placeholder="${localize('Placeholders.PresetNameExamples')}" spellcheck="false">
          </div>

          <div class="form-group preset-preview">
            <label><i class="fas fa-layer-group"></i> ${localize('Dialog.Preset.LayersToSave')}</label>
            <div class="preset-layers-list">
              ${layerListHtml || `<div class="no-layers">${localize('Dialog.Preset.NoActiveLayers')}</div>`}
            </div>
            <span class="field-hint">${format('Hints.MasterVolume', { percent: Math.round(jukebox.getAmbienceMasterVolume() * 100) })}</span>
          </div>
        </div>
      </form>
    </div>

    <style>
      .preset-dialog .preset-layers-list {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 12px;
        max-height: 150px;
        overflow-y: auto;
      }
      .preset-dialog .preset-layer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .preset-dialog .preset-layer-item:last-child {
        margin-bottom: 0;
      }
      .preset-dialog .preset-layer-item i {
        color: #1db954;
        font-size: 12px;
      }
      .preset-dialog .layer-name {
        flex: 1;
        color: #fff;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preset-dialog .layer-volume {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
        min-width: 40px;
        text-align: right;
      }
      .preset-dialog .no-layers {
        color: rgba(255, 255, 255, 0.4);
        text-align: center;
        padding: 20px;
        font-style: italic;
      }
    </style>
  `;

  const dialog = new Dialog({
    title: localize('Dialog.Preset.SaveTitle'),
    content: content,
    classes: [...DIALOG_CLASSES.ambience, 'preset-save-dialog'],
    render: (html) => {
      applyDialogClasses(html, [...DIALOG_CLASSES.ambience, 'preset-save-dialog']);
      applyDarkTheme(html);
    },
    buttons: {
      save: {
        label: `<i class="fas fa-save"></i> ${localize('Dialog.Preset.SaveButton')}`,
        callback: async (html) => {
          const nameInput = html.find('#preset-name')[0];

          // Validate preset name
          if (!validateField(nameInput, localize('Validation.PresetNameRequired'))) {
            ui.notifications.warn(localize('Notifications.PresetNameEmpty'));
            return false;
          }

          const name = nameInput.value.trim();

          // Check if there are layers to save
          if (layerCount === 0) {
            ui.notifications.warn(localize('Notifications.NoActiveLayersToSave'));
            return false;
          }

          try {
            await jukebox.saveAmbiencePreset(name);
            ui.notifications.info(format('Notifications.SavedPreset', { name }));
            if (onSuccess) onSuccess();
          } catch (err) {
            debugError("Failed to save preset:", err);
            ui.notifications.error(format('Notifications.FailedToSavePreset', { error: err.message }));
          }
        }
      }
    }
  });

  dialog.render(true);
  return dialog;
}

export default showSavePresetDialog;
