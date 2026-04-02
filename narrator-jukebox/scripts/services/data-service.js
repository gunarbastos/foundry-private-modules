/**
 * Narrator's Jukebox - Data Service
 * Handles all CRUD operations for music, ambience, soundboard, playlists, and settings
 */

import { JUKEBOX } from '../core/constants.js';
import { debugLog, debugError } from '../utils/debug.js';
import { extractYouTubeVideoId, getYouTubeThumbnail, normalizeYouTubeUrl } from '../utils/youtube-utils.js';

const SETTING_BY_COLLECTION = Object.freeze({
  music: JUKEBOX.SETTINGS.MUSIC,
  ambience: JUKEBOX.SETTINGS.AMBIENCE,
  soundboard: JUKEBOX.SETTINGS.SOUNDBOARD,
  playlists: JUKEBOX.SETTINGS.PLAYLISTS,
  ambiencePresets: JUKEBOX.SETTINGS.AMBIENCE_PRESETS,
  musicFolders: JUKEBOX.SETTINGS.MUSIC_FOLDERS,
  ambienceFolders: JUKEBOX.SETTINGS.AMBIENCE_FOLDERS,
  soundboardFolders: JUKEBOX.SETTINGS.SOUNDBOARD_FOLDERS
});

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
    this.musicFolders = [];
    this.ambienceFolders = [];
    this.soundboardFolders = [];
    this._initialized = false;
    this._dirtyCollections = new Set();
    this._pendingSavePromise = null;
    this._batchDepth = 0;
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

      const musicFoldersData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_FOLDERS);
      this.musicFolders = musicFoldersData ? JSON.parse(musicFoldersData) : [];

      const ambienceFoldersData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_FOLDERS);
      this.ambienceFolders = ambienceFoldersData ? JSON.parse(ambienceFoldersData) : [];

      const soundboardFoldersData = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD_FOLDERS);
      this.soundboardFolders = soundboardFoldersData ? JSON.parse(soundboardFoldersData) : [];

      const musicMigration = this._normalizeStoredTrackCollection(this.music);
      const ambienceMigration = this._normalizeStoredTrackCollection(this.ambience);
      const soundboardMigration = this._normalizeStoredTrackCollection(this.soundboard);

      this.music = musicMigration.tracks;
      this.ambience = ambienceMigration.tracks;
      this.soundboard = soundboardMigration.tracks;

      this._initialized = true;
      debugLog(' DataService loaded all data');

      if (musicMigration.changed || ambienceMigration.changed || soundboardMigration.changed) {
        debugLog(' Healed stored track metadata for YouTube entries');
        if (game.user?.isGM) {
          await this.saveAllData({ collections: ['music', 'ambience', 'soundboard'] });
        }
      }
    } catch (err) {
      debugError(' DataService failed to load data:', err);
      throw err;
    }
  }

  /**
   * Save all data to Foundry settings
   */
  async saveAllData({ collections = null, immediate = false } = {}) {
    this._markDirtyCollections(collections);

    if (this._batchDepth > 0 && !immediate) {
      return;
    }

    await this._flushDirtyCollections();
  }

  async runInBatch(work) {
    this._batchDepth++;
    try {
      return await work();
    } finally {
      this._batchDepth = Math.max(0, this._batchDepth - 1);
      if (this._batchDepth === 0) {
        await this._flushDirtyCollections();
      }
    }
  }

  _markDirtyCollections(collections = null) {
    for (const collection of this._normalizeCollectionList(collections)) {
      this._dirtyCollections.add(collection);
    }
  }

  _normalizeCollectionList(collections = null) {
    const list = Array.isArray(collections) && collections.length
      ? collections
      : Object.keys(SETTING_BY_COLLECTION);

    return [...new Set(list)].filter(collection => collection in SETTING_BY_COLLECTION);
  }

  async _flushDirtyCollections() {
    if (this._pendingSavePromise) {
      return this._pendingSavePromise;
    }

    if (!this._dirtyCollections.size) {
      return;
    }

    this._pendingSavePromise = (async () => {
      try {
        while (this._dirtyCollections.size) {
          const collections = Array.from(this._dirtyCollections);
          this._dirtyCollections.clear();

          debugLog(` DataService saving collections: ${collections.join(', ')}`);
          for (let i = 0; i < collections.length; i++) {
            const collection = collections[i];

            try {
              await this._saveCollection(collection);
            } catch (err) {
              for (const unsavedCollection of collections.slice(i)) {
                this._dirtyCollections.add(unsavedCollection);
              }
              throw err;
            }
          }
        }

        debugLog(' DataService saved pending collections successfully.');
      } catch (err) {
        debugError('DataService save failed:', err);
        throw err;
      } finally {
        this._pendingSavePromise = null;
      }
    })();

    return this._pendingSavePromise;
  }

  async _saveCollection(collection) {
    const settingKey = SETTING_BY_COLLECTION[collection];
    if (!settingKey) return;

    await game.settings.set(JUKEBOX.ID, settingKey, JSON.stringify(this._getCollectionValue(collection)));
  }

  _getCollectionValue(collection) {
    switch (collection) {
      case 'music': return this.music;
      case 'ambience': return this.ambience;
      case 'soundboard': return this.soundboard;
      case 'playlists': return this.playlists;
      case 'ambiencePresets': return this.ambiencePresets;
      case 'musicFolders': return this.musicFolders;
      case 'ambienceFolders': return this.ambienceFolders;
      case 'soundboardFolders': return this.soundboardFolders;
      default: return null;
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
    await this.saveAllData({ collections: ['music'] });
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
      Object.assign(this.music[index], data);
      await this.saveAllData({ collections: ['music'] });
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
      if (p.trackSettings) delete p.trackSettings[id];
    });
    await this.saveAllData({ collections: ['music', 'playlists'] });
  }

  /**
   * Delete multiple music tracks at once
   * @param {string[]} ids - Array of track IDs to delete
   * @returns {Promise<number>} Number of tracks deleted
   */
  async deleteMultipleMusic(ids) {
    const idSet = new Set(ids);
    const before = this.music.length;
    this.music = this.music.filter(m => !idSet.has(m.id));
    // Clean playlists
    this.playlists.forEach(p => {
      p.musicIds = p.musicIds.filter(mid => !idSet.has(mid));
      if (p.trackSettings) {
        for (const id of ids) delete p.trackSettings[id];
      }
    });
    await this.saveAllData({ collections: ['music', 'playlists'] });
    return before - this.music.length;
  }

  /**
   * Add a tag to multiple tracks
   * @param {string[]} ids - Array of track IDs
   * @param {string} tag - Tag to add
   * @returns {Promise<number>} Number of tracks that received the tag
   */
  async addTagToMultiple(ids, tag) {
    let count = 0;
    for (const id of ids) {
      const track = this.music.find(m => m.id === id);
      if (!track) continue;
      if (!track.tags) track.tags = [];
      if (!track.tags.includes(tag)) {
        track.tags.push(tag);
        count++;
      }
    }
    if (count > 0) await this.saveAllData({ collections: ['music'] });
    return count;
  }

  /**
   * Remove a tag from multiple tracks
   * @param {string[]} ids - Array of track IDs
   * @param {string} tag - Tag to remove
   * @returns {Promise<number>} Number of tracks that had the tag removed
   */
  async removeTagFromMultiple(ids, tag) {
    let count = 0;
    for (const id of ids) {
      const track = this.music.find(m => m.id === id);
      if (!track?.tags) continue;
      const idx = track.tags.indexOf(tag);
      if (idx !== -1) {
        track.tags.splice(idx, 1);
        count++;
      }
    }
    if (count > 0) await this.saveAllData({ collections: ['music'] });
    return count;
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

  async addTracksBatch(library, tracks = []) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return [];
    }

    if (!['music', 'ambience', 'soundboard'].includes(library)) {
      throw new Error(`Unknown track library "${library}".`);
    }

    const trackArray = this._getTrackArray(library);

    return this.runInBatch(async () => {
      const createdTracks = tracks.map(track => {
        const preparedTrack = this._normalizeStoredTrack({
          ...track,
          id: track.id || foundry.utils.randomID()
        }).track;
        trackArray.push(preparedTrack);
        return preparedTrack;
      });

      await this.saveAllData({ collections: [library] });
      debugLog(` Bulk-saved ${createdTracks.length} ${library} track(s).`);
      return createdTracks;
    });
  }

  /**
   * Normalize stored track metadata so YouTube URLs always carry the correct source.
   * @param {Array<object>} tracks
   * @returns {{tracks: Array<object>, changed: boolean}}
   */
  _normalizeStoredTrackCollection(tracks = []) {
    let changed = false;

    const normalizedTracks = (tracks || []).map(track => {
      const result = this._normalizeStoredTrack(track);
      if (result.changed) changed = true;
      return result.track;
    });

    return { tracks: normalizedTracks, changed };
  }

  /**
   * Heal a stored track object without discarding unknown fields.
   * @param {object} track
   * @returns {{track: object, changed: boolean}}
   */
  _normalizeStoredTrack(track) {
    if (!track || typeof track !== 'object') {
      return { track, changed: false };
    }

    let changed = false;
    const normalized = { ...track };

    if (!normalized.url && normalized.path) {
      normalized.url = normalized.path;
      changed = true;
    }

    const rawUrl = normalized.url || '';
    const youtubeId = rawUrl ? extractYouTubeVideoId(rawUrl) : null;

    if (youtubeId) {
      const canonicalUrl = normalizeYouTubeUrl(rawUrl);
      if (normalized.url !== canonicalUrl) {
        normalized.url = canonicalUrl;
        changed = true;
      }
      if (normalized.source !== 'youtube') {
        normalized.source = 'youtube';
        changed = true;
      }
      if (!normalized.thumbnail) {
        normalized.thumbnail = getYouTubeThumbnail(youtubeId, 'high');
        changed = true;
      }
    } else if (!normalized.source) {
      normalized.source = 'local';
      changed = true;
    }

    return { track: changed ? normalized : track, changed };
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
    await this.saveAllData({ collections: ['ambience'] });
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
      await this.saveAllData({ collections: ['ambience'] });
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
    await this.saveAllData({ collections: ['ambience'] });
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

  /**
   * Delete multiple ambience tracks
   * @param {string[]} ids - Array of track IDs
   * @returns {Promise<number>} Number of tracks deleted
   */
  async deleteMultipleAmbience(ids) {
    const idSet = new Set(ids);
    const before = this.ambience.length;
    this.ambience = this.ambience.filter(a => !idSet.has(a.id));
    await this.saveAllData({ collections: ['ambience'] });
    return before - this.ambience.length;
  }

  /**
   * Add a tag to multiple ambience tracks
   * @param {string[]} ids - Array of track IDs
   * @param {string} tag - Tag to add
   * @returns {Promise<number>} Number of tracks that received the tag
   */
  async addTagToMultipleAmbience(ids, tag) {
    let count = 0;
    for (const id of ids) {
      const track = this.ambience.find(a => a.id === id);
      if (!track) continue;
      if (!track.tags) track.tags = [];
      if (!track.tags.includes(tag)) {
        track.tags.push(tag);
        count++;
      }
    }
    if (count > 0) await this.saveAllData({ collections: ['ambience'] });
    return count;
  }

  /**
   * Remove a tag from multiple ambience tracks
   * @param {string[]} ids - Array of track IDs
   * @param {string} tag - Tag to remove
   * @returns {Promise<number>} Number of tracks that had the tag removed
   */
  async removeTagFromMultipleAmbience(ids, tag) {
    let count = 0;
    for (const id of ids) {
      const track = this.ambience.find(a => a.id === id);
      if (!track?.tags) continue;
      const idx = track.tags.indexOf(tag);
      if (idx !== -1) {
        track.tags.splice(idx, 1);
        count++;
      }
    }
    if (count > 0) await this.saveAllData({ collections: ['ambience'] });
    return count;
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
    await this.saveAllData({ collections: ['soundboard'] });
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
      await this.saveAllData({ collections: ['soundboard'] });
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
    await this.saveAllData({ collections: ['soundboard'] });
  }

  /**
   * Delete multiple soundboard sounds
   * @param {string[]} ids - Array of sound IDs
   * @returns {Promise<number>} Number of sounds deleted
   */
  async deleteMultipleSoundboard(ids) {
    const idSet = new Set(ids);
    const before = this.soundboard.length;
    this.soundboard = this.soundboard.filter(s => !idSet.has(s.id));
    await this.saveAllData({ collections: ['soundboard'] });
    return before - this.soundboard.length;
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
      musicIds: [],
      coverImage: '',
      loop: false,
      trackSettings: {}
    };
    this.playlists.push(playlist);
    await this.saveAllData({ collections: ['playlists'] });
    return playlist;
  }

  /**
   * Update an existing playlist
   * @param {string} id - Playlist ID
   * @param {object} data - Updated playlist data
   * @returns {Promise<object|null>}
   */
  async updatePlaylist(id, data) {
    const playlist = this.playlists.find(p => p.id === id);
    if (!playlist) return null;

    Object.assign(playlist, data);
    await this.saveAllData({ collections: ['playlists'] });
    return playlist;
  }

  /**
   * Duplicate an existing playlist
   * @param {string} id - Playlist ID
   * @param {string} [name] - Optional new playlist name
   * @returns {Promise<object|null>}
   */
  async duplicatePlaylist(id, name = null) {
    const playlist = this.playlists.find(p => p.id === id);
    if (!playlist) return null;

    const duplicate = foundry.utils.deepClone(playlist);
    duplicate.id = foundry.utils.randomID();
    duplicate.name = name?.trim() || `${playlist.name} Copy`;

    this.playlists.push(duplicate);
    await this.saveAllData({ collections: ['playlists'] });
    return duplicate;
  }

  /**
   * Move a playlist to a new index in the playlist order
   * @param {string} id - Playlist ID
   * @param {number} targetIndex - Target array index
   * @returns {Promise<object|null>}
   */
  async reorderPlaylist(id, targetIndex) {
    const currentIndex = this.playlists.findIndex(p => p.id === id);
    if (currentIndex === -1) return null;

    const boundedIndex = Math.max(0, Math.min(targetIndex, this.playlists.length - 1));
    if (boundedIndex === currentIndex) {
      return this.playlists[currentIndex];
    }

    const [playlist] = this.playlists.splice(currentIndex, 1);
    this.playlists.splice(boundedIndex, 0, playlist);
    await this.saveAllData({ collections: ['playlists'] });
    return playlist;
  }

  /**
   * Delete a playlist
   * @param {string} id - Playlist ID
   */
  async deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    await this.saveAllData({ collections: ['playlists'] });
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
      await this.saveAllData({ collections: ['playlists'] });
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
      await this.saveAllData({ collections: ['playlists'] });
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
    // Clean up trackSettings for removed track
    if (playlist.trackSettings) {
      delete playlist.trackSettings[musicId];
    }
    await this.saveAllData({ collections: ['playlists'] });
    return playlist;
  }

  /**
   * Toggle per-track loop setting within a playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} musicId - Music track ID
   * @returns {Promise<boolean>} New loop state for the track
   */
  async togglePlaylistTrackLoop(playlistId, musicId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return false;

    if (!playlist.trackSettings) playlist.trackSettings = {};
    if (!playlist.trackSettings[musicId]) playlist.trackSettings[musicId] = {};

    const current = playlist.trackSettings[musicId].loop || false;
    playlist.trackSettings[musicId].loop = !current;

    await this.saveAllData({ collections: ['playlists'] });
    return !current;
  }

  /**
   * Toggle playlist-level loop
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<boolean>} New loop state
   */
  async togglePlaylistLoop(playlistId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return false;

    playlist.loop = !playlist.loop;
    await this.saveAllData({ collections: ['playlists'] });
    return playlist.loop;
  }

  /**
   * Check if a track has per-track loop enabled in a playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} musicId - Music track ID
   * @returns {boolean}
   */
  isTrackLoopEnabled(playlistId, musicId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist?.trackSettings?.[musicId]) return false;
    return playlist.trackSettings[musicId].loop || false;
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
  // Folder Operations
  // ==========================================

  _getFolderArray(library) {
    switch (library) {
      case 'music': return this.musicFolders;
      case 'ambience': return this.ambienceFolders;
      case 'soundboard': return this.soundboardFolders;
      default: return [];
    }
  }

  _setFolderArray(library, folders) {
    switch (library) {
      case 'music': this.musicFolders = folders; break;
      case 'ambience': this.ambienceFolders = folders; break;
      case 'soundboard': this.soundboardFolders = folders; break;
    }
  }

  _getTrackArray(library) {
    switch (library) {
      case 'music': return this.music;
      case 'ambience': return this.ambience;
      case 'soundboard': return this.soundboard;
      default: return [];
    }
  }

  _getFolderCollectionKey(library) {
    switch (library) {
      case 'music': return 'musicFolders';
      case 'ambience': return 'ambienceFolders';
      case 'soundboard': return 'soundboardFolders';
      default: return null;
    }
  }

  async createFolder(library, { name, color, icon }) {
    const folders = this._getFolderArray(library);
    const folder = {
      id: foundry.utils.randomID(),
      name,
      color,
      icon,
      order: folders.length
    };
    folders.push(folder);
    await this.saveAllData({ collections: [this._getFolderCollectionKey(library)] });
    debugLog(` Created folder "${name}" in ${library}`);
    return folder;
  }

  async updateFolder(library, id, data) {
    const folders = this._getFolderArray(library);
    const idx = folders.findIndex(f => f.id === id);
    if (idx === -1) return null;
    folders[idx] = { ...folders[idx], ...data };
    await this.saveAllData({ collections: [this._getFolderCollectionKey(library)] });
    return folders[idx];
  }

  async deleteFolder(library, id) {
    const folders = this._getFolderArray(library);
    this._setFolderArray(library, folders.filter(f => f.id !== id));
    // Unassign all tracks in this folder
    this._getTrackArray(library).forEach(track => {
      if (track.folderId === id) delete track.folderId;
    });
    await this.saveAllData({ collections: [library, this._getFolderCollectionKey(library)] });
    debugLog(` Deleted folder ${id} from ${library}`);
  }

  async moveTracksToFolder(library, trackIds, folderId) {
    const tracks = this._getTrackArray(library);
    for (const id of trackIds) {
      const track = tracks.find(t => t.id === id);
      if (track) {
        if (folderId) {
          track.folderId = folderId;
        } else {
          delete track.folderId;
        }
      }
    }
    await this.saveAllData({ collections: [library] });
  }

  async reorderFolders(library, orderedIds) {
    const folders = this._getFolderArray(library);
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const reordered = orderedIds.map((id, i) => {
      const f = folderMap.get(id);
      if (f) f.order = i;
      return f;
    }).filter(Boolean);
    this._setFolderArray(library, reordered);
    await this.saveAllData({ collections: [this._getFolderCollectionKey(library)] });
  }

  getFolders(library) {
    return [...this._getFolderArray(library)].sort((a, b) => a.order - b.order);
  }

  getFolder(library, id) {
    return this._getFolderArray(library).find(f => f.id === id);
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
    await this.saveAllData({ collections: ['ambiencePresets'] });
  }
}

// Export singleton instance
export const dataService = new DataService();

// Also export the class for testing purposes
export { DataService };
