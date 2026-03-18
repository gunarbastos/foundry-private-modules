import { CONFIG, getDefaultSceneLayoutSettings, log } from '../config.js';
import { Store } from '../data/Store.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';
import { ExaltedScenesDialog } from './ThemedDialog.js';
import { ensureTheaterShots } from './player-view/theater-mode-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SceneEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(sceneId = null, options = {}) {
    super(options);
    this.sceneId = sceneId;
    this.scene = sceneId ? Store.scenes.get(sceneId) : null;
    this.isCreateMode = !sceneId;
    this.targetFolderId = options.folderId ?? this.scene?.folder ?? null;

    // Clone data for editing state to avoid direct mutation until save
    // For create mode, provide default values
    this.uiState = {
      data: this.scene ? this.scene.toJSON() : {
        name: 'New Scene',
        background: CONFIG.DEFAULTS.SCENE_BG,
        bgType: 'image',
        tags: [],
        cast: [],
        layoutSettings: getDefaultSceneLayoutSettings(),
        audio: {
          playlists: [],
          tracks: [],
          layers: [],
          sounds: [],
          volume: 1.0,
          fadeOut: 0,
          playbackMode: 'sequential',
          autoPlayMusic: false,
          autoPlayAmbience: false,
          stopOnEnd: false,
          _legacyPlaylistId: null,
          _legacyAmbiencePresetId: null
        }
      },
      activeTab: 'scene',
      newTag: ''
    };

    // Ensure layoutSettings exists for existing scenes
    if (!this.uiState.data.layoutSettings) {
      this.uiState.data.layoutSettings = { ...CONFIG.DEFAULT_LAYOUT };
    }

    // Ensure audio settings exist with v6.0 schema for existing scenes
    if (!this.uiState.data.audio) {
      this.uiState.data.audio = {
        playlists: [],
        tracks: [],
        layers: [],
        sounds: [],
        volume: 1.0,
        fadeOut: 0,
        playbackMode: 'sequential',
        autoPlayMusic: false,
        autoPlayAmbience: false,
        stopOnEnd: false,
        _legacyPlaylistId: null,
        _legacyAmbiencePresetId: null
      };
    }

    /** @type {AbortController|null} Controls event listener cleanup on re-render */
    this._abortController = null;

    // Ensure arrays exist (for scenes created before v6.0)
    if (!this.uiState.data.audio.playlists) {
      this.uiState.data.audio.playlists = [];
    }
    if (!this.uiState.data.audio.tracks) {
      this.uiState.data.audio.tracks = [];
    }
    if (!this.uiState.data.audio.layers) {
      this.uiState.data.audio.layers = [];
    }
    if (!this.uiState.data.audio.sounds) {
      this.uiState.data.audio.sounds = [];
    }
    if (!this.uiState.data.audio.playbackMode) {
      this.uiState.data.audio.playbackMode = 'sequential';
    }
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    id: 'exalted-scenes-scene-editor',
    classes: ['exalted-scenes', 'es-scene-editor'],
    window: {
      title: 'Scene Editor',
      icon: 'fas fa-edit',
      resizable: true,
      controls: []
    },
    position: {
      width: 760,
      height: 820
    },
    actions: {
      save: SceneEditor._onSave,
      close: SceneEditor._onClose,
      'tab-switch': SceneEditor._onTabSwitch,
      'remove-tag': SceneEditor._onRemoveTag,
      'add-playlist': SceneEditor._onAddPlaylist,
      'remove-playlist': SceneEditor._onRemovePlaylist,
      'preview-playlist': SceneEditor._onPreviewPlaylist,
      'add-soundtrack-track': SceneEditor._onAddSoundtrackTrack,
      'remove-soundtrack-track': SceneEditor._onRemoveSoundtrackTrack,
      'preview-track': SceneEditor._onPreviewTrack,
      'add-ambience-layer': SceneEditor._onAddAmbienceLayer,
      'remove-ambience-layer': SceneEditor._onRemoveAmbienceLayer,
      'preview-ambience': SceneEditor._onPreviewAmbience,
      'add-soundboard-sound': SceneEditor._onAddSoundboardSound,
      'remove-soundboard-sound': SceneEditor._onRemoveSoundboardSound,
      'preview-soundboard-sound': SceneEditor._onPreviewSoundboardSound,
      'stop-audio': SceneEditor._onStopAudio,
      'select-media': SceneEditor._onSelectMedia,
      'change-media': SceneEditor._onSelectMedia,
      'reset-positions': SceneEditor._onResetPositions
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/scene-editor.hbs',
      scrollable: ['.es-scene-editor__content']
    }
  };

  get title() {
    return this.isCreateMode ? 'Create New Scene' : 'Edit Scene';
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  async _prepareContext(options) {
    // Prepare layout presets for the dropdown
    const layoutPresets = Object.entries(CONFIG.LAYOUT_PRESETS).map(([key, preset]) => ({
      key,
      name: game.i18n.localize(preset.name),
      icon: preset.icon,
      selected: this.uiState.data.layoutSettings.preset === key
    }));

    // Prepare size presets for the dropdown
    const sizePresets = Object.entries(CONFIG.SIZE_PRESETS).map(([key, preset]) => ({
      key,
      name: game.i18n.localize(preset.name),
      selected: this.uiState.data.layoutSettings.size === key
    }));

    // Prepare shape presets for the dropdown
    const shapePresets = Object.entries(CONFIG.SHAPE_PRESETS).map(([key, preset]) => ({
      key,
      name: game.i18n.localize(preset.name),
      selected: (this.uiState.data.layoutSettings.shape || 'circle') === key
    }));

    // Prepare display modes for the dropdown
    const displayModes = Object.entries(CONFIG.DISPLAY_MODES).map(([key, mode]) => ({
      key,
      name: game.i18n.localize(mode.name),
      selected: (this.uiState.data.layoutSettings.displayMode || 'token') === key
    }));
    const selectedLayoutPreset = layoutPresets.find(p => p.selected);
    const theaterModeEnabled = !!this.uiState.data.layoutSettings.theaterMode;
    const theaterShots = theaterModeEnabled
      ? ensureTheaterShots(this.uiState.data)
      : (this.uiState.data.layoutSettings.theaterShots || []);

    // Prepare background fit presets for the dropdown
    const backgroundFitPresets = [
      { key: '', name: localize('SceneEditor.UseGlobalSetting'), selected: !this.uiState.data.backgroundFit },
      ...Object.entries(CONFIG.BACKGROUND_FIT_MODES).map(([key, preset]) => ({
        key,
        name: game.i18n.localize(preset.name),
        description: game.i18n.localize(preset.description),
        selected: this.uiState.data.backgroundFit === key
      }))
    ];

    // Narrator Jukebox integration
    const njAvailable = NarratorJukeboxIntegration.isAvailable;

    // Prepare attached playlists for display
    const attachedPlaylists = (this.uiState.data.audio.playlists || []).map((p, index) => {
      const njPlaylist = NarratorJukeboxIntegration.getPlaylist(p.id);
      return {
        ...p,
        index,
        trackCount: njPlaylist?.musicIds?.length ?? 0,
        missing: !njPlaylist
      };
    });

    // Prepare soundtrack tracks for display
    const soundtrackTracks = (this.uiState.data.audio.tracks || []).map((t, index) => ({
      ...t,
      index,
      displayName: t.name || t.playlistName || 'Unknown Track'
    }));

    // Soundtrack mode: 'playlists', 'tracks', or 'empty'
    const soundtrackMode = attachedPlaylists.length > 0 ? 'playlists'
      : soundtrackTracks.length > 0 ? 'tracks'
      : 'empty';

    // Playback modes for the dropdown
    const playbackModes = Object.entries(CONFIG.PLAYBACK_MODES).map(([key, mode]) => ({
      key,
      name: game.i18n.localize(mode.name),
      selected: this.uiState.data.audio.playbackMode === key
    }));

    // Legacy playlist info (for migration hint)
    const legacyPlaylistId = this.uiState.data.audio._legacyPlaylistId;
    let legacyPlaylistName = null;
    if (legacyPlaylistId && njAvailable && soundtrackTracks.length === 0) {
      legacyPlaylistName = NarratorJukeboxIntegration.getPlaylistName(legacyPlaylistId);
    }

    // Ambience layers for display
    const ambienceLayers = (this.uiState.data.audio.layers || []).map((l, index) => ({
      ...l,
      index,
      volume: l.volume ?? 1.0,
      volumePercent: Math.round((l.volume ?? 1.0) * 100)
    }));

    // Legacy ambience info (for migration hint)
    const legacyAmbienceId = this.uiState.data.audio._legacyAmbiencePresetId;
    let legacyAmbienceName = null;
    if (legacyAmbienceId && njAvailable && ambienceLayers.length === 0) {
      legacyAmbienceName = NarratorJukeboxIntegration.getAmbiencePresetName(legacyAmbienceId);
    }

    // Soundboard sounds for display
    const soundboardSounds = (this.uiState.data.audio.sounds || []).map((s, index) => ({
      ...s,
      index
    }));
    const totalAudioEntries = attachedPlaylists.length + soundtrackTracks.length + ambienceLayers.length + soundboardSounds.length;
    const activeTabLabels = {
      scene: localize('SceneEditor.TabScene'),
      layout: localize('SceneEditor.TabLayout'),
      audio: localize('SceneEditor.TabAudio')
    };
    const activeTabDescriptions = {
      scene: localize('SceneEditor.ClickToSelectMedia'),
      layout: localize('SceneEditor.CastLayoutDesc'),
      audio: localize('SceneEditor.AudioDesc')
    };
    const heroStats = [
      {
        icon: 'fa-tags',
        value: String(this.uiState.data.tags.length),
        label: localize('SceneEditor.Tags')
      },
      {
        icon: 'fa-users',
        value: selectedLayoutPreset?.name || localize('SceneEditor.CastLayout'),
        label: localize('SceneEditor.CastLayout')
      }
    ];
    if (njAvailable) {
      heroStats.push({
        icon: 'fa-music',
        value: String(totalAudioEntries),
        label: localize('SceneEditor.Audio')
      });
    }

    return {
      scene: this.uiState.data,
      activeTab: this.uiState.activeTab,
      isImage: this.uiState.data.bgType === 'image',
      isVideo: this.uiState.data.bgType === 'video',
      isCreateMode: this.isCreateMode,
      activeTabLabel: activeTabLabels[this.uiState.activeTab] || localize('SceneEditor.TabScene'),
      activeTabDescription: activeTabDescriptions[this.uiState.activeTab] || '',
      mediaBadgeIcon: this.uiState.data.bgType === 'video' ? 'fa-film' : 'fa-image',
      mediaBadgeLabel: this.uiState.data.bgType === 'video'
        ? localize('GMPanel.AnimatedBackground')
        : localize('SceneEditor.BackgroundMedia'),
      heroStats,
      sceneTabBadge: this.uiState.data.tags.length ? String(this.uiState.data.tags.length) : '',
      audioTabBadge: totalAudioEntries ? String(totalAudioEntries) : '',
      layoutPresets,
      sizePresets,
      shapePresets,
      displayModes,
      backgroundFitPresets,
      layoutSettings: this.uiState.data.layoutSettings,
      theaterModeEnabled,
      theaterShotCount: theaterShots.length,
      isFreeform: this.uiState.data.layoutSettings.preset === 'freeform',
      hasPositions: Object.keys(this.uiState.data.layoutSettings.positions || {}).length > 0,
      // Audio integration
      njAvailable,
      attachedPlaylists,
      hasPlaylists: attachedPlaylists.length > 0,
      soundtrackTracks,
      hasTracks: soundtrackTracks.length > 0,
      soundtrackMode,
      hasAnySoundtrack: soundtrackMode !== 'empty',
      playbackModes,
      legacyPlaylistName,
      ambienceLayers,
      hasLayers: ambienceLayers.length > 0,
      maxLayersReached: ambienceLayers.length >= CONFIG.MAX_AMBIENCE_LAYERS,
      maxLayers: CONFIG.MAX_AMBIENCE_LAYERS,
      legacyAmbienceName,
      soundboardSounds,
      hasSounds: soundboardSounds.length > 0,
      audio: this.uiState.data.audio,
      volumePercent: Math.round((this.uiState.data.audio.volume ?? 1.0) * 100)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Abort previous listeners before re-attaching
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const o = { signal: this._abortController.signal };

    // Bind Name Input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.uiState.data.name = e.target.value;
      }, o);
    }

    // Bind Background Input
    const bgInput = this.element.querySelector('input[name="background"]');
    if (bgInput) {
      bgInput.addEventListener('change', (e) => {
        this._updateBackground(e.target.value);
      }, o);
    }

    // Bind Browse Button (for file picker)
    const browseBtn = this.element.querySelector('.es-scene-editor__browse-btn');
    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._openFilePicker();
      }, o);
    }

    // Bind Tag Input Enter Key
    const tagInput = this.element.querySelector('.es-scene-editor__tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._addTag(e.target.value);
          e.target.value = '';
        }
      }, o);
    }

    // Bind Layout Controls
    const layoutPresetSelect = this.element.querySelector('select[name="layoutPreset"]');
    if (layoutPresetSelect) {
      layoutPresetSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.preset = e.target.value;
        this.render(); // Re-render to toggle freeform-specific UI
      }, o);
    }

    const sizeSelect = this.element.querySelector('select[name="layoutSize"]');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.size = e.target.value;
      }, o);
    }

    const shapeSelect = this.element.querySelector('select[name="layoutShape"]');
    if (shapeSelect) {
      shapeSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.shape = e.target.value;
      }, o);
    }

    const displayModeSelect = this.element.querySelector('select[name="displayMode"]');
    if (displayModeSelect) {
      displayModeSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.displayMode = e.target.value;
        this.render();
      }, o);
    }

    const theaterModeCheckbox = this.element.querySelector('input[name="theaterMode"]');
    if (theaterModeCheckbox) {
      theaterModeCheckbox.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.theaterMode = e.target.checked;
        if (e.target.checked) {
          this.uiState.data.layoutSettings.theaterShots = ensureTheaterShots(this.uiState.data);
        }
        this.render();
      }, o);
    }

    const spacingInput = this.element.querySelector('input[name="layoutSpacing"]');
    if (spacingInput) {
      spacingInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.spacing = parseInt(e.target.value) || 24;
      }, o);
    }

    const offsetXInput = this.element.querySelector('input[name="layoutOffsetX"]');
    if (offsetXInput) {
      offsetXInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.offsetX = parseInt(e.target.value) || 0;
      }, o);
    }

    const offsetYInput = this.element.querySelector('input[name="layoutOffsetY"]');
    if (offsetYInput) {
      offsetYInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.offsetY = parseInt(e.target.value) || 5;
      }, o);
    }

    // Bind Background Fit Select
    const backgroundFitSelect = this.element.querySelector('select[name="backgroundFit"]');
    if (backgroundFitSelect) {
      backgroundFitSelect.addEventListener('change', (e) => {
        // Empty string means use global setting (null)
        this.uiState.data.backgroundFit = e.target.value || null;
      }, o);
    }

    // Bind Audio Controls
    const playbackModeSelect = this.element.querySelector('select[name="playbackMode"]');
    if (playbackModeSelect) {
      playbackModeSelect.addEventListener('change', (e) => {
        this.uiState.data.audio.playbackMode = e.target.value;
      }, o);
    }

    // Bind ambience layer volume sliders
    this.element.querySelectorAll('.es-scene-editor__layer-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.layerIndex);
        if (isNaN(index)) return;
        const volume = parseFloat(e.target.value);
        this.uiState.data.audio.layers[index].volume = volume;
        const valueEl = e.target.parentElement.querySelector('.es-scene-editor__layer-volume-value');
        if (valueEl) valueEl.textContent = `${Math.round(volume * 100)}%`;
      }, o);
    });

    const autoPlayMusicCheckbox = this.element.querySelector('input[name="autoPlayMusic"]');
    if (autoPlayMusicCheckbox) {
      autoPlayMusicCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.autoPlayMusic = e.target.checked;
      }, o);
    }

    const autoPlayAmbienceCheckbox = this.element.querySelector('input[name="autoPlayAmbience"]');
    if (autoPlayAmbienceCheckbox) {
      autoPlayAmbienceCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.autoPlayAmbience = e.target.checked;
      }, o);
    }

    const stopOnEndCheckbox = this.element.querySelector('input[name="stopOnEnd"]');
    if (stopOnEndCheckbox) {
      stopOnEndCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.stopOnEnd = e.target.checked;
      }, o);
    }

    // Bind master volume slider
    const volumeSlider = this.element.querySelector('input[name="masterVolume"]');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        this.uiState.data.audio.volume = volume;
        const valueEl = e.target.parentElement.querySelector('.es-scene-editor__volume-value');
        if (valueEl) valueEl.textContent = `${Math.round(volume * 100)}%`;
      }, o);
    }

    // Bind fade-out duration input
    const fadeInput = this.element.querySelector('input[name="fadeOut"]');
    if (fadeInput) {
      fadeInput.addEventListener('change', (e) => {
        this.uiState.data.audio.fadeOut = parseFloat(e.target.value) || 0;
      }, o);
    }

    // Bind track drag-to-reorder
    this._bindTrackDragReorder();
  }

  /* ═══════════════════════════════════════════════════════════════
     TRACK DRAG REORDER
     ═══════════════════════════════════════════════════════════════ */

  _bindTrackDragReorder() {
    const trackItems = this.element.querySelectorAll('.es-scene-editor__track-item[draggable="true"]');
    if (!trackItems.length) return;
    const o = { signal: this._abortController.signal };

    trackItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.trackIndex);
        item.classList.add('es-scene-editor__track-item--dragging');
      }, o);

      item.addEventListener('dragend', () => {
        item.classList.remove('es-scene-editor__track-item--dragging');
        this.element.querySelectorAll('.es-scene-editor__track-item--over').forEach(el => {
          el.classList.remove('es-scene-editor__track-item--over');
        });
      }, o);

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('es-scene-editor__track-item--over');
      }, o);

      item.addEventListener('dragleave', () => {
        item.classList.remove('es-scene-editor__track-item--over');
      }, o);

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(item.dataset.trackIndex);
        this._reorderTrack(fromIndex, toIndex);
      }, o);
    });
  }

  _reorderTrack(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const tracks = this.uiState.data.audio.tracks;
    const [moved] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, moved);
    log(`Reordered track from ${fromIndex} to ${toIndex}`);
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     FILE PICKER
     ═══════════════════════════════════════════════════════════════ */

  _openFilePicker() {
    const fp = new FilePicker({
      type: "imagevideo",
      current: this.uiState.data.background,
      callback: path => {
        this._updateBackground(path);
        this.render();
      }
    });
    fp.render(true);
  }

  /* ═══════════════════════════════════════════════════════════════
     LOGIC
     ═══════════════════════════════════════════════════════════════ */

  _updateBackground(path) {
    this.uiState.data.background = path;
    this.uiState.data.bgType = path.match(/\.(webm|mp4|ogg|mov)$/i) ? 'video' : 'image';

    // Smart Auto-Tagging
    this._autoTagFromFilename(path);
  }

  _autoTagFromFilename(path) {
    const filename = path.split('/').pop().split('.')[0]; // Remove extension and path
    // Split by common delimiters: _ - space
    const words = filename.split(/[-_\s]+/);

    const potentialTags = words.filter(w => w.length > 3).map(w => w.toLowerCase());

    let added = false;
    potentialTags.forEach(tag => {
      if (!this.uiState.data.tags.includes(tag)) {
        this.uiState.data.tags.push(tag);
        added = true;
      }
    });

    if (added) {
      ui.notifications.info(format('Notifications.AutoTagsAdded', { tags: potentialTags.join(', ') }));
    }
  }

  _addTag(tag) {
    const cleanTag = tag.trim();
    if (cleanTag && !this.uiState.data.tags.includes(cleanTag)) {
      this.uiState.data.tags.push(cleanTag);
      this.render();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onTabSwitch(event, target) {
    this.uiState.activeTab = target.dataset.tab;
    this.render();
  }

  static _onRemoveTag(event, target) {
    const tagToRemove = target.dataset.tag;
    this.uiState.data.tags = this.uiState.data.tags.filter(t => t !== tagToRemove);
    this.render();
  }

  static async _onSave(event, target) {
    // Add loading state to button
    const btn = target;
    const originalHtml = btn.innerHTML;
    btn.classList.add('es-btn-loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
      if (this.uiState.data.layoutSettings?.theaterMode) {
        this.uiState.data.layoutSettings.theaterShots = ensureTheaterShots(this.uiState.data);
      }

      if (this.isCreateMode) {
        // Create a new scene
        const newScene = Store.createScene({
          name: this.uiState.data.name,
          background: this.uiState.data.background,
          bgType: this.uiState.data.bgType,
          folder: this.targetFolderId,
          tags: this.uiState.data.tags,
          layoutSettings: this.uiState.data.layoutSettings,
          audio: this.uiState.data.audio
        });

        // Refresh GM Panel and select the new scene
        const { ExaltedScenesGMPanel } = await import('./GMPanel.js').catch(e => {
          logError('Failed to import GMPanel:', e);
          return {};
        });
        if (ExaltedScenesGMPanel?._instance) {
          ExaltedScenesGMPanel._instance.uiState.selectedId = newScene.id;
          ExaltedScenesGMPanel._instance.uiState.inspectorOpen = true;
          ExaltedScenesGMPanel._instance.render();
        }

        this.close();
        ui.notifications.info(format('Notifications.SceneCreatedName', { name: newScene.name }));
      } else {
        // Update existing scene
        Object.assign(this.scene, this.uiState.data);
        Store.saveData();

        // Refresh GM Panel
        const { ExaltedScenesGMPanel } = await import('./GMPanel.js').catch(e => {
          logError('Failed to import GMPanel:', e);
          return {};
        });
        ExaltedScenesGMPanel?.show?.();

        this.close();
        ui.notifications.info(format('Notifications.SceneSavedName', { name: this.scene.name }));
      }
    } catch (error) {
      console.error('Exalted Scenes | Error saving scene:', error);
      ui.notifications.error(localize('Notifications.ErrorSaveScene'));
      // Restore button state on error
      btn.classList.remove('es-btn-loading');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  static _onClose(event, target) {
    this.close();
  }

  static _onSelectMedia(event, target) {
    this._openFilePicker();
  }

  static _onResetPositions(event, target) {
    this.uiState.data.layoutSettings.positions = {};
    this.render();
    ui.notifications.info(localize('Notifications.PositionsReset'));
  }

  /* ═══════════════════════════════════════════════════════════════
     PLAYLIST ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static async _onAddPlaylist(event, target) {
    const openBrowser = () => {
      import('./AudioBrowser.js').then(({ AudioBrowser }) => {
        AudioBrowser.browse('playlist', (selectedPlaylists) => {
          for (const playlist of selectedPlaylists) {
            const exists = this.uiState.data.audio.playlists.some(p => p.id === playlist.id);
            if (!exists) {
              this.uiState.data.audio.playlists.push({
                id: playlist.id,
                name: playlist.name
              });
            }
          }
          this.render();
        });
      }).catch(e => {
        console.error('Exalted Scenes | Failed to import AudioBrowser:', e);
      });
    };

    // If individual tracks exist, confirm before switching
    if (this.uiState.data.audio.tracks.length > 0) {
      const confirmed = await ExaltedScenesDialog.confirm({
        title: localize('SceneEditor.Soundtrack'),
        content: localize('SceneEditor.SwitchToPlaylists'),
        tone: 'warning',
        confirmLabel: localize('Common.Change'),
        confirmVariant: 'primary'
      });

      if (!confirmed) return;

      this.uiState.data.audio.tracks = [];
    }

    openBrowser();
  }

  static _onRemovePlaylist(event, target) {
    const playlistIndex = parseInt(target.dataset.playlistIndex);
    if (isNaN(playlistIndex)) return;
    this.uiState.data.audio.playlists.splice(playlistIndex, 1);
    this.render();
  }

  static async _onPreviewPlaylist(event, target) {
    const playlistId = target.dataset.playlistId;
    if (!playlistId) return;
    await NarratorJukeboxIntegration.playPlaylist(playlistId);
  }

  /* ═══════════════════════════════════════════════════════════════
     SOUNDTRACK TRACK ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static async _onAddSoundtrackTrack(event, target) {
    const openBrowser = () => {
      import('./AudioBrowser.js').then(({ AudioBrowser }) => {
        AudioBrowser.browse('music', (selectedTracks) => {
          for (const track of selectedTracks) {
            const exists = this.uiState.data.audio.tracks.some(t => t.id === track.id);
            if (!exists) {
              this.uiState.data.audio.tracks.push({
                id: track.id,
                name: track.name,
                playlistId: track.playlistId,
                playlistName: track.playlistName
              });
            }
          }
          this.render();
        });
      }).catch(e => {
        console.error('Exalted Scenes | Failed to import AudioBrowser:', e);
      });
    };

    // If playlists are attached, confirm before switching
    if (this.uiState.data.audio.playlists.length > 0) {
      const confirmed = await ExaltedScenesDialog.confirm({
        title: localize('SceneEditor.Soundtrack'),
        content: localize('SceneEditor.SwitchToTracks'),
        tone: 'warning',
        confirmLabel: localize('Common.Change'),
        confirmVariant: 'primary'
      });

      if (!confirmed) return;

      this.uiState.data.audio.playlists = [];
    }

    openBrowser();
  }

  static _onRemoveSoundtrackTrack(event, target) {
    const trackIndex = parseInt(target.dataset.trackIndex);
    if (isNaN(trackIndex)) return;
    this.uiState.data.audio.tracks.splice(trackIndex, 1);
    this.render();
  }

  static async _onPreviewTrack(event, target) {
    const trackId = target.dataset.trackId;
    if (!trackId) return;
    await NarratorJukeboxIntegration.playTrack(null, trackId);
  }

  /* ═══════════════════════════════════════════════════════════════
     AMBIENCE LAYER ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onAddAmbienceLayer(event, target) {
    if (this.uiState.data.audio.layers.length >= CONFIG.MAX_AMBIENCE_LAYERS) {
      ui.notifications.warn(format('SceneEditor.MaxLayersReached', { max: CONFIG.MAX_AMBIENCE_LAYERS }));
      return;
    }

    import('./AudioBrowser.js').then(({ AudioBrowser }) => {
      AudioBrowser.browse('ambience', (selectedSounds) => {
        for (const sound of selectedSounds) {
          if (this.uiState.data.audio.layers.length >= CONFIG.MAX_AMBIENCE_LAYERS) break;
          const exists = this.uiState.data.audio.layers.some(l => l.id === sound.id);
          if (!exists) {
            this.uiState.data.audio.layers.push({
              id: sound.id,
              name: sound.name,
              volume: 1.0
            });
          }
        }
        this.render();
      });
    }).catch(e => {
      console.error('Exalted Scenes | Failed to import AudioBrowser:', e);
    });
  }

  static _onRemoveAmbienceLayer(event, target) {
    const layerIndex = parseInt(target.dataset.layerIndex);
    if (isNaN(layerIndex)) return;
    this.uiState.data.audio.layers.splice(layerIndex, 1);
    this.render();
  }

  static async _onPreviewAmbience(event, target) {
    // Preview single layer if triggered from a layer row
    const layerId = target.dataset.layerId;
    if (layerId) {
      const layerVolume = parseFloat(target.dataset.layerVolume) || 1.0;
      await NarratorJukeboxIntegration.stopAmbience();
      await NarratorJukeboxIntegration.addAmbienceLayer(layerId, layerVolume);
      return;
    }

    // Fallback to legacy preset preview
    const presetId = this.uiState.data.audio?._legacyAmbiencePresetId;
    if (!presetId) {
      ui.notifications.warn(localize('Notifications.WarnNoAmbienceSelected'));
      return;
    }
    const success = await NarratorJukeboxIntegration.loadAmbiencePreset(presetId);
    if (success) {
      ui.notifications.info(localize('Notifications.LoadedAmbiencePreview'));
    } else {
      ui.notifications.error(localize('Notifications.ErrorLoadAmbience'));
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SOUNDBOARD ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onAddSoundboardSound(event, target) {
    import('./AudioBrowser.js').then(({ AudioBrowser }) => {
      AudioBrowser.browse('soundboard', (selectedSounds) => {
        for (const sound of selectedSounds) {
          const exists = this.uiState.data.audio.sounds.some(s => s.id === sound.id);
          if (!exists) {
            this.uiState.data.audio.sounds.push({
              id: sound.id,
              name: sound.name
            });
          }
        }
        this.render();
      });
    }).catch(e => {
      console.error('Exalted Scenes | Failed to import AudioBrowser:', e);
    });
  }

  static _onRemoveSoundboardSound(event, target) {
    const soundIndex = parseInt(target.dataset.soundIndex);
    if (isNaN(soundIndex)) return;
    this.uiState.data.audio.sounds.splice(soundIndex, 1);
    this.render();
  }

  static async _onPreviewSoundboardSound(event, target) {
    const soundId = target.dataset.soundId;
    if (!soundId) return;
    await NarratorJukeboxIntegration.playSoundboardSound(soundId);
  }

  static async _onStopAudio(event, target) {
    await NarratorJukeboxIntegration.stopAll();
    ui.notifications.info(localize('Notifications.StoppedAllAudio'));
  }
}
