/**
 * @file GMPanel.js
 * @description Main GM Panel interface for Exalted Scenes module.
 * Coordinates all panel functionality through specialized managers.
 *
 * @module apps/GMPanel
 */

import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, localizeFull, format } from '../utils/i18n.js';

// GMPanel Managers (modular components)
import { DragDropManager, KeyboardManager, ContextMenuManager, SearchSortManager, CastManager, EmotionPickerManager, FolderManager, SlideshowManager, SequenceManager, CastOnlyManager } from './gm-panel/index.js';

import { SocketHandler } from '../data/SocketHandler.js';
import { SmartCreator } from './SmartCreator.js';
import { ActorCharacterImporter } from './ActorCharacterImporter.js';
import { CharacterEditor } from './CharacterEditor.js';
import { SceneEditor } from './SceneEditor.js';
import { SceneBulkImporter } from './SceneBulkImporter.js';
import { ExaltedScenesDialog } from './ThemedDialog.js';
import { mediaFocusToInlineStyle } from '../utils/media-focus.js';
import { buildShortcutReference, resolveShortcutText } from '../shortcuts.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM Panel application for managing scenes, characters, slideshows, and broadcasts.
 * Uses a modular manager pattern where each manager handles a specific domain:
 * - DragDropManager: Drag and drop operations
 * - KeyboardManager: Keyboard shortcuts
 * - ContextMenuManager: Right-click context menus
 * - SearchSortManager: Search and sorting functionality
 * - CastManager: Cast member management
 * - EmotionPickerManager: Emotion selection UI
 * - FolderManager: Folder navigation
 * - SlideshowManager: Slideshow controls
 * - SequenceManager: Scene sequence backgrounds
 * - CastOnlyManager: Cast-only broadcast mode
 *
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class ExaltedScenesGMPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Creates a new GMPanel instance.
   * @param {object} [options={}] - Application options
   */
  constructor(options = {}) {
    super(options);
    this.uiState = {
      currentView: 'scenes-all',
      searchQuery: '',
      selectedId: null,
      selectedIds: new Set(),
      selectionAnchorId: null,
      inspectorOpen: false,
      activeTags: new Set(),
      excludedTags: new Set(),
      activeSceneId: Store.activeSceneId,
      emotionPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, anchor: null },
      viewMode: 'grid', // 'grid' or 'list'
      // Novos estados para ordenação e busca
      sortBy: 'name', // 'name', 'created', 'lastUsed', 'playCount', 'custom'
      sortAscending: true,
      sortMenuOpen: false,
      isSearching: false,
      keyboardFocusIndex: -1, // Para navegação por teclado no emotion picker
      emotionSearchQuery: '', // Search query for emotion picker
      // Estado de navegação por folders
      currentFolderId: null, // null = root level
      // Scene being edited (for floating cast strip)
      editingSceneId: null,
      // Cast-Only Mode selection
      castOnlySelectedChars: new Set(),
      // Animated video previews in scene cards
      animatedPreviews: false,
      // Dropdown open states
      slideshowDropdownOpen: false,
      castOnlyDropdownOpen: false,
      // Shortcut reference overlay
      shortcutsOpen: false
    };

    // Initialize managers (modular components) with named references
    this._searchSortManager = new SearchSortManager(this);
    this._castManager = new CastManager(this);
    this._emotionPickerManager = new EmotionPickerManager(this);
    this._folderManager = new FolderManager(this);
    this._slideshowManager = new SlideshowManager(this);
    this._sequenceManager = new SequenceManager(this);
    this._castOnlyManager = new CastOnlyManager(this);

    // All managers for lifecycle iteration (setup/cleanup)
    this._managers = [
      new DragDropManager(this),
      new KeyboardManager(this),
      new ContextMenuManager(this),
      this._searchSortManager,
      this._castManager,
      this._emotionPickerManager,
      this._folderManager,
      this._slideshowManager,
      this._sequenceManager,
      this._castOnlyManager
    ];
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    id: 'exalted-scenes-gm-panel',
    classes: ['exalted-scenes'],
    window: {
      title: 'Exalted Scenes',
      icon: 'fas fa-film',
      resizable: true,
      controls: []
    },
    position: {
      width: 1000,
      height: 700
    },
    actions: {
      view: ExaltedScenesGMPanel._onViewChange,
      select: ExaltedScenesGMPanel._onSelectCard,
      'close-inspector': ExaltedScenesGMPanel._onCloseInspector,
      broadcast: ExaltedScenesGMPanel._onBroadcast,
      'stop-broadcast': ExaltedScenesGMPanel._onStopBroadcast,
      'add-cast': ExaltedScenesGMPanel._onAddCast,
      'add-current-folder-cast': ExaltedScenesGMPanel._onAddCurrentFolderCast,
      'change-emotion': ExaltedScenesGMPanel._onChangeEmotion,
      'cast-click': ExaltedScenesGMPanel._onCastClick,
      'select-emotion': ExaltedScenesGMPanel._onSelectEmotion,
      'close-picker': ExaltedScenesGMPanel._onClosePicker,
      'remove-cast': ExaltedScenesGMPanel._onRemoveCast,
      create: ExaltedScenesGMPanel._onCreate,
      'import-actors': ExaltedScenesGMPanel._onImportActors,
      'import-scenes': ExaltedScenesGMPanel._onImportScenes,
      edit: ExaltedScenesGMPanel._onEdit,
      duplicate: ExaltedScenesGMPanel._onDuplicate,
      delete: ExaltedScenesGMPanel._onDelete,
      'filter-tag': ExaltedScenesGMPanel._onFilterTag,
      'remove-filter': ExaltedScenesGMPanel._onRemoveFilter,
      'exclude-tag': ExaltedScenesGMPanel._onExcludeTag,
      'toggle-view': ExaltedScenesGMPanel._onToggleView,
      'quick-add': ExaltedScenesGMPanel._onQuickAdd,
      'toggle-favorite': ExaltedScenesGMPanel._onToggleFavorite,
      // Novas actions
      'toggle-sort': ExaltedScenesGMPanel._onToggleSort,
      'sort': ExaltedScenesGMPanel._onSort,
      'toggle-sort-direction': ExaltedScenesGMPanel._onToggleSortDirection,
      'clear-search': ExaltedScenesGMPanel._onClearSearch,
      'toggle-shortcuts': ExaltedScenesGMPanel._onToggleShortcuts,
      // Folder actions
      'open-folder': ExaltedScenesGMPanel._onOpenFolder,
      'navigate-up': ExaltedScenesGMPanel._onNavigateUp,
      'create-folder': ExaltedScenesGMPanel._onCreateFolder,
      'toggle-folder': ExaltedScenesGMPanel._onToggleFolder,
      'delete-folder': ExaltedScenesGMPanel._onDeleteFolder,
      'rename-folder': ExaltedScenesGMPanel._onRenameFolder,
      // Broadcasting bar actions
      'select-broadcasting': ExaltedScenesGMPanel._onSelectBroadcasting,
      'view-player-panel': ExaltedScenesGMPanel._onViewPlayerPanel,
      // Floating Cast Strip actions
      'go-to-scene': ExaltedScenesGMPanel._onGoToScene,
      'close-floating-cast': ExaltedScenesGMPanel._onCloseFloatingCast,
      'floating-add-cast': ExaltedScenesGMPanel._onFloatingAddCast,
      // Emotion Picker actions
      'toggle-emotion-favorite': ExaltedScenesGMPanel._onToggleEmotionFavorite,
      'open-actor-sheet': ExaltedScenesGMPanel._onOpenActorSheet,
      'set-character-emotion': ExaltedScenesGMPanel._onSetCharacterEmotion,
      'set-character-hero-pose': ExaltedScenesGMPanel._onSetCharacterHeroPose,
      // Slideshow actions
      'toggle-slideshow-dropdown': ExaltedScenesGMPanel._onToggleSlideshowDropdown,
      'create-slideshow': ExaltedScenesGMPanel._onCreateSlideshow,
      'edit-slideshow': ExaltedScenesGMPanel._onEditSlideshow,
      'play-slideshow': ExaltedScenesGMPanel._onPlaySlideshow,
      'delete-slideshow': ExaltedScenesGMPanel._onDeleteSlideshow,
      'slideshow-pause': ExaltedScenesGMPanel._onSlideshowPause,
      'slideshow-resume': ExaltedScenesGMPanel._onSlideshowResume,
      'slideshow-next': ExaltedScenesGMPanel._onSlideshowNext,
      'slideshow-prev': ExaltedScenesGMPanel._onSlideshowPrev,
      'slideshow-stop': ExaltedScenesGMPanel._onSlideshowStop,
      // Scene Sequence actions
      'convert-to-sequence': ExaltedScenesGMPanel._onConvertToSequence,
      'remove-sequence': ExaltedScenesGMPanel._onRemoveSequence,
      'add-sequence-bg': ExaltedScenesGMPanel._onAddSequenceBg,
      'remove-sequence-bg': ExaltedScenesGMPanel._onRemoveSequenceBg,
      'sequence-goto': ExaltedScenesGMPanel._onSequenceGoto,
      'broadcast-sequence': ExaltedScenesGMPanel._onBroadcastSequence,
      'sequence-prev': ExaltedScenesGMPanel._onSequencePrev,
      'sequence-next': ExaltedScenesGMPanel._onSequenceNext,
      // Cast-Only Mode actions
      'toggle-cast-only-dropdown': ExaltedScenesGMPanel._onToggleCastOnlyDropdown,
      'toggle-cast-only-char': ExaltedScenesGMPanel._onToggleCastOnlyChar,
      'cast-only-start': ExaltedScenesGMPanel._onCastOnlyStart,
      'cast-only-stop': ExaltedScenesGMPanel._onCastOnlyStop,
      'cast-only-layout': ExaltedScenesGMPanel._onCastOnlyLayout,
      // Animated previews toggle
      'toggle-animated-previews': ExaltedScenesGMPanel._onToggleAnimatedPreviews
      // Color picker handled via direct event listeners in _onRender
    }
  };

  static PARTS = {
    main: {
      template: CONFIG.TEMPLATES.GM_PANEL,
      scrollable: ['.es-grid']
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════ */

  _onClose(options) {
    // Cleanup all managers (includes context menu cleanup)
    for (const manager of this._managers) {
      manager.cleanup();
    }

    super._onClose?.(options);
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  _onRender(context, options) {
    super._onRender(context, options);

    // Clean up panel-level listeners from previous render
    this._renderAbortController?.abort();
    this._renderAbortController = new AbortController();

    // Setup all managers (cleanup is handled by AbortController in each manager)
    for (const manager of this._managers) {
      manager.cleanup(); // Clean up previous listeners before setting up new ones
      manager.setup(this.element);
    }

    // Double-click to rename card titles
    const grid = this.element.querySelector('.es-grid');
    if (grid) {
      grid.addEventListener('dblclick', (e) => {
        const title = e.target.closest('.es-card-title');
        if (!title) return;
        const card = title.closest('.es-card');
        if (!card) return;
        e.stopPropagation();
        e.preventDefault();
        this.startInlineRename(card);
      }, { signal: this._renderAbortController.signal });
    }

    // Restore search input focus/cursor after re-render
    if (this._pendingSearchRestore) {
      const { cursorPos } = this._pendingSearchRestore;
      const searchInput = this.element.querySelector('.es-search-input');
      if (searchInput) {
        searchInput.focus();
        if (cursorPos != null) {
          searchInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
      this._pendingSearchRestore = null;
    }

    // Handle animated video previews
    this._updateVideoPreviewPlayback();
  }

  /**
   * Control video preview playback based on animatedPreviews state
   * @private
   */
  _updateVideoPreviewPlayback() {
    const videos = this.element.querySelectorAll('.es-card-thumbnail video.thumbnail-preview');
    for (const video of videos) {
      if (this.uiState.animatedPreviews) {
        video.play().catch(() => {}); // Ignore autoplay errors
      } else {
        video.pause();
        video.currentTime = 0; // Reset to first frame for thumbnail
      }
    }
  }

  clearCardSelection({ keepFocusedId = false, keepInspector = false } = {}) {
    this.uiState.selectedIds = new Set();
    this.uiState.selectionAnchorId = null;

    if (!keepFocusedId) {
      this.uiState.selectedId = null;
    }

    if (!keepInspector) {
      this.uiState.inspectorOpen = false;
    }
  }

  setSingleCardSelection(id, { openInspector = true } = {}) {
    if (!id) {
      this.clearCardSelection();
      return;
    }

    this.uiState.selectedIds = new Set([id]);
    this.uiState.selectionAnchorId = id;
    this.uiState.selectedId = id;
    this.uiState.inspectorOpen = !!openInspector;
  }

  getVisibleLibraryCardIds(itemType = null) {
    const resolvedType = itemType || (this.uiState.currentView.startsWith('scenes') ? 'scene' : 'character');
    return Array.from(this.element?.querySelectorAll('.es-grid .es-card') || [])
      .filter((card) => card.dataset.type === resolvedType)
      .map((card) => card.dataset.id)
      .filter(Boolean);
  }

  _sanitizeCardSelection(activeTab = this.uiState.currentView.startsWith('scenes') ? 'scenes' : 'characters') {
    const collection = activeTab === 'scenes' ? Store.scenes : Store.characters;
    const nextSelectedIds = new Set(
      Array.from(this.uiState.selectedIds || []).filter((id) => collection.has(id))
    );

    if (!nextSelectedIds.size && this.uiState.selectedId && collection.has(this.uiState.selectedId)) {
      nextSelectedIds.add(this.uiState.selectedId);
    }

    this.uiState.selectedIds = nextSelectedIds;

    if (this.uiState.selectedId && !nextSelectedIds.has(this.uiState.selectedId)) {
      this.uiState.selectedId = nextSelectedIds.size ? Array.from(nextSelectedIds)[0] : null;
    }

    if (!this.uiState.selectedId && nextSelectedIds.size === 1) {
      this.uiState.selectedId = Array.from(nextSelectedIds)[0];
    }

    if (nextSelectedIds.size !== 1) {
      this.uiState.inspectorOpen = false;
    }

    if (!nextSelectedIds.size) {
      this.uiState.selectionAnchorId = null;
      this.uiState.selectedId = null;
      return;
    }

    if (!nextSelectedIds.has(this.uiState.selectionAnchorId)) {
      this.uiState.selectionAnchorId = this.uiState.selectedId || Array.from(nextSelectedIds)[0];
    }
  }

  async _prepareContext(options) {
    const activeTab = this.uiState.currentView.startsWith('scenes') ? 'scenes' : 'characters';
    const itemType = activeTab === 'scenes' ? 'scene' : 'character';
    this._sanitizeCardSelection(activeTab);
    const isFavorites = this.uiState.currentView.includes('favorites');
    const isSearching = this.uiState.searchQuery.length > 0;
    const hasTagFilters = this.uiState.activeTags.size > 0 || this.uiState.excludedTags.size > 0;
    const locale = game.i18n?.lang || undefined;
    const tagPreviewLimit = this.uiState.viewMode === 'list' ? 3 : 2;
    const shortDateFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric'
    });
    const formatCharacterCount = (count) => count === 1
      ? format('GMPanel.CountCharacters', { count })
      : format('GMPanel.CountCharactersPlural', { count });
    const resolveConfigLabel = (key) => key?.startsWith('EXALTED-SCENES.')
      ? localizeFull(key)
      : localize(key);
    const formatSceneDate = (timestamp) => timestamp
      ? shortDateFormatter.format(new Date(timestamp))
      : '';
    const getSceneLayoutInfo = (layoutSettings = {}) => {
      const layout = {
        ...CONFIG.DEFAULT_LAYOUT,
        ...layoutSettings
      };
      return {
        layout,
        preset: CONFIG.LAYOUT_PRESETS[layout.preset] || CONFIG.LAYOUT_PRESETS[CONFIG.DEFAULT_LAYOUT.preset],
        size: CONFIG.SIZE_PRESETS[layout.size] || CONFIG.SIZE_PRESETS[CONFIG.DEFAULT_LAYOUT.size],
        shape: CONFIG.SHAPE_PRESETS[layout.shape] || CONFIG.SHAPE_PRESETS[CONFIG.DEFAULT_LAYOUT.shape],
        displayMode: CONFIG.DISPLAY_MODES[layout.displayMode] || CONFIG.DISPLAY_MODES[CONFIG.DEFAULT_LAYOUT.displayMode]
      };
    };
    const getSceneInspectorData = (scene) => {
      const previewBackground = scene.isSequence && scene.sequenceBackgrounds?.length
        ? scene.sequenceBackgrounds[0]
        : null;
      const previewImage = previewBackground?.path || scene.image || '';
      const previewBgType = previewBackground?.bgType || scene.bgType;
      const hasPreviewMedia = Boolean(previewImage);
      const backgroundCount = scene.isSequence
        ? (scene.sequenceBackgrounds?.length || 0)
        : (hasPreviewMedia ? 1 : 0);
      const castCount = scene.cast?.length || 0;
      const { layout, preset, size, shape, displayMode } = getSceneLayoutInfo(scene.layoutSettings);
      const fitKey = scene.backgroundFit ||
        game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.BACKGROUND_FIT_MODE) ||
        'fill';
      const fitMode = CONFIG.BACKGROUND_FIT_MODES[fitKey] || CONFIG.BACKGROUND_FIT_MODES.fill;
      const usageTimestamp = scene.lastUsed || scene.createdAt;
      const usageLabel = scene.lastUsed
        ? localize('GMPanel.SortLastUsed')
        : localize('GMPanel.SortDateCreated');
      const usageIcon = scene.lastUsed ? 'fa-clock' : 'fa-calendar-plus';
      const shapeIcons = {
        circle: 'fa-circle',
        rounded: 'fa-square',
        square: 'fa-square-full',
        portrait: 'fa-rectangle-portrait'
      };
      const sceneHeroPills = [
        {
          icon: scene.isSequence ? 'fa-images' : hasPreviewMedia && previewBgType === 'video' ? 'fa-film' : 'fa-image',
          label: scene.isSequence
            ? format('GMPanel.CountBackgrounds', { count: backgroundCount })
            : hasPreviewMedia && previewBgType === 'video'
              ? localize('GMPanel.AnimatedBackground')
              : format('GMPanel.CountBackgrounds', { count: backgroundCount }),
          toneClass: scene.isSequence || (hasPreviewMedia && previewBgType === 'video') ? 'accent' : ''
        },
        {
          icon: 'fa-users',
          label: formatCharacterCount(castCount),
          toneClass: castCount ? '' : 'muted'
        }
      ];
      if (scene.hasAudio) {
        sceneHeroPills.push({
          icon: 'fa-music',
          label: localize('GMPanel.AudioLinked'),
          toneClass: 'success'
        });
      }

      const sceneSummaryStats = [
        {
          icon: scene.isSequence ? 'fa-images' : hasPreviewMedia && previewBgType === 'video' ? 'fa-film' : 'fa-image',
          label: localize('SceneEditor.BackgroundMedia'),
          value: scene.isSequence
            ? localize('Sequence.Sequence')
            : hasPreviewMedia && previewBgType === 'video'
              ? localize('GMPanel.AnimatedBackground')
              : format('GMPanel.CountBackgrounds', { count: backgroundCount }),
          meta: scene.isSequence ? format('GMPanel.CountBackgrounds', { count: backgroundCount }) : '',
          toneClass: scene.isSequence || (hasPreviewMedia && previewBgType === 'video') ? 'accent' : ''
        },
        {
          icon: preset.icon || 'fa-grip',
          label: localize('SceneEditor.CastLayout'),
          value: resolveConfigLabel(preset.name),
          meta: resolveConfigLabel(displayMode.name),
          toneClass: 'accent'
        },
        {
          icon: 'fa-expand',
          label: localize('SceneEditor.BackgroundFit'),
          value: resolveConfigLabel(fitMode.name),
          meta: scene.backgroundFit ? '' : localize('SceneEditor.UseGlobalSetting')
        },
        {
          icon: usageIcon,
          label: usageLabel,
          value: formatSceneDate(usageTimestamp)
        },
        {
          icon: 'fa-fire',
          label: localize('GMPanel.SortMostUsed'),
          value: String(scene.playCount || 0),
          toneClass: scene.playCount ? 'accent' : ''
        }
      ];
      if (scene.hasAudio) {
        sceneSummaryStats.push({
          icon: 'fa-music',
          label: localize('SceneEditor.Audio'),
          value: localize('GMPanel.AudioLinked'),
          toneClass: 'success'
        });
      }

      const sceneLayoutPills = [
        {
          icon: preset.icon || 'fa-grip',
          label: resolveConfigLabel(preset.name)
        },
        {
          icon: displayMode.icon || 'fa-circle-user',
          label: resolveConfigLabel(displayMode.name)
        },
        {
          icon: 'fa-expand',
          label: resolveConfigLabel(size.name)
        },
        {
          icon: shapeIcons[layout.shape] || 'fa-square',
          label: resolveConfigLabel(shape.name)
        }
      ];

      return {
        hasAudio: scene.hasAudio,
        hasPreviewMedia,
        previewImage,
        previewBgType,
        sceneHeroPills,
        sceneSummaryStats,
        sceneLayoutPills
      };
    };
    const getSceneStats = (item) => {
      const stats = [];
      const castCount = item.cast?.length || 0;
      if (castCount > 0) {
        stats.push({
          icon: 'fa-users',
          value: String(castCount),
          title: formatCharacterCount(castCount)
        });
      }

      if (item.isSequence) {
        const backgroundCount = Math.max(item.sequenceBackgrounds?.length || 0, 1);
        stats.push({
          icon: 'fa-images',
          value: String(backgroundCount),
          title: format('GMPanel.CountBackgrounds', { count: backgroundCount })
        });
      }

      return stats;
    };
    const getCharacterStats = (item) => {
      const stats = [];
      const heroCount = item.heroCount || 0;
      if (heroCount > 0) {
        stats.push({
          icon: 'fa-user',
          value: String(heroCount),
          title: localize('CharEditor.HeroPoses'),
          toneClass: 'es-card-stat--hero'
        });
      }

      if (item.actorId) {
        stats.push({
          icon: 'fa-address-book',
          title: localize('CharEditor.LinkedActor'),
          toneClass: 'es-card-stat--linked',
          iconOnly: true
        });
      }

      if (item.locked) {
        stats.push({
          icon: 'fa-lock',
          title: localize('PlayerView.LockedTooltip'),
          toneClass: 'es-card-stat--locked',
          iconOnly: true
        });
      }

      return stats;
    };
    const getCharacterInspectorData = (character) => {
      const favoriteEmotions = character.favoriteEmotions || new Set();
      const emotionEntries = Object.entries(character.states || {})
        .map(([key, path]) => ({
          key,
          path,
          focusStyle: mediaFocusToInlineStyle(character.getStateFocus(key)),
          isFavorite: favoriteEmotions.has(key),
          isActive: key === character.currentState
        }))
        .sort((a, b) => {
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.key.localeCompare(b.key);
        });

      const heroStates = Object.entries(character.heroStates || {});
      const activeHeroState = character.currentHeroState || heroStates[0]?.[0] || '';
      const heroPoseEntries = heroStates
        .map(([key, data]) => ({
          key,
          path: data.img,
          typeLabel: localize(data.type === 'full' ? 'Config.HeroTypes.Full' : 'Config.HeroTypes.Half'),
          isActive: key === activeHeroState
        }))
        .sort((a, b) => {
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          return a.key.localeCompare(b.key);
        });

      let linkedActor = null;
      if (character.actorId) {
        const actor = game.actors.get(character.actorId);
        if (actor) {
          linkedActor = {
            id: actor.id,
            name: actor.name,
            title: format('Picker.OpenActorSheet', { name: actor.name })
          };
        }
      }

      return {
        linkedActor,
        emotionEntries,
        heroPoseEntries,
        activeHeroState,
        emotionBadgeTitle: format('GMPanel.EmotionsAvailable', { count: emotionEntries.length }),
        characterSummaryStats: [
          {
            icon: 'fa-theater-masks',
            label: localize('CharEditor.Emotions'),
            value: character.currentState || '—',
            toneClass: 'es-character-inspector-stat--active'
          },
          {
            icon: 'fa-image',
            label: localize('CharEditor.EmotionPortraits'),
            value: String(emotionEntries.length)
          },
          {
            icon: 'fa-user',
            label: localize('CharEditor.HeroPoses'),
            value: String(heroPoseEntries.length),
            toneClass: heroPoseEntries.length ? 'es-character-inspector-stat--hero' : ''
          },
          {
            icon: 'fa-address-book',
            label: localize('CharEditor.LinkedActor'),
            value: linkedActor?.name || localize('CharEditor.NoActorLinked'),
            toneClass: linkedActor ? 'es-character-inspector-stat--linked' : ''
          }
        ]
      };
    };
    const getListSortMeta = (item) => {
      switch (this.uiState.sortBy) {
        case 'created':
          return item.createdAt ? {
            icon: 'fa-calendar-plus',
            text: shortDateFormatter.format(new Date(item.createdAt))
          } : null;
        case 'lastUsed':
          return item.lastUsed ? {
            icon: 'fa-clock',
            text: shortDateFormatter.format(new Date(item.lastUsed))
          } : null;
        case 'playCount':
          return {
            icon: 'fa-fire',
            text: String(item.playCount || 0)
          };
        default:
          return null;
      }
    };

    // Get folders for current type and current parent
    let folders = [];
    if (!isFavorites && !isSearching && !hasTagFilters) {
      folders = Store.getFolders(itemType, this.uiState.currentFolderId)
        .map(f => ({
          ...f.toJSON(),
          itemCount: Store.getItemsInFolder(itemType, f.id).length,
          subfolderCount: Store.getFolders(itemType, f.id).length
        }));
      // Sort folders by name
      folders.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    }

    // Get items
    let items = [];
    if (activeTab === 'scenes') {
      items = Store.getScenes({
        search: this.uiState.searchQuery,
        favorite: isFavorites,
        tags: Array.from(this.uiState.activeTags),
        excludedTags: Array.from(this.uiState.excludedTags)
      });
    } else {
      items = Store.getCharacters({
        search: this.uiState.searchQuery,
        favorite: isFavorites,
        tags: Array.from(this.uiState.activeTags),
        excludedTags: Array.from(this.uiState.excludedTags)
      });
    }

    // Filter items by current folder (only when not searching/filtering)
    if (!isSearching && !hasTagFilters && !isFavorites) {
      items = items.filter(i => i.folder === this.uiState.currentFolderId);
    }

    const selectedIdsMap = {};
    for (const id of this.uiState.selectedIds) {
      selectedIdsMap[id] = true;
    }

    // Transform for Handlebars (if needed, or use models directly)
    items = items.map(i => {
      const data = i.toJSON();
      const folder = i.folder ? Store.folders.get(i.folder) : null;
      const listSortMeta = getListSortMeta(i);
      const tags = Array.isArray(data.tags) ? data.tags : Array.from(data.tags || []);
      const visibleTags = tags.slice(0, tagPreviewLimit);
      const hiddenTagCount = Math.max(tags.length - visibleTags.length, 0);
      return {
        ...data,
        thumbnail: i.thumbnail,
        thumbnailFocusStyle: activeTab === 'characters' ? mediaFocusToInlineStyle(i.thumbnailFocus) : '',
        image: i.image,
        imageFocusStyle: activeTab === 'characters' ? mediaFocusToInlineStyle(i.currentFocus) : '',
        tags: tags,
        visibleTags: visibleTags,
        hiddenTagCount: hiddenTagCount,
        folderName: folder ? folder.name : '',
        // Audio indicator for scenes
        hasAudio: i.hasAudio || false,
        isSelected: !!selectedIdsMap[data.id],
        listSortMetaText: listSortMeta?.text || '',
        listSortMetaIcon: listSortMeta?.icon || '',
        itemStats: activeTab === 'scenes' ? getSceneStats(i) : getCharacterStats(data),
        characterStateLabel: activeTab === 'characters' ? String(data.currentState || '') : '',
        emotionBadgeTitle: activeTab === 'characters'
          ? format('GMPanel.EmotionsAvailable', { count: data.emotionCount || 0 })
          : ''
      };
    });

    // Aplicar ordenação (delegado ao SearchSortManager)
    items = this._searchSortManager.sortItems(items, activeTab);

    // Build folder path for breadcrumbs
    const folderPath = this.uiState.currentFolderId
      ? Store.getFolderPath(this.uiState.currentFolderId).map(f => f.toJSON())
      : [];
    const currentFolder = this.uiState.currentFolderId
      ? Store.folders.get(this.uiState.currentFolderId)?.toJSON()
      : null;
    const selectedCount = this.uiState.selectedIds.size;
    const selectionCountLabel = selectedCount === 1
      ? format('GMPanel.SelectionCount', { count: selectedCount })
      : format('GMPanel.SelectionCountPlural', { count: selectedCount });

    // Encontrar selectedItem diretamente do Store para garantir dados atualizados
    let selectedItem = null;
    if (this.uiState.selectedId) {
      if (this.uiState.currentView.startsWith('scenes')) {
        const scene = Store.scenes.get(this.uiState.selectedId);
        if (scene) {
          // Atualizar imagens do cast com estado atual
          const updatedCast = scene.cast.map(c => {
            const char = Store.characters.get(c.id);
            return char
              ? {
                  id: char.id,
                  name: char.name,
                  image: char.image,
                  focusStyle: mediaFocusToInlineStyle(char.currentFocus)
                }
              : c;
          });
          selectedItem = {
            ...scene.toJSON(),
            cast: updatedCast,
            image: scene.image,
            thumbnail: scene.thumbnail,
            ...getSceneInspectorData(scene)
          };
        }
      } else {
        const char = Store.characters.get(this.uiState.selectedId);
        if (char) {
          selectedItem = {
            ...char.toJSON(),
            image: char.image,
            imageFocusStyle: mediaFocusToInlineStyle(char.currentFocus),
            thumbnail: char.thumbnail,
            thumbnailFocusStyle: mediaFocusToInlineStyle(char.thumbnailFocus),
            ...getCharacterInspectorData(char)
          };
        }
      }
    }

    // Prepare Emotion Picker Context
    let pickerContext = null;
    if (this.uiState.emotionPicker.open && this.uiState.emotionPicker.characterId) {
      const char = Store.characters.get(this.uiState.emotionPicker.characterId);
      if (char) {
        const favoriteEmotions = char.favoriteEmotions || new Set();
        const emotions = Object.entries(char.states).map(([key, path]) => ({
          key,
          path,
          focusStyle: mediaFocusToInlineStyle(char.getStateFocus(key)),
          isFavorite: favoriteEmotions.has(key)
        }));
        // Sort: favorites first, then alphabetically
        emotions.sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.key.localeCompare(b.key);
        });

        // Check for linked Actor
        let linkedActor = null;
        if (char.actorId) {
          const actor = game.actors.get(char.actorId);
          if (actor) {
            linkedActor = { id: actor.id, name: actor.name };
          }
        }

        pickerContext = {
          character: char,
          emotions: emotions,
          x: this.uiState.emotionPicker.x,
          y: this.uiState.emotionPicker.y,
          pickerBelow: this.uiState.emotionPicker.pickerBelow || false,
          emotionSearchQuery: this.uiState.emotionSearchQuery || '',
          linkedActor: linkedActor,
          openActorTitle: linkedActor ? format('Picker.OpenActorSheet', { name: linkedActor.name }) : '',
          pickerModeLabel: localize('CharEditor.Emotions'),
          pickerModeIcon: 'fa-theater-masks',
          pickerCount: emotions.length,
          activeStateLabel: char.currentState || localize('CharEditor.NoEmotionsYet')
        };
      }
    }

    // Contadores para a sidebar
    const counts = {
      scenesAll: Store.scenes.size,
      scenesFavorites: Store.scenes.filter(s => s.favorite).length,
      charactersAll: Store.characters.size,
      charactersFavorites: Store.characters.filter(c => c.favorite).length
    };

    // Verificar se há filtros ativos
    const hasFilters = this.uiState.searchQuery.length > 0 ||
                       this.uiState.activeTags.size > 0 ||
                       this.uiState.excludedTags.size > 0;

    // Floating Cast Strip - mostra quando há uma cena sendo editada e não estamos na aba de scenes com inspector aberto
    let floatingCastStrip = null;
    if (this.uiState.editingSceneId) {
      const editingScene = Store.scenes.get(this.uiState.editingSceneId);
      if (editingScene) {
        // Só mostrar floating strip se NÃO estamos vendo o inspector dessa mesma cena
        const showingInspectorForSameScene = this.uiState.inspectorOpen &&
                                              this.uiState.selectedId === this.uiState.editingSceneId &&
                                              activeTab === 'scenes';
        if (!showingInspectorForSameScene) {
          const updatedCast = editingScene.cast.map(c => {
            const char = Store.characters.get(c.id);
            return char
              ? {
                  id: char.id,
                  name: char.name,
                  image: char.image,
                  focusStyle: mediaFocusToInlineStyle(char.currentFocus)
                }
              : c;
          });
          floatingCastStrip = {
            sceneId: editingScene.id,
            sceneName: editingScene.name,
            cast: updatedCast
          };
        }
      }
    }

    // Prepare slideshows data for sidebar
    const slideshowProgress = Store.getSlideshowProgress();
    const slideshows = Store.getSlideshows().map(s => ({
      id: s.id,
      name: s.name,
      sceneCount: s.scenes.length,
      isPlaying: slideshowProgress?.slideshowId === s.id
    }));

    // Get sequence progress if a sequence is active
    const sequenceProgress = Store.getSequenceProgress();

    // Broadcasting scene data (for global status bar)
    let broadcastingScene = null;
    if (Store.activeSceneId) {
      const scene = Store.scenes.get(Store.activeSceneId);
      if (scene) {
        broadcastingScene = {
          id: scene.id,
          name: scene.name,
          thumbnail: scene.thumbnail
        };
      }
    }

    // Cast-Only Mode data
    const castOnlyProgress = Store.getCastOnlyProgress();
    const castOnlyCharacters = Store.characters.contents.map(c => ({
      id: c.id,
      name: c.name,
      image: c.image,
      focusStyle: mediaFocusToInlineStyle(c.currentFocus),
      selected: this.uiState.castOnlySelectedChars.has(c.id)
    })).sort((a, b) => a.name.localeCompare(b.name));

    let canAddCurrentFolderToCast = false;
    let currentCharacterFolderAddCount = 0;
    const currentCharacterFolder = activeTab === 'characters' ? currentFolder : null;
    const castTargetScene = floatingCastStrip
      ? Store.scenes.get(floatingCastStrip.sceneId)
      : selectedItem?.type === 'scene'
        ? Store.scenes.get(selectedItem.id)
        : null;

    if (currentCharacterFolder?.type === 'character' && castTargetScene) {
      const castIds = new Set(castTargetScene.cast.map(c => c.id));
      currentCharacterFolderAddCount = Store.getItemsInFolderTree('character', currentCharacterFolder.id)
        .filter(character => !castIds.has(character.id))
        .length;
      canAddCurrentFolderToCast = currentCharacterFolderAddCount > 0;
    }

    return {
      currentView: this.uiState.currentView,
      searchQuery: this.uiState.searchQuery,
      items: items,
      selectedId: this.uiState.selectedId,
      selectedItem: selectedItem,
      inspectorOpen: this.uiState.inspectorOpen && !!selectedItem,
      activeTab: activeTab,
      activeTags: Array.from(this.uiState.activeTags),
      excludedTags: Array.from(this.uiState.excludedTags),
      activeSceneId: Store.activeSceneId,
      emotionPicker: pickerContext,
      viewMode: this.uiState.viewMode,
      animatedPreviews: this.uiState.animatedPreviews,
      counts: counts,
      hasFilters: hasFilters,
      // Novas variáveis para ordenação e busca
      sortBy: this.uiState.sortBy,
      sortAscending: this.uiState.sortAscending,
      sortMenuOpen: this.uiState.sortMenuOpen,
      sortLabel: this._searchSortManager.getSortLabel(),
      customSortActive: this.uiState.sortBy === 'custom' &&
        !isFavorites &&
        this.uiState.currentFolderId === null,
      isSearching: this.uiState.isSearching,
      // Folder navigation
      folders: folders,
      currentFolderId: this.uiState.currentFolderId,
      currentFolder: currentFolder,
      selectedCount,
      showSelectionSummary: selectedCount > 1,
      selectionCountLabel,
      selectionHint: localize('GMPanel.MultiSelectHint'),
      canAddCurrentFolderToCast,
      currentCharacterFolderAddCount,
      folderPath: folderPath,
      isInFolder: this.uiState.currentFolderId !== null,
      isFavorites: isFavorites,
      // Floating Cast Strip
      floatingCastStrip: floatingCastStrip,
      // Slideshows
      slideshows: slideshows,
      slideshowProgress: slideshowProgress,
      // Scene Sequence
      sequenceProgress: sequenceProgress,
      // Cast-Only Mode
      castOnlyProgress: castOnlyProgress,
      castOnlyCharacters: castOnlyCharacters,
      castOnlySelectedCount: this.uiState.castOnlySelectedChars.size,
      slideshowDropdownOpen: this.uiState.slideshowDropdownOpen,
      castOnlyDropdownOpen: this.uiState.castOnlyDropdownOpen,
      shortcutsOpen: this.uiState.shortcutsOpen,
      shortcutButtonLabel: resolveShortcutText('Shortcuts.Button', 'Shortcuts'),
      shortcutDialogTitle: resolveShortcutText('Shortcuts.Title', 'Keyboard Shortcuts'),
      shortcutDialogHint: resolveShortcutText(
        'Shortcuts.RebindHint',
        'Global shortcuts can be changed in Foundry\'s Configure Controls.'
      ),
      shortcutGroups: buildShortcutReference(CONFIG.MODULE_ID, {
        isGM: game.user.isGM,
        context: 'gm-panel'
      }),
      // Broadcasting status bar
      broadcastingScene: broadcastingScene
    };
  }

  static _renderOpenInstance() {
    if (this._instance?.rendered) {
      this._instance.render();
    }
  }

  static async _fadeOutCurrentSceneAudio(sceneId = Store.activeSceneId) {
    if (!sceneId) return;

    const scene = Store.scenes.get(sceneId);
    if (!scene?.audio?.stopOnEnd) return;

    const fadeDuration = scene.audio.fadeOut ?? 0;
    await NarratorJukeboxIntegration.fadeOutAndStop(fadeDuration);
  }

  static async broadcastSceneById(sceneId) {
    if (!sceneId) return false;

    const skipPreview = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.SKIP_PREVIEW_MODE);

    if (skipPreview) {
      Store.setActiveScene(sceneId);
      SocketHandler.emitBroadcastScene(sceneId);
      ui.notifications.info(localize('Notifications.BroadcastStarted'));

      const scene = Store.scenes.get(sceneId);
      if (scene?.hasAudio) {
        await NarratorJukeboxIntegration.playSceneAudio(scene);
      }
    } else {
      import('./PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
        ExaltedScenesPlayerView.activatePreview(sceneId, 'scene');
        ui.notifications.info(localize('Notifications.PreviewModeOpened'));
      }).catch(e => console.error('Exalted Scenes | Failed to load PlayerView:', e));
    }

    this._renderOpenInstance();
    return true;
  }

  static async stopLiveOutput() {
    if (Store.castOnlyState.isActive) {
      Store.stopCastOnly();
      ui.notifications.info(localize('Notifications.CastOnlyStopped'));
      this._renderOpenInstance();
      return true;
    }

    if (Store.slideshowState.isPlaying) {
      Store.stopSlideshow();
      ui.notifications.info(localize('Notifications.SlideshowStopped'));
      this._renderOpenInstance();
      return true;
    }

    if (Store.sequenceState.isActive) {
      Store.stopSequence();
      ui.notifications.info(localize('Notifications.BroadcastStopped'));
      this._renderOpenInstance();
      return true;
    }

    if (Store.activeSceneId) {
      await this._fadeOutCurrentSceneAudio(Store.activeSceneId);
      Store.clearActiveScene();
      SocketHandler.emitStopBroadcast();
      ui.notifications.info(localize('Notifications.BroadcastStopped'));
      this._renderOpenInstance();
      return true;
    }

    return false;
  }

  static toggleSlideshowPause() {
    if (!Store.slideshowState.isPlaying) return false;

    if (Store.slideshowState.isPaused) {
      Store.resumeSlideshow();
    } else {
      Store.pauseSlideshow();
    }

    this._renderOpenInstance();
    return true;
  }

  static navigateLiveStep(direction = 1) {
    if (Store.slideshowState.isPlaying) {
      if (direction < 0) {
        Store.previousScene();
      } else {
        Store.nextScene();
      }
      this._renderOpenInstance();
      return true;
    }

    if (Store.sequenceState.isActive) {
      if (direction < 0) {
        Store.sequencePrevious();
      } else {
        Store.sequenceNext();
      }
      this._renderOpenInstance();
      return true;
    }

    return false;
  }

  static async openLiveView() {
    return import('./PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
      if (Store.castOnlyState.isActive) {
        ExaltedScenesPlayerView.activateCastOnly(
          Store.castOnlyState.characterIds,
          Store.castOnlyState.layoutSettings
        );
        return true;
      }

      if (Store.sequenceState.isActive) {
        const scene = Store.scenes.get(Store.sequenceState.sceneId);
        const background = scene?.sequenceBackgrounds?.[Store.sequenceState.currentIndex];
        if (!scene || !background) return false;

        ExaltedScenesPlayerView.activateSequence(
          scene.id,
          background,
          Store.sequenceState.transitionType,
          Store.sequenceState.transitionDuration
        );
        return true;
      }

      if (Store.slideshowState.isPlaying) {
        const currentStep = Store.slideshowState.sequence[Store.slideshowState.currentIndex];
        if (!currentStep) return false;

        ExaltedScenesPlayerView.setSlideshowMode(
          true,
          Store.slideshowState.cinematicMode,
          Store.slideshowState.cast,
          Store.slideshowState.backgroundMotion || 'none'
        );
        ExaltedScenesPlayerView.activateWithTransition(
          currentStep.sceneId,
          Store.slideshowState.transitionType,
          Store.slideshowState.transitionDuration,
          currentStep.duration
        );
        ExaltedScenesPlayerView.setSlideshowPaused(Store.slideshowState.isPaused);
        return true;
      }

      if (Store.activeSceneId) {
        ExaltedScenesPlayerView.activate(Store.activeSceneId);
        return true;
      }

      return false;
    }).catch(e => {
      console.error('Exalted Scenes | Failed to load PlayerView:', e);
      return false;
    });
  }

  static toggleShortcutHelp(forceOpen = null) {
    if (!game.user.isGM) return false;

    if (!this._instance) {
      this._instance = new ExaltedScenesGMPanel();
    }

    const nextState = forceOpen ?? !this._instance.uiState.shortcutsOpen;
    this._instance.uiState.shortcutsOpen = nextState;
    this._instance.uiState.sortMenuOpen = false;
    this._instance.render(true);
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onViewChange(event, target) {
    this.uiState.currentView = target.dataset.view;
    // Reset folder navigation when changing views
    this.uiState.currentFolderId = null;
    this.clearCardSelection();
    this.render();
  }

  static _onSelectLegacy(event, target) {
    // If clicking a tag, don't select the card
    if (event.target.closest('.es-tag-badge')) return;

    const id = target.dataset.id;
    const type = target.dataset.type;

    if (this.uiState.selectedId === id) {
      // Toggle inspector if clicking same item
      this.uiState.inspectorOpen = !this.uiState.inspectorOpen;
    } else {
      this.uiState.selectedId = id;
      this.uiState.inspectorOpen = true;
    }

    // Se é uma cena, setar como cena em edição para o floating cast strip
    if (type === 'scene') {
      this.uiState.editingSceneId = id;
    }

    this.render();
  }

  static _onSelectCard(event, target) {
    if (event.target.closest('.es-tag-badge')) return;

    const id = target.dataset.id;
    const type = target.dataset.type;
    if (!id || !type) return;

    const isModifierSelection = event.ctrlKey || event.metaKey;
    const isRangeSelection = event.shiftKey;

    if (isRangeSelection) {
      const visibleIds = this.getVisibleLibraryCardIds(type);
      const anchorId = this.uiState.selectionAnchorId && visibleIds.includes(this.uiState.selectionAnchorId)
        ? this.uiState.selectionAnchorId
        : (this.uiState.selectedId && visibleIds.includes(this.uiState.selectedId)
          ? this.uiState.selectedId
          : id);
      const anchorIndex = visibleIds.indexOf(anchorId);
      const targetIndex = visibleIds.indexOf(id);

      if (anchorIndex === -1 || targetIndex === -1) {
        this.setSingleCardSelection(id);
      } else {
        const [start, end] = anchorIndex < targetIndex
          ? [anchorIndex, targetIndex]
          : [targetIndex, anchorIndex];
        const rangeIds = visibleIds.slice(start, end + 1);
        const nextSelectedIds = isModifierSelection
          ? new Set(this.uiState.selectedIds)
          : new Set();

        for (const rangeId of rangeIds) {
          nextSelectedIds.add(rangeId);
        }

        this.uiState.selectedIds = nextSelectedIds;
        this.uiState.selectionAnchorId = anchorId;
        this.uiState.selectedId = id;
        this.uiState.inspectorOpen = nextSelectedIds.size === 1;
      }
    } else if (isModifierSelection) {
      const nextSelectedIds = new Set(this.uiState.selectedIds);
      if (nextSelectedIds.has(id)) {
        nextSelectedIds.delete(id);
      } else {
        nextSelectedIds.add(id);
      }

      this.uiState.selectedIds = nextSelectedIds;
      this.uiState.selectionAnchorId = id;

      if (!nextSelectedIds.size) {
        this.uiState.selectedId = null;
        this.uiState.inspectorOpen = false;
      } else {
        this.uiState.selectedId = id;
        this.uiState.inspectorOpen = nextSelectedIds.size === 1;
      }
    } else if (
      this.uiState.selectedIds.size === 1 &&
      this.uiState.selectedIds.has(id) &&
      this.uiState.selectedId === id
    ) {
      this.uiState.inspectorOpen = !this.uiState.inspectorOpen;
    } else {
      this.setSingleCardSelection(id);
    }

    if (this.uiState.selectedId && !this.uiState.selectedIds.has(this.uiState.selectedId)) {
      this.uiState.selectedId = this.uiState.selectedIds.size
        ? Array.from(this.uiState.selectedIds)[0]
        : null;
    }

    if (type === 'scene') {
      this.uiState.editingSceneId = id;
    }

    this.render();
  }

  static _onCloseInspector() {
    this.uiState.inspectorOpen = false;
    // DOM-only: remove inspector and update layout class without full re-render
    const layout = this.element.querySelector('.es-layout');
    if (layout) layout.classList.remove('with-inspector');
    const inspector = this.element.querySelector('.es-inspector');
    if (inspector) inspector.remove();
  }

  // --- TAG FILTERS ---

  static _onFilterTag(event, target) {
    const tag = target.dataset.tag;
    if (event.shiftKey) {
      // Shift+Click to Exclude
      this.uiState.excludedTags.add(tag);
      this.uiState.activeTags.delete(tag); // Can't be both
    } else {
      // Click to Include
      this.uiState.activeTags.add(tag);
      this.uiState.excludedTags.delete(tag);
    }
    this.clearCardSelection();
    this.render();
  }

  static _onRemoveFilter(event, target) {
    const tag = target.dataset.tag;
    const type = target.dataset.type; // 'include' or 'exclude'
    
    if (type === 'exclude') {
      this.uiState.excludedTags.delete(tag);
    } else {
      this.uiState.activeTags.delete(tag);
    }
    this.clearCardSelection();
    this.render();
  }

  static _onExcludeTag(event, target) {
    const tag = target.dataset.tag;
    this.uiState.excludedTags.add(tag);
    this.uiState.activeTags.delete(tag);
    this.clearCardSelection();
    this.render();
  }

  static async _onBroadcast(event, target) {
    // Permitir broadcast direto do card ou do inspector
    const card = target.closest('.es-card');
    const sceneId = card ? card.dataset.id : this.uiState.selectedId;

    if (!sceneId) return;
    await this.constructor.broadcastSceneById(sceneId);
  }

  static async _onStopBroadcast(event, target) {
    await this.constructor.stopLiveOutput();
  }

  static _onSelectBroadcasting(event, target) {
    const id = target.dataset.id;
    if (!id) return;

    // Switch to scenes view if not already there
    if (!this.uiState.currentView.startsWith('scenes')) {
      this.uiState.currentView = 'scenes-all';
    }

    // Select the broadcasting scene and open inspector
    this.setSingleCardSelection(id);
    this.render();
  }

  static _onViewPlayerPanel(event, target) {
    this.constructor.openLiveView().then((opened) => {
      if (!opened) {
        ui.notifications.warn(localize('Notifications.WarnNoSceneActive'));
      }
    });
  }

  static _onToggleShortcuts(event, target) {
    this.constructor.toggleShortcutHelp();
  }

  static async _onAddCast(event, target) {
    this._castManager.handleAddCast();
  }

  static _onAddCurrentFolderCast(event, target) {
    this._castManager.handleAddCurrentFolderToCast(target.dataset.sceneId);
  }

  static _onCastClick(event, target) {
    this._castManager.handleCastClick(target);
  }

  static _onClosePicker(event, target) {
    this._emotionPickerManager.handleClosePicker();
  }

  static _onRemoveCast(event, target) {
    this._castManager.handleRemoveCast();
  }

  static _onSelectEmotion(event, target) {
    this._emotionPickerManager.handleSelectEmotion(target);
  }

  static _onChangeEmotion(event, target) {
    this._emotionPickerManager.handleChangeEmotion(target);
  }

  static async _onCreate(event, target) {
    // Determine type based on active tab (which we can infer from currentView)
    const isScene = this.uiState.currentView.startsWith('scenes');
    const createOptions = {
      folderId: this.uiState.currentFolderId
    };

    if (isScene) {
      // Open Scene Editor in create mode (no sceneId = create mode)
      new SceneEditor(null, createOptions).render(true);
    } else {
      // Create Character Logic
      new SmartCreator(createOptions).render(true);
    }
  }

  static async _onImportActors() {
    if (!this.uiState.currentView.startsWith('characters')) {
      return;
    }

    const folder = this.uiState.currentFolderId
      ? Store.folders.get(this.uiState.currentFolderId)
      : null;

    new ActorCharacterImporter({
      folderId: this.uiState.currentFolderId,
      folderName: folder?.name || ''
    }).render(true);
  }

  static async _onImportScenes() {
    if (!this.uiState.currentView.startsWith('scenes')) {
      return;
    }

    const folder = this.uiState.currentFolderId
      ? Store.folders.get(this.uiState.currentFolderId)
      : null;

    new SceneBulkImporter({
      folderId: this.uiState.currentFolderId,
      folderName: folder?.name || ''
    }).render(true);
  }

  static async _onEdit(event, target) {
    const card = target.closest('.es-card');
    const id = target.dataset.id || card?.dataset.id || this.uiState.selectedId;
    const type = target.dataset.type || card?.dataset.type || (this.uiState.currentView.startsWith('scenes') ? 'scene' : 'character');

    if (!id || !type) return;

    if (type === 'character') {
      new CharacterEditor(id).render(true);
      return;
    }

    // Scene Edit Logic
    if (type === 'scene') {
      new SceneEditor(id).render(true);
      return;
    }
  }

  static async _onDuplicate(event, target) {
    const card = target.closest('.es-card');
    const id = target.dataset.id || card?.dataset.id || this.uiState.selectedId;
    const type = target.dataset.type || card?.dataset.type || (this.uiState.currentView.startsWith('scenes') ? 'scene' : 'character');

    if (!id || !type) return;

    const duplicate = type === 'scene'
      ? Store.duplicateScene(id)
      : Store.duplicateCharacter(id);

    if (!duplicate) return;

    this.uiState.selectedId = duplicate.id;
    this.uiState.inspectorOpen = true;
    if (type === 'scene') {
      this.uiState.editingSceneId = duplicate.id;
    }

    ui.notifications.info(format('Notifications.ItemDuplicatedName', { name: duplicate.name }));
    this.render();
  }

  static async _onDelete(event, target) {
    const card = target.closest('.es-card');
    const id = card.dataset.id;
    const type = card.dataset.type;
    const item = type === 'scene' ? Store.scenes.get(id) : Store.characters.get(id);
    const itemName = item?.name || 'this item';
    const typeLabel = type === 'scene' ? 'scene' : 'character';

    // Confirmation dialog
    const confirmed = await ExaltedScenesDialog.confirm({
      title: format('Dialog.DeleteItem.Title', { type: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) }),
      content: format('Dialog.DeleteItem.Content', { name: itemName }),
      tone: 'danger',
      confirmLabel: localize('Common.Delete')
    });

    if (!confirmed) return;

    // Delete the item
    Store.deleteItem(id, type);

    // Clear selection if we deleted the selected item
    if (this.uiState.selectedId === id) {
      this.uiState.selectedId = null;
      this.uiState.inspectorOpen = false;
    }

    ui.notifications.info(format('Notifications.ItemDeleted', { type: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1), name: itemName }));
    this.render();
  }

  static _onToggleView(event, target) {
    this.uiState.viewMode = this.uiState.viewMode === 'grid' ? 'list' : 'grid';
    this.render();
  }

  static _onToggleAnimatedPreviews(event, target) {
    this.uiState.animatedPreviews = !this.uiState.animatedPreviews;
    this._updateVideoPreviewPlayback();
    // Update toggle button active state without full re-render
    const btn = this.element.querySelector('[data-action="toggle-animated-previews"]');
    if (btn) btn.classList.toggle('active', this.uiState.animatedPreviews);
  }

  static _onQuickAdd(event, target) {
    const card = target.closest('.es-card');
    const charId = card ? card.dataset.id : this.uiState.selectedId;
    const sceneId = Store.activeSceneId;

    if (!sceneId) {
      ui.notifications.warn(localize('Notifications.WarnNoActiveScene'));
      return;
    }

    if (!charId) {
      ui.notifications.warn(localize('Notifications.WarnNoCharacterSelected'));
      return;
    }

    Store.addCastMember(sceneId, charId);
    ui.notifications.info(localize('Notifications.CharacterAddedToActiveScene'));
  }

  // --- FAVORITES ---

  static _onToggleFavorite(event, target) {
    event.stopPropagation(); // Prevent card selection

    const id = target.dataset.id;
    const type = target.dataset.type;

    if (type === 'scene') {
      const scene = Store.scenes.get(id);
      if (scene) {
        scene.favorite = !scene.favorite;
        Store.saveData();
        const action = scene.favorite ? 'added to' : 'removed from';
        ui.notifications.info(format('Notifications.FavoritesToggle', { type: localize('Nav.Scenes'), action }));
      }
    } else {
      const character = Store.characters.get(id);
      if (character) {
        character.favorite = !character.favorite;
        Store.saveData();
        const action = character.favorite ? 'added to' : 'removed from';
        ui.notifications.info(format('Notifications.FavoritesToggle', { type: localize('Nav.Characters'), action }));
      }
    }

    // In favorites view, full render is needed to remove unfavorited items from the list
    if (this.uiState.currentView.includes('favorites')) {
      this.render();
      return;
    }

    // Otherwise, DOM-only updates — toggle star icons and update sidebar counts
    const card = this.element.querySelector(`.es-card[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.es-favorite-btn');
      if (btn) {
        btn.classList.toggle('es-favorite-btn--active');
        const icon = btn.querySelector('i');
        if (icon) { icon.classList.toggle('fas'); icon.classList.toggle('far'); }
      }
    }
    if (this.uiState.selectedId === id) {
      const inspectorBtn = this.element.querySelector('.es-favorite-toggle');
      if (inspectorBtn) {
        inspectorBtn.classList.toggle('es-favorite-toggle--active');
        const icon = inspectorBtn.querySelector('i');
        if (icon) { icon.classList.toggle('fas'); icon.classList.toggle('far'); }
      }
    }
    const sceneFavEl = this.element.querySelector('[data-view="scenes-favorites"] .es-nav-count');
    const charFavEl = this.element.querySelector('[data-view="characters-favorites"] .es-nav-count');
    if (sceneFavEl) sceneFavEl.textContent = Store.scenes.filter(s => s.favorite).length;
    if (charFavEl) charFavEl.textContent = Store.characters.filter(c => c.favorite).length;
  }

  // --- ORDENAÇÃO (delegado ao SearchSortManager) ---

  static _onToggleSort(event, target) {
    this._searchSortManager.toggleSortMenu();
  }

  static _onSort(event, target) {
    const sortBy = target.dataset.sort;
    this._searchSortManager.setSortType(sortBy);
  }

  static _onToggleSortDirection(event, target) {
    this._searchSortManager.toggleSortDirection();
  }

  static _onClearSearch(event, target) {
    this._searchSortManager.clearSearch();
  }

  // --- FOLDER NAVIGATION (delegado ao FolderManager) ---

  static _onOpenFolder(event, target) {
    this._folderManager.handleOpenFolder(target);
  }

  static _onNavigateUp(event, target) {
    this._folderManager.handleNavigateUp();
  }

  static async _onCreateFolder(event, target) {
    this._folderManager.handleCreateFolder();
  }

  static _onToggleFolder(event, target) {
    this._folderManager.handleToggleFolder(event, target);
  }

  static async _onDeleteFolder(event, target) {
    this._folderManager.handleDeleteFolder(event, target);
  }

  static async _onRenameFolder(event, target) {
    this._folderManager.handleRenameFolder(event, target);
  }

  // --- FLOATING CAST STRIP ---

  static _onGoToScene(event, target) {
    this._castManager.handleGoToScene(target);
  }

  static _onCloseFloatingCast(event, target) {
    this._castManager.handleCloseFloatingCast();
  }

  static async _onFloatingAddCast(event, target) {
    this._castManager.handleFloatingAddCast();
  }

  // --- EMOTION PICKER ---

  static _onToggleEmotionFavorite(event, target) {
    this._emotionPickerManager.handleToggleEmotionFavorite(event, target);
  }

  static _onOpenActorSheet(event, target) {
    const charId = target.dataset.characterId || this.uiState.emotionPicker.characterId || this.uiState.selectedId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    if (!character?.actorId) {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
      return;
    }

    const actor = game.actors.get(character.actorId);
    if (actor) {
      actor.sheet.render(true);
    } else {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
    }
  }

  static _onSetCharacterEmotion(event, target) {
    const charId = target.dataset.characterId || this.uiState.selectedId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);
    if (!character || !state || !character.states[state]) return;

    character.currentState = state;
    Store.saveData();
    SocketHandler.emitUpdateEmotion(charId, state);
    this.render();
  }

  static _onSetCharacterHeroPose(event, target) {
    const charId = target.dataset.characterId || this.uiState.selectedId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);
    if (!character || !state || !character.heroStates[state]) return;

    character.currentHeroState = state;
    Store.saveData();
    SocketHandler.emitUpdateEmotion(charId, state, true);
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW ACTIONS (delegado ao SlideshowManager)
     ═══════════════════════════════════════════════════════════════ */

  static _onToggleSlideshowDropdown(event, target) {
    this._slideshowManager.handleToggleDropdown();
  }

  static _onCreateSlideshow(event, target) {
    this._slideshowManager.handleCreateSlideshow();
  }

  static _onEditSlideshow(event, target) {
    this._slideshowManager.handleEditSlideshow(target);
  }

  static _onPlaySlideshow(event, target) {
    this._slideshowManager.handlePlaySlideshow(target);
  }

  static async _onDeleteSlideshow(event, target) {
    this._slideshowManager.handleDeleteSlideshow(target);
  }

  static _onSlideshowPause(event, target) {
    this._slideshowManager.handleSlideshowPause();
  }

  static _onSlideshowResume(event, target) {
    this._slideshowManager.handleSlideshowResume();
  }

  static _onSlideshowNext(event, target) {
    this._slideshowManager.handleSlideshowNext();
  }

  static _onSlideshowPrev(event, target) {
    this._slideshowManager.handleSlideshowPrev();
  }

  static _onSlideshowStop(event, target) {
    this._slideshowManager.handleSlideshowStop();
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE ACTIONS (delegado ao SequenceManager)
     ═══════════════════════════════════════════════════════════════ */

  static _onConvertToSequence(event, target) {
    this._sequenceManager.handleConvertToSequence();
  }

  static _onRemoveSequence(event, target) {
    this._sequenceManager.handleRemoveSequence();
  }

  static async _onAddSequenceBg(event, target) {
    this._sequenceManager.handleAddSequenceBg();
  }

  static _onRemoveSequenceBg(event, target) {
    this._sequenceManager.handleRemoveSequenceBg(event, target);
  }

  static _onSequenceGoto(event, target) {
    this._sequenceManager.handleSequenceGoto(target);
  }

  static _onBroadcastSequence(event, target) {
    this._sequenceManager.handleBroadcastSequence();
  }

  static _onSequencePrev(event, target) {
    this._sequenceManager.handleSequencePrev();
  }

  static _onSequenceNext(event, target) {
    this._sequenceManager.handleSequenceNext();
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE ACTIONS (delegado ao CastOnlyManager)
     ═══════════════════════════════════════════════════════════════ */

  static _onToggleCastOnlyDropdown(event, target) {
    this._castOnlyManager.handleToggleDropdown();
  }

  static _onToggleCastOnlyChar(event, target) {
    this._castOnlyManager.handleToggleCastOnlyChar(target);
  }

  static _onCastOnlyStart(event, target) {
    this._castOnlyManager.handleCastOnlyStart();
  }

  static _onCastOnlyStop(event, target) {
    this._castOnlyManager.handleCastOnlyStop();
  }

  static _onCastOnlyLayout(event, target) {
    this._castOnlyManager.handleCastOnlyLayout(target);
  }

  /* ═══════════════════════════════════════════════════════════════
     INLINE RENAME
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts inline rename on a card. Replaces the title text with an input field.
   * Used by context menu "Rename" and double-click on card title.
   * @param {HTMLElement} cardEl - The .es-card element
   */
  startInlineRename(cardEl) {
    const id = cardEl.dataset.id;
    const type = cardEl.dataset.type;
    const item = type === 'scene' ? Store.scenes.get(id) : Store.characters.get(id);
    if (!item) return;

    // Find the best title element: card-body title if visible, otherwise overlay title
    const bodyTitle = cardEl.querySelector('.es-card-body .es-card-title');
    const overlayTitle = cardEl.querySelector('.es-card-info-overlay .es-card-title');
    const isBodyVisible = bodyTitle && bodyTitle.offsetParent !== null;
    const title = isBodyVisible ? bodyTitle : overlayTitle;
    if (!title) return;

    // Don't start rename if already editing
    if (title.querySelector('.es-inline-rename')) return;

    // Keep overlay visible while renaming (prevents hide on mouseout in grid view)
    cardEl.classList.add('es-card--renaming');

    const originalName = item.name;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'es-inline-rename';
    input.value = originalName;
    title.textContent = '';
    title.appendChild(input);
    input.select();
    input.focus();

    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const newName = input.value.trim();
      if (newName && newName !== originalName) {
        item.name = newName;
        Store.saveData();
        this._updateCardTitles(cardEl, newName);
      } else {
        this._updateCardTitles(cardEl, originalName);
      }
      cardEl.classList.remove('es-card--renaming');
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      this._updateCardTitles(cardEl, originalName);
      cardEl.classList.remove('es-card--renaming');
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.removeEventListener('blur', commit);
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.removeEventListener('blur', commit);
        cancel();
      }
      // Stop propagation to prevent keyboard shortcuts from firing
      e.stopPropagation();
    });

    input.addEventListener('blur', commit, { once: true });

    // Prevent the click from selecting the card
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  /**
   * Updates all title text elements in a card after rename.
   * @param {HTMLElement} cardEl - The card element
   * @param {string} name - The new name
   * @private
   */
  _updateCardTitles(cardEl, name) {
    const titles = cardEl.querySelectorAll('.es-card-title');
    for (const t of titles) {
      t.textContent = name;
    }
    // Update title attribute on card-body title
    const bodyTitle = cardEl.querySelector('.es-card-body .es-card-title');
    if (bodyTitle) bodyTitle.title = name;
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Singleton instance of the GM Panel.
   * @type {ExaltedScenesGMPanel|null}
   * @private
   */
  static _instance = null;

  /**
   * Shows the GM Panel. Creates a new instance if one doesn't exist.
   * @static
   */
  static show() {
    if (!this._instance) {
      this._instance = new ExaltedScenesGMPanel();
    }
    this._instance.render(true);
  }
}
