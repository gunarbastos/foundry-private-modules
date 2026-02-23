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

import { CONFIG } from './config.js';
import { ExaltedScenesGMPanel } from './apps/GMPanel.js';
import { ExaltedScenesPlayerPanel } from './apps/PlayerPanel.js';
import { Store } from './data/Store.js';
import { MigrationService } from './data/MigrationService.js';
import { SocketHandler } from './data/SocketHandler.js';
import { ExaltedScenesAPI } from './api/index.js';

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
    console.log(`${CONFIG.MODULE_NAME} | Initializing v5.0`);

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

    // Media type helper for video portrait support
    Handlebars.registerHelper('isVideo', (path) => {
      if (!path) return false;
      const ext = path.split('.').pop()?.toLowerCase();
      return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
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

    console.log(`${CONFIG.MODULE_NAME} | Applied theme: ${theme.name}`);
  }

  /**
   * Registers keyboard shortcuts for the module.
   * Default: Ctrl+Shift+C opens the appropriate panel based on user role.
   * @private
   */
  static _registerKeybindings() {
    game.keybindings.register(this.ID, 'open-panel', {
      name: 'EXALTED-SCENES.Keybindings.OpenPanel.Name',
      hint: 'EXALTED-SCENES.Keybindings.OpenPanel.Hint',
      editable: [
        { key: 'KeyC', modifiers: [KeyboardManager.MODIFIER_KEYS.CONTROL, KeyboardManager.MODIFIER_KEYS.SHIFT] }
      ],
      onDown: () => {
        if (game.user.isGM) {
          ExaltedScenesGMPanel.show();
        } else {
          ExaltedScenesPlayerPanel.show();
        }
      },
      restricted: false, // Allow all users to use the keybinding
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
  }

  /**
   * Handler for Foundry's 'ready' hook.
   * Initializes the Store, runs migrations, sets up sockets,
   * and exposes the module API for macros.
   * @private
   * @async
   */
  static async _onReady() {
    console.log(`${CONFIG.MODULE_NAME} | Ready`);

    // Initialize Store
    await Store.initialize();

    // Run Migration
    await MigrationService.migrate();

    // Initialize Sockets
    SocketHandler.initialize();

    // Apply saved color theme
    const savedTheme = game.settings.get(this.ID, CONFIG.SETTINGS.COLOR_THEME);
    this._applyColorTheme(savedTheme);

    // Monks Common Display Compatibility
    if (game.modules.get('monks-common-display')?.active) {
      const style = document.createElement('style');
      style.id = 'exalted-scenes-mcd-compat';
      style.textContent = `
        body.hide-ui #exalted-scenes-player-view,
        body.hide-ui #exalted-scenes-player-view .es-player-view {
          display: block !important;
        }
      `;
      document.head.appendChild(style);
      console.log(`${CONFIG.MODULE_NAME} | Monks Common Display compatibility enabled`);
    }

    // Expose Public API
    game.modules.get(this.ID).api = new ExaltedScenesAPI();
    console.log(`${CONFIG.MODULE_NAME} | Public API initialized`);
  }

  /**
   * Handler for Foundry's 'getSceneControlButtons' hook.
   * Adds the Exalted Scenes button to the token controls.
   * @private
   * @param {Array|Object} controls - Scene control buttons (format varies by Foundry version)
   */
  static _onGetSceneControlButtons(controls) {
    console.log(`${CONFIG.MODULE_NAME} | Hook: getSceneControlButtons`, controls);

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
}

Hooks.once('init', () => {
  ExaltedScenes.initialize();
});
