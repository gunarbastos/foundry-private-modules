/**
 * Bulk Import Dialog
 * Complex dialog for bulk importing audio files from computer or Foundry data
 */

import { JUKEBOX } from '../core/constants.js';
import { JukeboxBrowser } from '../utils/browser-detection.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { applyDarkTheme, applyDialogClasses } from './base-dialog.js';
import { debugLog, debugError, debugWarn } from '../utils/debug.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Audio file extensions supported
 */
const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'webm', 'flac', 'm4a', 'aac'];

/**
 * Soundboard color presets
 */
const SOUNDBOARD_COLORS = [
  '#1db954', '#e91e63', '#ff9800', '#2196f3',
  '#9c27b0', '#00bcd4', '#ff5722', '#607d8b'
];

/**
 * Configuration for different import types
 */
const TYPE_CONFIG = {
  music: {
    titleKey: 'Dialog.BulkImport.TitleMusic',
    icon: 'fa-music',
    accentClass: '',
    addMethod: 'addMusic',
    defaultFolder: 'audio/music'
  },
  ambience: {
    titleKey: 'Dialog.BulkImport.TitleAmbience',
    icon: 'fa-cloud-sun',
    accentClass: 'ambience',
    addMethod: 'addAmbience',
    defaultFolder: 'audio/ambience'
  },
  soundboard: {
    titleKey: 'Dialog.BulkImport.TitleSoundboard',
    icon: 'fa-th',
    accentClass: 'soundboard',
    addMethod: 'addSoundboardSound',
    defaultFolder: 'audio/soundboard'
  }
};

/**
 * Shows the Bulk Import dialog
 * @param {Object} options - Dialog options
 * @param {string} options.type - Import type: 'music', 'ambience', or 'soundboard'
 * @param {Object} options.jukebox - The NarratorJukebox instance
 * @param {Function} options.onSuccess - Callback on successful import
 * @returns {Dialog|null} The dialog instance or null if not GM
 */
