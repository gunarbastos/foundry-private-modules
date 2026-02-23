/**
 * Narrator's Jukebox - Premium Edition
 * A Spotify-inspired music player for Foundry VTT
 *
 * Refactored to use modular architecture - Phase 2
 */

// ==========================================
// Module Imports
// ==========================================

// Core modules
import { JUKEBOX, FADE_STEP, FADE_INTERVAL, YOUTUBE_VOLUME_STEP, YOUTUBE_FADE_INTERVAL, SOUNDBOARD_END_CHECK } from './core/constants.js';
import { AudioChannel } from './core/audio-channel.js';

// Utility modules
import { JukeboxBrowser } from './utils/browser-detection.js';
import { getFilePicker } from './utils/file-picker-compat.js';
import { formatTime, parseTimeInput, formatTimeForInput } from './utils/time-format.js';
import { extractYouTubeVideoId, extractYouTubeId, getYouTubeThumbnail, validateYouTubeUrl, isYouTubeUrl } from './utils/youtube-utils.js';
import { debounce } from './utils/debounce.js';

// Services (Phase 2 - available for future refactoring)
import { dataService } from './services/data-service.js';
import { playbackService } from './services/playback-service.js';
import { syncService } from './services/sync-service.js';
import { validateField, validateUrl } from './services/validation-service.js';

// Dialog modules (Phase 3)
import * as Dialogs from './ui/app-dialogs.js';

// Listener modules (Phase 4)
import { activateListeners as activateModularListeners } from './ui/app-listeners.js';

// UI Management modules (Phase 5)
import * as ModeManager from './ui/mode-manager.js';
import * as ProgressManager from './ui/progress-manager.js';
import * as PartialUpdates from './ui/partial-updates.js';
import { loadAndDisplayDurations } from './utils/duration-loader.js';

/* ==========================================
   Audio Channel Class - IMPORTED FROM MODULE
   The AudioChannel class is now in core/audio-channel.js
   It is imported above and used by NarratorJukebox below.
   ========================================== */

/* ==========================================
   REMOVED: AudioChannel class definition
   Now imported from './core/audio-channel.js'

   Old inline class removed to avoid duplication.
   The imported AudioChannel class provides the same interface:
   - constructor(name)
   - initialize()
   - play(track, startCallback)
   - playLocal(url), playYouTube(url)
   - stop(), pause(), resume()
   - setVolume(val), seek(percent)
   - get currentTime, get duration
   - fadeIn(), fadeOut(), etc.
   ========================================== */

/* ==========================================
   Main Application
   ========================================== */

class NarratorsJukeboxApp extends Application {
  constructor(options = {}) {
    super(options);

    // Reference Singleton
    this.jukebox = NarratorJukebox.instance;

    // Local UI State
    this.view = 'home';
    this.searchQuery = '';
    this.tagFilter = null;
    this.ambienceSearchQuery = '';
    this.ambienceTagFilter = null;
    this.selectedPlaylistId = null;  // For viewing playlist details without playing

    // Pagination state for large libraries (performance optimization)
    this._musicDisplayLimit = 50;      // Number of music tracks to display
    this._ambienceDisplayLimit = 50;   // Number of ambience tracks to display
    this._miniDisplayLimit = 50;       // Number of tracks in mini player

    // Create debounced render for search (300ms delay)
    this._debouncedRender = debounce(() => this.render(), 300);
  }

