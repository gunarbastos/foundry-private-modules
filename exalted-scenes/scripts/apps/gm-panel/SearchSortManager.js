/**
 * @file SearchSortManager.js
 * @description Manages search and sorting functionality for the GMPanel.
 * Handles search input debouncing, sort menu interactions, and provides
 * utility methods for sorting items and generating labels.
 *
 * @module gm-panel/SearchSortManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';

/**
 * Manages search and sorting interactions in the GMPanel.
 * @extends BaseManager
 */
export class SearchSortManager extends BaseManager {
  /**
   * Creates a new SearchSortManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);

    /** @type {number|null} - Timer ID for search debounce */
    this._searchDebounceTimer = null;
  }

  /**
   * Sets up search and sort event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupSearchInput();
    this._setupSortMenuClose();
  }

  /**
   * Cleans up event listeners and timers.
   */
  cleanup() {
    // Clear any pending debounce timer
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
    super.cleanup();
  }

  /**
   * Sets up the search input with debounce functionality.
   * @private
   */
  _setupSearchInput() {
    const searchInput = this.element?.querySelector('.es-search-input');
    if (!searchInput) return;

    // Input event with debounce
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;

      // Show searching indicator
      this.uiState.isSearching = true;

      // Cancel previous timer
      if (this._searchDebounceTimer) {
        clearTimeout(this._searchDebounceTimer);
      }

      // Debounce 300ms
      this._searchDebounceTimer = setTimeout(() => {
        this.uiState.searchQuery = query;
        this.uiState.isSearching = false;
        this.render();
      }, 300);
    }, { signal: this.signal });

    // Escape key clears search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.uiState.searchQuery) {
        e.preventDefault();
        this.uiState.searchQuery = '';
        searchInput.value = '';
        this.render();
      }
    }, { signal: this.signal });
  }

  /**
   * Sets up the listener to close the sort menu when clicking outside.
   * @private
   */
  _setupSortMenuClose() {
    if (!this.uiState.sortMenuOpen) return;

    const closeSort = (e) => {
      if (!e.target.closest('.es-sort-dropdown')) {
        this.uiState.sortMenuOpen = false;
        this.render();
      }
    };

    // Delay to avoid closing immediately after opening
    setTimeout(() => {
      document.addEventListener('click', closeSort, { signal: this.signal });
    }, 10);
  }

  /* ═══════════════════════════════════════════════════════════════
     SORT HELPERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sorts items based on current UI state settings.
   * @param {Array} items - The items to sort
   * @param {string} [type='scenes'] - The type of items ('scenes' or 'characters')
   * @returns {Array} Sorted array of items
   */
  sortItems(items, type = 'scenes') {
    const { sortBy, sortAscending } = this.uiState;

    // Custom order - use Store's saved order
    if (sortBy === 'custom') {
      return Store.applyCustomOrder(items, type);
    }

    const sorted = [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          // Case-insensitive comparison
          comparison = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
          break;
        case 'created':
          // Most recent first when descending
          comparison = (a.createdAt || 0) - (b.createdAt || 0);
          break;
        case 'lastUsed':
          // Most recent first when descending, null goes to end
          const aLast = a.lastUsed || 0;
          const bLast = b.lastUsed || 0;
          comparison = aLast - bLast;
          break;
        case 'playCount':
          // Most used first when descending
          comparison = (a.playCount || 0) - (b.playCount || 0);
          break;
        default:
          comparison = 0;
      }

      return sortAscending ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Returns the display label for the current sort type.
   * @returns {string} The sort label
   */
  getSortLabel() {
    const labels = {
      name: 'Name',
      created: 'Date',
      lastUsed: 'Recent',
      playCount: 'Popular',
      custom: 'Custom'
    };
    return labels[this.uiState.sortBy] || 'Sort';
  }

  /**
   * Applies search highlight to text by wrapping matches in a span.
   * @param {string} text - The text to highlight
   * @param {string} query - The search query
   * @returns {string} Text with highlighted matches (HTML)
   */
  highlightSearch(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="es-highlight">$1</span>');
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Toggles the sort menu open/closed.
   */
  toggleSortMenu() {
    this.uiState.sortMenuOpen = !this.uiState.sortMenuOpen;
    this.render();
  }

  /**
   * Sets the sort type.
   * @param {string} sortBy - The sort type ('name', 'created', 'lastUsed', 'playCount', 'custom')
   */
  setSortType(sortBy) {
    this.uiState.sortBy = sortBy;
    this.uiState.sortMenuOpen = false;
    this.render();
  }

  /**
   * Toggles the sort direction between ascending and descending.
   */
  toggleSortDirection() {
    this.uiState.sortAscending = !this.uiState.sortAscending;
    this.uiState.sortMenuOpen = false;
    this.render();
  }

  /**
   * Clears the current search query.
   */
  clearSearch() {
    this.uiState.searchQuery = '';
    this.uiState.isSearching = false;
    this.render();
  }
}
