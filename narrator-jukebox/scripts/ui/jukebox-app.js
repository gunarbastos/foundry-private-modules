/**
 * Narrator's Jukebox - Main Application
 * Refactored modular version of NarratorsJukeboxApp
 *
 * @module ui/jukebox-app
 */

// Core imports
import { JUKEBOX, MAX_AMBIENCE_LAYERS } from '../core/constants.js';
import { debounce } from '../utils/debounce.js';
import { formatTime } from '../utils/time-format.js';
import { format } from '../utils/i18n.js';

// Dialog imports
import * as Dialogs from './app-dialogs.js';

// Listener imports
import { activateListeners as activateModularListeners } from './app-listeners.js';

// Mode management imports
import * as ModeManager from './mode-manager.js';

// Progress management imports
import * as ProgressManager from './progress-manager.js';

// Partial updates imports
import * as PartialUpdates from './partial-updates.js';

// Duration loader
import { loadAndDisplayDurations } from '../utils/duration-loader.js';

/**
 * Main Jukebox Application Window
 * @extends Application
 */
export class NarratorsJukeboxApp extends Application {
  constructor(options = {}) {
    super(options);

    // Reference Singleton (will be set externally after initialization)
    this.jukebox = null;

    // Local UI State
    this.view = 'home';
    this.searchQuery = '';
    this.tagFilter = null;
    this.ambienceSearchQuery = '';
    this.ambienceTagFilter = null;
    this.selectedPlaylistId = null;
    this.selectedPresetId = null;

    // Multi-selection state
    this.selectionMode = false;
    this.selectedMusicIds = new Set();

    // Pagination state for large libraries
    this._musicDisplayLimit = 50;
    this._ambienceDisplayLimit = 50;
    this._miniDisplayLimit = 50;

    // Window mode state
    this._windowState = 'normal';
    this._preNormalPosition = null;
    this._preMiniPosition = null;
    this._microPosition = null;
    this._miniActiveTab = 'music';
    this._miniMusicView = 'library'; // 'library' or 'queue'
    this._miniSearchQuery = '';

    // Fullscreen/minimize state
    this._isFullscreen = false;
    this._preFullscreenPosition = null;

    // Progress tracking flags
    this._progressRAF = false;
    this._progressRAFId = null;
    this._ambienceProgressRAF = false;
    this._ambienceProgressRAFId = null;
    this.isDragging = false;
    this.isAmbienceDragging = false;

    // Debounced render for search
    this._debouncedRender = debounce(() => this.render(), 300);
  }

