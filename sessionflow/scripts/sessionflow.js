/**
 * SessionFlow - Session preparation and organization tool for Game Masters
 * @module sessionflow
 */

import { registerSceneControls } from './controls.js';
import { SessionPanel } from './panel.js';
import { StorylinePanel } from './storyline-panel.js';
import { BeatPanel } from './beat-panel.js';
import { ScenePanel } from './scene-panel.js';
import { CharacterPanel } from './character-panel.js';
import { PlayerPanel } from './player-panel.js';
import { ChronicleReviewBrowser } from './chronicle-review.js';
import { Widget, registerWidgetType, getRegisteredTypes } from './widget.js';
import { submitScribeRecap } from './session-store.js';
import { savePlayerDataFromSocket, clearPlayerDataCache } from './player-store.js';
import {
  getWorldTimeHM, formatGameTime, timeToFraction,
  getSkyGradient, buildMiniSkyElement, updateMiniSkyCelestials,
  animateMiniSky,
} from './sky-utils.js';

const MODULE_ID = 'sessionflow';

/** @type {SessionPanel|null} */
let panel = null;

/** @type {StorylinePanel|null} */
let storylinePanel = null;

/** @type {BeatPanel|null} */
let beatPanel = null;

/** @type {ScenePanel|null} */
let scenePanel = null;

/** @type {CharacterPanel|null} */
let characterPanel = null;

/** @type {PlayerPanel|null} */
let playerPanel = null;

/** @type {ChronicleReviewBrowser|null} */
let chronicleReviewBrowser = null;

/* ---------------------------------------- */
/*  Module Initialization                   */
/* ---------------------------------------- */

Hooks.once('init', () => {
  console.log(`[${MODULE_ID}] Initializing...`);
  _registerSettings();
  _registerKeybindings();

  // Public API — allows extension modules to register custom widgets
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = Object.freeze({
      /** Base class for all widgets. Extend this to create custom widgets. */
      Widget,
      /** Register a new widget type. Call during 'ready' hook. */
      registerWidgetType,
      /** Get metadata for all registered widget types. */
      getRegisteredTypes
    });
    console.log(`[${MODULE_ID}] Public API exposed on game.modules.get('${MODULE_ID}').api`);
  }
});

Hooks.once('ready', () => {
  console.log(`[${MODULE_ID}] Ready. isGM: ${game.user.isGM}`);

  // Apply UI scale from settings
  const uiScale = game.settings.get(MODULE_ID, 'uiScale');
  document.documentElement.style.setProperty('--sf-ui-scale', uiScale);

  // Create panel instances (GM only)
  if (game.user.isGM) {
    panel = new SessionPanel();
    storylinePanel = new StorylinePanel();
    beatPanel = new BeatPanel();
    scenePanel = new ScenePanel();
    characterPanel = new CharacterPanel();
    chronicleReviewBrowser = new ChronicleReviewBrowser();
    console.log(`[${MODULE_ID}] Panel instances created.`);
  }

  // Player panel (all users, if enabled)
  const playerPanelEnabled = game.settings.get(MODULE_ID, 'playerPanelEnabled');
  if (playerPanelEnabled) {
    playerPanel = new PlayerPanel();
    console.log(`[${MODULE_ID}] Player panel enabled.`);

    // Apply player color on ready
    const playerColor = game.settings.get(MODULE_ID, 'playerPanelColor');
    document.documentElement.style.setProperty('--sf-player-color', playerColor);
  }

  // Socket handler for free image broadcast (all clients)
  _registerSocketHandler();
});

/* ---------------------------------------- */
/*  Scene Controls                          */
/* ---------------------------------------- */

Hooks.on('getSceneControlButtons', (controls) => {
  registerSceneControls(controls);
});

/* ---------------------------------------- */
/*  Panel Toggle Hook                       */
/* ---------------------------------------- */

Hooks.on('sessionflow:togglePanel', () => {
  // If ANY panel is currently open, close everything (true toggle behavior)
  const anyOpen = panel?.isOpen || storylinePanel?.isOpen ||
                  beatPanel?.isOpen || scenePanel?.isOpen ||
                  characterPanel?.isOpen || playerPanel?.isOpen;

  if (anyOpen) {
    playerPanel?.close();
    characterPanel?.close();
    scenePanel?.close();
    beatPanel?.close();
    storylinePanel?.close();
    if (panel?.isOpen) panel.close();
    return;
  }

  // Nothing open — use anchor logic to decide what to open
  const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');

  if (anchor?.panel === 'scene' && anchor?.sessionId && anchor?.beatId && anchor?.sceneId) {
    scenePanel?.open(anchor.sessionId, anchor.beatId, anchor.sceneId);
  } else if (anchor?.panel === 'beat' && anchor?.sessionId && anchor?.beatId) {
    beatPanel?.open(anchor.sessionId, anchor.beatId);
  } else if (anchor?.panel === 'storyline' && anchor?.sessionId) {
    storylinePanel?.open(anchor.sessionId);
  } else {
    // Default: open session panel
    panel?.toggle();
  }
});

Hooks.on('sessionflow:selectSession', (sessionId) => {
  console.log(`[${MODULE_ID}] Session selected: ${sessionId}`);

  if (sessionId) {
    // Close session panel quietly (without re-firing the hook)
    panel?.closeQuiet();
    // Open storyline panel for the selected session
    storylinePanel?.open(sessionId);
  } else {
    // Close storyline panel when session is deselected
    storylinePanel?.close();
  }
});

/* ---------------------------------------- */
/*  Beat Selection Hook                     */
/* ---------------------------------------- */

Hooks.on('sessionflow:selectBeat', (sessionId, beatId) => {
  console.log(`[${MODULE_ID}] Beat selected: ${beatId}`);

  if (sessionId && beatId) {
    // Close storyline panel (no hook needed)
    storylinePanel?.close();
    // Open beat detail panel
    beatPanel?.open(sessionId, beatId);
  }
});

/* ---------------------------------------- */
/*  Scene Selection Hook                   */
/* ---------------------------------------- */

Hooks.on('sessionflow:selectScene', (sessionId, beatId, sceneId) => {
  console.log(`[${MODULE_ID}] Scene selected: ${sceneId}`);

  if (sessionId && beatId && sceneId) {
    beatPanel?.closeQuiet();
    scenePanel?.open(sessionId, beatId, sceneId);
  }
});

/* ---------------------------------------- */
/*  Character Selection Hook               */
/* ---------------------------------------- */

Hooks.on('sessionflow:selectCharacter', (characterId, sceneContext) => {
  console.log(`[${MODULE_ID}] Character selected: ${characterId}`);

  if (characterId) {
    scenePanel?.closeQuiet();
    characterPanel?.open(characterId, sceneContext);
  }
});

/* ---------------------------------------- */
/*  Anchor & Navigation Hooks              */
/* ---------------------------------------- */

Hooks.on('sessionflow:navigateBackFromCharacter', () => {
  const ctx = characterPanel?.sceneContext;
  characterPanel?.close();
  if (ctx?.sessionId && ctx?.beatId && ctx?.sceneId) {
    scenePanel?.open(ctx.sessionId, ctx.beatId, ctx.sceneId);
  }
});

Hooks.on('sessionflow:navigateBackFromScene', () => {
  const sessionId = scenePanel?.sessionId;
  const beatId = scenePanel?.beatId;
  scenePanel?.close();
  if (sessionId && beatId) {
    beatPanel?.open(sessionId, beatId);
  }
});

Hooks.on('sessionflow:setAnchor', async (panelType, sessionId = null, beatId = null, sceneId = null) => {
  const current = game.settings.get(MODULE_ID, 'anchoredPanel');

  const isSameAnchor = current?.panel === panelType &&
    (!sessionId || current?.sessionId === sessionId) &&
    (!beatId || current?.beatId === beatId) &&
    (!sceneId || current?.sceneId === sceneId);

  if (isSameAnchor) {
    // Unpin (toggle off)
    await game.settings.set(MODULE_ID, 'anchoredPanel', { panel: null, sessionId: null, beatId: null, sceneId: null });
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.AnchorRemoved'));
  } else {
    // Pin this panel
    await game.settings.set(MODULE_ID, 'anchoredPanel', { panel: panelType, sessionId, beatId: beatId || null, sceneId: sceneId || null });
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.AnchorSet'));
  }

  // Re-render all panels to update anchor visual state
  panel?.rerender();
  if (storylinePanel?.isOpen) storylinePanel.rerender();
  if (beatPanel?.isOpen) beatPanel.rerender();
  if (scenePanel?.isOpen) scenePanel.rerender();
});

Hooks.on('sessionflow:navigateBack', () => {
  storylinePanel?.close();
  panel?.open();
});

/* ---------------------------------------- */
/*  Player Panel Editor Hook               */
/* ---------------------------------------- */

Hooks.on('sessionflow:openPlayerPanelEditor', () => {
  if (!game.user.isGM || !playerPanel) return;
  playerPanel.open({ gmEditorMode: true });
});

Hooks.on('sessionflow:openChronicleReview', () => {
  if (!game.user.isGM || !chronicleReviewBrowser) return;
  chronicleReviewBrowser.open();
});

Hooks.on('sessionflow:chronicleReviewStateChanged', () => {
  chronicleReviewBrowser?.refreshIfOpen?.();
  if (panel?.isOpen) panel.rerender();
});

