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
import { localize, format } from '../utils/i18n.js';

// GMPanel Managers (modular components)
import { DragDropManager, KeyboardManager, ContextMenuManager, SearchSortManager, CastManager, EmotionPickerManager, FolderManager, SlideshowManager, SequenceManager, CastOnlyManager } from './gm-panel/index.js';

import { SocketHandler } from '../data/SocketHandler.js';
import { SmartCreator } from './SmartCreator.js';
import { CharacterEditor } from './CharacterEditor.js';
import { SceneEditor } from './SceneEditor.js';

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
      inspectorOpen: false,
      activeTags: new Set(),
      excludedTags: new Set(),
      activeSceneId: Store.activeSceneId,
      emotionPicker: { open: false, characterId: null, x: 0, y: 0 },
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
      animatedPreviews: false
    };

    // Initialize managers (modular components)
    this._managers = [
      new DragDropManager(this),
      new KeyboardManager(this),
      new ContextMenuManager(this),
      new SearchSortManager(this),
      new CastManager(this),
      new EmotionPickerManager(this),
      new FolderManager(this),
      new SlideshowManager(this),
      new SequenceManager(this),
      new CastOnlyManager(this)
    ];

    // Store references to managers for helper method access
    this._searchSortManager = this._managers[3];
    this._castManager = this._managers[4];
    this._emotionPickerManager = this._managers[5];
    this._folderManager = this._managers[6];
    this._slideshowManager = this._managers[7];
    this._sequenceManager = this._managers[8];
    this._castOnlyManager = this._managers[9];
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
      select: ExaltedScenesGMPanel._onSelect,
      'close-inspector': ExaltedScenesGMPanel._onCloseInspector,
      broadcast: ExaltedScenesGMPanel._onBroadcast,
      'stop-broadcast': ExaltedScenesGMPanel._onStopBroadcast,
      'add-cast': ExaltedScenesGMPanel._onAddCast,
      'change-emotion': ExaltedScenesGMPanel._onChangeEmotion,
      'cast-click': ExaltedScenesGMPanel._onCastClick,
      'select-emotion': ExaltedScenesGMPanel._onSelectEmotion,
      'close-picker': ExaltedScenesGMPanel._onClosePicker,
      'remove-cast': ExaltedScenesGMPanel._onRemoveCast,
      create: ExaltedScenesGMPanel._onCreate,
      edit: ExaltedScenesGMPanel._onEdit,
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
      // Slideshow actions
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

    // Setup all managers (cleanup is handled by AbortController in each manager)
    for (const manager of this._managers) {
      manager.cleanup(); // Clean up previous listeners before setting up new ones
      manager.setup(this.element);
    }

    // Note: Sequence settings event listeners are now handled by SequenceManager.setup()
    // Emotion picker setup is delegated to EmotionPickerManager

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

  async _prepareContext(options) {
    const activeTab = this.uiState.currentView.startsWith('scenes') ? 'scenes' : 'characters';
    const itemType = activeTab === 'scenes' ? 'scene' : 'character';
    const isFavorites = this.uiState.currentView.includes('favorites');
    const isSearching = this.uiState.searchQuery.length > 0;
    const hasTagFilters = this.uiState.activeTags.size > 0 || this.uiState.excludedTags.size > 0;

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

    // Transform for Handlebars (if needed, or use models directly)
    items = items.map(i => {
      const folder = i.folder ? Store.folders.get(i.folder) : null;
      return {
        ...i.toJSON(),
        thumbnail: i.thumbnail,
        image: i.image,
        folderName: folder ? folder.name : '',
        // Audio indicator for scenes
        hasAudio: i.hasAudio || false
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

    // Encontrar selectedItem diretamente do Store para garantir dados atualizados
    let selectedItem = null;
    if (this.uiState.selectedId) {
      if (this.uiState.currentView.startsWith('scenes')) {
        const scene = Store.scenes.get(this.uiState.selectedId);
        if (scene) {
          // Atualizar imagens do cast com estado atual
          const updatedCast = scene.cast.map(c => {
            const char = Store.characters.get(c.id);
            return char ? { id: char.id, name: char.name, image: char.image } : c;
          });
          selectedItem = { ...scene.toJSON(), cast: updatedCast, image: scene.image, thumbnail: scene.thumbnail };
        }
      } else {
        const char = Store.characters.get(this.uiState.selectedId);
        if (char) {
          selectedItem = { ...char.toJSON(), image: char.image, thumbnail: char.thumbnail };
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
          emotionSearchQuery: this.uiState.emotionSearchQuery || '',
          linkedActor: linkedActor
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
            return char ? { id: char.id, name: char.name, image: char.image } : c;
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
      selected: this.uiState.castOnlySelectedChars.has(c.id)
    })).sort((a, b) => a.name.localeCompare(b.name));

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
      isSearching: this.uiState.isSearching,
      // Folder navigation
      folders: folders,
      currentFolderId: this.uiState.currentFolderId,
      currentFolder: currentFolder,
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
      // Broadcasting status bar
      broadcastingScene: broadcastingScene
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onViewChange(event, target) {
    this.uiState.currentView = target.dataset.view;
    // Reset folder navigation when changing views
    this.uiState.currentFolderId = null;
    this.uiState.selectedId = null;
    this.uiState.inspectorOpen = false;
    this.render();
  }

  static _onSelect(event, target) {
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

  static _onCloseInspector() {
    this.uiState.inspectorOpen = false;
    this.render();
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
    this.render();
  }

  static _onExcludeTag(event, target) {
    const tag = target.dataset.tag;
    this.uiState.excludedTags.add(tag);
    this.uiState.activeTags.delete(tag);
    this.render();
  }

  static async _onBroadcast(event, target) {
    // Permitir broadcast direto do card ou do inspector
    const card = target.closest('.es-card');
    const sceneId = card ? card.dataset.id : this.uiState.selectedId;

    if (!sceneId) return;

    // Check if we should skip preview mode
    const skipPreview = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.SKIP_PREVIEW_MODE);

    if (skipPreview) {
      // Original behavior: broadcast immediately to all players
      Store.setActiveScene(sceneId);
      SocketHandler.emitBroadcastScene(sceneId);
      ui.notifications.info(localize('Notifications.BroadcastStarted'));

      // Trigger Narrator Jukebox audio if configured
      const scene = Store.scenes.get(sceneId);
      if (scene?.hasAudio) {
        await NarratorJukeboxIntegration.playSceneAudio(scene);
      }
    } else {
      // New behavior: open in preview mode (GM only sees it)
      import('./PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
        ExaltedScenesPlayerView.activatePreview(sceneId, 'scene');
        ui.notifications.info(localize('Notifications.PreviewModeOpened'));
      });
    }

    this.render();
  }

  static async _onStopBroadcast(event, target) {
    // Check if current scene has stopOnEnd enabled
    const currentSceneId = Store.activeSceneId;
    if (currentSceneId) {
      const scene = Store.scenes.get(currentSceneId);
      if (scene?.audio?.stopOnEnd) {
        await NarratorJukeboxIntegration.stopAll();
      }
    }

    Store.clearActiveScene();
    SocketHandler.emitStopBroadcast();
    ui.notifications.info(localize('Notifications.BroadcastStopped'));
    this.render();
  }

  static _onSelectBroadcasting(event, target) {
    const id = target.dataset.id;
    if (!id) return;

    // Switch to scenes view if not already there
    if (!this.uiState.currentView.startsWith('scenes')) {
      this.uiState.currentView = 'scenes-all';
    }

    // Select the broadcasting scene and open inspector
    this.uiState.selectedId = id;
    this.uiState.inspectorOpen = true;
    this.render();
  }

  static _onViewPlayerPanel(event, target) {
    // Import and activate the player view with the current broadcasting scene
    import('./PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
      const activeSceneId = Store.activeSceneId;
      if (activeSceneId) {
        ExaltedScenesPlayerView.activate(activeSceneId);
      } else {
        ui.notifications.warn(localize('Notifications.WarnNoSceneActive'));
      }
    });
  }

  static async _onAddCast(event, target) {
    this._castManager.handleAddCast();
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

    if (isScene) {
      // Open Scene Editor in create mode (no sceneId = create mode)
      new SceneEditor().render(true);
    } else {
      // Create Character Logic
      new SmartCreator().render(true);
    }
  }

  static async _onEdit(event, target) {
    const id = target.closest('.es-card').dataset.id;
    const type = target.closest('.es-card').dataset.type;

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

  static async _onDelete(event, target) {
    const card = target.closest('.es-card');
    const id = card.dataset.id;
    const type = card.dataset.type;
    const item = type === 'scene' ? Store.scenes.get(id) : Store.characters.get(id);
    const itemName = item?.name || 'this item';
    const typeLabel = type === 'scene' ? 'scene' : 'character';

    // Confirmation dialog
    const confirmed = await Dialog.confirm({
      title: format('Dialog.DeleteItem.Title', { type: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) }),
      content: format('Dialog.DeleteItem.Content', { name: itemName }),
      yes: () => true,
      no: () => false,
      defaultYes: false
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
    this.render();
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

    this.render();
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
    this._emotionPickerManager.handleOpenActorSheet();
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW ACTIONS (delegado ao SlideshowManager)
     ═══════════════════════════════════════════════════════════════ */

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
