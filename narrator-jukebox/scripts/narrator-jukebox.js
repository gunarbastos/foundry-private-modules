/**
 * Narrator's Jukebox - Premium Edition
 * Entry Point - Modular Architecture
 *
 * A Spotify-inspired music player for Foundry VTT
 */

// ==========================================
// Module Imports
// ==========================================

// Core
import { JUKEBOX } from './core/constants.js';
import { NarratorJukebox } from './core/jukebox-state.js';

// UI
import { NarratorsJukeboxApp } from './ui/jukebox-app.js';

// Utilities
import { JukeboxBrowser } from './utils/browser-detection.js';
import { formatTime } from './utils/time-format.js';
import { debugLog, debugWarn } from './utils/debug.js';
import { localize } from './utils/i18n.js';

// Player Widget (for non-GM users)
import { playerWidget } from './ui/player-widget.js';

// Services (needed for API and socket)
import { syncService } from './services/sync-service.js';
import { dataService } from './services/data-service.js';
import { playbackService } from './services/playback-service.js';

// Public API
import { NarratorJukeboxAPI } from './api/narrator-jukebox-api.js';

// ==========================================
// Global Exports (for debugging and testing)
// ==========================================

window.NarratorJukebox = NarratorJukebox;
window.NarratorsJukeboxApp = NarratorsJukeboxApp;
window.JukeboxBrowser = JukeboxBrowser;

// ==========================================
// Settings Registration
// ==========================================

