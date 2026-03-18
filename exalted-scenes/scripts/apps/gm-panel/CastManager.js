/**
 * @file CastManager.js
 * @description Manages cast member interactions for the GMPanel.
 * Handles adding/removing cast members, cast click for emotion picker,
 * and the floating cast strip functionality.
 *
 * @module gm-panel/CastManager
 */

import { BaseManager } from './BaseManager.js';
import { AddToCastBrowser } from '../AddToCastBrowser.js';
import { Store } from '../../data/Store.js';
import { localize, format } from '../../utils/i18n.js';
import { buildPopoverAnchorFromElement, clonePopoverAnchor } from '../../utils/popover-position.js';

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

  /**
   * Gets the currently browsed character folder, if any.
   * @returns {import('../../data/FolderModel.js').FolderModel|null}
   * @private
   */
  _getCurrentCharacterFolder() {
    if (!this.uiState.currentView?.startsWith('characters')) return null;
    if (!this.uiState.currentFolderId) return null;

    const folder = Store.folders.get(this.uiState.currentFolderId);
    return folder?.type === 'character' ? folder : null;
  }

  /**
   * Gets characters that can still be added to the scene.
   * @param {import('../../data/SceneModel.js').SceneModel} scene
   * @returns {Array}
   * @private
   */
  _getAvailableCharacters(scene) {
    const currentCastIds = new Set(scene.cast.map(c => c.id));
    return Store.characters.contents
      .filter(c => !currentCastIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Gets folders that contain addable characters for a scene.
   * @param {import('../../data/SceneModel.js').SceneModel} scene
   * @returns {Array<{id: string, label: string, addableCount: number, selected: boolean}>}
   * @private
   */
  _getAvailableCharacterFolders(scene) {
    const currentCastIds = new Set(scene.cast.map(c => c.id));
    const currentFolder = this._getCurrentCharacterFolder();

    return Store.folders.contents
      .filter(folder => folder.type === 'character')
      .map(folder => {
        const folderPath = Store.getFolderPath(folder.id).map(node => node.name).join(' / ') || folder.name;
        const addableCount = Store.getItemsInFolderTree('character', folder.id)
          .filter(character => !currentCastIds.has(character.id))
          .length;

        return {
          id: folder.id,
          label: folderPath,
          addableCount,
          selected: folder.id === currentFolder?.id
        };
      })
      .filter(folder => folder.addableCount > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Adds all characters from a folder tree to a scene's cast.
   * @param {string} sceneId - Scene ID
   * @param {string} folderId - Character folder ID
   * @returns {{added: string[], skipped: string[], missing: string[]}|null}
   * @private
   */
  _addFolderToScene(sceneId, folderId) {
    const scene = Store.scenes.get(sceneId);
    const folder = Store.folders.get(folderId);

    if (!scene || !folder || folder.type !== 'character') {
      return null;
    }

    const folderCharacters = Store.getItemsInFolderTree('character', folderId);
    if (!folderCharacters.length) {
      ui.notifications.warn(localize('Notifications.WarnFolderHasNoCharacters'));
      return null;
    }

    const folderPath = Store.getFolderPath(folderId).map(node => node.name).join(' / ') || folder.name;
    const result = Store.addCastMembers(sceneId, folderCharacters.map(character => character.id));

    if (!result.added.length) {
      ui.notifications.warn(format('Notifications.WarnNoCharactersAddedFromFolder', { folder: folderPath }));
      return result;
    }

    this._lastAddedCharId = result.added[result.added.length - 1];
    this.render();

    if (result.skipped.length) {
      ui.notifications.info(format('Notifications.CharactersAddedFromFolderWithSkipped', {
        added: result.added.length,
        skipped: result.skipped.length,
        folder: folderPath
      }));
    } else {
      ui.notifications.info(format('Notifications.CharactersAddedFromFolder', {
        added: result.added.length,
        folder: folderPath
      }));
    }

    return result;
  }

  /**
   * Builds the character payload consumed by the add-to-cast browser.
   * @param {Array<import('../../data/CharacterModel.js').CharacterModel>} characters
   * @returns {Array<Object>}
   * @private
   */
  _buildCharacterBrowserItems(characters) {
    return characters.map(character => {
      const folderPathNodes = character.folder ? Store.getFolderPath(character.folder) : [];
      const folderIds = folderPathNodes.map(node => node.id);
      const folderPath = folderPathNodes.map(node => node.name).join(' / ');
      const folderName = folderPathNodes.length ? folderPathNodes[folderPathNodes.length - 1].name : '';
      const tags = Array.from(character.tags || []);
      const heroCount = Object.keys(character.heroStates || {}).length;
      const stateEntries = Object.values(character.states || {});
      const image = character.thumbnail
        || character.image
        || (character.currentState ? character.states?.[character.currentState] : null)
        || character.states?.normal
        || stateEntries[0]
        || 'icons/svg/mystery-man.svg';

      return {
        id: character.id,
        name: character.name,
        image,
        currentState: character.currentState || '',
        emotionCount: Object.keys(character.states || {}).length,
        heroCount,
        folderIds,
        folderName,
        folderPath,
        searchText: [
          character.name,
          character.currentState,
          folderPath,
          ...tags
        ].filter(Boolean).join(' ').toLowerCase()
      };
    });
  }

  /**
   * Builds the folder payload consumed by the add-to-cast browser.
   * @param {Array<{id: string, label: string, addableCount: number, selected: boolean}>} folders
   * @returns {Array<Object>}
   * @private
   */
  _buildFolderBrowserItems(folders) {
    return folders.map(folder => ({
      ...folder,
      countLabel: folder.addableCount === 1
        ? format('GMPanel.CountCharacters', { count: folder.addableCount })
        : format('GMPanel.CountCharactersPlural', { count: folder.addableCount }),
      searchText: `${folder.label} ${folder.addableCount}`.toLowerCase()
    }));
  }

  /**
   * Opens the shared add-to-cast dialog for a scene.
   * @param {string} sceneId - Scene ID
   * @returns {void}
   * @private
   */
  _openAddCastDialog(sceneId) {
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    const availableChars = this._getAvailableCharacters(scene);
    const availableFolders = this._getAvailableCharacterFolders(scene);

    if (!availableChars.length && !availableFolders.length) {
      ui.notifications.warn(localize('Notifications.WarnNoAvailableCharacters'));
      return;
    }

    const browser = new AddToCastBrowser({
      sceneId,
      sceneName: scene.name,
      characters: this._buildCharacterBrowserItems(availableChars),
      folders: this._buildFolderBrowserItems(availableFolders),
      initialTab: availableChars.length ? 'characters' : 'folders',
      onAddCharacter: (characterId) => {
        const added = Store.addCastMember(sceneId, characterId);
        if (!added) {
          ui.notifications.warn(localize('Notifications.CharacterAlreadyInCast'));
          return false;
        }

        this._lastAddedCharId = characterId;
        this.render();
        return { addedCharacterIds: [characterId] };
      },
      onAddFolder: (folderId) => {
        const result = this._addFolderToScene(sceneId, folderId);
        if (!result) return false;
        return { addedCharacterIds: result.added };
      }
    });

    browser.render(true);
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
    this._openAddCastDialog(sceneId);
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
    const anchor = buildPopoverAnchorFromElement(target);
    const pickerBelow = anchor?.preferBelow ?? false;

    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: anchor?.anchorX ?? 0,
      y: pickerBelow ? (anchor?.anchorBelowY ?? 0) : (anchor?.anchorAboveY ?? 0),
      pickerBelow: pickerBelow,
      anchor: clonePopoverAnchor(anchor)
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
    this._openAddCastDialog(sceneId);
  }

  /**
   * Adds the currently browsed character folder to a scene's cast.
   * @param {string|null} [sceneId=null] - Optional scene override
   */
  handleAddCurrentFolderToCast(sceneId = null) {
    const targetSceneId = sceneId || this.uiState.editingSceneId || this.uiState.selectedId;
    const folder = this._getCurrentCharacterFolder();

    if (!targetSceneId) return;

    if (!folder) {
      ui.notifications.warn(localize('Notifications.WarnNoCharacterFolderSelected'));
      return;
    }

    this._addFolderToScene(targetSceneId, folder.id);
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
