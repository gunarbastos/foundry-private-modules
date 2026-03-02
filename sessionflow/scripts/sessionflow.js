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
import { Widget, registerWidgetType, getRegisteredTypes } from './widget.js';
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
    console.log(`[${MODULE_ID}] Panel instances created.`);
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
                  characterPanel?.isOpen;

  if (anyOpen) {
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
        _removeSkyHud();
        break;
      case 'flashSky':
        _flashSkyPopup(data);
        break;
      case 'animateSky':
        _animateSkyHud(data);
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
  Hooks.on('sessionflow:hideSky', () => _removeSkyHud());
  Hooks.on('sessionflow:flashSky', (data) => _flashSkyPopup(data));
  Hooks.on('sessionflow:animateSky', (data) => _animateSkyHud(data));

  // Keep sky HUD in sync with world time changes from any source
  Hooks.on('updateWorldTime', () => {
    if (!_activeSkyHud || !_skyHudState) return;
    const { hour, minute } = getWorldTimeHM();
    _updateSkyHud({ hour, minute, format: _skyHudState.format, label: _skyHudState.label });
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

  if ((data.style || 'pie') === 'dots') {
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
  progress.textContent = `${data.filled}/${data.segments}`;
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
  const oldVisual = el.querySelector('.sessionflow-clock-hud__svg, .sessionflow-clock-hud__dots');
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

/** @type {{ format: string, label: string }|null} Last known sky HUD settings for auto-sync */
let _skyHudState = null;

/** @type {Function|null} Cancel function for running sky HUD animation */
let _skyHudAnimCancel = null;

/**
 * Show persistent sky HUD.
 */
function _showSkyHud(data) {
  _removeSkyHud();

  // Store last known HUD settings for updateWorldTime auto-sync
  _skyHudState = { format: data.format || '24h', label: data.label || '' };

  const el = document.createElement('div');
  el.className = 'sessionflow-sky-hud';
  el.dataset.senderId = data.senderId;

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
  if (data.format) _skyHudState = { format: data.format, label: data.label || '' };

  // In-place mini sky update (gradient + celestial positions, no DOM replacement)
  const miniSky = _activeSkyHud.querySelector('.sessionflow-sky-hud__mini-sky');
  if (miniSky) {
    updateMiniSkyCelestials(miniSky, data.hour, data.minute);
  }

  // Update time
  const timeEl = _activeSkyHud.querySelector('.sessionflow-sky-hud__time');
  if (timeEl) timeEl.textContent = formatGameTime(data.hour, data.minute, data.format);

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
  if (!_activeSkyHud) return;

  // Cancel any running animation
  if (_skyHudAnimCancel) {
    _skyHudAnimCancel();
    _skyHudAnimCancel = null;
  }

  // Keep HUD state in sync
  if (data.format) _skyHudState = { format: data.format, label: data.label || '' };

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
function _removeSkyHud() {
  if (_skyHudAnimCancel) {
    _skyHudAnimCancel();
    _skyHudAnimCancel = null;
  }
  if (!_activeSkyHud) return;
  _activeSkyHud.classList.add('is-leaving');
  const el = _activeSkyHud;
  _activeSkyHud = null;
  _skyHudState = null;
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
