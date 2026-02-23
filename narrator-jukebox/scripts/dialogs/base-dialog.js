/**
 * Base Dialog Utilities
 * Common functions for theming and creating dialogs
 */

import { JUKEBOX } from '../core/constants.js';

/**
 * Default dark theme styles for dialogs
 */
export const DIALOG_THEME = {
  app: {
    'background': '#0a0a0a',
    'background-color': '#0a0a0a',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'border-radius': '12px'
  },
  header: {
    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
    'background-color': '#1a1a1a',
    'border-bottom': '1px solid rgba(29, 185, 84, 0.3)',
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
    'background': '#1db954',
    'color': '#000',
    'border': 'none',
    'border-radius': '20px',
    'padding': '10px 24px',
    'font-weight': '600'
  }
};

/**
 * Mood editor specific theme styles
 */
export const MOOD_EDITOR_THEME = {
  app: {
    'background': '#121212',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
  },
  header: {
    'background': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    'border-bottom': '1px solid rgba(255, 255, 255, 0.1)',
    'color': '#fff'
  },
  headerTitle: {
    'color': '#fff'
  },
  content: {
    'background': '#121212',
    'color': '#fff',
    'padding': '0'
  },
  dialogContent: {
    'color': '#fff',
    'padding': '0'
  },
  buttons: {
    'background': 'rgba(0, 0, 0, 0.3)',
    'border-top': '1px solid rgba(255, 255, 255, 0.1)',
    'padding': '16px 20px'
  },
  button: {
    'background': 'rgba(255, 255, 255, 0.1)',
    'color': '#fff',
    'border': '1px solid rgba(255, 255, 255, 0.2)',
    'padding': '10px 24px',
    'border-radius': '20px',
    'font-weight': '600',
    'transition': 'all 0.2s ease'
  },
  buttonDefault: {
    'background': 'var(--jb-accent, #1DB954)',
    'color': '#000',
    'border-color': 'var(--jb-accent, #1DB954)'
  },
  closeButton: {
    'color': 'rgba(255, 255, 255, 0.7)'
  }
};

/**
 * Apply dark theme to a dialog element
 * @param {jQuery} html - The dialog HTML element
 * @param {Object} theme - Theme object (defaults to DIALOG_THEME)
 */
export function applyDarkTheme(html, theme = DIALOG_THEME) {
  const dialogApp = html.closest('.app.dialog');
  if (!dialogApp.length) return;

  dialogApp.css(theme.app);
  dialogApp.find('.window-header').css(theme.header);
  dialogApp.find('.window-header .window-title').css(theme.headerTitle);
  dialogApp.find('.window-content').css(theme.content);
  dialogApp.find('.dialog-content').css(theme.dialogContent);
  dialogApp.find('.dialog-buttons').css(theme.buttons);
  dialogApp.find('.dialog-buttons button').css(theme.button);

  // Handle special button styles
  if (theme.buttonDefault) {
    dialogApp.find('.dialog-button.default').css(theme.buttonDefault);
  }
  if (theme.closeButton) {
    dialogApp.find('.header-button.close').css(theme.closeButton);
  }
}

/**
 * Apply dark theme specifically for mood editor dialog
 * @param {jQuery} html - The dialog HTML element
 */
export function applyMoodEditorTheme(html) {
  applyDarkTheme(html, MOOD_EDITOR_THEME);
}

/**
 * Common dialog classes for different track types
 */
export const DIALOG_CLASSES = {
  music: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'music-theme'],
  ambience: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'ambience-theme'],
  soundboard: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'soundboard-theme'],
  playlist: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'playlist-theme'],
  moods: ['narrator-jukebox-dialog', 'mood-editor-dialog-v2'],
  bulkImport: ['narrator-jukebox-dialog', 'bulk-import-dialog']
};

/**
 * Create a standard dialog header HTML
 * @param {Object} options - Header options
 * @param {string} options.icon - FontAwesome icon class
 * @param {string} options.title - Header title
 * @param {string} options.subtitle - Header subtitle/description
 * @param {string} options.iconClass - Additional CSS class for icon container
 * @returns {string} HTML string for dialog header
 */