  /**
   * Set the jukebox singleton reference
   * @param {NarratorJukebox} jukebox - The jukebox singleton
   */
  setJukebox(jukebox) {
    this.jukebox = jukebox;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'narrator-jukebox',
      template: 'modules/narrator-jukebox/templates/jukebox-app.html',
      title: "Narrator's Jukebox",
      width: 1100,
      height: 900,
      minWidth: 950,
      minHeight: 650,
      resizable: true,
      classes: ['narrator-jukebox-window', 'narrator-jukebox-app']
    });
  }

  /**
   * Override template based on current window mode
   * @returns {string} Path to the appropriate template
   */
  get template() {
    switch (this._windowState) {
      case 'mini':
        return 'modules/narrator-jukebox/templates/mini-player.html';
      case 'micro':
        return 'modules/narrator-jukebox/templates/micro-player.html';
      default:
        return 'modules/narrator-jukebox/templates/jukebox-app.html';
    }
  }

  // ==========================================
  // Header Buttons
  // ==========================================

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    if (this._windowState === 'normal') {
      buttons.unshift(
        {
          label: "Mini Mode",
          class: "jb-minimize",
          icon: "fas fa-compress",
          onclick: () => this._enterMiniMode()
        },
        {
          label: "Maximize",
          class: "jb-maximize",
          icon: "fas fa-window-maximize",
          onclick: () => this._toggleMaximize()
        },
        {
          label: "Fullscreen",
          class: "jb-fullscreen",
          icon: "fas fa-expand",
          onclick: () => this._toggleFullscreen()
        }
      );
    }

    return buttons;
  }

  async _renderOuter() {
    const html = await super._renderOuter();

    if (this._windowState === 'normal') {
      html.find('.header-button.close').attr('data-tooltip', 'Close');
      html.find('.header-button.jb-minimize').attr('data-tooltip', 'Mini Mode');
      html.find('.header-button.jb-maximize').attr('data-tooltip', 'Maximize');
      html.find('.header-button.jb-fullscreen').attr('data-tooltip', 'Fullscreen');
    }

    return html;
  }

  // ==========================================
  // Window Mode Transitions (delegate to ModeManager)
  // ==========================================

  _enterMiniMode() {
    ModeManager.enterMiniMode(this);
  }

  _exitMiniMode() {
    ModeManager.exitMiniMode(this);
  }

  _enterMicroMode() {
    ModeManager.enterMicroMode(this);
  }

  _exitMicroMode() {
    ModeManager.exitMicroMode(this);
  }

  _exitMicroToNormal() {
    ModeManager.exitMicroToNormal(this);
  }

  _saveMicroPosition() {
    ModeManager.saveMicroPosition(this);
  }

  _loadMicroPosition() {
    return ModeManager.loadMicroPosition(this);
  }

  _initMicroDrag() {
    ModeManager.initMicroDrag(this);
  }

  _toggleMinimize() {
    if (this._windowState === 'mini') {
      this._exitMiniMode();
    } else {
      this._enterMiniMode();
    }
  }

  _toggleMaximize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (this._isFullscreen) {
      this._toggleFullscreen();
      return;
    }

    const isMaximized = this.position.width >= windowWidth - 100 &&
                        this.position.height >= windowHeight - 100;

    if (isMaximized && this._preFullscreenPosition) {
      this.setPosition(this._preFullscreenPosition);
      this._preFullscreenPosition = null;
      this.element.find('.jb-maximize i').removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else {
      this._preFullscreenPosition = { ...this.position };
      this.setPosition({
        left: 10,
        top: 10,
        width: windowWidth - 20,
        height: windowHeight - 20
      });
      this.element.find('.jb-maximize i').removeClass('fa-window-maximize').addClass('fa-window-restore');
    }
  }

  _toggleFullscreen() {
    if (this._isFullscreen) {
      this._isFullscreen = false;
      this.element.removeClass('jb-fullscreen-mode');
      if (this._preFullscreenPosition) {
        this.setPosition(this._preFullscreenPosition);
      }
      this.element.find('.jb-fullscreen i').removeClass('fa-compress').addClass('fa-expand');
    } else {
      this._preFullscreenPosition = { ...this.position };
      this._isFullscreen = true;
      this.element.addClass('jb-fullscreen-mode');
      this.setPosition({
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
      });
      this.element.find('.jb-fullscreen i').removeClass('fa-expand').addClass('fa-compress');
    }
  }

  // ==========================================
  // Progress Timers (delegate to ProgressManager)
  // ==========================================

  _startProgressTimer() {
    ProgressManager.startMusicProgress(this);
  }

  _stopProgressTimer() {
    ProgressManager.stopMusicProgress(this);
  }

  _startAmbienceProgressTimer() {
    ProgressManager.startAmbienceProgress(this);
  }

  _stopAmbienceProgressTimer() {
    ProgressManager.stopAmbienceProgress(this);
  }

  // ==========================================
  // Partial Updates (delegate to PartialUpdates)
  // ==========================================

  _updateNowPlaying(track) {
    PartialUpdates.updateNowPlayingInfo(this, track);
  }

  _updateAmbienceNowPlaying(track) {
    PartialUpdates.updateAmbienceInfo(this, track);
  }

  _updatePlaybackState() {
    PartialUpdates.updatePlaybackState(this);
  }

  _updatePlayButton(btn, isPlaying) {
    PartialUpdates.updatePlayButton(btn, isPlaying);
  }

  _updateModeToggle() {
    PartialUpdates.updateModeToggle(this);
  }

  // ==========================================
  // Duration Loading
  // ==========================================

  _loadTrackDurations(html) {
    loadAndDisplayDurations(this, html);
  }

  // ==========================================
  // Dialog Methods (delegate to Dialogs)
  // ==========================================

  async showAddMusicDialog() {
    Dialogs.showAddMusicDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showEditMusicDialog(id) {
    const track = this.jukebox.music.find(m => m.id === id);
    if (!track) return;

    Dialogs.showEditMusicDialog({
      trackId: id,
      jukebox: this.jukebox,
      onSuccess: () => this.render(),
      onDelete: () => this.render()
    });
  }

  async showAddAmbienceDialog() {
    Dialogs.showAddAmbienceDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showEditAmbienceDialog(id) {
    const track = this.jukebox.ambience.find(a => a.id === id);
    if (!track) return;

    Dialogs.showEditAmbienceDialog({
      trackId: id,
      jukebox: this.jukebox,
      onSuccess: () => this.render(),
      onDelete: () => this.render()
    });
  }

  async showAddSoundboardDialog() {
    Dialogs.showAddSoundboardDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showEditSoundboardDialog(id) {
    const sound = this.jukebox.soundboard.find(s => s.id === id);
    if (!sound) return;

    Dialogs.showEditSoundboardDialog({
      soundId: id,
      jukebox: this.jukebox,
      onSuccess: () => this.render(),
      onDelete: () => this.render()
    });
  }

  async showAddPlaylistDialog() {
    Dialogs.showAddPlaylistDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showAddToPlaylistDialog(musicId) {
    Dialogs.showAddToPlaylistDialog({
      musicId,
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showAddSelectedToPlaylistDialog(musicIds) {
    Dialogs.showAddSelectedToPlaylistDialog({
      musicIds,
      jukebox: this.jukebox,
      onSuccess: () => {
        this.exitSelectionMode();
        this.render();
      }
    });
  }

  async showBulkImportDialog(type = 'music') {
    Dialogs.showBulkImportDialog({
      type,
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showEditMoodsDialog() {
    Dialogs.showEditMoodsDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  async showSavePresetDialog() {
    Dialogs.showSavePresetDialog({
      jukebox: this.jukebox,
      onSuccess: () => this.render()
    });
  }

  // ==========================================
  // Suggestions (kept in class - simple logic)
  // ==========================================

  async approveSuggestion(index) {
    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];
    const suggestion = suggestions[index];
    if (!suggestion) return;

    await this.jukebox.addMusic({
      name: suggestion.name,
      url: suggestion.url,
      source: suggestion.source || 'local',
      tags: suggestion.tags || [],
      thumbnail: suggestion.thumbnail
    });

    suggestions.splice(index, 1);
    await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);
    ui.notifications.info(`Added "${suggestion.name}" to your library`);
    this.render();
  }

  async rejectSuggestion(index) {
    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];
    suggestions.splice(index, 1);
    await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);
    this.render();
  }

  // ==========================================
  // Multi-Selection Methods
  // ==========================================

  /**
   * Toggle selection mode on/off
   */
  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedMusicIds.clear();
    }
    this.render();
  }

  /**
   * Exit selection mode and clear selection
   */
  exitSelectionMode() {
    this.selectionMode = false;
    this.selectedMusicIds.clear();
    this.render();
  }

  /**
   * Toggle selection of a single track
   * @param {string} id - Music track ID
   */
  toggleTrackSelection(id) {
    if (this.selectedMusicIds.has(id)) {
      this.selectedMusicIds.delete(id);
    } else {
      this.selectedMusicIds.add(id);
    }
    // Don't re-render, just update UI directly for performance
    this._updateSelectionUI();
  }

  /**
   * Select a single track (for Ctrl+Click when not in selection mode)
   * @param {string} id - Music track ID
   */
  selectTrack(id) {
    if (!this.selectionMode) {
      this.selectionMode = true;
    }
    this.selectedMusicIds.add(id);
    this.render();
  }

  /**
   * Select a range of tracks (for Shift+Click)
   * @param {string} id - Target track ID
   * @param {string[]} visibleIds - Array of currently visible track IDs in order
   */
  selectRange(id, visibleIds) {
    if (this.selectedMusicIds.size === 0) {
      this.selectedMusicIds.add(id);
      this._updateSelectionUI();
      return;
    }

    // Find the last selected ID that's visible
    const lastSelectedId = [...this.selectedMusicIds].reverse().find(sid => visibleIds.includes(sid));
    if (!lastSelectedId) {
      this.selectedMusicIds.add(id);
      this._updateSelectionUI();
      return;
    }

    const startIndex = visibleIds.indexOf(lastSelectedId);
    const endIndex = visibleIds.indexOf(id);

    if (startIndex === -1 || endIndex === -1) return;

    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    for (let i = from; i <= to; i++) {
      this.selectedMusicIds.add(visibleIds[i]);
    }

    this._updateSelectionUI();
  }

  /**
   * Select all currently visible tracks
   * @param {string[]} visibleIds - Array of visible track IDs
   */
  selectAllVisible(visibleIds) {
    visibleIds.forEach(id => this.selectedMusicIds.add(id));
    this._updateSelectionUI();
  }

  /**
   * Deselect all tracks
   */
  deselectAll() {
    this.selectedMusicIds.clear();
    this._updateSelectionUI();
  }

  /**
   * Check if a track is selected
   * @param {string} id - Track ID
   * @returns {boolean}
   */
  isTrackSelected(id) {
    return this.selectedMusicIds.has(id);
  }

  /**
   * Get array of selected track IDs
   * @returns {string[]}
   */
  getSelectedTrackIds() {
    return [...this.selectedMusicIds];
  }

  /**
   * Update selection UI without full re-render (for performance)
   * @private
   */
  _updateSelectionUI() {
    if (!this.element || !this.element.length) return;

    const count = this.selectedMusicIds.size;

    // Update checkboxes
    this.element.find('.track-select-checkbox').each((i, el) => {
      const id = $(el).closest('.track-row').data('musicId');
      el.checked = this.selectedMusicIds.has(id);
    });

    // Update row highlights
    this.element.find('.track-row').each((i, el) => {
      const id = $(el).data('musicId');
      $(el).toggleClass('selected', this.selectedMusicIds.has(id));
    });

    // Update toolbar
    const toolbar = this.element.find('.selection-toolbar');
    if (count > 0) {
      toolbar.addClass('visible');
      toolbar.find('.selection-count').text(`${count} selected`);
    } else {
      toolbar.removeClass('visible');
    }

    // Update select all checkbox
    const visibleCount = this.element.find('.track-row[data-music-id]').length;
    const selectAllCheckbox = this.element.find('.select-all-checkbox');
    if (selectAllCheckbox.length) {
      selectAllCheckbox.prop('checked', count > 0 && count === visibleCount);
      selectAllCheckbox.prop('indeterminate', count > 0 && count < visibleCount);
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  formatTime(seconds) {
    return formatTime(seconds);
  }

  _getNextTrack() {
    if (this.jukebox.shuffle) return null;

    const currentId = this.jukebox.channels.music.currentTrack?.id;
    if (!currentId) return null;

    if (this.jukebox.currentPlaylist && this.jukebox.currentPlaylist.musicIds.length > 1) {
      const currentIndex = this.jukebox.currentPlaylist.musicIds.indexOf(currentId);
      let nextIndex = currentIndex + 1;

      if (nextIndex >= this.jukebox.currentPlaylist.musicIds.length) {
        if (this.jukebox.musicLoop) {
          nextIndex = 0;
        } else {
          return null;
        }
      }

      const nextId = this.jukebox.currentPlaylist.musicIds[nextIndex];
      return this.jukebox.music.find(m => m.id === nextId) || null;
    }

    if (this.jukebox.music && this.jukebox.music.length > 1) {
      const currentIndex = this.jukebox.music.findIndex(m => m.id === currentId);
      let nextIndex = currentIndex + 1;

      if (nextIndex >= this.jukebox.music.length) {
        if (this.jukebox.musicLoop) {
          nextIndex = 0;
        } else {
          return null;
        }
      }

      return this.jukebox.music[nextIndex] || null;
    }

    return null;
  }

  // ==========================================
  // Mini Mode Filter Helpers
  // ==========================================

  _getMiniFilteredMusic(music) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';
    const currentTrackId = this.jukebox.channels.music.currentTrack?.id;

    const filtered = music.filter(track => {
      if (!query) return true;
      return track.name.toLowerCase().includes(query) ||
             (track.tags || []).some(t => t.toLowerCase().includes(query));
    });

    return filtered.slice(0, this._miniDisplayLimit).map(track => ({
      ...track,
      isActive: track.id === currentTrackId,
      isPlaying: track.id === currentTrackId && this.jukebox.isPlaying
    }));
  }

  _getMiniFilteredAmbience(ambience) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';
    const currentAmbienceId = this.jukebox.channels.ambience.currentTrack?.id;

    const filtered = ambience.filter(track => {
      if (!query) return true;
      return track.name.toLowerCase().includes(query) ||
             (track.tags || []).some(t => t.toLowerCase().includes(query));
    });

    return filtered.slice(0, this._miniDisplayLimit).map(track => ({
      ...track,
      isActive: track.id === currentAmbienceId,
      isPlaying: track.id === currentAmbienceId && this.jukebox.isAmbiencePlaying,
      // Layer Mixer data
      isLayerActive: this.jukebox.isAmbienceLayerActive(track.id),
      layerVolume: Math.round((this.jukebox.getAmbienceLayerVolume(track.id) || 0.8) * 100)
    }));
  }

  /**
   * Get active ambience layers with full track data for mini mode display
   */
  _getMiniActiveAmbienceLayers(ambience) {
    const activeLayers = this.jukebox.getActiveAmbienceLayers();
    return activeLayers.map(layer => {
      const track = ambience.find(a => a.id === layer.trackId);
      return {
        ...layer,
        name: track?.name || 'Unknown',
        thumbnail: track?.thumbnail || null
      };
    });
  }

  _getMiniFilteredSoundboard(soundboard) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';

    const filtered = soundboard.filter(sound => {
      if (!query) return true;
      return sound.name.toLowerCase().includes(query);
    });

    return filtered.slice(0, this._miniDisplayLimit).map(sound => ({
      ...sound,
      isPlaying: this.jukebox.isSoundboardSoundPlaying(sound.id)
    }));
  }

  /**
   * Get tracks in the current playlist queue for mini mode display
   */
  _getMiniQueueTracks(music) {
    const playlist = this.jukebox.currentPlaylist;
    if (!playlist || !playlist.musicIds) return [];

    const currentTrackId = this.jukebox.channels.music.currentTrack?.id;
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';

    // Get tracks in playlist order
    let queueTracks = playlist.musicIds
      .map(id => music.find(m => m.id === id))
      .filter(t => t);

    // Apply search filter if any
    if (query) {
      queueTracks = queueTracks.filter(track =>
        track.name.toLowerCase().includes(query) ||
        (track.tags || []).some(t => t.toLowerCase().includes(query))
      );
    }

    // Find current track index
    const currentIndex = currentTrackId
      ? playlist.musicIds.indexOf(currentTrackId)
      : -1;

    return queueTracks.map((track, index) => {
      const originalIndex = playlist.musicIds.indexOf(track.id);
      return {
        ...track,
        isActive: track.id === currentTrackId,
        isPlaying: track.id === currentTrackId && this.jukebox.isPlaying,
        queuePosition: originalIndex + 1,
        isUpcoming: originalIndex > currentIndex,
        isPlayed: originalIndex < currentIndex
      };
    });
  }

  // ==========================================
  // getData - Template Data Provider
  // ==========================================

  getData() {
    const music = this.jukebox.music || [];
    const ambience = this.jukebox.ambience || [];
    const soundboard = this.jukebox.soundboard || [];
    const playlists = this.jukebox.playlists || [];
    const moods = game.settings.get(JUKEBOX.ID, "moods");
    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];

    // Get all unique tags
    const allTags = [...new Set(music.flatMap(m => (m.tags && Array.isArray(m.tags)) ? m.tags : []))].sort();
    const allAmbienceTags = [...new Set(ambience.flatMap(a => (a.tags && Array.isArray(a.tags)) ? a.tags : []))].sort();

    // Use the main search query for the current view
    const q = this.searchQuery?.toLowerCase() || '';

    // Filter music (for library and playlists views)
    let filteredMusic = music;
    if (q && (this.view === 'library' || this.view === 'home' || this.view === 'playlists')) {
      filteredMusic = filteredMusic.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (this.tagFilter) {
      filteredMusic = filteredMusic.filter(m => m.tags.includes(this.tagFilter));
    }

    // Track if filter is active
    const hasActiveFilter = (q && this.view === 'library') || this.tagFilter;
    const totalMusicCountUnfiltered = music.length;

    // Filter ambience (for ambience view)
    let filteredAmbience = ambience;
    if (q && this.view === 'ambience') {
      filteredAmbience = filteredAmbience.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (this.ambienceTagFilter) {
      filteredAmbience = filteredAmbience.filter(a => a.tags.includes(this.ambienceTagFilter));
    }

    // Filter soundboard (for soundboard view)
    let filteredSoundboard = soundboard;
    if (q && this.view === 'soundboard') {
      filteredSoundboard = filteredSoundboard.filter(s =>
        s.name.toLowerCase().includes(q)
      );
    }

    // Pagination
    const totalAmbienceCount = filteredAmbience.length;
    const paginatedAmbience = filteredAmbience.slice(0, this._ambienceDisplayLimit);
    const hasMoreAmbience = totalAmbienceCount > this._ambienceDisplayLimit;

    // Enrich ambience with layer state
    const enrichedAmbience = paginatedAmbience.map(a => ({
      ...a,
      isLayerActive: this.jukebox.isAmbienceLayerActive(a.id),
      layerVolume: Math.round((this.jukebox.getAmbienceLayerVolume(a.id) || 0.8) * 100)
    }));

    const totalMusicCount = filteredMusic.length;
    const paginatedMusic = filteredMusic.slice(0, this._musicDisplayLimit);
    const hasMoreMusic = totalMusicCount > this._musicDisplayLimit;

    // Recent music
    const recentMusic = [...music].reverse().slice(0, 6);

    // Auto-select first playlist
    if (!this.selectedPlaylistId && playlists.length > 0) {
      this.selectedPlaylistId = playlists[0].id;
    }

    // Enrich playlists
    let currentPlaylistData = null;
    if (this.jukebox.currentPlaylist) {
      currentPlaylistData = {
        ...this.jukebox.currentPlaylist,
        tracks: this.jukebox.currentPlaylist.musicIds.map(id => music.find(m => m.id === id)).filter(m => m)
      };
    }

    let selectedPlaylistData = null;
    if (this.selectedPlaylistId) {
      const selectedPl = playlists.find(p => p.id === this.selectedPlaylistId);
      if (selectedPl) {
        selectedPlaylistData = {
          ...selectedPl,
          tracks: selectedPl.musicIds.map(id => music.find(m => m.id === id)).filter(m => m),
          isPlaying: this.jukebox.currentPlaylist?.id === selectedPl.id && this.jukebox.isPlaying
        };
      }
    }

    // Playlist covers
    const playlistCovers = {};
    playlists.forEach(pl => {
      const tracks = (pl.musicIds || []).map(id => music.find(m => m.id === id)).filter(m => m);
      const thumbnails = tracks.slice(0, 4).map(t => t.thumbnail || null);
      while (thumbnails.length < 4) thumbnails.push(null);
      playlistCovers[pl.id] = thumbnails;
    });

    // Music -> playlists map
    const musicPlaylistMap = {};
    playlists.forEach(pl => {
      (pl.musicIds || []).forEach(musicId => {
        if (!musicPlaylistMap[musicId]) musicPlaylistMap[musicId] = [];
        musicPlaylistMap[musicId].push({ id: pl.id, name: pl.name });
      });
    });

    // Enrich music with playlist info
    const enrichedMusic = paginatedMusic.map(m => ({
      ...m,
      playlists: musicPlaylistMap[m.id] || []
    }));

    // Enrich soundboard (use filtered list)
    const enrichedSoundboard = filteredSoundboard.map(s => ({
      ...s,
      isPlaying: this.jukebox.isSoundboardSoundPlaying(s.id),
      isLooping: this.jukebox.activeSoundboardSounds.get(s.id)?.isLooping || this.jukebox.soundboardLoopState.get(s.id) || false
    }));

    return {
      view: this.view,
      isGM: game.user.isGM,
      music: enrichedMusic,
      ambience: enrichedAmbience,
      soundboard: enrichedSoundboard,
      soundboardBroadcastMode: this.jukebox.soundboardBroadcastMode,
      activeSoundboardCount: this.jukebox.activeSoundboardSounds.size,
      recentMusic: recentMusic,
      playlists: playlists,
      playlistCovers: playlistCovers,
      currentPlaylist: currentPlaylistData,
      selectedPlaylist: selectedPlaylistData,
      suggestions: suggestions,
      moods: moods,
      totalMusicCount,
      totalMusicCountUnfiltered,
      hasActiveFilter,
      hasMoreMusic,
      musicDisplayLimit: this._musicDisplayLimit,
      totalAmbienceCount,
      hasMoreAmbience,
      ambienceDisplayLimit: this._ambienceDisplayLimit,
      isPlaying: this.jukebox.isPlaying,
      isPreviewMode: this.jukebox.isPreviewMode,
      volume: this.jukebox.channels.music.volume * 100,
      shuffle: this.jukebox.shuffle,
      musicLoop: this.jukebox.musicLoop,
      isMuted: this.jukebox.isMuted,
      isAmbiencePlaying: this.jukebox.isAmbiencePlaying,
      ambienceVolume: this.jukebox.channels.ambience.volume * 100,
      ambienceLoop: this.jukebox.ambienceLoop,
      isAmbienceMuted: this.jukebox.isAmbienceMuted,
      currentTrack: this.jukebox.channels.music.currentTrack,
      currentMusic: this.jukebox.channels.music.currentTrack,
      hasTrack: !!this.jukebox.channels.music.currentTrack,
      currentAmbience: this.jukebox.channels.ambience.currentTrack,
      hasAmbience: !!this.jukebox.channels.ambience.currentTrack,
      nextMusic: this._getNextTrack(),
      searchQuery: this.searchQuery,
      tagFilter: this.tagFilter,
      allTags: allTags,
      ambienceSearchQuery: this.ambienceSearchQuery,
      ambienceTagFilter: this.ambienceTagFilter,
      allAmbienceTags: allAmbienceTags,
      windowMode: this._windowState,
      miniActiveTab: this._miniActiveTab,
      miniMusicView: this._miniMusicView,
      miniSearchQuery: this._miniSearchQuery,
      miniFilteredMusic: this._getMiniFilteredMusic(music),
      miniQueueTracks: this._getMiniQueueTracks(music),
      hasQueue: !!this.jukebox.currentPlaylist,
      miniFilteredAmbience: this._getMiniFilteredAmbience(ambience),
      miniFilteredSoundboard: this._getMiniFilteredSoundboard(soundboard),
      // Mini mode active layers (with track data)
      miniActiveAmbienceLayers: this._getMiniActiveAmbienceLayers(ambience),
      // Ambience Layer Mixer data
      ambienceLayerCount: this.jukebox.getAmbienceLayerCount(),
      maxAmbienceLayers: MAX_AMBIENCE_LAYERS,
      ambienceMasterVolume: Math.round(this.jukebox.getAmbienceMasterVolume() * 100),
      isAmbienceMasterMuted: this.jukebox.isAmbienceMasterMuted(),
      // Ambience Presets
      ambiencePresets: this.jukebox.getAmbiencePresets(),
      selectedPresetId: this.selectedPresetId,
      // Multi-selection state
      selectionMode: this.selectionMode,
      selectedMusicIds: [...this.selectedMusicIds],
      selectedCount: this.selectedMusicIds.size,
      selectedCountText: format('Selection.CountSelected', { count: this.selectedMusicIds.size })
    };
  }

  // ==========================================
  // Render Override - Preserve Scroll Position
  // ==========================================

  async _render(force = false, options = {}) {
    // Save scroll positions and focus state before re-render
    const scrollPositions = {};
    let searchWasFocused = false;
    let searchCursorPosition = 0;

    if (this.element && this.element.length) {
      // Save scroll positions
      const scrollableSelectors = ['.jb-main', '.content-area', '.soundboard-grid', '.track-list', '.playlist-tracks'];
      scrollableSelectors.forEach(selector => {
        const el = this.element.find(selector);
        if (el.length && el[0].scrollTop > 0) {
          scrollPositions[selector] = el[0].scrollTop;
        }
      });

      // Save search input focus state
      const searchInput = this.element.find('.search-input');
      if (searchInput.length && searchInput.is(':focus')) {
        searchWasFocused = true;
        searchCursorPosition = searchInput[0].selectionStart || 0;
      }
    }

    // Call parent render
    await super._render(force, options);

    // Restore scroll positions after render
    if (Object.keys(scrollPositions).length > 0) {
      for (const [selector, scrollTop] of Object.entries(scrollPositions)) {
        const el = this.element.find(selector);
        if (el.length) {
          el[0].scrollTop = scrollTop;
        }
      }
    }

    // Restore search input focus
    if (searchWasFocused) {
      const searchInput = this.element.find('.search-input');
      if (searchInput.length) {
        searchInput.focus();
        // Restore cursor position
        try {
          searchInput[0].setSelectionRange(searchCursorPosition, searchCursorPosition);
        } catch (e) {
          // Some browsers may not support setSelectionRange
        }
      }
    }
  }

  // ==========================================
  // activateListeners - Delegate to Modular System
  // ==========================================

  activateListeners(html) {
    super.activateListeners(html);

    // Use modular listener system
    activateModularListeners(this, html);
  }

  // ==========================================
  // Cleanup on Close
  // ==========================================

  async close(options = {}) {
    // Stop all progress timers
    ProgressManager.stopAllProgress(this);

    return super.close(options);
  }
}
