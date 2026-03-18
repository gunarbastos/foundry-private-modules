/**
 * @file main.js
 * @description Entry point for the Exalted Scenes module. Handles module initialization,
 * settings registration, keybindings, and Foundry VTT hook integration.
 *
 * This module provides:
 * - GM Panel for scene and character management
 * - Player View for broadcasted scenes
 * - Socket-based real-time synchronization
 * - Slideshow and sequence playback features
 *
 * @module main
 */

import { CONFIG, log } from './config.js';
import { ExaltedScenesGMPanel } from './apps/GMPanel.js';
import { ExaltedScenesPlayerPanel } from './apps/PlayerPanel.js';
import { Store } from './data/Store.js';
import { MigrationService } from './data/MigrationService.js';
import { SocketHandler } from './data/SocketHandler.js';
import { MusicRequestPlaybackMonitor } from './data/MusicRequestPlaybackMonitor.js';
import { ExaltedScenesAPI } from './api/index.js';
import { borderStyleToInline } from './utils/border-utils.js';
import { MODULE_KEYBINDINGS, resolveShortcutText } from './shortcuts.js';

/**
 * Main module class for Exalted Scenes.
 * Handles initialization, settings registration, and Foundry VTT integration.
 *
 * @class ExaltedScenes
 */
class ExaltedScenes {
  /** @type {string} Module identifier */
  static ID = CONFIG.MODULE_ID;

  /** @type {string} Flags namespace */
  static FLAGS = CONFIG.MODULE_ID;

  /**
   * Initializes the module during Foundry's init hook.
   * Registers helpers, settings, keybindings, and hooks.
   */
  static initialize() {
    log('Initializing v5.0');

    // Register Handlebars Helpers
    this._registerHandlebarsHelpers();

    // Register Settings
    this._registerSettings();
    this._registerKeybindings();

    // Register Hooks
    Hooks.on('getSceneControlButtons', this._onGetSceneControlButtons.bind(this));
    Hooks.on('ready', this._onReady.bind(this));
  }

  /**
   * Registers custom Handlebars helpers for template rendering.
   * Adds math operations (add, subtract, multiply, divide) and
   * comparison helpers (gt, eq, lt) if not already present.
   * @private
   */
  static _registerHandlebarsHelpers() {
    // Math helpers
    Handlebars.registerHelper('subtract', (a, b) => (a || 0) - (b || 0));
    Handlebars.registerHelper('add', (a, b) => (a || 0) + (b || 0));
    Handlebars.registerHelper('divide', (a, b) => b ? (a || 0) / b : 0);
    Handlebars.registerHelper('multiply', (a, b) => (a || 0) * (b || 0));

    // Comparison helpers (if not already registered by Foundry)
    if (!Handlebars.helpers.gt) {
      Handlebars.registerHelper('gt', (a, b) => a > b);
    }
    if (!Handlebars.helpers.eq) {
      Handlebars.registerHelper('eq', (a, b) => a === b);
    }
    if (!Handlebars.helpers.lt) {
      Handlebars.registerHelper('lt', (a, b) => a < b);
    }
    if (!Handlebars.helpers.format) {
      Handlebars.registerHelper('format', (key, options) => {
        return game.i18n.format(key, options?.hash ?? {});
      });
    }

    // Media type helper for video portrait support
    Handlebars.registerHelper('isVideo', (path) => {
      if (!path) return false;
      const ext = path.split('.').pop()?.toLowerCase();
      return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    });

    // Border style helper — generates CSS custom properties for inline style
    Handlebars.registerHelper('borderInlineStyle', (borderStyle) => {
      return new Handlebars.SafeString(borderStyleToInline(borderStyle));
    });
  }

