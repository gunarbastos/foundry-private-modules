/**
 * @file CastManager.js
 * @description Manages cast member interactions for the GMPanel.
 * Handles adding/removing cast members, cast click for emotion picker,
 * and the floating cast strip functionality.
 *
 * @module gm-panel/CastManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SocketHandler } from '../../data/SocketHandler.js';
import { localize } from '../../utils/i18n.js';

/**
 * Escapes HTML special characters to prevent injection.
 * @param {string} str - The string to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Manages cast member interactions in the GMPanel.
 * @extends BaseManager
 */
export class CastManager extends BaseManager {
  /**
   * Creates a new CastManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);

    /** @type {string|null} - ID of the last added character (for animation) */
    this._lastAddedCharId = null;
  }

  /**
   * Sets up cast-related event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupSuccessAnimation();
  }

  /**
   * Applies success animation to the last added character.
   * @private
   */
  _setupSuccessAnimation() {
    if (this._lastAddedCharId) {
      const newMember = this.element?.querySelector(
        `.es-cast-member[data-character-id="${this._lastAddedCharId}"]`
      );
      if (newMember) {
        newMember.classList.add('es-just-added');
        setTimeout(() => newMember.classList.remove('es-just-added'), 800);
      }
      this._lastAddedCharId = null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens a dialog to add a character to the scene's cast.
   * Uses the currently selected scene from uiState.
   * @returns {Promise<void>}
   */
  async handleAddCast() {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    // Get available characters not already in cast
    const currentCastIds = new Set(scene.cast.map(c => c.id));
    const availableChars = Store.characters.contents.filter(c => !currentCastIds.has(c.id));

    if (availableChars.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnNoAvailableCharacters'));
      return;
    }

    // Simple Dialog to select character
    const content = `
      <form>
        <div class="form-group">
          <label>${localize('Dialog.AddToCast.Label')}</label>
          <select name="characterId">
            ${availableChars.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: localize('Dialog.AddToCast.Title'),
      content: content,
      buttons: {
        add: {
          label: localize('Dialog.AddToCast.Add'),
          callback: (html) => {
            const charId = html.find('[name="characterId"]').val();
            Store.addCastMember(sceneId, charId);
            this._lastAddedCharId = charId;
            this.render();
          }
        }
      }
    }).render(true);
  }

  /**
   * Removes a character from the scene's cast.
   * Uses the character from the currently open emotion picker.
   */
  handleRemoveCast() {
    const charId = this.uiState.emotionPicker.characterId;
    // Use editingSceneId if available (from floating cast), otherwise selectedId
    const sceneId = this.uiState.editingSceneId || this.uiState.selectedId;

    if (charId && sceneId) {
      Store.removeCastMember(sceneId, charId);
      this.uiState.emotionPicker.open = false;
      this.render();
      ui.notifications.info(localize('Notifications.CharacterRemovedFromScene'));
    }
  }

  /**
   * Opens the emotion picker for a cast member.
   * @param {HTMLElement} target - The clicked cast member element
   */
  handleCastClick(target) {
    const charId = target.dataset.characterId;
    const rect = target.getBoundingClientRect();

    // Calculate position relative to the window
    // We want it above the cast member, but ensure it stays within viewport
    const PICKER_WIDTH = 320;  // Approximate picker width
    const PICKER_HEIGHT = 400; // Approximate picker height
    const MARGIN = 20;         // Margin from screen edges

    let x = rect.left + (rect.width / 2);
    let y = rect.top - 10; // Default: above the cast member

    // Adjust horizontal position to stay within viewport
    const viewportWidth = window.innerWidth;
    if (x - (PICKER_WIDTH / 2) < MARGIN) {
      x = MARGIN + (PICKER_WIDTH / 2);
    } else if (x + (PICKER_WIDTH / 2) > viewportWidth - MARGIN) {
      x = viewportWidth - MARGIN - (PICKER_WIDTH / 2);
    }

    // Adjust vertical position - show below if not enough space above
    if (y - PICKER_HEIGHT < MARGIN) {
      y = rect.bottom + 10; // Show below instead
    }

    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y
    };
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     FLOATING CAST STRIP ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Navigates to a scene in the inspector.
   * @param {HTMLElement} target - The element with scene data
   */
  handleGoToScene(target) {
    const sceneId = target.dataset.sceneId || this.uiState.editingSceneId;
    if (sceneId) {
      this.uiState.currentView = 'scenes-all';
      this.uiState.selectedId = sceneId;
      this.uiState.inspectorOpen = true;
      this.uiState.currentFolderId = null;
      this.render();
    }
  }

  /**
   * Closes the floating cast strip.
   */
  handleCloseFloatingCast() {
    this.uiState.editingSceneId = null;
    this.render();
  }

  /**
   * Opens a dialog to add a character to the cast via the floating strip.
   * Uses the editingSceneId from uiState.
   * @returns {Promise<void>}
   */
  async handleFloatingAddCast() {
    const sceneId = this.uiState.editingSceneId;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    // Get available characters not already in cast
    const currentCastIds = new Set(scene.cast.map(c => c.id));
    const availableChars = Store.characters.contents.filter(c => !currentCastIds.has(c.id));

    if (availableChars.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnNoAvailableCharacters'));
      return;
    }

    // Simple Dialog to select character
    const content = `
      <form>
        <div class="form-group">
          <label>${localize('Dialog.AddToCast.Label')}</label>
          <select name="characterId">
            ${availableChars.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: localize('Dialog.AddToCast.Title'),
      content: content,
      buttons: {
        add: {
          label: localize('Dialog.AddToCast.Add'),
          callback: (html) => {
            const charId = html.find('[name="characterId"]').val();
            Store.addCastMember(sceneId, charId);
            this._lastAddedCharId = charId;
            this.render();
          }
        }
      }
    }).render(true);
  }

  /**
   * Gets the last added character ID (for animation tracking).
   * @returns {string|null}
   */
  get lastAddedCharId() {
    return this._lastAddedCharId;
  }

  /**
   * Sets the last added character ID.
   * @param {string|null} id - The character ID
   */
  set lastAddedCharId(id) {
    this._lastAddedCharId = id;
  }
}
