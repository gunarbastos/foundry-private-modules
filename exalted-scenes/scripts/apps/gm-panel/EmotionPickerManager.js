/**
 * @file EmotionPickerManager.js
 * @description Manages the emotion picker component for the GMPanel.
 * Handles search filtering, hover preview, emotion selection, and favorites.
 *
 * @module gm-panel/EmotionPickerManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SocketHandler } from '../../data/SocketHandler.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Manages the emotion picker in the GMPanel.
 * @extends BaseManager
 */
export class EmotionPickerManager extends BaseManager {
  /**
   * Creates a new EmotionPickerManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);
  }

  /**
   * Sets up emotion picker event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupEmotionPickerBehavior();
  }

  /* ═══════════════════════════════════════════════════════════════
     SETUP METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the emotion picker search and hover preview functionality.
   * @private
   */
  _setupEmotionPickerBehavior() {
    const emotionPicker = this.element?.querySelector('.es-emotion-picker');
    if (!emotionPicker) return;

    this._setupSearchInput(emotionPicker);
    this._setupHoverPreview(emotionPicker);
  }

  /**
   * Sets up the search input filtering for emotions.
   * @param {HTMLElement} emotionPicker - The emotion picker element
   * @private
   */
  _setupSearchInput(emotionPicker) {
    const searchInput = emotionPicker.querySelector('.es-picker-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const items = emotionPicker.querySelectorAll('.es-picker-item');
      items.forEach(item => {
        const emotionKey = item.dataset.state.toLowerCase();
        item.style.display = emotionKey.includes(query) ? '' : 'none';
      });
    }, { signal: this.signal });

    // Focus on the search input when picker opens
    setTimeout(() => searchInput.focus(), 50);
  }

  /**
   * Sets up hover preview for emotion items.
   * Shows a larger preview of the emotion image when hovering over items.
   * @param {HTMLElement} emotionPicker - The emotion picker element
   * @private
   */
  _setupHoverPreview(emotionPicker) {
    const previewPanel = emotionPicker.querySelector('.es-picker-preview');
    const previewImg = previewPanel?.querySelector('img');
    const previewLabel = previewPanel?.querySelector('.es-picker-preview-label');
    const items = emotionPicker.querySelectorAll('.es-picker-item');

    if (!previewPanel || !previewImg || !previewLabel) return;

    // Known preview dimensions (from CSS)
    const PREVIEW_WIDTH = 340;
    const PREVIEW_HEIGHT = 370;
    const MARGIN = 20; // margin from screen edges

    items.forEach(item => {
      item.addEventListener('mouseenter', (e) => {
        const path = item.dataset.path;
        const state = item.dataset.state;
        previewImg.src = path;
        previewLabel.textContent = state;

        const pickerRect = emotionPicker.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left, top;

        // Position preview ABOVE the picker
        const spaceAbove = pickerRect.top - MARGIN;

        // Horizontal: center above the picker
        left = pickerRect.left + (pickerRect.width / 2) - (PREVIEW_WIDTH / 2);

        // Clamp horizontal position to viewport bounds
        left = Math.max(MARGIN, Math.min(left, viewportWidth - PREVIEW_WIDTH - MARGIN));

        // Reset position classes
        previewPanel.classList.remove('preview-left', 'preview-below');

        if (spaceAbove >= PREVIEW_HEIGHT) {
          // Fits above the picker
          top = pickerRect.top - PREVIEW_HEIGHT - 16;
          previewPanel.classList.add('preview-above');
        } else {
          // Not enough space above, place below the picker
          top = pickerRect.bottom + 16;
          previewPanel.classList.remove('preview-above');
          previewPanel.classList.add('preview-below');
        }

        // Clamp vertical position to viewport bounds
        top = Math.max(MARGIN, Math.min(top, viewportHeight - PREVIEW_HEIGHT - MARGIN));

        previewPanel.style.left = `${left}px`;
        previewPanel.style.top = `${top}px`;
        previewPanel.style.display = 'block';
      }, { signal: this.signal });

      item.addEventListener('mouseleave', (e) => {
        previewPanel.style.display = 'none';
      }, { signal: this.signal });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Selects an emotion for a character.
   * Updates the character's current state and broadcasts the change.
   * @param {HTMLElement} target - The emotion item element
   */
  handleSelectEmotion(target) {
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);

    if (character) {
      character.currentState = state;
      Store.saveData();

      // Broadcast update to players
      SocketHandler.emitUpdateEmotion(charId, state);

      ui.notifications.info(format('Notifications.EmotionUpdated', { name: character.name, state }));
    }

    this.uiState.emotionPicker.open = false;
    this.render();
  }

  /**
   * Closes the emotion picker.
   */
  handleClosePicker() {
    this.uiState.emotionPicker.open = false;
    this.render();
  }

  /**
   * Cycles through emotions (legacy method).
   * Kept for backwards compatibility or double-click quick cycling.
   * @param {HTMLElement} target - The element with character data
   */
  handleChangeEmotion(target) {
    const charId = target.dataset.characterId;
    const character = Store.characters.get(charId);

    if (!character) return;

    // Cycle through states
    const states = Object.keys(character.states);
    const currentIndex = states.indexOf(character.currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];

    // Update Local Store
    character.currentState = nextState;
    Store.saveData();

    // Broadcast Update
    SocketHandler.emitUpdateEmotion(charId, nextState);

    // Refresh UI to show new state
    this.render();

    ui.notifications.info(format('Notifications.EmotionUpdated', { name: character.name, state: nextState }));
  }

  /**
   * Toggles an emotion as favorite for the character.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The favorite toggle element
   */
  handleToggleEmotionFavorite(event, target) {
    event.stopPropagation();
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);

    if (character && state) {
      if (character.favoriteEmotions.has(state)) {
        character.favoriteEmotions.delete(state);
      } else {
        character.favoriteEmotions.add(state);
      }
      Store.saveData();
      this.render();
    }
  }

  /**
   * Opens the linked Actor's character sheet.
   */
  handleOpenActorSheet() {
    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    if (!character?.actorId) return;

    const actor = game.actors.get(character.actorId);
    if (actor) {
      actor.sheet.render(true);
    } else {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
    }
  }
}
