/**
 * @file CharacterModel.js
 * @description Data model for characters in the Exalted Scenes module.
 * Characters have multiple emotion states, border styles, and permission controls.
 *
 * @module data/CharacterModel
 */

import { CONFIG } from '../config.js';
import { NarratorJukeboxIntegration } from './NarratorJukeboxIntegration.js';
import { getMediaFocusForState, normalizeMediaFocusMap } from '../utils/media-focus.js';

/**
 * Data model representing a character with emotion states and permissions.
 *
 * @class CharacterModel
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {Object.<string, string>} states - Map of emotion state names to image paths
 * @property {string} currentState - Currently active emotion state
 * @property {Object} borderStyle - Border style object { effect: string, color?: string, color2?: string }
 * @property {boolean} locked - Lock status (only GM can change when locked)
 * @property {boolean} hideNameInBroadcast - Whether the broadcast/player view should hide the character name
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
   * @param {Object} [data.borderStyle] - Border style { effect, color?, color2? }
   * @param {boolean} [data.locked=false] - Lock status
   * @param {Object} [data.permissions] - Permission settings
   * @param {string|null} [data.actorId=null] - Linked Foundry Actor ID
   */
  constructor(data = {}) {
    this.id = data.id || foundry.utils.randomID();
   this.name = data.name || 'New Character';
   this.type = 'character';
   this.states = data.states || { normal: 'icons/svg/mystery-man.svg' };
    this.stateFocus = normalizeMediaFocusMap(data.stateFocus);
    this.currentState = data.currentState || 'normal';
    this.folder = data.folder || null;
    this.favorite = data.favorite || false;
    this.tags = new Set(data.tags || []);
    this.createdAt = data.createdAt || Date.now();
    this.lastUsed = data.lastUsed || null;
    this.playCount = data.playCount || 0;
    // Favorite emotions for this character (stored as array of state keys)
    this.favoriteEmotions = new Set(data.favoriteEmotions || []);
    // Border style customization (v6.0: { effect, color, color2? })
    if (data.borderStyle && typeof data.borderStyle === 'object') {
      this.borderStyle = {
        effect: CONFIG.BORDER_EFFECTS[data.borderStyle.effect] ? data.borderStyle.effect : 'solid',
        ...(data.borderStyle.color && { color: data.borderStyle.color }),
        ...(data.borderStyle.color2 && { color2: data.borderStyle.color2 })
      };
    } else if (data.borderStyle && typeof data.borderStyle === 'string') {
      const migrated = CONFIG.BORDER_MIGRATION_MAP[data.borderStyle];
      this.borderStyle = migrated ? { ...migrated } : { ...CONFIG.BORDER_DEFAULT };
    } else {
      this.borderStyle = { ...CONFIG.BORDER_DEFAULT };
    }
    // Lock: when true, only GM can change emotions in PlayerView
    this.locked = data.locked || false;
    this.hideNameInBroadcast = !!data.hideNameInBroadcast;

    // Permission system: controls who can edit this character
    // Levels: 'none' (no access), 'view' (read-only), 'emotion' (can change emotions), 'full' (full control)
    this.permissions = data.permissions || {
      default: 'none',    // Default permission for non-listed players
      players: {}         // Map of playerId -> permission level
    };

    // Linked Foundry Actor ID (optional - allows opening character sheet from emotion picker)
    this.actorId = data.actorId || null;

    // Music settings (v6.0 expanded — multi-playlist + entrance sound)
    const music = data.music || {};
    this.music = {
      playlists: music.playlists || [],           // Array of playlist IDs for music requests
      playlistNames: foundry.utils.deepClone(music.playlistNames || {}),
      entranceSoundId: music.entranceSoundId || null  // NJ soundboard sound to play on character entrance
    };

    // Backward compat: migrate flat musicPlaylistId into music.playlists
    if (data.musicPlaylistId && this.music.playlists.length === 0) {
      this.music.playlists = [data.musicPlaylistId];
    }
    if (data.musicPlaylistId && data.musicPlaylistName && !this.music.playlistNames[data.musicPlaylistId]) {
      this.music.playlistNames[data.musicPlaylistId] = data.musicPlaylistName;
    }

    // Hero Mode poses (v6.0 — transparent sprites for Visual Novel display)
    // Each hero state maps a pose name to { img: string, type: 'half'|'full' }
    this.heroStates = data.heroStates || {};
    this.currentHeroState = data.currentHeroState || null;
  }

  /**
   * Gets the current emotion image path based on currentState.
   * Falls back to 'normal' state if current state is not found.
   * @type {string}
   */
  get image() {
    return this.states[this.activeStateKey] || this.states.normal;
  }

  /**
   * Gets the currently active state key with fallbacks.
   * @type {string|null}
   */
  get activeStateKey() {
    if (this.states[this.currentState]) return this.currentState;
    if (this.states.normal) return 'normal';
    return Object.keys(this.states)[0] || null;
  }

  /**
   * Gets the crop focus for the currently active state.
   * @type {{x: number, y: number, scale: number, rotation: number}}
   */
  get currentFocus() {
    return this.getStateFocus(this.activeStateKey);
  }

  /**
   * Gets the thumbnail image path.
   * Prefers 'base' state, then 'normal', then first available state.
   * @type {string}
   */
  get thumbnail() {
    return this.thumbnailStateKey ? this.states[this.thumbnailStateKey] : undefined;
  }

  /**
   * Gets the state key used for thumbnail rendering.
   * @type {string|null}
   */
  get thumbnailStateKey() {
    if (this.states.base) return 'base';
    if (this.states.normal) return 'normal';
    return Object.keys(this.states)[0] || null;
  }

  /**
   * Gets the crop focus for the thumbnail state.
   * @type {{x: number, y: number, scale: number, rotation: number}}
   */
  get thumbnailFocus() {
    return this.getStateFocus(this.thumbnailStateKey);
  }

  /**
   * Gets the crop focus for a specific emotion state.
   * @param {string|null} stateKey - Emotion state key
   * @returns {{x: number, y: number, scale: number, rotation: number}}
   */
  getStateFocus(stateKey = this.activeStateKey) {
    return getMediaFocusForState(this.stateFocus, stateKey);
  }

  /**
   * Gets the current hero pose image path based on currentHeroState.
   * Falls back to first available hero state. Returns null if no hero states exist.
   * @type {string|null}
   */
  get heroImage() {
    const keys = Object.keys(this.heroStates);
    if (keys.length === 0) return null;
    if (this.currentHeroState && this.heroStates[this.currentHeroState]) {
      return this.heroStates[this.currentHeroState].img;
    }
    return this.heroStates[keys[0]].img;
  }

  /**
   * Gets the type ('half' or 'full') of the current hero pose.
   * @type {string|null}
   */
  get heroType() {
    if (!this.currentHeroState || !this.heroStates[this.currentHeroState]) return null;
    return this.heroStates[this.currentHeroState].type || 'half';
  }

  /**
   * Whether this character has any hero poses configured.
   * @type {boolean}
   */
  get hasHeroPoses() {
    return Object.keys(this.heroStates).length > 0;
  }

  /**
   * Serializes the character to a plain object for storage.
   * Converts Sets to Arrays for JSON compatibility.
   * @returns {Object} Plain object representation of the character
   */
  toJSON() {
    const playlistNames = foundry.utils.deepClone(this.music?.playlistNames || {});
    for (const playlistId of this.music?.playlists || []) {
      if (playlistNames[playlistId]) continue;
      const resolvedName = NarratorJukeboxIntegration.getPlaylistName(playlistId);
      if (resolvedName && resolvedName !== 'Unknown Playlist') {
        playlistNames[playlistId] = resolvedName;
      }
    }

    const primaryPlaylistId = this.music.playlists[0] || null;

    return {
      id: this.id,
      name: this.name,
      image: this.image,
      type: this.type,
      states: this.states,
      stateFocus: this.stateFocus,
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
      hideNameInBroadcast: this.hideNameInBroadcast,
      permissions: this.permissions,
      actorId: this.actorId,
      music: {
        playlists: [...this.music.playlists],
        playlistNames,
        entranceSoundId: this.music.entranceSoundId || null
      },
      // Legacy compat: keep musicPlaylistId for any external consumers
      musicPlaylistId: primaryPlaylistId,
      musicPlaylistName: primaryPlaylistId ? playlistNames[primaryPlaylistId] || null : null,
      // Hero Mode
      heroStates: this.heroStates,
      currentHeroState: this.currentHeroState,
      heroCount: Object.keys(this.heroStates).length
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