Hooks.on('updateUser', (user, changes) => {
  if (!game.user?.isGM) return;
  if (!user?.id) return;
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.playerPanelPlayerData`)) return;

  chronicleReviewBrowser?.refreshIfOpen?.();
  if (panel?.isOpen) panel.rerender();
});

Hooks.on('sessionflow:navigateBackFromBeat', () => {
  const sessionId = beatPanel?.sessionId;
  beatPanel?.close();
  if (sessionId) {
    storylinePanel?.open(sessionId);
  }
});

/* ---------------------------------------- */
/*  Settings Registration                   */
/* ---------------------------------------- */

function _registerSettings() {
  // Debug mode
  game.settings.register(MODULE_ID, 'debugMode', {
    name: 'SESSIONFLOW.Settings.DebugMode.Name',
    hint: 'SESSIONFLOW.Settings.DebugMode.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // UI Scale (accessibility)
  game.settings.register(MODULE_ID, 'uiScale', {
    name: 'SESSIONFLOW.Settings.UIScale.Name',
    hint: 'SESSIONFLOW.Settings.UIScale.Hint',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0.8, max: 1.6, step: 0.1 },
    default: 1.0,
    onChange: (value) => {
      document.documentElement.style.setProperty('--sf-ui-scale', value);
    }
  });

  // Storyline layout (vertical left panel vs horizontal bottom panel)
  game.settings.register(MODULE_ID, 'storylineLayout', {
    name: 'SESSIONFLOW.Settings.StorylineLayout.Name',
    hint: 'SESSIONFLOW.Settings.StorylineLayout.Hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      vertical: 'SESSIONFLOW.Settings.StorylineLayout.Vertical',
      horizontal: 'SESSIONFLOW.Settings.StorylineLayout.Horizontal'
    },
    default: 'vertical',
    onChange: () => { storylinePanel?.destroy(); }
  });

  // Sessions data (not shown in config UI)
  game.settings.register(MODULE_ID, 'sessions', {
    name: 'Sessions Data',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Anchored panel preference
  game.settings.register(MODULE_ID, 'anchoredPanel', {
    name: 'Anchored Panel',
    scope: 'world',
    config: false,
    type: Object,
    default: { panel: null, sessionId: null, beatId: null, sceneId: null }
  });

  // Character canvas data (keyed by characterId)
  game.settings.register(MODULE_ID, 'characterData', {
    name: 'Character Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Character quick slots (3 slots, each holds a characterId or null)
  game.settings.register(MODULE_ID, 'characterQuickSlots', {
    name: 'Character Quick Slots',
    scope: 'world',
    config: false,
    type: Object,
    default: { slot1: null, slot2: null, slot3: null }
  });

  // Scene canvas templates (user-saved layouts)
  game.settings.register(MODULE_ID, 'sceneTemplates', {
    name: 'Scene Templates',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Character canvas templates (user-saved layouts)
  game.settings.register(MODULE_ID, 'characterTemplates', {
    name: 'Character Templates',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Reusable saved factions for the Faction widget
  game.settings.register(MODULE_ID, 'factionLibrary', {
    name: 'Faction Library',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Saved maps library for the Map widget
  game.settings.register(MODULE_ID, 'mapLibrary', {
    name: 'Map Library',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Saved quest sets for the Quest Tracker widget
  game.settings.register(MODULE_ID, 'questLibrary', {
    name: 'Quest Library',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Currency data (keyed by characterId — global persistence across scenes)
  game.settings.register(MODULE_ID, 'currencyData', {
    name: 'Currency Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Saved currency system definitions for the Currency widget
  game.settings.register(MODULE_ID, 'currencyLibrary', {
    name: 'Currency Library',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Saved clocks for the Progress Clock widget
  game.settings.register(MODULE_ID, 'clockLibrary', {
    name: 'Clock Library',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Cached lightweight media previews for heavy image/video assets
  game.settings.register(MODULE_ID, 'mediaPreviewCache', {
    name: 'Media Preview Cache',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Player Panel — enabled toggle (GM setting, config UI)
  game.settings.register(MODULE_ID, 'playerPanelEnabled', {
    name: 'SESSIONFLOW.Settings.PlayerPanel.Name',
    hint: 'SESSIONFLOW.Settings.PlayerPanel.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // Portrait Widget — character source (actor vs narrator-sheets)
  const nsAvailable = game.modules.get('narrator-sheets')?.active;
  game.settings.register(MODULE_ID, 'portraitCharacterSource', {
    name: 'SESSIONFLOW.Settings.PortraitSource.Name',
    hint: 'SESSIONFLOW.Settings.PortraitSource.Hint',
    scope: 'world',
    config: nsAvailable,
    type: String,
    default: 'actor',
    choices: {
      actor: 'SESSIONFLOW.Settings.PortraitSource.Actor',
      'narrator-sheets': 'SESSIONFLOW.Settings.PortraitSource.NarratorSheets'
    }
  });

  // Player Panel — accent color (per-client)
  game.settings.register(MODULE_ID, 'playerPanelColor', {
    name: 'SESSIONFLOW.Settings.PlayerPanelColor.Name',
    hint: 'SESSIONFLOW.Settings.PlayerPanelColor.Hint',
    scope: 'client',
    config: true,
    type: String,
    default: '#0d9488',
    onChange: (value) => {
      document.documentElement.style.setProperty('--sf-player-color', value);
    }
  });

  // Player Panel — GM base page layout
  game.settings.register(MODULE_ID, 'playerPanelGmPage', {
    name: 'Player Panel GM Page',
    scope: 'world',
    config: false,
    type: Object,
    default: { widgets: [], canvasHeight: 420, nextZIndex: 2 }
  });

  // Player Panel — per-player custom pages (keyed by userId)
  // Player Panel - legacy fallback store for per-player custom pages.
  // New writes persist on the owning User document instead.
  game.settings.register(MODULE_ID, 'playerPanelPlayerData', {
    name: 'Player Panel Player Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, 'chronicleNarratorReviewState', {
    name: 'Chronicle Narrator Review State',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Player Panel — broadcast state snapshot (for initial load)
  game.settings.register(MODULE_ID, 'playerPanelBroadcastState', {
    name: 'Player Panel Broadcast State',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Scribe — collaborative session recaps
  game.settings.register(MODULE_ID, 'scribeData', {
    name: 'Scribe Data',
    scope: 'world',
    config: false,
    type: Object,
    default: { entries: [] }
  });
}

/* ---------------------------------------- */
/*  Socket Handler (Free Image Broadcast)   */
/* ---------------------------------------- */

/** @type {{ app: Application, timerId: number|null }|null} */
let _activePopout = null;

function _registerSocketHandler() {
  // Socket: receives messages from OTHER clients (not the sender)
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    if (!data?.action) return;

    switch (data.action) {
      case 'showImage':
        _showImagePopout(data);
        break;
      case 'hideImage':
        _closeExistingPopout();
        break;
      case 'startTimer':
        _showTimerHud(data);
        break;
      case 'pauseTimer':
        _pauseTimerHud(data);
        break;
      case 'stopTimer':
        _removeTimerHud();
        break;
      case 'timerEnd':
        _timerEndHud();
        break;
      case 'showClock':
        _showClockHud(data);
        break;
      case 'updateClock':
        _updateClockHud(data);
        break;
      case 'hideClock':
        _removeClockHud(data.clockId);
        break;
      case 'flashClock':
        _flashClockPopup(data);
        break;
      case 'showSky':
        _showSkyHud(data);
        break;
      case 'updateSky':
        _updateSkyHud(data);
        break;
      case 'hideSky':
        _removeSkyHud(data.widgetId);
        break;
      case 'flashSky':
        _flashSkyPopup(data);
        break;
      case 'animateSky':
        _animateSkyHud(data);
        break;
      case 'showMap':
        _showMapHud(data);
        break;
      case 'updateMap':
        _updateMapHud(data);
        break;
      case 'hideMap':
        _removeMapHud(data.widgetId);
        break;
      case 'flashMap':
        _flashMapPopup(data);
        break;
      case 'showQuests':
        _showQuestHud(data);
        break;
      case 'updateQuests':
        _updateQuestHud(data);
        break;
      case 'hideQuests':
        _removeQuestHud(data.widgetId);
        break;
      case 'flashQuest':
        _flashQuestPopup(data);
        break;
      case 'showTreasury':
        _showTreasuryHud(data);
        break;
      case 'updateTreasury':
        _updateTreasuryHud(data);
        break;
      case 'hideTreasury':
        _removeTreasuryHud(data.widgetId);
        break;
      case 'flashTreasury':
        _flashTreasuryPopup(data);
        break;

      // Time Tracker broadcast
      case 'showTracker':
        _showTrackerHud(data);
        break;
      case 'updateTracker':
        _updateTrackerHud(data);
        break;
      case 'hideTracker':
        _removeTrackerHud(data.widgetId);
        break;
      case 'flashTracker':
        _flashTrackerPopup(data);
        break;

      // Player Panel — GM base page was updated
      case 'playerPanelUpdate':
        playerPanel?.refreshGmPage();
        if (panel?.isOpen) panel.rerender();
        chronicleReviewBrowser?.refreshIfOpen?.();
        break;
      case 'playerPanelOwnUpdate':
        clearPlayerDataCache();
        if (data.forceRefresh && data.userId === game.user.id) {
          playerPanel?.refreshOwnPageFromServer?.(data.pageId ?? null);
        }
        chronicleReviewBrowser?.refreshIfOpen?.();
        if (panel?.isOpen) panel.rerender();
        break;

      // Player Panel — player sends data save request to GM
      // Player Panel - legacy socket save path for older clients
      case 'playerDataSave':
        if (game.user.isGM && data.userId && data.playerData !== undefined) {
          savePlayerDataFromSocket(data.userId, data.playerData).then(() => {
            game.socket.emit(`module.${MODULE_ID}`, { action: 'playerPanelOwnUpdate' });
            Hooks.call('sessionflow:playerPanelOwnUpdate');
          });
        }
        break;

      // Scribe — player submits a recap (GM receives & saves)
      case 'scribeSubmit':
        if (game.user.isGM && data.entryId && data.userId && data.text !== undefined) {
          submitScribeRecap(data.entryId, data.userId, data.text, data.color ?? null).then(() => {
            // Broadcast update to all clients (including other GMs)
            game.socket.emit(`module.${MODULE_ID}`, { action: 'scribeUpdate' });
            // Notify local scribe widgets
            Hooks.call('sessionflow:scribeUpdate');
          });
        }
        break;

      // Scribe — data changed, refresh all scribe widgets
      case 'scribeUpdate':
        Hooks.call('sessionflow:scribeUpdate');
        break;
    }
  });

  // Hooks: receives messages from the LOCAL client (GM triggering broadcast)
  // socket.emit does NOT deliver to the sender, so the widget fires these hooks
  Hooks.on('sessionflow:showImage', (data) => {
    _showImagePopout(data);
  });

  Hooks.on('sessionflow:hideImage', () => {
    _closeExistingPopout();
  });

  // Timer broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:startTimer', (data) => _showTimerHud(data));
  Hooks.on('sessionflow:pauseTimer', (data) => _pauseTimerHud(data));
  Hooks.on('sessionflow:stopTimer', () => _removeTimerHud());
  Hooks.on('sessionflow:timerEnd', () => _timerEndHud());

  // Clock broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showClock', (data) => _showClockHud(data));
  Hooks.on('sessionflow:updateClock', (data) => _updateClockHud(data));
  Hooks.on('sessionflow:hideClock', (data) => _removeClockHud(data.clockId));
  Hooks.on('sessionflow:flashClock', (data) => _flashClockPopup(data));

  // Sky broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showSky', (data) => _showSkyHud(data));
  Hooks.on('sessionflow:updateSky', (data) => _updateSkyHud(data));
  Hooks.on('sessionflow:hideSky', (data) => _removeSkyHud(data?.widgetId));
  Hooks.on('sessionflow:flashSky', (data) => _flashSkyPopup(data));
  Hooks.on('sessionflow:animateSky', (data) => _animateSkyHud(data));

  // Map broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showMap', (data) => _showMapHud(data));
  Hooks.on('sessionflow:updateMap', (data) => _updateMapHud(data));
  Hooks.on('sessionflow:hideMap', (data) => _removeMapHud(data?.widgetId));
  Hooks.on('sessionflow:flashMap', (data) => _flashMapPopup(data));

  // Quest broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showQuests', (data) => _showQuestHud(data));
  Hooks.on('sessionflow:updateQuests', (data) => _updateQuestHud(data));
  Hooks.on('sessionflow:hideQuests', (data) => _removeQuestHud(data?.widgetId));
  Hooks.on('sessionflow:flashQuest', (data) => _flashQuestPopup(data));

  // Treasury broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showTreasury', (data) => _showTreasuryHud(data));
  Hooks.on('sessionflow:updateTreasury', (data) => _updateTreasuryHud(data));
  Hooks.on('sessionflow:hideTreasury', (data) => _removeTreasuryHud(data?.widgetId));
  Hooks.on('sessionflow:flashTreasury', (data) => _flashTreasuryPopup(data));

  // Time Tracker broadcast hooks (local GM delivery)
  Hooks.on('sessionflow:showTracker', (data) => _showTrackerHud(data));
  Hooks.on('sessionflow:updateTracker', (data) => _updateTrackerHud(data));
  Hooks.on('sessionflow:hideTracker', (data) => _removeTrackerHud(data?.widgetId));
  Hooks.on('sessionflow:flashTracker', (data) => _flashTrackerPopup(data));

  // Keep sky HUD in sync with world time changes from any source
  Hooks.on('updateWorldTime', () => {
    if (!_activeSkyHud || !_skyHudState) return;
    const { hour, minute } = getWorldTimeHM();
    _updateSkyHud({
      hour,
      minute,
      format: _skyHudState.format,
      label: _skyHudState.label,
      widgetId: _skyHudState.widgetId
    });
  });
}

/**
 * Open a styled ImagePopout for a broadcast image.
 * Called both from socket (player clients) and from hook (GM client).
 * @param {{ src: string, title: string, timer: number|null }} data
 */
function _showImagePopout({ src, title, timer }) {
  // Close any existing SessionFlow image popout
  _closeExistingPopout();

  const displayTitle = title || game.i18n.localize('SESSIONFLOW.Canvas.FreeImage');

  // Foundry VTT v13: ImagePopout is an AppV2, constructor takes a config object
  const popout = new ImagePopout({
    src,
    window: { title: displayTitle }
  });

  popout.render(true);

  // Tag for custom styling once rendered (AppV2 uses renderApplication hook)
  const hookName = 'renderApplication';
  const hookId = Hooks.on(hookName, (app, html) => {
    if (app !== popout) return;
    Hooks.off(hookName, hookId);

    // AppV2: html is the HTMLElement directly
    const el = html instanceof HTMLElement ? html : app.element;
    el?.classList?.add('sessionflow-image-popout');
  });

  _activePopout = { app: popout, timerId: null };

  // Auto-close after timer (only on player side — GM controls via widget countdown)
  if (timer && timer > 0 && !game.user.isGM) {
    _activePopout.timerId = setTimeout(() => {
      _closeExistingPopout();
    }, timer * 1000);
  }
}

function _closeExistingPopout() {
  if (!_activePopout) return;
  if (_activePopout.timerId) clearTimeout(_activePopout.timerId);
  try { _activePopout.app.close(); } catch { /* ignore */ }
  _activePopout = null;
}

/* ---------------------------------------- */
/*  Timer HUD (Player Broadcast Overlay)    */
/* ---------------------------------------- */

/** @type {{ el: HTMLElement, intervalId: number|null, endTimestamp: number|null, startTimestamp: number|null, mode: string, remaining: number }|null} */
let _activeTimerHud = null;

/**
 * Format seconds as MM:SS or H:MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
function _formatTimerDisplay(totalSeconds) {
  const total = Math.floor(Math.max(0, totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Play a short alert beep via Web Audio API.
 */
function _playTimerAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playBeep(880, now, 0.15);
    playBeep(880, now + 0.2, 0.15);
    playBeep(660, now + 0.45, 0.3);
  } catch { /* AudioContext unavailable */ }
}

/**
 * Show the timer HUD overlay.
 * @param {{ mode: string, duration: number, remaining: number, endTimestamp?: number, startTimestamp?: number }} data
 */
function _showTimerHud(data) {
  _removeTimerHud();

  const el = document.createElement('div');
  el.className = 'sessionflow-timer-hud';

  const icon = document.createElement('div');
  icon.className = 'sessionflow-timer-hud__icon';
  icon.innerHTML = '<i class="fas fa-hourglass-half"></i>';
  el.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'sessionflow-timer-hud__body';

  const timeEl = document.createElement('span');
  timeEl.className = 'sessionflow-timer-hud__time';
  timeEl.textContent = _formatTimerDisplay(data.remaining);
  body.appendChild(timeEl);

  const label = document.createElement('span');
  label.className = 'sessionflow-timer-hud__label';
  label.textContent = data.mode === 'countdown' ? 'Countdown' : 'Stopwatch';
  body.appendChild(label);

  el.appendChild(body);
  document.body.appendChild(el);

  _activeTimerHud = {
    el,
    intervalId: null,
    endTimestamp: data.endTimestamp ?? null,
    startTimestamp: data.startTimestamp ?? null,
    mode: data.mode,
    remaining: data.remaining
  };

  // Start local tick
  _activeTimerHud.intervalId = setInterval(() => _tickTimerHud(), 100);
  _tickTimerHud();

  // Entrance animation
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

/**
 * Tick the timer HUD display.
 */
function _tickTimerHud() {
  if (!_activeTimerHud) return;
  const timeEl = _activeTimerHud.el.querySelector('.sessionflow-timer-hud__time');
  if (!timeEl) return;

  let seconds;
  if (_activeTimerHud.mode === 'countdown' && _activeTimerHud.endTimestamp) {
    seconds = Math.max(0, (_activeTimerHud.endTimestamp - Date.now()) / 1000);
  } else if (_activeTimerHud.startTimestamp) {
    seconds = (Date.now() - _activeTimerHud.startTimestamp) / 1000;
  } else {
    seconds = _activeTimerHud.remaining;
  }

  timeEl.textContent = _formatTimerDisplay(seconds);
}

/**
 * Pause the timer HUD (freeze display).
 * @param {{ remaining: number }} data
 */
function _pauseTimerHud(data) {
  if (!_activeTimerHud) {
    // If HUD doesn't exist yet (e.g. broadcast started while paused), create it frozen
    _showTimerHud({ ...data, mode: data.mode ?? 'countdown' });
    if (_activeTimerHud?.intervalId) {
      clearInterval(_activeTimerHud.intervalId);
      _activeTimerHud.intervalId = null;
    }
    _activeTimerHud.endTimestamp = null;
    _activeTimerHud.startTimestamp = null;
    return;
  }

  if (_activeTimerHud.intervalId) {
    clearInterval(_activeTimerHud.intervalId);
    _activeTimerHud.intervalId = null;
  }
  _activeTimerHud.endTimestamp = null;
  _activeTimerHud.startTimestamp = null;
  _activeTimerHud.remaining = data.remaining;

  const timeEl = _activeTimerHud.el.querySelector('.sessionflow-timer-hud__time');
  if (timeEl) timeEl.textContent = _formatTimerDisplay(data.remaining);
}

/**
 * Timer countdown ended — flash + beep.
 */
function _timerEndHud() {
  if (!_activeTimerHud) return;

  if (_activeTimerHud.intervalId) {
    clearInterval(_activeTimerHud.intervalId);
    _activeTimerHud.intervalId = null;
  }

  // Show 00:00
  const timeEl = _activeTimerHud.el.querySelector('.sessionflow-timer-hud__time');
  if (timeEl) timeEl.textContent = _formatTimerDisplay(0);

  // Flash animation
  _activeTimerHud.el.classList.add('is-ended');

  // Alert sound
  _playTimerAlert();

  // Auto-remove after 5 seconds
  setTimeout(() => _removeTimerHud(), 5000);
}

/**
 * Remove the timer HUD from the DOM.
 */
function _removeTimerHud() {
  if (!_activeTimerHud) return;
  if (_activeTimerHud.intervalId) clearInterval(_activeTimerHud.intervalId);

  const el = _activeTimerHud.el;
  el.classList.add('is-leaving');
  _activeTimerHud = null;

  setTimeout(() => el.remove(), 300);
}

/* ---------------------------------------- */
/*  Clock HUD (Player Broadcast Overlay)    */
/* ---------------------------------------- */

/** @type {Map<string, HTMLElement>} Active clock HUD elements, keyed by clockId */
const _activeClockHuds = new Map();

/** @type {Map<string, object>} Active clock data, keyed by clockId (for GM dock editing) */
const _activeClockData = new Map();

/** @type {HTMLElement|null} The dock container element */
let _clockDock = null;

/** LocalStorage key for dock position */
const DOCK_POS_KEY = 'sessionflow.clockDockPosition';

/**
 * Get or create the clock dock container.
 * @returns {HTMLElement}
 */
function _getClockDock() {
  if (_clockDock) {
    // Cancel any pending leave animation (race with _maybeRemoveDock)
    _clockDock.classList.remove('is-leaving');
    return _clockDock;
  }

  const dock = document.createElement('div');
  dock.className = 'sessionflow-clock-dock';

  // Restore saved position or default to bottom-left
  const saved = _loadDockPosition();
  dock.style.left = `${saved.x}px`;
  dock.style.bottom = `${saved.y}px`;

  // Drag handle
  const handle = document.createElement('div');
  handle.className = 'sessionflow-clock-dock__handle';
  handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
  handle.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockDockDrag');
  dock.appendChild(handle);

  // Content area for clock HUD items
  const content = document.createElement('div');
  content.className = 'sessionflow-clock-dock__content';
  dock.appendChild(content);

  document.body.appendChild(dock);
  _clockDock = dock;

  // Wire up drag
  _initDockDrag(dock, handle);

  // Entrance
  requestAnimationFrame(() => dock.classList.add('is-visible'));

  return dock;
}

/**
 * Remove the dock container if empty.
 */
function _maybeRemoveDock() {
  if (!_clockDock) return;
  if (_activeClockHuds.size > 0) return;

  _clockDock.classList.add('is-leaving');
  const ref = _clockDock;
  setTimeout(() => {
    // Re-check: new items may have been added during the animation delay
    if (_activeClockHuds.size > 0) {
      ref.classList.remove('is-leaving');
      return;
    }
    ref.remove();
    if (_clockDock === ref) _clockDock = null;
  }, 300);
}

/**
 * Load saved dock position from localStorage.
 * @returns {{ x: number, y: number }}
 */
function _loadDockPosition() {
  try {
    const raw = localStorage.getItem(DOCK_POS_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
    }
  } catch { /* ignore */ }
  return { x: 16, y: 16 };
}

/**
 * Save dock position to localStorage.
 * @param {number} x - left px
 * @param {number} y - bottom px
 */
function _saveDockPosition(x, y) {
  try {
    localStorage.setItem(DOCK_POS_KEY, JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

/**
 * Initialize drag behavior for the dock.
 * @param {HTMLElement} dock
 * @param {HTMLElement} handle
 */
function _initDockDrag(dock, handle) {
  let isDragging = false;
  let startX, startY, startLeft, startBottom;

  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = dock.getBoundingClientRect();
    startLeft = rect.left;
    startBottom = window.innerHeight - rect.bottom;

    dock.classList.add('is-dragging');
    document.body.style.cursor = 'grabbing';

    const onMove = (me) => {
      if (!isDragging) return;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;

      let newLeft = startLeft + dx;
      let newBottom = startBottom - dy;

      // Clamp to viewport
      const dockRect = dock.getBoundingClientRect();
      const w = dockRect.width;
      const h = dockRect.height;
      newLeft = Math.max(0, Math.min(window.innerWidth - w, newLeft));
      newBottom = Math.max(0, Math.min(window.innerHeight - h, newBottom));

      dock.style.left = `${newLeft}px`;
      dock.style.bottom = `${newBottom}px`;
    };

    const onUp = () => {
      isDragging = false;
      dock.classList.remove('is-dragging');
      document.body.style.cursor = '';

      // Save final position
      const finalRect = dock.getBoundingClientRect();
      _saveDockPosition(finalRect.left, window.innerHeight - finalRect.bottom);

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/**
 * Build a mini clock visual (pie or dots) for HUD display.
 * GM gets clickable segments.
 * @param {object} data - { clockId, segments, filled, filledColor, emptyColor, style }
 * @param {number} size - SVG/container size
 * @returns {HTMLElement|SVGElement}
 */
function _buildMiniClock(data, size = 40) {
  const filledColor = data.filledColor || '#7c5cbf';
  const emptyColor = data.emptyColor || '#2a2a3a';
  const isGMInteractive = game.user.isGM && data.clockId;
  const style = data.style || 'pie';

  // Bar style
  if (style === 'bar') {
    const bar = document.createElement('div');
    bar.className = 'sessionflow-clock-hud__bar';
    bar.style.width = `${size}px`;
    for (let i = 0; i < data.segments; i++) {
      const seg = document.createElement('div');
      seg.className = 'sessionflow-clock-hud__bar-segment';
      seg.style.background = i < data.filled ? filledColor : emptyColor;
      if (isGMInteractive) {
        seg.style.cursor = 'pointer';
        const segIdx = i;
        seg.addEventListener('click', (e) => {
          e.stopPropagation();
          _dockToggleSegment(data.clockId, segIdx);
        });
      }
      bar.appendChild(seg);
    }
    return bar;
  }

  if (style === 'dots') {
    // Mini dots
    const container = document.createElement('div');
    container.className = 'sessionflow-clock-hud__dots';
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    const cx = size / 2;
    const cy = size / 2;
    const ringR = (size / 2) - 6;
    const dotSize = Math.max(4, Math.min(8, size / data.segments));

    for (let i = 0; i < data.segments; i++) {
      const isFilled = i < data.filled;
      const angle = ((2 * Math.PI) / data.segments) * i - (Math.PI / 2);
      const x = cx + ringR * Math.cos(angle);
      const y = cy + ringR * Math.sin(angle);

      const dot = document.createElement('div');
      dot.className = 'sessionflow-clock-hud__dot';
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
      dot.style.left = `${x - dotSize / 2}px`;
      dot.style.top = `${y - dotSize / 2}px`;

      if (isFilled) {
        dot.style.background = filledColor;
        dot.style.boxShadow = `0 0 4px ${filledColor}`;
        dot.style.borderColor = filledColor;
      } else {
        dot.style.background = 'transparent';
        dot.style.borderColor = emptyColor;
      }

      if (isGMInteractive) {
        dot.style.cursor = 'pointer';
        const segIdx = i;
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          _dockToggleSegment(data.clockId, segIdx);
        });
      }

      container.appendChild(dot);
    }
    return container;
  }

  // Mini pie SVG
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.classList.add('sessionflow-clock-hud__svg');

  const cxSvg = size / 2;
  const cySvg = size / 2;
  const r = (size / 2) - 2;

  for (let i = 0; i < data.segments; i++) {
    const isFilled = i < data.filled;
    const anglePerSeg = (2 * Math.PI) / data.segments;
    const startAngle = (i * anglePerSeg) - (Math.PI / 2);
    const endAngle = ((i + 1) * anglePerSeg) - (Math.PI / 2);
    const x1 = cxSvg + r * Math.cos(startAngle);
    const y1 = cySvg + r * Math.sin(startAngle);
    const x2 = cxSvg + r * Math.cos(endAngle);
    const y2 = cySvg + r * Math.sin(endAngle);
    const largeArc = anglePerSeg > Math.PI ? 1 : 0;

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${cxSvg} ${cySvg} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`);
    path.setAttribute('fill', isFilled ? filledColor : emptyColor);
    path.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    path.setAttribute('stroke-width', '0.5');

    if (isGMInteractive) {
      path.style.cursor = 'pointer';
      const segIdx = i;
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        _dockToggleSegment(data.clockId, segIdx);
      });
    }

    svg.appendChild(path);
  }

  return svg;
}