export function showBulkImportDialog({ type = 'music', jukebox, onSuccess }) {
  const isGM = game.user.isGM;
  if (!isGM) {
    ui.notifications.warn(localize('Notifications.OnlyGMCanBulkImport'));
    return null;
  }

  const config = TYPE_CONFIG[type];
  if (!config) {
    debugError(`Unknown import type: ${type}`);
    return null;
  }

  // Build color picker HTML for soundboard
  const colorPickerHTML = type === 'soundboard' ? buildColorPickerHTML() : '';

  const content = buildDialogContent(config, colorPickerHTML);

  // State for the dialog
  let scannedFiles = [];
  let computerFiles = [];
  let selectedFolder = '';
  let selectedColor = SOUNDBOARD_COLORS[0];
  let isImporting = false;
  let sourceMode = 'computer';
  let skipAllDuplicates = false;

  const dialog = new Dialog({
    title: localize(config.titleKey),
    content: content,
    classes: ['narrator-jukebox-dialog', 'bulk-import-dialog', config.accentClass],
    buttons: {},
    render: (html) => {
      applyDialogClasses(html, ['narrator-jukebox-dialog', 'bulk-import-dialog', config.accentClass].filter(c => c));
      applyBulkImportTheme(html);

      // Source button toggle
      html.find('.bulk-import-source-btn').click(function() {
        html.find('.bulk-import-source-btn').removeClass('active');
        $(this).addClass('active');
        sourceMode = $(this).data('source');

        if (sourceMode === 'computer') {
          html.find('.bulk-import-destination-section').show();
          validateImportReady(html, scannedFiles, sourceMode);
          html.find('.bulk-import-computer-input').click();
        } else {
          html.find('.bulk-import-destination-section').hide();
          new (getFilePicker())({
            type: "folder",
            callback: async (path) => {
              selectedFolder = path;
              html.find('.bulk-import-folder-input').val(path);
              await scanFoundryFolder(html, path);
            }
          }).browse();
        }
      });

      // Browse button
      html.find('.bulk-import-browse-btn').click(() => {
        if (sourceMode === 'computer') {
          html.find('.bulk-import-computer-input').click();
        } else {
          new (getFilePicker())({
            type: "folder",
            callback: async (path) => {
              selectedFolder = path;
              html.find('.bulk-import-folder-input').val(path);
              await scanFoundryFolder(html, path);
            }
          }).browse();
        }
      });

      // Destination folder picker
      html.find('.bulk-import-destination-btn').click(() => {
        new (getFilePicker())({
          type: "folder",
          callback: (path) => {
            html.find('.bulk-import-destination-input').val(path);
            validateImportReady(html, scannedFiles, sourceMode);
          }
        }).browse();
      });

      // Computer file input change handler
      html.find('.bulk-import-computer-input').on('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const audioFiles = files.filter(f => {
          const ext = f.name.split('.').pop().toLowerCase();
          return AUDIO_EXTENSIONS.includes(ext);
        });

        if (audioFiles.length === 0) {
          ui.notifications.warn(localize('Notifications.NoAudioFilesFound'));
          return;
        }

        const firstPath = files[0].webkitRelativePath;
        const folderName = firstPath.split('/')[0];
        selectedFolder = folderName;
        html.find('.bulk-import-folder-input').val(folderName + ' (from computer)');

        computerFiles = audioFiles;

        const recursive = html.find('[data-option="recursive"]').hasClass('active');
        const useFolderTags = html.find('[data-option="folderTags"]').hasClass('active');

        scannedFiles = processComputerFiles(audioFiles, useFolderTags, recursive);
        updateFileListUI(html, scannedFiles, sourceMode);
      });

      // Scan Foundry folder function
      const scanFoundryFolder = async (html, path) => {
        html.find('.bulk-import-preview').removeClass('visible');
        html.find('.bulk-import-file-list').empty();

        const recursive = html.find('[data-option="recursive"]').hasClass('active');
        const useFolderTags = html.find('[data-option="folderTags"]').hasClass('active');

        try {
          scannedFiles = await scanFoundryDataFolder(path, path, recursive, useFolderTags);
          computerFiles = [];

          if (scannedFiles.length === 0) {
            ui.notifications.warn(localize('Notifications.NoAudioFilesFound'));
            return;
          }

          updateFileListUI(html, scannedFiles, sourceMode);
        } catch (error) {
          debugError("Scan error:", error);
          ui.notifications.error(localize('Notifications.ErrorScanningFolder'));
        }
      };

      // Toggle switches
      html.find('.jb-toggle-switch').click(function() {
        $(this).toggleClass('active');
      });

      // Color picker for soundboard
      if (type === 'soundboard') {
        setupColorPicker(html, (color) => { selectedColor = color; });
      }

      // Checkbox change handler
      html.on('change', '.bulk-import-file-checkbox', () => {
        updateBulkImportStats(html, scannedFiles);
        validateImportReady(html, scannedFiles, sourceMode);
      });

      // Destination input change handler
      html.find('.bulk-import-destination-input').on('input', () => {
        validateImportReady(html, scannedFiles, sourceMode);
      });

      // Select All / None / Supported buttons
      html.find('.bulk-import-select-btn').click(function() {
        const action = $(this).data('action');
        html.find('.bulk-import-file-checkbox').each(function() {
          const index = $(this).data('index');
          const file = scannedFiles[index];
          if (action === 'all') {
            $(this).prop('checked', true);
          } else if (action === 'none') {
            $(this).prop('checked', false);
          } else if (action === 'supported') {
            $(this).prop('checked', file.supported);
          }
        });
        html.find('.bulk-import-file-checkbox').first().trigger('change');
      });

      // Cancel button
      html.find('.bulk-import-cancel-btn').click(() => {
        if (isImporting) {
          isImporting = false;
          ui.notifications.info(localize('Notifications.ImportCancelled'));
        }
        dialog.close();
      });

      // Import button
      html.find('.bulk-import-import-btn').click(async () => {
        const selectedFiles = [];
        html.find('.bulk-import-file-checkbox:checked').each(function() {
          const index = $(this).data('index');
          selectedFiles.push(scannedFiles[index]);
        });

        if (selectedFiles.length === 0) {
          ui.notifications.warn(localize('Notifications.NoFilesSelected'));
          return;
        }

        isImporting = true;
        skipAllDuplicates = false;
        html.find('.bulk-import-import-btn').prop('disabled', true);
        html.find('.bulk-import-progress-section').addClass('visible');

        const destination = html.find('.bulk-import-destination-input').val().trim() || config.defaultFolder;

        const result = await performImport({
          selectedFiles,
          sourceMode,
          destination,
          type,
          selectedColor,
          config,
          jukebox,
          html,
          isImportingRef: { value: isImporting },
          skipAllRef: { value: skipAllDuplicates }
        });

        isImporting = false;

        // Show completion message
        let message = format('Notifications.SuccessfullyImported', { count: result.imported });
        if (result.skipped > 0) message += ` (${result.skipped} skipped)`;
        if (result.errors > 0) message += ` (${result.errors} errors)`;

        if (result.errors === 0) {
          ui.notifications.info(message);
        } else {
          ui.notifications.warn(message);
        }

        if (onSuccess) onSuccess();
        dialog.close();
      });
    }
  }, {
    width: 600,
    height: 'auto',
    resizable: true
  });

  dialog.render(true);
  return dialog;
}

