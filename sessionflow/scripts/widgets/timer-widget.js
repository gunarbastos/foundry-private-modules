/**
 * SessionFlow - Timer / Countdown Widget
 * Countdown and stopwatch timer with broadcast-to-players HUD overlay.
 * Visible body on canvas with large time display, progress ring, and controls.
 * @module widgets/timer-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

/** Duration presets in seconds */
const PRESETS = [
  { seconds: 30,   label: 'SESSIONFLOW.Canvas.TimerPreset30s' },
  { seconds: 60,   label: 'SESSIONFLOW.Canvas.TimerPreset1m' },
  { seconds: 90,   label: 'SESSIONFLOW.Canvas.TimerPreset90s' },
  { seconds: 300,  label: 'SESSIONFLOW.Canvas.TimerPreset5m' },
  { seconds: 600,  label: 'SESSIONFLOW.Canvas.TimerPreset10m' },
  { seconds: 1800, label: 'SESSIONFLOW.Canvas.TimerPreset30m' }
];

export class TimerWidget extends Widget {

  static TYPE = 'timer';
  static LABEL = 'SESSIONFLOW.Canvas.Timer';
  static ICON = 'fas fa-hourglass-half';
  static MIN_WIDTH = 240;
  static MIN_HEIGHT = 260;
  static DEFAULT_WIDTH = 300;
  static DEFAULT_HEIGHT = 260;
  static PLAYER_MODES = ['view'];
  static HELP = 'SESSIONFLOW.Help.Timer';

  /* -- Private fields -- */

  /** @type {number|null} setInterval ID for ticking */
  #tickIntervalId = null;

  /** @type {number|null} Timestamp (Date.now()) when the timer was started/resumed */
  #startTimestamp = null;

  /** @type {number} Elapsed ms accumulated from previous run segments */
  #baseElapsedMs = 0;

  /** @type {boolean} Whether the timer is currently running */
  #isRunning = false;

  /** @type {boolean} Whether broadcast is active to players */
  #isBroadcasting = false;

  /** @type {boolean} Whether the countdown-end alert has fired */
  #alertFired = false;

  /** @type {boolean} Whether the custom duration input is visible */
  #showCustomInput = false;

  /** @type {boolean} Whether initial state restoration has been done */
  #restored = false;

  /** @type {Function|null} Bound socket handler for cleanup */
  #socketHandler = null;

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  /**
   * Restore timer state from persisted config.
   * If the timer was running when saved, resume it using wall-clock reference.
   */
  #restoreState() {
    if (this.config.isRunning && this.config.runEffectiveStart) {
      // Timer was running — resume with wall-clock reference
      this.#baseElapsedMs = 0;
      this.#startTimestamp = this.config.runEffectiveStart;
      this.#isRunning = true;
      this.#tickIntervalId = setInterval(() => this.#onTick(), 100);

      // Check if countdown already ended during the off-screen time
      if ((this.config.mode ?? 'countdown') === 'countdown') {
        const displaySec = this.#getDisplaySeconds();
        if (displaySec <= 0) {
          this.#alertFired = true;
          this.#pauseTimer();
          return;
        }
      }
    } else if (this.config.elapsedAtPause) {
      // Timer was paused — restore elapsed position
      this.#baseElapsedMs = (this.config.elapsedAtPause ?? 0) * 1000;
    }

    // Restore broadcast state
    if (this.config.isBroadcasting) {
      this.#isBroadcasting = true;
      // Re-emit broadcast state so players get current info
      if (this.#isRunning) {
        requestAnimationFrame(() => this.#emitTimerState('startTimer'));
      }
    }

    // In player-view mode, listen directly on socket for real-time sync
    if (this.mode === 'player-view') {
      this.#registerSocketSync();
    }
  }

