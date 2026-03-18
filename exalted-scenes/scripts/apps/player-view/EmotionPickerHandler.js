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

    this._previewPanel = null;
    this._previewImg = null;
    this._previewLabel = null;
    this._activePreviewItem = null;
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
      this._setupMusicPickerAddMode(musicPicker);
      this._setupYouTubeUrlAutoFill(musicPicker);
    }
  }

  cleanup() {
    this._clearPreview();
    this._previewPanel = null;
    this._previewImg = null;
    this._previewLabel = null;
    this._activePreviewItem = null;
    super.cleanup();
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
      this._clearPreview();

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

    const trackList = picker.querySelector('[data-music-track-list]');
    const emptyState = picker.querySelector('[data-music-empty-state]');
    const emptyQuery = picker.querySelector('[data-music-empty-query]');
    const countNodes = picker.querySelectorAll('[data-music-visible-count]');
    const applyFilter = (rawValue = '') => {
      const query = rawValue.trim().toLowerCase();
      const tracks = trackList?.querySelectorAll('.es-music-picker__track') || [];
      let visibleCount = 0;

      tracks.forEach(track => {
        const trackName = track.dataset.trackName?.toLowerCase() || '';
        const playlistName = track.dataset.trackPlaylist?.toLowerCase() || '';
        const matches = !query || trackName.includes(query) || playlistName.includes(query);

        track.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      countNodes.forEach(node => {
        node.textContent = `${visibleCount}`;
      });

      if (emptyState) {
        emptyState.classList.toggle('is-hidden', visibleCount > 0);
      }

      if (emptyQuery) {
        emptyQuery.textContent = rawValue.trim();
        emptyQuery.classList.toggle('is-hidden', !query);
      }

      picker.classList.toggle('es-music-picker--search-active', !!query);
    };

    applyFilter(searchInput.value || this.view.uiState.musicPicker.searchQuery || '');

    searchInput.addEventListener('input', (e) => {
      this.view.uiState.musicPicker.searchQuery = e.target.value;
      applyFilter(e.target.value);
    }, { signal: this.signal });

    // Focus on the search input when picker opens
    setTimeout(() => {
      searchInput.focus();
      if (searchInput.value) searchInput.select();
    }, 50);
  }

  /**
   * Focuses the YouTube URL field when add mode is open.
   *
   * @param {HTMLElement} picker - The music picker element
   * @private
   */
  _setupMusicPickerAddMode(picker) {
    const urlInput = picker.querySelector('[name="track-url"]');
    if (!urlInput) return;

    setTimeout(() => urlInput.focus(), 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     YOUTUBE URL AUTO-FILL
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up auto-fill for the track name when a YouTube URL is pasted/typed.
   * Uses the YouTube oEmbed API to fetch the video title.
   *
   * @param {HTMLElement} picker - The music picker element
   * @private
   */
  _setupYouTubeUrlAutoFill(picker) {
    const urlInput = picker.querySelector('[name="track-url"]');
    const nameInput = picker.querySelector('[name="track-name"]');
    if (!urlInput || !nameInput) return;

    let debounceTimer = null;

    const handleUrlChange = () => {
      const url = urlInput.value.trim();
      if (!url || !url.match(/(?:youtube\.com|youtu\.be)/i)) return;
      // Only auto-fill if the name field is empty
      if (nameInput.value.trim()) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this._fetchYouTubeTitle(url, nameInput), 400);
    };

    urlInput.addEventListener('input', handleUrlChange, { signal: this.signal });
    urlInput.addEventListener('paste', () => {
      // Small delay so the pasted value is in the input
      setTimeout(handleUrlChange, 50);
    }, { signal: this.signal });
  }

  /**
   * Fetches a YouTube video title via the oEmbed API.
   *
   * @param {string} url - YouTube URL
   * @param {HTMLInputElement} nameInput - The track name input to fill
   * @private
   */
  async _fetchYouTubeTitle(url, nameInput) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oembedUrl);
      if (!response.ok) return;
      const data = await response.json();
      if (data.title && !nameInput.value.trim()) {
        nameInput.value = data.title;
      }
    } catch (e) {
      // Silently fail — user can type the name manually
    }
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

    this._previewPanel = previewPanel;
    this._previewImg = previewImg;
    this._previewLabel = previewLabel;

    const grid = picker.querySelector('.es-picker-grid') || picker;
    const hidePreview = () => this._clearPreview();

    grid.addEventListener('pointerover', (event) => {
      const item = this._getPickerItem(event.target, grid);
      if (!item || item.hidden || item.style.display === 'none') return;
      if (item === this._activePreviewItem) return;
      this._activePreviewItem = item;
      this._showPreview(item, picker, previewPanel, previewImg, previewLabel);
    }, { signal: this.signal });

    grid.addEventListener('pointerout', (event) => {
      const currentItem = this._getPickerItem(event.target, grid);
      if (!currentItem || currentItem !== this._activePreviewItem) return;

      const nextItem = this._getPickerItem(event.relatedTarget, grid);
      if (nextItem === currentItem) return;

      if (nextItem) {
        this._activePreviewItem = nextItem;
        this._showPreview(nextItem, picker, previewPanel, previewImg, previewLabel);
        return;
      }

      hidePreview();
    }, { signal: this.signal });

    picker.addEventListener('pointerleave', hidePreview, { signal: this.signal });
    grid.addEventListener('scroll', hidePreview, { signal: this.signal, passive: true });
    picker.addEventListener('wheel', hidePreview, { signal: this.signal, passive: true });
    document.addEventListener('pointerdown', (event) => {
      if (!picker.contains(event.target)) hidePreview();
    }, { signal: this.signal });
    window.addEventListener('blur', hidePreview, { signal: this.signal });
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
    panel.classList.toggle('es-picker-preview--above', position.above);
    panel.classList.toggle('es-picker-preview--below', !position.above);

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
    panel.classList.remove('es-picker-preview--above', 'es-picker-preview--below');
  }

  /**
   * Clear the current hover preview state.
   *
   * @private
   */
  _clearPreview() {
    this._activePreviewItem = null;
    if (this._previewPanel) {
      this._hidePreview(this._previewPanel);
    }
  }

  /**
   * Resolve an emotion picker item from an arbitrary event target.
   *
   * @param {EventTarget|null} target - Event target or related target
   * @param {HTMLElement} scope - Picker grid scope
   * @returns {HTMLElement|null}
   * @private
   */
  _getPickerItem(target, scope) {
    if (!(target instanceof Element)) return null;

    const item = target.closest('.es-picker-item');
    if (!item || !scope.contains(item)) return null;
    return item;
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