/**
 * GM toggled a segment from the dock. Update local data and broadcast.
 * @param {string} clockId
 * @param {number} segmentIndex
 */
function _dockToggleSegment(clockId, segmentIndex) {
  const data = _activeClockData.get(clockId);
  if (!data) return;

  // Toggle: click on filled segment = unfill to that point, click on empty = fill to that point + 1
  if (segmentIndex < data.filled) {
    data.filled = segmentIndex;
  } else {
    data.filled = segmentIndex + 1;
  }

  // Update the dock HUD visually
  _updateClockHud(data);

  // Broadcast to all clients (including self via hook)
  const payload = {
    action: 'updateClock',
    clockId: data.clockId,
    title: data.title,
    segments: data.segments,
    filled: data.filled,
    filledColor: data.filledColor,
    emptyColor: data.emptyColor,
    style: data.style,
    mode: data.mode || 'progress',
    label: data.label || '',
    senderId: game.user.id
  };
  game.socket.emit(`module.${MODULE_ID}`, payload);

  // Notify the widget (if alive) to sync its internal state
  Hooks.call('sessionflow:dockClockUpdate', {
    clockId: data.clockId,
    filled: data.filled
  });
}

/**
 * Show a clock HUD element inside the dock.
 * @param {object} data - { clockId, title, segments, filled, filledColor, emptyColor, style }
 */
