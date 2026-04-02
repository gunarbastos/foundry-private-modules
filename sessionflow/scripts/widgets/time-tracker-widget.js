/**
 * SessionFlow - Time Tracker Widget ("The Sundial")
 * Tracks in-game time units (turns, hours, watches, days, etc.)
 * with SVG progress ring (arc/sundial/pulse styles), custom color,
 * center icon, badge label, broadcast/flash to players, and optional history.
 * NOT real time — for abstract game-time tracking.
 * @module widgets/time-tracker-widget
 */

import { Widget, registerWidgetType } from '../widget.js';
import { IconPicker } from '../icon-picker.js';

const MODULE_ID = 'sessionflow';

const MAX_HISTORY = 50;

/** SVG ring constants */
const RING_RADIUS = 48;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Curated color palette (matches progress clock) */
const TRACKER_COLORS = [
  { value: '#7c5cbf', name: 'Purple' },
  { value: '#dc3545', name: 'Red' },
  { value: '#f97316', name: 'Orange' },
  { value: '#eab308', name: 'Gold' },
  { value: '#10b981', name: 'Green' },
  { value: '#3b82f6', name: 'Blue' },
  { value: '#06b6d4', name: 'Cyan' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#94a3b8', name: 'Silver' },
];

export class TimeTrackerWidget extends Widget {

  static TYPE = 'time-tracker';
  static LABEL = 'SESSIONFLOW.Canvas.TimeTracker';
  static ICON = 'fas fa-clock-rotate-left';
  static MIN_WIDTH = 240;
  static MIN_HEIGHT = 180;
  static DEFAULT_WIDTH = 320;
  static DEFAULT_HEIGHT = 240;
  static PLAYER_MODES = ['view'];
  static HELP = 'SESSIONFLOW.Help.TimeTracker';

  /** @type {boolean} */
  #showHistory = false;

  /** @type {boolean} */
  #isEditingLabel = false;

  /** @type {boolean} */
  #isEditingSecondaryLabel = false;

  /** @type {boolean} */
  #isSettingsOpen = false;

  /** @type {Function|null} */
  #settingsCloseHandler = null;

  /** @type {boolean} — transient flag for tick animation */
  #isTicking = false;

  /** @type {boolean} — broadcast state */
  #isBroadcasting = false;

  /** @type {boolean} — first-render guard for broadcast restore */
  #restored = false;

  /** @type {number|null} — rAF ID for delayed broadcast restore */
  #restoreBroadcastFrameId = null;

  /** @type {IconPicker|null} */
  #iconPicker = null;

  /* ---------------------------------------- */
  /*  Config Helpers                          */
  /* ---------------------------------------- */

  #getLabel() { return this.config.label || game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerDefaultLabel'); }
  #getCount() { return this.config.count ?? 0; }
  #getStep() { return this.config.step ?? 1; }
  #getSecondaryLabel() { return this.config.secondaryLabel || ''; }
  #getConversionRate() { return this.config.conversionRate ?? 0; }
  #getSecondaryCount() { return this.config.secondaryCount ?? 0; }
  #getHistory() { return this.config.history ?? []; }
  #getColor() { return this.config.color || null; }
  #getRingStyle() { return this.config.ringStyle || 'arc'; }
  #getCenterIcon() { return this.config.centerIcon || null; }
  #getBadgeLabel() { return this.config.badgeLabel || ''; }
  #getShowHistory() { return this.config.showHistory ?? false; }

  /** Resolve accent color: custom → beat color → primary */
  #getAccentColor() {
    return this.config.color || 'var(--sf-beat-color, var(--sf-color-primary))';
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.TimeTracker');
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    // First render: restore broadcast state
    if (!this.#restored) {
      this.#restored = true;
      if (this.config.isBroadcasting) {
        this.#isBroadcasting = true;
        this.#restoreBroadcastFrameId = requestAnimationFrame(() => {
          this.#restoreBroadcastFrameId = null;
          if (!this.element) return;
          this.#emitTrackerAction('showTracker');
        });
      }
    }

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-timetracker';

    // Apply custom color as CSS variable
    if (this.#getColor()) {
      container.style.setProperty('--sf-tracker-color', this.#getColor());
    }

    // Secondary counter display (ABOVE ring, if configured)
    if (this.#getSecondaryLabel()) {
      this.#buildSecondaryDisplay(container);
    }

    // SVG Progress Ring with counter overlay
    this.#buildRingArea(container);

    // Badge label (below ring)
    if (this.#getBadgeLabel()) {
      const badge = document.createElement('div');
      badge.className = 'sessionflow-widget-timetracker__badge';
      if (this.#getColor()) {
        badge.style.background = `color-mix(in srgb, ${this.#getColor()} 18%, transparent)`;
        badge.style.borderColor = `color-mix(in srgb, ${this.#getColor()} 35%, transparent)`;
      }
      badge.textContent = this.#getBadgeLabel();
      container.appendChild(badge);
    }

    // Controls row (GM only)
    if (this.canEdit) {
      this.#buildControls(container);
    }

    // History toggle + list (optional)
    if (this.#getShowHistory()) {
      this.#buildHistorySection(container);
    }

    bodyEl.appendChild(container);

    // Inject gear button into widget header (GM only)
    if (this.canEdit) {
      this.#injectGearButton();
    }
  }

  /* ---------------------------------------- */
  /*  Secondary Display (above ring)          */
  /* ---------------------------------------- */

  #buildSecondaryDisplay(container) {
    const secondary = document.createElement('div');
    secondary.className = 'sessionflow-widget-timetracker__secondary-display';

    const count = document.createElement('span');
    count.className = 'sessionflow-widget-timetracker__secondary-count';
    count.textContent = String(this.#getSecondaryCount());
    secondary.appendChild(count);

    // Label (editable)
    if (this.#isEditingSecondaryLabel && this.canEdit) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-timetracker__secondary-label-input';
      input.value = this.config.secondaryLabel || '';
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerSecondaryPlaceholder');

      const save = () => {
        this.updateConfig({ secondaryLabel: input.value.trim() });
        this.engine.scheduleSave();
        this.#isEditingSecondaryLabel = false;
        this.#rerender();
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); this.#isEditingSecondaryLabel = false; this.#rerender(); }
      });

      secondary.appendChild(input);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      const label = document.createElement('span');
      label.className = 'sessionflow-widget-timetracker__secondary-label';
      label.textContent = this.#getSecondaryLabel();
      if (this.canEdit) {
        label.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerEditLabel');
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#isEditingSecondaryLabel = true;
          this.#rerender();
        });
      }
      secondary.appendChild(label);
    }

    container.appendChild(secondary);
  }

  /* ---------------------------------------- */
  /*  SVG Progress Ring                       */
  /* ---------------------------------------- */

  #buildRingArea(container) {
    const ringArea = document.createElement('div');
    ringArea.className = 'sessionflow-widget-timetracker__ring-area';

    // SVG ring (dispatched by style)
    ringArea.appendChild(this.#buildRingSVG());

    // Overlay (number + label on top of ring)
    const overlay = document.createElement('div');
    overlay.className = 'sessionflow-widget-timetracker__ring-overlay';

    const centerIcon = this.#getCenterIcon();

    if (centerIcon) {
      // Icon mode: icon centered, count smaller below
      const iconEl = document.createElement('span');
      iconEl.className = 'sessionflow-widget-timetracker__center-icon';
      if (centerIcon.startsWith('img:')) {
        const img = document.createElement('img');
        img.src = centerIcon.slice(4);
        img.className = 'sessionflow-widget-timetracker__center-icon-img';
        iconEl.appendChild(img);
      } else {
        iconEl.innerHTML = `<i class="${centerIcon}"></i>`;
      }
      overlay.appendChild(iconEl);

      const countEl = document.createElement('span');
      countEl.className = 'sessionflow-widget-timetracker__count sessionflow-widget-timetracker__count--small';
      countEl.textContent = String(this.#getCount());
      overlay.appendChild(countEl);
    } else if (this.#isEditingLabel && this.canEdit) {
      // Editing label mode
      const countEl = document.createElement('span');
      countEl.className = 'sessionflow-widget-timetracker__count';
      countEl.textContent = String(this.#getCount());
      overlay.appendChild(countEl);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-timetracker__label-input';
      input.value = this.config.label || '';
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerLabelPlaceholder');

      const save = () => {
        this.updateConfig({ label: input.value.trim() });
        this.engine.scheduleSave();
        this.#isEditingLabel = false;
        this.#rerender();
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); this.#isEditingLabel = false; this.#rerender(); }
      });

      overlay.appendChild(input);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      // Default: large count + label
      const countEl = document.createElement('span');
      countEl.className = 'sessionflow-widget-timetracker__count';
      countEl.textContent = String(this.#getCount());
      overlay.appendChild(countEl);

      const label = document.createElement('span');
      label.className = 'sessionflow-widget-timetracker__label';
      label.textContent = this.#getLabel();
      if (this.canEdit) {
        label.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerEditLabel');
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#isEditingLabel = true;
          this.#rerender();
        });
      }
      overlay.appendChild(label);
    }

    ringArea.appendChild(overlay);
    container.appendChild(ringArea);
  }

  /** Dispatch ring building to the active style */
  #buildRingSVG() {
    const style = this.#getRingStyle();
    switch (style) {
      case 'sundial': return this.#buildSundialRing();
      case 'pulse': return this.#buildPulseRing();
      default: return this.#buildArcRing();
    }
  }

  /** Arc style — progress arc with glow filter (original style) */
  #buildArcRing() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'sessionflow-widget-timetracker__ring-svg');

    const accent = this.#getAccentColor();

    // Defs: glow filter
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    const filterId = `sf-tt-glow-${this.id}`;
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const blur = document.createElementNS(svgNS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '2.5');
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

    // Outer decorative ring
    const outerRing = document.createElementNS(svgNS, 'circle');
    outerRing.setAttribute('cx', '60');
    outerRing.setAttribute('cy', '60');
    outerRing.setAttribute('r', '56');
    outerRing.setAttribute('fill', 'none');
    outerRing.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    outerRing.setAttribute('stroke-width', '1');
    svg.appendChild(outerRing);

    // Background track
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', '60');
    track.setAttribute('cy', '60');
    track.setAttribute('r', String(RING_RADIUS));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    track.setAttribute('stroke-width', '5');
    track.setAttribute('stroke-linecap', 'round');
    svg.appendChild(track);

    // Progress arc
    const progress = this.#computeProgress();
    const offset = RING_CIRCUMFERENCE * (1 - progress);

    const arc = document.createElementNS(svgNS, 'circle');
    arc.setAttribute('cx', '60');
    arc.setAttribute('cy', '60');
    arc.setAttribute('r', String(RING_RADIUS));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', accent);
    arc.setAttribute('stroke-width', '5');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
    arc.setAttribute('stroke-dashoffset', String(offset));
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    arc.setAttribute('class', 'sessionflow-widget-timetracker__ring-progress');

    if (progress > 0) {
      arc.setAttribute('filter', `url(#${filterId})`);
    }

    if (this.#isTicking) {
      arc.classList.add('is-ticking');
    }

    svg.appendChild(arc);

    // Inner decorative ring
    const innerRing = document.createElementNS(svgNS, 'circle');
    innerRing.setAttribute('cx', '60');
    innerRing.setAttribute('cy', '60');
    innerRing.setAttribute('r', '40');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', 'rgba(255,255,255,0.04)');
    innerRing.setAttribute('stroke-width', '0.5');
    svg.appendChild(innerRing);

    return svg;
  }

  /** Sundial style — arc ring + tick marks around perimeter */
  #buildSundialRing() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'sessionflow-widget-timetracker__ring-svg is-sundial');

    const accent = this.#getAccentColor();
    const rate = this.#getConversionRate();
    const numTicks = (rate > 0 && this.#getSecondaryLabel()) ? rate : 12;
    const progress = this.#computeProgress();
    const activeTicks = Math.floor(progress * numTicks);

    // Defs: glow filter
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    const filterId = `sf-tt-glow-${this.id}`;
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(svgNS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '2');
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

    // Background track (subtle)
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', '60');
    track.setAttribute('cy', '60');
    track.setAttribute('r', String(RING_RADIUS));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.04)');
    track.setAttribute('stroke-width', '5');
    svg.appendChild(track);

    // Tick marks
    const cx = 60, cy = 60;
    const outerR = 55, innerR = 49;
    for (let i = 0; i < numTicks; i++) {
      const angle = ((i / numTicks) * 360 - 90) * (Math.PI / 180);
      const x1 = cx + outerR * Math.cos(angle);
      const y1 = cy + outerR * Math.sin(angle);
      const x2 = cx + innerR * Math.cos(angle);
      const y2 = cy + innerR * Math.sin(angle);

      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke-width', i % (numTicks >= 12 ? 3 : 1) === 0 ? '2' : '1.2');
      line.setAttribute('stroke-linecap', 'round');

      if (i < activeTicks) {
        line.setAttribute('stroke', accent);
        if (i === activeTicks - 1) line.setAttribute('filter', `url(#${filterId})`);
      } else {
        line.setAttribute('stroke', 'rgba(255,255,255,0.12)');
      }

      svg.appendChild(line);
    }

    // Progress arc (thinner, underneath ticks visually)
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    const arc = document.createElementNS(svgNS, 'circle');
    arc.setAttribute('cx', '60');
    arc.setAttribute('cy', '60');
    arc.setAttribute('r', String(RING_RADIUS));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', accent);
    arc.setAttribute('stroke-width', '3');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
    arc.setAttribute('stroke-dashoffset', String(offset));
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    arc.setAttribute('class', 'sessionflow-widget-timetracker__ring-progress');
    arc.setAttribute('opacity', '0.4');

    if (this.#isTicking) arc.classList.add('is-ticking');
    svg.appendChild(arc);

    // Inner decorative ring
    const innerRing = document.createElementNS(svgNS, 'circle');
    innerRing.setAttribute('cx', '60');
    innerRing.setAttribute('cy', '60');
    innerRing.setAttribute('r', '40');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', 'rgba(255,255,255,0.04)');
    innerRing.setAttribute('stroke-width', '0.5');
    svg.appendChild(innerRing);

    return svg;
  }

  /** Pulse style — filled circle with breathing animation, no arc */
  #buildPulseRing() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'sessionflow-widget-timetracker__ring-svg is-pulse');

    const accent = this.#getAccentColor();

    // Defs: glow filter
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    const filterId = `sf-tt-glow-${this.id}`;
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(svgNS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '4');
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

    // Outer glow ring
    const glowCircle = document.createElementNS(svgNS, 'circle');
    glowCircle.setAttribute('cx', '60');
    glowCircle.setAttribute('cy', '60');
    glowCircle.setAttribute('r', '50');
    glowCircle.setAttribute('fill', accent);
    glowCircle.setAttribute('opacity', '0.06');
    glowCircle.setAttribute('filter', `url(#${filterId})`);
    glowCircle.setAttribute('class', 'sessionflow-widget-timetracker__pulse-glow');
    svg.appendChild(glowCircle);

    // Main pulse circle
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', '48');
    circle.setAttribute('fill', accent);
    circle.setAttribute('opacity', '0.12');
    circle.setAttribute('class', 'sessionflow-widget-timetracker__pulse-circle');
    svg.appendChild(circle);

    // Inner ring highlight
    const innerRing = document.createElementNS(svgNS, 'circle');
    innerRing.setAttribute('cx', '60');
    innerRing.setAttribute('cy', '60');
    innerRing.setAttribute('r', '48');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', accent);
    innerRing.setAttribute('stroke-width', '1');
    innerRing.setAttribute('opacity', '0.25');
    svg.appendChild(innerRing);

    return svg;
  }

  /** Compute ring progress (0-1) based on count / conversionRate */
  #computeProgress() {
    const rate = this.#getConversionRate();
    if (rate <= 0 || !this.#getSecondaryLabel()) return 0;
    const count = this.#getCount();
    return (count % rate) / rate;
  }

  /* ---------------------------------------- */
  /*  Controls (horizontal row)               */
  /* ---------------------------------------- */

  #buildControls(container) {
    const controls = document.createElement('div');
    controls.className = 'sessionflow-widget-timetracker__controls';

    // Decrement
    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--dec';
    decBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerDecrement');
    decBtn.innerHTML = '<i class="fas fa-minus"></i>';
    decBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#increment(-this.#getStep());
    });
    controls.appendChild(decBtn);

    // Step display
    const stepLabel = document.createElement('span');
    stepLabel.className = 'sessionflow-widget-timetracker__step';
    stepLabel.textContent = `\u00B1${this.#getStep()}`;
    controls.appendChild(stepLabel);

    // Increment (instant — no note prompt)
    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--inc';
    incBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerIncrement');
    incBtn.innerHTML = '<i class="fas fa-plus"></i>';
    incBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#increment(this.#getStep());
    });
    controls.appendChild(incBtn);

    // Reset
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--reset';
    resetBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerReset');
    resetBtn.innerHTML = '<i class="fas fa-rotate-left"></i>';
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#resetCounter();
    });
    controls.appendChild(resetBtn);

    // Spacer
    const spacer = document.createElement('span');
    spacer.className = 'sessionflow-widget-timetracker__controls-spacer';
    controls.appendChild(spacer);

    // Broadcast toggle
    const broadcastBtn = document.createElement('button');
    broadcastBtn.type = 'button';
    broadcastBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--broadcast';
    if (this.#isBroadcasting) broadcastBtn.classList.add('is-active');
    broadcastBtn.title = game.i18n.localize(this.#isBroadcasting
      ? 'SESSIONFLOW.Canvas.TimeTrackerStopBroadcast'
      : 'SESSIONFLOW.Canvas.TimeTrackerStartBroadcast');
    broadcastBtn.innerHTML = '<i class="fas fa-tower-broadcast"></i>';
    broadcastBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleBroadcast();
    });
    controls.appendChild(broadcastBtn);

    // Flash
    const flashBtn = document.createElement('button');
    flashBtn.type = 'button';
    flashBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--flash';
    flashBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerFlash');
    flashBtn.innerHTML = '<i class="fas fa-bolt"></i>';
    flashBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#flashTracker();
    });
    controls.appendChild(flashBtn);

    container.appendChild(controls);
  }

  /* ---------------------------------------- */
  /*  History Section                         */
  /* ---------------------------------------- */

  #buildHistorySection(container) {
    const history = this.#getHistory();
    if (history.length === 0) return;

    const section = document.createElement('div');
    section.className = 'sessionflow-widget-timetracker__history';

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'sessionflow-widget-timetracker__history-toggle';
    toggleBtn.innerHTML = `
      <i class="fas fa-${this.#showHistory ? 'chevron-up' : 'chevron-down'}"></i>
      <span>${game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerHistory')} (${history.length})</span>
    `;
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#showHistory = !this.#showHistory;
      this.#rerender();
    });
    section.appendChild(toggleBtn);

    // History list (collapsible)
    if (this.#showHistory) {
      const list = document.createElement('div');
      list.className = 'sessionflow-widget-timetracker__history-list';

      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        const item = document.createElement('div');
        item.className = 'sessionflow-widget-timetracker__history-item';

        const delta = document.createElement('span');
        delta.className = 'sessionflow-widget-timetracker__history-delta';
        delta.textContent = entry.delta > 0 ? `+${entry.delta}` : String(entry.delta);
        delta.style.color = entry.delta > 0 ? '#22c55e' : '#ef4444';
        item.appendChild(delta);

        // Relative timestamp
        if (entry.timestamp) {
          const time = document.createElement('span');
          time.className = 'sessionflow-widget-timetracker__history-time';
          time.textContent = this.#formatRelativeTime(entry.timestamp);
          item.appendChild(time);
        }

        list.appendChild(item);
      }

      section.appendChild(list);
    }

    container.appendChild(section);
  }

  /* ---------------------------------------- */
  /*  Gear Popover (Settings)                 */
  /* ---------------------------------------- */

  #injectGearButton() {
    const header = this.element?.querySelector('.sessionflow-widget__header');
    if (!header) return;

    if (header.querySelector('.sessionflow-widget-timetracker__gear-btn')) return;

    const gearBtn = document.createElement('button');
    gearBtn.type = 'button';
    gearBtn.className = 'sessionflow-widget-timetracker__gear-btn';
    gearBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerSettings');
    gearBtn.innerHTML = '<i class="fas fa-gear"></i>';
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleSettings();
    });

    const collapseBtn = header.querySelector('.sessionflow-widget__collapse-btn');
    if (collapseBtn) {
      header.insertBefore(gearBtn, collapseBtn);
    } else {
      header.appendChild(gearBtn);
    }
  }

  #toggleSettings() {
    if (this.#isSettingsOpen) {
      this.#closeSettings();
    } else {
      this.#openSettings();
    }
  }

  #openSettings() {
    this.#closeSettings();
    this.#isSettingsOpen = true;

    const popover = document.createElement('div');
    popover.className = 'sessionflow-widget-timetracker__settings-popover';

    // Title
    const title = document.createElement('div');
    title.className = 'sessionflow-widget-timetracker__settings-title';
    title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerSettings');
    popover.appendChild(title);

    const body = document.createElement('div');
    body.className = 'sessionflow-widget-timetracker__settings-body';

    // ── Ring Style selector ──
    this.#buildRingStyleSelector(body);

    // ── Color palette ──
    this.#buildColorPalette(body);

    // ── Separator ──
    body.appendChild(this.#createSeparator());

    // ── Center Icon ──
    this.#buildCenterIconRow(body);

    // ── Badge Label ──
    this.#buildBadgeLabelRow(body);

    // ── Separator ──
    body.appendChild(this.#createSeparator());

    // ── Step size ──
    this.#buildStepRow(body);

    // ── Secondary counter ──
    this.#buildSecondarySection(body);

    // ── Separator ──
    body.appendChild(this.#createSeparator());

    // ── Show History toggle ──
    this.#buildHistoryToggle(body);

    popover.appendChild(body);
    this.element?.appendChild(popover);

    // Close on click outside
    requestAnimationFrame(() => {
      this.#settingsCloseHandler = (e) => {
        if (!popover.contains(e.target) && !e.target.closest('.sessionflow-widget-timetracker__gear-btn')) {
          this.#closeSettings();
        }
      };
      document.addEventListener('pointerdown', this.#settingsCloseHandler, true);
    });
  }

  #buildRingStyleSelector(body) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-timetracker__settings-row';

    const label = document.createElement('label');
    label.className = 'sessionflow-widget-timetracker__settings-label';
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerRingStyle');
    row.appendChild(label);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'sessionflow-widget-timetracker__ring-style-group';

    const styles = [
      { value: 'arc', icon: 'fas fa-circle-notch', label: 'SESSIONFLOW.Canvas.TimeTrackerRingArc' },
      { value: 'sundial', icon: 'fas fa-sun', label: 'SESSIONFLOW.Canvas.TimeTrackerRingSundial' },
      { value: 'pulse', icon: 'fas fa-heart-pulse', label: 'SESSIONFLOW.Canvas.TimeTrackerRingPulse' },
    ];

    const current = this.#getRingStyle();
    for (const s of styles) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sessionflow-widget-timetracker__ring-style-btn';
      if (s.value === current) btn.classList.add('is-active');
      btn.title = game.i18n.localize(s.label);
      btn.innerHTML = `<i class="${s.icon}"></i>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({ ringStyle: s.value });
        this.engine.scheduleSave();
        if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
        this.#closeSettings();
      });
      btnGroup.appendChild(btn);
    }

    row.appendChild(btnGroup);
    body.appendChild(row);
  }

  #buildColorPalette(body) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-timetracker__settings-row';

    const label = document.createElement('label');
    label.className = 'sessionflow-widget-timetracker__settings-label';
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerColor');
    row.appendChild(label);

    const palette = document.createElement('div');
    palette.className = 'sessionflow-widget-timetracker__color-palette';

    // Inherit (no custom color) dot
    const inheritDot = document.createElement('button');
    inheritDot.type = 'button';
    inheritDot.className = 'sessionflow-widget-timetracker__color-dot sessionflow-widget-timetracker__color-dot--inherit';
    if (!this.#getColor()) inheritDot.classList.add('is-active');
    inheritDot.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerColorInherit');
    inheritDot.innerHTML = '<i class="fas fa-link" style="font-size:0.45rem;"></i>';
    inheritDot.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateConfig({ color: null });
      this.engine.scheduleSave();
      if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
      this.#closeSettings();
    });
    palette.appendChild(inheritDot);

    const currentColor = this.#getColor();
    for (const c of TRACKER_COLORS) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'sessionflow-widget-timetracker__color-dot';
      if (currentColor === c.value) dot.classList.add('is-active');
      dot.style.background = c.value;
      dot.title = c.name;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({ color: c.value });
        this.engine.scheduleSave();
        if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
        this.#closeSettings();
      });
      palette.appendChild(dot);
    }

    row.appendChild(palette);
    body.appendChild(row);
  }

  #buildCenterIconRow(body) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-timetracker__settings-row';

    const label = document.createElement('label');
    label.className = 'sessionflow-widget-timetracker__settings-label';
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerCenterIcon');
    row.appendChild(label);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'sessionflow-widget-timetracker__icon-btn-group';

    // Pick icon button
    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'sessionflow-widget-timetracker__settings-icon-btn';
    const currentIcon = this.#getCenterIcon();
    if (currentIcon) {
      if (currentIcon.startsWith('img:')) {
        pickBtn.innerHTML = `<img src="${currentIcon.slice(4)}" style="width:14px;height:14px;object-fit:contain;">`;
      } else {
        pickBtn.innerHTML = `<i class="${currentIcon}" style="font-size:0.7rem;"></i>`;
      }
    } else {
      pickBtn.innerHTML = `<i class="fas fa-icons" style="font-size:0.6rem;opacity:0.5;"></i>`;
    }
    pickBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerCenterIconPick');
    pickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openIconPicker(pickBtn);
    });
    btnGroup.appendChild(pickBtn);

    // Clear icon button (only if icon is set)
    if (currentIcon) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'sessionflow-widget-timetracker__settings-icon-clear';
      clearBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerCenterIconClear');
      clearBtn.innerHTML = '<i class="fas fa-xmark"></i>';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({ centerIcon: null });
        this.engine.scheduleSave();
        if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
        this.#closeSettings();
      });
      btnGroup.appendChild(clearBtn);
    }

    row.appendChild(btnGroup);
    body.appendChild(row);
  }

  #openIconPicker(anchor) {
    if (this.#iconPicker) {
      this.#iconPicker.destroy();
      this.#iconPicker = null;
    }

    this.#iconPicker = new IconPicker({
      anchor,
      currentIcon: this.#getCenterIcon() || '',
      onSelect: (icon) => {
        this.updateConfig({ centerIcon: icon || null });
        this.engine.scheduleSave();
        if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
        this.#iconPicker = null;
        this.#closeSettings();
      },
      onClose: () => {
        this.#iconPicker = null;
      }
    });
    this.#iconPicker.open();
  }

  #buildBadgeLabelRow(body) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-timetracker__settings-row';

    const label = document.createElement('label');
    label.className = 'sessionflow-widget-timetracker__settings-label';
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerBadgeLabel');
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-widget-timetracker__settings-input sessionflow-widget-timetracker__settings-input--wide';
    input.value = this.#getBadgeLabel();
    input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerBadgePlaceholder');
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      this.updateConfig({ badgeLabel: e.target.value.trim() });
      this.engine.scheduleSave();
      if (this.#isBroadcasting) this.#emitTrackerAction('updateTracker');
      this.#rerender();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.#closeSettings(); }
    });
    row.appendChild(input);
    body.appendChild(row);
  }

  #buildStepRow(body) {
    const stepRow = document.createElement('div');
    stepRow.className = 'sessionflow-widget-timetracker__settings-row';

    const stepLabel = document.createElement('label');
    stepLabel.className = 'sessionflow-widget-timetracker__settings-label';
    stepLabel.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerStepLabel');
    stepRow.appendChild(stepLabel);

    const stepInput = document.createElement('input');
    stepInput.type = 'number';
    stepInput.className = 'sessionflow-widget-timetracker__settings-input';
    stepInput.value = this.#getStep();
    stepInput.min = '1';
    stepInput.max = '100';
    stepInput.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = Math.max(1, parseInt(e.target.value) || 1);
      this.updateConfig({ step: val });
      this.engine.scheduleSave();
      this.#rerender();
    });
    stepInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.#closeSettings(); }
    });
    stepRow.appendChild(stepInput);
    body.appendChild(stepRow);
  }

  #buildSecondarySection(body) {
    if (!this.#getSecondaryLabel()) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'sessionflow-widget-timetracker__settings-add-secondary';
      addBtn.innerHTML = `<i class="fas fa-layer-group"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerAddSecondary')}`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({
          secondaryLabel: game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerDefaultSecondary'),
          conversionRate: 6
        });
        this.engine.scheduleSave();
        this.#closeSettings();
      });
      body.appendChild(addBtn);
    } else {
      // Conversion rate row
      const rateRow = document.createElement('div');
      rateRow.className = 'sessionflow-widget-timetracker__settings-row';

      const rateLabel = document.createElement('label');
      rateLabel.className = 'sessionflow-widget-timetracker__settings-label';
      rateLabel.innerHTML = `<span class="sessionflow-widget-timetracker__settings-rate-preview">${this.#getConversionRate()} ${this.#getLabel()}</span> ${game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerConversionLabel')} ${this.#getSecondaryLabel()}`;
      rateRow.appendChild(rateLabel);

      const rateInput = document.createElement('input');
      rateInput.type = 'number';
      rateInput.className = 'sessionflow-widget-timetracker__settings-input';
      rateInput.value = this.#getConversionRate();
      rateInput.min = '0';
      rateInput.max = '100';
      rateInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const val = Math.max(0, parseInt(e.target.value) || 0);
        this.updateConfig({ conversionRate: val });
        this.engine.scheduleSave();
        this.#closeSettings();
      });
      rateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this.#closeSettings(); }
      });
      rateRow.appendChild(rateInput);
      body.appendChild(rateRow);

      // Remove secondary button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sessionflow-widget-timetracker__settings-remove-secondary';
      removeBtn.innerHTML = `<i class="fas fa-times"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerRemoveSecondary')}`;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({ secondaryLabel: '', conversionRate: 0, secondaryCount: 0 });
        this.engine.scheduleSave();
        this.#closeSettings();
      });
      body.appendChild(removeBtn);
    }
  }

  #buildHistoryToggle(body) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-timetracker__settings-row sessionflow-widget-timetracker__settings-row--inline';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `sf-tt-history-${this.id}`;
    checkbox.className = 'sessionflow-widget-timetracker__settings-checkbox';
    checkbox.checked = this.#getShowHistory();
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.updateConfig({ showHistory: checkbox.checked });
      this.engine.scheduleSave();
      this.#rerender();
    });
    row.appendChild(checkbox);

    const label = document.createElement('label');
    label.className = 'sessionflow-widget-timetracker__settings-label sessionflow-widget-timetracker__settings-label--clickable';
    label.htmlFor = `sf-tt-history-${this.id}`;
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerShowHistory');
    row.appendChild(label);

    body.appendChild(row);
  }

  #createSeparator() {
    const sep = document.createElement('div');
    sep.className = 'sessionflow-widget-timetracker__settings-separator';
    return sep;
  }

  #closeSettings() {
    this.#isSettingsOpen = false;
    const popover = this.element?.querySelector('.sessionflow-widget-timetracker__settings-popover');
    popover?.remove();

    if (this.#settingsCloseHandler) {
      document.removeEventListener('pointerdown', this.#settingsCloseHandler, true);
      this.#settingsCloseHandler = null;
    }

    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  Relative Timestamps                     */
  /* ---------------------------------------- */

  /** @param {string} isoString */
  #formatRelativeTime(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerJustNow');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  /** @param {number} delta */
  #increment(delta) {
    let count = this.#getCount() + delta;
    let secondaryCount = this.#getSecondaryCount();
    const conversionRate = this.#getConversionRate();
    let didConvert = false;

    // Handle secondary conversion (only on positive increments)
    if (conversionRate > 0 && this.#getSecondaryLabel() && delta > 0) {
      while (count >= conversionRate) {
        count -= conversionRate;
        secondaryCount += 1;
        didConvert = true;
      }
    }

    // Don't go below 0
    if (count < 0) count = 0;

    // Add to history (only if showHistory is enabled)
    const history = [...this.#getHistory()];
    if (this.#getShowHistory()) {
      history.push({
        id: foundry.utils.randomID(),
        delta,
        timestamp: new Date().toISOString()
      });
      while (history.length > MAX_HISTORY) history.shift();
    }

    // If conversion happened, play tick animation
    if (didConvert) {
      this.#playTickAnimation(count, secondaryCount, history);
    } else {
      this.updateConfig({ count, secondaryCount, history });
      this.engine.scheduleSave();
      this.#rerender();
      this.#playBumpAnimation();
    }

    // Update broadcast HUD
    if (this.#isBroadcasting) {
      // Delay slightly so config is committed before payload reads it
      requestAnimationFrame(() => this.#emitTrackerAction('updateTracker'));
    }
  }

  /** Play tick animation: ring fills to 100%, then resets */
  #playTickAnimation(finalCount, finalSecondary, history) {
    this.#isTicking = true;
    const progressEl = this.element?.querySelector('.sessionflow-widget-timetracker__ring-progress');
    if (progressEl) {
      progressEl.setAttribute('stroke-dashoffset', '0');
      progressEl.classList.add('is-ticking');
    }

    setTimeout(() => {
      this.#isTicking = false;
      this.updateConfig({ count: finalCount, secondaryCount: finalSecondary, history });
      this.engine.scheduleSave();
      this.#rerender();
      this.#playBumpAnimation();
    }, 450);
  }

  /** Subtle scale bump on the count number */
  #playBumpAnimation() {
    requestAnimationFrame(() => {
      const countEl = this.element?.querySelector('.sessionflow-widget-timetracker__count');
      if (!countEl) return;
      countEl.classList.add('is-bumping');
      countEl.addEventListener('animationend', () => {
        countEl.classList.remove('is-bumping');
      }, { once: true });
    });
  }

  #resetCounter() {
    this.updateConfig({
      count: 0,
      secondaryCount: 0,
      history: []
    });
    this.engine.scheduleSave();
    this.#showHistory = false;
    this.#rerender();

    if (this.#isBroadcasting) {
      this.#emitTrackerAction('updateTracker');
    }
  }

  /* ---------------------------------------- */
  /*  Broadcast & Flash                       */
  /* ---------------------------------------- */

  #toggleBroadcast() {
    if (this.#isBroadcasting) {
      this.#emitTrackerAction('hideTracker');
      this.#isBroadcasting = false;
    } else {
      this.#isBroadcasting = true;
      this.#emitTrackerAction('showTracker');
    }
    this.#rerender();
  }

  #flashTracker() {
    this.#emitTrackerAction('flashTracker');
  }

  /** Build and emit a tracker payload via socket + local hook */
  #emitTrackerAction(action) {
    const payload = action === 'hideTracker'
      ? { action, widgetId: this.id, senderId: game.user.id }
      : {
          action,
          widgetId: this.id,
          label: this.#getLabel(),
          count: this.#getCount(),
          step: this.#getStep(),
          secondaryLabel: this.#getSecondaryLabel(),
          secondaryCount: this.#getSecondaryCount(),
          conversionRate: this.#getConversionRate(),
          color: this.#getColor(),
          ringStyle: this.#getRingStyle(),
          centerIcon: this.#getCenterIcon(),
          badgeLabel: this.#getBadgeLabel(),
          senderId: game.user.id,
        };

    game.socket.emit(`module.${MODULE_ID}`, payload);
    Hooks.call(`sessionflow:${action}`, payload);
  }

  /** @returns {object} Tracker payload for HUD display */
  #getTrackerPayload() {
    return {
      widgetId: this.id,
      label: this.#getLabel(),
      count: this.#getCount(),
      step: this.#getStep(),
      secondaryLabel: this.#getSecondaryLabel(),
      secondaryCount: this.#getSecondaryCount(),
      conversionRate: this.#getConversionRate(),
      color: this.#getColor(),
      ringStyle: this.#getRingStyle(),
      centerIcon: this.#getCenterIcon(),
      badgeLabel: this.#getBadgeLabel(),
      senderId: game.user.id,
    };
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  beforeSave() {
    this.updateConfig({ isBroadcasting: this.#isBroadcasting });
  }

  destroy(reason = 'dispose') {
    if (this.#restoreBroadcastFrameId) {
      cancelAnimationFrame(this.#restoreBroadcastFrameId);
      this.#restoreBroadcastFrameId = null;
    }
    if (this.#iconPicker) {
      this.#iconPicker.destroy();
      this.#iconPicker = null;
    }
    this.#closeSettingsQuiet();
    if (reason === 'remove') {
      if (this.#isBroadcasting) this.#emitTrackerAction('hideTracker');
    }
    this.#isBroadcasting = false;
    super.destroy(reason);
  }

  /** Close settings without rerender (for destroy path) */
  #closeSettingsQuiet() {
    this.#isSettingsOpen = false;
    if (this.#settingsCloseHandler) {
      document.removeEventListener('pointerdown', this.#settingsCloseHandler, true);
      this.#settingsCloseHandler = null;
    }
  }

  /* ---------------------------------------- */
  /*  Re-render Helper                        */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }
}

// Self-register
registerWidgetType(TimeTrackerWidget.TYPE, TimeTrackerWidget);