  /**
   * Registers module settings for data persistence.
   * Settings include scenes, characters, folders, custom order, and slideshows.
   * All settings are world-scoped and not visible in the config UI.
   * @private
   */
  static _registerSettings() {
    // Data storage settings
    game.settings.register(this.ID, CONFIG.SETTINGS.DATA_VERSION, {
      name: 'Data Version',
      scope: 'world',
      config: false,
      type: Number,
      default: 0
    });

    game.settings.register(this.ID, CONFIG.SETTINGS.SCENES, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    game.settings.register(this.ID, CONFIG.SETTINGS.CHARACTERS, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    game.settings.register(this.ID, CONFIG.SETTINGS.FOLDERS, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    game.settings.register(this.ID, CONFIG.SETTINGS.CUSTOM_ORDER, {
      scope: 'world',
      config: false,
      type: Object,
      default: { scenes: [], characters: [] }
    });

    game.settings.register(this.ID, CONFIG.SETTINGS.SLIDESHOWS, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    // User preference - Skip Preview Mode (broadcast immediately instead of previewing first)
    game.settings.register(this.ID, CONFIG.SETTINGS.SKIP_PREVIEW_MODE, {
      name: 'EXALTED-SCENES.Settings.SkipPreviewMode.Name',
      hint: 'EXALTED-SCENES.Settings.SkipPreviewMode.Hint',
      scope: 'world',
      config: true,
      type: Boolean,
      default: false
    });

    // User preference - Background Fit Mode (how backgrounds scale to viewport)
    game.settings.register(this.ID, CONFIG.SETTINGS.BACKGROUND_FIT_MODE, {
      name: 'EXALTED-SCENES.Settings.BackgroundFitMode.Name',
      hint: 'EXALTED-SCENES.Settings.BackgroundFitMode.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: {
        fill: 'EXALTED-SCENES.Settings.BackgroundFitMode.Fill',
        fit: 'EXALTED-SCENES.Settings.BackgroundFitMode.Fit',
        smart: 'EXALTED-SCENES.Settings.BackgroundFitMode.Smart'
      },
      default: 'fill'
    });

    const defaultScenePresetChoices = {};
    for (const [key, preset] of Object.entries(CONFIG.LAYOUT_PRESETS)) {
      defaultScenePresetChoices[key] = preset.name;
    }
    game.settings.register(this.ID, CONFIG.SETTINGS.DEFAULT_SCENE_PRESET, {
      name: 'EXALTED-SCENES.Settings.DefaultScenePreset.Name',
      hint: 'EXALTED-SCENES.Settings.DefaultScenePreset.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: defaultScenePresetChoices,
      default: CONFIG.DEFAULT_LAYOUT.preset
    });

    const defaultSceneDisplayModeChoices = {};
    for (const [key, mode] of Object.entries(CONFIG.DISPLAY_MODES)) {
      defaultSceneDisplayModeChoices[key] = mode.name;
    }
    game.settings.register(this.ID, CONFIG.SETTINGS.DEFAULT_SCENE_DISPLAY_MODE, {
      name: 'EXALTED-SCENES.Settings.DefaultSceneDisplayMode.Name',
      hint: 'EXALTED-SCENES.Settings.DefaultSceneDisplayMode.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: defaultSceneDisplayModeChoices,
      default: CONFIG.DEFAULT_LAYOUT.displayMode
    });

    const defaultSceneShapeChoices = {};
    for (const [key, preset] of Object.entries(CONFIG.SHAPE_PRESETS)) {
      defaultSceneShapeChoices[key] = preset.name;
    }
    game.settings.register(this.ID, CONFIG.SETTINGS.DEFAULT_SCENE_SHAPE, {
      name: 'EXALTED-SCENES.Settings.DefaultSceneShape.Name',
      hint: 'EXALTED-SCENES.Settings.DefaultSceneShape.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: defaultSceneShapeChoices,
      default: CONFIG.DEFAULT_LAYOUT.shape
    });

    const defaultSceneSizeChoices = {};
    for (const [key, preset] of Object.entries(CONFIG.SIZE_PRESETS)) {
      defaultSceneSizeChoices[key] = preset.name;
    }
    game.settings.register(this.ID, CONFIG.SETTINGS.DEFAULT_SCENE_SIZE, {
      name: 'EXALTED-SCENES.Settings.DefaultSceneSize.Name',
      hint: 'EXALTED-SCENES.Settings.DefaultSceneSize.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: defaultSceneSizeChoices,
      default: CONFIG.DEFAULT_LAYOUT.size
    });

    // User preference - Color Theme
    const themeChoices = {};
    for (const [key, theme] of Object.entries(CONFIG.COLOR_THEMES)) {
      themeChoices[key] = theme.name;
    }
    game.settings.register(this.ID, CONFIG.SETTINGS.COLOR_THEME, {
      name: 'EXALTED-SCENES.Settings.ColorTheme.Name',
      hint: 'EXALTED-SCENES.Settings.ColorTheme.Hint',
      scope: 'client',
      config: true,
      type: String,
      choices: themeChoices,
      default: 'rose',
      onChange: (value) => ExaltedScenes._applyColorTheme(value)
    });

    // Cast presets storage (world-scoped, hidden from config UI)
    game.settings.register(this.ID, CONFIG.SETTINGS.CAST_PRESETS, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    // Broadcast state persistence (for player reconnection)
    game.settings.register(this.ID, CONFIG.SETTINGS.BROADCAST_STATE, {
      scope: 'world',
      config: false,
      type: Object,
      default: { mode: null }
    });

    // GM preference - Allow players to position characters in Free Composition mode
    game.settings.register(this.ID, CONFIG.SETTINGS.FREEFORM_PLAYER_CONTROL, {
      name: 'EXALTED-SCENES.Settings.FreeformPlayerControl.Name',
      hint: 'EXALTED-SCENES.Settings.FreeformPlayerControl.Hint',
      scope: 'world',
      config: true,
      type: Boolean,
      default: false
    });
  }

  /**
   * Applies the selected color theme to all Exalted Scenes elements.
   * @param {string} themeKey - The theme key from CONFIG.COLOR_THEMES
   * @private
   */
  static _applyColorTheme(themeKey) {
    const theme = CONFIG.COLOR_THEMES[themeKey];
    if (!theme) return;

    // Remove all theme classes from body and add current
    const themeClasses = Object.values(CONFIG.COLOR_THEMES).map(t => t.cssClass);
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(theme.cssClass);

    // Also apply to any existing Exalted Scenes windows
    document.querySelectorAll('.exalted-scenes').forEach(el => {
      el.classList.remove(...themeClasses);
      el.classList.add(theme.cssClass);
    });

    log(`Applied theme: ${theme.name}`);
  }

  /**
   * Registers keyboard shortcuts for the module.
   * All shortcuts are configurable through Foundry's Configure Controls UI.
   * @private
   */
  static _registerKeybindings() {
    for (const binding of MODULE_KEYBINDINGS) {
      game.keybindings.register(this.ID, binding.id, {
        name: resolveShortcutText(binding.nameKey, binding.defaultName),
        hint: resolveShortcutText(binding.hintKey, binding.defaultHint),
        editable: binding.editable,
        onDown: () => this._handleKeybinding(binding.action),
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
      });
    }
  }

  /**
   * Routes keybinding actions to the correct module behavior.
   * GM-only actions are intentionally registered for everyone so users can
   * rebind them locally, but they no-op when the current user is not a GM.
   *
   * @private
   * @param {string} action - Action identifier from the shortcut catalog
   * @returns {boolean} True when handled
   */
  static _handleKeybinding(action) {
    switch (action) {
      case 'openPanel':
        if (game.user.isGM) {
          ExaltedScenesGMPanel.show();
        } else {
          ExaltedScenesPlayerPanel.show();
        }
        return true;

      case 'stopLiveOutput':
        if (!game.user.isGM) return false;
        ExaltedScenesGMPanel.stopLiveOutput();
        return true;

      case 'openLiveView':
        if (!game.user.isGM) return false;
        ExaltedScenesGMPanel.openLiveView();
        return true;

      case 'toggleSlideshowPause':
        if (!game.user.isGM) return false;
        return ExaltedScenesGMPanel.toggleSlideshowPause();

      case 'previousLiveStep':
        if (!game.user.isGM) return false;
        return ExaltedScenesGMPanel.navigateLiveStep(-1);

      case 'nextLiveStep':
        if (!game.user.isGM) return false;
        return ExaltedScenesGMPanel.navigateLiveStep(1);

      default:
        return false;
    }
  }

  /**
   * Handler for Foundry's 'ready' hook.
   * Initializes the Store, runs migrations, sets up sockets,
   * and exposes the module API for macros.
   * @private
   * @async
   */
  static async _onReady() {
    log('Ready');

    // Initialize Store
    await Store.initialize();

    // Run Migration
    await MigrationService.migrate();

    // Initialize Sockets
    SocketHandler.initialize();
    MusicRequestPlaybackMonitor.initialize();

    // Restore broadcast state for reconnecting players
    this._restoreBroadcastState();

    // Apply saved color theme
    const savedTheme = game.settings.get(this.ID, CONFIG.SETTINGS.COLOR_THEME);
    this._applyColorTheme(savedTheme);

    // Monks Common Display Compatibility
    // MCD adds body.hide-ui to hide the Foundry interface on player displays (e.g. TV).
    // We must ensure our broadcast and cast-only views remain visible and on top.
    if (game.modules.get('monks-common-display')?.active) {
      const style = document.createElement('style');
      style.id = 'exalted-scenes-mcd-compat';
      // MCD's hide-ui selector has ~30 :not(#id) clauses, giving it enormous
      // specificity (~30 ID selectors). We must match or exceed that specificity
      // for our override to win. Repeating the same ID selector is a standard
      // CSS specificity hack: #id#id#id counts as 3 ID selectors of specificity
      // but still matches the same element.
      const sp = '#exalted-scenes-player-view'.repeat(25); // (25,0,0) beats MCD's ~(23,8,1)
      style.textContent = `
        /* Override MCD's high-specificity hide-all selector.
           MCD uses body.hide-ui > *:not(#a):not(#b)... (~30 :not(#id) = ~30,1,1).
           We counter with repeated ID selectors for sufficient specificity. */
        body.hide-ui ${sp} {
          display: block !important;
          visibility: visible !important;
        }

        /* The inner player view respects its own active/inactive state via opacity,
           but must not be hidden by MCD's broad selectors */
        body.hide-ui ${sp} .es-player-view {
          display: block !important;
          visibility: visible !important;
        }

        /* Active broadcast must sit above the Foundry canvas on MCD displays */
        body.hide-ui ${sp} .es-player-view--active {
          z-index: 1000 !important;
        }

        /* Hide Foundry canvas during full-scene broadcast to prevent
           dual rendering (e.g. animated Beneos maps + broadcast scene).
           Cast-only mode is excluded — es-broadcast-active is not set
           when cast-only is active, since the canvas IS the background. */
        body.hide-ui.es-broadcast-active #board {
          visibility: hidden !important;
        }
      `;
      document.head.appendChild(style);
      log('Monks Common Display compatibility enabled');
    }

    // Expose Public API
    game.modules.get(this.ID).api = new ExaltedScenesAPI();
    log('Public API initialized');
  }

  /**
   * Handler for Foundry's 'getSceneControlButtons' hook.
   * Adds the Exalted Scenes button to the token controls.
   * @private
   * @param {Array|Object} controls - Scene control buttons (format varies by Foundry version)
   */
  static _onGetSceneControlButtons(controls) {
    log('Hook: getSceneControlButtons', controls);

    // Handle both Array (standard) and Object (V13/modified) structures
    let tokenControls;
    if (Array.isArray(controls)) {
        tokenControls = controls.find(c => c.name === 'token');
    } else {
        tokenControls = controls.tokens;
    }

    if (tokenControls) {
      // Show different panel for GM vs Player
      const isGM = game.user.isGM;
      const tool = {
        name: 'exalted-scenes',
        title: isGM ? 'Exalted Scenes' : 'My Characters',
        icon: 'fas fa-film',
        button: true,
        onClick: () => {
          if (isGM) {
            ExaltedScenesGMPanel.show();
          } else {
            ExaltedScenesPlayerPanel.show();
          }
        }
      };

      // Handle different tools structures (Array vs Map vs Object)
      if (Array.isArray(tokenControls.tools)) {
          tokenControls.tools.push(tool);
      } else if (tokenControls.tools instanceof Map) {
          tokenControls.tools.set('exalted-scenes', tool);
      } else if (typeof tokenControls.tools === 'object' && tokenControls.tools !== null) {
          tokenControls.tools['exalted-scenes'] = tool;
      } else {
          console.warn(`${CONFIG.MODULE_NAME} | Unknown tools structure:`, tokenControls.tools);
      }
    }
  }

  /**
   * Restores broadcast state for players who reconnect (F5) during an active broadcast.
   * Reads the persisted broadcast state from settings and activates the appropriate view.
   * @private
   */
  static _restoreBroadcastState() {
    const state = game.settings.get(this.ID, CONFIG.SETTINGS.BROADCAST_STATE);
    if (!state?.mode) return;

    // GM doesn't need restore — they control the broadcast and already have local state
    if (game.user.isGM) return;

    log('Restoring broadcast state:', state.mode);

    import('./apps/PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
      switch (state.mode) {
        case 'scene':
          if (state.sceneId) {
            Store.setActiveScene(state.sceneId);
            ExaltedScenesPlayerView.activate(state.sceneId, {
              theaterShotId: state.theaterShotId || null
            });
          }
          break;

        case 'cast-only':
          if (state.characterIds?.length) {
            Store.castOnlyState = {
              isActive: true,
              characterIds: [...state.characterIds],
              layoutSettings: { ...state.layoutSettings }
            };
            ExaltedScenesPlayerView.activateCastOnly(state.characterIds, state.layoutSettings);
          }
          break;

        case 'slideshow':
          // Slideshows are GM-driven with timers — can't fully restore mid-slide.
          // Restore the current scene being shown so the player at least sees something.
          if (state.sceneId) {
            Store.setActiveScene(state.sceneId);
            ExaltedScenesPlayerView.activate(state.sceneId);
          }
          break;

        case 'sequence':
          // Restore the current sequence background
          if (state.sceneId && state.background) {
            Store.setActiveScene(state.sceneId);
            ExaltedScenesPlayerView.activateSequence(
              state.sceneId, state.background,
              state.transitionType || 'dissolve', 0
            );
          }
          break;
      }
    }).catch(e => console.error('Exalted Scenes | Failed to restore broadcast state:', e));
  }
}

Hooks.once('init', () => {
  ExaltedScenes.initialize();
});