function _showClockHud(data) {
  // Remove existing HUD for this clock if any
  _removeClockHud(data.clockId, true);

  // Store clock data for GM editing
  _activeClockData.set(data.clockId, { ...data });

  const dock = _getClockDock();
  const content = dock.querySelector('.sessionflow-clock-dock__content');

  const el = document.createElement('div');
  el.className = 'sessionflow-clock-hud';
  el.dataset.clockId = data.clockId;

  const visual = _buildMiniClock(data, 40);
  el.appendChild(visual);

  const info = document.createElement('div');
  info.className = 'sessionflow-clock-hud__info';

  const title = document.createElement('span');
  title.className = 'sessionflow-clock-hud__title';
  title.textContent = data.title;
  info.appendChild(title);

  const progress = document.createElement('span');
  progress.className = 'sessionflow-clock-hud__progress';
  const modeIcon = (data.mode === 'countdown') ? '<i class="fas fa-hourglass-half" style="margin-right:2px;font-size:8px;opacity:0.6;"></i>' : '';
  progress.innerHTML = `${modeIcon}${data.filled}/${data.segments}`;
  info.appendChild(progress);

  el.appendChild(info);
  content.appendChild(el);

  _activeClockHuds.set(data.clockId, el);

  // Entrance animation
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

/**
 * Update an existing clock HUD.
 * @param {object} data - Same as showClock payload
 */
function _updateClockHud(data) {
  // Update stored data
  _activeClockData.set(data.clockId, { ...data });

  const el = _activeClockHuds.get(data.clockId);
  if (!el) {
    // If HUD doesn't exist yet, create it
    _showClockHud(data);
    return;
  }

  // Replace visual
  const oldVisual = el.querySelector('.sessionflow-clock-hud__svg, .sessionflow-clock-hud__dots, .sessionflow-clock-hud__bar');
  const newVisual = _buildMiniClock(data, 40);
  if (oldVisual) {
    oldVisual.replaceWith(newVisual);
  } else {
    el.prepend(newVisual);
  }

  // Update text
  const titleEl = el.querySelector('.sessionflow-clock-hud__title');
  if (titleEl) titleEl.textContent = data.title;
  const progressEl = el.querySelector('.sessionflow-clock-hud__progress');
  if (progressEl) progressEl.textContent = `${data.filled}/${data.segments}`;
}

/**
 * Remove a clock HUD element.
 * @param {string} clockId
 * @param {boolean} [immediate=false] - Skip animation
 */
function _removeClockHud(clockId, immediate = false) {
  const el = _activeClockHuds.get(clockId);
  if (!el) return;

  _activeClockHuds.delete(clockId);
  _activeClockData.delete(clockId);

  if (immediate) {
    el.remove();
    _maybeRemoveDock();
    return;
  }

  el.classList.add('is-leaving');
  setTimeout(() => {
    el.remove();
    _maybeRemoveDock();
  }, 300);
}

/**
 * Flash a dramatic clock popup in the center of the screen. Auto-dismisses after 3s.
 * @param {object} data - Same payload as showClock
 */
function _flashClockPopup(data) {
  const el = document.createElement('div');
  el.className = 'sessionflow-clock-flash';

  const visual = _buildMiniClock(data, 100);
  visual.classList.add('sessionflow-clock-flash__visual');
  el.appendChild(visual);

  const title = document.createElement('div');
  title.className = 'sessionflow-clock-flash__title';
  title.textContent = data.title;
  el.appendChild(title);

  const progress = document.createElement('div');
  progress.className = 'sessionflow-clock-flash__progress';
  progress.textContent = `${data.filled} / ${data.segments}`;
  el.appendChild(progress);

  document.body.appendChild(el);

  // Entrance
  requestAnimationFrame(() => el.classList.add('is-visible'));

  // Auto-dismiss after 3s
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

/* ---------------------------------------- */
/*  Sky HUD (Day/Night Clock Broadcast)     */
/* ---------------------------------------- */

/** @type {HTMLElement|null} Active sky HUD element */
let _activeSkyHud = null;

/** @type {{ format: string, label: string, widgetId: string|null }|null} Last known sky HUD settings for auto-sync */
let _skyHudState = null;

/** @type {Function|null} Cancel function for running sky HUD animation */
let _skyHudAnimCancel = null;

/**
 * Show persistent sky HUD.
 */
function _showSkyHud(data) {
  _removeSkyHud(null, { immediate: true });

  // Store last known HUD settings for updateWorldTime auto-sync
  _skyHudState = {
    format: data.format || '24h',
    label: data.label || '',
    widgetId: data.widgetId || null
  };

  const el = document.createElement('div');
  el.className = 'sessionflow-sky-hud';
  el.dataset.senderId = data.senderId;
  if (data.widgetId) el.dataset.widgetId = data.widgetId;

  // Mini sky bar (shared builder, full detail for rich visuals)
  const miniSky = buildMiniSkyElement(data, 80, 24, 'sf-sky-hud', 'full');
  miniSky.className = 'sessionflow-sky-hud__mini-sky';
  el.appendChild(miniSky);

  // Info column
  const info = document.createElement('div');
  info.className = 'sessionflow-sky-hud__info';

  const time = document.createElement('span');
  time.className = 'sessionflow-sky-hud__time';
  time.textContent = formatGameTime(data.hour, data.minute, data.format);
  info.appendChild(time);

  if (data.label) {
    const label = document.createElement('span');
    label.className = 'sessionflow-sky-hud__label';
    label.textContent = data.label;
    info.appendChild(label);
  }

  el.appendChild(info);

  // Restore saved position from localStorage
  const savedPos = _getSkyHudPosition();
  if (savedPos) {
    el.style.top = `${savedPos.y}px`;
    el.style.left = `${savedPos.x}px`;
    el.style.right = 'auto';
  }

  // Make draggable
  _makeSkyHudDraggable(el);

  document.body.appendChild(el);
  _activeSkyHud = el;
}

/**
 * Update existing sky HUD with new time data.
 */
function _updateSkyHud(data) {
  if (data.widgetId && _skyHudState?.widgetId && data.widgetId !== _skyHudState.widgetId) {
    return;
  }

  // Cancel any running animation (e.g. from animateSky completing before updateWorldTime)
  if (_skyHudAnimCancel) {
    _skyHudAnimCancel();
    _skyHudAnimCancel = null;
  }

  if (!_activeSkyHud) {
    _showSkyHud(data);
    return;
  }

  // Keep HUD state in sync
  if (data.format || Object.prototype.hasOwnProperty.call(data, 'label') || data.widgetId) {
    _skyHudState = {
      format: data.format || _skyHudState?.format || '24h',
      label: data.label ?? _skyHudState?.label ?? '',
      widgetId: data.widgetId || _skyHudState?.widgetId || null
    };
  }

  // In-place mini sky update (gradient + celestial positions, no DOM replacement)
  const miniSky = _activeSkyHud.querySelector('.sessionflow-sky-hud__mini-sky');
  if (miniSky) {
    updateMiniSkyCelestials(miniSky, data.hour, data.minute);
  }

  // Update time
  const format = data.format || _skyHudState?.format || '24h';
  const timeEl = _activeSkyHud.querySelector('.sessionflow-sky-hud__time');
  if (timeEl) timeEl.textContent = formatGameTime(data.hour, data.minute, format);

  // Update label
  let labelEl = _activeSkyHud.querySelector('.sessionflow-sky-hud__label');
  if (data.label) {
    if (labelEl) {
      labelEl.textContent = data.label;
    } else {
      labelEl = document.createElement('span');
      labelEl.className = 'sessionflow-sky-hud__label';
      labelEl.textContent = data.label;
      _activeSkyHud.querySelector('.sessionflow-sky-hud__info')?.appendChild(labelEl);
    }
  } else if (labelEl) {
    labelEl.remove();
  }
}

/**
 * Animate the sky HUD smoothly from one time to another.
 * Called when GM advances time with broadcast active.
 */
function _animateSkyHud(data) {
  if (data.widgetId && _skyHudState?.widgetId && data.widgetId !== _skyHudState.widgetId) {
    return;
  }

  if (!_activeSkyHud) return;

  // Cancel any running animation
  if (_skyHudAnimCancel) {
    _skyHudAnimCancel();
    _skyHudAnimCancel = null;
  }

  // Keep HUD state in sync
  if (data.format || Object.prototype.hasOwnProperty.call(data, 'label') || data.widgetId) {
    _skyHudState = {
      format: data.format || _skyHudState?.format || '24h',
      label: data.label ?? _skyHudState?.label ?? '',
      widgetId: data.widgetId || _skyHudState?.widgetId || null
    };
  }

  const miniSky = _activeSkyHud.querySelector('.sessionflow-sky-hud__mini-sky');
  if (!miniSky) return;

  const fromFrac = timeToFraction(data.fromHour, data.fromMinute);
  const toFrac = timeToFraction(data.toHour, data.toMinute);
  const format = data.format || _skyHudState?.format || '24h';
  const timeEl = _activeSkyHud.querySelector('.sessionflow-sky-hud__time');

  _skyHudAnimCancel = animateMiniSky(miniSky, fromFrac, toFrac, data.duration, (currentFrac) => {
    // Update time display during animation
    if (timeEl) {
      const displayH = Math.floor(currentFrac);
      const displayM = Math.floor((currentFrac - displayH) * 60);
      timeEl.textContent = formatGameTime(displayH, displayM, format);
    }
  });
}

/**
 * Remove the sky HUD.
 */
function _removeSkyHud(widgetId = null, { immediate = false } = {}) {
  if (widgetId && _skyHudState?.widgetId && widgetId !== _skyHudState.widgetId) {
    return;
  }

  if (_skyHudAnimCancel) {
    _skyHudAnimCancel();
    _skyHudAnimCancel = null;
  }

  if (!_activeSkyHud) {
    _skyHudState = null;
    return;
  }

  const el = _activeSkyHud;
  _activeSkyHud = null;
  _skyHudState = null;

  if (immediate) {
    el.remove();
    return;
  }

  el.classList.add('is-leaving');
  setTimeout(() => el.remove(), 300);
}

/**
 * Flash a dramatic sky popup (center-screen, auto-dismiss).
 */
function _flashSkyPopup(data) {
  const el = document.createElement('div');
  el.className = 'sessionflow-sky-flash';

  // Full detail for flash popup (larger size benefits from enhanced visuals)
  const sky = buildMiniSkyElement(data, 200, 50, 'sf-sky-flash', 'full');
  sky.className = 'sessionflow-sky-flash__sky';
  el.appendChild(sky);

  const time = document.createElement('div');
  time.className = 'sessionflow-sky-flash__time';
  time.textContent = formatGameTime(data.hour, data.minute, data.format);
  el.appendChild(time);

  if (data.label) {
    const label = document.createElement('div');
    label.className = 'sessionflow-sky-flash__label';
    label.textContent = data.label;
    el.appendChild(label);
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

/* ---- Sky HUD Dragging ---- */

function _makeSkyHudDraggable(el) {
  let isDragging = false;
  let startX, startY, origX, origY;

  el.addEventListener('pointerdown', (e) => {
    // Don't drag if clicking interactive children
    if (e.target.closest('button, a, input, select')) return;

    isDragging = true;
    el.classList.add('is-dragging');
    startX = e.clientX;
    startY = e.clientY;

    const rect = el.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;

    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = `${origX + dx}px`;
    el.style.top = `${origY + dy}px`;
    el.style.right = 'auto';
  });

  el.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('is-dragging');

    // Save position
    const rect = el.getBoundingClientRect();
    _saveSkyHudPosition(rect.left, rect.top);
  });
}

function _getSkyHudPosition() {
  try {
    const raw = localStorage.getItem('sessionflow.skyHudPosition');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function _saveSkyHudPosition(x, y) {
  try {
    localStorage.setItem('sessionflow.skyHudPosition', JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

/* ---------------------------------------- */
/*  Time Tracker HUD                        */
/* ---------------------------------------- */

/** @type {HTMLElement|null} */
let _activeTrackerHud = null;

/** @type {object|null} Last known tracker HUD state */
let _trackerHudState = null;

/**
 * Build a mini SVG ring for the tracker HUD/flash.
 * @param {object} data - Tracker payload
 * @param {number} size - Ring size in px
 * @returns {SVGElement}
 */
function _buildMiniTrackerRing(data, size) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'sessionflow-tracker-hud__ring-svg');

  const accent = data.color || '#7c5cbf';
  const style = data.ringStyle || 'arc';
  const rate = data.conversionRate || 0;
  const hasSecondary = !!data.secondaryLabel;
  const count = data.count ?? 0;
  const progress = (rate > 0 && hasSecondary) ? (count % rate) / rate : 0;

  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  // Glow filter (shared across styles)
  const defs = document.createElementNS(svgNS, 'defs');
  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', `sf-tt-mini-glow-${Date.now()}`);
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');
  const blur = document.createElementNS(svgNS, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '3');
  blur.setAttribute('result', 'glow');
  filter.appendChild(blur);
  const merge = document.createElementNS(svgNS, 'feMerge');
  const mn1 = document.createElementNS(svgNS, 'feMergeNode');
  mn1.setAttribute('in', 'glow');
  merge.appendChild(mn1);
  const mn2 = document.createElementNS(svgNS, 'feMergeNode');
  mn2.setAttribute('in', 'SourceGraphic');
  merge.appendChild(mn2);
  filter.appendChild(merge);
  defs.appendChild(filter);
  svg.appendChild(defs);
  const filterId = filter.getAttribute('id');

  if (style === 'pulse') {
    // Pulse: filled circle with accent glow
    const glowCircle = document.createElementNS(svgNS, 'circle');
    glowCircle.setAttribute('cx', '60');
    glowCircle.setAttribute('cy', '60');
    glowCircle.setAttribute('r', '50');
    glowCircle.setAttribute('fill', accent);
    glowCircle.setAttribute('opacity', '0.08');
    glowCircle.setAttribute('filter', `url(#${filterId})`);
    svg.appendChild(glowCircle);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', '48');
    circle.setAttribute('fill', accent);
    circle.setAttribute('opacity', '0.15');
    circle.setAttribute('class', 'sessionflow-tracker-hud__pulse');
    svg.appendChild(circle);

    const ring = document.createElementNS(svgNS, 'circle');
    ring.setAttribute('cx', '60');
    ring.setAttribute('cy', '60');
    ring.setAttribute('r', '48');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', accent);
    ring.setAttribute('stroke-width', '2');
    ring.setAttribute('opacity', '0.4');
    svg.appendChild(ring);
  } else if (style === 'sundial') {
    // Sundial: prominent tick marks around perimeter
    const numTicks = (rate > 0 && hasSecondary) ? rate : 12;
    const activeTicks = Math.floor(progress * numTicks);
    const outerR = 57, innerR = 44; // Longer ticks for visibility at small sizes

    // Subtle background ring
    const bgRing = document.createElementNS(svgNS, 'circle');
    bgRing.setAttribute('cx', '60');
    bgRing.setAttribute('cy', '60');
    bgRing.setAttribute('r', String(radius));
    bgRing.setAttribute('fill', 'none');
    bgRing.setAttribute('stroke', 'rgba(255,255,255,0.04)');
    bgRing.setAttribute('stroke-width', '2');
    svg.appendChild(bgRing);

    for (let i = 0; i < numTicks; i++) {
      const angle = ((i / numTicks) * 360 - 90) * (Math.PI / 180);
      const isMajor = numTicks >= 12 ? (i % 3 === 0) : true;
      const tickInner = isMajor ? innerR : innerR + 3;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(60 + outerR * Math.cos(angle)));
      line.setAttribute('y1', String(60 + outerR * Math.sin(angle)));
      line.setAttribute('x2', String(60 + tickInner * Math.cos(angle)));
      line.setAttribute('y2', String(60 + tickInner * Math.sin(angle)));
      line.setAttribute('stroke-width', isMajor ? '3' : '2');
      line.setAttribute('stroke-linecap', 'round');

      if (i < activeTicks) {
        line.setAttribute('stroke', accent);
        line.setAttribute('filter', `url(#${filterId})`);
      } else {
        // Always show ticks visibly in accent color at reduced opacity
        line.setAttribute('stroke', accent);
        line.setAttribute('opacity', '0.2');
      }

      svg.appendChild(line);
    }

    // Progress arc underneath
    if (progress > 0) {
      const offset = circumference * (1 - progress);
      const arc = document.createElementNS(svgNS, 'circle');
      arc.setAttribute('cx', '60');
      arc.setAttribute('cy', '60');
      arc.setAttribute('r', String(radius));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', accent);
      arc.setAttribute('stroke-width', '3');
      arc.setAttribute('stroke-linecap', 'round');
      arc.setAttribute('stroke-dasharray', String(circumference));
      arc.setAttribute('stroke-dashoffset', String(offset));
      arc.setAttribute('transform', 'rotate(-90 60 60)');
      arc.setAttribute('opacity', '0.35');
      svg.appendChild(arc);
    }
  } else {
    // Arc (default): track + progress arc with glow
    const outerRing = document.createElementNS(svgNS, 'circle');
    outerRing.setAttribute('cx', '60');
    outerRing.setAttribute('cy', '60');
    outerRing.setAttribute('r', '56');
    outerRing.setAttribute('fill', 'none');
    outerRing.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    outerRing.setAttribute('stroke-width', '1');
    svg.appendChild(outerRing);

    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', '60');
    track.setAttribute('cy', '60');
    track.setAttribute('r', String(radius));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    track.setAttribute('stroke-width', '5');
    svg.appendChild(track);

    const offset = circumference * (1 - progress);
    const arc = document.createElementNS(svgNS, 'circle');
    arc.setAttribute('cx', '60');
    arc.setAttribute('cy', '60');
    arc.setAttribute('r', String(radius));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', accent);
    arc.setAttribute('stroke-width', '5');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', String(circumference));
    arc.setAttribute('stroke-dashoffset', String(offset));
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    if (progress > 0) arc.setAttribute('filter', `url(#${filterId})`);
    svg.appendChild(arc);

    const innerRing = document.createElementNS(svgNS, 'circle');
    innerRing.setAttribute('cx', '60');
    innerRing.setAttribute('cy', '60');
    innerRing.setAttribute('r', '40');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', 'rgba(255,255,255,0.04)');
    innerRing.setAttribute('stroke-width', '0.5');
    svg.appendChild(innerRing);
  }

  // Center icon (FA class or img: path) — rendered as foreignObject
  const centerIcon = data.centerIcon;
  if (centerIcon) {
    const fo = document.createElementNS(svgNS, 'foreignObject');
    fo.setAttribute('x', '20');
    fo.setAttribute('y', '20');
    fo.setAttribute('width', '80');
    fo.setAttribute('height', '80');
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    if (centerIcon.startsWith('img:')) {
      const img = document.createElement('img');
      img.src = centerIcon.slice(4);
      img.style.cssText = 'width:50%;height:50%;object-fit:contain;opacity:0.8;';
      iconWrap.appendChild(img);
    } else {
      const i = document.createElement('i');
      i.className = centerIcon;
      i.style.cssText = `font-size:32px;color:${accent};opacity:0.7;`;
      iconWrap.appendChild(i);
    }
    fo.appendChild(iconWrap);
    svg.appendChild(fo);
  }

  return svg;
}

/**
 * Show persistent tracker HUD.
 */
function _showTrackerHud(data) {
  _removeTrackerHud(null, { immediate: true });

  _trackerHudState = { ...data };

  const el = document.createElement('div');
  el.className = 'sessionflow-tracker-hud';
  if (data.widgetId) el.dataset.widgetId = data.widgetId;

  // Mini ring
  const ring = _buildMiniTrackerRing(data, 48);
  el.appendChild(ring);

  // Info column
  const info = document.createElement('div');
  info.className = 'sessionflow-tracker-hud__info';

  // Primary count + label
  const primary = document.createElement('div');
  primary.className = 'sessionflow-tracker-hud__primary';

  const countEl = document.createElement('span');
  countEl.className = 'sessionflow-tracker-hud__count';
  countEl.textContent = String(data.count ?? 0);
  if (data.color) countEl.style.color = data.color;
  primary.appendChild(countEl);

  const labelEl = document.createElement('span');
  labelEl.className = 'sessionflow-tracker-hud__label';
  labelEl.textContent = data.label || '';
  primary.appendChild(labelEl);

  info.appendChild(primary);

  // Secondary (if present)
  if (data.secondaryLabel) {
    const secondary = document.createElement('div');
    secondary.className = 'sessionflow-tracker-hud__secondary';
    secondary.textContent = `${data.secondaryCount ?? 0} ${data.secondaryLabel}`;
    info.appendChild(secondary);
  }

  el.appendChild(info);

  // Badge (if present)
  if (data.badgeLabel) {
    const badge = document.createElement('span');
    badge.className = 'sessionflow-tracker-hud__badge';
    if (data.color) {
      badge.style.background = `color-mix(in srgb, ${data.color} 20%, transparent)`;
      badge.style.borderColor = `color-mix(in srgb, ${data.color} 35%, transparent)`;
    }
    badge.textContent = data.badgeLabel;
    el.appendChild(badge);
  }

  // Restore saved position
  const savedPos = _getTrackerHudPosition();
  if (savedPos) {
    el.style.top = `${savedPos.y}px`;
    el.style.left = `${savedPos.x}px`;
    el.style.right = 'auto';
  }

  _makeTrackerHudDraggable(el);
  document.body.appendChild(el);
  _activeTrackerHud = el;

  requestAnimationFrame(() => el.classList.add('is-visible'));
}

/**
 * Update existing tracker HUD with new data.
 */
function _updateTrackerHud(data) {
  if (data.widgetId && _trackerHudState?.widgetId && data.widgetId !== _trackerHudState.widgetId) {
    return;
  }

  _trackerHudState = { ...data };

  if (!_activeTrackerHud) {
    _showTrackerHud(data);
    return;
  }

  // Replace ring
  const oldRing = _activeTrackerHud.querySelector('.sessionflow-tracker-hud__ring-svg');
  const newRing = _buildMiniTrackerRing(data, 48);
  if (oldRing) {
    oldRing.replaceWith(newRing);
  } else {
    _activeTrackerHud.prepend(newRing);
  }

  // Update count
  const countEl = _activeTrackerHud.querySelector('.sessionflow-tracker-hud__count');
  if (countEl) {
    countEl.textContent = String(data.count ?? 0);
    if (data.color) countEl.style.color = data.color;
    else countEl.style.removeProperty('color');
  }

  // Update label
  const labelEl = _activeTrackerHud.querySelector('.sessionflow-tracker-hud__label');
  if (labelEl) labelEl.textContent = data.label || '';

  // Update secondary
  let secondaryEl = _activeTrackerHud.querySelector('.sessionflow-tracker-hud__secondary');
  if (data.secondaryLabel) {
    if (secondaryEl) {
      secondaryEl.textContent = `${data.secondaryCount ?? 0} ${data.secondaryLabel}`;
    } else {
      secondaryEl = document.createElement('div');
      secondaryEl.className = 'sessionflow-tracker-hud__secondary';
      secondaryEl.textContent = `${data.secondaryCount ?? 0} ${data.secondaryLabel}`;
      _activeTrackerHud.querySelector('.sessionflow-tracker-hud__info')?.appendChild(secondaryEl);
    }
  } else if (secondaryEl) {
    secondaryEl.remove();
  }

  // Update badge
  let badgeEl = _activeTrackerHud.querySelector('.sessionflow-tracker-hud__badge');
  if (data.badgeLabel) {
    if (badgeEl) {
      badgeEl.textContent = data.badgeLabel;
    } else {
      badgeEl = document.createElement('span');
      badgeEl.className = 'sessionflow-tracker-hud__badge';
      badgeEl.textContent = data.badgeLabel;
      _activeTrackerHud.appendChild(badgeEl);
    }
    if (data.color) {
      badgeEl.style.background = `color-mix(in srgb, ${data.color} 20%, transparent)`;
      badgeEl.style.borderColor = `color-mix(in srgb, ${data.color} 35%, transparent)`;
    }
  } else if (badgeEl) {
    badgeEl.remove();
  }
}

/**
 * Remove the tracker HUD.
 */
function _removeTrackerHud(widgetId = null, { immediate = false } = {}) {
  if (widgetId && _trackerHudState?.widgetId && widgetId !== _trackerHudState.widgetId) {
    return;
  }

  if (!_activeTrackerHud) {
    _trackerHudState = null;
    return;
  }

  const el = _activeTrackerHud;
  _activeTrackerHud = null;
  _trackerHudState = null;

  if (immediate) {
    el.remove();
    return;
  }

  el.classList.add('is-leaving');
  setTimeout(() => el.remove(), 300);
}

/**
 * Flash a dramatic tracker popup (center-screen, auto-dismiss).
 */
function _flashTrackerPopup(data) {
  const el = document.createElement('div');
  el.className = 'sessionflow-tracker-flash';

  // Large ring
  const ring = _buildMiniTrackerRing(data, 100);
  ring.classList.add('sessionflow-tracker-flash__ring');
  el.appendChild(ring);

  // Count
  const countEl = document.createElement('div');
  countEl.className = 'sessionflow-tracker-flash__count';
  countEl.textContent = String(data.count ?? 0);
  if (data.color) countEl.style.color = data.color;
  el.appendChild(countEl);

  // Label
  const labelEl = document.createElement('div');
  labelEl.className = 'sessionflow-tracker-flash__label';
  labelEl.textContent = data.label || '';
  el.appendChild(labelEl);

  // Secondary
  if (data.secondaryLabel) {
    const secondary = document.createElement('div');
    secondary.className = 'sessionflow-tracker-flash__secondary';
    secondary.textContent = `${data.secondaryCount ?? 0} ${data.secondaryLabel}`;
    el.appendChild(secondary);
  }

  // Badge
  if (data.badgeLabel) {
    const badge = document.createElement('div');
    badge.className = 'sessionflow-tracker-flash__badge';
    if (data.color) {
      badge.style.background = `color-mix(in srgb, ${data.color} 20%, transparent)`;
      badge.style.borderColor = `color-mix(in srgb, ${data.color} 35%, transparent)`;
    }
    badge.textContent = data.badgeLabel;
    el.appendChild(badge);
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

/* ---- Tracker HUD Dragging ---- */

function _makeTrackerHudDraggable(el) {
  let isDragging = false;
  let startX, startY, origX, origY;

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, select')) return;
    isDragging = true;
    el.classList.add('is-dragging');
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    el.style.left = `${origX + (e.clientX - startX)}px`;
    el.style.top = `${origY + (e.clientY - startY)}px`;
    el.style.right = 'auto';
  });

  el.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('is-dragging');
    const rect = el.getBoundingClientRect();
    _saveTrackerHudPosition(rect.left, rect.top);
  });
}

function _getTrackerHudPosition() {
  try {
    const raw = localStorage.getItem('sessionflow.trackerHudPosition');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function _saveTrackerHudPosition(x, y) {
  try {
    localStorage.setItem('sessionflow.trackerHudPosition', JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

/* ---------------------------------------- */
/*  Keybindings                             */
/* ---------------------------------------- */

function _registerKeybindings() {
  game.keybindings.register(MODULE_ID, 'togglePanel', {
    name: 'SESSIONFLOW.Controls.TogglePanel',
    hint: 'SESSIONFLOW.Controls.TogglePanel',
    editable: [{ key: 'KeyS', modifiers: ['Shift'] }],
    onDown: () => {
      Hooks.call('sessionflow:togglePanel');
      return true;
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Player panel toggle (available to all users)
  game.keybindings.register(MODULE_ID, 'togglePlayerPanel', {
    name: 'SESSIONFLOW.Controls.TogglePlayerPanel',
    hint: 'SESSIONFLOW.Controls.TogglePlayerPanelHint',
    editable: [{ key: 'KeyP', modifiers: ['Shift'] }],
    onDown: () => {
      if (!playerPanel) return false;
      if (playerPanel.isOpen) {
        playerPanel.close();
      } else {
        playerPanel.open(game.user.isGM ? { gmEditorMode: true } : {});
      }
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // Character quick slots (3 configurable keybindings)
  game.keybindings.register(MODULE_ID, 'characterSlot1', {
    name: 'SESSIONFLOW.Controls.CharacterSlot1',
    hint: 'SESSIONFLOW.Controls.CharacterSlot1Hint',
    editable: [{ key: 'KeyQ', modifiers: ['Shift'] }],
    onDown: () => { _openCharacterSlot(1); return true; },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, 'characterSlot2', {
    name: 'SESSIONFLOW.Controls.CharacterSlot2',
    hint: 'SESSIONFLOW.Controls.CharacterSlot2Hint',
    editable: [{ key: 'KeyW', modifiers: ['Shift'] }],
    onDown: () => { _openCharacterSlot(2); return true; },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, 'characterSlot3', {
    name: 'SESSIONFLOW.Controls.CharacterSlot3',
    hint: 'SESSIONFLOW.Controls.CharacterSlot3Hint',
    editable: [{ key: 'KeyE', modifiers: ['Shift'] }],
    onDown: () => { _openCharacterSlot(3); return true; },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}

/* ---------------------------------------- */
/*  Character Quick Slot Handler            */
/* ---------------------------------------- */

function _openCharacterSlot(slotNumber) {
  const slots = game.settings.get(MODULE_ID, 'characterQuickSlots');
  const characterId = slots?.[`slot${slotNumber}`];
  if (!characterId) return;

  // Toggle: if already open for this character, close
  if (characterPanel?.isOpen && characterPanel?.characterId === characterId) {
    characterPanel.close();
    return;
  }

  // Close other panels quietly
  panel?.closeQuiet();
  storylinePanel?.close();
  beatPanel?.closeQuiet();
  scenePanel?.closeQuiet();

  // Open character panel (no scene context — opened via quick slot)
  characterPanel?.open(characterId, null);
}

/* ======================================================================== */
/*  Map HUD — Broadcast to Players                                          */
/* ======================================================================== */

/** @type {HTMLElement|null} */
let _activeMapHud = null;

/** @type {{ widgetId: string, mapSrc: string, mapName: string }|null} */
let _mapHudState = null;

/**
 * Build a map view element (shared between HUD and flash).
 * @param {object} data - Map payload.
 * @param {string} prefix - CSS class prefix ('sessionflow-map-hud' or 'sessionflow-map-flash').
 * @returns {HTMLElement}
 */
function _buildMapView(data, prefix) {
  const viewport = document.createElement('div');
  viewport.className = `${prefix}__viewport`;

  const layer = document.createElement('div');
  layer.className = `${prefix}__map-layer`;
  layer.style.transformOrigin = '0 0';

  if (data.mapSrc) {
    const img = document.createElement('img');
    img.src = data.mapSrc;
    img.draggable = false;
    // Auto-fit the map to the HUD/flash viewport after image loads
    const fitToViewport = () => {
      const vpW = viewport.clientWidth;
      const vpH = viewport.clientHeight;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      if (vpW && vpH && imgW && imgH) {
        const zoom = Math.min(vpW / imgW, vpH / imgH);
        const panX = (vpW - imgW * zoom) / 2;
        const panY = (vpH - imgH * zoom) / 2;
        layer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      } else {
        // Fallback to source viewport
        const vp = data.viewport || { panX: 0, panY: 0, zoom: 1 };
        layer.style.transform = `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`;
      }
    };
    if (img.complete) requestAnimationFrame(fitToViewport);
    else img.addEventListener('load', fitToViewport, { once: true });
    layer.appendChild(img);
  }

  // Grid overlay
  const grid = data.grid;
  if (grid?.enabled && data.mapSrc) {
    // Grid is rendered after image loads to get natural dimensions
    const img = layer.querySelector('img');
    if (img) {
      const renderGrid = () => {
        const w = img.naturalWidth || 800;
        const h = img.naturalHeight || 600;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        const cellSize = grid.cellSize || 40;
        for (let x = cellSize; x < w; x += cellSize) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x); line.setAttribute('y1', 0);
          line.setAttribute('x2', x); line.setAttribute('y2', h);
          line.setAttribute('stroke', grid.color || '#ffffff');
          line.setAttribute('stroke-opacity', grid.opacity ?? 0.3);
          line.setAttribute('stroke-width', '1');
          svg.appendChild(line);
        }
        for (let y = cellSize; y < h; y += cellSize) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', 0); line.setAttribute('y1', y);
          line.setAttribute('x2', w); line.setAttribute('y2', y);
          line.setAttribute('stroke', grid.color || '#ffffff');
          line.setAttribute('stroke-opacity', grid.opacity ?? 0.3);
          line.setAttribute('stroke-width', '1');
          svg.appendChild(line);
        }
        layer.appendChild(svg);
      };
      if (img.complete) renderGrid();
      else img.addEventListener('load', renderGrid, { once: true });
    }
  }

  // Markers
  if (Array.isArray(data.markers)) {
    for (const marker of data.markers) {
      const el = document.createElement('div');
      el.className = `${prefix}__marker ${prefix}__marker--${marker.size || 'md'}`;
      el.style.left = `${marker.x}px`;
      el.style.top = `${marker.y}px`;
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.setProperty('--sf-marker-color', marker.color || '#4a90d9');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.pointerEvents = 'none';

      if (marker.type === 'icon') {
        const icon = document.createElement('i');
        icon.className = marker.icon || 'fas fa-location-dot';
        el.appendChild(icon);
        if (marker.label) {
          const lbl = document.createElement('span');
          lbl.className = `${prefix}__marker-label`;
          lbl.textContent = marker.label;
          el.appendChild(lbl);
        }
      } else {
        const txt = document.createElement('span');
        txt.className = `${prefix}__marker-text`;
        txt.textContent = marker.label || 'Text';
        el.appendChild(txt);
      }

      layer.appendChild(el);
    }
  }

  viewport.appendChild(layer);
  return viewport;
}

/**
 * Show a map broadcast HUD.
 */
function _showMapHud(data) {
  if (!data?.mapSrc) return;

  // Remove existing HUD for this widget
  _removeMapHud(data.widgetId, { immediate: true });

  _mapHudState = {
    widgetId: data.widgetId,
    mapSrc: data.mapSrc,
    mapName: data.mapName || 'Map'
  };

  const container = document.createElement('div');
  container.className = 'sessionflow-map-hud';
  container.dataset.senderId = data.senderId || '';
  container.dataset.widgetId = data.widgetId || '';

  // Header with drag handle
  const header = document.createElement('div');
  header.className = 'sessionflow-map-hud__header';

  const icon = document.createElement('i');
  icon.className = 'fas fa-map sessionflow-map-hud__header-icon';
  header.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'sessionflow-map-hud__header-title';
  title.textContent = data.mapName || 'Map';
  header.appendChild(title);

  container.appendChild(header);

  // Map viewport
  container.appendChild(_buildMapView(data, 'sessionflow-map-hud'));

  // Scale bar
  const grid = data.grid;
  if (grid?.enabled) {
    const scaleEl = _buildMapScaleBar(data, 'sessionflow-map-hud');
    container.appendChild(scaleEl);
  }

  // Position
  const pos = _loadMapHudPosition();
  container.style.left = `${pos.x}px`;
  container.style.top = `${pos.y}px`;

  document.body.appendChild(container);
  _activeMapHud = container;

  // Animate in
  requestAnimationFrame(() => container.classList.add('is-visible'));

  // Dragging
  _makeMapHudDraggable(container, header);
}

/**
 * Update an existing map HUD.
 */
function _updateMapHud(data) {
  if (!data?.widgetId) return;
  if (_mapHudState?.widgetId !== data.widgetId) return;

  if (!_activeMapHud) {
    _showMapHud(data);
    return;
  }

  // Rebuild viewport content
  const oldViewport = _activeMapHud.querySelector('.sessionflow-map-hud__viewport');
  if (oldViewport) {
    const newViewport = _buildMapView(data, 'sessionflow-map-hud');
    oldViewport.replaceWith(newViewport);
  }

  // Update title
  const titleEl = _activeMapHud.querySelector('.sessionflow-map-hud__header-title');
  if (titleEl) titleEl.textContent = data.mapName || 'Map';

  // Update scale bar
  const oldScale = _activeMapHud.querySelector('.sessionflow-map-hud__scale');
  oldScale?.remove();
  if (data.grid?.enabled) {
    _activeMapHud.appendChild(_buildMapScaleBar(data, 'sessionflow-map-hud'));
  }

  _mapHudState.mapSrc = data.mapSrc;
  _mapHudState.mapName = data.mapName;
}

/**
 * Remove the map HUD.
 */
function _removeMapHud(widgetId, { immediate = false } = {}) {
  if (_mapHudState && widgetId && _mapHudState.widgetId !== widgetId) return;
  if (!_activeMapHud) {
    _mapHudState = null;
    return;
  }

  const el = _activeMapHud;
  _activeMapHud = null;
  _mapHudState = null;

  if (immediate) {
    el.remove();
  } else {
    el.classList.add('is-leaving');
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }
}

/**
 * Flash a map popup dramatically.
 */
function _flashMapPopup(data) {
  if (!data?.mapSrc) return;

  const container = document.createElement('div');
  container.className = 'sessionflow-map-flash';

  const title = document.createElement('div');
  title.className = 'sessionflow-map-flash__title';
  title.textContent = data.mapName || 'Map';
  container.appendChild(title);

  container.appendChild(_buildMapView(data, 'sessionflow-map-flash'));

  document.body.appendChild(container);
  requestAnimationFrame(() => container.classList.add('is-visible'));

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    container.classList.add('is-leaving');
    container.classList.remove('is-visible');
    setTimeout(() => container.remove(), 400);
  }, 4000);
}

/**
 * Build a mini scale bar for the HUD.
 */
function _buildMapScaleBar(data, prefix) {
  const bar = document.createElement('div');
  bar.className = `${prefix}__scale`;

  const grid = data.grid;
  const vp = data.viewport || { zoom: 1 };
  const cellPx = (grid.cellSize || 40) * vp.zoom;
  const numCells = Math.min(5, Math.max(2, Math.floor(150 / cellPx)));
  const barWidth = numCells * cellPx;

  const track = document.createElement('div');
  track.className = `${prefix}__scale-track`;
  track.style.width = `${barWidth}px`;

  for (let i = 0; i < numCells; i++) {
    const cell = document.createElement('div');
    cell.className = `${prefix}__scale-cell`;
    cell.style.width = `${cellPx}px`;
    if (i % 2 === 0) cell.classList.add('is-filled');
    track.appendChild(cell);
  }

  bar.appendChild(track);

  const label = document.createElement('span');
  label.className = `${prefix}__scale-label`;
  label.textContent = `${numCells} × ${grid.unit || '5ft'}`;
  bar.appendChild(label);

  return bar;
}

/* -- Map HUD dragging -- */

function _makeMapHudDraggable(container, handle) {
  let dragState = null;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      originX: container.offsetLeft,
      originY: container.offsetTop
    };
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    e.preventDefault();
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    container.style.left = `${dragState.originX + dx}px`;
    container.style.top = `${dragState.originY + dy}px`;
  });

  handle.addEventListener('pointerup', (e) => {
    if (!dragState) return;
    _saveMapHudPosition(container.offsetLeft, container.offsetTop);
    dragState = null;
  });
}

function _loadMapHudPosition() {
  try {
    const stored = localStorage.getItem('sessionflow.mapHudPosition');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { x: window.innerWidth - 420, y: window.innerHeight - 340 };
}

function _saveMapHudPosition(x, y) {
  try {
    localStorage.setItem('sessionflow.mapHudPosition', JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

/* ============================================ */
/*  Quest HUD (Persistent Player Overlay)       */
/* ============================================ */

/** @type {HTMLElement|null} */
let _activeQuestHud = null;

/** @type {{ widgetId: string }|null} */
let _questHudState = null;

function _showQuestHud(data) {
  if (!data?.quests?.length) return;

  _removeQuestHud(data.widgetId, { immediate: true });

  _questHudState = { widgetId: data.widgetId };

  const container = document.createElement('div');
  container.className = 'sessionflow-quest-hud';
  container.dataset.widgetId = data.widgetId || '';

  // Header (draggable)
  const header = document.createElement('div');
  header.className = 'sessionflow-quest-hud__header';

  const icon = document.createElement('i');
  icon.className = 'fas fa-scroll sessionflow-quest-hud__header-icon';
  header.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'sessionflow-quest-hud__header-title';
  title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.QuestTracker');
  header.appendChild(title);

  container.appendChild(header);

  // Quest list
  container.appendChild(_buildQuestHudList(data.quests));

  // Position
  const pos = _loadQuestHudPosition();
  container.style.left = `${pos.x}px`;
  container.style.top = `${pos.y}px`;

  document.body.appendChild(container);
  _activeQuestHud = container;

  requestAnimationFrame(() => container.classList.add('is-visible'));

  _makeQuestHudDraggable(container, header);
}

function _updateQuestHud(data) {
  if (!data?.widgetId) return;
  if (_questHudState?.widgetId !== data.widgetId) return;

  if (!_activeQuestHud) {
    _showQuestHud(data);
    return;
  }

  // Replace quest list content
  const oldList = _activeQuestHud.querySelector('.sessionflow-quest-hud__list');
  if (oldList && data.quests) {
    const newList = _buildQuestHudList(data.quests);
    oldList.replaceWith(newList);
  }
}

function _removeQuestHud(widgetId, { immediate = false } = {}) {
  if (_questHudState?.widgetId && widgetId && _questHudState.widgetId !== widgetId) return;

  if (_activeQuestHud) {
    if (immediate) {
      _activeQuestHud.remove();
    } else {
      _activeQuestHud.classList.add('is-leaving');
      _activeQuestHud.classList.remove('is-visible');
      const el = _activeQuestHud;
      setTimeout(() => el.remove(), 300);
    }
  }

  _activeQuestHud = null;
  _questHudState = null;
}

function _buildQuestHudList(quests) {
  const list = document.createElement('div');
  list.className = 'sessionflow-quest-hud__list';

  for (const quest of quests) {
    const qEl = document.createElement('div');
    qEl.className = 'sessionflow-quest-hud__quest';
    if (quest.status) qEl.classList.add(`is-${quest.status}`);
    qEl.style.setProperty('--sf-quest-color', quest.color || '#a78bfa');

    // Header row
    const qHeader = document.createElement('div');
    qHeader.className = 'sessionflow-quest-hud__quest-header';

    const qIcon = document.createElement('span');
    qIcon.className = 'sessionflow-quest-hud__quest-icon';
    const iconClass = quest.icon || 'fas fa-scroll';
    if (iconClass.startsWith('img:')) {
      qIcon.innerHTML = `<img src="${iconClass.slice(4)}" style="width:14px;height:14px;object-fit:contain;border-radius:2px;">`;
    } else {
      qIcon.innerHTML = `<i class="${iconClass}"></i>`;
    }
    qHeader.appendChild(qIcon);

    const qTitle = document.createElement('span');
    qTitle.className = 'sessionflow-quest-hud__quest-title';
    qTitle.textContent = quest.title;
    qHeader.appendChild(qTitle);

    if (quest.total > 0) {
      const qProg = document.createElement('span');
      qProg.className = 'sessionflow-quest-hud__quest-progress';
      qProg.textContent = `${quest.done}/${quest.total}`;
      qHeader.appendChild(qProg);
    }

    qEl.appendChild(qHeader);

    // Objectives
    if (quest.objectives?.length > 0) {
      const objList = document.createElement('div');
      objList.className = 'sessionflow-quest-hud__objectives';

      for (const obj of quest.objectives) {
        const objEl = document.createElement('div');
        objEl.className = 'sessionflow-quest-hud__obj';

        const objIcon = document.createElement('span');
        objIcon.className = 'sessionflow-quest-hud__obj-icon';

        if (obj.hidden && !obj.completed) {
          // Secret objective
          objEl.classList.add('is-secret');
          objIcon.innerHTML = '<i class="fas fa-question"></i>';
          objEl.appendChild(objIcon);

          const objText = document.createElement('span');
          objText.textContent = game.i18n.localize('SESSIONFLOW.Canvas.QuestSecretObjective');
          objEl.appendChild(objText);
        } else {
          if (obj.completed) objEl.classList.add('is-checked');
          objIcon.innerHTML = obj.completed ? '<i class="fas fa-check"></i>' : '<i class="far fa-circle"></i>';
          objEl.appendChild(objIcon);

          const objText = document.createElement('span');
          objText.textContent = obj.text || '???';
          objEl.appendChild(objText);
        }

        objList.appendChild(objEl);
      }

      qEl.appendChild(objList);
    }

    // Reward (only visible when completed)
    if ((quest.reward || quest.rewardImage) && quest.status === 'completed') {
      const rewardWrap = document.createElement('div');
      rewardWrap.className = 'sessionflow-quest-hud__reward-wrap';

      if (quest.rewardImage) {
        const img = document.createElement('img');
        img.className = 'sessionflow-quest-hud__reward-img';
        img.src = quest.rewardImage;
        img.alt = '';
        rewardWrap.appendChild(img);
      }

      if (quest.reward) {
        const reward = document.createElement('div');
        reward.className = 'sessionflow-quest-hud__reward';
        reward.innerHTML = `<i class="fas fa-gem sessionflow-quest-hud__reward-icon"></i> ${quest.reward}`;
        rewardWrap.appendChild(reward);
      }

      qEl.appendChild(rewardWrap);
    }

    list.appendChild(qEl);
  }

  return list;
}

/* ============================================ */
/*  Quest Flash Popup (Dramatic Center Popup)   */
/* ============================================ */

function _flashQuestPopup(data) {
  if (!data?.quest) return;
  const quest = data.quest;

  const container = document.createElement('div');
  container.className = 'sessionflow-quest-flash';
  container.style.setProperty('--sf-quest-color', quest.color || '#a78bfa');

  // Glow color
  const glowColor = quest.status === 'completed' ? 'rgba(34,197,94,0.4)'
                   : quest.status === 'failed' ? 'rgba(239,68,68,0.4)'
                   : `${quest.color || '#a78bfa'}66`;
  container.style.setProperty('--sf-quest-flash-glow', glowColor);

  // Status label
  const statusEl = document.createElement('div');
  statusEl.className = `sessionflow-quest-flash__status is-${quest.status || 'active'}`;
  const statusKey = quest.status === 'completed' ? 'QuestStatusCompleted'
                  : quest.status === 'failed' ? 'QuestStatusFailed'
                  : 'QuestStatusActive';
  statusEl.textContent = game.i18n.localize(`SESSIONFLOW.Canvas.${statusKey}`);
  container.appendChild(statusEl);

  // Icon
  const iconEl = document.createElement('div');
  iconEl.className = 'sessionflow-quest-flash__icon';
  const iconClass = quest.icon || 'fas fa-scroll';
  if (iconClass.startsWith('img:')) {
    iconEl.innerHTML = `<img src="${iconClass.slice(4)}" style="width:40px;height:40px;object-fit:contain;border-radius:4px;">`;
  } else {
    iconEl.innerHTML = `<i class="${iconClass}"></i>`;
  }
  container.appendChild(iconEl);

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'sessionflow-quest-flash__title';
  titleEl.textContent = quest.title;
  container.appendChild(titleEl);

  // Objectives
  if (quest.objectives?.length > 0) {
    const objList = document.createElement('div');
    objList.className = 'sessionflow-quest-flash__objectives';

    for (const obj of quest.objectives) {
      const objEl = document.createElement('div');
      objEl.className = 'sessionflow-quest-flash__obj';

      const objIcon = document.createElement('span');
      objIcon.className = 'sessionflow-quest-flash__obj-icon';

      if (obj.hidden && !obj.completed) {
        objEl.classList.add('is-secret');
        objIcon.innerHTML = '<i class="fas fa-question"></i>';
        objEl.appendChild(objIcon);
        const t = document.createElement('span');
        t.textContent = game.i18n.localize('SESSIONFLOW.Canvas.QuestSecretObjective');
        objEl.appendChild(t);
      } else {
        if (obj.completed) objEl.classList.add('is-checked');
        objIcon.innerHTML = obj.completed ? '<i class="fas fa-check"></i>' : '<i class="far fa-circle"></i>';
        objEl.appendChild(objIcon);
        const t = document.createElement('span');
        t.textContent = obj.text || '???';
        objEl.appendChild(t);
      }

      objList.appendChild(objEl);
    }

    container.appendChild(objList);
  }

  // Reward (only for completed quests)
  if ((quest.reward || quest.rewardImage) && quest.status === 'completed') {
    if (quest.rewardImage) {
      const rewardImg = document.createElement('img');
      rewardImg.className = 'sessionflow-quest-flash__reward-img';
      rewardImg.src = quest.rewardImage;
      rewardImg.alt = '';
      container.appendChild(rewardImg);
    }

    if (quest.reward) {
      const reward = document.createElement('div');
      reward.className = 'sessionflow-quest-flash__reward';
      reward.innerHTML = `<i class="fas fa-gem sessionflow-quest-flash__reward-icon"></i> ${quest.reward}`;
      container.appendChild(reward);
    }
  }

  document.body.appendChild(container);
  requestAnimationFrame(() => container.classList.add('is-visible'));

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    container.classList.add('is-leaving');
    container.classList.remove('is-visible');
    setTimeout(() => container.remove(), 400);
  }, 4000);
}

/* ---- Quest HUD Dragging ---- */

function _makeQuestHudDraggable(container, header) {
  let dragState = null;

  header.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    dragState = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    container.style.left = `${dragState.origX + dx}px`;
    container.style.top = `${dragState.origY + dy}px`;
  });

  document.addEventListener('pointerup', () => {
    if (!dragState) return;
    header.style.cursor = 'grab';
    const rect = container.getBoundingClientRect();
    _saveQuestHudPosition(rect.left, rect.top);
    dragState = null;
  });
}

function _loadQuestHudPosition() {
  try {
    const stored = localStorage.getItem('sessionflow.questHudPosition');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { x: window.innerWidth - 290, y: 60 };
}

function _saveQuestHudPosition(x, y) {
  try {
    localStorage.setItem('sessionflow.questHudPosition', JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

/* ---------------------------------------- */
/*  Treasury HUD (Player Broadcast Overlay) */
/* ---------------------------------------- */

/** @type {HTMLElement|null} */
let _activeTreasuryHud = null;

/** @type {object|null} */
let _treasuryHudState = null;

function _showTreasuryHud(data) {
  _removeTreasuryHud();
  _treasuryHudState = data;

  const el = document.createElement('div');
  el.className = 'sessionflow-treasury-hud';
  el.dataset.widgetId = data.widgetId;

  _renderTreasuryHudContent(el, data);

  document.body.appendChild(el);
  _activeTreasuryHud = el;

  // Position from stored preference
  const pos = _loadTreasuryHudPosition();
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  el.style.right = 'auto';

  requestAnimationFrame(() => el.classList.add('is-visible'));

  // Draggable
  _makeTreasuryHudDraggable(el);
}

function _updateTreasuryHud(data) {
  if (!_activeTreasuryHud) {
    _showTreasuryHud(data);
    return;
  }
  _treasuryHudState = data;
  _renderTreasuryHudContent(_activeTreasuryHud, data);
}

function _renderTreasuryHudContent(el, data) {
  el.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.className = 'sessionflow-treasury-hud__title';
  title.innerHTML = '<i class="fas fa-vault"></i> The Treasury';
  el.appendChild(title);

  // Characters
  for (const ch of (data.characters ?? [])) {
    const row = document.createElement('div');
    row.className = 'sessionflow-treasury-hud__char';

    const img = document.createElement('img');
    img.src = ch.image || 'icons/svg/mystery-man.svg';
    row.appendChild(img);

    const name = document.createElement('span');
    name.className = 'sessionflow-treasury-hud__char-name';
    name.textContent = ch.name;
    row.appendChild(name);

    // Show top 2 currencies with highest value
    const currencies = data.currencies ?? [];
    const balanceText = currencies
      .filter(c => (ch.balances?.[c.id] ?? 0) > 0)
      .sort((a, b) => (b.rate ?? 1) - (a.rate ?? 1))
      .slice(0, 3)
      .map(c => `${ch.balances[c.id]} ${c.abbreviation}`)
      .join('  ');

    const bal = document.createElement('span');
    bal.className = 'sessionflow-treasury-hud__char-balance';
    bal.textContent = balanceText || '—';
    row.appendChild(bal);

    el.appendChild(row);
  }

  // Treasury
  if (data.treasury) {
    const row = document.createElement('div');
    row.className = 'sessionflow-treasury-hud__char';
    row.innerHTML = '<i class="fas fa-piggy-bank" style="font-size:16px; color:#fbbf24; width:24px; text-align:center;"></i>';

    const name = document.createElement('span');
    name.className = 'sessionflow-treasury-hud__char-name';
    name.textContent = 'Treasury';
    row.appendChild(name);

    const currencies = data.currencies ?? [];
    const balanceText = currencies
      .filter(c => (data.treasury.balances?.[c.id] ?? 0) > 0)
      .sort((a, b) => (b.rate ?? 1) - (a.rate ?? 1))
      .slice(0, 3)
      .map(c => `${data.treasury.balances[c.id]} ${c.abbreviation}`)
      .join('  ');

    const bal = document.createElement('span');
    bal.className = 'sessionflow-treasury-hud__char-balance';
    bal.textContent = balanceText || '—';
    row.appendChild(bal);

    el.appendChild(row);
  }

  // Total
  if (data.totalWealth) {
    const total = document.createElement('div');
    total.className = 'sessionflow-treasury-hud__total';
    total.innerHTML = `Total: <span>${data.totalWealth}</span>`;
    el.appendChild(total);
  }
}

function _removeTreasuryHud(widgetId) {
  if (!_activeTreasuryHud) return;
  if (widgetId && _activeTreasuryHud.dataset.widgetId !== widgetId) return;
  _activeTreasuryHud.classList.remove('is-visible');
  setTimeout(() => {
    _activeTreasuryHud?.remove();
    _activeTreasuryHud = null;
    _treasuryHudState = null;
  }, 300);
}

function _flashTreasuryPopup(data) {
  const el = document.createElement('div');
  el.className = 'sessionflow-treasury-flash';

  const icon = document.createElement('div');
  icon.className = 'sessionflow-treasury-flash__icon';
  icon.innerHTML = '<i class="fas fa-coins"></i>';
  el.appendChild(icon);

  const title = document.createElement('div');
  title.className = 'sessionflow-treasury-flash__title';
  title.textContent = data.flashTitle || 'Treasury Update';
  el.appendChild(title);

  // Show character balances summary
  const amounts = document.createElement('div');
  amounts.className = 'sessionflow-treasury-flash__amounts';
  const currencies = data.currencies ?? [];
  for (const ch of (data.characters ?? []).slice(0, 3)) {
    const topCurr = currencies
      .filter(c => (ch.balances?.[c.id] ?? 0) > 0)
      .sort((a, b) => (b.rate ?? 1) - (a.rate ?? 1))
      .slice(0, 2)
      .map(c => `${ch.balances[c.id]} ${c.abbreviation}`)
      .join(' ');

    if (topCurr) {
      const span = document.createElement('span');
      span.textContent = `${ch.name}: ${topCurr}`;
      amounts.appendChild(span);
    }
  }
  el.appendChild(amounts);

  if (data.totalWealth) {
    const detail = document.createElement('div');
    detail.className = 'sessionflow-treasury-flash__detail';
    detail.textContent = `Total: ${data.totalWealth}`;
    el.appendChild(detail);
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  setTimeout(() => {
    el.classList.add('is-exiting');
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 500);
  }, 3000);
}

function _makeTreasuryHudDraggable(container) {
  let dragState = null;
  container.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, select')) return;
    dragState = { startX: e.clientX, startY: e.clientY, origX: container.offsetLeft, origY: container.offsetTop };
    container.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    container.style.left = `${dragState.origX + dx}px`;
    container.style.top = `${dragState.origY + dy}px`;
  });
  document.addEventListener('pointerup', () => {
    if (!dragState) return;
    container.style.cursor = 'grab';
    const rect = container.getBoundingClientRect();
    _saveTreasuryHudPosition(rect.left, rect.top);
    dragState = null;
  });
}

function _loadTreasuryHudPosition() {
  try {
    const stored = localStorage.getItem('sessionflow.treasuryHudPosition');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { x: window.innerWidth - 350, y: 60 };
}

function _saveTreasuryHudPosition(x, y) {
  try {
    localStorage.setItem('sessionflow.treasuryHudPosition', JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}
