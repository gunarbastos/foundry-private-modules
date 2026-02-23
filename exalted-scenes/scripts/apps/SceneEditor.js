import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SceneEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(sceneId = null, options = {}) {
    super(options);
    this.sceneId = sceneId;
    this.scene = sceneId ? Store.scenes.get(sceneId) : null;
    this.isCreateMode = !sceneId;

    // Clone data for editing state to avoid direct mutation until save
    // For create mode, provide default values
    this.uiState = {
      data: this.scene ? this.scene.toJSON() : {
        name: 'New Scene',
        background: CONFIG.DEFAULTS.SCENE_BG,
        bgType: 'image',
        tags: [],
        cast: [],
        layoutSettings: { ...CONFIG.DEFAULT_LAYOUT },
        audio: {
          playlistId: null,
          ambiencePresetId: null,
          autoPlayMusic: false,
          autoPlayAmbience: false,
          stopOnEnd: false
        }
      },
      activeTab: 'general',
      newTag: ''
    };

    // Ensure layoutSettings exists for existing scenes
    if (!this.uiState.data.layoutSettings) {
      this.uiState.data.layoutSettings = { ...CONFIG.DEFAULT_LAYOUT };
    }

    // Ensure audio settings exist for existing scenes
    if (!this.uiState.data.audio) {
      this.uiState.data.audio = {
        playlistId: null,
        ambiencePresetId: null,
        autoPlayMusic: false,
        autoPlayAmbience: false,
        stopOnEnd: false
      };
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
      width: 560,
      height: 720
    },
    actions: {
      save: SceneEditor._onSave,
      close: SceneEditor._onClose,
      'tab-switch': SceneEditor._onTabSwitch,
      'remove-tag': SceneEditor._onRemoveTag,
      'preview-playlist': SceneEditor._onPreviewPlaylist,
      'preview-ambience': SceneEditor._onPreviewAmbience,
      'stop-audio': SceneEditor._onStopAudio,
      'select-media': SceneEditor._onSelectMedia,
      'change-media': SceneEditor._onSelectMedia
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
    const playlists = njAvailable ? [
      { id: '', name: localize('Permissions.None'), selected: !this.uiState.data.audio?.playlistId },
      ...NarratorJukeboxIntegration.getAllPlaylists().map(p => ({
        ...p,
        selected: p.id === this.uiState.data.audio?.playlistId
      }))
    ] : [];
    const ambiencePresets = njAvailable ? [
      { id: '', name: localize('Permissions.None'), selected: !this.uiState.data.audio?.ambiencePresetId },
      ...NarratorJukeboxIntegration.getAmbiencePresets().map(p => ({
        ...p,
        selected: p.id === this.uiState.data.audio?.ambiencePresetId
      }))
    ] : [];

    return {
      scene: this.uiState.data,
      activeTab: this.uiState.activeTab,
      isImage: this.uiState.data.bgType === 'image',
      isVideo: this.uiState.data.bgType === 'video',
      isCreateMode: this.isCreateMode,
      layoutPresets,
      sizePresets,
      backgroundFitPresets,
      layoutSettings: this.uiState.data.layoutSettings,
      // Audio integration
      njAvailable,
      playlists,
      ambiencePresets,
      audio: this.uiState.data.audio
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind Name Input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.uiState.data.name = e.target.value;
      });
    }

    // Bind Background Input
    const bgInput = this.element.querySelector('input[name="background"]');
    if (bgInput) {
      bgInput.addEventListener('change', (e) => {
        this._updateBackground(e.target.value);
      });
    }

    // Bind Browse Button (for file picker)
    const browseBtn = this.element.querySelector('.es-scene-editor__browse-btn');
    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._openFilePicker();
      });
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
      });
    }

    // Bind Layout Controls
    const layoutPresetSelect = this.element.querySelector('select[name="layoutPreset"]');
    if (layoutPresetSelect) {
      layoutPresetSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.preset = e.target.value;
      });
    }

    const sizeSelect = this.element.querySelector('select[name="layoutSize"]');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        this.uiState.data.layoutSettings.size = e.target.value;
      });
    }

    const spacingInput = this.element.querySelector('input[name="layoutSpacing"]');
    if (spacingInput) {
      spacingInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.spacing = parseInt(e.target.value) || 24;
      });
    }

    const offsetXInput = this.element.querySelector('input[name="layoutOffsetX"]');
    if (offsetXInput) {
      offsetXInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.offsetX = parseInt(e.target.value) || 0;
      });
    }

    const offsetYInput = this.element.querySelector('input[name="layoutOffsetY"]');
    if (offsetYInput) {
      offsetYInput.addEventListener('input', (e) => {
        this.uiState.data.layoutSettings.offsetY = parseInt(e.target.value) || 5;
      });
    }

    // Bind Background Fit Select
    const backgroundFitSelect = this.element.querySelector('select[name="backgroundFit"]');
    if (backgroundFitSelect) {
      backgroundFitSelect.addEventListener('change', (e) => {
        // Empty string means use global setting (null)
        this.uiState.data.backgroundFit = e.target.value || null;
      });
    }

    // Bind Audio Controls
    const playlistSelect = this.element.querySelector('select[name="audioPlaylist"]');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (e) => {
        this.uiState.data.audio.playlistId = e.target.value || null;
      });
    }

    const ambienceSelect = this.element.querySelector('select[name="audioAmbience"]');
    if (ambienceSelect) {
      ambienceSelect.addEventListener('change', (e) => {
        this.uiState.data.audio.ambiencePresetId = e.target.value || null;
      });
    }

    const autoPlayMusicCheckbox = this.element.querySelector('input[name="autoPlayMusic"]');
    if (autoPlayMusicCheckbox) {
      autoPlayMusicCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.autoPlayMusic = e.target.checked;
      });
    }

    const autoPlayAmbienceCheckbox = this.element.querySelector('input[name="autoPlayAmbience"]');
    if (autoPlayAmbienceCheckbox) {
      autoPlayAmbienceCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.autoPlayAmbience = e.target.checked;
      });
    }

    const stopOnEndCheckbox = this.element.querySelector('input[name="stopOnEnd"]');
    if (stopOnEndCheckbox) {
      stopOnEndCheckbox.addEventListener('change', (e) => {
        this.uiState.data.audio.stopOnEnd = e.target.checked;
      });
    }
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
      if (this.isCreateMode) {
        // Create a new scene
        const newScene = Store.createScene({
          name: this.uiState.data.name,
          background: this.uiState.data.background,
          bgType: this.uiState.data.bgType,
          tags: this.uiState.data.tags,
          layoutSettings: this.uiState.data.layoutSettings,
          audio: this.uiState.data.audio
        });

        // Refresh GM Panel and select the new scene
        const { ExaltedScenesGMPanel } = await import('./GMPanel.js');
        if (ExaltedScenesGMPanel._instance) {
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
        const { ExaltedScenesGMPanel } = await import('./GMPanel.js');
        ExaltedScenesGMPanel.show();

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

  /* ═══════════════════════════════════════════════════════════════
     AUDIO PREVIEW ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static async _onPreviewPlaylist(event, target) {
    const playlistId = this.uiState.data.audio?.playlistId;
    if (!playlistId) {
      ui.notifications.warn(localize('Notifications.WarnNoPlaylistSelected'));
      return;
    }
    const success = await NarratorJukeboxIntegration.playPlaylist(playlistId);
    if (success) {
      ui.notifications.info(localize('Notifications.PlayingPlaylistPreview'));
    } else {
      ui.notifications.error(localize('Notifications.ErrorPlayPlaylist'));
    }
  }

  static async _onPreviewAmbience(event, target) {
    const presetId = this.uiState.data.audio?.ambiencePresetId;
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

  static async _onStopAudio(event, target) {
    await NarratorJukeboxIntegration.stopAll();
    ui.notifications.info(localize('Notifications.StoppedAllAudio'));
  }
}
