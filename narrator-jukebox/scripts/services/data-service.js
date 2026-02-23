/**
 * Narrator's Jukebox - Data Service
 * Handles all CRUD operations for music, ambience, soundboard, playlists, and settings
 */

import { JUKEBOX } from '../core/constants.js';
import { debugLog, debugError } from '../utils/debug.js';

/**
 * DataService - Manages persistent data operations
 * All data is stored in Foundry's game.settings
 */
class DataService {
  constructor() {
    this.music = [];
    this.ambience = [];
    this.soundboard = [];
    this.playlists = [];
    this.ambiencePresets = [];
    this._initialized = false;
  }

  /**
   * Load all data from Foundry settings
   */
  async loadAllData() {
    try {
      const musicData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC);
      this.music = musicData ? JSON.parse(musicData) : [];

      const ambienceData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE);
      this.ambience = ambienceData ? JSON.parse(ambienceData) : [];

      const soundboardData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD);
      this.soundboard = soundboardData ? JSON.parse(soundboardData) : [];

      const playlistsData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS);
      this.playlists = playlistsData ? JSON.parse(playlistsData) : [];

      const presetsData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_PRESETS);
      this.ambiencePresets = presetsData ? JSON.parse(presetsData) : [];

      this._initialized = true;
      debugLog(' DataService loaded all data');
    } catch (err) {
      debugError(' DataService failed to load data:', err);
      throw err;
    }
  }

  /**
   * Save all data to Foundry settings
   */
  async saveAllData() {
    debugLog(" DataService saving all data...");
    try {
      await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC, JSON.stringify(this.music));
      await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE, JSON.stringify(this.ambience));
      await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD, JSON.stringify(this.soundboard));
      await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS, JSON.stringify(this.playlists));
      debugLog(" DataService saved all data successfully.");
    } catch (err) {
      debugError("DataService save failed:", err);
      throw err;
    }
  }

  // ==========================================
  // Music CRUD Operations
  // ==========================================

  /**
   * Add a new music track
   * @param {object} track - Track data with id, name, url, source, tags, etc.
   */
  async addMusic(track) {
    debugLog(" DataService.addMusic called", track);
    if (!track.id) {
      track.id = foundry.utils.randomID();
    }
    this.music.push(track);
    await this.saveAllData();
    debugLog(" Music saved. Total tracks:", this.music.length);
    return track;
  }

  /**
   * Update an existing music track
   * @param {string} id - Track ID
   * @param {object} data - Updated track data
   */
  async updateMusic(id, data) {
    const index = this.music.findIndex(m => m.id === id);
    if (index !== -1) {
      this.music[index] = { ...this.music[index], ...data };
      await this.saveAllData();
      return this.music[index];
    }
    return null;
  }

  /**
   * Delete a music track
   * @param {string} id - Track ID
   */
  async deleteMusic(id) {
    this.music = this.music.filter(m => m.id !== id);
    // Also remove from playlists
    this.playlists.forEach(p => {
      p.musicIds = p.musicIds.filter(mid => mid !== id);
    });
    await this.saveAllData();
  }

  /**
   * Get a music track by ID
   * @param {string} id - Track ID
   */
  getMusic(id) {
    return this.music.find(m => m.id === id);
  }

  /**
   * Get all music tracks
   */
  getAllMusic() {
    return [...this.music];
  }

  // ==========================================
  // Ambience CRUD Operations
  // ==========================================

  /**
   * Add a new ambience track
   * @param {object} track - Track data
   */
  async addAmbience(track) {
    debugLog(" DataService.addAmbience called", track);
    if (!track.id) {
      track.id = foundry.utils.randomID();
    }
    this.ambience.push(track);
    await this.saveAllData();
    debugLog(" Ambience saved. Total tracks:", this.ambience.length);
    return track;
  }

  /**
   * Update an existing ambience track
   * @param {string} id - Track ID
   * @param {object} data - Updated track data
   */
  async updateAmbience(id, data) {
    const index = this.ambience.findIndex(a => a.id === id);
    if (index !== -1) {
      this.ambience[index] = { ...this.ambience[index], ...data };
      await this.saveAllData();
      return this.ambience[index];
    }
    return null;
  }

  /**
   * Delete an ambience track
   * @param {string} id - Track ID
   */
  async deleteAmbience(id) {
    this.ambience = this.ambience.filter(a => a.id !== id);
    await this.saveAllData();
  }

  /**
   * Get an ambience track by ID
   * @param {string} id - Track ID
   */
  getAmbience(id) {
    return this.ambience.find(a => a.id === id);
  }

  /**
   * Get all ambience tracks
   */
  getAllAmbience() {
    return [...this.ambience];
  }

  // ==========================================
  // Soundboard CRUD Operations
  // ==========================================

  /**
   * Add a new soundboard sound
   * @param {object} sound - Sound data
   */
  async addSoundboardSound(sound) {
    debugLog(" DataService.addSoundboardSound called", sound);
    if (!sound.id) {
      sound.id = foundry.utils.randomID();
    }
    this.soundboard.push(sound);
    await this.saveAllData();
    debugLog(" Soundboard saved. Total sounds:", this.soundboard.length);
    return sound;
  }

  /**
   * Update an existing soundboard sound
   * @param {string} id - Sound ID
   * @param {object} data - Updated sound data
   */
  async updateSoundboardSound(id, data) {
    const index = this.soundboard.findIndex(s => s.id === id);
    if (index !== -1) {
      this.soundboard[index] = { ...this.soundboard[index], ...data };
      await this.saveAllData();
      return this.soundboard[index];
    }
    return null;
  }

  /**
   * Delete a soundboard sound
   * @param {string} id - Sound ID
   */
  async deleteSoundboardSound(id) {
    this.soundboard = this.soundboard.filter(s => s.id !== id);
    await this.saveAllData();
  }

  /**
   * Get a soundboard sound by ID
   * @param {string} id - Sound ID
   */
  getSoundboardSound(id) {
    return this.soundboard.find(s => s.id === id);
  }

  /**
   * Get all soundboard sounds
   */
  getAllSoundboardSounds() {
    return [...this.soundboard];
  }

  // ==========================================
  // Playlist Operations
  // ==========================================

  /**
   * Create a new playlist
   * @param {string} name - Playlist name
   */
  async createPlaylist(name) {
    const playlist = {
      id: foundry.utils.randomID(),
      name: name,
      musicIds: []
    };
    this.playlists.push(playlist);
    await this.saveAllData();
    return playlist;
  }

  /**
   * Delete a playlist
   * @param {string} id - Playlist ID
   */
  async deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    await this.saveAllData();
  }

  /**
   * Add a track to a playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} musicId - Music track ID
   */
  async addToPlaylist(playlistId, musicId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    if (!playlist.musicIds.includes(musicId)) {
      playlist.musicIds.push(musicId);
      await this.saveAllData();
    }
    return playlist;
  }

  /**
   * Add multiple tracks to a playlist at once
   * @param {string} playlistId - Playlist ID
   * @param {string[]} musicIds - Array of music track IDs
   * @returns {Promise<{added: number, skipped: number, playlist: object}>}
   */
  async addMultipleToPlaylist(playlistId, musicIds) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return { added: 0, skipped: 0, playlist: null };

    let added = 0;
    let skipped = 0;

    for (const musicId of musicIds) {
      if (!playlist.musicIds.includes(musicId)) {
        playlist.musicIds.push(musicId);
        added++;
      } else {
        skipped++;
      }
    }

    if (added > 0) {
      await this.saveAllData();
    }

    return { added, skipped, playlist };
  }

  /**
   * Remove a track from a playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} musicId - Music track ID
   */
  async removeFromPlaylist(playlistId, musicId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    playlist.musicIds = playlist.musicIds.filter(id => id !== musicId);
    await this.saveAllData();
    return playlist;
  }

  /**
   * Get a playlist by ID
   * @param {string} id - Playlist ID
   */
  getPlaylist(id) {
    return this.playlists.find(p => p.id === id);
  }

  /**
   * Get all playlists
   */
  getAllPlaylists() {
    return [...this.playlists];
  }

  /**
   * Get playlist with resolved tracks
   * @param {string} id - Playlist ID
   */
  getPlaylistWithTracks(id) {
    const playlist = this.getPlaylist(id);
    if (!playlist) return null;

    const tracks = playlist.musicIds
      .map(musicId => this.getMusic(musicId))
      .filter(track => track !== undefined);

    return {
      ...playlist,
      tracks
    };
  }

  // ==========================================
  // Mood Operations
  // ==========================================

  /**
   * Get all moods
   */
  async getMoods() {
    return game.settings.get(JUKEBOX.ID, "moods") || [];
  }

  /**
   * Update moods
   * @param {array} moods - Array of mood objects
   */
  async updateMoods(moods) {
    await game.settings.set(JUKEBOX.ID, "moods", moods);
    return moods;
  }

  // ==========================================
  // Suggestion Operations
  // ==========================================

  /**
   * Get all suggestions
   */
  async getSuggestions() {
    return game.settings.get(JUKEBOX.ID, "suggestions") || [];
  }

  /**
   * Add a suggestion
   * @param {object} track - Suggested track data
   */
  async addSuggestion(track) {
    const suggestions = await this.getSuggestions();
    suggestions.push(track);
    await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);
    return suggestions;
  }

  /**
   * Remove a suggestion by ID
   * @param {string} id - Suggestion ID
   */
  async removeSuggestion(id) {
    const suggestions = await this.getSuggestions();
    const filtered = suggestions.filter(s => s.id !== id);
    await game.settings.set(JUKEBOX.ID, "suggestions", filtered);
    return filtered;
  }

  /**
   * Clear all suggestions
   */
  async clearSuggestions() {
    await game.settings.set(JUKEBOX.ID, "suggestions", []);
    return [];
  }

  // ==========================================
  // Track Lookup (searches both libraries)
  // ==========================================

  /**
   * Find a track by ID in music library first, then ambience
   * @param {string} id - Track ID
   * @param {string} preferredChannel - 'music' or 'ambience'
   */
  findTrack(id, preferredChannel = 'music') {
    if (preferredChannel === 'ambience') {
      let track = this.ambience.find(a => a.id === id);
      if (!track) track = this.music.find(m => m.id === id);
      return track;
    } else {
      let track = this.music.find(m => m.id === id);
      if (!track) track = this.ambience.find(a => a.id === id);
      return track;
    }
  }

  /**
   * Get tracks by tag
   * @param {string} tag - Tag to filter by
   * @param {string} library - 'music', 'ambience', or 'both'
   */
  getTracksByTag(tag, library = 'music') {
    if (library === 'both') {
      return [
        ...this.music.filter(m => m.tags && m.tags.includes(tag)),
        ...this.ambience.filter(a => a.tags && a.tags.includes(tag))
      ];
    } else if (library === 'ambience') {
      return this.ambience.filter(a => a.tags && a.tags.includes(tag));
    } else {
      return this.music.filter(m => m.tags && m.tags.includes(tag));
    }
  }

  /**
   * Get all unique tags from music library
   */
  getAllMusicTags() {
    const tags = new Set();
    this.music.forEach(track => {
      if (track.tags && Array.isArray(track.tags)) {
        track.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }

  /**
   * Get all unique tags from ambience library
   */
  getAllAmbienceTags() {
    const tags = new Set();
    this.ambience.forEach(track => {
      if (track.tags && Array.isArray(track.tags)) {
        track.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }

  // ==========================================
  // Ambience Preset Operations
  // ==========================================

  /**
   * Get all ambience presets (sync - uses cached data)
   * @returns {Array} Array of preset objects
   */
  getAllAmbiencePresets() {
    return [...this.ambiencePresets];
  }

  /**
   * Get a single ambience preset by ID (sync)
   * @param {string} id - Preset ID
   * @returns {object|null} The preset or null if not found
   */
  getAmbiencePreset(id) {
    return this.ambiencePresets.find(p => p.id === id) || null;
  }

  /**
   * Save a new ambience preset
   * @param {object} preset - Preset data with name and layersState
   * @returns {Promise<object>} The saved preset with generated ID
   */
  async saveAmbiencePreset(preset) {
    const newPreset = {
      id: foundry.utils.randomID(),
      name: preset.name,
      layersState: preset.layersState,
      createdAt: Date.now(),
      createdBy: game.user.name
    };

    this.ambiencePresets.push(newPreset);
    await this._saveAmbiencePresets();

    debugLog(` Saved ambience preset: ${newPreset.name}`);
    return newPreset;
  }

  /**
   * Update an existing ambience preset
   * @param {string} id - Preset ID
   * @param {object} data - Updated preset data
   * @returns {Promise<object|null>} The updated preset or null if not found
   */
  async updateAmbiencePreset(id, data) {
    const index = this.ambiencePresets.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.ambiencePresets[index] = { ...this.ambiencePresets[index], ...data, updatedAt: Date.now() };
    await this._saveAmbiencePresets();

    debugLog(` Updated ambience preset: ${this.ambiencePresets[index].name}`);
    return this.ambiencePresets[index];
  }

  /**
   * Delete an ambience preset
   * @param {string} id - Preset ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteAmbiencePreset(id) {
    const index = this.ambiencePresets.findIndex(p => p.id === id);
    if (index === -1) return false;

    const deletedName = this.ambiencePresets[index].name;
    this.ambiencePresets.splice(index, 1);
    await this._saveAmbiencePresets();

    debugLog(` Deleted ambience preset: ${deletedName}`);
    return true;
  }

  /**
   * Internal method to save presets to Foundry settings
   * @private
   */
  async _saveAmbiencePresets() {
    await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_PRESETS, JSON.stringify(this.ambiencePresets));
  }
}

// Export singleton instance
export const dataService = new DataService();

// Also export the class for testing purposes
export { DataService };
