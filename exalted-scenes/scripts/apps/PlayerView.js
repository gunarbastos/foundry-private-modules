/**
 * @file PlayerView.js
 * @description Player-facing view for Exalted Scenes module. Displays broadcasted scenes
 * with cast members, handles emotion/border pickers, and manages transitions between scenes.
 *
 * This file coordinates multiple handlers for specific functionality domains:
 * - TransitionHandler: Scene and background transitions
 * - LayoutCalculator: Cast positioning and Foundry UI offsets
 * - EmotionPickerHandler: Emotion picker for players
 * - BorderPickerHandler: Border style picker
 * - MediaHandler: Video/image handling
 *
 * @module apps/PlayerView
 */

import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { createHandlers, setupHandlers, cleanupHandlers } from './player-view/index.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Player-facing view for broadcasting scenes to players.
 * Displays scene backgrounds, cast members with emotions, and handles
 * user interactions for emotion/border picking.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class ExaltedScenesPlayerView extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Creates a new PlayerView instance.
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);

    /**
     * UI state for the view
     * @type {Object}
     */
    this.uiState = {
      active: false,
      sceneId: null,
      emotionPicker: { open: false, characterId: null, x: 0, y: 0 },
      borderPicker: { open: false, characterId: null, x: 0, y: 0 },
      musicPicker: { open: false, characterId: null, x: 0, y: 0, searchQuery: '' },
      previousSceneId: null,  // Para detectar troca de cena
      isSceneTransition: false, // Flag para controlar animações
      // Slideshow state
      slideshowMode: false,
      cinematicMode: false,
      slideshowPaused: false,
      // Cast-Only Mode state (cast without scene background)
      castOnlyMode: false,
      castOnlyCharacterIds: [],
      castOnlyLayoutSettings: null,
      // Preview Mode state (GM-only local preview before broadcasting)
      previewMode: false,
      previewType: null  // 'scene', 'slideshow', 'sequence', 'cast-only'
    };

    /**
     * Handler instances for delegated functionality
     * @type {Object}
     * @private
     */
    this._handlers = createHandlers(this);
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-player-view',
    classes: ['exalted-scenes'],
    window: {
      frame: false,
      positioned: false,
      controls: []
    },
    position: {
      width: '100%',
      height: '100%',
      top: 0,
      left: 0
    },
    actions: {
      'character-click': ExaltedScenesPlayerView._onCharacterClick,
      'select-emotion': ExaltedScenesPlayerView._onSelectEmotion,
      'close-picker': ExaltedScenesPlayerView._onClosePicker,
      'toggle-emotion-favorite': ExaltedScenesPlayerView._onToggleEmotionFavorite,
      'open-border-picker': ExaltedScenesPlayerView._onOpenBorderPicker,
      'close-border-picker': ExaltedScenesPlayerView._onCloseBorderPicker,
      'back-to-emotions': ExaltedScenesPlayerView._onBackToEmotions,
      'select-border': ExaltedScenesPlayerView._onSelectBorder,
      'remove-from-scene': ExaltedScenesPlayerView._onRemoveFromScene,
      'open-actor-sheet': ExaltedScenesPlayerView._onOpenActorSheet,
      'go-live': ExaltedScenesPlayerView._onGoLive,
      'exit-preview': ExaltedScenesPlayerView._onExitPreview,
      // Audio restore actions
      'restore-playlist': ExaltedScenesPlayerView._onRestorePlaylist,
      'restore-ambience': ExaltedScenesPlayerView._onRestoreAmbience,
      'stop-all-audio': ExaltedScenesPlayerView._onStopAllAudio,
      // Music Request actions
      'open-music-picker': ExaltedScenesPlayerView._onOpenMusicPicker,
      'close-music-picker': ExaltedScenesPlayerView._onCloseMusicPicker,
      'back-to-emotions-from-music': ExaltedScenesPlayerView._onBackToEmotionsFromMusic,
      'request-track': ExaltedScenesPlayerView._onRequestTrack
    }
  };

  static PARTS = {
    main: {
      template: CONFIG.TEMPLATES.PLAYER_VIEW
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Called after the view is rendered.
   * Sets up handlers, calculates UI offsets, and manages animations.
   *
   * @param {Object} context - Render context
   * @param {Object} options - Render options
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);

    // Cleanup previous handlers before setting up new ones
    cleanupHandlers(this._handlers);

    // Setup all handlers with the new element
    // Note: LayoutCalculator.setup() will call setFoundryUIOffsets()
    // Note: MediaHandler.setup() will call ensureVideoPlays()
    setupHandlers(this._handlers, this.element);

    // Note: Scene entrance animations are now handled by TransitionHandler.setup()
    // Note: Emotion picker search/preview is now handled by EmotionPickerHandler.setup()
    // Note: Video autoplay is now handled by MediaHandler.setup()
    // All are called via setupHandlers() above
  }

  async _prepareContext(options) {
    const scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null;

    // Determine which cast to use:
    // - In cast-only mode: use castOnlyCharacterIds to build cast
    // - In slideshow mode: use the fixed slideshowCast (characters persist across all backgrounds)
    // - Otherwise: use the scene's cast
    let castSource;
    if (this.uiState.castOnlyMode && this.uiState.castOnlyCharacterIds) {
      // Build cast from character IDs for cast-only mode
      castSource = this.uiState.castOnlyCharacterIds.map(id => {
        const char = Store.characters.get(id);
        return char ? { id: char.id, name: char.name, image: char.image } : null;
      }).filter(c => c !== null);
    } else if (this.uiState.slideshowMode && this.uiState.slideshowCast) {
      castSource = this.uiState.slideshowCast;
    } else {
      castSource = scene ? scene.cast : [];
    }

    // Prepare cast with current states and border styles
    const cast = castSource.map(charRef => {
      const realChar = Store.characters.get(charRef.id);
      if (realChar) {
        return {
          id: realChar.id,
          name: realChar.name,
          image: realChar.image, // This uses the getter that checks currentState
          borderStyle: realChar.borderStyle || 'gold',
          locked: realChar.locked || false
        };
      }
      return { ...charRef, borderStyle: 'gold', locked: false }; // Fallback
    });

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

        // Check for linked Actor (only show if user can view it)
        let linkedActor = null;
        if (char.actorId) {
          const actor = game.actors.get(char.actorId);
          if (actor && actor.testUserPermission(game.user, "LIMITED")) {
            linkedActor = { id: actor.id, name: actor.name };
          }
        }

        pickerContext = {
          character: char,
          emotions: emotions,
          x: this.uiState.emotionPicker.x,
          y: this.uiState.emotionPicker.y,
          locked: char.locked || false,
          pickerBelow: this.uiState.emotionPicker.pickerBelow || false,
          linkedActor: linkedActor,
          hasMusicPlaylist: !!char.musicPlaylistId
        };
      }
    }

    // Prepare Border Picker Context
    // Delegate to BorderPickerHandler for organizing presets by type
    const borderPickerContext = this._handlers?.borderPicker
      ? this._handlers.borderPicker.prepareBorderPickerContext()
      : null;

    // Prepare Music Picker Context
    let musicPickerContext = null;
    if (this.uiState.musicPicker.open && this.uiState.musicPicker.characterId) {
      const char = Store.characters.get(this.uiState.musicPicker.characterId);
      if (char && char.musicPlaylistId) {
        const tracks = NarratorJukeboxIntegration.getPlaylistTracks(char.musicPlaylistId);
        const playlist = NarratorJukeboxIntegration.getPlaylist(char.musicPlaylistId);

        // Filter tracks by search query
        const searchQuery = this.uiState.musicPicker.searchQuery?.toLowerCase() || '';
        const filteredTracks = searchQuery
          ? tracks.filter(t => t.name.toLowerCase().includes(searchQuery))
          : tracks;

        musicPickerContext = {
          character: char,
          playlistName: playlist?.name || 'Playlist',
          tracks: filteredTracks,
          totalTracks: tracks.length,
          hasSearch: tracks.length > 5,
          x: this.uiState.musicPicker.x,
          y: this.uiState.musicPicker.y,
          pickerBelow: this.uiState.musicPicker.pickerBelow || false
        };
      }
    }

    // Determine the correct background to display
    // If we're in a sequence and have a stored sequence background, use that instead of scene.background
    let background = scene?.background;
    let bgType = scene?.bgType;

    if (this.uiState.sequenceBackground) {
      background = this.uiState.sequenceBackground.path;
      bgType = this.uiState.sequenceBackground.bgType;
    }

    // Prepare layout settings with CSS-ready values
    // Delegate to LayoutCalculator handler
    const layoutContext = this._handlers?.layout
      ? this._handlers.layout.prepareLayoutContext(scene)
      : {
          preset: 'bottom-center',
          size: CONFIG.SIZE_PRESETS[scene?.layoutSettings?.size || 'medium']?.value || CONFIG.SIZE_PRESETS.medium.value,
          spacing: 24,
          offsetX: 0,
          offsetY: 5
        };

    // Determine background fit mode
    // Priority: scene override > global setting > default 'fill'
    let backgroundFitMode = 'fill';
    if (scene?.backgroundFit) {
      backgroundFitMode = scene.backgroundFit;
    } else {
      try {
        const globalFitMode = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.BACKGROUND_FIT_MODE);
        if (globalFitMode) {
          backgroundFitMode = globalFitMode;
        }
      } catch (e) {
        // Setting not registered yet, use default
      }
    }

    // Prepare audio controls context (GM only, when scene has audio)
    let audioControls = null;
    if (game.user.isGM && scene?.hasAudio && NarratorJukeboxIntegration.isAvailable) {
      audioControls = {
        hasPlaylist: scene.hasPlaylist,
        hasAmbience: scene.hasAmbience,
        playlistName: scene.hasPlaylist ? NarratorJukeboxIntegration.getPlaylistName(scene.audio.playlistId) : null,
        ambienceName: scene.hasAmbience ? NarratorJukeboxIntegration.getAmbiencePresetName(scene.audio.ambiencePresetId) : null
      };
    }

    return {
      active: this.uiState.active,
      scene: scene ? {
        ...scene.toJSON(),
        background: background,
        bgType: bgType
      } : null,
      cast: cast,
      isGM: game.user.isGM,
      emotionPicker: pickerContext,
      borderPicker: borderPickerContext,
      musicPicker: musicPickerContext,
      layout: layoutContext,
      // Cast-Only Mode flag
      castOnlyMode: this.uiState.castOnlyMode,
      // Preview Mode flags
      previewMode: this.uiState.previewMode,
      previewType: this.uiState.previewType,
      // Background Fit Mode
      backgroundFitMode: backgroundFitMode,
      // Audio controls (GM only)
      audioControls: audioControls,
      // Cinematic Bars (slideshow letterbox effect)
      cinematicMode: this.uiState.cinematicMode
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onCharacterClick(event, target) {
    const charId = target.dataset.id;
    const character = Store.characters.get(charId);

    // Check if character is locked and user is not GM
    if (character?.locked && !game.user.isGM) {
      ui.notifications.warn(format('Notifications.CharacterLocked', { name: character.name }));
      return;
    }

    // Check permission level (GM always has access)
    if (!game.user.isGM && character) {
      const hasPermission = character.hasPermission(game.user.id, 'emotion');
      if (!hasPermission) {
        ui.notifications.warn(format('Notifications.NoPermissionEdit', { name: character.name }));
        return;
      }
    }

    const rect = target.getBoundingClientRect();

    // Determine if character is near top of screen (picker should appear below)
    // Use 300px threshold - if character is within 300px of top, show picker below
    const showBelow = rect.top < 300;

    // Position picker above or below character depending on position
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: rect.left + (rect.width / 2),
      y: showBelow ? rect.bottom + 20 : rect.top - 20,
      pickerBelow: showBelow
    };
    this.render();
  }

  static _onClosePicker(event, target) {
    this.uiState.emotionPicker.open = false;
    this.render();
  }

  static _onSelectEmotion(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;

    // Emit update to everyone (including GM who will save it)
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
        SocketHandler.emitUpdateEmotion(charId, state);
    });

    this.uiState.emotionPicker.open = false;
    this.render();
  }

  static _onToggleEmotionFavorite(event, target) {
    event.stopPropagation();
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);

    if (character && state) {
      if (character.favoriteEmotions.has(state)) {
        character.favoriteEmotions.delete(state);
      } else {
        character.favoriteEmotions.add(state);
      }
      Store.saveData();
      this.render();
    }
  }

  /**
   * Removes a character from the current scene (GM only).
   * Handles normal scene mode, cast-only mode, and slideshow mode.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onRemoveFromScene(event, target) {
    // Safety check: only GM can remove characters
    if (!game.user.isGM) {
      ui.notifications.warn(localize('Notifications.GMOnlyRemove'));
      return;
    }

    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    const characterName = character?.name || 'Character';

    // Handle different modes
    if (this.uiState.castOnlyMode) {
      // Cast-Only Mode: remove from the character IDs array
      const index = this.uiState.castOnlyCharacterIds.indexOf(charId);
      if (index > -1) {
        this.uiState.castOnlyCharacterIds.splice(index, 1);

        // Emit socket update so all clients see the removal
        import('../data/SocketHandler.js').then(({ SocketHandler }) => {
          SocketHandler.emitCastOnlyUpdate({ characterIds: this.uiState.castOnlyCharacterIds, layoutSettings: this.uiState.castOnlyLayoutSettings });
        });
      }
    } else if (this.uiState.sceneId) {
      // Normal scene mode or slideshow mode: remove from scene cast
      Store.removeCastMember(this.uiState.sceneId, charId);

      // If in slideshow mode, also update the slideshow cast
      if (this.uiState.slideshowMode && this.uiState.slideshowCast) {
        const index = this.uiState.slideshowCast.findIndex(c => c.id === charId);
        if (index > -1) {
          this.uiState.slideshowCast.splice(index, 1);
        }
      }
    }

    // Close picker and refresh
    this.uiState.emotionPicker.open = false;
    this.render();

    ui.notifications.info(format('Notifications.CharacterRemoved', { name: characterName }));
  }

  /**
   * Opens the linked Actor's character sheet.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onOpenActorSheet(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    if (!character?.actorId) return;

    const actor = game.actors.get(character.actorId);
    if (actor) {
      // Check permission before opening
      if (actor.testUserPermission(game.user, "LIMITED")) {
        actor.sheet.render(true);
      } else {
        ui.notifications.warn(localize('Notifications.NoPermissionSheet'));
      }
    } else {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PREVIEW MODE ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Broadcasts the currently previewed scene to all players.
   * Transitions from preview mode to live broadcast.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onGoLive(event, target) {
    if (!game.user.isGM || !this.uiState.previewMode) return;

    const sceneId = this.uiState.sceneId;
    if (!sceneId) return;

    // Exit preview mode
    this.uiState.previewMode = false;
    this.uiState.previewType = null;

    // Now actually broadcast to everyone
    const { SocketHandler } = await import('../data/SocketHandler.js');
    Store.setActiveScene(sceneId);
    SocketHandler.emitBroadcastScene(sceneId);
    ui.notifications.info(localize('Notifications.SceneNowLive'));

    // Trigger Narrator Jukebox audio if configured
    const scene = Store.scenes.get(sceneId);
    if (scene?.hasAudio) {
      await NarratorJukeboxIntegration.playSceneAudio(scene);
    }

    this.render();
  }

  /**
   * Exits preview mode without broadcasting.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onExitPreview(event, target) {
    if (!this.uiState.previewMode) return;

    // Reset preview state
    this.uiState.previewMode = false;
    this.uiState.previewType = null;
    this.uiState.active = false;
    this.uiState.sceneId = null;

    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     BORDER PICKER ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onOpenBorderPicker(event, target) {
    // Switch from emotion picker to border picker (keep same position and character)
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;

    this.uiState.emotionPicker.open = false;
    this.uiState.borderPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow
    };
    this.render();
  }

  static _onCloseBorderPicker(event, target) {
    this.uiState.borderPicker.open = false;
    this.render();
  }

  static _onBackToEmotions(event, target) {
    // Switch back from border picker to emotion picker
    const charId = this.uiState.borderPicker.characterId;
    const x = this.uiState.borderPicker.x;
    const y = this.uiState.borderPicker.y;
    const pickerBelow = this.uiState.borderPicker.pickerBelow;

    this.uiState.borderPicker.open = false;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow
    };
    this.render();
  }

  static _onSelectBorder(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const preset = target.dataset.preset;

    // Emit update to everyone (including GM who will save it)
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
      SocketHandler.emitUpdateBorder(charId, preset);
    });

    // Keep border picker open so user can see the change
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     MUSIC REQUEST ACTIONS (Player Music Request Feature)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Open the music picker for a character
   */
  static _onOpenMusicPicker(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;

    // Close emotion picker and open music picker
    this.uiState.emotionPicker.open = false;
    this.uiState.musicPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      searchQuery: ''
    };
    this.render();
  }

  /**
   * Close the music picker
   */
  static _onCloseMusicPicker(event, target) {
    this.uiState.musicPicker.open = false;
    this.render();
  }

  /**
   * Go back to emotion picker from music picker
   */
  static _onBackToEmotionsFromMusic(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const x = this.uiState.musicPicker.x;
    const y = this.uiState.musicPicker.y;
    const pickerBelow = this.uiState.musicPicker.pickerBelow;

    this.uiState.musicPicker.open = false;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow
    };
    this.render();
  }

  /**
   * Request a track from the character's playlist
   */
  static _onRequestTrack(event, target) {
    const trackId = target.dataset.trackId;
    const trackName = target.dataset.trackName;
    const charId = this.uiState.musicPicker.characterId;

    const char = Store.characters.get(charId);
    if (!char) return;

    // Import SocketHandler dynamically to avoid circular dependencies
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
      SocketHandler.emitMusicRequest(charId, char.name, trackId, trackName);
    });

    // Show feedback to the player
    ui.notifications.info(format('Notifications.MusicRequestSentTrack', { track: trackName }));

    // Close the music picker
    this.uiState.musicPicker.open = false;
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     AUDIO RESTORE ACTIONS (GM Only - Narrator Jukebox Integration)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Restore the scene's linked playlist.
   */
  static async _onRestorePlaylist(event, target) {
    if (!game.user.isGM) return;

    const scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null;
    if (!scene?.hasPlaylist) {
      ui.notifications.warn(localize('Notifications.WarnNoPlaylist'));
      return;
    }

    const success = await NarratorJukeboxIntegration.playPlaylist(scene.audio.playlistId);
    if (success) {
      ui.notifications.info(localize('Notifications.PlayingPlaylist'));
    } else {
      ui.notifications.error(localize('Notifications.ErrorPlayPlaylist'));
    }
  }

  /**
   * Restore the scene's linked ambience preset.
   */
  static async _onRestoreAmbience(event, target) {
    if (!game.user.isGM) return;

    const scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null;
    if (!scene?.hasAmbience) {
      ui.notifications.warn(localize('Notifications.WarnNoAmbience'));
      return;
    }

    const success = await NarratorJukeboxIntegration.loadAmbiencePreset(scene.audio.ambiencePresetId);
    if (success) {
      ui.notifications.info(localize('Notifications.LoadedAmbience'));
    } else {
      ui.notifications.error(localize('Notifications.ErrorLoadAmbience'));
    }
  }

  /**
   * Stop all audio (music and ambience).
   */
  static async _onStopAllAudio(event, target) {
    if (!game.user.isGM) return;

    await NarratorJukeboxIntegration.stopAll();
    ui.notifications.info(localize('Notifications.StoppedAllAudio'));
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API & SOCKET HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Activate the player view with a scene.
   * Creates instance if needed and triggers render.
   * @param {string} sceneId - The scene ID to display
   */
  static activate(sceneId) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Detectar se é uma nova cena (transição) ou apenas um refresh
    const isNewScene = this._instance.uiState.sceneId !== sceneId;

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = isNewScene; // Só anima se for cena diferente
    this._instance.uiState.sequenceBackground = null; // Clear sequence background when activating a regular scene

    this._instance.render(true);
  }

  /**
   * Activate the player view in PREVIEW MODE (GM only, no socket broadcast).
   * The scene is displayed only to the GM until they click "Go Live".
   * @param {string} sceneId - The scene ID to preview
   * @param {string} previewType - Type of content being previewed ('scene', 'slideshow', 'sequence', 'cast-only')
   */
  static activatePreview(sceneId, previewType = 'scene') {
    if (!game.user.isGM) return; // Only GM can preview

    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    const isNewScene = this._instance.uiState.sceneId !== sceneId;

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = isNewScene;
    this._instance.uiState.sequenceBackground = null;

    // Set preview mode flags
    this._instance.uiState.previewMode = true;
    this._instance.uiState.previewType = previewType;

    this._instance.render(true);
  }

  /**
   * Deactivate the player view with closing animation.
   */
  static deactivate() {
    if (this._instance && this._instance.uiState.active) {
      const transitionHandler = this._instance._handlers?.transition;

      // Use transition handler for closing animation if available
      if (transitionHandler) {
        const animated = transitionHandler.animateClose(() => {
          this._instance.uiState.active = false;
          this._instance.uiState.sceneId = null;
          this._instance.uiState.sequenceBackground = null;
          this._instance.render();
        });

        if (animated) return;
      }

      // Fallback if no handler or element
      this._instance.uiState.active = false;
      this._instance.uiState.sceneId = null;
      this._instance.uiState.sequenceBackground = null;
      this._instance.render();
    }
  }

  /**
   * Refresh the current view without changing scene.
   */
  static refresh() {
    if (this._instance && this._instance.uiState.active) {
      this._instance.render();
    }
  }

  /**
   * Update only a specific character's image/video without full re-render
   * This prevents flickering of other characters when one emotion changes
   * Supports both static images and looping video portraits
   */
  static refreshCharacter(characterId) {
    if (!this._instance || !this._instance.uiState.active) return;

    const view = this._instance.element;
    if (!view) return;

    const character = Store.characters.get(characterId);
    if (!character) return;

    const newSrc = character.image;
    const isVideo = newSrc && ['mp4', 'webm', 'ogg', 'mov'].includes(newSrc.split('.').pop()?.toLowerCase());

    // Find the character element
    const charElement = view.querySelector(`.es-pv-character[data-id="${characterId}"]`);
    if (!charElement) return;

    const portrait = charElement.querySelector('.es-pv-portrait');
    if (!portrait) return;

    const currentMedia = portrait.querySelector('img, video');
    const currentIsVideo = currentMedia?.tagName === 'VIDEO';

    // If media type changed (image <-> video), we need to swap the element
    if (isVideo !== currentIsVideo) {
      if (currentMedia) currentMedia.remove();

      if (isVideo) {
        const video = document.createElement('video');
        video.src = newSrc;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.disablePictureInPicture = true;
        portrait.appendChild(video);
        // Ensure video plays (some browsers block autoplay)
        video.play().catch(() => {});
      } else {
        const img = document.createElement('img');
        img.src = newSrc;
        img.alt = character.name;
        portrait.appendChild(img);
      }
    } else {
      // Same media type, just update the src
      if (currentMedia && !currentMedia.src.endsWith(newSrc) && currentMedia.getAttribute('src') !== newSrc) {
        currentMedia.src = newSrc;
        // If it's a video, ensure it plays
        if (isVideo) {
          currentMedia.play().catch(() => {});
        }
      }
    }
  }

  /**
   * Update cast (add/remove characters) with minimal re-render
   * Only re-renders the cast strip, not the entire view
   */
  static refreshCast() {
    if (!this._instance || !this._instance.uiState.active) return;
    // For cast changes (add/remove), we need a full render
    // but we avoid triggering scene transition animations
    this._instance.uiState.isSceneTransition = false;
    this._instance.render();
  }

  /**
   * Update only a specific character's border without full re-render
   */
  static refreshCharacterBorder(characterId, borderStyle) {
    if (!this._instance || !this._instance.uiState.active) return;

    const view = this._instance.element;
    if (!view) return;

    // Find the character element and update its border class
    const charElement = view.querySelector(`.es-pv-character[data-id="${characterId}"]`);
    if (charElement) {
      // Remove old border classes and add new one
      charElement.className = charElement.className.replace(/es-border-\S+/g, '');
      charElement.classList.add(`es-border-${borderStyle}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW METHODS
     ═══════════════════════════════════════════════════════════════ */

  static setSlideshowMode(enabled, cinematicMode = false, cast = null, backgroundMotion = 'none') {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }
    this._instance.uiState.slideshowMode = enabled;
    this._instance.uiState.cinematicMode = cinematicMode;
    this._instance.uiState.slideshowPaused = false;
    this._instance.uiState.backgroundMotion = backgroundMotion;

    // Store the fixed cast for the entire slideshow
    // This ensures characters persist across all background changes
    if (enabled && cast) {
      this._instance.uiState.slideshowCast = cast;
    } else if (!enabled) {
      this._instance.uiState.slideshowCast = null;
      this._instance.uiState.backgroundMotion = 'none';
    }

    if (this._instance.uiState.active) {
      this._instance.render();
    }
  }

  static setSlideshowPaused(paused) {
    if (this._instance) {
      this._instance.uiState.slideshowPaused = paused;
      if (this._instance.uiState.active) {
        this._instance.render();
      }
    }
  }

  static activateWithTransition(sceneId, transitionType = 'fade', transitionDuration = 500, slideDuration = 5000) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    const isNewScene = this._instance.uiState.sceneId !== sceneId;
    const wasActive = this._instance.uiState.active;

    // Update state
    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    // Store slide duration for background motion on first render
    this._instance.uiState.currentSlideDuration = slideDuration;

    // If in slideshow mode and already active, only update background (don't re-render)
    if (this._instance.uiState.slideshowMode && wasActive && isNewScene) {
      this._updateBackgroundOnly(sceneId, transitionType, transitionDuration, slideDuration);
      return;
    }

    // Otherwise do full render (first activation or non-slideshow mode)
    this._instance.uiState.isSceneTransition = isNewScene;
    this._instance.render(true);
  }

  /**
   * Update the cast strip without full re-render
   * Used during slideshow transitions to update characters for new scene
   */
  static _updateCastOnly(scene) {
    const view = this._instance?.element;
    if (!view || !scene) return;

    const castContainer = view.querySelector('.es-pv-cast');
    if (!castContainer) return;

    // Build new cast using DOM API to avoid innerHTML XSS risks
    castContainer.replaceChildren();

    for (const charRef of scene.cast) {
      const realChar = Store.characters.get(charRef.id);
      if (!realChar) continue;

      const isLocked = realChar.locked || false;
      const borderStyle = realChar.borderStyle || 'gold';
      const imageSrc = realChar.image;
      const isVideo = imageSrc && ['mp4', 'webm', 'ogg', 'mov'].includes(imageSrc.split('.').pop()?.toLowerCase());

      const charDiv = document.createElement('div');
      charDiv.className = `es-pv-character${isLocked ? ' is-locked' : ''}`;
      charDiv.dataset.id = realChar.id;
      charDiv.dataset.action = 'character-click';

      const portrait = document.createElement('div');
      portrait.className = 'es-pv-portrait';
      portrait.dataset.border = borderStyle;

      if (isVideo) {
        const video = document.createElement('video');
        video.src = imageSrc;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.disablePictureInPicture = true;
        portrait.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = realChar.name;
        portrait.appendChild(img);
      }
      charDiv.appendChild(portrait);

      if (isLocked) {
        const lockIndicator = document.createElement('div');
        lockIndicator.className = 'es-pv-lock-indicator';
        lockIndicator.title = 'Locked - Only GM can change emotions';
        lockIndicator.innerHTML = '<i class="fas fa-lock"></i>';
        charDiv.appendChild(lockIndicator);
      }

      const hint = document.createElement('div');
      hint.className = 'es-pv-hint';
      hint.innerHTML = `<i class="fas ${isLocked ? 'fa-lock' : 'fa-theater-masks'}"></i>`;
      charDiv.appendChild(hint);

      const nameDiv = document.createElement('div');
      nameDiv.className = 'es-pv-name';
      nameDiv.textContent = realChar.name;
      charDiv.appendChild(nameDiv);

      castContainer.appendChild(charDiv);
    }
  }

  /**
   * Update background during slideshow without full re-render
   * This preserves picker state and keeps the fixed slideshow cast
   * Characters persist across all background changes in slideshow mode
   */
  static _updateBackgroundOnly(sceneId, transitionType = 'dissolve', transitionDuration = 500, slideDuration = 5000) {
    if (!this._instance?._handlers?.transition) return;

    // Build motion settings from slideshow state
    const motionPreset = this._instance.uiState.backgroundMotion || 'none';
    const motionSettings = motionPreset !== 'none' ? {
      preset: motionPreset,
      duration: slideDuration
    } : null;

    this._instance._handlers.transition.updateBackgroundOnly(sceneId, transitionType, transitionDuration, motionSettings);
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE METHODS (Manual navigation by GM)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Activate the player view with a sequence (starts at first background)
   */
  static activateSequence(sceneId, background, transitionType = 'dissolve', transitionDuration = 1.0) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Store current background info for sequence
    this._instance.uiState.sequenceBackground = background;

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = true;

    this._instance.render(true);
  }

  /**
   * Update the background during a sequence without re-rendering everything
   */
  static updateSequenceBackground(background, transitionType = 'dissolve', transitionDuration = 1.0) {
    if (!this._instance?._handlers?.transition) return;
    this._instance._handlers.transition.updateSequenceBackground(background, transitionType, transitionDuration);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE METHODS (Cast without scene background)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Activate Cast-Only Mode
   * @param {string[]} characterIds - Array of character IDs to display
   * @param {Object} layoutSettings - Layout settings for cast positioning
   */
  static activateCastOnly(characterIds, layoutSettings) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Set cast-only mode state
    this._instance.uiState.active = true;
    this._instance.uiState.castOnlyMode = true;
    this._instance.uiState.castOnlyCharacterIds = [...characterIds];
    this._instance.uiState.castOnlyLayoutSettings = layoutSettings || CONFIG.DEFAULT_LAYOUT;
    this._instance.uiState.sceneId = null; // No scene in cast-only mode
    this._instance.uiState.isSceneTransition = true; // Trigger entrance animation

    this._instance.render(true);
  }

  /**
   * Deactivate Cast-Only Mode
   */
  static deactivateCastOnly() {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;

    const transitionHandler = this._instance._handlers?.transition;

    // Use transition handler for closing animation if available
    if (transitionHandler) {
      const animated = transitionHandler.animateClose(() => {
        this._instance.uiState.active = false;
        this._instance.uiState.castOnlyMode = false;
        this._instance.uiState.castOnlyCharacterIds = [];
        this._instance.render();
      });

      if (animated) return;
    }

    // Fallback if no handler or element
    this._instance.uiState.active = false;
    this._instance.uiState.castOnlyMode = false;
    this._instance.uiState.castOnlyCharacterIds = [];
    this._instance.render();
  }

  /**
   * Update Cast-Only Mode (characters or layout)
   * @param {string[]} characterIds - Updated character IDs (optional)
   * @param {Object} layoutSettings - Updated layout settings (optional)
   */
  static updateCastOnly(characterIds, layoutSettings) {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;

    if (characterIds) {
      this._instance.uiState.castOnlyCharacterIds = [...characterIds];
    }
    if (layoutSettings) {
      this._instance.uiState.castOnlyLayoutSettings = layoutSettings;
    }

    // Don't trigger scene transition animation
    this._instance.uiState.isSceneTransition = false;
    this._instance.render();
  }

  /**
   * Refresh a character in Cast-Only Mode
   * @param {string} characterId - Character ID to refresh
   */
  static refreshCastOnlyCharacter(characterId) {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;
    this.refreshCharacter(characterId);
  }
}