  /**
   * Get the next track that will play (for "Up Next" indicator)
   * Returns null if shuffle is on (unpredictable) or no next track
   */
  _getNextTrack() {
    // Don't show next if shuffle is on (it's random)
    if (this.jukebox.shuffle) return null;

    const currentId = this.jukebox.channels.music.currentTrack?.id;
    if (!currentId) return null;

    // Check playlist first
    if (this.jukebox.currentPlaylist && this.jukebox.currentPlaylist.musicIds.length > 1) {
      const currentIndex = this.jukebox.currentPlaylist.musicIds.indexOf(currentId);
      let nextIndex = currentIndex + 1;

      if (nextIndex >= this.jukebox.currentPlaylist.musicIds.length) {
        // If loop is on, next is the first track
        if (this.jukebox.musicLoop) {
          nextIndex = 0;
        } else {
          return null; // End of playlist
        }
      }

      const nextId = this.jukebox.currentPlaylist.musicIds[nextIndex];
      return this.jukebox.music.find(m => m.id === nextId) || null;
    }

    // No playlist: check library
    if (this.jukebox.music && this.jukebox.music.length > 1) {
      const currentIndex = this.jukebox.music.findIndex(m => m.id === currentId);
      let nextIndex = currentIndex + 1;

      if (nextIndex >= this.jukebox.music.length) {
        if (this.jukebox.musicLoop) {
          nextIndex = 0;
        } else {
          return null; // End of library
        }
      }

      return this.jukebox.music[nextIndex] || null;
    }

    return null;
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
      classes: ['narrator-jukebox-window']
    });
  }

  // Store pre-fullscreen position for restore
  _preFullscreenPosition = null;
  _isFullscreen = false;
  _isMinimized = false;
  _preMinimizePosition = null;

  // Mini Player Mode State Management
  _windowState = 'normal';      // 'normal' | 'mini' | 'micro'
  _preNormalPosition = null;    // Position before going to MINI/MICRO
  _preMiniPosition = null;      // Position in MINI mode (for MICRO restore)
  _microPosition = null;        // Persisted MICRO mode position
  _miniActiveTab = 'music';     // Currently selected tab in MINI mode
  _miniSearchQuery = '';        // Search query in MINI mode

  // Custom header buttons for window controls
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    // Only show window controls in NORMAL mode
    if (this._windowState === 'normal') {
      // Add window control buttons at the beginning
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

    // Add tooltip to close button after render
    return buttons;
  }

  // Add tooltips after the app is rendered
  async _renderOuter() {
    const html = await super._renderOuter();

    // Add tooltips to window control buttons (only in normal mode)
    if (this._windowState === 'normal') {
      html.find('.header-button.close').attr('data-tooltip', 'Close');
      html.find('.header-button.jb-minimize').attr('data-tooltip', 'Mini Mode');
      html.find('.header-button.jb-maximize').attr('data-tooltip', 'Maximize');
      html.find('.header-button.jb-fullscreen').attr('data-tooltip', 'Fullscreen');
    }

    return html;
  }

  // ==========================================
  // Mini Player Mode - State Transitions
  // ==========================================

  // Enter Mini Mode (NORMAL → MINI)
  _enterMiniMode() {
    if (this._windowState === 'mini') return;

    console.log('Narrator Jukebox | Entering Mini Mode');

    // Sync broadcast modes - mini player uses unified toggle for both music and soundboard
    // This ensures the states are consistent when entering mini mode
    this.jukebox.soundboardBroadcastMode = !this.jukebox.isPreviewMode;

    // Save current position if coming from normal
    if (this._windowState === 'normal') {
      this._preNormalPosition = { ...this.position };
    }

    // Exit fullscreen if active
    if (this._isFullscreen) {
      this._isFullscreen = false;
      this.element.removeClass('jb-fullscreen-mode');
    }

    this._windowState = 'mini';
    this.element.removeClass('jb-minimized jb-fullscreen-mode jb-micro-mode');
    this.element.addClass('jb-mini-mode');

    // Set mini mode dimensions
    this.setPosition({
      width: 400,
      height: 500
    });

    // Re-render with mini template
    this.render(true);
  }

  // Exit Mini Mode (MINI → NORMAL)
  _exitMiniMode() {
    if (this._windowState !== 'mini') return;

    console.log('Narrator Jukebox | Exiting Mini Mode');

    this._windowState = 'normal';
    this.element.removeClass('jb-mini-mode');

    // Restore position
    if (this._preNormalPosition) {
      this.setPosition(this._preNormalPosition);
    } else {
      this.setPosition({
        width: 1100,
        height: 900
      });
    }

    // Re-render with normal template
    this.render(true);
  }

  // Enter Micro Mode (MINI → MICRO)
  _enterMicroMode() {
    if (this._windowState === 'micro') return;

    console.log('Narrator Jukebox | Entering Micro Mode');

    // Save position based on current state
    if (this._windowState === 'mini') {
      this._preMiniPosition = { ...this.position };
    } else if (this._windowState === 'normal') {
      this._preNormalPosition = { ...this.position };
    }

    this._windowState = 'micro';
    this.element.removeClass('jb-mini-mode jb-fullscreen-mode jb-minimized');
    this.element.addClass('jb-micro-mode');

    // Load saved micro position or use default
    const savedPosition = this._loadMicroPosition();
    this.setPosition({
      width: 60,
      height: 60,
      left: savedPosition?.left ?? (window.innerWidth - 80),
      top: savedPosition?.top ?? 100
    });

    // Re-render with micro template
    this.render(true);

    // Initialize drag tracking after render
    setTimeout(() => this._initMicroDrag(), 100);
  }

  // Exit Micro Mode (MICRO → MINI)
  _exitMicroMode() {
    if (this._windowState !== 'micro') return;

    console.log('Narrator Jukebox | Exiting Micro Mode');

    // Save micro position
    this._saveMicroPosition();

    this._windowState = 'mini';
    this.element.removeClass('jb-micro-mode');
    this.element.addClass('jb-mini-mode');

    // Restore mini position
    if (this._preMiniPosition) {
      this.setPosition(this._preMiniPosition);
    } else {
      this.setPosition({
        width: 400,
        height: 500
      });
    }

    this.render(true);
  }

  // Exit Micro Mode directly to Normal (MICRO → NORMAL)
  _exitMicroToNormal() {
    if (this._windowState !== 'micro') return;

    console.log('Narrator Jukebox | Exiting Micro Mode to Normal');

    // Save micro position
    this._saveMicroPosition();

    this._windowState = 'normal';
    this.element.removeClass('jb-micro-mode');

    // Restore normal position
    if (this._preNormalPosition) {
      this.setPosition(this._preNormalPosition);
    } else {
      this.setPosition({
        width: 1100,
        height: 900
      });
    }

    this.render(true);
  }

  // Save micro position to localStorage
  _saveMicroPosition() {
    const position = {
      left: this.position.left,
      top: this.position.top
    };
    localStorage.setItem('narrator-jukebox-micro-position', JSON.stringify(position));
    this._microPosition = position;
  }

  // Load micro position from localStorage
  _loadMicroPosition() {
    if (this._microPosition) return this._microPosition;

    const saved = localStorage.getItem('narrator-jukebox-micro-position');
    if (saved) {
      try {
        this._microPosition = JSON.parse(saved);
        return this._microPosition;
      } catch (e) {
        console.warn('Narrator Jukebox | Failed to parse micro position', e);
      }
    }
    return null;
  }

  // Initialize micro mode drag tracking
  _initMicroDrag() {
    if (!this.element) return;

    const windowEl = this.element[0];
    const container = this.element.find('.narrator-jukebox-micro');
    if (!container.length) return;

    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startLeft, startTop;

    // Store reference to check if we're dragging (used by click handlers)
    this._microIsDragging = false;

    container.on('mousedown.microDrag', e => {
      // Don't start drag from buttons
      if ($(e.target).closest('button, .micro-controls, .micro-expand').length) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.position.left;
      startTop = this.position.top;

      windowEl.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    });

    $(document).on('mousemove.microDrag', e => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Only consider it a drag if moved more than 5 pixels
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
        this._microIsDragging = true;
      }

      if (hasMoved) {
        this.setPosition({
          left: startLeft + dx,
          top: startTop + dy
        });
      }
    });

    $(document).on('mouseup.microDrag', () => {
      if (isDragging) {
        isDragging = false;
        windowEl.style.cursor = '';

        if (hasMoved) {
          // Save position after drag
          setTimeout(() => {
            this._saveMicroPosition();
            this._microIsDragging = false;
          }, 50);
        } else {
          this._microIsDragging = false;
        }
      }
    });
  }

  // Legacy toggle minimize (kept for backwards compatibility, redirects to mini mode)
  _toggleMinimize() {
    if (this._windowState === 'mini') {
      this._exitMiniMode();
    } else {
      this._enterMiniMode();
    }
  }

  // Toggle maximize state
  _toggleMaximize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (this._isFullscreen) {
      // Exit fullscreen first
      this._toggleFullscreen();
      return;
    }

    // Check if currently maximized (roughly fills the window)
    const isMaximized = this.position.width >= windowWidth - 100 &&
                        this.position.height >= windowHeight - 100;

    if (isMaximized && this._preFullscreenPosition) {
      // Restore
      this.setPosition(this._preFullscreenPosition);
      this._preFullscreenPosition = null;
      this.element.find('.jb-maximize i').removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else {
      // Maximize
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

  // Toggle fullscreen state
  _toggleFullscreen() {
    if (this._isFullscreen) {
      // Exit fullscreen
      if (this._preFullscreenPosition) {
        this.setPosition(this._preFullscreenPosition);
      }
      this._isFullscreen = false;
      this.element.removeClass('jb-fullscreen-mode');
      this.element.find('.jb-fullscreen i').removeClass('fa-compress').addClass('fa-expand');
      this.element.find('.jb-maximize i').removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else {
      // Enter fullscreen
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

  // Force minimum size on every position update (based on mode)
  setPosition(options = {}) {
    // Handle different window modes
    switch (this._windowState) {
      case 'mini':
        // Force mini dimensions
        options.width = 400;
        options.height = 500;
        return super.setPosition(options);

      case 'micro':
        // Force micro dimensions
        options.width = 60;
        options.height = 60;
        return super.setPosition(options);

      default:
        // Normal mode - enforce minimum dimensions (unless old minimized state)
        if (this._isMinimized) {
          return super.setPosition(options);
        }

        const minHeight = 650;
        const minWidth = 950;

        // Enforce minimum dimensions
        if (options.height && options.height < minHeight) {
          options.height = minHeight;
        }
        if (options.width && options.width < minWidth) {
          options.width = minWidth;
        }

        // If no height specified or current height is too small, enforce minimum
        if (!options.height) {
          const currentHeight = this.position?.height || 0;
          if (currentHeight < minHeight) {
            options.height = minHeight;
          }
        }

        return super.setPosition(options);
    }
  }

  // Ensure proper size on first render
  async _render(force = false, options = {}) {
    await super._render(force, options);

    // Skip size enforcement for mini/micro modes (handled by setPosition)
    if (this._windowState === 'mini' || this._windowState === 'micro' || this._isMinimized) return;

    // Force minimum height after render (normal mode only)
    const minHeight = 650;
    if (this.element && this.element[0]) {
      const currentHeight = this.element[0].offsetHeight;
      if (currentHeight < minHeight) {
        this.setPosition({ height: minHeight });
      }
    }
  }

  // Dynamic template based on window state
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

  getData() {
    // Use instance data as source of truth
    const music = this.jukebox.music || [];
    const ambience = this.jukebox.ambience || [];  // Separate ambience library
    const soundboard = this.jukebox.soundboard || [];  // Soundboard sounds
    const playlists = this.jukebox.playlists || [];
    const moods = game.settings.get(JUKEBOX.ID, "moods");
    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];

    console.log("Narrator Jukebox | getData music count:", music.length, "ambience count:", ambience.length, "soundboard count:", soundboard.length);

    // Get all unique tags for music
    const allTags = [...new Set(music.flatMap(m => (m.tags && Array.isArray(m.tags)) ? m.tags : []))].sort();

    // Get all unique tags for ambience
    const allAmbienceTags = [...new Set(ambience.flatMap(a => (a.tags && Array.isArray(a.tags)) ? a.tags : []))].sort();

    // Filter Logic for Music
    let filteredMusic = music;
    if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        filteredMusic = filteredMusic.filter(m =>
            m.name.toLowerCase().includes(q) ||
            (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    if (this.tagFilter) {
        filteredMusic = filteredMusic.filter(m => m.tags.includes(this.tagFilter));
    }

    // Filter Logic for Ambience
    let filteredAmbience = ambience;
    if (this.ambienceSearchQuery) {
        const q = this.ambienceSearchQuery.toLowerCase();
        filteredAmbience = filteredAmbience.filter(a =>
            a.name.toLowerCase().includes(q) ||
            (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    if (this.ambienceTagFilter) {
        filteredAmbience = filteredAmbience.filter(a => a.tags.includes(this.ambienceTagFilter));
    }

    // Apply pagination to ambience for performance
    const totalAmbienceCount = filteredAmbience.length;
    const paginatedAmbience = filteredAmbience.slice(0, this._ambienceDisplayLimit);
    const hasMoreAmbience = totalAmbienceCount > this._ambienceDisplayLimit;

    // Recent Music (Last 6)
    const recentMusic = [...music].reverse().slice(0, 6);

    // Enrich Current Playlist with Track Data (the one playing)
    let currentPlaylistData = null;
    if (this.jukebox.currentPlaylist) {
        currentPlaylistData = {
            ...this.jukebox.currentPlaylist,
            tracks: this.jukebox.currentPlaylist.musicIds.map(id => music.find(m => m.id === id)).filter(m => m)
        };
    }

    // Auto-select first playlist if none selected and playlists exist
    if (!this.selectedPlaylistId && playlists.length > 0) {
        this.selectedPlaylistId = playlists[0].id;
    }

    // Enrich Selected Playlist with Track Data (the one being viewed)
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

    // Build playlist covers map (first 4 thumbnails for each playlist)
    const playlistCovers = {};
    playlists.forEach(pl => {
        const tracks = (pl.musicIds || []).map(id => music.find(m => m.id === id)).filter(m => m);
        const thumbnails = tracks.slice(0, 4).map(t => t.thumbnail || null);
        // Pad to 4 items if needed
        while (thumbnails.length < 4) {
            thumbnails.push(null);
        }
        playlistCovers[pl.id] = thumbnails;
    });

    // Build a map of music ID -> playlists it belongs to (for library indicators)
    const musicPlaylistMap = {};
    playlists.forEach(pl => {
        (pl.musicIds || []).forEach(musicId => {
            if (!musicPlaylistMap[musicId]) {
                musicPlaylistMap[musicId] = [];
            }
            musicPlaylistMap[musicId].push({ id: pl.id, name: pl.name });
        });
    });

    // Enrich filtered music with playlist info (with pagination for performance)
    const totalMusicCount = filteredMusic.length;
    const paginatedMusic = filteredMusic.slice(0, this._musicDisplayLimit);
    const enrichedMusic = paginatedMusic.map(m => ({
        ...m,
        playlists: musicPlaylistMap[m.id] || []
    }));
    const hasMoreMusic = totalMusicCount > this._musicDisplayLimit;

    // Enrich soundboard with playing state and UI state
    const enrichedSoundboard = soundboard.map(s => ({
        ...s,
        isPlaying: this.jukebox.isSoundboardSoundPlaying(s.id),
        isLooping: this.jukebox.activeSoundboardSounds.get(s.id)?.isLooping || this.jukebox.soundboardLoopState.get(s.id) || false
    }));

    // Count active soundboard sounds
    const activeSoundboardCount = this.jukebox.activeSoundboardSounds.size;

    return {
        view: this.view,
        isGM: game.user.isGM,
        music: enrichedMusic,
        ambience: paginatedAmbience,  // Paginated ambience library
        soundboard: enrichedSoundboard,  // Soundboard sounds with playing state
        soundboardBroadcastMode: this.jukebox.soundboardBroadcastMode,  // Global broadcast mode
        activeSoundboardCount: activeSoundboardCount,
        recentMusic: recentMusic,
        playlists: playlists,
        playlistCovers: playlistCovers,
        currentPlaylist: currentPlaylistData,
        selectedPlaylist: selectedPlaylistData,
        suggestions: suggestions,
        moods: moods,

        // Pagination info for large libraries
        totalMusicCount: totalMusicCount,
        hasMoreMusic: hasMoreMusic,
        musicDisplayLimit: this._musicDisplayLimit,
        totalAmbienceCount: totalAmbienceCount,
        hasMoreAmbience: hasMoreAmbience,
        ambienceDisplayLimit: this._ambienceDisplayLimit,

        // Player State - Music
        isPlaying: this.jukebox.isPlaying,
        isPreviewMode: this.jukebox.isPreviewMode,
        volume: this.jukebox.channels.music.volume * 100,
        shuffle: this.jukebox.shuffle,
        musicLoop: this.jukebox.musicLoop,
        isMuted: this.jukebox.isMuted,

        // Player State - Ambience
        isAmbiencePlaying: this.jukebox.isAmbiencePlaying,
        ambienceVolume: this.jukebox.channels.ambience.volume * 100,
        ambienceLoop: this.jukebox.ambienceLoop,
        isAmbienceMuted: this.jukebox.isAmbienceMuted,

        // Track Info
        currentTrack: this.jukebox.channels.music.currentTrack,
        currentMusic: this.jukebox.channels.music.currentTrack,  // Alias for template compatibility
        hasTrack: !!this.jukebox.channels.music.currentTrack,
        currentAmbience: this.jukebox.channels.ambience.currentTrack,
        hasAmbience: !!this.jukebox.channels.ambience.currentTrack,

        // Next track info (for "Up Next" indicator)
        nextMusic: this._getNextTrack(),

        // Filters
        searchQuery: this.searchQuery,
        tagFilter: this.tagFilter,
        allTags: allTags,
        ambienceSearchQuery: this.ambienceSearchQuery,
        ambienceTagFilter: this.ambienceTagFilter,
        allAmbienceTags: allAmbienceTags,

        // Mini Player Mode Data
        windowMode: this._windowState,
        miniActiveTab: this._miniActiveTab,
        miniSearchQuery: this._miniSearchQuery,

        // Mini mode filtered data (with active/playing states) - also paginated
        miniFilteredMusic: this._getMiniFilteredMusic(music),
        miniFilteredAmbience: this._getMiniFilteredAmbience(ambience),
        miniFilteredSoundboard: this._getMiniFilteredSoundboard(soundboard)
    };
  }

  // Get filtered music for mini mode with active/playing states (paginated)
  _getMiniFilteredMusic(music) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';
    const currentTrackId = this.jukebox.channels.music.currentTrack?.id;

    const filtered = music.filter(track => {
      if (!query) return true;
      return track.name.toLowerCase().includes(query) ||
             (track.tags || []).some(t => t.toLowerCase().includes(query));
    });

    // Apply pagination for performance
    return filtered.slice(0, this._miniDisplayLimit).map(track => ({
      ...track,
      isActive: track.id === currentTrackId,
      isPlaying: track.id === currentTrackId && this.jukebox.isPlaying
    }));
  }

  // Get filtered ambience for mini mode with active/playing states (paginated)
  _getMiniFilteredAmbience(ambience) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';
    const currentAmbienceId = this.jukebox.channels.ambience.currentTrack?.id;

    const filtered = ambience.filter(track => {
      if (!query) return true;
      return track.name.toLowerCase().includes(query) ||
             (track.tags || []).some(t => t.toLowerCase().includes(query));
    });

    // Apply pagination for performance
    return filtered.slice(0, this._miniDisplayLimit).map(track => ({
      ...track,
      isActive: track.id === currentAmbienceId,
      isPlaying: track.id === currentAmbienceId && this.jukebox.isAmbiencePlaying
    }));
  }

  // Get filtered soundboard for mini mode with playing states (paginated)
  _getMiniFilteredSoundboard(soundboard) {
    const query = this._miniSearchQuery?.toLowerCase()?.trim() || '';

    const filtered = soundboard.filter(sound => {
      if (!query) return true;
      return sound.name.toLowerCase().includes(query);
    });

    // Apply pagination for performance
    return filtered.slice(0, this._miniDisplayLimit).map(sound => ({
      ...sound,
      isPlaying: this.jukebox.isSoundboardSoundPlaying(sound.id)
    }));
  }

  activateListeners(html) {
    super.activateListeners(html);

    /* ==========================================
       PHASE 4 MODULAR LISTENERS AVAILABLE
       The listener modules are imported and ready for use:
       - activateModularListeners(this, html)

       For gradual migration, the original inline listeners
       remain below. In Phase 6, this will be replaced with:
       activateModularListeners(this, html);
       return;
       ========================================== */

    // Route to appropriate listeners based on window mode
    switch (this._windowState) {
      case 'mini':
        this._activateMiniListeners(html);
        return;
      case 'micro':
        this._activateMicroListeners(html);
        return;
      default:
        // Continue with normal mode listeners below
        break;
    }

    // ========== NORMAL MODE LISTENERS ==========

    // Cache frequently accessed elements
    const viewSections = html.find('.view-section');
    const navItems = html.find('.nav-item');
    const progressFillEl = html.find('#progress-fill');
    const currentTimeEl = html.find('#current-time');

    // Navigation
    navItems.click(e => {
        const view = e.currentTarget.dataset.view;
        this.view = view;
        viewSections.addClass('hidden');
        html.find(`#view-${view}`).removeClass('hidden');
        navItems.removeClass('active');
        $(e.currentTarget).addClass('active');
    });

    // Load More button for pagination (large libraries)
    html.find('.load-more-btn').click(e => {
        const type = e.currentTarget.dataset.type;
        if (type === 'music') {
            this._musicDisplayLimit += 50;
        } else if (type === 'ambience') {
            this._ambienceDisplayLimit += 50;
        }
        this.render(false);
    });

    // Mood Cards
    html.find('.mood-card').click(async e => {
        const tag = e.currentTarget.dataset.tag;
        await this.jukebox.playRandomByTag(tag);
        // Partial update instead of full render
        this._updateNowPlaying(this.jukebox.channels.music.currentTrack);
        this._updatePlaybackState();
    });

    html.find('.edit-moods-btn').click(() => this.showEditMoodsDialog());

    // Suggestions
    html.find('.approve-suggestion').click(async e => {
        const index = e.currentTarget.dataset.index;
        await this.approveSuggestion(index);
    });
    
    html.find('.reject-suggestion').click(async e => {
        const index = e.currentTarget.dataset.index;
        await this.rejectSuggestion(index);
    });

    // Play Controls
    html.find('#play-pause-btn').click((e) => { 
        this.jukebox.togglePlay('music'); 
        this._updatePlayButton(e.currentTarget, this.jukebox.isPlaying);
    });

    html.find('#next-btn').click(() => { 
        this.jukebox.next(); 
        // Next triggers a track change which calls render() anyway via playMusic
    });

    html.find('#prev-btn').click(() => { 
        this.jukebox.prev(); 
        // Prev triggers a track change which calls render() anyway via playMusic
    });

    html.find('#shuffle-btn').click((e) => { 
        this.jukebox.toggleShuffle(); 
        $(e.currentTarget).find('i').toggleClass('active', this.jukebox.shuffle);
        e.currentTarget.title = `Shuffle ${this.jukebox.shuffle ? '(On)' : '(Off)'}`;
    });

    html.find('#loop-btn').click((e) => {
        this.jukebox.toggleMusicLoop();
        $(e.currentTarget).find('i').toggleClass('active', this.jukebox.musicLoop);
        e.currentTarget.title = `Loop ${this.jukebox.musicLoop ? '(On)' : '(Off)'}`;
    });

    // Ambience Loop Toggle
    html.find('#ambience-loop-btn').click((e) => {
        this.jukebox.toggleAmbienceLoop();
        $(e.currentTarget).find('i').toggleClass('active', this.jukebox.ambienceLoop);
        e.currentTarget.title = `Ambience Loop ${this.jukebox.ambienceLoop ? '(On)' : '(Off)'}`;
    });

    // Volume
    html.find('#volume-slider').on('input', e => {
        const vol = parseFloat(e.target.value) / 100;
        this.jukebox.setVolume(vol, 'music');
    });

    // Mute Button
    html.find('#mute-btn').on('click', () => {
        this.jukebox.toggleMute('music');
    });

    // Progress Bar Interaction
    const progressBar = html.find('#progress-bar');
    
    // Initialize dragging state if not present
    if (this.isDragging === undefined) this.isDragging = false;

    progressBar.on('mousedown', () => {
        this.isDragging = true;
    });

    progressBar.on('input', e => {
        this.isDragging = true; // Ensure state
        const percent = e.target.value;
        progressFillEl.css('width', `${percent}%`);

        // Update time text while dragging
        const duration = this.jukebox.channels.music.duration;
        if (duration) {
            const currentTime = (percent / 100) * duration;
            currentTimeEl.text(this.formatTime(currentTime));
        }
    });

    progressBar.on('change', e => {
        const percent = e.target.value;
        this.jukebox.channels.music.seek(percent);
        
        // Small delay to prevent timer from jumping back immediately
        setTimeout(() => {
            this.isDragging = false;
        }, 200);
    });
    
    progressBar.on('mouseup', () => {
        // Handled by change usually, but safe to have
        setTimeout(() => {
            this.isDragging = false;
        }, 200);
    });

    // Event delegation for dynamically rendered track items (more efficient)
    html.on('click', '.play-music-btn', e => {
        const id = e.currentTarget.dataset.musicId;
        if (!id) return;

        // Check if clicking on the currently active track
        const currentTrackId = this.jukebox.channels.music.currentTrack?.id;
        if (id === currentTrackId) {
            // Toggle play/pause for current track
            this.jukebox.togglePlay('music');
            this.render(false);
        } else {
            // Play the new track
            this.jukebox.playMusic(id);
        }
    });

    // Event delegation for playlist browser items - click to view
    html.on('click', '.playlist-browser-item', e => {
        e.stopPropagation();
        // Don't trigger if clicking on play button
        if ($(e.target).closest('.playlist-browser-play').length) return;

        const id = e.currentTarget.dataset.playlistId;
        if (id) {
            this.selectedPlaylistId = id;
            this.render();
        }
    });

    // Inline play button in playlist browser (play/pause toggle)
    html.on('click', '.playlist-browser-play', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        // Check if this is the current playlist
        const isThisPlaylist = this.jukebox.currentPlaylist?.id === id;

        if (isThisPlaylist) {
            // Toggle play/pause for the current playlist
            this.jukebox.togglePlay('music');
            this.render();
        } else {
            // Start playing this playlist
            this.jukebox.playPlaylist(id);
        }
    });

    // Dedicated play button for playlist (toggles play/pause if same playlist)
    html.on('click', '.play-playlist-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        // Check if this is the current playlist
        const isThisPlaylist = this.jukebox.currentPlaylist?.id === id;

        if (isThisPlaylist) {
            // Toggle play/pause for the current playlist
            this.jukebox.togglePlay('music');
            this.render();
        } else {
            // Start playing this playlist from the beginning
            this.jukebox.playPlaylist(id);
        }
    });

    // Shuffle play button for playlist
    html.on('click', '.playlist-shuffle-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (id) {
            this.jukebox.shuffle = true;
            this.jukebox.playPlaylist(id);
            ui.notifications.info("Shuffle mode enabled");
        }
    });

    // Delete playlist button (in playlist detail header)
    html.on('click', '.playlist-delete-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const playlist = this.jukebox.playlists.find(p => p.id === id);
        if (!playlist) return;

        Dialog.confirm({
            title: "Delete Playlist",
            content: `<p>Are you sure you want to delete "<strong>${playlist.name}</strong>"? This action cannot be undone.</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                this.jukebox.deletePlaylist(id);
                // Clear selection and select next available playlist
                if (this.selectedPlaylistId === id) {
                    const remainingPlaylists = this.jukebox.playlists.filter(p => p.id !== id);
                    this.selectedPlaylistId = remainingPlaylists.length > 0 ? remainingPlaylists[0].id : null;
                }
                this.render();
            }
        });
    });

    // Right-click context menu for playlist browser items
    html.on('contextmenu', '.playlist-browser-item', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.dataset.playlistId;
        if (!id) return;

        const playlist = this.jukebox.playlists.find(p => p.id === id);
        if (!playlist) return;

        // Remove any existing context menu
        $('.nj-context-menu').remove();

        // Create context menu
        const menu = $(`
            <div class="nj-context-menu">
                <div class="nj-context-item" data-action="play">
                    <i class="fas fa-play"></i> Play
                </div>
                <div class="nj-context-item" data-action="shuffle">
                    <i class="fas fa-random"></i> Shuffle Play
                </div>
                <div class="nj-context-divider"></div>
                <div class="nj-context-item danger" data-action="delete">
                    <i class="fas fa-trash"></i> Delete Playlist
                </div>
            </div>
        `);

        // Position menu at cursor
        menu.css({
            top: e.clientY + 'px',
            left: e.clientX + 'px'
        });

        // Add to body
        $('body').append(menu);

        // Handle menu item clicks
        menu.on('click', '.nj-context-item', evt => {
            const action = evt.currentTarget.dataset.action;
            menu.remove();

            switch (action) {
                case 'play':
                    this.jukebox.playPlaylist(id);
                    break;
                case 'shuffle':
                    this.jukebox.shuffle = true;
                    this.jukebox.playPlaylist(id);
                    ui.notifications.info("Shuffle mode enabled");
                    break;
                case 'delete':
                    Dialog.confirm({
                        title: "Delete Playlist",
                        content: `<p>Are you sure you want to delete "<strong>${playlist.name}</strong>"? This action cannot be undone.</p>`,
                        classes: ['narrator-jukebox-dialog'],
                        yes: () => {
                            this.jukebox.deletePlaylist(id);
                            // Clear selection if deleting the selected playlist
                            if (this.selectedPlaylistId === id) {
                                this.selectedPlaylistId = null;
                            }
                            this.render();
                        }
                    });
                    break;
            }
        });

        // Close menu when clicking outside
        $(document).one('click', () => menu.remove());
    });

    // Add Music
    html.find('.add-music-btn').not('.bulk-import-btn').click(() => this.showAddMusicDialog());
    html.find('.add-playlist-btn').click(() => this.showAddPlaylistDialog());

    // Bulk Import
    html.find('.bulk-import-btn').click((e) => {
        const type = $(e.currentTarget).data('type');
        this.showBulkImportDialog(type);
    });
    
    // Search (with debounce to avoid excessive re-renders)
    const searchInput = html.find('.search-input');
    const searchClear = html.find('.search-clear');
    const searchBar = html.find('.search-bar');

    searchInput.on('input', e => {
        this.searchQuery = e.target.value;

        // Reset pagination when search changes (show first results)
        this._musicDisplayLimit = 50;

        // Update clear button visibility immediately (no re-render needed)
        if (this.searchQuery) {
            searchClear.removeClass('hidden');
            searchBar.addClass('has-query');
        } else {
            searchClear.addClass('hidden');
            searchBar.removeClass('has-query');
        }

        // Debounced filter update
        this._debouncedRender();
    });

    // Clear search button
    searchClear.on('click', () => {
        this.searchQuery = '';
        searchInput.val('');
        searchClear.addClass('hidden');
        searchBar.removeClass('has-query');
        searchInput.focus();
        this.render();
    });

    // Allow ESC key to clear search
    searchInput.on('keydown', e => {
        if (e.key === 'Escape') {
            if (this.searchQuery) {
                this.searchQuery = '';
                searchInput.val('');
                searchClear.addClass('hidden');
                searchBar.removeClass('has-query');
                this.render();
            }
        }
    });

    // Tag filter (immediate update)
    html.find('.tag-filter').on('change', e => {
        this.tagFilter = e.target.value;
        // Reset pagination when filter changes
        this._musicDisplayLimit = 50;
        this.render();
    });
    
    // Mode Toggle Switch (new header toggle)
    html.find('.toggle-switch').click(e => {
        // Toggle the mode
        this.jukebox.isPreviewMode = !this.jukebox.isPreviewMode;
        // Sync soundboard broadcast mode for consistency (mini player uses unified toggle)
        this.jukebox.soundboardBroadcastMode = !this.jukebox.isPreviewMode;

        // Update toggle with animation
        this._updateModeToggle();

        // Show notification
        const mode = this.jukebox.isPreviewMode ? 'preview' : 'broadcast';
        const modeText = mode === 'preview' ? 'Preview Mode' : 'Broadcast Mode';
        const modeDesc = mode === 'preview' ? 'Only you will hear the music and sounds' : 'All players will hear the music and sounds';
        ui.notifications.info(`${modeText}: ${modeDesc}`);
    });

    // Also allow clicking on the labels to toggle
    html.find('.mode-label').click(e => {
        const isPreviewLabel = $(e.currentTarget).hasClass('preview-label');
        const isBroadcastLabel = $(e.currentTarget).hasClass('broadcast-label');

        // Only toggle if clicking the inactive label
        if ((isPreviewLabel && !this.jukebox.isPreviewMode) ||
            (isBroadcastLabel && this.jukebox.isPreviewMode)) {
            this.jukebox.isPreviewMode = isPreviewLabel;
            // Sync soundboard broadcast mode for consistency (mini player uses unified toggle)
            this.jukebox.soundboardBroadcastMode = !isPreviewLabel;
            this._updateModeToggle();

            const modeText = isPreviewLabel ? 'Preview Mode' : 'Broadcast Mode';
            const modeDesc = isPreviewLabel ? 'Only you will hear the music and sounds' : 'All players will hear the music and sounds';
            ui.notifications.info(`${modeText}: ${modeDesc}`);
        }
    });
    
    // Ambience Player Bar Controls
    html.find('#ambience-play-btn').click((e) => {
        this.jukebox.togglePlay('ambience');
        const icon = $(e.currentTarget).find('i');
        if (this.jukebox.isAmbiencePlaying) {
            icon.removeClass('fa-play').addClass('fa-pause');
        } else {
            icon.removeClass('fa-pause').addClass('fa-play');
        }
    });

    html.find('#ambience-stop-btn').click(() => {
        this.jukebox.stop('ambience');
        this.render();
    });

    html.find('#ambience-volume-slider').on('input', e => {
        const vol = parseFloat(e.target.value) / 100;
        this.jukebox.setVolume(vol, 'ambience');
    });

    html.find('#ambience-mute-btn').on('click', () => {
        this.jukebox.toggleMute('ambience');
    });

    // Event delegation for ambience library tracks
    html.on('click', '.play-ambience-btn', async e => {
        const id = e.currentTarget.dataset.ambienceId;
        if (id) {
            await this.jukebox.playMusic(id, 'ambience');
            this._updateAmbienceNowPlaying(this.jukebox.channels.ambience.currentTrack);
            this._updatePlaybackState();
        }
    });

    // Ambience track management (edit/delete)
    html.on('click', '.edit-ambience-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.ambienceId;
        if (id) this.showEditAmbienceDialog(id);
    });

    html.on('click', '.delete-ambience-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.ambienceId;
        if (!id) return;

        Dialog.confirm({
            title: "Delete Ambience",
            content: "<p>Are you sure you want to delete this ambience? This action cannot be undone.</p>",
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                this.jukebox.deleteAmbience(id);
                this.render();
            }
        });
    });

    // Add Ambience button
    html.find('.add-ambience-btn').click(() => this.showAddAmbienceDialog());

    // Event delegation for track management buttons
    html.on('click', '.edit-track-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (id) this.showEditMusicDialog(id);
    });

    html.on('click', '.delete-track-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (!id) return;

        Dialog.confirm({
            title: "Delete Track",
            content: "<p>Are you sure you want to delete this track? This action cannot be undone.</p>",
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                this.jukebox.deleteMusic(id);
                this.render();
            }
        });
    });

    html.on('click', '.add-to-playlist-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (id) this.showAddToPlaylistDialog(id);
    });

    html.on('click', '.remove-from-playlist-btn', e => {
        e.stopPropagation();
        const musicId = e.currentTarget.dataset.musicId;
        const playlistId = e.currentTarget.dataset.playlistId;
        if (musicId && playlistId) {
            this.jukebox.removeFromPlaylist(playlistId, musicId);
        }
    });

    // ==========================================
    // Soundboard Event Listeners
    // ==========================================

    // Add Soundboard Sound button
    html.find('.add-soundboard-btn').click(() => this.showAddSoundboardDialog());

    // Stop All Sounds button
    html.find('.stop-all-sounds-btn').click(() => {
        this.jukebox.stopAllSoundboardSounds();
        ui.notifications.info("All soundboard sounds stopped");
    });

    // Global Broadcast Mode Toggle
    html.on('click', '.broadcast-toggle-btn', e => {
        e.stopPropagation();
        this.jukebox.soundboardBroadcastMode = !this.jukebox.soundboardBroadcastMode;
        this.render(false);  // Re-render to update the toggle visual
    });

    // Play soundboard sound (click on card)
    html.on('click', '.soundboard-card .sb-play-btn', e => {
        e.stopPropagation();
        const card = $(e.currentTarget).closest('.soundboard-card');
        const id = card.data('soundId');

        // Read loop state from the card's button
        const isLooping = card.find('.sb-loop-btn').hasClass('active');
        // Use global broadcast mode
        const isBroadcast = this.jukebox.soundboardBroadcastMode;

        if (this.jukebox.isSoundboardSoundPlaying(id)) {
            this.jukebox.stopSoundboardSound(id);
        } else {
            // Store the loop state before playing (so it persists after render)
            this.jukebox.soundboardLoopState.set(id, isLooping);

            this.jukebox.playSoundboardSound(id, { loop: isLooping, preview: !isBroadcast });
        }
    });

    // Toggle loop mode on card
    html.on('click', '.soundboard-card .sb-loop-btn', e => {
        e.stopPropagation();
        const btn = $(e.currentTarget);
        btn.toggleClass('active');

        const card = btn.closest('.soundboard-card');
        const id = card.data('soundId');

        // Store state
        this.jukebox.soundboardLoopState.set(id, btn.hasClass('active'));

        // If sound is currently playing, restart with new loop setting
        if (this.jukebox.isSoundboardSoundPlaying(id)) {
            // Use global broadcast mode
            const isBroadcast = this.jukebox.soundboardBroadcastMode;
            this.jukebox.stopSoundboardSound(id, false);
            this.jukebox.playSoundboardSound(id, {
                loop: btn.hasClass('active'),
                preview: !isBroadcast
            });
        }
    });

    // Edit soundboard sound
    html.on('click', '.soundboard-card .sb-edit-btn', e => {
        e.stopPropagation();
        const id = $(e.currentTarget).closest('.soundboard-card').data('soundId');
        if (id) this.showEditSoundboardDialog(id);
    });

    // Delete soundboard sound
    html.on('click', '.soundboard-card .sb-delete-btn', e => {
        e.stopPropagation();
        const id = $(e.currentTarget).closest('.soundboard-card').data('soundId');
        if (!id) return;

        const sound = this.jukebox.soundboard.find(s => s.id === id);
        Dialog.confirm({
            title: "Delete Sound",
            content: `<p>Are you sure you want to delete "${sound?.name || 'this sound'}"?</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                this.jukebox.deleteSoundboardSound(id);
                this.render();
            }
        });
    });

    this._startProgressTimer();
    this._startAmbienceProgressTimer();

    // Load track durations asynchronously
    this._loadTrackDurations(html);
  }

  // ==========================================
  // Mini Player Mode Listeners
  // ==========================================
  _activateMiniListeners(html) {
    // Tab switching - also switches the player bar
    html.find('.mini-tab').click(e => {
      const tab = e.currentTarget.dataset.tab;
      this._miniActiveTab = tab;

      // Update tabs UI
      html.find('.mini-tab').removeClass('active');
      $(e.currentTarget).addClass('active');

      // Update content panels
      html.find('.mini-tab-panel').addClass('hidden');
      html.find(`[data-panel="${tab}"]`).removeClass('hidden');

      // Update player bar sections
      html.find('.mini-player-section').addClass('hidden');
      html.find(`.${tab}-player`).removeClass('hidden');
    });

    // Header controls
    html.find('.mini-expand-btn').click(() => this._exitMiniMode());
    html.find('.mini-collapse-btn').click(() => this._enterMicroMode());

    // Broadcast toggle - affects both music/ambience AND soundboard
    html.find('#mini-broadcast-toggle').on('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Toggle both modes for consistency
      this.jukebox.isPreviewMode = !this.jukebox.isPreviewMode;
      this.jukebox.soundboardBroadcastMode = !this.jukebox.isPreviewMode;

      console.log('Narrator Jukebox | Broadcast mode toggled:', {
        isPreviewMode: this.jukebox.isPreviewMode,
        soundboardBroadcastMode: this.jukebox.soundboardBroadcastMode
      });

      this.render(false);
    });

    // Drag handle - enable window dragging from the header area
    this._initMiniDrag(html);

    // Search with debounce
    const searchInput = html.find('.mini-search-input');
    const searchClear = html.find('.mini-search-clear');

    searchInput.on('input', debounce(() => {
      this._miniSearchQuery = searchInput.val();

      // Update clear button visibility
      if (this._miniSearchQuery) {
        searchClear.removeClass('hidden');
      } else {
        searchClear.addClass('hidden');
      }

      this.render(false);
    }, 200));

    // ESC to clear search
    searchInput.on('keydown', e => {
      if (e.key === 'Escape') {
        this._miniSearchQuery = '';
        searchInput.val('');
        searchClear.addClass('hidden');
        this.render(false);
      }
    });

    searchClear.click(() => {
      this._miniSearchQuery = '';
      searchInput.val('');
      searchClear.addClass('hidden');
      this.render(false);
    });

    // Music track clicks
    html.on('click', '.mini-track-row[data-music-id]', e => {
      const id = e.currentTarget.dataset.musicId;
      if (!id) return;

      const currentId = this.jukebox.channels.music.currentTrack?.id;
      if (id === currentId) {
        // Toggle play/pause for current track
        this.jukebox.togglePlay('music');
      } else {
        // Play the new track
        this.jukebox.playMusic(id);
      }
      this.render(false);
    });

    // Ambience track clicks
    html.on('click', '.mini-track-row[data-ambience-id]', e => {
      const id = e.currentTarget.dataset.ambienceId;
      if (!id) return;

      const currentId = this.jukebox.channels.ambience.currentTrack?.id;
      if (id === currentId && this.jukebox.isAmbiencePlaying) {
        this.jukebox.togglePlay('ambience');
      } else {
        this.jukebox.playMusic(id, 'ambience');
      }
      this.render(false);
    });

    // Soundboard card clicks
    html.on('click', '.mini-sound-card', e => {
      const id = e.currentTarget.dataset.soundId;
      if (!id) return;

      if (this.jukebox.isSoundboardSoundPlaying(id)) {
        this.jukebox.stopSoundboardSound(id);
      } else {
        const isBroadcast = this.jukebox.soundboardBroadcastMode;
        this.jukebox.playSoundboardSound(id, { loop: false, preview: !isBroadcast });
      }
      this.render(false);
    });

    // Player controls - Music
    html.find('#mini-play-pause').click(() => {
      this.jukebox.togglePlay('music');
      this.render(false);
    });

    html.find('#mini-prev').click(() => {
      this.jukebox.prev();
    });

    html.find('#mini-next').click(() => {
      this.jukebox.next();
    });

    html.find('#mini-mute').click(() => {
      this.jukebox.toggleMute('music');
      this.render(false);
    });

    html.find('#mini-volume-slider').on('input', e => {
      const vol = parseFloat(e.target.value) / 100;
      this.jukebox.setVolume(vol, 'music');
    });

    // Player controls - Ambience
    html.find('#mini-ambience-play').click(() => {
      if (this.jukebox.isAmbiencePlaying) {
        this.jukebox.togglePlay('ambience');
      } else if (this.jukebox.channels.ambience.currentTrack) {
        this.jukebox.togglePlay('ambience');
      }
      this.render(false);
    });

    html.find('#mini-ambience-stop').click(() => {
      this.jukebox.stop('ambience');
      this.render(false);
    });

    html.find('#mini-ambience-mute').click(() => {
      this.jukebox.toggleMute('ambience');
      this.render(false);
    });

    html.find('#mini-ambience-volume-slider').on('input', e => {
      const vol = parseFloat(e.target.value) / 100;
      this.jukebox.setVolume(vol, 'ambience');
    });

    // Soundboard - Stop All Sounds
    html.find('#mini-stop-all-sounds').click(() => {
      this.jukebox.stopAllSoundboardSounds();
      this.render(false);
    });
  }

  // Initialize mini mode drag functionality
  _initMiniDrag(html) {
    const header = html.find('.mini-header');
    const windowEl = this.element[0];

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.on('mousedown', e => {
      // Don't drag from interactive elements - let them handle their own clicks
      const $target = $(e.target);
      if ($target.closest('button, input, .mini-tab, .mini-broadcast-toggle, .mini-control-btn, .mini-tabs, .mini-header-controls').length) {
        return; // Let the click pass through to the element
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.position.left;
      startTop = this.position.top;

      windowEl.style.cursor = 'grabbing';
      e.preventDefault();
    });

    $(document).on('mousemove.miniDrag', e => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.setPosition({
        left: startLeft + dx,
        top: startTop + dy
      });
    });

    $(document).on('mouseup.miniDrag', () => {
      if (isDragging) {
        isDragging = false;
        windowEl.style.cursor = '';
      }
    });
  }

  // ==========================================
  // Micro Player Mode Listeners
  // ==========================================
  _activateMicroListeners(html) {
    // Initialize drag tracking first
    this._initMicroDrag();

    // Play/pause
    html.find('#micro-play-pause').click(e => {
      e.stopPropagation();
      this.jukebox.togglePlay('music');
      this.render(false);
    });

    // Prev/next
    html.find('#micro-prev').click(e => {
      e.stopPropagation();
      this.jukebox.prev();
    });

    html.find('#micro-next').click(e => {
      e.stopPropagation();
      this.jukebox.next();
    });

    // Expand button -> Mini mode
    html.find('.micro-expand').click(e => {
      e.stopPropagation();
      this._exitMicroMode();
    });

    // Click on artwork -> Mini mode (but not if we were dragging)
    html.find('.micro-artwork').click(e => {
      // Ignore click if we just finished dragging
      if (this._microIsDragging) return;
      this._exitMicroMode();
    });

    // Double-click on artwork -> Normal mode
    html.find('.micro-artwork').dblclick(e => {
      if (this._microIsDragging) return;
      e.preventDefault();
      e.stopPropagation();
      this._exitMicroToNormal();
    });
  }

  _updatePlayButton(btn, isPlaying) {
      const icon = $(btn).find('i');
      if (isPlaying) {
          icon.removeClass('fa-play-circle').addClass('fa-pause-circle');
          btn.title = "Pause";
      } else {
          icon.removeClass('fa-pause-circle').addClass('fa-play-circle');
          btn.title = "Play";
      }
  }

  // Partial update methods to avoid full re-renders
  _updateNowPlaying(track) {
      const html = this.element;
      if (!html || !html.length) return;

      const artEl = html.find('.music-section .now-playing-art img, .music-section .now-playing-art .art-placeholder');
      const titleEl = html.find('#music-title');
      const artistEl = html.find('.np-artist');

      const tooltipEl = html.find('#music-title-tooltip');

      if (track && track.name) {
          // Update thumbnail
          if (track.thumbnail) {
              artEl.attr('src', track.thumbnail).removeClass('art-placeholder');
          }

          // Update title text and tooltip
          titleEl.text(track.name);
          tooltipEl.text(track.name);
          const tags = track.tags ? track.tags.join(', ') : 'Select a track to begin';
          artistEl.text(tags);
      } else {
          titleEl.text('No Music Playing');
          tooltipEl.text('No Music Playing');
          artistEl.text('Select a track to begin');
      }
  }

  _updateAmbienceNowPlaying(track) {
      const html = this.element;
      if (!html || !html.length) return;

      const artEl = html.find('.ambience-section .now-playing-art img, .ambience-section .now-playing-art .art-placeholder');
      const titleEl = html.find('#ambience-title');
      const tooltipEl = html.find('#ambience-title-tooltip');
      const tagsEl = html.find('.ambience-np-tags');

      if (track && track.name) {
          if (track.thumbnail) {
              artEl.attr('src', track.thumbnail).removeClass('art-placeholder');
          }
          titleEl.text(track.name);
          tooltipEl.text(track.name);
          const tags = track.tags ? track.tags.join(', ') : '';
          tagsEl.text(tags);
      } else {
          titleEl.text('No Ambience');
          tooltipEl.text('No Ambience');
          tagsEl.text('Select an ambience');
      }
  }

  _updatePlaybackState() {
      const html = this.element;
      if (!html || !html.length) return;

      const playBtn = html.find('#play-pause-btn i');
      const shuffleBtn = html.find('#shuffle-btn i');
      const loopBtn = html.find('#loop-btn i');
      const ambiencePlayBtn = html.find('#ambience-play-btn i');
      const ambienceLoopBtn = html.find('#ambience-loop-btn i');

      // Update music play/pause icon
      if (this.jukebox.isPlaying) {
          playBtn.removeClass('fa-play-circle').addClass('fa-pause-circle');
      } else {
          playBtn.removeClass('fa-pause-circle').addClass('fa-play-circle');
      }

      // Update ambience play/pause icon
      if (this.jukebox.isAmbiencePlaying) {
          ambiencePlayBtn.removeClass('fa-play').addClass('fa-pause');
      } else {
          ambiencePlayBtn.removeClass('fa-pause').addClass('fa-play');
      }

      // Update shuffle state
      shuffleBtn.toggleClass('active', this.jukebox.shuffle);

      // Update loop states
      loopBtn.toggleClass('active', this.jukebox.musicLoop);
      ambienceLoopBtn.toggleClass('active', this.jukebox.ambienceLoop);
  }

  // Loading state management
  _showLoadingState(type = 'track') {
      const html = this.element;
      if (!html || !html.length) return;

      if (type === 'track') {
          // Add loading indicator to now playing art
          html.find('.now-playing-art').addClass('loading');

          // Disable playback buttons
          html.find('#play-pause-btn, #prev-btn, #next-btn, .control-btn').prop('disabled', true);
      } else if (type === 'full') {
          // Show full overlay loading
          const overlay = $(`
              <div class="jb-loading-overlay">
                  <div class="jb-spinner"></div>
                  <div class="jb-loading-text">Loading...</div>
              </div>
          `);
          html.find('.jb-main').append(overlay);
      }
  }

  _hideLoadingState(type = 'track') {
      const html = this.element;
      if (!html || !html.length) return;

      if (type === 'track') {
          // Remove loading indicator
          html.find('.now-playing-art').removeClass('loading');

          // Re-enable playback buttons
          html.find('#play-pause-btn, #prev-btn, #next-btn, .control-btn').prop('disabled', false);
      } else if (type === 'full') {
          // Remove overlay
          html.find('.jb-loading-overlay').remove();
      }
  }

  _updateModeToggle() {
      const html = this.element;
      if (!html || !html.length) return;

      const toggle = html.find('.mode-toggle');
      const isPreview = this.jukebox.isPreviewMode;

      // Update toggle classes for visual state
      toggle.removeClass('preview broadcast');
      toggle.addClass(isPreview ? 'preview' : 'broadcast');

      // Update the toggle button's data-mode attribute for next click
      const toggleBtn = toggle.find('.toggle-switch');
      toggleBtn.attr('data-mode', isPreview ? 'broadcast' : 'preview');

      // Update tooltip
      const tooltipText = isPreview
          ? 'Preview Mode - Only you hear'
          : 'Broadcast Mode - Everyone hears';
      toggle.attr('data-tooltip', tooltipText);
  }

  _showError(message, duration = 5000) {
      const html = this.element;
      if (!html || !html.length) return;

      // Remove existing error banners
      html.find('.jb-error-banner').remove();

      // Create new error banner
      const banner = $(`
          <div class="jb-error-banner">
              <i class="fas fa-exclamation-triangle"></i>
              <div class="error-message">${message}</div>
              <button class="error-dismiss"><i class="fas fa-times"></i></button>
          </div>
      `);

      // Add to main content area
      html.find('.jb-main').prepend(banner);

      // Dismiss on click
      banner.find('.error-dismiss').on('click', () => banner.remove());

      // Auto-dismiss after duration
      if (duration > 0) {
          setTimeout(() => banner.remove(), duration);
      }
  }

  // Delegate to imported utility function
  formatTime(seconds) {
    return formatTime(seconds);
  }

  // Fetch and display track durations in the library
  async _loadTrackDurations(html) {
    const durationCells = html.find('.col-duration[data-music-id], .col-duration[data-ambience-id]');

    for (const cell of durationCells) {
      const $cell = $(cell);
      const musicId = $cell.attr('data-music-id');
      const ambienceId = $cell.attr('data-ambience-id');

      if (musicId) {
        const track = this.jukebox.music.find(m => m.id === musicId);
        if (track) {
          // Check if we already have duration cached
          if (track.cachedDuration) {
            $cell.text(this.formatTime(track.cachedDuration));
          } else if (track.source === 'youtube') {
            // For YouTube, try to get duration via noembed API
            this._getYouTubeDuration(track.url).then(duration => {
              if (duration) {
                track.cachedDuration = duration;
                $cell.text(this.formatTime(duration));
              }
            }).catch(() => {
              $cell.text('--:--');
            });
          } else {
            // For local files, get duration via Audio element
            this._getAudioDuration(track.url).then(duration => {
              if (duration) {
                track.cachedDuration = duration;
                $cell.text(this.formatTime(duration));
              }
            }).catch(() => {
              $cell.text('--:--');
            });
          }
        }
      } else if (ambienceId) {
        const track = this.jukebox.ambience.find(a => a.id === ambienceId);
        if (track) {
          if (track.cachedDuration) {
            $cell.html(this.formatTime(track.cachedDuration));
          } else if (track.source === 'youtube') {
            this._getYouTubeDuration(track.url).then(duration => {
              if (duration) {
                track.cachedDuration = duration;
                $cell.html(this.formatTime(duration));
              }
            }).catch(() => {});
          } else {
            this._getAudioDuration(track.url).then(duration => {
              if (duration) {
                track.cachedDuration = duration;
                $cell.html(this.formatTime(duration));
              }
            }).catch(() => {});
          }
        }
      }
    }
  }

  // Get audio duration from a local file URL
  _getAudioDuration(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        audio.src = ''; // Cleanup
        resolve(duration);
      };

      audio.onerror = (e) => {
        reject(new Error('Could not load audio'));
      };

      // Set crossOrigin for CORS if needed
      audio.crossOrigin = 'anonymous';
      audio.src = url;
    });
  }

  // Get YouTube video duration using a hidden player
  async _getYouTubeDuration(url) {
    // Extract video ID from URL
    const videoId = this._extractYouTubeId(url);
    if (!videoId) return null;

    // Check if we have a cached duration for this video ID
    if (!this._youtubeDurationCache) this._youtubeDurationCache = {};
    if (this._youtubeDurationCache[videoId]) {
      return this._youtubeDurationCache[videoId];
    }

    return new Promise((resolve, reject) => {
      // Create a temporary hidden container
      const containerId = `yt-duration-${videoId}-${Date.now()}`;
      const container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;top:-9999px;';
      document.body.appendChild(container);

      // Create player just to get duration
      const player = new YT.Player(containerId, {
        videoId: videoId,
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            const duration = event.target.getDuration();
            this._youtubeDurationCache[videoId] = duration;
            // Cleanup
            event.target.destroy();
            container.remove();
            resolve(duration);
          },
          onError: () => {
            container.remove();
            reject(new Error('Could not load YouTube video'));
          }
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (container.parentNode) {
          container.remove();
          reject(new Error('YouTube duration timeout'));
        }
      }, 10000);
    });
  }

  // Delegate to imported utility function
  _extractYouTubeId(url) {
    return extractYouTubeVideoId(url);
  }

  _startProgressTimer() {
    if (this._progressRAF) return;

    // Cache DOM elements to avoid repeated queries
    const html = this.element;
    if (!html || !html.length) return;

    const progressFill = html.find('#progress-fill')[0];
    const progressBar = html.find('#progress-bar')[0];
    const currentTimeEl = html.find('#current-time')[0];
    const totalTimeEl = html.find('#total-time')[0];

    let lastUpdate = 0;
    const updateInterval = 500; // Update every 500ms

    const updateProgress = (timestamp) => {
        // Check if app is still open
        if (!this.element || !this.element.length) {
            this._stopProgressTimer();
            return;
        }

        // Throttle updates to every 500ms
        if (timestamp - lastUpdate >= updateInterval) {
            lastUpdate = timestamp;

            const channel = this.jukebox.channels.music;
            const current = channel.currentTime;
            const total = channel.duration;

            // Update progress bar
            if (total && total > 0) {
                const percent = (current / total) * 100;

                // Only update slider position if user is NOT dragging
                if (!this.isDragging) {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressBar) progressBar.value = percent;
                    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(current);
                }

                if (totalTimeEl) totalTimeEl.textContent = this.formatTime(total);
            }
        }

        // Continue the animation loop
        this._progressRAFId = requestAnimationFrame(updateProgress);
    };

    // Start the animation loop
    this._progressRAFId = requestAnimationFrame(updateProgress);
  }

  _stopProgressTimer() {
    if (this._progressRAFId) {
        cancelAnimationFrame(this._progressRAFId);
        this._progressRAFId = null;
    }
    if (this._ambienceProgressRAFId) {
        cancelAnimationFrame(this._ambienceProgressRAFId);
        this._ambienceProgressRAFId = null;
    }
  }

  _startAmbienceProgressTimer() {
    if (this._ambienceProgressRAF) return;

    const html = this.element;
    if (!html || !html.length) return;

    const progressFill = html.find('#ambience-progress-fill')[0];
    const progressBar = html.find('#ambience-progress-bar')[0];
    const currentTimeEl = html.find('#ambience-current-time')[0];
    const totalTimeEl = html.find('#ambience-total-time')[0];

    let lastUpdate = 0;
    const updateInterval = 500;

    const updateAmbienceProgress = (timestamp) => {
        if (!this.element || !this.element.length) {
            this._stopProgressTimer();
            return;
        }

        if (timestamp - lastUpdate >= updateInterval) {
            lastUpdate = timestamp;

            const channel = this.jukebox.channels.ambience;
            const current = channel.currentTime;
            const total = channel.duration;

            if (total && total > 0 && isFinite(total)) {
                const percent = (current / total) * 100;

                if (!this.isAmbienceDragging) {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressBar) progressBar.value = percent;
                    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(current);
                }

                if (totalTimeEl) totalTimeEl.textContent = this.formatTime(total);
            } else {
                // For looping/infinite ambience
                if (currentTimeEl) currentTimeEl.textContent = this.formatTime(current || 0);
                if (totalTimeEl) totalTimeEl.textContent = '∞';
            }
        }

        this._ambienceProgressRAFId = requestAnimationFrame(updateAmbienceProgress);
    };

    this._ambienceProgressRAFId = requestAnimationFrame(updateAmbienceProgress);
  }

  async close(options) {
    this._stopProgressTimer();
    return super.close(options);
  }

  async showEditMoodsDialog() {
    const moods = game.settings.get(JUKEBOX.ID, "moods");
    const allTags = [...new Set((this.jukebox.music || []).flatMap(m => m.tags || []))].sort();

    // Preset gradients for quick selection - organized by mood/theme
    const presetGradients = [
      // Combat & Action
      { name: 'Fire', value: 'linear-gradient(135deg, #f12711, #f5af19)', category: 'combat' },
      { name: 'Ember', value: 'linear-gradient(135deg, #ff416c, #ff4b2b)', category: 'combat' },
      { name: 'Blood', value: 'linear-gradient(135deg, #8E0E00, #1F1C18)', category: 'combat' },
      { name: 'Inferno', value: 'linear-gradient(135deg, #ff0844, #ffb199)', category: 'combat' },
      { name: 'Rage', value: 'linear-gradient(135deg, #ED213A, #93291E)', category: 'combat' },

      // Mystery & Magic
      { name: 'Purple Haze', value: 'linear-gradient(135deg, #667eea, #764ba2)', category: 'magic' },
      { name: 'Mystic', value: 'linear-gradient(135deg, #41295a, #2F0743)', category: 'magic' },
      { name: 'Arcane', value: 'linear-gradient(135deg, #8E2DE2, #4A00E0)', category: 'magic' },
      { name: 'Enchanted', value: 'linear-gradient(135deg, #c471f5, #fa71cd)', category: 'magic' },
      { name: 'Nebula', value: 'linear-gradient(135deg, #E040FB, #536DFE)', category: 'magic' },

      // Nature & Exploration
      { name: 'Forest', value: 'linear-gradient(135deg, #11998e, #38ef7d)', category: 'nature' },
      { name: 'Mint', value: 'linear-gradient(135deg, #00b09b, #96c93d)', category: 'nature' },
      { name: 'Leaf', value: 'linear-gradient(135deg, #134E5E, #71B280)', category: 'nature' },
      { name: 'Jungle', value: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', category: 'nature' },
      { name: 'Spring', value: 'linear-gradient(135deg, #00d2ff, #3a7bd5)', category: 'nature' },

      // Ocean & Water
      { name: 'Ocean', value: 'linear-gradient(135deg, #4facfe, #00f2fe)', category: 'water' },
      { name: 'Deep Sea', value: 'linear-gradient(135deg, #1A2980, #26D0CE)', category: 'water' },
      { name: 'Tidal', value: 'linear-gradient(135deg, #0052D4, #65C7F7, #9CECFB)', category: 'water' },
      { name: 'Arctic', value: 'linear-gradient(135deg, #74ebd5, #ACB6E5)', category: 'water' },
      { name: 'Frozen', value: 'linear-gradient(135deg, #c2e9fb, #a1c4fd)', category: 'water' },

      // Dark & Horror
      { name: 'Night', value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', category: 'dark' },
      { name: 'Midnight', value: 'linear-gradient(135deg, #232526, #414345)', category: 'dark' },
      { name: 'Shadow', value: 'linear-gradient(135deg, #000000, #434343)', category: 'dark' },
      { name: 'Abyss', value: 'linear-gradient(135deg, #0f0f0f, #2d2d2d)', category: 'dark' },
      { name: 'Void', value: 'linear-gradient(135deg, #16222A, #3A6073)', category: 'dark' },

      // Romantic & Calm
      { name: 'Rose', value: 'linear-gradient(135deg, #ee9ca7, #ffdde1)', category: 'calm' },
      { name: 'Dusk', value: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', category: 'calm' },
      { name: 'Peach', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)', category: 'calm' },
      { name: 'Blossom', value: 'linear-gradient(135deg, #f6d365, #fda085)', category: 'calm' },
      { name: 'Serenity', value: 'linear-gradient(135deg, #89f7fe, #66a6ff)', category: 'calm' },

      // Sunset & Dawn
      { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb, #f5576c)', category: 'sky' },
      { name: 'Dawn', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)', category: 'sky' },
      { name: 'Twilight', value: 'linear-gradient(135deg, #544a7d, #ffd452)', category: 'sky' },
      { name: 'Aurora', value: 'linear-gradient(135deg, #00c6ff, #0072ff)', category: 'sky' },
      { name: 'Golden Hour', value: 'linear-gradient(135deg, #f7971e, #ffd200)', category: 'sky' },

      // Storm & Weather
      { name: 'Storm', value: 'linear-gradient(135deg, #373b44, #4286f4)', category: 'weather' },
      { name: 'Thunder', value: 'linear-gradient(135deg, #0F2027, #2C5364)', category: 'weather' },
      { name: 'Lightning', value: 'linear-gradient(135deg, #f7ff00, #db36a4)', category: 'weather' },
      { name: 'Fog', value: 'linear-gradient(135deg, #606c88, #3f4c6b)', category: 'weather' },
      { name: 'Sandstorm', value: 'linear-gradient(135deg, #c79081, #dfa579)', category: 'weather' },

      // Royal & Noble
      { name: 'Royal', value: 'linear-gradient(135deg, #141E30, #243B55)', category: 'royal' },
      { name: 'Crown', value: 'linear-gradient(135deg, #F7971E, #FFD200)', category: 'royal' },
      { name: 'Imperial', value: 'linear-gradient(135deg, #360033, #0b8793)', category: 'royal' },
      { name: 'Majestic', value: 'linear-gradient(135deg, #5f2c82, #49a09d)', category: 'royal' },
      { name: 'Regal', value: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)', category: 'royal' }
    ];

    // Popular FontAwesome icons organized by category for RPG moods
    const popularIcons = {
      combat: [
        'fas fa-sword', 'fas fa-shield-alt', 'fas fa-axe', 'fas fa-bow-arrow',
        'fas fa-fist-raised', 'fas fa-skull-crossbones', 'fas fa-skull', 'fas fa-khanda',
        'fas fa-bomb', 'fas fa-crosshairs', 'fas fa-bullseye', 'fas fa-chess-knight'
      ],
      magic: [
        'fas fa-magic', 'fas fa-hat-wizard', 'fas fa-wand-magic', 'fas fa-fire-alt',
        'fas fa-bolt', 'fas fa-star', 'fas fa-moon', 'fas fa-sun',
        'fas fa-hand-sparkles', 'fas fa-scroll', 'fas fa-book-spells', 'fas fa-crystal-ball'
      ],
      creatures: [
        'fas fa-dragon', 'fas fa-spider', 'fas fa-ghost', 'fas fa-cat',
        'fas fa-crow', 'fas fa-horse', 'fas fa-wolf-pack-battalion', 'fas fa-bat',
        'fas fa-snake', 'fas fa-fish', 'fas fa-bug', 'fas fa-paw'
      ],
      nature: [
        'fas fa-leaf', 'fas fa-tree', 'fas fa-seedling', 'fas fa-mountain',
        'fas fa-water', 'fas fa-wind', 'fas fa-snowflake', 'fas fa-cloud',
        'fas fa-feather', 'fas fa-flower', 'fas fa-sun', 'fas fa-rainbow'
      ],
      places: [
        'fas fa-dungeon', 'fas fa-castle', 'fas fa-church', 'fas fa-home',
        'fas fa-campground', 'fas fa-landmark', 'fas fa-monument', 'fas fa-torii-gate',
        'fas fa-archway', 'fas fa-store', 'fas fa-warehouse', 'fas fa-city'
      ],
      emotions: [
        'fas fa-heart', 'fas fa-heart-broken', 'fas fa-grin-tears', 'fas fa-sad-tear',
        'fas fa-angry', 'fas fa-surprise', 'fas fa-meh', 'fas fa-laugh',
        'fas fa-tired', 'fas fa-dizzy', 'fas fa-grimace', 'fas fa-grin-stars'
      ],
      objects: [
        'fas fa-gem', 'fas fa-coins', 'fas fa-crown', 'fas fa-key',
        'fas fa-lock', 'fas fa-hourglass', 'fas fa-compass', 'fas fa-map',
        'fas fa-chess', 'fas fa-dice-d20', 'fas fa-ring', 'fas fa-trophy'
      ],
      music: [
        'fas fa-music', 'fas fa-guitar', 'fas fa-drum', 'fas fa-headphones',
        'fas fa-volume-up', 'fas fa-microphone', 'fas fa-record-vinyl', 'fas fa-bell',
        'fas fa-broadcast-tower', 'fas fa-radio', 'fas fa-sliders-h', 'fas fa-wave-square'
      ],
      spiritual: [
        'fas fa-cross', 'fas fa-pray', 'fas fa-bible', 'fas fa-church',
        'fas fa-dove', 'fas fa-hand-holding-heart', 'fas fa-yin-yang', 'fas fa-om',
        'fas fa-ankh', 'fas fa-peace', 'fas fa-star-of-david', 'fas fa-menorah'
      ],
      misc: [
        'fas fa-fire', 'fas fa-anchor', 'fas fa-flask', 'fas fa-eye',
        'fas fa-binoculars', 'fas fa-search', 'fas fa-cog', 'fas fa-flag',
        'fas fa-hammer', 'fas fa-wrench', 'fas fa-quill', 'fas fa-pen-fancy'
      ]
    };

    const content = `
      <div class="mood-editor-v2">
        <!-- Header -->
        <header class="mood-editor-header">
          <div class="header-title">
            <i class="fas fa-palette"></i>
            <div>
              <h2>Mood Boards</h2>
              <p>Create visual shortcuts to filter your music by tags</p>
            </div>
          </div>
          <div class="header-stats">
            <span class="stat"><i class="fas fa-th-large"></i> ${moods.length} Moods</span>
            <span class="stat"><i class="fas fa-tags"></i> ${allTags.length} Tags</span>
          </div>
        </header>

        <!-- Mood Cards Grid -->
        <div class="mood-cards-grid" id="mood-cards-grid">
          ${moods.map((m, i) => this._renderMoodCard(m, i, allTags, presetGradients, popularIcons)).join('')}

          <!-- Add New Card Button -->
          <button type="button" class="mood-add-card" id="add-mood-btn">
            <div class="add-card-content">
              <i class="fas fa-plus-circle"></i>
              <span>Add Mood</span>
            </div>
          </button>
        </div>

        <!-- Footer Actions -->
        <footer class="mood-editor-footer">
          <div class="footer-hint">
            <i class="fas fa-info-circle"></i>
            <span>Tip: Click on a mood card in the Home view to instantly filter music by that tag</span>
          </div>
        </footer>
      </div>
    `;

    const dialog = new Dialog({
      title: "Edit Mood Boards",
      content: content,
      classes: ['narrator-jukebox-dialog', 'mood-editor-dialog-v2'],
      render: (html) => {
        // Apply Spotify dark theme to dialog
        const dialogEl = html.closest('.app.dialog');
        if (dialogEl.length) {
          dialogEl.css({
            'background': '#121212',
            'border': '1px solid rgba(255, 255, 255, 0.1)',
            'box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          });
          dialogEl.find('.window-header').css({
            'background': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            'border-bottom': '1px solid rgba(255, 255, 255, 0.1)',
            'color': '#fff'
          });
          dialogEl.find('.window-title').css('color', '#fff');
          dialogEl.find('.window-content').css({
            'background': '#121212',
            'color': '#fff',
            'padding': '0'
          });
          dialogEl.find('.dialog-content').css({
            'color': '#fff',
            'padding': '0'
          });
          dialogEl.find('.dialog-buttons').css({
            'background': 'rgba(0, 0, 0, 0.3)',
            'border-top': '1px solid rgba(255, 255, 255, 0.1)',
            'padding': '16px 20px'
          });
          dialogEl.find('.dialog-button').css({
            'background': 'rgba(255, 255, 255, 0.1)',
            'color': '#fff',
            'border': '1px solid rgba(255, 255, 255, 0.2)',
            'padding': '10px 24px',
            'border-radius': '20px',
            'font-weight': '600',
            'transition': 'all 0.2s ease'
          });
          dialogEl.find('.dialog-button.default').css({
            'background': 'var(--jb-accent, #1DB954)',
            'color': '#000',
            'border-color': 'var(--jb-accent, #1DB954)'
          });
          // Close button styling
          dialogEl.find('.header-button.close').css({
            'color': 'rgba(255, 255, 255, 0.7)'
          });
        }
        this._setupMoodEditorListeners(html, allTags, presetGradients, popularIcons);
      },
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Save Changes",
          callback: async (html) => {
            const updatedMoods = [];
            html.find('.mood-card-item').each((i, el) => {
              const $card = $(el);
              updatedMoods.push({
                label: $card.find('.mood-input-label').val(),
                tag: $card.find('.mood-input-tag').val(),
                color: $card.find('.mood-input-color').val(),
                icon: $card.find('.mood-input-icon').val()
              });
            });
            await game.settings.set(JUKEBOX.ID, "moods", updatedMoods);
            ui.notifications.info("Mood boards saved!");
            this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, {
      width: 1000,
      height: 700,
      resizable: true
    });

    dialog.render(true);
  }

  _renderMoodCard(mood, index, allTags, presetGradients, popularIcons) {
    const icon = mood.icon || 'fas fa-music';
    const isImage = icon.includes('/') || icon.includes('.');
    const color = mood.color || 'linear-gradient(135deg, #667eea, #764ba2)';

    // Get gradient categories
    const gradientCategories = {
      combat: { name: 'Combat', icon: 'fa-fire' },
      magic: { name: 'Magic', icon: 'fa-magic' },
      nature: { name: 'Nature', icon: 'fa-leaf' },
      water: { name: 'Water', icon: 'fa-water' },
      dark: { name: 'Dark', icon: 'fa-moon' },
      calm: { name: 'Calm', icon: 'fa-heart' },
      sky: { name: 'Sky', icon: 'fa-sun' },
      weather: { name: 'Weather', icon: 'fa-cloud' },
      royal: { name: 'Royal', icon: 'fa-crown' }
    };

    // Icon category labels
    const iconCategoryLabels = {
      combat: 'Combat',
      magic: 'Magic',
      creatures: 'Creatures',
      nature: 'Nature',
      places: 'Places',
      emotions: 'Emotions',
      objects: 'Objects',
      music: 'Music',
      spiritual: 'Spiritual',
      misc: 'Misc'
    };

    return `
      <div class="mood-card-item" data-index="${index}">
        <!-- Live Preview -->
        <div class="mood-preview" style="background: ${color};">
          <div class="preview-icon">
            ${isImage
              ? `<img src="${icon}" alt="">`
              : `<i class="${icon}"></i>`
            }
          </div>
          <div class="preview-label">${mood.label || 'Untitled'}</div>
          <button type="button" class="mood-delete-btn" title="Delete this mood">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>

        <!-- Edit Fields -->
        <div class="mood-fields">
          <!-- Name Field -->
          <div class="field-group">
            <label><i class="fas fa-tag"></i> Name</label>
            <input type="text" class="mood-input-label" value="${mood.label || ''}" placeholder="Epic Battle" spellcheck="false">
          </div>

          <!-- Tag Field with Suggestions -->
          <div class="field-group">
            <label><i class="fas fa-filter"></i> Filter Tag</label>
            <div class="tag-input-wrapper">
              <input type="text" class="mood-input-tag" value="${mood.tag || ''}" placeholder="combat" spellcheck="false" list="tag-suggestions-${index}">
              <datalist id="tag-suggestions-${index}">
                ${allTags.map(t => `<option value="${t}">`).join('')}
              </datalist>
            </div>
          </div>

          <!-- Color/Gradient Picker -->
          <div class="field-group gradient-field-group">
            <label><i class="fas fa-fill-drip"></i> Background</label>
            <input type="hidden" class="mood-input-color" value="${color}">

            <!-- Custom Gradient Builder -->
            <div class="custom-gradient-builder">
              <div class="gradient-builder-preview" style="background: ${color};">
                <span class="gradient-preview-label">Custom Gradient</span>
              </div>
              <div class="gradient-builder-controls">
                <div class="color-picker-group">
                  <label>Color 1</label>
                  <input type="color" class="gradient-color-1" value="#667eea">
                </div>
                <div class="color-picker-group">
                  <label>Color 2</label>
                  <input type="color" class="gradient-color-2" value="#764ba2">
                </div>
                <button type="button" class="apply-gradient-btn" title="Apply custom gradient">
                  <i class="fas fa-check"></i> Apply
                </button>
              </div>
            </div>

            <!-- Gradient Presets by Category -->
            <div class="gradient-categories">
              ${Object.entries(gradientCategories).map(([catKey, cat]) => `
                <div class="gradient-category" data-category="${catKey}">
                  <button type="button" class="gradient-category-btn" title="${cat.name}">
                    <i class="fas ${cat.icon}"></i>
                  </button>
                  <div class="gradient-category-presets">
                    ${presetGradients.filter(g => g.category === catKey).map(g => `
                      <button type="button" class="gradient-preset" style="background: ${g.value};" data-gradient="${g.value}" title="${g.name}"></button>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Icon Picker -->
          <div class="field-group icon-field-group">
            <label><i class="fas fa-icons"></i> Icon</label>
            <div class="icon-input-wrapper">
              <input type="text" class="mood-input-icon" value="${icon}" placeholder="fas fa-fire" spellcheck="false">
              <button type="button" class="icon-browse-btn" title="Browse images">
                <i class="fas fa-folder-open"></i>
              </button>
            </div>

            <!-- Icon Categories Tabs -->
            <div class="icon-categories">
              <div class="icon-category-tabs">
                ${Object.entries(iconCategoryLabels).map(([catKey, catName], idx) => `
                  <button type="button" class="icon-category-tab ${idx === 0 ? 'active' : ''}" data-category="${catKey}">${catName}</button>
                `).join('')}
              </div>
              <div class="icon-category-content">
                ${Object.entries(popularIcons).map(([catKey, icons], idx) => `
                  <div class="icon-category-panel ${idx === 0 ? 'active' : ''}" data-category="${catKey}">
                    ${icons.map(ic => `
                      <button type="button" class="icon-preset" data-icon="${ic}" title="${ic}">
                        <i class="${ic}"></i>
                      </button>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _setupMoodEditorListeners(html, allTags, presetGradients, popularIcons) {
    const grid = html.find('#mood-cards-grid');

    // Get all icons as flat array for random selection
    const allIcons = Object.values(popularIcons).flat();

    // Add new mood
    html.find('#add-mood-btn').click(() => {
      const newMood = {
        label: "New Mood",
        tag: "",
        color: presetGradients[Math.floor(Math.random() * presetGradients.length)].value,
        icon: allIcons[Math.floor(Math.random() * allIcons.length)]
      };

      const newIndex = html.find('.mood-card-item').length;
      const newCardHtml = this._renderMoodCard(newMood, newIndex, allTags, presetGradients, popularIcons);

      $(newCardHtml).insertBefore(html.find('#add-mood-btn')).hide().fadeIn(300);
      this._attachCardListeners(html.find(`.mood-card-item[data-index="${newIndex}"]`));

      // Scroll to new card
      const container = html.find('.mood-cards-grid');
      container.animate({ scrollTop: container[0].scrollHeight }, 300);
    });

    // Attach listeners to existing cards
    html.find('.mood-card-item').each((i, el) => {
      this._attachCardListeners($(el));
    });
  }

  _attachCardListeners($card) {
    // Delete button
    $card.find('.mood-delete-btn').click((e) => {
      e.stopPropagation();
      $card.addClass('deleting');
      setTimeout(() => {
        $card.slideUp(200, () => {
          $card.remove();
          // Reindex remaining cards
          $('.mood-card-item').each((i, el) => {
            $(el).attr('data-index', i);
          });
        });
      }, 100);
    });

    // Real-time preview updates
    $card.find('.mood-input-label').on('input', (e) => {
      $card.find('.preview-label').text(e.target.value || 'Untitled');
    });

    $card.find('.mood-input-color').on('change', (e) => {
      const gradient = e.target.value;
      $card.find('.mood-preview').css('background', gradient);
      $card.find('.gradient-builder-preview').css('background', gradient);
    });

    $card.find('.mood-input-icon').on('input', (e) => {
      const icon = e.target.value;
      const isImage = icon.includes('/') || icon.includes('.');
      const $iconContainer = $card.find('.preview-icon');

      if (isImage) {
        $iconContainer.html(`<img src="${icon}" alt="">`);
      } else {
        $iconContainer.html(`<i class="${icon}"></i>`);
      }
    });

    // Custom Gradient Builder - live preview as colors change
    const updateGradientPreview = () => {
      const color1 = $card.find('.gradient-color-1').val();
      const color2 = $card.find('.gradient-color-2').val();
      const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
      $card.find('.gradient-builder-preview').css('background', gradient);
    };

    $card.find('.gradient-color-1, .gradient-color-2').on('input', updateGradientPreview);

    // Apply custom gradient button
    $card.find('.apply-gradient-btn').click(() => {
      const color1 = $card.find('.gradient-color-1').val();
      const color2 = $card.find('.gradient-color-2').val();
      const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
      $card.find('.mood-input-color').val(gradient).trigger('change');
    });

    // Gradient category toggle
    $card.find('.gradient-category-btn').click((e) => {
      const $category = $(e.currentTarget).closest('.gradient-category');
      const wasActive = $category.hasClass('active');

      // Close all categories in this card
      $card.find('.gradient-category').removeClass('active');

      // Toggle the clicked one
      if (!wasActive) {
        $category.addClass('active');
      }
    });

    // Gradient presets
    $card.find('.gradient-preset').click((e) => {
      e.stopPropagation();
      const gradient = e.currentTarget.dataset.gradient;
      $card.find('.mood-input-color').val(gradient).trigger('change');

      // Also update the color pickers to match (extract first two colors)
      const colors = gradient.match(/#[a-fA-F0-9]{6}/g);
      if (colors && colors.length >= 2) {
        $card.find('.gradient-color-1').val(colors[0]);
        $card.find('.gradient-color-2').val(colors[1]);
      }
    });

    // Icon category tabs
    $card.find('.icon-category-tab').click((e) => {
      const category = e.currentTarget.dataset.category;

      // Update tabs
      $card.find('.icon-category-tab').removeClass('active');
      $(e.currentTarget).addClass('active');

      // Update panels
      $card.find('.icon-category-panel').removeClass('active');
      $card.find(`.icon-category-panel[data-category="${category}"]`).addClass('active');
    });

    // Icon presets
    $card.find('.icon-preset').click((e) => {
      const icon = e.currentTarget.dataset.icon;
      $card.find('.mood-input-icon').val(icon).trigger('input');
    });

    // Browse for image icon
    $card.find('.icon-browse-btn').click(() => {
      const input = $card.find('.mood-input-icon');
      new (getFilePicker())({
        type: "image",
        current: input.val(),
        callback: (path) => {
          input.val(path).trigger('input');
        }
      }).browse();
    });
  }

  /**
   * Validates a form field and shows visual feedback
   * @param {HTMLElement} input - The input element to validate
   * @param {string} errorMessage - Error message to display
   * @returns {boolean} - True if valid
   */
  _validateField(input, errorMessage = "This field is required") {
    if (!input.value || input.value.trim() === "") {
      input.classList.add('input-error');

      // Remove existing error message
      const existingError = input.parentElement.querySelector('.field-error');
      if (existingError) existingError.remove();

      // Add error message
      const errorEl = document.createElement('div');
      errorEl.className = 'field-error';
      errorEl.textContent = errorMessage;
      input.parentElement.appendChild(errorEl);

      // Remove error on input
      input.addEventListener('input', () => {
        input.classList.remove('input-error');
        const error = input.parentElement.querySelector('.field-error');
        if (error) error.remove();
      }, { once: true });

      return false;
    }
    return true;
  }

  /**
   * Validates a URL based on source type
   * @param {string} url - The URL to validate
   * @param {string} source - Source type ('youtube' or 'local')
   * @returns {boolean} - True if valid
   */
  _validateUrl(url, source) {
    if (!url || url.trim() === "") return false;

    if (source === 'youtube') {
      const youtubeRegex = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      return youtubeRegex.test(url);
    }

    return true; // For local files, just check it's not empty
  }

  async showAddMusicDialog() {
    const isGM = game.user.isGM;
    const btnLabel = isGM ? "Add to Library" : "Send Suggestion";
    const dialogTitle = isGM ? "Add Music Track" : "Suggest Music Track";

    const content = `
      <div class="add-track-dialog music-dialog">
        <div class="dialog-header">
          <div class="header-icon music-icon">
            <i class="fas fa-music"></i>
          </div>
          <div class="header-info">
            <h2>${dialogTitle}</h2>
            <p>${isGM ? 'Add a new track to your music library' : 'Suggest a track for the GM to review'}</p>
          </div>
        </div>

        <form class="track-form">
          <div class="form-section">
            <div class="form-group">
              <label><i class="fas fa-heading"></i> Track Name</label>
              <input type="text" name="name" placeholder="Enter track name" spellcheck="false">
            </div>

            <div class="form-row">
              <div class="form-group source-group">
                <label><i class="fas fa-database"></i> Source</label>
                <div class="source-selector">
                  <button type="button" class="source-btn active" data-source="local">
                    <i class="fas fa-folder"></i> Local File
                  </button>
                  <button type="button" class="source-btn" data-source="youtube">
                    <i class="fab fa-youtube"></i> YouTube
                  </button>
                </div>
                <input type="hidden" name="source" value="local">
              </div>
            </div>

            <div class="form-group url-group">
              <label><i class="fas fa-link"></i> <span class="url-label">File Path</span>${JukeboxBrowser.getFormatsTagHTML()}</label>
              <div class="url-input-wrapper">
                <input type="text" name="url" placeholder="Select a file or paste path" spellcheck="false">
                <button type="button" class="browse-btn file-picker-btn">
                  <i class="fas fa-folder-open"></i>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-tags"></i> Tags</label>
              <input type="text" name="tags" placeholder="combat, boss, epic (comma-separated)" spellcheck="false">
              <span class="field-hint">Tags help organize and filter your music</span>
            </div>

            <div class="form-group thumbnail-group">
              <label><i class="fas fa-image"></i> Thumbnail <span class="optional">(optional)</span></label>
              <div class="thumbnail-wrapper">
                <div class="thumbnail-preview">
                  <i class="fas fa-music"></i>
                </div>
                <div class="thumbnail-input">
                  <input type="text" name="thumbnail" placeholder="Image URL (auto-filled for YouTube)" spellcheck="false">
                  <button type="button" class="browse-btn thumbnail-picker-btn">
                    <i class="fas fa-folder-open"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    new Dialog({
        title: dialogTitle,
        content: content,
        classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'music-theme'],
        render: (html) => {
            // Force dark theme via inline styles to override Foundry defaults
            const dialogApp = html.closest('.app.dialog');
            if (dialogApp.length) {
                dialogApp.css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border': '1px solid rgba(255, 255, 255, 0.1)',
                    'border-radius': '12px'
                });
                dialogApp.find('.window-header').css({
                    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                    'background-color': '#1a1a1a',
                    'border-bottom': '1px solid rgba(29, 185, 84, 0.3)',
                    'border-radius': '12px 12px 0 0'
                });
                dialogApp.find('.window-header .window-title').css('color', '#fff');
                dialogApp.find('.window-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-buttons').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                    'padding': '16px 24px'
                });
                dialogApp.find('.dialog-buttons button').css({
                    'background': '#1db954',
                    'color': '#000',
                    'border': 'none',
                    'border-radius': '20px',
                    'padding': '10px 24px',
                    'font-weight': '600'
                });
            }

            const urlInput = html.find('input[name="url"]');
            const sourceHidden = html.find('input[name="source"]');
            const sourceButtons = html.find('.source-btn');
            const urlLabel = html.find('.url-label');
            const browseBtn = html.find('.file-picker-btn');
            const thumbnailPreview = html.find('.thumbnail-preview');

            // Source selector buttons
            sourceButtons.click((e) => {
                e.preventDefault();
                const btn = $(e.currentTarget);
                const source = btn.data('source');

                sourceButtons.removeClass('active');
                btn.addClass('active');
                sourceHidden.val(source);

                // Update UI based on source
                if (source === 'youtube') {
                    urlLabel.text('YouTube URL');
                    urlInput.attr('placeholder', 'Paste YouTube URL here');
                    browseBtn.hide();
                } else {
                    urlLabel.text('File Path');
                    urlInput.attr('placeholder', 'Select a file or paste path');
                    browseBtn.show();
                }
            });

            // File Picker
            html.find('.file-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "audio",
                    current: urlInput.val(),
                    callback: (path) => {
                        urlInput.val(path);
                        // Auto-fill name from filename if empty
                        const nameInput = html.find('input[name="name"]');
                        if (!nameInput.val()) {
                            let filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
                            // Decode URL-encoded characters (%20 = space, %5B = [, etc.)
                            try { filename = decodeURIComponent(filename); } catch(e) {}
                            nameInput.val(filename.replace(/[-_]/g, ' '));
                        }
                    }
                }).browse();
            });

            // Thumbnail Picker
            html.find('.thumbnail-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "image",
                    current: html.find('input[name="thumbnail"]').val(),
                    callback: (path) => {
                        html.find('input[name="thumbnail"]').val(path);
                        thumbnailPreview.html(`<img src="${path}" alt="Thumbnail">`);
                    }
                }).browse();
            });

            // Update thumbnail preview
            html.find('input[name="thumbnail"]').on('input', (e) => {
                const url = e.target.value;
                if (url) {
                    thumbnailPreview.html(`<img src="${url}" alt="Thumbnail">`);
                } else {
                    thumbnailPreview.html('<i class="fas fa-music"></i>');
                }
            });

            // Auto-fill YouTube data
            urlInput.on('input', async (e) => {
                const url = e.target.value;
                const source = sourceHidden.val();

                if (source === 'youtube' && url) {
                    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                    const match = url.match(regExp);
                    const id = (match && match[7].length === 11) ? match[7] : null;

                    if (id) {
                        console.log(`Narrator Jukebox | Found YouTube ID: ${id}`);
                        const thumbUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
                        html.find('input[name="thumbnail"]').val(thumbUrl);
                        thumbnailPreview.html(`<img src="${thumbUrl}" alt="Thumbnail">`);

                        try {
                            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
                            const data = await response.json();
                            if (data.title) {
                                html.find('input[name="name"]').val(data.title);
                            }
                        } catch (err) {
                            console.warn("Narrator Jukebox | Could not fetch YouTube title", err);
                        }
                    }
                }
            });
        },
        buttons: {
            add: {
                label: btnLabel,
                callback: async (html) => {
                    const formElement = html.find('form')[0];
                    if (!formElement) {
                        console.error("Narrator Jukebox | Form element not found in dialog!");
                        return;
                    }

                    // Validate required fields
                    const nameInput = formElement.name;
                    const urlInput = formElement.url;
                    const sourceValue = formElement.source.value;

                    let isValid = true;

                    // Validate name
                    if (!this._validateField(nameInput, "Track name is required")) {
                        isValid = false;
                    }

                    // Validate URL
                    if (!this._validateUrl(urlInput.value, sourceValue)) {
                        const errorMsg = sourceValue === 'youtube'
                            ? "Please enter a valid YouTube URL"
                            : "URL is required";
                        if (!this._validateField(urlInput, errorMsg)) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before submitting");
                        return false; // Prevent dialog from closing
                    }

                    const data = {
                        id: foundry.utils.randomID(),
                        name: formElement.name.value.trim(),
                        source: formElement.source.value,
                        url: formElement.url.value.trim(),
                        tags: formElement.tags.value.split(',').map(t => t.trim()).filter(t => t),
                        thumbnail: formElement.thumbnail.value.trim()
                    };

                    console.log("Narrator Jukebox | Adding Music Data:", data);

                    try {
                        if (isGM) {
                            await this.jukebox.addMusic(data);
                            ui.notifications.info(`Added track: ${data.name}`);
                        } else {
                            if (!NarratorJukebox.socket) {
                                console.error("Narrator Jukebox | Socketlib not available!");
                                ui.notifications.error("Cannot send suggestion: Socketlib module not active!");
                                return;
                            }

                            data.user = game.user.name;
                            await NarratorJukebox.socket.executeAsGM('suggestTrack', data, game.user.name);
                            ui.notifications.info("Suggestion sent to GM!");
                        }
                        this.render();
                    } catch (err) {
                        console.error("Narrator Jukebox | Failed to add music:", err);
                        ui.notifications.error(`Failed to add music: ${err.message}`);
                    }
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
  }

  async showEditMusicDialog(id) {
    const track = this.jukebox.music.find(m => m.id === id);
    if (!track) return;

    const thumbnailPreview = track.thumbnail
        ? `<img src="${track.thumbnail}" alt="Thumbnail">`
        : '<i class="fas fa-music"></i>';

    const content = `
      <div class="add-track-dialog music-dialog">
        <div class="dialog-header">
          <div class="header-icon music-icon">
            <i class="fas fa-edit"></i>
          </div>
          <div class="header-info">
            <h2>Edit Track Details</h2>
            <p>Update information for "${track.name}"</p>
          </div>
        </div>

        <form class="track-form">
          <div class="form-section">
            <div class="form-group">
              <label><i class="fas fa-heading"></i> Track Name</label>
              <input type="text" name="name" value="${track.name}" placeholder="Enter track name" spellcheck="false">
            </div>

            <div class="form-group url-group">
              <label><i class="fas fa-link"></i> ${track.source === 'youtube' ? 'YouTube URL' : 'File Path'}</label>
              <div class="url-input-wrapper">
                <input type="text" name="url" value="${track.url}" placeholder="${track.source === 'youtube' ? 'YouTube URL' : 'File path'}" spellcheck="false">
                ${track.source !== 'youtube' ? '<button type="button" class="browse-btn file-picker-btn"><i class="fas fa-folder-open"></i></button>' : ''}
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-tags"></i> Tags</label>
              <input type="text" name="tags" value="${track.tags.join(', ')}" placeholder="combat, boss, epic (comma-separated)" spellcheck="false">
              <span class="field-hint">Tags help organize and filter your music</span>
            </div>

            <div class="form-group thumbnail-group">
              <label><i class="fas fa-image"></i> Thumbnail <span class="optional">(optional)</span></label>
              <div class="thumbnail-wrapper">
                <div class="thumbnail-preview">
                  ${thumbnailPreview}
                </div>
                <div class="thumbnail-input">
                  <input type="text" name="thumbnail" value="${track.thumbnail || ''}" placeholder="Image URL" spellcheck="false">
                  <button type="button" class="browse-btn thumbnail-picker-btn">
                    <i class="fas fa-folder-open"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    new Dialog({
        title: "Edit Track",
        content: content,
        classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'music-theme'],
        render: (html) => {
            // Force dark theme via inline styles
            const dialogApp = html.closest('.app.dialog');
            if (dialogApp.length) {
                dialogApp.css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border': '1px solid rgba(255, 255, 255, 0.1)',
                    'border-radius': '12px'
                });
                dialogApp.find('.window-header').css({
                    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                    'background-color': '#1a1a1a',
                    'border-bottom': '1px solid rgba(29, 185, 84, 0.3)',
                    'border-radius': '12px 12px 0 0'
                });
                dialogApp.find('.window-header .window-title').css('color', '#fff');
                dialogApp.find('.window-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-buttons').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                    'padding': '16px 24px'
                });
                dialogApp.find('.dialog-buttons button').css({
                    'background': '#1db954',
                    'color': '#000',
                    'border': 'none',
                    'border-radius': '20px',
                    'padding': '10px 24px',
                    'font-weight': '600'
                });
            }

            const thumbnailPreview = html.find('.thumbnail-preview');

            // File Picker for URL (if local)
            html.find('.file-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "audio",
                    current: html.find('input[name="url"]').val(),
                    callback: (path) => {
                        html.find('input[name="url"]').val(path);
                    }
                }).browse();
            });

            // Thumbnail Picker
            html.find('.thumbnail-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "image",
                    current: html.find('input[name="thumbnail"]').val(),
                    callback: (path) => {
                        html.find('input[name="thumbnail"]').val(path);
                        thumbnailPreview.html(`<img src="${path}" alt="Thumbnail">`);
                    }
                }).browse();
            });

            // Update thumbnail preview on input
            html.find('input[name="thumbnail"]').on('input', (e) => {
                const url = e.target.value;
                if (url) {
                    thumbnailPreview.html(`<img src="${url}" alt="Thumbnail">`);
                } else {
                    thumbnailPreview.html('<i class="fas fa-music"></i>');
                }
            });
        },
        buttons: {
            save: {
                label: "Save Changes",
                callback: async (html) => {
                    const form = html.find('form')[0];

                    // Validate required fields
                    const nameInput = form.name;
                    const urlInput = form.url;

                    let isValid = true;

                    // Validate name
                    if (!this._validateField(nameInput, "Track name is required")) {
                        isValid = false;
                    }

                    // Validate URL
                    if (!this._validateUrl(urlInput.value, track.source || 'local')) {
                        if (!this._validateField(urlInput, "Valid URL is required")) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before saving");
                        return false; // Prevent dialog from closing
                    }

                    const data = {
                        name: form.name.value.trim(),
                        url: form.url.value.trim(),
                        tags: form.tags.value.split(',').map(t => t.trim()).filter(t => t),
                        thumbnail: form.thumbnail.value.trim()
                    };
                    await this.jukebox.updateMusic(id, data);
                    ui.notifications.info(`Updated "${data.name}"`);
                    this.render();
                }
            }
        }
    }).render(true);
  }

  async showAddToPlaylistDialog(musicId) {
      const track = this.jukebox.music.find(m => m.id === musicId);
      if (!track) {
          ui.notifications.error("Track not found");
          return;
      }

      const playlists = this.jukebox.playlists;

      if (!playlists || playlists.length === 0) {
          ui.notifications.warn("No playlists available. Create a playlist first!");
          return;
      }

      const playlistOptions = playlists.map(pl => `
        <div class="playlist-option" data-playlist-id="${pl.id}">
          <div class="playlist-option-icon">
            <i class="fas fa-list"></i>
          </div>
          <div class="playlist-option-info">
            <span class="playlist-option-name">${pl.name}</span>
            <span class="playlist-option-count">${pl.tracks?.length || 0} tracks</span>
          </div>
          <div class="playlist-option-check">
            <i class="fas fa-plus"></i>
          </div>
        </div>
      `).join('');

      const content = `
        <div class="add-track-dialog playlist-select-dialog">
          <div class="dialog-header">
            <div class="header-icon music-icon">
              <i class="fas fa-plus"></i>
            </div>
            <div class="header-info">
              <h2>Add to Playlist</h2>
              <p>Select a playlist for "${track.name}"</p>
            </div>
          </div>

          <div class="playlist-options-container">
            ${playlistOptions}
          </div>

          <input type="hidden" id="playlist-select" value="${playlists[0]?.id || ''}">
        </div>
      `;

      new Dialog({
          title: "Add to Playlist",
          content: content,
          classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'playlist-theme'],
          render: (html) => {
              // Force dark theme via inline styles
              const dialogApp = html.closest('.app.dialog');
              if (dialogApp.length) {
                  dialogApp.css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'border': '1px solid rgba(255, 255, 255, 0.1)',
                      'border-radius': '12px'
                  });
                  dialogApp.find('.window-header').css({
                      'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                      'background-color': '#1a1a1a',
                      'border-bottom': '1px solid rgba(29, 185, 84, 0.3)',
                      'border-radius': '12px 12px 0 0'
                  });
                  dialogApp.find('.window-header .window-title').css('color', '#fff');
                  dialogApp.find('.window-content').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'color': '#ffffff'
                  });
                  dialogApp.find('.dialog-content').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'color': '#ffffff'
                  });
                  dialogApp.find('.dialog-buttons').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                      'padding': '16px 24px'
                  });
                  dialogApp.find('.dialog-buttons button').css({
                      'background': '#1db954',
                      'color': '#000',
                      'border': 'none',
                      'border-radius': '20px',
                      'padding': '10px 24px',
                      'font-weight': '600'
                  });
              }

              // Playlist selection
              const playlistOptions = html.find('.playlist-option');
              const hiddenInput = html.find('#playlist-select');

              // Select first by default
              playlistOptions.first().addClass('selected');

              playlistOptions.click((e) => {
                  const option = $(e.currentTarget);
                  playlistOptions.removeClass('selected');
                  option.addClass('selected');
                  hiddenInput.val(option.data('playlist-id'));
              });
          },
          buttons: {
              add: {
                  label: "Add to Playlist",
                  callback: async (html) => {
                      const playlistId = html.find('#playlist-select').val();
                      if (playlistId) {
                          await this.jukebox.addToPlaylist(playlistId, musicId);
                          const playlist = playlists.find(p => p.id === playlistId);
                          ui.notifications.info(`Added "${track.name}" to ${playlist?.name || 'playlist'}`);
                          this.render();
                      }
                  }
              }
          }
      }).render(true);
  }

  async showAddPlaylistDialog() {
      const content = `
        <div class="add-track-dialog playlist-dialog">
          <div class="dialog-header">
            <div class="header-icon playlist-icon">
              <i class="fas fa-list"></i>
            </div>
            <div class="header-info">
              <h2>Create New Playlist</h2>
              <p>Organize your music into custom playlists</p>
            </div>
          </div>

          <form class="track-form">
            <div class="form-section">
              <div class="form-group">
                <label><i class="fas fa-heading"></i> Playlist Name</label>
                <input type="text" id="pl-name" name="name" placeholder="My awesome playlist" spellcheck="false">
              </div>
            </div>
          </form>
        </div>
      `;

      new Dialog({
          title: "New Playlist",
          content: content,
          classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'playlist-theme'],
          render: (html) => {
              // Force dark theme via inline styles
              const dialogApp = html.closest('.app.dialog');
              if (dialogApp.length) {
                  dialogApp.css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'border': '1px solid rgba(255, 255, 255, 0.1)',
                      'border-radius': '12px'
                  });
                  dialogApp.find('.window-header').css({
                      'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                      'background-color': '#1a1a1a',
                      'border-bottom': '1px solid rgba(29, 185, 84, 0.3)',
                      'border-radius': '12px 12px 0 0'
                  });
                  dialogApp.find('.window-header .window-title').css('color', '#fff');
                  dialogApp.find('.window-content').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'color': '#ffffff'
                  });
                  dialogApp.find('.dialog-content').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'color': '#ffffff'
                  });
                  dialogApp.find('.dialog-buttons').css({
                      'background': '#0a0a0a',
                      'background-color': '#0a0a0a',
                      'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                      'padding': '16px 24px'
                  });
                  dialogApp.find('.dialog-buttons button').css({
                      'background': '#1db954',
                      'color': '#000',
                      'border': 'none',
                      'border-radius': '20px',
                      'padding': '10px 24px',
                      'font-weight': '600'
                  });
              }
          },
          buttons: {
              create: {
                  label: "Create Playlist",
                  callback: async (html) => {
                      const nameInput = html.find('#pl-name')[0];

                      // Validate playlist name
                      if (!this._validateField(nameInput, "Playlist name is required")) {
                          ui.notifications.warn("Playlist name cannot be empty");
                          return false; // Prevent dialog from closing
                      }

                      const name = nameInput.value.trim();
                      await this.jukebox.createPlaylist(name);
                      ui.notifications.info(`Created playlist: ${name}`);
                      this.render();
                  }
              }
          }
      }).render(true);
  }

  toggleAmbienceMixer() {
      const mixer = this.element.find('.ambience-mixer-panel');
      mixer.toggleClass('active');
  }

  /* ==========================================
     Bulk Import Dialog
     ========================================== */

  /**
   * Recursively scan a folder for audio files
   * @param {string} folderPath - The folder path to scan
   * @param {string} basePath - The original base path (for tag extraction)
   * @param {boolean} recursive - Whether to include subfolders
   * @param {boolean} useFolderTags - Whether to generate tags from folder names
   * @returns {Promise<Array>} Array of file objects with path, name, tags, supported
   */
  async _scanFolderForAudio(folderPath, basePath, recursive = true, useFolderTags = true) {
    const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.webm', '.flac', '.m4a', '.aac'];
    const results = [];
    const FP = getFilePicker();

    const scanDir = async (path, depth = 0) => {
      try {
        // Use FilePicker.browse to list files in the directory
        const response = await FP.browse("data", path, {
          extensions: AUDIO_EXTENSIONS
        });

        // Process files in this directory
        for (const filePath of response.files) {
          // Extract filename without extension
          let filename = filePath.split('/').pop().replace(/\.[^/.]+$/, '');
          try { filename = decodeURIComponent(filename); } catch(e) {}
          filename = filename.replace(/[-_]/g, ' ');

          // Extract tags from folder structure
          let tags = [];
          if (useFolderTags && depth > 0) {
            // Get the relative path from base and extract folder names as tags
            const relativePath = path.replace(basePath, '').replace(/^\//, '');
            if (relativePath) {
              tags = relativePath.split('/').filter(t => t.trim()).map(t => {
                // Clean up tag: decode, remove special chars, lowercase
                try { t = decodeURIComponent(t); } catch(e) {}
                return t.replace(/[-_]/g, ' ').trim().toLowerCase();
              });
            }
          }

          // Check if format is supported
          const ext = filePath.split('.').pop().toLowerCase();
          const supported = JukeboxBrowser.isFormatSupported(filePath);

          results.push({
            path: filePath,
            name: filename,
            tags: tags,
            supported: supported,
            extension: ext
          });
        }

        // Recursively scan subdirectories
        if (recursive && response.dirs && response.dirs.length > 0) {
          for (const subDir of response.dirs) {
            await scanDir(subDir, depth + 1);
          }
        }
      } catch (error) {
        console.error(`Narrator Jukebox | Error scanning folder ${path}:`, error);
      }
    };

    await scanDir(folderPath, 0);
    return results;
  }

  /**
   * Show the Bulk Import dialog
   * @param {string} type - 'music', 'ambience', or 'soundboard'
   */
  async showBulkImportDialog(type = 'music') {
    const isGM = game.user.isGM;
    if (!isGM) {
      ui.notifications.warn("Only the GM can bulk import files.");
      return;
    }

    // Configuration based on type
    const config = {
      music: {
        title: 'Bulk Import - Music',
        icon: 'fa-music',
        accentClass: '',
        addMethod: 'addMusic',
        defaultFolder: 'audio/music'
      },
      ambience: {
        title: 'Bulk Import - Ambience',
        icon: 'fa-cloud-sun',
        accentClass: 'ambience',
        addMethod: 'addAmbience',
        defaultFolder: 'audio/ambience'
      },
      soundboard: {
        title: 'Bulk Import - Soundboard',
        icon: 'fa-th',
        accentClass: 'soundboard',
        addMethod: 'addSoundboardSound',
        defaultFolder: 'audio/soundboard'
      }
    }[type];

    // Soundboard color presets
    const SOUNDBOARD_COLORS = [
      '#1db954', '#e91e63', '#ff9800', '#2196f3',
      '#9c27b0', '#00bcd4', '#ff5722', '#607d8b'
    ];

    // Audio extensions
    const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'webm', 'flac', 'm4a', 'aac'];

    // Build color picker HTML for soundboard
    const colorPickerHTML = type === 'soundboard' ? `
      <div class="bulk-import-section bulk-import-colors-section">
        <div class="bulk-import-section-title">Default Color for Cards</div>
        <div class="bulk-import-colors">
          ${SOUNDBOARD_COLORS.map((color, i) => `
            <div class="bulk-import-color ${i === 0 ? 'selected' : ''}"
                 data-color="${color}"
                 style="background: ${color}"
                 data-tooltip="Select this color"></div>
          `).join('')}
          <input type="color" class="bulk-import-color-input" value="${SOUNDBOARD_COLORS[0]}" style="display: none;">
          <div class="bulk-import-color-custom" data-tooltip="Choose custom color">
            <i class="fas fa-palette"></i>
          </div>
        </div>
      </div>
    ` : '';

    const content = `
      <div class="bulk-import-content">
        <!-- Source Selection -->
        <div class="bulk-import-section">
          <div class="bulk-import-section-title">Select Source</div>
          <div class="bulk-import-source-buttons">
            <button type="button" class="bulk-import-source-btn active" data-source="computer">
              <i class="fas fa-desktop"></i>
              <span>My Computer</span>
              <small>Select folder from your PC</small>
            </button>
            <button type="button" class="bulk-import-source-btn" data-source="foundry">
              <i class="fas fa-database"></i>
              <span>Foundry Data</span>
              <small>Already uploaded files</small>
            </button>
          </div>
          <!-- Hidden file input for computer folder selection -->
          <input type="file" class="bulk-import-computer-input" webkitdirectory multiple style="display: none;">
        </div>

        <!-- Folder Display -->
        <div class="bulk-import-section">
          <div class="bulk-import-section-title">Source Folder</div>
          <div class="bulk-import-folder-row">
            <input type="text" class="bulk-import-folder-input" placeholder="Click a source button above..." readonly>
            <button type="button" class="bulk-import-browse-btn" data-tooltip="Browse again">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>
        </div>

        <!-- Destination Folder (only for computer uploads) -->
        <div class="bulk-import-section bulk-import-destination-section" style="display: none;">
          <div class="bulk-import-section-title">
            Upload Destination
            <span class="bulk-import-hint">(where files will be saved in Foundry)</span>
          </div>
          <div class="bulk-import-folder-row">
            <input type="text" class="bulk-import-destination-input" value="" placeholder="Click Browse or type a path (e.g., ${config.defaultFolder})">
            <button type="button" class="bulk-import-destination-btn" data-tooltip="Browse Foundry folders">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>
          <div class="bulk-import-destination-hint" style="font-size: 0.75rem; color: #888; margin-top: 4px;">
            <i class="fas fa-info-circle"></i> Required: Select or type a destination folder
          </div>
        </div>

        <!-- Options -->
        <div class="bulk-import-section">
          <div class="bulk-import-section-title">Options</div>
          <div class="bulk-import-options">
            <div class="bulk-import-option">
              <div class="bulk-import-option-label">
                <span>Include subfolders</span>
                <span>Recursively scan all subdirectories</span>
              </div>
              <button type="button" class="jb-toggle-switch ${config.accentClass} active" data-option="recursive">
              </button>
            </div>
            <div class="bulk-import-option">
              <div class="bulk-import-option-label">
                <span>Use folder names as tags</span>
                <span>Automatically create tags from folder structure</span>
              </div>
              <button type="button" class="jb-toggle-switch ${config.accentClass} active" data-option="folderTags">
              </button>
            </div>
          </div>
        </div>

        ${colorPickerHTML}

        <!-- Preview Section (hidden until scan) -->
        <div class="bulk-import-preview">
          <div class="bulk-import-preview-header">
            <div class="bulk-import-preview-title">
              <i class="fas fa-list"></i> Files Found
            </div>
            <div class="bulk-import-preview-actions">
              <button type="button" class="bulk-import-select-btn" data-action="all">Select All</button>
              <button type="button" class="bulk-import-select-btn" data-action="none">Select None</button>
              <button type="button" class="bulk-import-select-btn" data-action="supported">Supported Only</button>
            </div>
          </div>
          <div class="bulk-import-file-list"></div>
          <div class="bulk-import-summary">
            <div class="bulk-import-stat found">
              <i class="fas fa-file-audio"></i>
              <span class="stat-found">0</span> found
            </div>
            <div class="bulk-import-stat selected">
              <i class="fas fa-check-circle"></i>
              <span class="stat-selected">0</span> selected
            </div>
            <div class="bulk-import-stat errors">
              <i class="fas fa-exclamation-triangle"></i>
              <span class="stat-errors">0</span> unsupported
            </div>
          </div>
        </div>

        <!-- Progress Section (hidden until import starts) -->
        <div class="bulk-import-progress-section">
          <div class="bulk-import-progress-bar">
            <div class="bulk-import-progress-fill"></div>
          </div>
          <div class="bulk-import-progress-text">
            <span class="bulk-import-progress-file">Preparing...</span>
            <span class="bulk-import-progress-percent">0%</span>
          </div>
        </div>
      </div>

      <div class="bulk-import-footer">
        <button type="button" class="bulk-import-cancel-btn">Cancel</button>
        <button type="button" class="bulk-import-import-btn" disabled>
          <i class="fas fa-file-import"></i> Import Selected
        </button>
      </div>
    `;

    // State for the dialog
    let scannedFiles = [];
    let computerFiles = []; // Raw File objects from computer
    let selectedFolder = '';
    let selectedColor = SOUNDBOARD_COLORS[0];
    let isImporting = false;
    let sourceMode = 'computer'; // 'computer' or 'foundry'

    const dialog = new Dialog({
      title: config.title,
      content: content,
      classes: ['narrator-jukebox-dialog', 'bulk-import-dialog', config.accentClass],
      buttons: {},
      render: (html) => {
        const dialogApp = html.closest('.app.dialog');
        if (dialogApp.length) {
          dialogApp.css({
            'background': '#0a0a0a',
            'border': '1px solid rgba(255, 255, 255, 0.1)',
            'border-radius': '12px',
            'min-width': '550px'
          });
        }

        // Source button toggle
        html.find('.bulk-import-source-btn').click(function() {
          html.find('.bulk-import-source-btn').removeClass('active');
          $(this).addClass('active');
          sourceMode = $(this).data('source');

          // Show/hide destination section based on source
          if (sourceMode === 'computer') {
            html.find('.bulk-import-destination-section').show();
            // Update validation state after showing destination
            validateImportReady(html);
            // Trigger file input click
            html.find('.bulk-import-computer-input').click();
          } else {
            html.find('.bulk-import-destination-section').hide();
            // Open Foundry FilePicker
            new (getFilePicker())({
              type: "folder",
              callback: async (path) => {
                selectedFolder = path;
                html.find('.bulk-import-folder-input').val(path);
                // Auto-scan for Foundry source
                await scanFoundryFolder(path);
              }
            }).browse();
          }
        });

        // Browse button (re-browse)
        html.find('.bulk-import-browse-btn').click(() => {
          if (sourceMode === 'computer') {
            html.find('.bulk-import-computer-input').click();
          } else {
            new (getFilePicker())({
              type: "folder",
              callback: async (path) => {
                selectedFolder = path;
                html.find('.bulk-import-folder-input').val(path);
                await scanFoundryFolder(path);
              }
            }).browse();
          }
        });

        // Destination folder picker
        html.find('.bulk-import-destination-btn').click(() => {
          new (getFilePicker())({
            type: "folder",
            callback: (path) => {
              html.find('.bulk-import-destination-input').val(path);
              validateImportReady(html);
            }
          }).browse();
        });

        // Computer file input change handler
        html.find('.bulk-import-computer-input').on('change', async (e) => {
          const files = Array.from(e.target.files);
          if (files.length === 0) return;

          // Filter to audio files only
          const audioFiles = files.filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return AUDIO_EXTENSIONS.includes(ext);
          });

          if (audioFiles.length === 0) {
            ui.notifications.warn("No audio files found in the selected folder.");
            return;
          }

          // Get folder name from first file's path
          const firstPath = files[0].webkitRelativePath;
          const folderName = firstPath.split('/')[0];
          selectedFolder = folderName;
          html.find('.bulk-import-folder-input').val(folderName + ' (from computer)');

          // Store raw files for later upload
          computerFiles = audioFiles;

          // Get options
          const recursive = html.find('[data-option="recursive"]').hasClass('active');
          const useFolderTags = html.find('[data-option="folderTags"]').hasClass('active');

          // Process files
          scannedFiles = audioFiles.map(file => {
            const relativePath = file.webkitRelativePath;
            const pathParts = relativePath.split('/');
            const filename = pathParts.pop();

            // Remove extension and clean filename
            let name = filename.replace(/\.[^/.]+$/, '');
            try { name = decodeURIComponent(name); } catch(e) {}
            name = name.replace(/[-_]/g, ' ');

            // Extract tags from folder path (excluding root folder and filename)
            let tags = [];
            if (useFolderTags && pathParts.length > 1) {
              // Skip the first element (root folder) and use remaining as tags
              tags = pathParts.slice(1).map(t => {
                try { t = decodeURIComponent(t); } catch(e) {}
                return t.replace(/[-_]/g, ' ').trim().toLowerCase();
              }).filter(t => t);
            }

            const ext = filename.split('.').pop().toLowerCase();
            const supported = JukeboxBrowser.isFormatSupported(filename);

            return {
              file: file, // Keep reference to File object
              path: relativePath,
              name: name,
              tags: tags,
              supported: supported,
              extension: ext
            };
          });

          // Filter based on recursive option
          if (!recursive) {
            // Only keep files in root folder (pathParts length == 2 means root/file.mp3)
            scannedFiles = scannedFiles.filter(f => f.path.split('/').length === 2);
          }

          updateFileListUI(html);
        });

        // Scan Foundry folder function
        const scanFoundryFolder = async (path) => {
          html.find('.bulk-import-preview').removeClass('visible');
          html.find('.bulk-import-file-list').empty();

          const recursive = html.find('[data-option="recursive"]').hasClass('active');
          const useFolderTags = html.find('[data-option="folderTags"]').hasClass('active');

          try {
            scannedFiles = await this._scanFolderForAudio(path, path, recursive, useFolderTags);
            computerFiles = []; // Clear computer files

            if (scannedFiles.length === 0) {
              ui.notifications.warn("No audio files found in the selected folder.");
              return;
            }

            updateFileListUI(html);
          } catch (error) {
            console.error("Narrator Jukebox | Scan error:", error);
            ui.notifications.error("Error scanning folder. Check console for details.");
          }
        };

        // Validate if import is ready (source selected, destination if computer mode)
        const validateImportReady = (html) => {
          const hasFiles = scannedFiles.length > 0;
          const hasSelectedFiles = html.find('.bulk-import-file-checkbox:checked').length > 0;
          const destination = html.find('.bulk-import-destination-input').val().trim();
          const needsDestination = sourceMode === 'computer';
          const hasDestination = !needsDestination || destination.length > 0;

          const isReady = hasFiles && hasSelectedFiles && hasDestination;
          html.find('.bulk-import-import-btn').prop('disabled', !isReady);

          // Update destination hint based on state
          const hintEl = html.find('.bulk-import-destination-hint');
          if (needsDestination) {
            if (!hasDestination) {
              // Missing destination - show red warning
              hintEl.html('<i class="fas fa-exclamation-circle"></i> Required: Select or type a destination folder');
              hintEl.css('color', '#ff6b6b');
            } else if (hasFiles && hasSelectedFiles) {
              // All good - show green success
              hintEl.html('<i class="fas fa-check-circle"></i> Ready to import!');
              hintEl.css('color', '#1db954');
            } else {
              // Destination ok but waiting for files
              hintEl.html('<i class="fas fa-info-circle"></i> Destination folder set');
              hintEl.css('color', '#888');
            }
          }

          return isReady;
        };

        // Update file list UI
        const updateFileListUI = (html) => {
          if (scannedFiles.length === 0) return;

          const fileListHTML = scannedFiles.map((file, index) => `
            <div class="bulk-import-file-item ${!file.supported ? 'unsupported' : ''}" data-index="${index}">
              <input type="checkbox" class="bulk-import-file-checkbox" ${file.supported ? 'checked' : ''} data-index="${index}">
              <div class="bulk-import-file-info">
                <div class="bulk-import-file-name">${file.name}</div>
                <div class="bulk-import-file-path">${file.path}</div>
              </div>
              ${file.tags.length > 0 ? `
                <div class="bulk-import-file-tags">
                  ${file.tags.map(tag => `<span class="bulk-import-file-tag">${tag}</span>`).join('')}
                </div>
              ` : ''}
              ${!file.supported ? `
                <div class="bulk-import-file-warning" data-tooltip="Format .${file.extension} may not be supported in your browser">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>.${file.extension}</span>
                </div>
              ` : ''}
            </div>
          `).join('');

          html.find('.bulk-import-file-list').html(fileListHTML);
          html.find('.bulk-import-preview').addClass('visible');

          // Set checkbox properties after DOM insertion (jQuery :checked needs the property, not the attribute)
          html.find('.bulk-import-file-checkbox').each(function() {
            const index = $(this).data('index');
            const file = scannedFiles[index];
            $(this).prop('checked', file.supported);
          });

          // Update stats and validate
          this._updateBulkImportStats(html, scannedFiles);
          validateImportReady(html);
        };

        // Toggle switches
        html.find('.jb-toggle-switch').click(function() {
          $(this).toggleClass('active');
        });

        // Color picker for soundboard
        if (type === 'soundboard') {
          html.find('.bulk-import-color').click(function() {
            html.find('.bulk-import-color').removeClass('selected');
            $(this).addClass('selected');
            selectedColor = $(this).data('color');
          });

          html.find('.bulk-import-color-custom').click(() => {
            html.find('.bulk-import-color-input').click();
          });

          html.find('.bulk-import-color-input').on('input', function() {
            selectedColor = $(this).val();
            html.find('.bulk-import-color').removeClass('selected');
            $(this).prev('.bulk-import-color-custom').css('background', selectedColor).addClass('selected');
          });
        }

        // Checkbox change handler
        html.on('change', '.bulk-import-file-checkbox', () => {
          this._updateBulkImportStats(html, scannedFiles);
          validateImportReady(html);
        });

        // Destination input change handler
        html.find('.bulk-import-destination-input').on('input', () => {
          validateImportReady(html);
        });

        // Select All / None / Supported buttons
        html.find('.bulk-import-select-btn').click(function() {
          const action = $(this).data('action');
          html.find('.bulk-import-file-checkbox').each(function() {
            const index = $(this).data('index');
            const file = scannedFiles[index];
            if (action === 'all') {
              $(this).prop('checked', true);
            } else if (action === 'none') {
              $(this).prop('checked', false);
            } else if (action === 'supported') {
              $(this).prop('checked', file.supported);
            }
          });
          html.find('.bulk-import-file-checkbox').first().trigger('change');
        });

        // Cancel button
        html.find('.bulk-import-cancel-btn').click(() => {
          if (isImporting) {
            isImporting = false;
            ui.notifications.info("Import cancelled.");
          }
          dialog.close();
        });

        // Import button
        html.find('.bulk-import-import-btn').click(async () => {
          const selectedFiles = [];
          html.find('.bulk-import-file-checkbox:checked').each(function() {
            const index = $(this).data('index');
            selectedFiles.push(scannedFiles[index]);
          });

          if (selectedFiles.length === 0) {
            ui.notifications.warn("No files selected for import.");
            return;
          }

          isImporting = true;
          html.find('.bulk-import-import-btn').prop('disabled', true);
          html.find('.bulk-import-progress-section').addClass('visible');

          let imported = 0;
          let errors = 0;
          let skipped = 0;

          const destination = html.find('.bulk-import-destination-input').val().trim() || config.defaultFolder;

          for (let i = 0; i < selectedFiles.length; i++) {
            if (!isImporting) break;

            const file = selectedFiles[i];
            const percent = Math.round(((i + 1) / selectedFiles.length) * 100);

            // Update progress
            html.find('.bulk-import-progress-fill').css('width', `${percent}%`);
            html.find('.bulk-import-progress-file').text(`${sourceMode === 'computer' ? 'Uploading' : 'Importing'}: ${file.name}`);
            html.find('.bulk-import-progress-percent').text(`${percent}%`);

            try {
              let finalPath = file.path;

              // If from computer, upload first
              if (sourceMode === 'computer' && file.file) {
                // Build the destination path preserving folder structure
                const relativePath = file.path.split('/').slice(1).join('/'); // Remove root folder
                const destPath = relativePath ? `${destination}/${relativePath}` : `${destination}/${file.file.name}`;
                const destFolder = destPath.substring(0, destPath.lastIndexOf('/'));

                // Ensure destination folder exists (create if needed)
                const FP = getFilePicker();
                try {
                  await FP.browse("data", destFolder);
                } catch (folderError) {
                  // Folder doesn't exist, create it
                  try {
                    await FP.createDirectory("data", destFolder, {});
                  } catch (createError) {
                    // Try to create parent folders recursively
                    const parts = destFolder.split('/');
                    let currentPath = '';
                    for (const part of parts) {
                      currentPath = currentPath ? `${currentPath}/${part}` : part;
                      try {
                        await FP.browse("data", currentPath);
                      } catch (e) {
                        try {
                          await FP.createDirectory("data", currentPath, {});
                        } catch (e2) {
                          // Ignore if already exists
                        }
                      }
                    }
                  }
                }

                // Check if file already exists
                try {
                  const existsCheck = await FP.browse("data", destFolder);
                  const fileName = file.file.name;
                  const fileExists = existsCheck.files.some(f => f.endsWith('/' + fileName) || f === fileName);

                  if (fileExists) {
                    // Show confirmation dialog for duplicate
                    const action = await new Promise(resolve => {
                      new Dialog({
                        title: "File Already Exists",
                        content: `<p style="color: white;">The file <strong>${fileName}</strong> already exists in the destination folder.</p><p style="color: #b3b3b3;">What would you like to do?</p>`,
                        classes: ['narrator-jukebox-dialog'],
                        buttons: {
                          skip: {
                            icon: '<i class="fas fa-forward"></i>',
                            label: "Skip",
                            callback: () => resolve('skip')
                          },
                          overwrite: {
                            icon: '<i class="fas fa-sync"></i>',
                            label: "Overwrite",
                            callback: () => resolve('overwrite')
                          },
                          skipAll: {
                            icon: '<i class="fas fa-fast-forward"></i>',
                            label: "Skip All Duplicates",
                            callback: () => resolve('skipAll')
                          }
                        },
                        default: "skip",
                        render: (html) => {
                          html.closest('.app.dialog').css({
                            'background': '#0a0a0a',
                            'border': '1px solid rgba(255, 255, 255, 0.1)'
                          });
                        }
                      }).render(true);
                    });

                    if (action === 'skip') {
                      skipped++;
                      continue;
                    } else if (action === 'skipAll') {
                      // Skip all remaining duplicates - just use existing path
                      skipped++;
                      // Mark to skip future duplicates
                      this._skipAllDuplicates = true;
                      continue;
                    }
                    // 'overwrite' continues to upload
                  }
                } catch (e) {
                  // Folder doesn't exist, will be created during upload
                }

                // Skip if we're in skipAll mode
                if (this._skipAllDuplicates) {
                  try {
                    const checkFolder = destPath.substring(0, destPath.lastIndexOf('/'));
                    const existsCheck = await FP.browse("data", checkFolder);
                    if (existsCheck.files.some(f => f.endsWith('/' + file.file.name))) {
                      skipped++;
                      continue;
                    }
                  } catch (e) {}
                }

                // Upload the file
                try {
                  const response = await FP.upload("data", destFolder, file.file, {});
                  finalPath = response.path;
                } catch (uploadError) {
                  console.error(`Narrator Jukebox | Upload error for ${file.name}:`, uploadError);
                  errors++;
                  continue;
                }
              }

              // Skip if finalPath is undefined (upload failed or no valid path)
              if (!finalPath) {
                console.error(`Narrator Jukebox | No valid path for ${file.name}, skipping...`);
                errors++;
                continue;
              }

              // Create data object based on type
              const data = {
                id: foundry.utils.randomID(),
                name: file.name,
                source: 'local',
                url: finalPath,
                tags: file.tags,
                thumbnail: ''
              };

              // Add soundboard-specific properties
              if (type === 'soundboard') {
                data.volume = 1.0;
                data.color = selectedColor;
                data.icon = 'fas fa-music';
                data.startTime = null;
                data.endTime = null;
              }

              // Call the appropriate add method
              await this.jukebox[config.addMethod](data);
              imported++;

            } catch (error) {
              console.error(`Narrator Jukebox | Error importing ${file.name}:`, error);
              errors++;
            }

            // Small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          isImporting = false;
          this._skipAllDuplicates = false;

          // Show completion message
          let message = `Successfully imported ${imported} files!`;
          if (skipped > 0) message += ` (${skipped} skipped)`;
          if (errors > 0) message += ` (${errors} errors)`;

          if (errors === 0) {
            ui.notifications.info(message);
          } else {
            ui.notifications.warn(message);
          }

          // Refresh the app and close dialog
          this.render();
          dialog.close();
        });
      }
    }, {
      width: 600,
      height: 'auto',
      resizable: true
    });

    dialog.render(true);
  }

  /**
   * Update the stats display in bulk import dialog
   */
  _updateBulkImportStats(html, files) {
    const total = files.length;
    const selected = html.find('.bulk-import-file-checkbox:checked').length;
    const unsupported = files.filter(f => !f.supported).length;

    html.find('.stat-found').text(total);
    html.find('.stat-selected').text(selected);
    html.find('.stat-errors').text(unsupported);

    // Enable/disable import button based on selection
    html.find('.bulk-import-import-btn').prop('disabled', selected === 0);
  }

  async showAddAmbienceDialog() {
    const isGM = game.user.isGM;
    if (!isGM) {
        ui.notifications.warn("Only the GM can add ambience tracks.");
        return;
    }

    const content = `
      <div class="add-track-dialog ambience-dialog">
        <div class="dialog-header">
          <div class="header-icon ambience-icon">
            <i class="fas fa-cloud-sun"></i>
          </div>
          <div class="header-info">
            <h2>Add Ambience Track</h2>
            <p>Add atmospheric sounds to enhance your scenes</p>
          </div>
        </div>

        <form class="track-form">
          <div class="form-section">
            <div class="form-group">
              <label><i class="fas fa-heading"></i> Ambience Name</label>
              <input type="text" name="name" placeholder="Enter ambience name" spellcheck="false">
            </div>

            <div class="form-row">
              <div class="form-group source-group">
                <label><i class="fas fa-database"></i> Source</label>
                <div class="source-selector">
                  <button type="button" class="source-btn active" data-source="local">
                    <i class="fas fa-folder"></i> Local File
                  </button>
                  <button type="button" class="source-btn" data-source="youtube">
                    <i class="fab fa-youtube"></i> YouTube
                  </button>
                </div>
                <input type="hidden" name="source" value="local">
              </div>
            </div>

            <div class="form-group url-group">
              <label><i class="fas fa-link"></i> <span class="url-label">File Path</span>${JukeboxBrowser.getFormatsTagHTML()}</label>
              <div class="url-input-wrapper">
                <input type="text" name="url" placeholder="Select a file or paste path" spellcheck="false">
                <button type="button" class="browse-btn file-picker-btn">
                  <i class="fas fa-folder-open"></i>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-tags"></i> Tags</label>
              <input type="text" name="tags" placeholder="rain, forest, tavern (comma-separated)" spellcheck="false">
              <span class="field-hint">Tags help organize and filter your ambience</span>
            </div>

            <div class="form-group thumbnail-group">
              <label><i class="fas fa-image"></i> Thumbnail <span class="optional">(optional)</span></label>
              <div class="thumbnail-wrapper">
                <div class="thumbnail-preview ambience-preview">
                  <i class="fas fa-cloud-sun"></i>
                </div>
                <div class="thumbnail-input">
                  <input type="text" name="thumbnail" placeholder="Image URL (auto-filled for YouTube)" spellcheck="false">
                  <button type="button" class="browse-btn thumbnail-picker-btn">
                    <i class="fas fa-folder-open"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    new Dialog({
        title: "Add Ambience Track",
        content: content,
        classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'ambience-theme'],
        render: (html) => {
            // Force dark theme via inline styles to override Foundry defaults
            const dialogApp = html.closest('.app.dialog');
            if (dialogApp.length) {
                dialogApp.css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border': '1px solid rgba(255, 255, 255, 0.1)',
                    'border-radius': '12px'
                });
                dialogApp.find('.window-header').css({
                    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                    'background-color': '#1a1a1a',
                    'border-bottom': '1px solid rgba(102, 126, 234, 0.3)',
                    'border-radius': '12px 12px 0 0'
                });
                dialogApp.find('.window-header .window-title').css('color', '#fff');
                dialogApp.find('.window-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-buttons').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                    'padding': '16px 24px'
                });
                dialogApp.find('.dialog-buttons button').css({
                    'background': '#667eea',
                    'color': '#fff',
                    'border': 'none',
                    'border-radius': '20px',
                    'padding': '10px 24px',
                    'font-weight': '600'
                });
            }

            const urlInput = html.find('input[name="url"]');
            const sourceHidden = html.find('input[name="source"]');
            const sourceButtons = html.find('.source-btn');
            const urlLabel = html.find('.url-label');
            const browseBtn = html.find('.file-picker-btn');
            const thumbnailPreview = html.find('.thumbnail-preview');

            // Source selector buttons
            sourceButtons.click((e) => {
                e.preventDefault();
                const btn = $(e.currentTarget);
                const source = btn.data('source');

                sourceButtons.removeClass('active');
                btn.addClass('active');
                sourceHidden.val(source);

                // Update UI based on source
                if (source === 'youtube') {
                    urlLabel.text('YouTube URL');
                    urlInput.attr('placeholder', 'Paste YouTube URL here');
                    browseBtn.hide();
                } else {
                    urlLabel.text('File Path');
                    urlInput.attr('placeholder', 'Select a file or paste path');
                    browseBtn.show();
                }
            });

            // File Picker
            html.find('.file-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "audio",
                    current: urlInput.val(),
                    callback: (path) => {
                        urlInput.val(path);
                        // Auto-fill name from filename if empty
                        const nameInput = html.find('input[name="name"]');
                        if (!nameInput.val()) {
                            let filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
                            // Decode URL-encoded characters (%20 = space, %5B = [, etc.)
                            try { filename = decodeURIComponent(filename); } catch(e) {}
                            nameInput.val(filename.replace(/[-_]/g, ' '));
                        }
                    }
                }).browse();
            });

            // Thumbnail Picker
            html.find('.thumbnail-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "image",
                    current: html.find('input[name="thumbnail"]').val(),
                    callback: (path) => {
                        html.find('input[name="thumbnail"]').val(path);
                        thumbnailPreview.html(`<img src="${path}" alt="Thumbnail">`);
                    }
                }).browse();
            });

            // Update thumbnail preview
            html.find('input[name="thumbnail"]').on('input', (e) => {
                const url = e.target.value;
                if (url) {
                    thumbnailPreview.html(`<img src="${url}" alt="Thumbnail">`);
                } else {
                    thumbnailPreview.html('<i class="fas fa-cloud-sun"></i>');
                }
            });

            // Auto-fill YouTube data
            urlInput.on('input', async (e) => {
                const url = e.target.value;
                const source = sourceHidden.val();

                if (source === 'youtube' && url) {
                    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                    const match = url.match(regExp);
                    const id = (match && match[7].length === 11) ? match[7] : null;

                    if (id) {
                        const thumbUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
                        html.find('input[name="thumbnail"]').val(thumbUrl);
                        thumbnailPreview.html(`<img src="${thumbUrl}" alt="Thumbnail">`);

                        try {
                            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
                            const data = await response.json();
                            if (data.title) {
                                html.find('input[name="name"]').val(data.title);
                            }
                        } catch (err) {
                            console.warn("Narrator Jukebox | Could not fetch YouTube title", err);
                        }
                    }
                }
            });
        },
        buttons: {
            add: {
                icon: '<i class="fas fa-plus"></i>',
                label: "Add Ambience",
                callback: async (html) => {
                    const formElement = html.find('form')[0];
                    if (!formElement) return;

                    const nameInput = formElement.name;
                    const urlInput = formElement.url;
                    const sourceValue = formElement.source.value;

                    let isValid = true;

                    if (!this._validateField(nameInput, "Ambience name is required")) {
                        isValid = false;
                    }

                    if (!this._validateUrl(urlInput.value, sourceValue)) {
                        const errorMsg = sourceValue === 'youtube'
                            ? "Please enter a valid YouTube URL"
                            : "URL is required";
                        if (!this._validateField(urlInput, errorMsg)) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before submitting");
                        return false;
                    }

                    const data = {
                        id: foundry.utils.randomID(),
                        name: formElement.name.value.trim(),
                        source: formElement.source.value,
                        url: formElement.url.value.trim(),
                        tags: formElement.tags.value.split(',').map(t => t.trim()).filter(t => t),
                        thumbnail: formElement.thumbnail.value.trim()
                    };

                    try {
                        await this.jukebox.addAmbience(data);
                        ui.notifications.info(`Added ambience: ${data.name}`);
                        this.render();
                    } catch (err) {
                        console.error("Narrator Jukebox | Failed to add ambience:", err);
                        ui.notifications.error(`Failed to add ambience: ${err.message}`);
                    }
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
  }

  async showEditAmbienceDialog(id) {
    const track = this.jukebox.ambience.find(a => a.id === id);
    if (!track) return;

    const content = `
      <form>
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${track.name}">
        </div>
        <div class="form-group">
          <label>URL</label>
          <input type="text" name="url" value="${track.url}">
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input type="text" name="tags" value="${track.tags.join(', ')}">
        </div>
        <div class="form-group">
          <label>Thumbnail</label>
          <input type="text" name="thumbnail" value="${track.thumbnail || ''}">
        </div>
      </form>
    `;

    new Dialog({
        title: "Edit Ambience",
        content: content,
        classes: ['narrator-jukebox-dialog'],
        buttons: {
            save: {
                label: "Save",
                callback: async (html) => {
                    const form = html.find('form')[0];

                    const nameInput = form.name;
                    const urlInput = form.url;

                    let isValid = true;

                    if (!this._validateField(nameInput, "Ambience name is required")) {
                        isValid = false;
                    }

                    if (!this._validateUrl(urlInput.value, track.source || 'local')) {
                        if (!this._validateField(urlInput, "Valid URL is required")) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before saving");
                        return false;
                    }

                    const data = {
                        name: form.name.value.trim(),
                        url: form.url.value.trim(),
                        tags: form.tags.value.split(',').map(t => t.trim()).filter(t => t),
                        thumbnail: form.thumbnail.value.trim()
                    };
                    await this.jukebox.updateAmbience(id, data);
                    this.render();
                }
            }
        }
    }).render(true);
  }

  /**
   * Approve a player suggestion and add it to the music library
   * @param {number} index - The index of the suggestion in the suggestions array
   */
  async approveSuggestion(index) {
    if (!game.user.isGM) return;

    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];
    const suggestion = suggestions[index];

    if (!suggestion) {
        ui.notifications.error("Suggestion not found!");
        return;
    }

    // Add the suggestion to the music library
    const newTrack = {
        id: foundry.utils.randomID(),
        name: suggestion.name,
        url: suggestion.url,
        source: suggestion.source,
        tags: suggestion.tags || [],
        thumbnail: suggestion.thumbnail || ""
    };

    await this.jukebox.addMusic(newTrack);

    // Remove the suggestion from the list
    suggestions.splice(index, 1);
    await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);

    ui.notifications.info(`Added "${newTrack.name}" to the music library!`);
    this.render();
  }

  /**
   * Reject a player suggestion and remove it from the list
   * @param {number} index - The index of the suggestion in the suggestions array
   */
  async rejectSuggestion(index) {
    if (!game.user.isGM) return;

    const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];
    const suggestion = suggestions[index];

    if (!suggestion) {
        ui.notifications.error("Suggestion not found!");
        return;
    }

    const trackName = suggestion.name;

    // Remove the suggestion from the list
    suggestions.splice(index, 1);
    await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);

    ui.notifications.info(`Rejected suggestion "${trackName}".`);
    this.render();
  }

  // ==========================================
  // Soundboard Dialogs
  // ==========================================

  async showAddSoundboardDialog() {
    const content = `
      <div class="add-track-dialog soundboard-dialog">
        <form class="track-form">
          <div class="form-section">
            <div class="form-group">
              <label><i class="fas fa-heading"></i> Sound Name</label>
              <input type="text" name="name" placeholder="e.g., Wolf Howl, Thunder, Door Creak" spellcheck="false">
            </div>

            <div class="form-row">
              <div class="form-group source-group">
                <label><i class="fas fa-database"></i> Source</label>
                <div class="source-selector">
                  <button type="button" class="source-btn active" data-source="local">
                    <i class="fas fa-folder"></i> Local File
                  </button>
                  <button type="button" class="source-btn" data-source="youtube">
                    <i class="fab fa-youtube"></i> YouTube
                  </button>
                </div>
                <input type="hidden" name="source" value="local">
              </div>
            </div>

            <div class="form-group url-group">
              <label><i class="fas fa-link"></i> <span class="url-label">File Path</span>${JukeboxBrowser.getFormatsTagHTML()}</label>
              <div class="url-input-wrapper">
                <input type="text" name="url" placeholder="Select a file or paste path" spellcheck="false">
                <button type="button" class="browse-btn file-picker-btn">
                  <i class="fas fa-folder-open"></i>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-volume-up"></i> Default Volume</label>
              <div class="volume-input-wrapper">
                <input type="range" name="volume" min="0" max="100" value="80" class="volume-range">
                <span class="volume-value">80%</span>
              </div>
            </div>

            <div class="form-group trim-group">
              <label><i class="fas fa-cut"></i> Trim Sound <span class="optional">(optional - set start/end times)</span></label>
              <div class="trim-inputs">
                <div class="trim-input-group">
                  <label>Start (In)</label>
                  <div class="time-input-wrapper">
                    <input type="text" name="startTime" placeholder="0:00" class="time-input" spellcheck="false">
                    <span class="time-hint">mm:ss</span>
                  </div>
                </div>
                <div class="trim-input-group">
                  <label>End (Out)</label>
                  <div class="time-input-wrapper">
                    <input type="text" name="endTime" placeholder="End" class="time-input" spellcheck="false">
                    <span class="time-hint">mm:ss</span>
                  </div>
                </div>
              </div>
              <small class="trim-help">Leave empty to play full sound. Examples: 0:05 (5 seconds), 1:30 (1 min 30 sec)</small>
            </div>

            <div class="form-group">
              <label><i class="fas fa-palette"></i> Card Color</label>
              <div class="color-picker-wrapper">
                <input type="color" name="color" value="#ff6b35" class="color-picker">
                <div class="color-presets">
                  <button type="button" class="color-preset" data-color="#ff6b35" style="background: #ff6b35;" title="Orange"></button>
                  <button type="button" class="color-preset" data-color="#e74c3c" style="background: #e74c3c;" title="Red"></button>
                  <button type="button" class="color-preset" data-color="#9b59b6" style="background: #9b59b6;" title="Purple"></button>
                  <button type="button" class="color-preset" data-color="#3498db" style="background: #3498db;" title="Blue"></button>
                  <button type="button" class="color-preset" data-color="#1abc9c" style="background: #1abc9c;" title="Teal"></button>
                  <button type="button" class="color-preset" data-color="#2ecc71" style="background: #2ecc71;" title="Green"></button>
                  <button type="button" class="color-preset" data-color="#f39c12" style="background: #f39c12;" title="Yellow"></button>
                  <button type="button" class="color-preset" data-color="#e91e63" style="background: #e91e63;" title="Pink"></button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-icons"></i> Icon</label>
              <div class="icon-picker-wrapper">
                <input type="hidden" name="icon" value="fas fa-volume-up">
                <div class="icon-preview">
                  <i class="fas fa-volume-up"></i>
                </div>
                <div class="icon-presets">
                  <button type="button" class="icon-preset" data-icon="fas fa-volume-up" title="Sound"><i class="fas fa-volume-up"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bolt" title="Thunder"><i class="fas fa-bolt"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-wind" title="Wind"><i class="fas fa-wind"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-water" title="Water"><i class="fas fa-water"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-fire" title="Fire"><i class="fas fa-fire"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-door-open" title="Door"><i class="fas fa-door-open"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-skull" title="Skull"><i class="fas fa-skull"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-paw" title="Animal"><i class="fas fa-paw"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-sword" title="Sword"><i class="fas fa-sword"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-magic" title="Magic"><i class="fas fa-magic"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bell" title="Bell"><i class="fas fa-bell"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-ghost" title="Ghost"><i class="fas fa-ghost"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-heart-broken" title="Heartbreak"><i class="fas fa-heart-broken"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bomb" title="Explosion"><i class="fas fa-bomb"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-crow" title="Bird"><i class="fas fa-crow"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-clock" title="Clock"><i class="fas fa-clock"></i></button>
                </div>
              </div>
            </div>

            <div class="form-group thumbnail-group">
              <label><i class="fas fa-image"></i> Thumbnail <span class="optional">(optional)</span></label>
              <div class="thumbnail-wrapper">
                <div class="thumbnail-preview soundboard-preview">
                  <i class="fas fa-volume-up"></i>
                </div>
                <div class="thumbnail-input">
                  <input type="text" name="thumbnail" placeholder="Image URL (auto-filled for YouTube)" spellcheck="false">
                  <button type="button" class="browse-btn thumbnail-picker-btn">
                    <i class="fas fa-folder-open"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    new Dialog({
        title: "Add Soundboard Sound",
        content: content,
        classes: ['narrator-jukebox-dialog', 'add-track-dialog-window', 'soundboard-theme'],
        render: (html) => {
            // Force dark theme via inline styles
            const dialogApp = html.closest('.app.dialog');
            if (dialogApp.length) {
                dialogApp.css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border': '1px solid rgba(255, 255, 255, 0.1)',
                    'border-radius': '12px'
                });
                dialogApp.find('.window-header').css({
                    'background': 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                    'background-color': '#1a1a1a',
                    'border-bottom': '1px solid rgba(255, 107, 53, 0.3)',
                    'border-radius': '12px 12px 0 0'
                });
                dialogApp.find('.window-header .window-title').css('color', '#fff');
                dialogApp.find('.window-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-content').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'color': '#ffffff'
                });
                dialogApp.find('.dialog-buttons').css({
                    'background': '#0a0a0a',
                    'background-color': '#0a0a0a',
                    'border-top': '1px solid rgba(255, 255, 255, 0.06)',
                    'padding': '16px 24px'
                });
                dialogApp.find('.dialog-buttons button').css({
                    'background': '#ff6b35',
                    'color': '#fff',
                    'border': 'none',
                    'border-radius': '20px',
                    'padding': '10px 24px',
                    'font-weight': '600'
                });
            }

            const urlInput = html.find('input[name="url"]');
            const sourceHidden = html.find('input[name="source"]');
            const sourceButtons = html.find('.source-btn');
            const urlLabel = html.find('.url-label');
            const browseBtn = html.find('.file-picker-btn');
            const thumbnailPreview = html.find('.thumbnail-preview');
            const volumeRange = html.find('input[name="volume"]');
            const volumeValue = html.find('.volume-value');
            const colorPicker = html.find('input[name="color"]');
            const iconHidden = html.find('input[name="icon"]');
            const iconPreview = html.find('.icon-preview i');

            // Volume slider update
            volumeRange.on('input', (e) => {
                volumeValue.text(`${e.target.value}%`);
            });

            // Color presets
            html.find('.color-preset').click((e) => {
                e.preventDefault();
                const color = $(e.currentTarget).data('color');
                colorPicker.val(color);
            });

            // Icon presets
            html.find('.icon-preset').click((e) => {
                e.preventDefault();
                const icon = $(e.currentTarget).data('icon');
                iconHidden.val(icon);
                iconPreview.attr('class', icon);
                html.find('.icon-preset').removeClass('active');
                $(e.currentTarget).addClass('active');
            });

            // Source selector buttons
            sourceButtons.click((e) => {
                e.preventDefault();
                const btn = $(e.currentTarget);
                const source = btn.data('source');

                sourceButtons.removeClass('active');
                btn.addClass('active');
                sourceHidden.val(source);

                if (source === 'youtube') {
                    urlLabel.text('YouTube URL');
                    urlInput.attr('placeholder', 'Paste YouTube URL here');
                    browseBtn.hide();
                } else {
                    urlLabel.text('File Path');
                    urlInput.attr('placeholder', 'Select a file or paste path');
                    browseBtn.show();
                }
            });

            // File Picker
            html.find('.file-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "audio",
                    current: urlInput.val(),
                    callback: (path) => {
                        urlInput.val(path);
                        // Auto-fill name from filename if empty
                        const nameInput = html.find('input[name="name"]');
                        if (!nameInput.val()) {
                            let filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
                            // Decode URL-encoded characters (%20 = space, %5B = [, etc.)
                            try { filename = decodeURIComponent(filename); } catch(e) {}
                            nameInput.val(filename.replace(/[-_]/g, ' '));
                        }
                    }
                }).browse();
            });

            // Thumbnail Picker
            html.find('.thumbnail-picker-btn').click(() => {
                new (getFilePicker())({
                    type: "image",
                    current: html.find('input[name="thumbnail"]').val(),
                    callback: (path) => {
                        html.find('input[name="thumbnail"]').val(path);
                        thumbnailPreview.html(`<img src="${path}" alt="Thumbnail">`);
                    }
                }).browse();
            });

            // Auto-fill YouTube data
            urlInput.on('input', async (e) => {
                const url = e.target.value;
                const source = sourceHidden.val();

                if (source === 'youtube' && url) {
                    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                    const match = url.match(regExp);
                    const id = (match && match[7].length === 11) ? match[7] : null;

                    if (id) {
                        const thumbUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
                        html.find('input[name="thumbnail"]').val(thumbUrl);
                        thumbnailPreview.html(`<img src="${thumbUrl}" alt="Thumbnail">`);

                        try {
                            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
                            const data = await response.json();
                            if (data.title) {
                                html.find('input[name="name"]').val(data.title);
                            }
                        } catch (err) {
                            console.warn("Narrator Jukebox | Could not fetch YouTube title", err);
                        }
                    }
                }
            });
        },
        buttons: {
            add: {
                icon: '<i class="fas fa-plus"></i>',
                label: "Add Sound",
                callback: async (html) => {
                    const formElement = html.find('form')[0];
                    if (!formElement) return;

                    const nameInput = formElement.name;
                    const urlInput = formElement.url;
                    const sourceValue = formElement.source.value;

                    let isValid = true;

                    if (!this._validateField(nameInput, "Sound name is required")) {
                        isValid = false;
                    }

                    if (!this._validateUrl(urlInput.value, sourceValue)) {
                        const errorMsg = sourceValue === 'youtube'
                            ? "Please enter a valid YouTube URL"
                            : "URL is required";
                        if (!this._validateField(urlInput, errorMsg)) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before submitting");
                        return false;
                    }

                    // Parse time values (mm:ss format to seconds)
                    const parseTime = (timeStr) => {
                        if (!timeStr || !timeStr.trim()) return null;
                        const parts = timeStr.trim().split(':');
                        if (parts.length === 1) {
                            // Just seconds
                            return parseFloat(parts[0]) || null;
                        } else if (parts.length === 2) {
                            // mm:ss
                            const mins = parseInt(parts[0]) || 0;
                            const secs = parseFloat(parts[1]) || 0;
                            return mins * 60 + secs;
                        } else if (parts.length === 3) {
                            // hh:mm:ss
                            const hours = parseInt(parts[0]) || 0;
                            const mins = parseInt(parts[1]) || 0;
                            const secs = parseFloat(parts[2]) || 0;
                            return hours * 3600 + mins * 60 + secs;
                        }
                        return null;
                    };

                    const startTime = parseTime(formElement.startTime.value);
                    const endTime = parseTime(formElement.endTime.value);

                    const data = {
                        id: foundry.utils.randomID(),
                        name: formElement.name.value.trim(),
                        source: formElement.source.value,
                        url: formElement.url.value.trim(),
                        volume: parseInt(formElement.volume.value) / 100,
                        color: formElement.color.value,
                        icon: formElement.icon.value,
                        thumbnail: formElement.thumbnail.value.trim(),
                        startTime: startTime,  // In point (seconds)
                        endTime: endTime       // Out point (seconds)
                    };

                    try {
                        await this.jukebox.addSoundboardSound(data);
                        ui.notifications.info(`Added sound: ${data.name}`);
                        this.render();
                    } catch (err) {
                        console.error("Narrator Jukebox | Failed to add soundboard sound:", err);
                        ui.notifications.error(`Failed to add sound: ${err.message}`);
                    }
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
  }

  async showEditSoundboardDialog(id) {
    const sound = this.jukebox.soundboard.find(s => s.id === id);
    if (!sound) return;

    // Helper to format seconds to mm:ss
    const formatTimeForInput = (seconds) => {
        if (seconds === null || seconds === undefined) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startTimeValue = formatTimeForInput(sound.startTime);
    const endTimeValue = formatTimeForInput(sound.endTime);

    const content = `
      <div class="add-track-dialog soundboard-dialog">
        <form class="track-form">
          <div class="form-section">
            <div class="form-group">
              <label><i class="fas fa-heading"></i> Sound Name</label>
              <input type="text" name="name" value="${sound.name}" spellcheck="false">
            </div>

            <div class="form-group url-group">
              <label><i class="fas fa-link"></i> URL</label>
              <input type="text" name="url" value="${sound.url}" spellcheck="false">
            </div>

            <div class="form-group">
              <label><i class="fas fa-volume-up"></i> Default Volume</label>
              <div class="volume-input-wrapper">
                <input type="range" name="volume" min="0" max="100" value="${Math.round((sound.volume || 0.8) * 100)}" class="volume-range">
                <span class="volume-value">${Math.round((sound.volume || 0.8) * 100)}%</span>
              </div>
            </div>

            <div class="form-group trim-group">
              <label><i class="fas fa-cut"></i> Trim Sound <span class="optional">(optional)</span></label>
              <div class="trim-inputs">
                <div class="trim-input-group">
                  <label>Start (In)</label>
                  <div class="time-input-wrapper">
                    <input type="text" name="startTime" value="${startTimeValue}" placeholder="0:00" class="time-input" spellcheck="false">
                    <span class="time-hint">mm:ss</span>
                  </div>
                </div>
                <div class="trim-input-group">
                  <label>End (Out)</label>
                  <div class="time-input-wrapper">
                    <input type="text" name="endTime" value="${endTimeValue}" placeholder="End" class="time-input" spellcheck="false">
                    <span class="time-hint">mm:ss</span>
                  </div>
                </div>
              </div>
              <small class="trim-help">Leave empty to play full sound.</small>
            </div>

            <div class="form-group">
              <label><i class="fas fa-palette"></i> Card Color</label>
              <div class="color-picker-wrapper">
                <input type="color" name="color" value="${sound.color || '#ff6b35'}" class="color-picker">
                <div class="color-presets">
                  <button type="button" class="color-preset" data-color="#ff6b35" style="background: #ff6b35;" title="Orange"></button>
                  <button type="button" class="color-preset" data-color="#e74c3c" style="background: #e74c3c;" title="Red"></button>
                  <button type="button" class="color-preset" data-color="#9b59b6" style="background: #9b59b6;" title="Purple"></button>
                  <button type="button" class="color-preset" data-color="#3498db" style="background: #3498db;" title="Blue"></button>
                  <button type="button" class="color-preset" data-color="#1abc9c" style="background: #1abc9c;" title="Teal"></button>
                  <button type="button" class="color-preset" data-color="#2ecc71" style="background: #2ecc71;" title="Green"></button>
                  <button type="button" class="color-preset" data-color="#f39c12" style="background: #f39c12;" title="Yellow"></button>
                  <button type="button" class="color-preset" data-color="#e91e63" style="background: #e91e63;" title="Pink"></button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-icons"></i> Icon</label>
              <div class="icon-picker-wrapper">
                <input type="hidden" name="icon" value="${sound.icon || 'fas fa-volume-up'}">
                <div class="icon-preview">
                  <i class="${sound.icon || 'fas fa-volume-up'}"></i>
                </div>
                <div class="icon-presets">
                  <button type="button" class="icon-preset" data-icon="fas fa-volume-up" title="Sound"><i class="fas fa-volume-up"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bolt" title="Thunder"><i class="fas fa-bolt"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-wind" title="Wind"><i class="fas fa-wind"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-water" title="Water"><i class="fas fa-water"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-fire" title="Fire"><i class="fas fa-fire"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-door-open" title="Door"><i class="fas fa-door-open"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-skull" title="Skull"><i class="fas fa-skull"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-paw" title="Animal"><i class="fas fa-paw"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-sword" title="Sword"><i class="fas fa-sword"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-magic" title="Magic"><i class="fas fa-magic"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bell" title="Bell"><i class="fas fa-bell"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-ghost" title="Ghost"><i class="fas fa-ghost"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-heart-broken" title="Heartbreak"><i class="fas fa-heart-broken"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-bomb" title="Explosion"><i class="fas fa-bomb"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-crow" title="Bird"><i class="fas fa-crow"></i></button>
                  <button type="button" class="icon-preset" data-icon="fas fa-clock" title="Clock"><i class="fas fa-clock"></i></button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label><i class="fas fa-image"></i> Thumbnail</label>
              <input type="text" name="thumbnail" value="${sound.thumbnail || ''}" spellcheck="false">
            </div>
          </div>
        </form>
      </div>
    `;

    new Dialog({
        title: "Edit Sound",
        content: content,
        classes: ['narrator-jukebox-dialog', 'soundboard-theme'],
        render: (html) => {
            const volumeRange = html.find('input[name="volume"]');
            const volumeValue = html.find('.volume-value');
            const colorPicker = html.find('input[name="color"]');
            const iconHidden = html.find('input[name="icon"]');
            const iconPreview = html.find('.icon-preview i');

            // Volume slider update
            volumeRange.on('input', (e) => {
                volumeValue.text(`${e.target.value}%`);
            });

            // Color presets
            html.find('.color-preset').click((e) => {
                e.preventDefault();
                const color = $(e.currentTarget).data('color');
                colorPicker.val(color);
            });

            // Icon presets
            html.find('.icon-preset').click((e) => {
                e.preventDefault();
                const icon = $(e.currentTarget).data('icon');
                iconHidden.val(icon);
                iconPreview.attr('class', icon);
                html.find('.icon-preset').removeClass('active');
                $(e.currentTarget).addClass('active');
            });
        },
        buttons: {
            save: {
                icon: '<i class="fas fa-save"></i>',
                label: "Save",
                callback: async (html) => {
                    const form = html.find('form')[0];

                    const nameInput = form.name;
                    const urlInput = form.url;

                    let isValid = true;

                    if (!this._validateField(nameInput, "Sound name is required")) {
                        isValid = false;
                    }

                    if (!this._validateUrl(urlInput.value, sound.source || 'local')) {
                        if (!this._validateField(urlInput, "Valid URL is required")) {
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        ui.notifications.warn("Please fix the validation errors before saving");
                        return false;
                    }

                    // Parse time values (mm:ss format to seconds)
                    const parseTime = (timeStr) => {
                        if (!timeStr || !timeStr.trim()) return null;
                        const parts = timeStr.trim().split(':');
                        if (parts.length === 1) {
                            return parseFloat(parts[0]) || null;
                        } else if (parts.length === 2) {
                            const mins = parseInt(parts[0]) || 0;
                            const secs = parseFloat(parts[1]) || 0;
                            return mins * 60 + secs;
                        } else if (parts.length === 3) {
                            const hours = parseInt(parts[0]) || 0;
                            const mins = parseInt(parts[1]) || 0;
                            const secs = parseFloat(parts[2]) || 0;
                            return hours * 3600 + mins * 60 + secs;
                        }
                        return null;
                    };

                    const data = {
                        name: form.name.value.trim(),
                        url: form.url.value.trim(),
                        volume: parseInt(form.volume.value) / 100,
                        color: form.color.value,
                        icon: form.icon.value,
                        thumbnail: form.thumbnail.value.trim(),
                        startTime: parseTime(form.startTime.value),
                        endTime: parseTime(form.endTime.value)
                    };

                    await this.jukebox.updateSoundboardSound(id, data);
                    ui.notifications.info(`Updated sound: ${data.name}`);
                    this.render();
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
  }
}

/* ==========================================
   Singleton & Hooks
   ========================================== */
class NarratorJukebox {
    constructor() {
        this.channels = {
            music: new AudioChannel('music'),
            ambience: new AudioChannel('ambience'),
            soundboard: new AudioChannel('soundboard')
        };
        this.music = [];
        this.ambience = [];  // Separate ambience library
        this.soundboard = [];  // Soundboard sounds
        this.playlists = [];
        this.currentPlaylist = null;
        this.isPlaying = false;
        this.isAmbiencePlaying = false;
        this.shuffle = false;
        this.musicLoop = false;      // Loop for music channel
        this.ambienceLoop = true;    // Loop for ambience channel (default true)
        this.isPreviewMode = true;
        this.isMuted = false;
        this.isAmbienceMuted = false;  // Separate mute for ambience
        this.volumeBeforeMute = 50;
        this.ambienceVolumeBeforeMute = 50;

        // Soundboard active sounds (can play multiple at once)
        this.activeSoundboardSounds = new Map();  // Map of soundId -> { audio, isLooping }

        // Soundboard UI state (persists across renders)
        this.soundboardBroadcastMode = false;     // Global broadcast mode (false = preview, true = broadcast)
        this.soundboardLoopState = new Map();     // Map of soundId -> boolean (is loop mode)
    }

    static initialize() {
        if (!NarratorJukebox.instance) {
            NarratorJukebox.instance = new NarratorJukebox();
        }
        
        // Initialize Channels
        Object.values(NarratorJukebox.instance.channels).forEach(c => c.initialize());

        // Socket Listener - REMOVED (Handled by socketlib)
        
        // Request Initial State (if player)
        if (!game.user.isGM) {
            if (NarratorJukebox.socket) {
                NarratorJukebox.socket.executeForEveryone('handleRemoteCommand', { action: 'requestState' });
            }
        }

        // Listen for Track End to trigger Next/Loop
        Hooks.on('narratorJukeboxTrackEnded', (channel) => {
            if (!NarratorJukebox.instance) return;

            if (channel === 'music') {
                console.log("Narrator Jukebox | Music track ended, calling next()");
                NarratorJukebox.instance.next();
            } else if (channel === 'ambience') {
                console.log("Narrator Jukebox | Ambience track ended");
                // Loop ambience if ambienceLoop is enabled
                if (NarratorJukebox.instance.ambienceLoop) {
                    const currentTrack = NarratorJukebox.instance.channels.ambience.currentTrack;
                    if (currentTrack) {
                        console.log("Narrator Jukebox | Looping ambience:", currentTrack.name);
                        NarratorJukebox.instance.playMusic(currentTrack.id, 'ambience');
                    }
                } else {
                    // Stop ambience if no loop
                    NarratorJukebox.instance.isAmbiencePlaying = false;
                    const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                    if (app) app.render(false);
                }
            }
        });
    }

    async loadData() {
        const music = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC);
        this.music = music ? JSON.parse(music) : [];

        const ambience = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE);
        this.ambience = ambience ? JSON.parse(ambience) : [];

        const soundboard = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD);
        this.soundboard = soundboard ? JSON.parse(soundboard) : [];

        const playlists = await game.settings.get(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS);
        this.playlists = playlists ? JSON.parse(playlists) : [];
    }

    async saveData() {
        console.log("Narrator Jukebox | Saving data...");
        try {
            await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC, JSON.stringify(this.music));
            await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE, JSON.stringify(this.ambience));
            await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD, JSON.stringify(this.soundboard));
            await game.settings.set(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS, JSON.stringify(this.playlists));
            console.log("Narrator Jukebox | Data saved successfully.");
        } catch (err) {
            console.error("Narrator Jukebox | Save failed:", err);
        }
    }

    async addMusic(data) {
        console.log("Narrator Jukebox | addMusic called", data);
        this.music.push(data);
        await this.saveData();
        console.log("Narrator Jukebox | Music saved. Total tracks:", this.music.length);
    }

    async updateMusic(id, data) {
        const index = this.music.findIndex(m => m.id === id);
        if (index !== -1) {
            this.music[index] = { ...this.music[index], ...data };
            await this.saveData();
        }
    }

    async deleteMusic(id) {
        this.music = this.music.filter(m => m.id !== id);
        // Also remove from playlists
        this.playlists.forEach(p => {
            p.musicIds = p.musicIds.filter(mid => mid !== id);
        });
        await this.saveData();
    }

    // Ambience Management Methods
    async addAmbience(data) {
        console.log("Narrator Jukebox | addAmbience called", data);
        this.ambience.push(data);
        await this.saveData();
        console.log("Narrator Jukebox | Ambience saved. Total ambience tracks:", this.ambience.length);
    }

    async updateAmbience(id, data) {
        const index = this.ambience.findIndex(a => a.id === id);
        if (index !== -1) {
            this.ambience[index] = { ...this.ambience[index], ...data };
            await this.saveData();
        }
    }

    async deleteAmbience(id) {
        this.ambience = this.ambience.filter(a => a.id !== id);
        await this.saveData();
    }

    // Soundboard Management Methods
    async addSoundboardSound(data) {
        console.log("Narrator Jukebox | addSoundboardSound called", data);
        this.soundboard.push(data);
        await this.saveData();
        console.log("Narrator Jukebox | Soundboard saved. Total sounds:", this.soundboard.length);
    }

    async updateSoundboardSound(id, data) {
        const index = this.soundboard.findIndex(s => s.id === id);
        if (index !== -1) {
            this.soundboard[index] = { ...this.soundboard[index], ...data };
            await this.saveData();
        }
    }

    async deleteSoundboardSound(id) {
        // Stop the sound if it's playing
        this.stopSoundboardSound(id);
        this.soundboard = this.soundboard.filter(s => s.id !== id);
        await this.saveData();
    }

    /**
     * Play a soundboard sound
     * @param {string} id - Sound ID
     * @param {object} options - { loop: boolean, preview: boolean }
     */
    async playSoundboardSound(id, options = {}) {
        const { loop = false, preview = true } = options;
        const sound = this.soundboard.find(s => s.id === id);

        if (!sound) {
            console.error(`Narrator Jukebox | Soundboard sound not found: ${id}`);
            ui.notifications.error('Sound not found');
            return;
        }

        // Check format compatibility for local files
        if (sound.source !== 'youtube' && !JukeboxBrowser.isFormatSupported(sound.url)) {
            const ext = sound.url.split('.').pop().toLowerCase();
            const browser = JukeboxBrowser.getBrowserInfo();
            const supported = browser.formats.join(', ');
            ui.notifications.warn(`Narrator Jukebox: Your browser (${browser.name}) may not support .${ext} files. Supported formats: ${supported}`);
            console.warn(`Narrator Jukebox | Format .${ext} may not be supported in ${browser.name}`);
        }

        // Get trim points (In/Out)
        const startTime = sound.startTime || 0;  // In point in seconds
        const endTime = sound.endTime || null;    // Out point in seconds (null = play to end)

        console.log(`Narrator Jukebox | Playing soundboard sound: ${sound.name}, loop: ${loop}, preview: ${preview}, startTime: ${startTime}, endTime: ${endTime}`);

        // If already playing, stop it first
        if (this.activeSoundboardSounds.has(id)) {
            this.stopSoundboardSound(id);
        }

        try {
            let audioElement;

            if (sound.source === 'youtube') {
                // For YouTube, we need to use the channel's YouTube player
                // But since soundboard should be quick sounds, we'll handle it differently
                // Create a dedicated container for this sound
                const containerId = `jukebox-sb-yt-${id}`;
                let container = document.getElementById(containerId);
                if (!container) {
                    container = document.createElement('div');
                    container.id = containerId;
                    container.style.display = 'none';
                    document.body.appendChild(container);
                }

                await window.NarratorJukeboxYTReady;

                const videoId = this._extractYouTubeId(sound.url);
                if (!videoId) throw new Error("Invalid YouTube URL");

                const volume = (sound.volume || 0.8) * 100;

                // For looping with trim, we need to handle it manually
                const shouldManualLoop = loop && (startTime > 0 || endTime !== null);

                const player = new YT.Player(containerId, {
                    height: '1', width: '1',
                    host: 'https://www.youtube-nocookie.com',
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1,
                        controls: 0,
                        start: Math.floor(startTime),  // YouTube API uses seconds (integer)
                        end: endTime ? Math.floor(endTime) : undefined,
                        // Only use native loop if no trim points
                        loop: (loop && !shouldManualLoop) ? 1 : 0,
                        playlist: (loop && !shouldManualLoop) ? videoId : undefined
                    },
                    events: {
                        'onReady': (e) => {
                            e.target.setVolume(volume);
                            // If we have a more precise startTime, seek to it
                            if (startTime > 0 && startTime % 1 !== 0) {
                                e.target.seekTo(startTime, true);
                            }
                        },
                        'onStateChange': (e) => {
                            if (e.data === YT.PlayerState.ENDED) {
                                if (shouldManualLoop) {
                                    // Manual loop: seek back to start time
                                    e.target.seekTo(startTime, true);
                                    e.target.playVideo();
                                } else if (!loop) {
                                    this.stopSoundboardSound(id);
                                }
                            } else if (e.data === YT.PlayerState.PLAYING && endTime !== null) {
                                // Set up endTime check interval
                                const activeSound = this.activeSoundboardSounds.get(id);
                                if (activeSound && !activeSound.endTimeInterval) {
                                    activeSound.endTimeInterval = setInterval(() => {
                                        const currentTime = e.target.getCurrentTime();
                                        if (currentTime >= endTime) {
                                            if (shouldManualLoop) {
                                                e.target.seekTo(startTime, true);
                                            } else {
                                                this.stopSoundboardSound(id);
                                            }
                                        }
                                    }, 100);  // Check every 100ms
                                }
                            }
                        },
                        'onError': (e) => {
                            console.error(`Narrator Jukebox | YouTube soundboard error:`, e);
                            this.stopSoundboardSound(id);
                        }
                    }
                });

                this.activeSoundboardSounds.set(id, {
                    type: 'youtube',
                    player: player,
                    containerId: containerId,
                    isLooping: loop,
                    isPreview: preview,
                    startTime: startTime,
                    endTime: endTime
                });

            } else {
                // Local file - use HTML5 Audio
                audioElement = new Audio(sound.url);
                audioElement.volume = sound.volume || 0.8;

                // Set start time
                if (startTime > 0) {
                    audioElement.currentTime = startTime;
                }

                // For local files with endTime, we need to handle loop manually
                const shouldManualLoop = loop && (startTime > 0 || endTime !== null);
                if (!shouldManualLoop) {
                    audioElement.loop = loop;
                }

                // Handle endTime with timeupdate event
                let endTimeHandler = null;
                if (endTime !== null) {
                    endTimeHandler = () => {
                        if (audioElement.currentTime >= endTime) {
                            if (shouldManualLoop) {
                                // Loop back to start time
                                audioElement.currentTime = startTime;
                            } else {
                                this.stopSoundboardSound(id);
                                const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                                if (app) app.render(false);
                            }
                        }
                    };
                    audioElement.addEventListener('timeupdate', endTimeHandler);
                }

                audioElement.addEventListener('ended', () => {
                    if (shouldManualLoop) {
                        // Manual loop: restart from startTime
                        audioElement.currentTime = startTime;
                        audioElement.play();
                    } else if (!loop) {
                        this.stopSoundboardSound(id);
                        // Update UI
                        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                        if (app) app.render(false);
                    }
                });

                audioElement.addEventListener('error', (e) => {
                    console.error(`Narrator Jukebox | Soundboard audio error:`, e);
                    this.stopSoundboardSound(id);
                    ui.notifications.error(`Failed to play: ${sound.name}`);
                });

                await audioElement.play();

                this.activeSoundboardSounds.set(id, {
                    type: 'local',
                    audio: audioElement,
                    isLooping: loop,
                    isPreview: preview,
                    startTime: startTime,
                    endTime: endTime,
                    endTimeHandler: endTimeHandler
                });
            }

            // Broadcast to other players if not in preview mode
            if (game.user.isGM && !preview) {
                if (NarratorJukebox.socket) {
                    const payload = {
                        action: 'soundboard',
                        subAction: 'play',
                        soundId: id,
                        loop: loop,
                        timestamp: Date.now()
                    };
                    NarratorJukebox.socket.executeForOthers('handleRemoteCommand', payload);
                }
                ui.notifications.info(`Broadcasting sound: ${sound.name}`);
            }

            // Update UI
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
            if (app) app.render(false);

        } catch (err) {
            console.error("Narrator Jukebox | Soundboard playback failed:", err);
            ui.notifications.error(`Failed to play: ${sound.name}`);
        }
    }

    /**
     * Stop a specific soundboard sound
     * @param {string} id - Sound ID
     */
    stopSoundboardSound(id, broadcast = true) {
        const activeSound = this.activeSoundboardSounds.get(id);
        if (!activeSound) return;

        console.log(`Narrator Jukebox | Stopping soundboard sound: ${id}`);

        // Clear any endTime interval
        if (activeSound.endTimeInterval) {
            clearInterval(activeSound.endTimeInterval);
        }

        if (activeSound.type === 'local' && activeSound.audio) {
            // Remove the timeupdate handler if it exists
            if (activeSound.endTimeHandler) {
                activeSound.audio.removeEventListener('timeupdate', activeSound.endTimeHandler);
            }
            activeSound.audio.pause();
            activeSound.audio.currentTime = 0;
            activeSound.audio.src = '';
        } else if (activeSound.type === 'youtube' && activeSound.player) {
            if (activeSound.player.stopVideo) activeSound.player.stopVideo();
            if (activeSound.player.destroy) activeSound.player.destroy();
            const container = document.getElementById(activeSound.containerId);
            if (container) container.remove();
        }

        // Only broadcast stop if the sound was not in preview mode
        const wasPreview = activeSound.isPreview;

        this.activeSoundboardSounds.delete(id);

        // Broadcast stop to other players (only if not preview mode)
        if (game.user.isGM && broadcast && !wasPreview && NarratorJukebox.socket) {
            const payload = {
                action: 'soundboard',
                subAction: 'stop',
                soundId: id,
                timestamp: Date.now()
            };
            NarratorJukebox.socket.executeForOthers('handleRemoteCommand', payload);
        }

        // Update UI
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app) app.render(false);
    }

    /**
     * Stop all soundboard sounds
     */
    stopAllSoundboardSounds() {
        console.log("Narrator Jukebox | Stopping all soundboard sounds");
        for (const [id] of this.activeSoundboardSounds) {
            this.stopSoundboardSound(id, false);
        }

        // Single broadcast for stopping all
        if (game.user.isGM && NarratorJukebox.socket) {
            const payload = {
                action: 'soundboard',
                subAction: 'stopAll',
                timestamp: Date.now()
            };
            NarratorJukebox.socket.executeForOthers('handleRemoteCommand', payload);
        }
    }

    /**
     * Check if a soundboard sound is currently playing
     * @param {string} id - Sound ID
     * @returns {boolean}
     */
    isSoundboardSoundPlaying(id) {
        return this.activeSoundboardSounds.has(id);
    }

    /**
     * Extract YouTube video ID from URL - delegates to imported utility
     */
    _extractYouTubeId(url) {
        return extractYouTubeVideoId(url);
    }

    async createPlaylist(name) {
        this.playlists.push({
            id: foundry.utils.randomID(),
            name: name,
            musicIds: []
        });
        await this.saveData();
    }

    async deletePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        await this.saveData();
    }

    async playMusic(id, channel = 'music') {
        console.log(`Narrator Jukebox | Playing ${channel}: ${id}`);
        // Search in appropriate library based on channel
        const library = channel === 'ambience' ? this.ambience : this.music;
        let track = library.find(m => m.id === id);

        // Fallback: also check the other library (for backwards compatibility)
        if (!track) {
            const otherLibrary = channel === 'ambience' ? this.music : this.ambience;
            track = otherLibrary.find(m => m.id === id);
        }

        if (!track) {
            console.error(`Narrator Jukebox | Track not found: ${id}`);
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
            if (app) app._showError('Track not found');
            return;
        }

        if (channel === 'music') this.isPlaying = true;
        if (channel === 'ambience') this.isAmbiencePlaying = true;

        // Show loading state
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app && channel === 'music') app._showLoadingState('track');

        try {
            await this.channels[channel].play(track);
            console.log(`Narrator Jukebox | Playback started for ${track.name}`);

            // Force UI Update immediately
            if (app) {
                app._hideLoadingState('track');
                app.render(false);
            }

        } catch (err) {
            console.error("Narrator Jukebox | Playback failed", err);

            // Hide loading state
            if (app) app._hideLoadingState('track');

            // Autoplay Handling with visual feedback
            if (err.name === 'NotAllowedError') {
                ui.notifications.warn("Narrator Jukebox: Click anywhere to enable audio playback.");
                if (app) app._showError('Click anywhere to enable audio playback', 7000);
            } else {
                ui.notifications.error(`Playback failed: ${err.message}`);
                if (app) app._showError(`Playback failed: ${err.message}`);
            }

            if (channel === 'music') this.isPlaying = false;
            if (channel === 'ambience') this.isAmbiencePlaying = false;
            return;
        }

        // Broadcast to other players (not self) if GM and not in preview mode
        if (game.user.isGM && !this.isPreviewMode) {
            if (NarratorJukebox.socket) {
                const payload = {
                    action: 'play',
                    trackId: id,
                    channel: channel,
                    timestamp: Date.now()
                };
                NarratorJukebox.socket.executeForOthers('handleRemoteCommand', payload);
            }
            ui.notifications.info(`Broadcasting: ${track.name}`);
        }
    }

    playPlaylist(id) {
        const playlist = this.playlists.find(p => p.id === id);
        if (!playlist || !playlist.musicIds.length) return;

        this.currentPlaylist = playlist;

        // If shuffle is enabled, pick a random track; otherwise play first track
        let trackIndex = 0;
        if (this.shuffle) {
            trackIndex = Math.floor(Math.random() * playlist.musicIds.length);
        }
        this.playMusic(playlist.musicIds[trackIndex]);
    }

    togglePlay(channel = 'music') {
        const isPlaying = (channel === 'music') ? this.isPlaying : this.isAmbiencePlaying;
        
        if (isPlaying) {
            this.channels[channel].pause();
            if (channel === 'music') this.isPlaying = false;
            else this.isAmbiencePlaying = false;

            if (game.user.isGM && !this.isPreviewMode && NarratorJukebox.socket) {
                NarratorJukebox.socket.executeForOthers('handleRemoteCommand', { action: 'pause', channel: channel, timestamp: Date.now() });
            }
        } else {
            this.channels[channel].resume();
            if (channel === 'music') this.isPlaying = true;
            else this.isAmbiencePlaying = true;

            if (game.user.isGM && !this.isPreviewMode && NarratorJukebox.socket) {
                NarratorJukebox.socket.executeForOthers('handleRemoteCommand', { action: 'resume', channel: channel, timestamp: Date.now() });
            }
        }
    }

    next() {
        const currentId = this.channels.music.currentTrack?.id;

        // 1. Handle Playlist Logic
        if (this.currentPlaylist && this.currentPlaylist.musicIds.length) {
            let nextIndex = 0;

            if (this.shuffle) {
                nextIndex = Math.floor(Math.random() * this.currentPlaylist.musicIds.length);
            } else {
                const currentIndex = this.currentPlaylist.musicIds.indexOf(currentId);
                nextIndex = currentIndex + 1;
                if (nextIndex >= this.currentPlaylist.musicIds.length) {
                    if (this.musicLoop) {
                        nextIndex = 0;
                    } else {
                        // End of playlist without loop
                        console.log("Narrator Jukebox | Playlist ended, no loop");
                        this.isPlaying = false;
                        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                        if (app) app.render(false);
                        return;
                    }
                }
            }

            this.playMusic(this.currentPlaylist.musicIds[nextIndex]);
            return;
        }

        // 2. No playlist: Navigate through full music library
        if (this.music && this.music.length > 0) {
            const currentIndex = this.music.findIndex(m => m.id === currentId);

            if (this.shuffle) {
                // Random track from library
                const randomIndex = Math.floor(Math.random() * this.music.length);
                this.playMusic(this.music[randomIndex].id);
                return;
            }

            // Sequential: next track in library
            let nextIndex = currentIndex + 1;
            if (nextIndex >= this.music.length) {
                if (this.musicLoop) {
                    nextIndex = 0; // Loop back to first
                } else {
                    // End of library
                    console.log("Narrator Jukebox | End of library, no loop");
                    this.isPlaying = false;
                    const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                    if (app) app.render(false);
                    return;
                }
            }

            this.playMusic(this.music[nextIndex].id);
            return;
        }

        // 3. Single Track Loop (Fallback)
        if (this.musicLoop && currentId) {
            console.log("Narrator Jukebox | Looping single track:", currentId);
            this.playMusic(currentId);
            return;
        }

        // 4. Nothing to play
        console.log("Narrator Jukebox | No next track available");
        this.isPlaying = false;
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app) app.render(false);
    }

    async addToPlaylist(playlistId, musicId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        
        if (!playlist.musicIds.includes(musicId)) {
            playlist.musicIds.push(musicId);
            await this.saveData();
            ui.notifications.info(`Added track to playlist "${playlist.name}"`);
            
            // Update UI
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
            if (app) app.render();
        }
    }

    async removeFromPlaylist(playlistId, musicId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        
        playlist.musicIds = playlist.musicIds.filter(id => id !== musicId);
        await this.saveData();
        ui.notifications.info(`Removed track from playlist "${playlist.name}"`);

        // Update UI
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app) app.render();
    }

    prev() {
        // Restart track if playing for more than 3 seconds
        if (this.channels.music.currentTime > 3) {
            this.channels.music.seek(0);
            return;
        }

        const currentId = this.channels.music.currentTrack?.id;

        // 1. Handle Playlist Logic
        if (this.currentPlaylist && this.currentPlaylist.musicIds.length) {
            const currentIndex = this.currentPlaylist.musicIds.indexOf(currentId);
            let prevIndex = currentIndex - 1;

            if (prevIndex < 0) {
                if (this.musicLoop) prevIndex = this.currentPlaylist.musicIds.length - 1;
                else prevIndex = 0;
            }

            this.playMusic(this.currentPlaylist.musicIds[prevIndex]);
            return;
        }

        // 2. No playlist: Navigate through full music library
        if (this.music && this.music.length > 0) {
            const currentIndex = this.music.findIndex(m => m.id === currentId);
            let prevIndex = currentIndex - 1;

            if (prevIndex < 0) {
                if (this.musicLoop) {
                    prevIndex = this.music.length - 1; // Loop to last track
                } else {
                    prevIndex = 0; // Stay at first track
                }
            }

            this.playMusic(this.music[prevIndex].id);
            return;
        }

        // 3. Nothing to do
        console.log("Narrator Jukebox | No previous track available");
    }

    toggleShuffle() { this.shuffle = !this.shuffle; }
    toggleMusicLoop() { this.musicLoop = !this.musicLoop; }
    toggleAmbienceLoop() { this.ambienceLoop = !this.ambienceLoop; }

    stop(channel = 'music') {
        console.log(`Narrator Jukebox | Stopping ${channel}`);
        this.channels[channel].stop();

        if (channel === 'music') {
            this.isPlaying = false;
        } else if (channel === 'ambience') {
            this.isAmbiencePlaying = false;
        }

        // Broadcast stop to other players
        if (game.user.isGM && !this.isPreviewMode && NarratorJukebox.socket) {
            NarratorJukebox.socket.executeForOthers('handleRemoteCommand', {
                action: 'stop',
                channel: channel,
                timestamp: Date.now()
            });
        }
    }

    setVolume(vol, channel) {
        this.channels[channel].setVolume(vol);
        // If setting volume manually and was muted, unmute
        if (this.isMuted && vol > 0) {
            this.isMuted = false;
        }
        if (game.user.isGM && !this.isPreviewMode && NarratorJukebox.socket) {
            NarratorJukebox.socket.executeForOthers('handleRemoteCommand', { action: 'volume', volume: vol, channel: channel, timestamp: Date.now() });
        }
    }

    toggleMute(channel = 'music') {
        if (channel === 'music') {
            if (this.isMuted) {
                this.setVolume(this.volumeBeforeMute, channel);
                this.isMuted = false;
            } else {
                this.volumeBeforeMute = this.channels[channel].volume;
                this.setVolume(0, channel);
                this.isMuted = true;
            }
        } else if (channel === 'ambience') {
            if (this.isAmbienceMuted) {
                this.setVolume(this.ambienceVolumeBeforeMute, channel);
                this.isAmbienceMuted = false;
            } else {
                this.ambienceVolumeBeforeMute = this.channels[channel].volume;
                this.setVolume(0, channel);
                this.isAmbienceMuted = true;
            }
        }

        // Update UI
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app) app.render(false);
    }

    playRandomByTag(tag) {
        const candidates = this.music.filter(m => m.tags.includes(tag));
        if (candidates.length) {
            const random = candidates[Math.floor(Math.random() * candidates.length)];
            this.playMusic(random.id);
        } else {
            ui.notifications.warn(`No music found with tag: ${tag}`);
        }
    }

    async handleRemoteCommand(payload) {
        console.log("Narrator Jukebox | Received Socket Payload:", payload);

        // Handle requestState (only GM responds)
        if (payload.action === 'requestState') {
            if (game.user.isGM) {
                const state = {
                    action: 'syncState',
                    musicTrackId: this.channels.music.currentTrack?.id,
                    musicTime: this.channels.music.currentTime,
                    isPlaying: this.isPlaying,

                    ambienceTrackId: this.channels.ambience.currentTrack?.id,
                    isAmbiencePlaying: this.isAmbiencePlaying,

                    volume: this.channels.music.volume,
                    ambienceVolume: this.channels.ambience.volume,
                    timestamp: Date.now()
                };
                if (NarratorJukebox.socket) {
                    NarratorJukebox.socket.executeForEveryone('handleRemoteCommand', state);
                }
            }
            return; // Everyone else ignores requestState
        }

        // Skip execution for GM in preview mode
        if (game.user.isGM && this.isPreviewMode) {
            console.log("Narrator Jukebox | GM in preview mode, ignoring remote command");
            return;
        }

        // Execute command for all clients (including GM in broadcast mode)
        switch(payload.action) {
            case 'play':
                // Search in appropriate library based on channel
                const library = payload.channel === 'ambience' ? this.ambience : this.music;
                let track = library.find(m => m.id === payload.trackId);

                // Fallback: check other library
                if (!track) {
                    const otherLibrary = payload.channel === 'ambience' ? this.music : this.ambience;
                    track = otherLibrary.find(m => m.id === payload.trackId);
                }

                // STALE DATA FIX: If track not found, reload data and try again
                if (!track) {
                    console.warn(`Narrator Jukebox | Track ${payload.trackId} not found. Reloading data...`);
                    await this.loadData();
                    const reloadedLibrary = payload.channel === 'ambience' ? this.ambience : this.music;
                    track = reloadedLibrary.find(m => m.id === payload.trackId);

                    // Fallback again
                    if (!track) {
                        const reloadedOther = payload.channel === 'ambience' ? this.music : this.ambience;
                        track = reloadedOther.find(m => m.id === payload.trackId);
                    }

                    if (!track) {
                        console.error(`Narrator Jukebox | Track ${payload.trackId} not found even after reload.`);
                        ui.notifications.error(`Failed to sync: track "${payload.trackId}" not found`);
                        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                        if (app) app._showError(`Track "${payload.trackId}" not found`);
                        break;
                    }
                }

                console.log(`Narrator Jukebox | Playing synced track: ${track.name}`);
                if (payload.channel === 'music') this.isPlaying = true;
                if (payload.channel === 'ambience') this.isAmbiencePlaying = true;

                // Use the new robust play method with proper error handling
                try {
                    await this.channels[payload.channel].play(track);
                } catch (err) {
                    console.error("Narrator Jukebox | Remote play failed:", err);
                    ui.notifications.error(`Failed to play synced music: ${err.message}`);
                    const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                    if (app) app._showError(`Sync failed: ${err.message}`);
                    if (payload.channel === 'music') this.isPlaying = false;
                    if (payload.channel === 'ambience') this.isAmbiencePlaying = false;
                }
                break;
            case 'pause':
                this.channels[payload.channel].pause();
                if (payload.channel === 'music') this.isPlaying = false;
                if (payload.channel === 'ambience') this.isAmbiencePlaying = false;
                break;
            case 'resume':
                this.channels[payload.channel].resume();
                if (payload.channel === 'music') this.isPlaying = true;
                if (payload.channel === 'ambience') this.isAmbiencePlaying = true;
                break;
            case 'stop':
                this.channels[payload.channel].stop();
                if (payload.channel === 'music') this.isPlaying = false;
                if (payload.channel === 'ambience') this.isAmbiencePlaying = false;
                break;
            case 'volume':
                this.channels[payload.channel].setVolume(payload.volume);
                break;
            case 'syncState':
                // Ensure we have data before syncing
                if (this.music.length === 0 && this.ambience.length === 0) await this.loadData();

                // Sync Music
                if (payload.musicTrackId) {
                    let t = this.music.find(m => m.id === payload.musicTrackId);
                    // Only sync if different track or significantly drifted
                    const currentId = this.channels.music.currentTrack?.id;

                    if (t && currentId !== payload.musicTrackId) {
                         this.channels.music.play(t, () => {
                            this.channels.music.seek(payload.musicTime / this.channels.music.duration * 100);
                            if (!payload.isPlaying) this.channels.music.pause();
                            else this.isPlaying = true;
                        });
                    }
                }

                // Sync Ambience
                if (payload.ambienceTrackId) {
                    // Search in ambience library first, then music
                    let t = this.ambience.find(a => a.id === payload.ambienceTrackId);
                    if (!t) t = this.music.find(m => m.id === payload.ambienceTrackId);
                    const currentId = this.channels.ambience.currentTrack?.id;

                    if (t && currentId !== payload.ambienceTrackId) {
                        this.channels.ambience.play(t, () => {
                            if (!payload.isAmbiencePlaying) this.channels.ambience.pause();
                            else this.isAmbiencePlaying = true;
                        });
                    }
                }
                break;

            case 'soundboard':
                // Handle soundboard commands from GM
                if (payload.subAction === 'play') {
                    // Find the sound in local data
                    let sound = this.soundboard.find(s => s.id === payload.soundId);

                    // STALE DATA FIX: If sound not found, reload data and try again
                    if (!sound) {
                        console.warn(`Narrator Jukebox | Soundboard sound ${payload.soundId} not found. Reloading data...`);
                        await this.loadData();
                        sound = this.soundboard.find(s => s.id === payload.soundId);

                        if (!sound) {
                            console.error(`Narrator Jukebox | Soundboard sound ${payload.soundId} not found even after reload.`);
                            ui.notifications.error(`Failed to play soundboard: sound not found`);
                            break;
                        }
                    }

                    // Play locally without broadcasting (we received this from GM)
                    try {
                        await this.playSoundboardSound(payload.soundId, {
                            loop: payload.loop,
                            preview: true  // Don't re-broadcast
                        });
                    } catch (err) {
                        console.error("Narrator Jukebox | Remote soundboard play failed:", err);
                        ui.notifications.error(`Failed to play soundboard: ${err.message}`);
                    }
                } else if (payload.subAction === 'stop') {
                    this.stopSoundboardSound(payload.soundId, false);  // Don't re-broadcast
                } else if (payload.subAction === 'stopAll') {
                    for (const [id] of this.activeSoundboardSounds) {
                        this.stopSoundboardSound(id, false);
                    }
                }
                break;
        }

        // Update UI if open
        const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
        if (app) app.render();
    }

    static async suggestTrack(track, userName) {
        console.log("Narrator Jukebox | GM receiving suggestion:", track, "from:", userName);

        try {
            const suggestions = game.settings.get(JUKEBOX.ID, "suggestions") || [];

            // Ensure track has user info
            if (!track.user) {
                track.user = userName;
            }

            suggestions.push(track);
            await game.settings.set(JUKEBOX.ID, "suggestions", suggestions);

            console.log("Narrator Jukebox | Suggestion saved. Total suggestions:", suggestions.length);

            ui.notifications.info(`Narrator Jukebox: New music suggestion from ${userName}`);

            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
            if (app) {
                console.log("Narrator Jukebox | Re-rendering app to show new suggestion");
                app.render();
            }
        } catch (err) {
            console.error("Narrator Jukebox | Failed to save suggestion:", err);
            ui.notifications.error(`Failed to save suggestion: ${err.message}`);
        }
    }

    static handleRemoteCommandStatic(payload) {
        if (NarratorJukebox.instance) {
            NarratorJukebox.instance.handleRemoteCommand(payload);
        }
    }
}

// Expose to global scope for JukeboxTester and debugging
window.NarratorJukebox = NarratorJukebox;

Hooks.once('init', () => {
    // Register Settings
    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC, {
        name: "Music Library",
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE, {
        name: "Ambience Library",
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD, {
        name: "Soundboard Library",
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD_VOLUME, {
        name: "Soundboard Volume",
        scope: "client",
        config: false,
        type: Number,
        default: 0.8
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS, {
        name: "Playlists",
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME, {
        name: "Global Volume",
        scope: "client",
        config: false,
        type: Number,
        default: 0.8
    });

    game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_VOLUME, {
        name: "Ambience Volume",
        scope: "client",
        config: false,
        type: Number,
        default: 0.5
    });

    game.settings.register(JUKEBOX.ID, "moods", {
        name: "Mood Boards",
        scope: "world",
        config: false,
        type: Array,
        default: [
            { label: "Combat", tag: "Combat", color: "linear-gradient(135deg, #ff416c, #ff4b2b)", icon: "fas fa-skull-crossbones" },
            { label: "Social", tag: "Social", color: "linear-gradient(135deg, #f8b500, #fceabb)", icon: "fas fa-comments" },
            { label: "Mystery", tag: "Mystery", color: "linear-gradient(135deg, #667eea, #764ba2)", icon: "fas fa-mask" },
            { label: "Sorcery", tag: "Sorcery", color: "linear-gradient(135deg, #b721ff, #21d4fd)", icon: "fas fa-hat-wizard" },
            { label: "Travel", tag: "Travel", color: "linear-gradient(135deg, #43e97b, #38f9d7)", icon: "fas fa-hiking" },
            { label: "Tavern", tag: "Tavern", color: "linear-gradient(135deg, #fdc830, #f37335)", icon: "fas fa-beer" }
        ]
    });

    game.settings.register(JUKEBOX.ID, "suggestions", {
        name: "Player Suggestions",
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Register Handlebars Helpers
    Handlebars.registerHelper('add', function(a, b) {
        return a + b;
    });
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });
    Handlebars.registerHelper('ne', function(a, b) {
        return a !== b;
    });
    Handlebars.registerHelper('formatTime', function(seconds) {
        return formatTime(seconds);
    });
    Handlebars.registerHelper('gt', function(a, b) {
        return a > b;
    });
    Handlebars.registerHelper('take', function(array, count) {
        if (!Array.isArray(array)) return [];
        return array.slice(0, count);
    });

    // Register Shortcut
    game.keybindings.register(JUKEBOX.ID, "openJukebox", {
        name: "Open Jukebox",
        hint: "Toggle the Narrator's Jukebox window",
        editable: [
            { key: "KeyM", modifiers: ["Control", "Shift"] }
        ],
        onDown: () => {
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
            if (app) app.close();
            else new NarratorsJukeboxApp().render(true);
        },
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

Hooks.once('socketlib.ready', () => {
    NarratorJukebox.socket = socketlib.registerModule(JUKEBOX.ID);
    NarratorJukebox.socket.register('suggestTrack', NarratorJukebox.suggestTrack);
    NarratorJukebox.socket.register('handleRemoteCommand', NarratorJukebox.handleRemoteCommandStatic);
});

// Global YouTube API Ready Promise
window.NarratorJukeboxYTReady = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
        console.log("Narrator Jukebox | YouTube IFrame API Ready");
        resolve();
    };
});

Hooks.on('ready', async () => {
    NarratorJukebox.initialize();
    await NarratorJukebox.instance.loadData();

    // Socketlib Fallback
    if (game.modules.get("socketlib")?.active && !NarratorJukebox.socket) {
        NarratorJukebox.socket = socketlib.registerModule(JUKEBOX.ID);
        NarratorJukebox.socket.register('suggestTrack', NarratorJukebox.suggestTrack);
        NarratorJukebox.socket.register('handleRemoteCommand', NarratorJukebox.handleRemoteCommandStatic);
    }

    // Load YouTube API
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        console.log("Narrator Jukebox | Loading YouTube IFrame API");
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);
    } else {
        console.log("Narrator Jukebox | YouTube API already loading/loaded");
        // If already loaded, resolve immediately
        if (window.YT && window.YT.Player) {
            window.onYouTubeIframeAPIReady();
        }
    }
});

Hooks.on('renderSidebarTab', (app, html) => {
    if (app.options.id === 'journal') {
        let button = $('<button class="narrator-jukebox-btn"><i class="fas fa-music"></i> Jukebox</button>');
        button.click(() => {
            new NarratorsJukeboxApp().render(true);
        });
        html.find('.directory-header .action-buttons').append(button);
    }
});

Hooks.on('getSceneControlButtons', (controls) => {
    console.log("Narrator Jukebox | getSceneControlButtons fired", controls);

    let tokenControls;
    if (Array.isArray(controls)) {
        tokenControls = controls.find(c => c.name === 'token');
    } else {
        // Fallback for potential V13 changes if controls is an object
        tokenControls = controls.tokens;
    }

    if (tokenControls) {
        console.log("Narrator Jukebox | Adding tool to token controls");
        const tool = {
            name: "jukebox",
            title: "Narrator's Jukebox (Ctrl+Shift+M)",
            icon: "fas fa-record-vinyl",
            visible: true,
            button: true,
            onClick: () => {
                const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
                if (app) app.close();
                else new NarratorsJukeboxApp().render(true);
            }
        };

        if (Array.isArray(tokenControls.tools)) {
            tokenControls.tools.push(tool);
        } else if (tokenControls.tools instanceof Map) {
            tokenControls.tools.set('jukebox', tool);
        } else if (typeof tokenControls.tools === 'object' && tokenControls.tools !== null) {
            tokenControls.tools['jukebox'] = tool;
        } else {
            console.warn("Narrator Jukebox | Unknown tools structure:", tokenControls.tools);
        }
    } else {
        console.warn("Narrator Jukebox | Token controls not found!");
    }
});

// Hook for track ending (auto-advance)

