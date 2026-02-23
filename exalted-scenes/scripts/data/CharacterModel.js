/**
 * @file CharacterModel.js
 * @description Data model for characters in the Exalted Scenes module.
 * Characters have multiple emotion states, border styles, and permission controls.
 *
 * @module data/CharacterModel
 */

/**
 * Data model representing a character with emotion states and permissions.
 *
 * @class CharacterModel
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {Object.<string, string>} states - Map of emotion state names to image paths
 * @property {string} currentState - Currently active emotion state
 * @property {string} borderStyle - Border preset name from CONFIG.BORDER_PRESETS
 * @property {boolean} locked - Lock status (only GM can change when locked)
 * @property {Object} permissions - Permission settings for player access
 * @property {string|null} actorId - Linked Foundry Actor ID (optional)
 */
export class CharacterModel {
  /**
   * Creates a new CharacterModel instance.
   * @param {Object} data - Character data
   * @param {string} [data.id] - Unique identifier (auto-generated if not provided)
   * @param {string} [data.name='New Character'] - Display name
   * @param {Object.<string, string>} [data.states] - Emotion states map
   * @param {string} [data.currentState='normal'] - Current emotion state
   * @param {string|null} [data.folder=null] - Parent folder ID
   * @param {boolean} [data.favorite=false] - Favorite status
   * @param {string[]} [data.tags=[]] - Tag list
   * @param {string[]} [data.favoriteEmotions=[]] - Favorited emotion state names
   * @param {string} [data.borderStyle='gold'] - Border preset name
   * @param {boolean} [data.locked=false] - Lock status
   * @param {Object} [data.permissions] - Permission settings
   * @param {string|null} [data.actorId=null] - Linked Foundry Actor ID
   */
  constructor(data = {}) {
    this.id = data.id || foundry.utils.randomID();
    this.name = data.name || 'New Character';
    this.type = 'character';
    this.states = data.states || { normal: 'icons/svg/mystery-man.svg' };
    this.currentState = data.currentState || 'normal';
    this.folder = data.folder || null;
    this.favorite = data.favorite || false;
    this.tags = new Set(data.tags || []);
    this.createdAt = data.createdAt || Date.now();
    this.lastUsed = data.lastUsed || null;
    this.playCount = data.playCount || 0;
    // Favorite emotions for this character (stored as array of state keys)
    this.favoriteEmotions = new Set(data.favoriteEmotions || []);
    // Border style customization (preset ID from CONFIG.BORDER_PRESETS)
    this.borderStyle = data.borderStyle || 'gold';
    // Lock: when true, only GM can change emotions in PlayerView
    this.locked = data.locked || false;

    // Permission system: controls who can edit this character
    // Levels: 'none' (no access), 'view' (read-only), 'emotion' (can change emotions), 'full' (full control)
    this.permissions = data.permissions || {
      default: 'none',    // Default permission for non-listed players
      players: {}         // Map of playerId -> permission level
    };

    // Linked Foundry Actor ID (optional - allows opening character sheet from emotion picker)
    this.actorId = data.actorId || null;

    // Music playlist ID (optional - allows players to request songs from their assigned playlist)
    this.musicPlaylistId = data.musicPlaylistId || null;
  }

  /**
   * Gets the current emotion image path based on currentState.
   * Falls back to 'normal' state if current state is not found.
   * @type {string}
   */
  get image() {
    return this.states[this.currentState] || this.states.normal;
  }

  /**
   * Gets the thumbnail image path.
   * Prefers 'base' state, then 'normal', then first available state.
   * @type {string}
   */
  get thumbnail() {
    return this.states.base || this.states.normal || Object.values(this.states)[0];
  }

  /**
   * Serializes the character to a plain object for storage.
   * Converts Sets to Arrays for JSON compatibility.
   * @returns {Object} Plain object representation of the character
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      image: this.image,
      type: this.type,
      states: this.states,
      currentState: this.currentState,
      emotionCount: Object.keys(this.states).length,
      folder: this.folder,
      favorite: this.favorite,
      tags: Array.from(this.tags),
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      playCount: this.playCount,
      favoriteEmotions: Array.from(this.favoriteEmotions),
      borderStyle: this.borderStyle,
      locked: this.locked,
      permissions: this.permissions,
      actorId: this.actorId,
      musicPlaylistId: this.musicPlaylistId
    };
  }

  /**
   * Check if a user has a specific permission level or higher
   * @param {string} userId - The user ID to check
   * @param {string} requiredLevel - The minimum required permission level
   * @returns {boolean}
   */
  hasPermission(userId, requiredLevel = 'emotion') {
    const levels = { none: 0, view: 1, emotion: 2, full: 3 };
    const userLevel = this.permissions.players[userId] || this.permissions.default || 'none';
    return levels[userLevel] >= levels[requiredLevel];
  }

  /**
   * Set permission for a specific player
   * @param {string} userId - The user ID
   * @param {string} level - Permission level ('none', 'view', 'emotion', 'full')
   */
  setPlayerPermission(userId, level) {
    if (!this.permissions.players) {
      this.permissions.players = {};
    }
    if (level === 'none' || level === this.permissions.default) {
      delete this.permissions.players[userId];
    } else {
      this.permissions.players[userId] = level;
    }
  }
}
