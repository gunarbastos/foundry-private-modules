/**
 * @file KeyboardManager.js
 * @description Manages keyboard shortcuts and navigation for the GMPanel.
 * Handles global shortcuts (/, Escape, F for favorites) and emotion picker
 * navigation (arrows, Enter to select).
 *
 * @module gm-panel/KeyboardManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SocketHandler } from '../../data/SocketHandler.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Manages keyboard interactions in the GMPanel.
 * @extends BaseManager
 */
export class KeyboardManager extends BaseManager {
  /**
   * Sets up keyboard event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupKeyboardShortcuts();
  }

  /**
   * Configures keyboard shortcuts for the panel.
   * Handles both global shortcuts and emotion picker navigation.
   * @private
   */
  _setupKeyboardShortcuts() {
    // Use document-level listener with abort signal for auto-cleanup
    // Use capture: true to intercept arrow keys BEFORE they reach the search input
    document.addEventListener('keydown', (e) => this._handleKeydown(e), { signal: this.signal, capture: true });

    // Mark picker as active for keyboard when open
    const picker = this.element?.querySelector('.es-emotion-picker');
    if (picker && this.uiState.emotionPicker.open) {
      picker.classList.add('es-emotion-picker--keyboard-active');
      // Initialize focus on current active item
      const items = picker.querySelectorAll('.es-picker-item');
      const activeIndex = Array.from(items).findIndex(item => item.classList.contains('es-picker-item--active'));
      this.uiState.keyboardFocusIndex = activeIndex >= 0 ? activeIndex : 0;
      this._updateKeyboardFocus(items);

      // Add direct listener on picker search input to intercept arrow keys
      const pickerSearchInput = picker.querySelector('.es-picker-search-input');
      if (pickerSearchInput) {
        pickerSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            this._handleEmotionPickerKeyboard(e);
          }
        }, { signal: this.signal });
      }
    }
  }

  /**
   * Main keydown event handler.
   * Routes to emotion picker navigation or global shortcuts based on context.
   * @param {KeyboardEvent} e - The keyboard event
   * @private
   */
  _handleKeydown(e) {
    // Check if event is relevant to our application
    const isOurApp = this.element?.contains(document.activeElement) ||
                     document.activeElement === document.body ||
                     this.element?.contains(e.target);

    // Handle emotion picker navigation when open
    if (this.uiState.emotionPicker.open) {
      this._handleEmotionPickerKeyboard(e);
      return;
    }

    // Global shortcuts only when picker is not open
    // Only process if focus is in our application or on body
    if (!isOurApp) return;

    this._handleGlobalShortcuts(e);
  }

  /**
   * Handles keyboard navigation within the emotion picker.
   * Arrow Up/Down always navigate items (even when in search input).
   * Arrow Left/Right only navigate when not in search input.
   * @param {KeyboardEvent} e - The keyboard event
   * @private
   */
  _handleEmotionPickerKeyboard(e) {
    const picker = this.element?.querySelector('.es-emotion-picker');
    if (!picker) return;

    const items = picker.querySelectorAll('.es-picker-item:not([style*="display: none"])');
    const itemCount = items.length;
    const isInSearchInput = e.target.matches('.es-picker-search-input');

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.uiState.emotionPicker.open = false;
        this.uiState.keyboardFocusIndex = -1;
        this.render();
        break;

      case 'ArrowDown':
        // Always navigate down, even in search input
        if (itemCount === 0) break;
        e.preventDefault();
        e.stopPropagation();
        this.uiState.keyboardFocusIndex = (this.uiState.keyboardFocusIndex + 1) % itemCount;
        this._updateKeyboardFocus(items);
        break;

      case 'ArrowUp':
        // Always navigate up, even in search input
        if (itemCount === 0) break;
        e.preventDefault();
        e.stopPropagation();
        this.uiState.keyboardFocusIndex = this.uiState.keyboardFocusIndex <= 0
          ? itemCount - 1
          : this.uiState.keyboardFocusIndex - 1;
        this._updateKeyboardFocus(items);
        break;

      case 'ArrowRight':
        // Only navigate if not in search input (allow cursor movement in input)
        if (!isInSearchInput && itemCount > 0) {
          e.preventDefault();
          this.uiState.keyboardFocusIndex = (this.uiState.keyboardFocusIndex + 1) % itemCount;
          this._updateKeyboardFocus(items);
        }
        break;

      case 'ArrowLeft':
        // Only navigate if not in search input (allow cursor movement in input)
        if (!isInSearchInput && itemCount > 0) {
          e.preventDefault();
          this.uiState.keyboardFocusIndex = this.uiState.keyboardFocusIndex <= 0
            ? itemCount - 1
            : this.uiState.keyboardFocusIndex - 1;
          this._updateKeyboardFocus(items);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (this.uiState.keyboardFocusIndex >= 0 && this.uiState.keyboardFocusIndex < itemCount) {
          const selectedItem = items[this.uiState.keyboardFocusIndex];
          const state = selectedItem.dataset.state;
          this._selectEmotionByState(state);
        }
        break;
    }
  }

  /**
   * Handles global keyboard shortcuts when emotion picker is closed.
   * @param {KeyboardEvent} e - The keyboard event
   * @private
   */
  _handleGlobalShortcuts(e) {
    switch (e.key) {
      case 'Escape':
        // Close sort menu first, then inspector
        if (this.uiState.sortMenuOpen) {
          e.preventDefault();
          this.uiState.sortMenuOpen = false;
          this.render();
        } else if (this.uiState.inspectorOpen) {
          e.preventDefault();
          this.uiState.inspectorOpen = false;
          this.render();
        }
        break;

      case '/':
        // Focus search (only if not in input)
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          const searchInput = this.element?.querySelector('.es-search-input');
          if (searchInput) searchInput.focus();
        }
        break;

      case 'f':
      case 'F':
        // Toggle favorite (only if not in input and has selection)
        if (!e.target.matches('input, textarea') && this.uiState.selectedId) {
          e.preventDefault();
          this._toggleSelectedFavorite();
        }
        break;
    }
  }

  /**
   * Updates the visual keyboard focus indicator on picker items.
   * @param {NodeList} items - The picker item elements
   * @private
   */
  _updateKeyboardFocus(items) {
    items.forEach((item, index) => {
      item.classList.toggle('es-picker-item--keyboard-focus', index === this.uiState.keyboardFocusIndex);
    });
    // Scroll to focused item
    if (items[this.uiState.keyboardFocusIndex]) {
      items[this.uiState.keyboardFocusIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Selects an emotion by state key and broadcasts the update.
   * @param {string} state - The emotion state key to select
   * @private
   */
  _selectEmotionByState(state) {
    const charId = this.uiState.emotionPicker.characterId;
    const character = Store.characters.get(charId);

    if (character) {
      character.currentState = state;
      Store.saveData();
      SocketHandler.emitUpdateEmotion(charId, state);
      ui.notifications.info(format('Notifications.EmotionUpdated', { name: character.name, state }));
    }

    this.uiState.emotionPicker.open = false;
    this.uiState.keyboardFocusIndex = -1;
    this.render();
  }

  /**
   * Toggles favorite status for the currently selected item.
   * @private
   */
  _toggleSelectedFavorite() {
    if (!this.uiState.selectedId) return;

    const isScene = this.uiState.currentView.startsWith('scenes');
    const item = isScene
      ? Store.scenes.get(this.uiState.selectedId)
      : Store.characters.get(this.uiState.selectedId);

    if (item) {
      item.favorite = !item.favorite;
      Store.saveData();
      const type = isScene ? localize('Nav.Scenes') : localize('Nav.Characters');
      const action = item.favorite ? 'added to' : 'removed from';
      ui.notifications.info(format('Notifications.FavoritesToggle', { type, action }));
      this.render();
    }
  }
}
