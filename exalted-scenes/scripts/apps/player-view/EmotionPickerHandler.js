/**
 * @file EmotionPickerHandler.js
 * @description Handles the emotion picker UI interactions for players.
 * Manages search filtering and hover preview functionality.
 *
 * Note: The actual actions (character-click, select-emotion, close-picker, toggle-emotion-favorite)
 * remain in PlayerView as they are static action handlers tied to ApplicationV2.
 * This handler manages the dynamic UI setup that occurs during render.
 *
 * @module player-view/EmotionPickerHandler
 */

import { BaseHandler } from './BaseHandler.js';

/**
 * Preview panel dimensions (from CSS - PlayerView uses larger preview)
 * @constant
 */
const PREVIEW = {
  WIDTH: 400,
  HEIGHT: 430,
  MARGIN: 20
};

/**
 * Manages the emotion picker UI for players.
 * Handles search input filtering and hover preview positioning.
 *
 * @extends BaseHandler
 */
export class EmotionPickerHandler extends BaseHandler {
  /**
   * Creates a new EmotionPickerHandler.
   * @param {ExaltedScenesPlayerView} view - The parent PlayerView instance
   */
  constructor(view) {
    super(view);
  }

  /* ═══════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the emotion picker UI components.
   * Called during view render when the picker is open.
   *
   * @param {HTMLElement} element - The view's root element
   * @override
   */
  setup(element) {
    super.setup(element);

    const emotionPicker = element.querySelector('.es-emotion-picker');
    if (emotionPicker) {
      this._setupSearchInput(emotionPicker);
      this._setupHoverPreview(element, emotionPicker);
    }

    // Also setup music picker search if present
    const musicPicker = element.querySelector('.es-music-picker');
    if (musicPicker) {
      this._setupMusicPickerSearch(musicPicker);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SEARCH INPUT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the search input for filtering emotions.
   * Filters picker items as user types.
   *
   * @param {HTMLElement} picker - The emotion picker element
   * @private
   */
  _setupSearchInput(picker) {
    const searchInput = picker.querySelector('.es-picker-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const items = picker.querySelectorAll('.es-picker-item');

      items.forEach(item => {
        const emotionKey = item.dataset.state.toLowerCase();
        item.style.display = emotionKey.includes(query) ? '' : 'none';
      });
    }, { signal: this.signal });

    // Focus on the search input when picker opens
    setTimeout(() => searchInput.focus(), 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     MUSIC PICKER SEARCH
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the search input for filtering music tracks.
   * Filters track items as user types.
   *
   * @param {HTMLElement} picker - The music picker element
   * @private
   */
  _setupMusicPickerSearch(picker) {
    const searchInput = picker.querySelector('.es-music-picker__search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const tracks = picker.querySelectorAll('.es-music-picker__track');

      tracks.forEach(track => {
        const trackName = track.dataset.trackName?.toLowerCase() || '';
        track.style.display = trackName.includes(query) ? '' : 'none';
      });
    }, { signal: this.signal });

    // Focus on the search input when picker opens
    setTimeout(() => searchInput.focus(), 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     HOVER PREVIEW
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the hover preview for emotions.
   * Shows a larger preview of the emotion image when hovering over picker items.
   * Uses smart positioning to keep preview within viewport bounds.
   *
   * @param {HTMLElement} viewElement - The view's root element
   * @param {HTMLElement} picker - The emotion picker element
   * @private
   */
  _setupHoverPreview(viewElement, picker) {
    // Note: previewPanel is OUTSIDE the emotionPicker (to avoid transform containment issues)
    const previewPanel = viewElement.querySelector('.es-player-view > .es-picker-preview');
    if (!previewPanel) return;

    const previewImg = previewPanel.querySelector('img');
    const previewLabel = previewPanel.querySelector('.es-picker-preview-label');
    if (!previewImg || !previewLabel) return;

    const items = picker.querySelectorAll('.es-picker-item');

    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        this._showPreview(item, picker, previewPanel, previewImg, previewLabel);
      }, { signal: this.signal });

      item.addEventListener('mouseleave', () => {
        this._hidePreview(previewPanel);
      }, { signal: this.signal });
    });
  }

  /**
   * Shows the emotion preview panel with proper positioning.
   *
   * @param {HTMLElement} item - The picker item being hovered
   * @param {HTMLElement} picker - The emotion picker element
   * @param {HTMLElement} panel - The preview panel element
   * @param {HTMLImageElement} img - The preview image element
   * @param {HTMLElement} label - The preview label element
   * @private
   */
  _showPreview(item, picker, panel, img, label) {
    const path = item.dataset.path;
    const state = item.dataset.state;

    img.src = path;
    label.textContent = state;

    const position = this._calculatePreviewPosition(picker);

    // Apply position classes
    panel.classList.remove('preview-left', 'preview-below', 'preview-above');
    if (position.above) {
      panel.classList.add('preview-above');
    } else {
      panel.classList.add('preview-below');
    }

    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.display = 'block';
  }

  /**
   * Hides the emotion preview panel.
   *
   * @param {HTMLElement} panel - The preview panel element
   * @private
   */
  _hidePreview(panel) {
    panel.style.display = 'none';
  }

  /**
   * Calculates the optimal position for the preview panel.
   * Tries to position above the picker first, falls back to below if not enough space.
   * Always keeps the preview within viewport bounds.
   *
   * @param {HTMLElement} picker - The emotion picker element
   * @returns {Object} Position with {left, top, above} properties
   * @private
   */
  _calculatePreviewPosition(picker) {
    const pickerRect = picker.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Space above the picker
    const spaceAbove = pickerRect.top - PREVIEW.MARGIN;

    // Horizontal: center above the picker
    let left = pickerRect.left + (pickerRect.width / 2) - (PREVIEW.WIDTH / 2);
    // Clamp horizontal position to viewport bounds
    left = Math.max(PREVIEW.MARGIN, Math.min(left, viewportWidth - PREVIEW.WIDTH - PREVIEW.MARGIN));

    let top;
    let above = false;

    if (spaceAbove >= PREVIEW.HEIGHT) {
      // Fits above the picker
      top = pickerRect.top - PREVIEW.HEIGHT - 16;
      above = true;
    } else {
      // Not enough space above, place below the picker
      top = pickerRect.bottom + 16;
    }

    // Clamp vertical position to viewport bounds
    top = Math.max(PREVIEW.MARGIN, Math.min(top, viewportHeight - PREVIEW.HEIGHT - PREVIEW.MARGIN));

    return { left, top, above };
  }
}