function registerSettings() {
  // Music Library
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC, {
    name: "Music Library",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Ambience Library
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE, {
    name: "Ambience Library",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Soundboard Library
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD, {
    name: "Soundboard Library",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Soundboard Volume (per-client)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.SOUNDBOARD_VOLUME, {
    name: "Soundboard Volume",
    scope: "client",
    config: false,
    type: Number,
    default: 0.8
  });

  // Playlists
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.PLAYLISTS, {
    name: "Playlists",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Ambience Presets
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_PRESETS, {
    name: "Ambience Presets",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Global Volume (per-client)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.VOLUME, {
    name: "Global Volume",
    scope: "client",
    config: false,
    type: Number,
    default: 0.8
  });

  // Ambience Volume (per-client)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_VOLUME, {
    name: "Ambience Volume",
    scope: "client",
    config: false,
    type: Number,
    default: 0.5
  });

  // Music Muted State (per-client)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.MUSIC_MUTED, {
    name: "Music Muted",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  // Ambience Muted State (per-client)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.AMBIENCE_MUTED, {
    name: "Ambience Muted",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  // Mood Boards
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

  // Player Suggestions
  game.settings.register(JUKEBOX.ID, "suggestions", {
    name: "Player Suggestions",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Debug Mode (visible in module settings)
  game.settings.register(JUKEBOX.ID, JUKEBOX.SETTINGS.DEBUG, {
    name: "NARRATOR-JUKEBOX.Settings.DebugMode.Name",
    hint: "NARRATOR-JUKEBOX.Settings.DebugMode.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

// ==========================================
// Handlebars Helpers
// ==========================================

function registerHandlebarsHelpers() {
  // NOTE: We prefix all custom helpers with 'njb-' to avoid overwriting
  // Foundry's native helpers (eq, ne, gt, lt, gte, lte) or conflicting
  // with helpers from game systems like PF2e, D&D5e, etc.
  Handlebars.registerHelper('njb-add', (a, b) => a + b);
  Handlebars.registerHelper('njb-formatTime', (seconds) => formatTime(seconds));
  Handlebars.registerHelper('njb-take', (array, count) => {
    if (!Array.isArray(array)) return [];
    return array.slice(0, count);
  });
  // Helper to iterate N times - useful for layer dots
  Handlebars.registerHelper('njb-times', function(n, options) {
    let result = '';
    for (let i = 0; i < n; i++) {
      result += options.fn(this, {
        data: options.data,
        blockParams: [i]
      });
    }
    return result;
  });
  // Helper to check if array includes a value - for multi-selection
  Handlebars.registerHelper('njb-includes', (array, value) => {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  });
}

// ==========================================
// Keybindings
// ==========================================

function registerKeybindings() {
  game.keybindings.register(JUKEBOX.ID, "openJukebox", {
    name: "NARRATOR-JUKEBOX.Keybindings.OpenJukebox.Name",
    hint: "NARRATOR-JUKEBOX.Keybindings.OpenJukebox.Hint",
    editable: [
      { key: "KeyM", modifiers: ["Control", "Shift"] }
    ],
    onDown: () => {
      const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
      if (app) {
        app.close();
      } else {
        openJukebox();
      }
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Open the Jukebox application
 */
function openJukebox() {
  const app = new NarratorsJukeboxApp();
  app.setJukebox(NarratorJukebox.instance);
  app.render(true);
}

/**
 * Load YouTube IFrame API
 */
function loadYouTubeAPI() {
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    debugLog("Loading YouTube IFrame API");
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.body.appendChild(tag);
  } else {
    debugLog("YouTube API already loading/loaded");
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady?.();
    }
  }
}

// ==========================================
// Hooks - Initialization
// ==========================================

Hooks.once('init', () => {
  debugLog("Initializing module");

  registerSettings();
  registerHandlebarsHelpers();
  registerKeybindings();
});

Hooks.once('socketlib.ready', () => {
  NarratorJukebox.socket = socketlib.registerModule(JUKEBOX.ID);
  NarratorJukebox.socket.register('suggestTrack', NarratorJukebox.suggestTrack);
  NarratorJukebox.socket.register('handleRemoteCommand', NarratorJukebox.handleRemoteCommandStatic);
  // Pass socket to syncService for broadcasting
  syncService.socket = NarratorJukebox.socket;
  debugLog('Socket passed to syncService');
});

// Global YouTube API Ready Promise
window.NarratorJukeboxYTReady = new Promise((resolve) => {
  window.onYouTubeIframeAPIReady = () => {
    debugLog("YouTube IFrame API Ready");
    resolve();
  };
});

Hooks.on('ready', async () => {
  debugLog("Module ready");

  // Initialize singleton
  NarratorJukebox.initialize();
  await NarratorJukebox.instance.loadData();

  // Socketlib fallback (if hook didn't fire)
  if (game.modules.get("socketlib")?.active && !NarratorJukebox.socket) {
    NarratorJukebox.socket = socketlib.registerModule(JUKEBOX.ID);
    NarratorJukebox.socket.register('suggestTrack', NarratorJukebox.suggestTrack);
    NarratorJukebox.socket.register('handleRemoteCommand', NarratorJukebox.handleRemoteCommandStatic);
    // Pass socket to syncService for broadcasting
    syncService.socket = NarratorJukebox.socket;
    debugLog('Socket passed to syncService (fallback)');
  }

  // Load YouTube API
  loadYouTubeAPI();

  // Initialize Player Widget for non-GM users
  if (!game.user.isGM) {
    playerWidget.initialize();
  }

  // GM: Broadcast current state after initialization to sync players
  // This handles the case where GM reloads and players still have old layers
  if (game.user.isGM && syncService.socket) {
    // Small delay to ensure socket is fully ready
    setTimeout(() => {
      debugLog('GM broadcasting initial state to sync players');
      syncService.broadcastState();
    }, 1000);
  }

  // ==========================================
  // Public API Registration
  // ==========================================
  const api = new NarratorJukeboxAPI(
    NarratorJukebox.instance,
    dataService,
    playbackService,
    syncService
  );

  // Register with Foundry's module API pattern
  game.modules.get(JUKEBOX.ID).api = api;

  // Also expose globally for convenience
  globalThis.NarratorJukeboxAPI = api;

  // Fire ready hook for other modules to listen
  Hooks.call('narratorJukebox.ready', { api });

  debugLog(`Public API v${api.getVersion()} registered`);
});

// ==========================================
// Hooks - UI Integration
// ==========================================

Hooks.on('renderSidebarTab', (app, html) => {
  if (app.options.id === 'journal') {
    const button = $(`<button class="narrator-jukebox-btn"><i class="fas fa-music"></i> ${localize('Sidebar.JukeboxButton')}</button>`);
    button.click(() => openJukebox());
    html.find('.directory-header .action-buttons').append(button);
  }
});

Hooks.on('getSceneControlButtons', (controls) => {
  // Find token controls (handles different Foundry versions)
  let tokenControls;
  if (Array.isArray(controls)) {
    tokenControls = controls.find(c => c.name === 'token');
  } else {
    tokenControls = controls.tokens;
  }

  if (!tokenControls) {
    debugWarn("Token controls not found!");
    return;
  }

  const tool = {
    name: "jukebox",
    title: localize('SceneControls.JukeboxTooltip'),
    icon: "fas fa-record-vinyl",
    visible: true,
    button: true,
    onClick: () => {
      const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
      if (app) {
        app.close();
      } else {
        openJukebox();
      }
    }
  };

  // Handle different tools structures (v11, v12, v13)
  if (Array.isArray(tokenControls.tools)) {
    tokenControls.tools.push(tool);
  } else if (tokenControls.tools instanceof Map) {
    tokenControls.tools.set('jukebox', tool);
  } else if (typeof tokenControls.tools === 'object' && tokenControls.tools !== null) {
    tokenControls.tools['jukebox'] = tool;
  }
});

// ==========================================
// Hooks - State Change Listener
// ==========================================

Hooks.on('narratorJukeboxStateChanged', () => {
  const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');
  if (app) app.render(false);
});
