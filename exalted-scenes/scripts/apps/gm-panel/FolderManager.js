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
    this.uiState.selectedId = null;
    this.uiState.inspectorOpen = false;
    this.render();
  }

  /**
   * Navigates up to the parent folder or root.
   */
  handleNavigateUp() {
    const currentFolder = Store.folders.get(this.uiState.currentFolderId);
    this.uiState.currentFolderId = currentFolder?.parent || null;
    this.uiState.selectedId = null;
    this.uiState.inspectorOpen = false;
    this.render();
  }

  /**
   * Shows a dialog to create a new folder in the current location.
   * Creates folder in the active tab's type (scene or character).
   */
  async handleCreateFolder() {
    const activeTab = this.uiState.currentView.startsWith('scenes') ? 'scenes' : 'characters';
    const itemType = activeTab === 'scenes' ? 'scene' : 'character';

    const content = `
      <form>
        <div class="form-group">
          <label>${localize('Dialog.FolderName')}</label>
          <input type="text" name="name" value="New Folder" autofocus>
        </div>
      </form>
    `;

    new Dialog({
      title: localize('Dialog.CreateFolder.Title'),
      content: content,
      buttons: {
        create: {
          label: localize('Common.Create'),
          callback: (html) => {
            const name = html.find('[name="name"]').val() || "New Folder";
            Store.createFolder({
              name: name,
              type: itemType,
              parent: this.uiState.currentFolderId
            });
            this.render();
          }
        },
        cancel: { label: localize('Common.Cancel') }
      },
      default: "create"
    }).render(true);
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

    new Dialog({
      title: format('Dialog.DeleteFolder.Title', { name: folder.name.replace(/"/g, '&quot;') }),
      content: localize('Dialog.DeleteFolder.Content'),
      buttons: {
        move: {
          label: localize('Dialog.DeleteFolder.MoveToRoot'),
          callback: () => {
            Store.deleteFolder(folderId, false);
            if (this.uiState.currentFolderId === folderId) {
              this.uiState.currentFolderId = null;
            }
            this.render();
          }
        },
        delete: {
          label: localize('Dialog.DeleteFolder.DeleteAll'),
          callback: () => {
            Store.deleteFolder(folderId, true);
            if (this.uiState.currentFolderId === folderId) {
              this.uiState.currentFolderId = null;
            }
            this.render();
          }
        },
        cancel: { label: localize('Common.Cancel') }
      },
      default: "move"
    }).render(true);
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

    const content = `
      <form>
        <div class="form-group">
          <label>${localize('Dialog.FolderName')}</label>
          <input type="text" name="name" value="${folder.name.replace(/"/g, '&quot;')}" autofocus>
        </div>
      </form>
    `;

    new Dialog({
      title: localize('Dialog.RenameFolder.Title'),
      content: content,
      buttons: {
        rename: {
          label: localize('Common.Rename'),
          callback: (html) => {
            const name = html.find('[name="name"]').val() || folder.name;
            Store.updateFolder(folderId, { name });
            this.render();
          }
        },
        cancel: { label: localize('Common.Cancel') }
      },
      default: "rename"
    }).render(true);
  }
}
