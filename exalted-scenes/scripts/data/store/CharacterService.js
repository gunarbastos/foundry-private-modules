/**
 * @file CharacterService.js
 * @description Service for character CRUD operations and tag management.
 * Handles all character-related data operations.
 *
 * @module data/store/CharacterService
 */

import { BaseService } from './BaseService.js';
import { CharacterModel } from '../CharacterModel.js';

/**
 * Service for managing characters and their tags.
 * Provides CRUD operations for characters and methods for tag filtering.
 *
 * @extends BaseService
 */
export class CharacterService extends BaseService {
  /**
   * Creates a new CharacterService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     CHARACTER QUERIES
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get characters with optional filtering.
   *
   * @param {Object} options - Filter options
   * @param {string} [options.search] - Search term for character name or tags
   * @param {boolean} [options.favorite] - Filter to favorites only
   * @param {string[]} [options.tags] - Tags to filter by (AND logic)
   * @param {string[]} [options.excludedTags] - Tags to exclude (NOT logic)
   * @returns {CharacterModel[]} Array of filtered characters
   */
  getCharacters(options = {}) {
    let chars = this.characters.contents;

    // Search by name or tags
    if (options.search) {
      const search = options.search.toLowerCase();
      chars = chars.filter(c =>
        c.name.toLowerCase().includes(search) ||
        Array.from(c.tags).some(t => t.toLowerCase().includes(search))
      );
    }

    // Filter favorites
    if (options.favorite) {
      chars = chars.filter(c => c.favorite);
    }

    // Tag Filtering (AND Logic)
    if (options.tags && options.tags.length > 0) {
      chars = chars.filter(c => options.tags.every(tag => c.tags.has(tag)));
    }

    // Tag Exclusion (NOT Logic)
    if (options.excludedTags && options.excludedTags.length > 0) {
      chars = chars.filter(c => !options.excludedTags.some(tag => c.tags.has(tag)));
    }

    return chars;
  }

  /**
   * Get a single character by ID.
   *
   * @param {string} id - Character ID
   * @returns {CharacterModel|undefined} The character or undefined if not found
   */
  getCharacter(id) {
    return this.characters.get(id);
  }

  /**
   * Get all characters that have a specific tag.
   *
   * @param {string} tag - Tag to filter by
   * @returns {CharacterModel[]} Array of characters with the tag
   */
  getCharactersByTag(tag) {
    return this.characters.filter(c => c.tags.has(tag));
  }

  /**
   * Get all unique tags used across characters.
   *
   * @returns {string[]} Sorted array of unique tags
   */
  getAllCharacterTags() {
    const tags = new Set();
    this.characters.forEach(c => {
      c.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }

  /* ═══════════════════════════════════════════════════════════════
     CHARACTER CRUD
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Create a new character.
   *
   * @param {Object} data - Character data
   * @param {string} data.name - Character name
   * @param {Object} [data.states] - Emotion states (key -> image path)
   * @param {string} [data.folder] - Folder ID
   * @param {string[]} [data.tags] - Character tags
   * @returns {CharacterModel} The created character
   */
  createCharacter(data) {
    const character = new CharacterModel(data);
    this.characters.set(character.id, character);
    this.saveData();
    return character;
  }

  /**
   * Update an existing character.
   *
   * @param {string} id - Character ID
   * @param {Object} data - Data to update
   * @returns {CharacterModel|undefined} The updated character or undefined if not found
   */
  updateCharacter(id, data) {
    const character = this.characters.get(id);
    if (!character) {
      return undefined;
    }

    // Handle special fields
    if (data.tags !== undefined) {
      // Convert array to Set if necessary
      character.tags = data.tags instanceof Set ? data.tags : new Set(data.tags);
      delete data.tags;
    }

    if (data.favoriteEmotions !== undefined) {
      // Convert array to Set if necessary
      character.favoriteEmotions = data.favoriteEmotions instanceof Set
        ? data.favoriteEmotions
        : new Set(data.favoriteEmotions);
      delete data.favoriteEmotions;
    }

    // Update other fields
    Object.assign(character, data);
    this.saveData();

    return character;
  }

  /**
   * Delete a character.
   *
   * @param {string} id - Character ID to delete
   * @returns {boolean} True if deleted, false if not found
   */
  deleteCharacter(id) {
    if (!this.characters.has(id)) {
      return false;
    }

    // Remove character from all scene casts
    this.scenes.forEach(scene => {
      const castIndex = scene.cast.findIndex(c => c.id === id);
      if (castIndex !== -1) {
        scene.cast.splice(castIndex, 1);
      }
    });

    this.characters.delete(id);
    this.saveData();
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     TAG OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Add a tag to a character.
   *
   * @param {string} id - Character ID
   * @param {string} tag - Tag to add
   * @returns {boolean} True if added, false if character not found or tag exists
   */
  addTag(id, tag) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    if (character.tags.has(tag)) {
      return false;
    }

    character.tags.add(tag);
    this.saveData();
    return true;
  }

  /**
   * Remove a tag from a character.
   *
   * @param {string} id - Character ID
   * @param {string} tag - Tag to remove
   * @returns {boolean} True if removed, false if character not found or tag doesn't exist
   */
  removeTag(id, tag) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    if (!character.tags.has(tag)) {
      return false;
    }

    character.tags.delete(tag);
    this.saveData();
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     EMOTION STATE OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Set the current emotion state for a character.
   *
   * @param {string} id - Character ID
   * @param {string} state - Emotion state key
   * @returns {boolean} True if updated, false if character or state not found
   */
  setCurrentState(id, state) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    if (!character.states[state]) {
      return false;
    }

    character.currentState = state;
    character.lastUsed = Date.now();
    this.saveData();
    return true;
  }

  /**
   * Toggle favorite status for an emotion.
   *
   * @param {string} id - Character ID
   * @param {string} emotion - Emotion state key
   * @returns {boolean|undefined} New favorite status, or undefined if not found
   */
  toggleFavoriteEmotion(id, emotion) {
    const character = this.characters.get(id);
    if (!character) {
      return undefined;
    }

    if (character.favoriteEmotions.has(emotion)) {
      character.favoriteEmotions.delete(emotion);
      this.saveData();
      return false;
    } else {
      character.favoriteEmotions.add(emotion);
      this.saveData();
      return true;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PERMISSION OPERATIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Check if a user has permission to perform an action on a character.
   *
   * @param {string} id - Character ID
   * @param {string} userId - User ID to check
   * @param {string} requiredLevel - Required permission level ('none', 'view', 'emotion', 'full')
   * @returns {boolean} True if user has required permission
   */
  hasPermission(id, userId, requiredLevel = 'emotion') {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }
    return character.hasPermission(userId, requiredLevel);
  }

  /**
   * Set permission level for a player on a character.
   *
   * @param {string} id - Character ID
   * @param {string} userId - User ID
   * @param {string} level - Permission level ('none', 'view', 'emotion', 'full')
   * @returns {boolean} True if updated, false if character not found
   */
  setPlayerPermission(id, userId, level) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    character.setPlayerPermission(userId, level);
    this.saveData();
    return true;
  }

  /**
   * Set default permission level for a character.
   *
   * @param {string} id - Character ID
   * @param {string} level - Permission level ('none', 'view', 'emotion', 'full')
   * @returns {boolean} True if updated, false if character not found
   */
  setDefaultPermission(id, level) {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    character.permissions.default = level;
    this.saveData();
    return true;
  }
}
