/**
 * @file FolderManager.js
 * @description Manages folder navigation, CRUD operations, and color customization for the GMPanel.
 * Handles opening folders, breadcrumb navigation, creating/renaming/deleting folders, and folder color changes.
 *
 * @module gm-panel/FolderManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { localize, format } from '../../utils/i18n.js';
import { ExaltedScenesDialog } from '../ThemedDialog.js';

/**
 * Manages folder operations in the GMPanel.
 * @extends BaseManager
 */
export class FolderManager extends BaseManager {
  /**
   * Creates a new FolderManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);
  }

  /**
   * Sets up folder-related event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);
    this._setupFolderColorPicker();
  }

  /* ═══════════════════════════════════════════════════════════════
     SETUP METHODS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up the color picker input for folder customization.
   * Prevents click propagation, updates visual feedback in real-time,
   * and saves color changes to the Store.
   * @private
   */
  _setupFolderColorPicker() {
    const colorInputs = this.element?.querySelectorAll('input[type="color"][data-action="change-folder-color"]');
    if (!colorInputs) return;

    colorInputs.forEach(input => {
      // Prevent click from opening the folder
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      }, { signal: this.signal });

      // Update color visually in real-time
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        const folderEl = e.target.closest('[data-folder-id]');
        if (!folderEl) return;
        const color = e.target.value;

        // Update visual appearance
        const folderCard = e.target.closest('.es-folder-card');
        if (folderCard) {
          folderCard.style.setProperty('--folder-color', color);
          folderCard.dataset.color = color;
        }
      }, { signal: this.signal });

      // Save color when picker closes
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const folderEl = e.target.closest('[data-folder-id]');
        if (!folderEl) return;
        const folderId = folderEl.dataset.folderId;
        const color = e.target.value;
        Store.updateFolder(folderId, { color });
      }, { signal: this.signal });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens a folder and navigates into it.
   * @param {HTMLElement} target - The element with folder-id data attribute
   */
  handleOpenFolder(target) {
    const folderId = target.dataset.folderId;
    this.uiState.currentFolderId = folderId;
    this.panel.clearCardSelection();
    this.render();
  }

  /**
   * Navigates up to the parent folder or root.
   */
  handleNavigateUp() {
    const currentFolder = Store.folders.get(this.uiState.currentFolderId);
    this.uiState.currentFolderId = currentFolder?.parent || null;
    this.panel.clearCardSelection();
    this.render();
  }

  /**
   * Shows a dialog to create a new folder in the current location.
   * Creates folder in the active tab's type (scene or character).
   */
  async handleCreateFolder() {
    const activeTab = this.uiState.currentView.startsWith('scenes') ? 'scenes' : 'characters';
    const itemType = activeTab === 'scenes' ? 'scene' : 'character';

    const name = await ExaltedScenesDialog.promptText({
      title: localize('Dialog.CreateFolder.Title'),
      label: localize('Dialog.FolderName'),
      value: 'New Folder',
      submitAction: 'create',
      submitLabel: localize('Common.Create'),
      submitVariant: 'primary',
      tone: 'info'
    });

    if (name === null) return;

    Store.createFolder({
      name: name || 'New Folder',
      type: itemType,
      parent: this.uiState.currentFolderId
    });
    this.render();
  }

  /**
   * Toggles a folder's expanded state.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The toggle element
   */
  handleToggleFolder(event, target) {
    event.stopPropagation();
    const folderEl = target.closest('[data-folder-id]');
    if (!folderEl) return;
    Store.toggleFolderExpanded(folderEl.dataset.folderId);
    this.render();
  }

  /**
   * Shows a dialog to delete a folder with options.
   * User can choose to move contents to root or delete all contents.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The delete button element
   */
  async handleDeleteFolder(event, target) {
    event.stopPropagation();
    const folderEl = target.closest('[data-folder-id]');
    if (!folderEl) return;
    const folderId = folderEl.dataset.folderId;
    const folder = Store.folders.get(folderId);
    if (!folder) return;

    const result = await ExaltedScenesDialog.show({
      title: format('Dialog.DeleteFolder.Title', { name: folder.name }),
      content: localize('Dialog.DeleteFolder.Content'),
      tone: 'danger',
      defaultAction: 'move',
      buttons: [
        {
          id: 'cancel',
          label: localize('Common.Cancel'),
          variant: 'secondary'
        },
        {
          id: 'move',
          label: localize('Dialog.DeleteFolder.MoveToRoot'),
          variant: 'secondary'
        },
        {
          id: 'delete',
          label: localize('Dialog.DeleteFolder.DeleteAll'),
          variant: 'danger'
        }
      ]
    });

    if (!result || result.action === 'cancel') return;

    Store.deleteFolder(folderId, result.action === 'delete');
    if (this.uiState.currentFolderId === folderId) {
      this.uiState.currentFolderId = null;
    }
    this.render();
  }

  /**
   * Shows a dialog to rename a folder.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The rename button element
   */
  async handleRenameFolder(event, target) {
    event.stopPropagation();
    const folderEl = target.closest('[data-folder-id]');
    if (!folderEl) return;
    const folderId = folderEl.dataset.folderId;
    const folder = Store.folders.get(folderId);
    if (!folder) return;

    const name = await ExaltedScenesDialog.promptText({
      title: localize('Dialog.RenameFolder.Title'),
      label: localize('Dialog.FolderName'),
      value: folder.name,
      submitAction: 'rename',
      submitLabel: localize('Common.Rename'),
      submitVariant: 'primary',
      tone: 'info'
    });

    if (name === null) return;

    Store.updateFolder(folderId, { name: name || folder.name });
    this.render();
  }
}