export function createDialogHeader({ icon, title, subtitle, iconClass = '' }) {
  return `
    <div class="dialog-header">
      <div class="header-icon ${iconClass}">
        <i class="${icon}"></i>
      </div>
      <div class="header-info">
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
    </div>
  `;
}

/**
 * Create a form group HTML
 * @param {Object} options - Form group options
 * @param {string} options.icon - FontAwesome icon class
 * @param {string} options.label - Field label
 * @param {string} options.name - Input name attribute
 * @param {string} options.type - Input type (default: text)
 * @param {string} options.value - Input value
 * @param {string} options.placeholder - Input placeholder
 * @param {string} options.hint - Optional hint text
 * @param {boolean} options.optional - Show optional label
 * @param {string} options.extraClass - Additional CSS class
 * @returns {string} HTML string for form group
 */
export function createFormGroup({
  icon,
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  hint = '',
  optional = false,
  extraClass = ''
}) {
  const optionalLabel = optional ? '<span class="optional">(optional)</span>' : '';
  const hintHtml = hint ? `<span class="field-hint">${hint}</span>` : '';

  return `
    <div class="form-group ${extraClass}">
      <label><i class="${icon}"></i> ${label} ${optionalLabel}</label>
      <input type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" spellcheck="false">
      ${hintHtml}
    </div>
  `;
}

/**
 * Create a URL input group with file picker button
 * @param {Object} options - Options
 * @param {string} options.label - Field label
 * @param {string} options.name - Input name
 * @param {string} options.value - Input value
 * @param {string} options.placeholder - Input placeholder
 * @param {boolean} options.showBrowse - Show browse button
 * @param {string} options.extraLabelHtml - Extra HTML after label (e.g., format tags)
 * @returns {string} HTML string for URL input group
 */
export function createUrlInputGroup({
  label,
  name = 'url',
  value = '',
  placeholder = 'Select a file or paste path',
  showBrowse = true,
  extraLabelHtml = ''
}) {
  return `
    <div class="form-group url-group">
      <label><i class="fas fa-link"></i> <span class="url-label">${label}</span>${extraLabelHtml}</label>
      <div class="url-input-wrapper">
        <input type="text" name="${name}" value="${value}" placeholder="${placeholder}" spellcheck="false">
        ${showBrowse ? '<button type="button" class="browse-btn file-picker-btn"><i class="fas fa-folder-open"></i></button>' : ''}
      </div>
    </div>
  `;
}

/**
 * Create a thumbnail input group with preview
 * @param {Object} options - Options
 * @param {string} options.value - Current thumbnail URL
 * @param {string} options.fallbackIcon - Fallback icon class
 * @returns {string} HTML string for thumbnail group
 */
export function createThumbnailGroup({
  value = '',
  fallbackIcon = 'fas fa-music'
}) {
  const preview = value
    ? `<img src="${value}" alt="Thumbnail">`
    : `<i class="${fallbackIcon}"></i>`;

  return `
    <div class="form-group thumbnail-group">
      <label><i class="fas fa-image"></i> Thumbnail <span class="optional">(optional)</span></label>
      <div class="thumbnail-wrapper">
        <div class="thumbnail-preview">
          ${preview}
        </div>
        <div class="thumbnail-input">
          <input type="text" name="thumbnail" value="${value}" placeholder="Image URL (auto-filled for YouTube)" spellcheck="false">
          <button type="button" class="browse-btn thumbnail-picker-btn">
            <i class="fas fa-folder-open"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create source selector buttons (Local/YouTube)
 * @param {string} activeSource - Currently active source ('local' or 'youtube')
 * @returns {string} HTML string for source selector
 */
export function createSourceSelector(activeSource = 'local') {
  return `
    <div class="form-row">
      <div class="form-group source-group">
        <label><i class="fas fa-database"></i> Source</label>
        <div class="source-selector">
          <button type="button" class="source-btn ${activeSource === 'local' ? 'active' : ''}" data-source="local">
            <i class="fas fa-folder"></i> Local File
          </button>
          <button type="button" class="source-btn ${activeSource === 'youtube' ? 'active' : ''}" data-source="youtube">
            <i class="fab fa-youtube"></i> YouTube
          </button>
        </div>
        <input type="hidden" name="source" value="${activeSource}">
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