  /**
   * Register a direct socket listener so the player-view widget syncs
   * with the GM's timer in real-time (independent of Hooks pipeline).
   */
  #registerSocketSync() {
    this.#socketHandler = (data) => {
      if (!data?.action) return;
      switch (data.action) {
        case 'startTimer':  this.#onRemoteStart(data); break;
        case 'pauseTimer':  this.#onRemotePause(data); break;
        case 'stopTimer':   this.#onRemoteStop(); break;
        case 'timerEnd':    this.#onRemoteEnd(); break;
      }
    };
    game.socket.on(`module.${MODULE_ID}`, this.#socketHandler);
  }

  #onRemoteStart(data) {
    // Stop any existing tick
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }

    this.#isRunning = true;
    this.#alertFired = false;

    if (data.mode === 'countdown' && data.endTimestamp) {
      // Derive timestamps: the GM's timer will end at endTimestamp
      // elapsed = duration - remaining, but we use wall-clock: startTimestamp = endTimestamp - duration*1000
      const durationMs = (data.duration ?? 300) * 1000;
      this.#baseElapsedMs = 0;
      this.#startTimestamp = data.endTimestamp - durationMs;
      this.updateConfig({ mode: 'countdown', duration: data.duration ?? 300 });
    } else if (data.startTimestamp) {
      // Stopwatch: startTimestamp is the effective start
      this.#baseElapsedMs = 0;
      this.#startTimestamp = data.startTimestamp;
      this.updateConfig({ mode: 'stopwatch' });
    }

    this.#tickIntervalId = setInterval(() => this.#onTick(), 100);
    this.#updateDisplay();
    this.#syncVisualState();
  }

  #onRemotePause(data) {
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
    this.#isRunning = false;
    this.#baseElapsedMs = 0;
    this.#startTimestamp = null;

    // Compute baseElapsedMs from remaining so display is correct
    if ((data.mode ?? 'countdown') === 'countdown') {
      const elapsed = (data.duration ?? 300) - (data.remaining ?? 0);
      this.#baseElapsedMs = elapsed * 1000;
    } else {
      this.#baseElapsedMs = (data.remaining ?? 0) * 1000;
    }

    this.#updateDisplay();
    this.#syncVisualState();
  }

  #onRemoteStop() {
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
    this.#isRunning = false;
    this.#baseElapsedMs = 0;
    this.#startTimestamp = null;
    this.#alertFired = false;

    // Remove flash class
    const container = this.element?.querySelector('.sessionflow-widget-timer');
    if (container) container.classList.remove('is-ended');

    this.#updateDisplay();
    this.#syncVisualState();
  }

  #onRemoteEnd() {
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
    this.#isRunning = false;
    this.#alertFired = true;

    // Set display to 0 for countdown
    if ((this.config.mode ?? 'countdown') === 'countdown') {
      this.#baseElapsedMs = (this.config.duration ?? 300) * 1000;
    }
    this.#startTimestamp = null;

    this.#updateDisplay();
    this.#flashAnimation();
    this.#syncVisualState();
  }

  /**
   * Get current display time in seconds.
   * Countdown: duration - elapsed (clamped to 0).
   * Stopwatch: elapsed.
   * @returns {number}
   */
  #getDisplaySeconds() {
    let elapsedMs = this.#baseElapsedMs;
    if (this.#isRunning && this.#startTimestamp) {
      elapsedMs += Date.now() - this.#startTimestamp;
    }
    const elapsedSec = elapsedMs / 1000;

    if ((this.config.mode ?? 'countdown') === 'countdown') {
      return Math.max(0, (this.config.duration ?? 300) - elapsedSec);
    }
    return elapsedSec;
  }

  /**
   * Format seconds as MM:SS or H:MM:SS.
   * @param {number} totalSeconds
   * @returns {string}
   */
  #formatTime(totalSeconds) {
    const total = Math.floor(Math.max(0, totalSeconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Timer');
  }

  /** @override */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    // Restore state from persisted config (only once on first render)
    if (!this.#restored) {
      this.#restored = true;
      this.#restoreState();
    }

    this.#ensureMinimumSize();

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-timer';
    container.dataset.mode = this.config.mode ?? 'countdown';
    container.classList.toggle('is-running', this.#isRunning);
    container.classList.toggle('is-broadcasting', this.#isBroadcasting);
    if (this.config.color) {
      container.style.setProperty('--sf-timer-custom-color', this.config.color);
    }

    // Mode toggle (editable mode only)
    if (this.canEdit) {
      this.#buildModeToggle(container);
    }

    // Display area (ring + time)
    this.#buildDisplay(container);

    // Controls row (editable mode only)
    if (this.canEdit) {
      this.#buildControls(container);

      // Presets (countdown only)
      if ((this.config.mode ?? 'countdown') === 'countdown') {
        this.#buildPresets(container);
      }
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Mode Toggle                             */
  /* ---------------------------------------- */

  #buildModeToggle(container) {
    const mode = this.config.mode ?? 'countdown';
    const toggle = document.createElement('div');
    toggle.className = 'sessionflow-widget-timer__mode-toggle';

    const countdownBtn = document.createElement('button');
    countdownBtn.type = 'button';
    countdownBtn.className = 'sessionflow-widget-timer__mode-btn';
    if (mode === 'countdown') countdownBtn.classList.add('is-active');
    countdownBtn.setAttribute('aria-pressed', String(mode === 'countdown'));
    countdownBtn.innerHTML = `
      <i class="fas fa-hourglass-half" aria-hidden="true"></i>
      <span>${game.i18n.localize('SESSIONFLOW.Canvas.TimerCountdown')}</span>
    `;
    countdownBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#setMode('countdown'); });

    const stopwatchBtn = document.createElement('button');
    stopwatchBtn.type = 'button';
    stopwatchBtn.className = 'sessionflow-widget-timer__mode-btn';
    if (mode === 'stopwatch') stopwatchBtn.classList.add('is-active');
    stopwatchBtn.setAttribute('aria-pressed', String(mode === 'stopwatch'));
    stopwatchBtn.innerHTML = `
      <i class="fas fa-stopwatch" aria-hidden="true"></i>
      <span>${game.i18n.localize('SESSIONFLOW.Canvas.TimerStopwatch')}</span>
    `;
    stopwatchBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#setMode('stopwatch'); });

    toggle.appendChild(countdownBtn);
    toggle.appendChild(stopwatchBtn);
    container.appendChild(toggle);
  }

  /* ---------------------------------------- */
  /*  Display (Time + Progress Ring)          */
  /* ---------------------------------------- */

  #buildDisplay(container) {
    const display = document.createElement('div');
    display.className = 'sessionflow-widget-timer__display';

    const core = document.createElement('div');
    core.className = 'sessionflow-widget-timer__display-core';

    // Progress ring (countdown only)
    if ((this.config.mode ?? 'countdown') === 'countdown') {
      core.appendChild(this.#buildProgressRing());
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'sessionflow-widget-timer__display-label';
    labelEl.textContent = game.i18n.localize(
      (this.config.mode ?? 'countdown') === 'countdown'
        ? 'SESSIONFLOW.Canvas.TimerCountdown'
        : 'SESSIONFLOW.Canvas.TimerStopwatch'
    );
    core.appendChild(labelEl);

    const timeEl = document.createElement('span');
    timeEl.className = 'sessionflow-widget-timer__time';
    timeEl.textContent = this.#formatTime(this.#getDisplaySeconds());
    core.appendChild(timeEl);

    display.appendChild(core);

    container.appendChild(display);
  }

  #buildProgressRing() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sessionflow-widget-timer__progress-ring');
    svg.setAttribute('viewBox', '0 0 100 100');

    // Background track
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '50');
    bgCircle.setAttribute('cy', '50');
    bgCircle.setAttribute('r', '45');
    bgCircle.setAttribute('class', 'sessionflow-widget-timer__progress-track');
    svg.appendChild(bgCircle);

    // Progress arc
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '45');
    circle.setAttribute('class', 'sessionflow-widget-timer__progress-circle');
    const circumference = 2 * Math.PI * 45;
    circle.style.strokeDasharray = String(circumference);
    // Set initial offset
    const pct = this.#getDisplaySeconds() / (this.config.duration ?? 300);
    circle.style.strokeDashoffset = String(circumference * (1 - pct));
    svg.appendChild(circle);

    return svg;
  }

  /* ---------------------------------------- */
  /*  Controls                                */
  /* ---------------------------------------- */

  #buildControls(container) {
    const controls = document.createElement('div');
    controls.className = 'sessionflow-widget-timer__controls';

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'sessionflow-widget-timer__reset-btn';
    resetBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimerReset');
    resetBtn.innerHTML = '<i class="fas fa-rotate-left"></i>';
    resetBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#resetTimer(); });
    controls.appendChild(resetBtn);

    // Play/Pause button (larger, centered)
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'sessionflow-widget-timer__play-btn';
    playBtn.title = game.i18n.localize(this.#isRunning ? 'SESSIONFLOW.Canvas.TimerPause' : 'SESSIONFLOW.Canvas.TimerPlay');
    playBtn.innerHTML = `<i class="fas ${this.#isRunning ? 'fa-pause' : 'fa-play'}"></i>`;
    playBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#togglePlayPause(); });
    controls.appendChild(playBtn);

    // Broadcast button
    const broadcastBtn = document.createElement('button');
    broadcastBtn.type = 'button';
    broadcastBtn.className = 'sessionflow-widget-timer__broadcast-btn';
    if (this.#isBroadcasting) broadcastBtn.classList.add('is-active');
    broadcastBtn.title = game.i18n.localize(this.#isBroadcasting ? 'SESSIONFLOW.Canvas.TimerStopBroadcast' : 'SESSIONFLOW.Canvas.TimerStartBroadcast');
    broadcastBtn.innerHTML = '<i class="fas fa-tower-broadcast"></i>';
    broadcastBtn.addEventListener('click', (e) => { e.stopPropagation(); this.#toggleBroadcast(); });
    controls.appendChild(broadcastBtn);

    container.appendChild(controls);
  }

  /* ---------------------------------------- */
  /*  Presets                                 */
  /* ---------------------------------------- */

  #buildPresets(container) {
    const presets = document.createElement('div');
    presets.className = 'sessionflow-widget-timer__presets';

    const currentDuration = this.config.duration ?? 300;

    for (const preset of PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sessionflow-widget-timer__preset-btn';
      if (currentDuration === preset.seconds) btn.classList.add('is-active');
      btn.textContent = game.i18n.localize(preset.label);
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.#setDuration(preset.seconds); });
      presets.appendChild(btn);
    }

    // Custom button
    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.className = 'sessionflow-widget-timer__preset-btn';
    const isCustom = !PRESETS.some(p => p.seconds === currentDuration);
    if (isCustom) customBtn.classList.add('is-active');
    customBtn.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimerPresetCustom');
    customBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#showCustomInput = !this.#showCustomInput;
      this.#rerender();
    });
    presets.appendChild(customBtn);

    // Custom input (MM:SS)
    if (this.#showCustomInput) {
      const inputWrap = document.createElement('div');
      inputWrap.className = 'sessionflow-widget-timer__custom-wrap';

      const currentMin = Math.floor(currentDuration / 60);
      const currentSec = currentDuration % 60;

      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.className = 'sessionflow-widget-timer__custom-input sessionflow-widget-timer__custom-input--min';
      minInput.min = '0';
      minInput.max = '999';
      minInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimerCustomMinPlaceholder');
      minInput.value = String(currentMin);

      const separator = document.createElement('span');
      separator.className = 'sessionflow-widget-timer__custom-separator';
      separator.textContent = ':';

      const secInput = document.createElement('input');
      secInput.type = 'number';
      secInput.className = 'sessionflow-widget-timer__custom-input sessionflow-widget-timer__custom-input--sec';
      secInput.min = '0';
      secInput.max = '59';
      secInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimerCustomSecPlaceholder');
      secInput.value = String(currentSec).padStart(2, '0');

      const confirmCustom = () => {
        const mins = parseInt(minInput.value) || 0;
        const secs = Math.min(59, Math.max(0, parseInt(secInput.value) || 0));
        const total = mins * 60 + secs;
        if (total > 0) {
          this.#setDuration(total);
          this.#showCustomInput = false;
        }
      };

      const handleKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); confirmCustom(); }
        if (e.key === 'Escape') { e.preventDefault(); this.#showCustomInput = false; this.#rerender(); }
      };

      minInput.addEventListener('keydown', handleKeydown);
      secInput.addEventListener('keydown', handleKeydown);

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'sessionflow-widget-timer__custom-confirm';
      confirmBtn.innerHTML = '<i class="fas fa-check"></i>';
      confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmCustom(); });

      inputWrap.appendChild(minInput);
      inputWrap.appendChild(separator);
      inputWrap.appendChild(secInput);
      inputWrap.appendChild(confirmBtn);
      presets.appendChild(inputWrap);

      // Auto-focus minutes input
      requestAnimationFrame(() => { minInput.focus(); minInput.select(); });
    }

    container.appendChild(presets);
  }

  /* ---------------------------------------- */
  /*  Timer Actions                           */
  /* ---------------------------------------- */

  #togglePlayPause() {
    if (this.#isRunning) {
      this.#pauseTimer();
    } else {
      this.#startTimer();
    }
  }

  #startTimer() {
    if (this.#isRunning) return;

    // In countdown mode, if already at 0 → reset first
    if ((this.config.mode ?? 'countdown') === 'countdown' && this.#getDisplaySeconds() <= 0) {
      this.#baseElapsedMs = 0;
      this.#alertFired = false;
    }

    this.#isRunning = true;
    this.#alertFired = false;
    this.#startTimestamp = Date.now();

    this.#tickIntervalId = setInterval(() => this.#onTick(), 100);
    this.#updateDisplay();

    // Persist running state so player panel can sync via playerPanelUpdate
    this.engine.scheduleSave();

    if (this.#isBroadcasting) {
      this.#emitTimerState('startTimer');
    }
  }

  #pauseTimer() {
    if (!this.#isRunning) return;
    this.#isRunning = false;

    // Snapshot total elapsed
    const elapsed = this.#baseElapsedMs + (Date.now() - this.#startTimestamp);
    this.#baseElapsedMs = elapsed;
    this.#startTimestamp = null;

    clearInterval(this.#tickIntervalId);
    this.#tickIntervalId = null;

    // Persist
    this.updateConfig({ elapsedAtPause: elapsed / 1000 });
    this.engine.scheduleSave();

    this.#updateDisplay();

    if (this.#isBroadcasting) {
      this.#emitTimerState('pauseTimer');
    }
  }

  #resetTimer() {
    const wasRunning = this.#isRunning;

    // Stop ticking
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
    this.#isRunning = false;
    this.#startTimestamp = null;
    this.#baseElapsedMs = 0;
    this.#alertFired = false;

    this.updateConfig({ elapsedAtPause: 0 });
    this.engine.scheduleSave();

    // Remove flash class
    const container = this.element?.querySelector('.sessionflow-widget-timer');
    if (container) container.classList.remove('is-ended');

    this.#updateDisplay();

    if (this.#isBroadcasting && wasRunning) {
      this.#emitTimerState('stopTimer');
    }
  }

  #setMode(mode) {
    if (this.config.mode === mode) return;

    // Stop running timer if switching modes
    if (this.#isRunning) this.#pauseTimer();

    this.#baseElapsedMs = 0;
    this.#alertFired = false;
    this.updateConfig({ mode, elapsedAtPause: 0 });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #setDuration(seconds) {
    // Stop running timer when changing duration
    if (this.#isRunning) this.#pauseTimer();

    this.#baseElapsedMs = 0;
    this.#alertFired = false;
    this.updateConfig({ duration: seconds, elapsedAtPause: 0 });
    this.engine.scheduleSave();
    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  Ticking                                 */
  /* ---------------------------------------- */

  #onTick() {
    const displaySec = this.#getDisplaySeconds();
    this.#updateDisplay();

    // Countdown end detection
    if ((this.config.mode ?? 'countdown') === 'countdown' && displaySec <= 0 && !this.#alertFired) {
      this.#alertFired = true;
      this.#onCountdownEnd();
    }
  }

  #onCountdownEnd() {
    this.#pauseTimer();
    this.#playAlertSound();
    this.#flashAnimation();

    if (this.#isBroadcasting) {
      this.#emitTimerState('timerEnd');
    }
  }

  /* ---------------------------------------- */
  /*  Targeted DOM Updates                    */
  /* ---------------------------------------- */

  #updateDisplay() {
    const seconds = this.#getDisplaySeconds();

    // Time text
    const timeEl = this.element?.querySelector('.sessionflow-widget-timer__time');
    if (timeEl) {
      timeEl.textContent = this.#formatTime(seconds);
    }

    // Progress ring (countdown only)
    if ((this.config.mode ?? 'countdown') === 'countdown') {
      const circle = this.element?.querySelector('.sessionflow-widget-timer__progress-circle');
      if (circle) {
        const pct = seconds / (this.config.duration ?? 300);
        const circumference = 2 * Math.PI * 45;
        circle.style.strokeDashoffset = String(circumference * (1 - pct));
      }
    }

    // Play/Pause button icon
    const playBtn = this.element?.querySelector('.sessionflow-widget-timer__play-btn');
    if (playBtn) {
      const icon = playBtn.querySelector('i');
      if (icon) icon.className = `fas ${this.#isRunning ? 'fa-pause' : 'fa-play'}`;
      playBtn.title = game.i18n.localize(this.#isRunning ? 'SESSIONFLOW.Canvas.TimerPause' : 'SESSIONFLOW.Canvas.TimerPlay');
    }

    this.#syncVisualState();
  }

  /* ---------------------------------------- */
  /*  Alert Sound (Web Audio API)             */
  /* ---------------------------------------- */

  #playAlertSound() {
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

  /* ---------------------------------------- */
  /*  Flash Animation                         */
  /* ---------------------------------------- */

  #flashAnimation() {
    const container = this.element?.querySelector('.sessionflow-widget-timer');
    if (!container) return;
    container.classList.add('is-ended');
    // Remove after animation completes (3 seconds)
    setTimeout(() => container.classList.remove('is-ended'), 3000);
  }

  /* ---------------------------------------- */
  /*  Broadcast                               */
  /* ---------------------------------------- */

  #toggleBroadcast() {
    this.#isBroadcasting = !this.#isBroadcasting;

    if (this.#isBroadcasting) {
      // If running, send startTimer; if paused, send pauseTimer (shows frozen HUD)
      if (this.#isRunning) {
        this.#emitTimerState('startTimer');
      } else {
        this.#emitTimerState('pauseTimer');
      }
    } else {
      this.#emitTimerState('stopTimer');
    }

    // Update broadcast button visual
    const btn = this.element?.querySelector('.sessionflow-widget-timer__broadcast-btn');
    if (btn) {
      btn.classList.toggle('is-active', this.#isBroadcasting);
      btn.title = game.i18n.localize(this.#isBroadcasting ? 'SESSIONFLOW.Canvas.TimerStopBroadcast' : 'SESSIONFLOW.Canvas.TimerStartBroadcast');
    }

    this.#syncVisualState();
  }

  /**
   * Emit a timer state message via socket and local hook.
   * @param {'startTimer'|'pauseTimer'|'stopTimer'|'timerEnd'} action
   */
  #emitTimerState(action) {
    const remaining = this.#getDisplaySeconds();
    const data = {
      action,
      mode: this.config.mode ?? 'countdown',
      duration: this.config.duration ?? 300,
      remaining,
      senderId: game.user.id
    };

    if (action === 'startTimer') {
      if (data.mode === 'countdown') {
        data.endTimestamp = Date.now() + (remaining * 1000);
      } else {
        const elapsedMs = this.#baseElapsedMs + (this.#startTimestamp ? Date.now() - this.#startTimestamp : 0);
        data.startTimestamp = Date.now() - elapsedMs;
      }
    }

    game.socket.emit(`module.${MODULE_ID}`, data);
    Hooks.call(`sessionflow:${action}`, data);
  }

  /* ---------------------------------------- */
  /*  Re-render helper                        */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  #ensureMinimumSize() {
    const minWidth = this.constructor.MIN_WIDTH ?? 120;
    const minHeight = this.constructor.MIN_HEIGHT ?? 80;
    const nextWidth = Math.max(this.width, minWidth);
    const nextHeight = Math.max(this.height, minHeight);

    if (nextWidth === this.width && nextHeight === this.height) return;

    this.updateSize(nextWidth, nextHeight);
    this.engine.scheduleSave();
  }

  #syncVisualState() {
    const container = this.element?.querySelector('.sessionflow-widget-timer');
    if (!container) return;

    container.dataset.mode = this.config.mode ?? 'countdown';
    container.classList.toggle('is-running', this.#isRunning);
    container.classList.toggle('is-broadcasting', this.#isBroadcasting);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    // Snapshot current elapsed into config for persistence
    let elapsedMs = this.#baseElapsedMs;
    if (this.#isRunning && this.#startTimestamp) {
      elapsedMs += Date.now() - this.#startTimestamp;
    }

    // Compute effective start: the wall-clock timestamp such that
    // Date.now() - effectiveStart = totalElapsedMs (for seamless resume)
    const runEffectiveStart = this.#isRunning ? (Date.now() - elapsedMs) : null;

    this.updateConfig({
      elapsedAtPause: elapsedMs / 1000,
      isRunning: this.#isRunning,
      runEffectiveStart,
      isBroadcasting: this.#isBroadcasting
    });
  }

  /** @override */
  destroy() {
    if (this.#tickIntervalId) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
    // Unregister socket sync (player-view mode)
    if (this.#socketHandler) {
      game.socket.off(`module.${MODULE_ID}`, this.#socketHandler);
      this.#socketHandler = null;
    }
    // Don't stop broadcast — timer state is persisted and will auto-resume
    // when the panel reopens. Only clear the local interval.
    super.destroy();
  }
}

// Self-register
registerWidgetType(TimerWidget.TYPE, TimerWidget);
