/**
 * @file FolderModel.js
 * @description Data model for folders in the Exalted Scenes module.
 * Folders organize scenes and characters into a hierarchical structure.
 *
 * @module data/FolderModel
 */

/**
 * Data model representing a folder for organizing scenes or characters.
 * Supports hierarchical nesting via parent references.
 *
 * @class FolderModel
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} type - Content type ('scene' or 'character')
 * @property {string|null} parent - Parent folder ID (null for root)
 * @property {string|null} color - CSS color value for folder icon
 * @property {string} sorting - Sort mode ('a' = alphabetical, 'm' = manual)
 * @property {number} sort - Manual sort order value
 * @property {boolean} expanded - Whether folder is expanded in UI
 */
export class FolderModel {
  /**
   * Creates a new FolderModel instance.
   * @param {Object} data - Folder data
   * @param {string} [data.id] - Unique identifier (auto-generated if not provided)
   * @param {string} [data.name='New Folder'] - Display name
   * @param {string} [data.type='scene'] - Content type ('scene' or 'character')
   * @param {string|null} [data.parent=null] - Parent folder ID
   * @param {string|null} [data.color=null] - CSS color value
   * @param {string} [data.sorting='a'] - Sort mode
   * @param {number} [data.sort=0] - Manual sort order
   * @param {boolean} [data.expanded=true] - Expanded state
   */
  constructor(data = {}) {
    this.id = data.id || foundry.utils.randomID();
    this.name = data.name || 'New Folder';
    this.type = data.type || 'scene'; // 'scene' or 'character'
    this.parent = data.parent || null; // ID of parent folder, null = root
    this.color = data.color || null;
    this.sorting = data.sorting || 'a'; // 'a' = alphabetical, 'm' = manual
    this.sort = data.sort || 0; // Manual sort order
    this.expanded = data.expanded !== false; // Default expanded
  }

  /**
   * Serializes the folder to a plain object for storage.
   * @returns {Object} Plain object representation of the folder
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      parent: this.parent,
      color: this.color,
      sorting: this.sorting,
      sort: this.sort,
      expanded: this.expanded
    };
  }
}
