/**
 * @file FolderService.js
 * @description Service for folder CRUD operations and navigation.
 * Handles all folder-related data operations including hierarchical navigation.
 *
 * @module data/store/FolderService
 */

import { BaseService } from './BaseService.js';
import { FolderModel } from '../FolderModel.js';

/**
 * Service for managing folders and their hierarchical structure.
 * Provides CRUD operations for folders and methods for navigation.
 *
 * @extends BaseService
 */
export class FolderService extends BaseService {
  /**
   * Creates a new FolderService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     FOLDER QUERIES
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get folders filtered by type and parent.
   *
   * @param {string} type - Folder type ('scene' or 'character')
   * @param {string|null} [parentId=null] - Parent folder ID, null for root folders
   * @returns {FolderModel[]} Array of matching folders
   */
  getFolders(type, parentId = null) {
    return this.folders.filter(f => f.type === type && f.parent === parentId);
  }

  /**
   * Get the full path from root to a specific folder.
   *
   * @param {string} folderId - Folder ID
   * @returns {FolderModel[]} Array of folders from root to target (inclusive)
   */
  getFolderPath(folderId) {
    const path = [];
    let current = this.folders.get(folderId);
    while (current) {
      path.unshift(current);
      current = current.parent ? this.folders.get(current.parent) : null;
    }
    return path;
  }

  /**
   * Get all items (scenes or characters) in a specific folder.
   *
   * @param {string} type - Item type ('scene' or 'character')
   * @param {string|null} folderId - Folder ID, null for root items
   * @returns {Array} Array of items in the folder
   */
  getItemsInFolder(type, folderId) {
    if (type === 'scene') {
      return this.scenes.filter(s => s.folder === folderId);
    } else {
      return this.characters.filter(c => c.folder === folderId);
    }
  }

  /**
   * Get all subfolders recursively.
   *
   * @param {string} parentId - Parent folder ID
   * @returns {string[]} Array of all subfolder IDs (recursive)
   */
  getAllSubfolders(parentId) {
    const subfolders = this.folders.filter(f => f.parent === parentId);
    let allIds = subfolders.map(f => f.id);
    subfolders.forEach(sf => {
      allIds = allIds.concat(this.getAllSubfolders(sf.id));
    });
    return allIds;
  }

  /* ═══════════════════════════════════════════════════════════════
     FOLDER CRUD
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Create a new folder.
   *
   * @param {Object} data - Folder data
   * @param {string} data.name - Folder name
   * @param {string} data.type - Folder type ('scene' or 'character')
   * @param {string|null} [data.parent] - Parent folder ID
   * @param {string} [data.color] - Folder color
   * @returns {FolderModel} The created folder
   */
  createFolder(data) {
    const folder = new FolderModel(data);
    this.folders.set(folder.id, folder);
    this.saveData();
    return folder;
  }

  /**
   * Update an existing folder.
   *
   * @param {string} id - Folder ID
   * @param {Object} data - Data to update
   * @returns {FolderModel|undefined} The updated folder or undefined if not found
   */
  updateFolder(id, data) {
    const folder = this.folders.get(id);
    if (folder) {
      Object.assign(folder, data);
      this.saveData();
    }
    return folder;
  }

  /**
   * Delete a folder and optionally its contents.
   *
   * @param {string} id - Folder ID to delete
   * @param {boolean} [deleteContents=false] - If true, delete items in folder; if false, move to root
   */
  deleteFolder(id, deleteContents = false) {
    const folder = this.folders.get(id);
    if (!folder) return;

    // Get all subfolders recursively
    const folderIds = [id, ...this.getAllSubfolders(id)];

    if (deleteContents) {
      // Delete all items in these folders
      if (folder.type === 'scene') {
        this.scenes.filter(s => folderIds.includes(s.folder)).forEach(s => {
          this.scenes.delete(s.id);
        });
      } else {
        this.characters.filter(c => folderIds.includes(c.folder)).forEach(c => {
          this.characters.delete(c.id);
        });
      }
    } else {
      // Move items to root (null folder)
      if (folder.type === 'scene') {
        this.scenes.filter(s => folderIds.includes(s.folder)).forEach(s => {
          s.folder = null;
        });
      } else {
        this.characters.filter(c => folderIds.includes(c.folder)).forEach(c => {
          c.folder = null;
        });
      }
    }

    // Delete all subfolders and the folder itself
    folderIds.forEach(fid => this.folders.delete(fid));
    this.saveData();
  }

  /* ═══════════════════════════════════════════════════════════════
     FOLDER STATE OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Toggle the expanded/collapsed state of a folder.
   *
   * @param {string} id - Folder ID
   * @returns {boolean|undefined} New expanded state, or undefined if not found
   */
  toggleFolderExpanded(id) {
    const folder = this.folders.get(id);
    if (folder) {
      folder.expanded = !folder.expanded;
      this.saveData();
      return folder.expanded;
    }
    return undefined;
  }

  /**
   * Move an item (scene or character) to a folder.
   *
   * @param {string} itemId - Item ID to move
   * @param {string} itemType - Item type ('scene' or 'character')
   * @param {string|null} folderId - Target folder ID, null for root
   * @returns {boolean} True if moved, false if item not found
   */
  moveItemToFolder(itemId, itemType, folderId) {
    if (itemType === 'scene') {
      const scene = this.scenes.get(itemId);
      if (scene) {
        scene.folder = folderId;
        this.saveData();
        return true;
      }
    } else {
      const char = this.characters.get(itemId);
      if (char) {
        char.folder = folderId;
        this.saveData();
        return true;
      }
    }
    return false;
  }
}