/**
 * Build color picker HTML for soundboard
 */
function buildColorPickerHTML() {
  return `
    <div class="bulk-import-section bulk-import-colors-section">
      <div class="bulk-import-section-title">${localize('Dialog.BulkImport.DefaultColorForCards')}</div>
      <div class="bulk-import-colors">
        ${SOUNDBOARD_COLORS.map((color, i) => `
          <div class="bulk-import-color ${i === 0 ? 'selected' : ''}"
               data-color="${color}"
               style="background: ${color}"
               data-tooltip="${localize('Dialog.BulkImport.SelectColorTooltip')}"></div>
        `).join('')}
        <input type="color" class="bulk-import-color-input" value="${SOUNDBOARD_COLORS[0]}" style="display: none;">
        <div class="bulk-import-color-custom" data-tooltip="${localize('Dialog.BulkImport.CustomColorTooltip')}">
          <i class="fas fa-palette"></i>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build the main dialog content HTML
 */
function buildDialogContent(config, colorPickerHTML) {
  return `
    <div class="bulk-import-content">
      <!-- Source Selection -->
      <div class="bulk-import-section">
        <div class="bulk-import-section-title">${localize('Dialog.BulkImport.SelectSource')}</div>
        <div class="bulk-import-source-buttons">
          <button type="button" class="bulk-import-source-btn active" data-source="computer">
            <i class="fas fa-desktop"></i>
            <span>${localize('Dialog.BulkImport.MyComputer')}</span>
            <small>${localize('Dialog.BulkImport.SelectFolderFromPC')}</small>
          </button>
          <button type="button" class="bulk-import-source-btn" data-source="foundry">
            <i class="fas fa-database"></i>
            <span>${localize('Dialog.BulkImport.FoundryData')}</span>
            <small>${localize('Dialog.BulkImport.AlreadyUploadedFiles')}</small>
          </button>
        </div>
        <input type="file" class="bulk-import-computer-input" webkitdirectory multiple style="display: none;">
      </div>

      <!-- Folder Display -->
      <div class="bulk-import-section">
        <div class="bulk-import-section-title">${localize('Dialog.BulkImport.SourceFolder')}</div>
        <div class="bulk-import-folder-row">
          <input type="text" class="bulk-import-folder-input" placeholder="${localize('Dialog.BulkImport.ClickSourceButton')}" readonly>
          <button type="button" class="bulk-import-browse-btn" data-tooltip="${localize('Dialog.BulkImport.BrowseAgainTooltip')}">
            <i class="fas fa-folder-open"></i>
          </button>
        </div>
      </div>

      <!-- Destination Folder (only for computer uploads) -->
      <div class="bulk-import-section bulk-import-destination-section" style="display: none;">
        <div class="bulk-import-section-title">
          ${localize('Dialog.BulkImport.UploadDestination')}
          <span class="bulk-import-hint">${localize('Dialog.BulkImport.DestinationHint')}</span>
        </div>
        <div class="bulk-import-folder-row">
          <input type="text" class="bulk-import-destination-input" value="" placeholder="${format('Dialog.BulkImport.ClickBrowseOrType', { path: config.defaultFolder })}">
          <button type="button" class="bulk-import-destination-btn" data-tooltip="${localize('Dialog.BulkImport.BrowseFoundryTooltip')}">
            <i class="fas fa-folder-open"></i>
          </button>
        </div>
        <div class="bulk-import-destination-hint" style="font-size: 0.75rem; color: #888; margin-top: 4px;">
          <i class="fas fa-info-circle"></i> ${localize('Dialog.BulkImport.RequiredSelectDestination')}
        </div>
      </div>

      <!-- Options -->
      <div class="bulk-import-section">
        <div class="bulk-import-section-title">${localize('Dialog.BulkImport.Options')}</div>
        <div class="bulk-import-options">
          <div class="bulk-import-option">
            <div class="bulk-import-option-label">
              <span>${localize('Dialog.BulkImport.IncludeSubfolders')}</span>
              <span>${localize('Dialog.BulkImport.IncludeSubfoldersDesc')}</span>
            </div>
            <button type="button" class="jb-toggle-switch ${config.accentClass} active" data-option="recursive">
            </button>
          </div>
          <div class="bulk-import-option">
            <div class="bulk-import-option-label">
              <span>${localize('Dialog.BulkImport.UseFolderNamesAsTags')}</span>
              <span>${localize('Dialog.BulkImport.UseFolderNamesAsTagsDesc')}</span>
            </div>
            <button type="button" class="jb-toggle-switch ${config.accentClass} active" data-option="folderTags">
            </button>
          </div>
        </div>
      </div>

      ${colorPickerHTML}

      <!-- Preview Section -->
      <div class="bulk-import-preview">
        <div class="bulk-import-preview-header">
          <div class="bulk-import-preview-title">
            <i class="fas fa-list"></i> ${localize('Dialog.BulkImport.FilesFound')}
          </div>
          <div class="bulk-import-preview-actions">
            <button type="button" class="bulk-import-select-btn" data-action="all">${localize('Dialog.BulkImport.SelectAll')}</button>
            <button type="button" class="bulk-import-select-btn" data-action="none">${localize('Dialog.BulkImport.SelectNone')}</button>
            <button type="button" class="bulk-import-select-btn" data-action="supported">${localize('Dialog.BulkImport.SupportedOnly')}</button>
          </div>
        </div>
        <div class="bulk-import-file-list"></div>
        <div class="bulk-import-summary">
          <div class="bulk-import-stat found">
            <i class="fas fa-file-audio"></i>
            <span class="stat-found">0</span> ${localize('Dialog.BulkImport.Found')}
          </div>
          <div class="bulk-import-stat selected">
            <i class="fas fa-check-circle"></i>
            <span class="stat-selected">0</span> ${localize('Dialog.BulkImport.Selected')}
          </div>
          <div class="bulk-import-stat errors">
            <i class="fas fa-exclamation-triangle"></i>
            <span class="stat-errors">0</span> ${localize('Dialog.BulkImport.Unsupported')}
          </div>
        </div>
      </div>

      <!-- Progress Section -->
      <div class="bulk-import-progress-section">
        <div class="bulk-import-progress-bar">
          <div class="bulk-import-progress-fill"></div>
        </div>
        <div class="bulk-import-progress-text">
          <span class="bulk-import-progress-file">${localize('Dialog.BulkImport.Preparing')}</span>
          <span class="bulk-import-progress-percent">0%</span>
        </div>
      </div>
    </div>

    <div class="bulk-import-footer">
      <button type="button" class="bulk-import-cancel-btn">${localize('Common.Cancel')}</button>
      <button type="button" class="bulk-import-import-btn" disabled>
        <i class="fas fa-file-import"></i> ${localize('Dialog.BulkImport.ImportSelected')}
      </button>
    </div>
  `;
}

/**
 * Apply dark theme to bulk import dialog
 */
function applyBulkImportTheme(html) {
  const dialogApp = html.closest('.app.dialog');
  if (dialogApp.length) {
    dialogApp.css({
      'background': '#0a0a0a',
      'border': '1px solid rgba(255, 255, 255, 0.1)',
      'border-radius': '12px',
      'min-width': '550px'
    });
  }
}

/**
 * Process files from computer into scan format
 */
function processComputerFiles(audioFiles, useFolderTags, recursive) {
  let files = audioFiles.map(file => {
    const relativePath = file.webkitRelativePath;
    const pathParts = relativePath.split('/');
    const filename = pathParts.pop();

    let name = filename.replace(/\.[^/.]+$/, '');
    try { name = decodeURIComponent(name); } catch(e) {}
    name = name.replace(/[-_]/g, ' ');

    let tags = [];
    if (useFolderTags && pathParts.length > 1) {
      tags = pathParts.slice(1).map(t => {
        try { t = decodeURIComponent(t); } catch(e) {}
        return t.replace(/[-_]/g, ' ').trim().toLowerCase();
      }).filter(t => t);
    }

    const ext = filename.split('.').pop().toLowerCase();
    const supported = JukeboxBrowser.isFormatSupported(filename);

    return {
      file: file,
      path: relativePath,
      name: name,
      tags: tags,
      supported: supported,
      extension: ext
    };
  });

  if (!recursive) {
    files = files.filter(f => f.path.split('/').length === 2);
  }

  return files;
}

/**
 * Update file list UI
 */
function updateFileListUI(html, scannedFiles, sourceMode) {
  if (scannedFiles.length === 0) return;

  const fileListHTML = scannedFiles.map((file, index) => `
    <div class="bulk-import-file-item ${!file.supported ? 'unsupported' : ''}" data-index="${index}">
      <input type="checkbox" class="bulk-import-file-checkbox" ${file.supported ? 'checked' : ''} data-index="${index}">
      <div class="bulk-import-file-info">
        <div class="bulk-import-file-name">${file.name}</div>
        <div class="bulk-import-file-path">${file.path}</div>
      </div>
      ${file.tags.length > 0 ? `
        <div class="bulk-import-file-tags">
          ${file.tags.map(tag => `<span class="bulk-import-file-tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
      ${!file.supported ? `
        <div class="bulk-import-file-warning" data-tooltip="${format('Dialog.BulkImport.FormatMayNotBeSupported', { ext: file.extension })}">
          <i class="fas fa-exclamation-triangle"></i>
          <span>.${file.extension}</span>
        </div>
      ` : ''}
    </div>
  `).join('');

  html.find('.bulk-import-file-list').html(fileListHTML);
  html.find('.bulk-import-preview').addClass('visible');

  html.find('.bulk-import-file-checkbox').each(function() {
    const index = $(this).data('index');
    const file = scannedFiles[index];
    $(this).prop('checked', file.supported);
  });

  updateBulkImportStats(html, scannedFiles);
  validateImportReady(html, scannedFiles, sourceMode);
}

/**
 * Update stats display
 */
function updateBulkImportStats(html, files) {
  const total = files.length;
  const selected = html.find('.bulk-import-file-checkbox:checked').length;
  const unsupported = files.filter(f => !f.supported).length;

  html.find('.stat-found').text(total);
  html.find('.stat-selected').text(selected);
  html.find('.stat-errors').text(unsupported);

  html.find('.bulk-import-import-btn').prop('disabled', selected === 0);
}

/**
 * Validate if import is ready
 */
function validateImportReady(html, scannedFiles, sourceMode) {
  const hasFiles = scannedFiles.length > 0;
  const hasSelectedFiles = html.find('.bulk-import-file-checkbox:checked').length > 0;
  const destination = html.find('.bulk-import-destination-input').val().trim();
  const needsDestination = sourceMode === 'computer';
  const hasDestination = !needsDestination || destination.length > 0;

  const isReady = hasFiles && hasSelectedFiles && hasDestination;
  html.find('.bulk-import-import-btn').prop('disabled', !isReady);

  const hintEl = html.find('.bulk-import-destination-hint');
  if (needsDestination) {
    if (!hasDestination) {
      hintEl.html(`<i class="fas fa-exclamation-circle"></i> ${localize('Dialog.BulkImport.RequiredSelectDestination')}`);
      hintEl.css('color', '#ff6b6b');
    } else if (hasFiles && hasSelectedFiles) {
      hintEl.html(`<i class="fas fa-check-circle"></i> ${localize('Dialog.BulkImport.ReadyToImport')}`);
      hintEl.css('color', '#1db954');
    } else {
      hintEl.html(`<i class="fas fa-info-circle"></i> ${localize('Dialog.BulkImport.DestinationSet')}`);
      hintEl.css('color', '#888');
    }
  }

  return isReady;
}

/**
 * Setup color picker for soundboard
 */
function setupColorPicker(html, onColorChange) {
  html.find('.bulk-import-color').click(function() {
    html.find('.bulk-import-color').removeClass('selected');
    $(this).addClass('selected');
    onColorChange($(this).data('color'));
  });

  html.find('.bulk-import-color-custom').click(() => {
    html.find('.bulk-import-color-input').click();
  });

  html.find('.bulk-import-color-input').on('input', function() {
    const color = $(this).val();
    onColorChange(color);
    html.find('.bulk-import-color').removeClass('selected');
    $(this).prev('.bulk-import-color-custom').css('background', color).addClass('selected');
  });
}

/**
 * Perform the actual import
 */
async function performImport({ selectedFiles, sourceMode, destination, type, selectedColor, config, jukebox, html, isImportingRef, skipAllRef }) {
  let imported = 0;
  let errors = 0;
  let skipped = 0;

  const FP = getFilePicker();

  for (let i = 0; i < selectedFiles.length; i++) {
    if (!isImportingRef.value) break;

    const file = selectedFiles[i];
    const percent = Math.round(((i + 1) / selectedFiles.length) * 100);

    html.find('.bulk-import-progress-fill').css('width', `${percent}%`);
    const progressText = sourceMode === 'computer'
      ? format('Dialog.BulkImport.Uploading', { name: file.name })
      : format('Dialog.BulkImport.Importing', { name: file.name });
    html.find('.bulk-import-progress-file').text(progressText);
    html.find('.bulk-import-progress-percent').text(`${percent}%`);

    try {
      let finalPath = file.path;

      if (sourceMode === 'computer' && file.file) {
        const relativePath = file.path.split('/').slice(1).join('/');
        const destPath = relativePath ? `${destination}/${relativePath}` : `${destination}/${file.file.name}`;
        const destFolder = destPath.substring(0, destPath.lastIndexOf('/'));

        // Ensure destination folder exists
        await ensureFolder(FP, destFolder);

        // Check for duplicates
        if (skipAllRef.value) {
          try {
            const existsCheck = await FP.browse("data", destFolder);
            if (existsCheck.files.some(f => f.endsWith('/' + file.file.name))) {
              skipped++;
              continue;
            }
          } catch (e) {}
        }

        // Upload the file
        try {
          const response = await FP.upload("data", destFolder, file.file, {});
          finalPath = response.path;
        } catch (uploadError) {
          debugError(`Upload error for ${file.name}:`, uploadError);
          errors++;
          continue;
        }
      }

      if (!finalPath) {
        errors++;
        continue;
      }

      // Create data object
      const data = {
        id: foundry.utils.randomID(),
        name: file.name,
        source: 'local',
        url: finalPath,
        tags: file.tags,
        thumbnail: ''
      };

      if (type === 'soundboard') {
        data.volume = 1.0;
        data.color = selectedColor;
        data.icon = 'fas fa-music';
        data.startTime = null;
        data.endTime = null;
      }

      await jukebox[config.addMethod](data);
      imported++;

    } catch (error) {
      debugError(`Error importing ${file.name}:`, error);
      errors++;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return { imported, errors, skipped };
}

/**
 * Ensure a folder exists, creating it if necessary
 */
async function ensureFolder(FP, folderPath) {
  try {
    await FP.browse("data", folderPath);
  } catch (folderError) {
    try {
      await FP.createDirectory("data", folderPath, {});
    } catch (createError) {
      const parts = folderPath.split('/');
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        try {
          await FP.browse("data", currentPath);
        } catch (e) {
          try {
            await FP.createDirectory("data", currentPath, {});
          } catch (e2) {}
        }
      }
    }
  }
}

/**
 * Scan a Foundry data folder for audio files using FilePicker API
 * @param {string} folderPath - The folder path to scan
 * @param {string} rootPath - The root path (for computing relative tags)
 * @param {boolean} recursive - Whether to scan subfolders
 * @param {boolean} useFolderTags - Whether to use folder names as tags
 * @returns {Array} Array of file objects with name, path, tags, supported, extension
 */
async function scanFoundryDataFolder(folderPath, rootPath, recursive, useFolderTags) {
  const FP = getFilePicker();
  const results = [];

  try {
    const contents = await FP.browse("data", folderPath);

    // Process audio files in this folder
    for (const filePath of (contents.files || [])) {
      const ext = filePath.split('.').pop().toLowerCase();
      if (!AUDIO_EXTENSIONS.includes(ext)) continue;

      const filename = filePath.split('/').pop();
      let name = filename.replace(/\.[^/.]+$/, '');
      try { name = decodeURIComponent(name); } catch(e) {}
      name = name.replace(/[-_]/g, ' ');

      let tags = [];
      if (useFolderTags && folderPath !== rootPath) {
        const relativePath = folderPath.replace(rootPath, '').replace(/^\//, '');
        tags = relativePath.split('/').map(t => {
          try { t = decodeURIComponent(t); } catch(e) {}
          return t.replace(/[-_]/g, ' ').trim().toLowerCase();
        }).filter(t => t);
      }

      results.push({
        path: filePath,
        name,
        tags,
        supported: JukeboxBrowser.isFormatSupported(filename),
        extension: ext
      });
    }

    // Recursively scan subfolders
    if (recursive && contents.dirs) {
      for (const subDir of contents.dirs) {
        const subResults = await scanFoundryDataFolder(subDir, rootPath, recursive, useFolderTags);
        results.push(...subResults);
      }
    }
  } catch (err) {
    debugError(`Error scanning folder ${folderPath}:`, err);
  }

  return results;
}

export default showBulkImportDialog;
