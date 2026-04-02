/**
 * SessionFlow - Progress Clock Widget
 * Blades-in-the-Dark-style clocks with configurable segments, colors, and broadcast.
 * Supports multiple clocks per widget instance, countdown mode, linked clocks,
 * auto-chat, threat glow, bar visual style, labels, and a global clock library.
 * @module widgets/progress-clock-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';
const CLOCK_LIBRARY_SETTING = 'clockLibrary';

/** Curated color palette for progress clocks */
const CLOCK_COLORS = [
  { filled: '#7c5cbf', name: 'Purple' },
  { filled: '#dc3545', name: 'Red' },
  { filled: '#f97316', name: 'Orange' },
  { filled: '#eab308', name: 'Gold' },
  { filled: '#10b981', name: 'Green' },
  { filled: '#3b82f6', name: 'Blue' },
  { filled: '#06b6d4', name: 'Cyan' },
  { filled: '#ec4899', name: 'Pink' },
  { filled: '#94a3b8', name: 'Silver' },
];

/**
 * Normalize and validate a clock library entry.
 * @param {object} entry
 * @returns {object|null}
 */
function normalizeClockLibraryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const segments = ProgressClockWidget.SEGMENT_OPTIONS.includes(entry.segments) ? entry.segments : 4;
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : foundry.utils.randomID(),
    title: typeof entry.title === 'string' ? entry.title : '',
    segments,
    filled: Number.isFinite(entry.filled) ? Math.max(0, Math.min(entry.filled, segments)) : 0,
    filledColor: typeof entry.filledColor === 'string' ? entry.filledColor : ProgressClockWidget.DEFAULT_FILLED,
    emptyColor: typeof entry.emptyColor === 'string' ? entry.emptyColor : ProgressClockWidget.DEFAULT_EMPTY,
    style: ['pie', 'dots', 'bar'].includes(entry.style) ? entry.style : 'pie',
    mode: ['progress', 'countdown'].includes(entry.mode) ? entry.mode : 'progress',
    label: typeof entry.label === 'string' ? entry.label : '',
    chatOnComplete: typeof entry.chatOnComplete === 'string' ? entry.chatOnComplete : '',
    chatOnEmpty: typeof entry.chatOnEmpty === 'string' ? entry.chatOnEmpty : '',
    updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now()
  };
}

export class ProgressClockWidget extends Widget {

  static TYPE = 'progress-clock';
  static LABEL = 'SESSIONFLOW.Canvas.ProgressClock';
  static ICON = 'fas fa-circle-notch';
  static MIN_WIDTH = 160;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 280;
  static DEFAULT_HEIGHT = 240;
  static PLAYER_MODES = ['view'];

  /** SVG namespace */
  static SVG_NS = 'http://www.w3.org/2000/svg';

  /** Available segment presets */
  static SEGMENT_OPTIONS = [2, 3, 4, 6, 8, 10, 12];

  /** Default colors */
  static DEFAULT_FILLED = '#7c5cbf';
  static DEFAULT_EMPTY = '#2a2a3a';
  static HELP = 'SESSIONFLOW.Help.ProgressClock';

  /** @type {Set<string>} Clock IDs currently broadcasting */
  #broadcastingClocks = new Set();

  /** @type {boolean} Whether initial state restoration has been done */
  #restored = false;

  /** @type {number|null} Hook ID for dock clock update listener */
  #dockUpdateHookId = null;

  /** @type {boolean} Whether the library panel is open */
  #isLibraryPanelOpen = false;

  /** @type {Promise} Write queue for library operations */
  #libraryWritePromise = Promise.resolve();

  /** @type {string|null} Clock ID whose settings popover is open */
  #openSettingsClockId = null;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.ProgressClock');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    // Restore broadcast state and register dock sync hook (only once on first render)
    if (!this.#restored) {
      this.#restored = true;
      const savedIds = this.config.broadcastingClockIds ?? [];
      if (savedIds.length > 0) {
        for (const id of savedIds) this.#broadcastingClocks.add(id);
        // Re-emit showClock for each broadcasting clock so players get current info
        requestAnimationFrame(() => {
          for (const clockId of this.#broadcastingClocks) {
            this.#emitClockAction('showClock', clockId);
          }
        });
      }

      // Listen for dock edits (GM clicking segments in the HUD dock)
      this.#dockUpdateHookId = Hooks.on('sessionflow:dockClockUpdate', (data) => {
        this.#onDockClockUpdate(data);
      });
    }

    const clocks = this.config.clocks ?? [];

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-clock';

    if (clocks.length === 0 && !this.#isLibraryPanelOpen) {
      // Empty state — prompt to add first clock
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-clock__empty';
      empty.innerHTML = `
        <i class="fas fa-circle-notch"></i>
        <p>${game.i18n.localize('SESSIONFLOW.Canvas.ClockEmpty')}</p>
      `;
      container.appendChild(empty);
    } else if (!this.#isLibraryPanelOpen) {
      // Clock grid
      const grid = document.createElement('div');
      grid.className = 'sessionflow-widget-clock__grid';

      for (const clock of clocks) {
        grid.appendChild(this.#buildClock(clock));
      }

      container.appendChild(grid);
    }

    // Library panel (overlays the grid)
    if (this.#isLibraryPanelOpen) {
      container.appendChild(this.#buildLibraryPanel());
    }

    // Button row (editable mode only)
    if (this.canEdit && !this.#isLibraryPanelOpen) {
      const btnRow = document.createElement('div');
      btnRow.className = 'sessionflow-widget-clock__btn-row';

      // Add clock button
      const addBtn = document.createElement('button');
      addBtn.className = 'sessionflow-widget-clock__add-btn';
      addBtn.type = 'button';
      addBtn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.ClockAdd')}`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#addClock();
      });
      btnRow.appendChild(addBtn);

      // Library button
      const libBtn = document.createElement('button');
      libBtn.className = 'sessionflow-widget-clock__library-btn';
      libBtn.type = 'button';
      libBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLibrary');
      libBtn.innerHTML = '<i class="fas fa-book"></i>';
      libBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#isLibraryPanelOpen = true;
        this.refreshBody();
      });
      btnRow.appendChild(libBtn);

      container.appendChild(btnRow);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Clock Builder                           */
  /* ---------------------------------------- */

  /**
   * Build a single clock element with visual, title, and controls.
   * @param {object} clock
   * @returns {HTMLElement}
   */
  #buildClock(clock) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-clock__item';
    wrapper.dataset.clockId = clock.id;

    // Threat glow urgency classes
    const mode = clock.mode || 'progress';
    const urgency = mode === 'progress'
      ? clock.filled / clock.segments
      : 1 - (clock.filled / clock.segments);
    if (urgency > 0.5 && urgency < 0.75) wrapper.classList.add('is-warming');
    else if (urgency >= 0.75 && urgency < 1) wrapper.classList.add('is-hot');
    else if (urgency >= 1) wrapper.classList.add('is-critical');

    // Countdown visual indicator
    if (mode === 'countdown') wrapper.classList.add('is-countdown');

    // Visual: pie, dots, or bar
    const style = clock.style || 'pie';
    const visual = style === 'dots'
      ? this.#buildDotsVisual(clock)
      : style === 'bar'
        ? this.#buildBarVisual(clock)
        : this.#buildPieVisual(clock);
    wrapper.appendChild(visual);

    // Color preset dots (editable mode only)
    if (this.canEdit) {
      wrapper.appendChild(this.#buildColorDots(clock));
    }

    // Title (editable)
    const title = document.createElement('span');
    title.className = 'sessionflow-widget-clock__title';
    title.textContent = clock.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle');
    title.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockEditTitle');

    if (this.canEdit) {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#editTitle(clock.id, title);
      });
    }

    wrapper.appendChild(title);

    // Linked clock indicator
    if (clock.linkedClockId) {
      const clocks = this.config.clocks ?? [];
      const linked = clocks.find(c => c.id === clock.linkedClockId);
      if (linked) {
        const linkIndicator = document.createElement('span');
        linkIndicator.className = 'sessionflow-widget-clock__link-indicator';
        linkIndicator.innerHTML = `<i class="fas fa-link"></i> ${linked.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle')}`;
        linkIndicator.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLinkedLabel');
        wrapper.appendChild(linkIndicator);
      }
    }

    // Label tag (editable pill)
    if (this.canEdit || clock.label) {
      const label = document.createElement('span');
      label.className = 'sessionflow-widget-clock__label';
      if (clock.label) {
        label.textContent = clock.label;
      } else {
        label.classList.add('is-empty');
        label.innerHTML = '<i class="fas fa-tag"></i>';
        label.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLabelPlaceholder');
      }

      if (this.canEdit) {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#editLabel(clock.id, label);
        });
      }

      wrapper.appendChild(label);
    }

    // Progress label (e.g., "2/4")
    const progress = document.createElement('span');
    progress.className = 'sessionflow-widget-clock__progress';
    progress.textContent = `${clock.filled}/${clock.segments}`;
    if (mode === 'countdown') {
      const icon = document.createElement('i');
      icon.className = 'fas fa-hourglass-half';
      icon.style.marginRight = '3px';
      icon.style.fontSize = '0.5rem';
      progress.prepend(icon);
    }
    wrapper.appendChild(progress);

    // Controls row (editable mode only)
    if (this.canEdit) {
      const controls = document.createElement('div');
      controls.className = 'sessionflow-widget-clock__controls';

      // Segment count selector
      const segSelect = document.createElement('select');
      segSelect.className = 'sessionflow-widget-clock__seg-select';
      segSelect.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockSegments');
      for (const opt of ProgressClockWidget.SEGMENT_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === clock.segments) option.selected = true;
        segSelect.appendChild(option);
      }
      segSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.#changeSegments(clock.id, parseInt(e.target.value));
      });
      controls.appendChild(segSelect);

      // Style selector (Pie / Dots / Bar)
      const styleSelect = document.createElement('select');
      styleSelect.className = 'sessionflow-widget-clock__style-select';
      styleSelect.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockStyle');
      for (const [val, labelKey] of [
        ['pie', 'SESSIONFLOW.Canvas.ClockStylePie'],
        ['dots', 'SESSIONFLOW.Canvas.ClockStyleDots'],
        ['bar', 'SESSIONFLOW.Canvas.ClockStyleBar']
      ]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = game.i18n.localize(labelKey);
        if ((clock.style || 'pie') === val) opt.selected = true;
        styleSelect.appendChild(opt);
      }
      styleSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.#updateClockProp(clock.id, 'style', e.target.value);
      });
      controls.appendChild(styleSelect);

      // Mode selector (Progress / Countdown)
      const modeSelect = document.createElement('select');
      modeSelect.className = 'sessionflow-widget-clock__mode-select';
      modeSelect.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockMode');
      for (const [val, labelKey] of [
        ['progress', 'SESSIONFLOW.Canvas.ClockModeProgress'],
        ['countdown', 'SESSIONFLOW.Canvas.ClockModeCountdown']
      ]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = game.i18n.localize(labelKey);
        if (mode === val) opt.selected = true;
        modeSelect.appendChild(opt);
      }
      modeSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.#changeMode(clock.id, e.target.value);
      });
      controls.appendChild(modeSelect);

      // Linked clock selector
      const otherClocks = (this.config.clocks ?? []).filter(c => c.id !== clock.id);
      if (otherClocks.length > 0) {
        const linkSelect = document.createElement('select');
        linkSelect.className = 'sessionflow-widget-clock__link-select';
        linkSelect.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLinkedLabel');

        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = game.i18n.localize('SESSIONFLOW.Canvas.ClockLinkedNone');
        linkSelect.appendChild(noneOpt);

        for (const other of otherClocks) {
          const opt = document.createElement('option');
          opt.value = other.id;
          opt.textContent = other.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle');
          if (clock.linkedClockId === other.id) opt.selected = true;
          linkSelect.appendChild(opt);
        }

        linkSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          this.#updateClockProp(clock.id, 'linkedClockId', e.target.value || null);
        });
        controls.appendChild(linkSelect);
      }

      // Broadcast toggle button
      const isBroadcasting = this.#broadcastingClocks.has(clock.id);
      const broadcastBtn = document.createElement('button');
      broadcastBtn.className = 'sessionflow-widget-clock__broadcast-btn';
      if (isBroadcasting) broadcastBtn.classList.add('is-active');
      broadcastBtn.type = 'button';
      broadcastBtn.title = game.i18n.localize(isBroadcasting
        ? 'SESSIONFLOW.Canvas.ClockStopBroadcast'
        : 'SESSIONFLOW.Canvas.ClockStartBroadcast');
      broadcastBtn.innerHTML = '<i class="fas fa-tower-broadcast"></i>';
      broadcastBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleClockBroadcast(clock.id);
      });
      controls.appendChild(broadcastBtn);

      // Flash button (one-shot dramatic popup)
      const flashBtn = document.createElement('button');
      flashBtn.className = 'sessionflow-widget-clock__flash-btn';
      flashBtn.type = 'button';
      flashBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockFlash');
      flashBtn.innerHTML = '<i class="fas fa-bolt"></i>';
      flashBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#flashClock(clock.id);
      });
      controls.appendChild(flashBtn);

      // Settings button (chat messages)
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'sessionflow-widget-clock__settings-btn';
      settingsBtn.type = 'button';
      settingsBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockSettings');
      settingsBtn.innerHTML = '<i class="fas fa-gear"></i>';
      if (clock.chatOnComplete || clock.chatOnEmpty) settingsBtn.classList.add('has-config');
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleSettingsPopover(clock.id, settingsBtn);
      });
      controls.appendChild(settingsBtn);

      // Reset button
      const resetBtn = document.createElement('button');
      resetBtn.className = 'sessionflow-widget-clock__reset-btn';
      resetBtn.type = 'button';
      resetBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockReset');
      resetBtn.innerHTML = '<i class="fas fa-rotate-left"></i>';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#resetClock(clock.id);
      });
      controls.appendChild(resetBtn);

      // Save to library button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'sessionflow-widget-clock__save-btn';
      saveBtn.type = 'button';
      saveBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLibrarySave');
      saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i>';
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#saveClockToLibrary(clock.id);
      });
      controls.appendChild(saveBtn);

      // Delete clock button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'sessionflow-widget-clock__delete-btn';
      deleteBtn.type = 'button';
      deleteBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockDelete');
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#deleteClock(clock.id);
      });
      controls.appendChild(deleteBtn);

      wrapper.appendChild(controls);

      // Settings popover (if open for this clock)
      if (this.#openSettingsClockId === clock.id) {
        wrapper.appendChild(this.#buildSettingsPopover(clock));
      }
    }

    return wrapper;
  }

  /* ---------------------------------------- */
  /*  Color Preset Dots                       */
  /* ---------------------------------------- */

  /**
   * Build color preset dot row for a clock.
   * @param {object} clock
   * @returns {HTMLElement}
   */
  #buildColorDots(clock) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-clock__colors';

    const currentColor = (clock.filledColor || ProgressClockWidget.DEFAULT_FILLED).toLowerCase();

    for (const preset of CLOCK_COLORS) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'sessionflow-widget-clock__color-dot';
      if (currentColor === preset.filled.toLowerCase()) dot.classList.add('is-active');
      dot.style.background = preset.filled;
      dot.title = preset.name;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#setClockColor(clock.id, preset.filled);
      });
      row.appendChild(dot);
    }

    return row;
  }

  /**
   * Set a clock's filled color from a preset.
   * @param {string} clockId
   * @param {string} color
   */
  #setClockColor(clockId, color) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    clock.filledColor = color;
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  /* ---------------------------------------- */
  /*  Pie Visual                              */
  /* ---------------------------------------- */

  /**
   * Build a pie-chart SVG visual for a clock.
   * @param {object} clock
   * @returns {SVGElement}
   */
  #buildPieVisual(clock) {
    const size = 120;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) - 6;

    const NS = ProgressClockWidget.SVG_NS;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.classList.add('sessionflow-widget-clock__svg');

    const filledColor = clock.filledColor || ProgressClockWidget.DEFAULT_FILLED;
    const emptyColor = clock.emptyColor || ProgressClockWidget.DEFAULT_EMPTY;

    // Defs: glow filter unique per clock
    const defs = document.createElementNS(NS, 'defs');
    const filterId = `sf-glow-${clock.id}`;
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '3');
    blur.setAttribute('result', 'glow');
    filter.appendChild(blur);

    const merge = document.createElementNS(NS, 'feMerge');
    const mergeGlow = document.createElementNS(NS, 'feMergeNode');
    mergeGlow.setAttribute('in', 'glow');
    merge.appendChild(mergeGlow);
    const mergeSource = document.createElementNS(NS, 'feMergeNode');
    mergeSource.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeSource);
    filter.appendChild(merge);

    defs.appendChild(filter);
    svg.appendChild(defs);

    // Outer decorative ring
    const outerRing = document.createElementNS(NS, 'circle');
    outerRing.setAttribute('cx', cx);
    outerRing.setAttribute('cy', cy);
    outerRing.setAttribute('r', r + 3);
    outerRing.setAttribute('fill', 'none');
    outerRing.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    outerRing.setAttribute('stroke-width', '1');
    svg.appendChild(outerRing);

    // Segments
    for (let i = 0; i < clock.segments; i++) {
      const isFilled = i < clock.filled;
      const path = this.#buildSegmentPath(cx, cy, r, i, clock.segments);

      const segment = document.createElementNS(NS, 'path');
      segment.setAttribute('d', path);
      segment.setAttribute('fill', isFilled ? filledColor : emptyColor);
      segment.setAttribute('stroke', 'rgba(255,255,255,0.12)');
      segment.setAttribute('stroke-width', '0.75');
      segment.classList.add('sessionflow-widget-clock__segment');
      if (isFilled) {
        segment.setAttribute('filter', `url(#${filterId})`);
        segment.classList.add('is-filled');
      }
      segment.dataset.segmentIndex = i;

      if (this.canEdit) {
        segment.style.cursor = 'pointer';
        segment.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#toggleSegment(clock.id, i);
        });
      }

      svg.appendChild(segment);
    }

    // Inner ring
    const innerRing = document.createElementNS(NS, 'circle');
    innerRing.setAttribute('cx', cx);
    innerRing.setAttribute('cy', cy);
    innerRing.setAttribute('r', '6');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    innerRing.setAttribute('stroke-width', '1');
    svg.appendChild(innerRing);

    return svg;
  }

  /* ---------------------------------------- */
  /*  Dots Visual                             */
  /* ---------------------------------------- */

  /**
   * Build a dots-style visual for a clock (tokens in a ring).
   * @param {object} clock
   * @returns {HTMLElement}
   */
  #buildDotsVisual(clock) {
    const size = 120;
    const container = document.createElement('div');
    container.className = 'sessionflow-widget-clock__dots';
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    const filledColor = clock.filledColor || ProgressClockWidget.DEFAULT_FILLED;
    const emptyColor = clock.emptyColor || ProgressClockWidget.DEFAULT_EMPTY;

    const cx = size / 2;
    const cy = size / 2;
    const ringR = (size / 2) - 16; // radius of the ring (44px)
    const dotSize = Math.max(10, Math.min(18, 120 / clock.segments));

    for (let i = 0; i < clock.segments; i++) {
      const isFilled = i < clock.filled;
      const angle = ((2 * Math.PI) / clock.segments) * i - (Math.PI / 2);
      const x = cx + ringR * Math.cos(angle);
      const y = cy + ringR * Math.sin(angle);

      const dot = document.createElement('div');
      dot.className = 'sessionflow-widget-clock__dot';
      if (isFilled) dot.classList.add('is-filled');
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
      dot.style.left = `${x - dotSize / 2}px`;
      dot.style.top = `${y - dotSize / 2}px`;

      if (isFilled) {
        dot.style.background = filledColor;
        dot.style.boxShadow = `0 0 8px ${filledColor}, 0 0 4px ${filledColor}`;
        dot.style.borderColor = filledColor;
      } else {
        dot.style.background = 'transparent';
        dot.style.borderColor = emptyColor;
      }

      dot.dataset.segmentIndex = i;

      if (this.canEdit) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#toggleSegment(clock.id, i);
        });
      }

      container.appendChild(dot);
    }

    return container;
  }

  /* ---------------------------------------- */
  /*  Bar Visual                              */
  /* ---------------------------------------- */

  /**
   * Build a horizontal bar-style visual for a clock.
   * @param {object} clock
   * @returns {HTMLElement}
   */
  #buildBarVisual(clock) {
    const container = document.createElement('div');
    container.className = 'sessionflow-widget-clock__bar';

    const filledColor = clock.filledColor || ProgressClockWidget.DEFAULT_FILLED;
    const emptyColor = clock.emptyColor || ProgressClockWidget.DEFAULT_EMPTY;

    for (let i = 0; i < clock.segments; i++) {
      const isFilled = i < clock.filled;
      const seg = document.createElement('div');
      seg.className = 'sessionflow-widget-clock__bar-segment';
      if (isFilled) seg.classList.add('is-filled');
      seg.style.background = isFilled ? filledColor : emptyColor;
      if (isFilled) {
        seg.style.boxShadow = `0 0 6px ${filledColor}40`;
      }
      seg.dataset.segmentIndex = i;

      if (this.canEdit) {
        seg.style.cursor = 'pointer';
        seg.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#toggleSegment(clock.id, i);
        });
      }

      container.appendChild(seg);
    }

    return container;
  }

  /* ---------------------------------------- */
  /*  SVG Path Generation                     */
  /* ---------------------------------------- */

  /**
   * Generate an SVG path string for a pie segment.
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} r - Radius
   * @param {number} index - Segment index
   * @param {number} total - Total segments
   * @returns {string} SVG path data
   */
  #buildSegmentPath(cx, cy, r, index, total) {
    const anglePerSegment = (2 * Math.PI) / total;
    // Start from top (-90 degrees)
    const startAngle = (index * anglePerSegment) - (Math.PI / 2);
    const endAngle = ((index + 1) * anglePerSegment) - (Math.PI / 2);

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const largeArc = anglePerSegment > Math.PI ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  /* ---------------------------------------- */
  /*  Clock Actions                           */
  /* ---------------------------------------- */

  #addClock() {
    const clocks = this.config.clocks ?? [];
    clocks.push({
      id: foundry.utils.randomID(),
      title: '',
      segments: 4,
      filled: 0,
      filledColor: ProgressClockWidget.DEFAULT_FILLED,
      emptyColor: ProgressClockWidget.DEFAULT_EMPTY,
      style: 'pie',
      mode: 'progress',
      label: '',
      linkedClockId: null,
      chatOnComplete: '',
      chatOnEmpty: ''
    });
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();
  }

  #deleteClock(clockId) {
    // Stop broadcast if active
    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('hideClock', clockId);
      this.#broadcastingClocks.delete(clockId);
    }
    // Clear any linked references to this clock
    const clocks = (this.config.clocks ?? []).filter(c => c.id !== clockId);
    for (const c of clocks) {
      if (c.linkedClockId === clockId) c.linkedClockId = null;
    }
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();
  }

  #toggleSegment(clockId, segmentIndex) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    // Store previous filled for completion detection
    const prevFilled = clock.filled;

    if (segmentIndex < clock.filled) {
      clock.filled = segmentIndex;
    } else {
      clock.filled = segmentIndex + 1;
    }

    // Check for completion (linked clocks + auto-chat)
    this.#checkCompletion(clock, prevFilled, clocks);

    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    // Update broadcast if active
    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  #changeSegments(clockId, newSegments) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const mode = clock.mode || 'progress';
    const wasFull = clock.filled === clock.segments;

    clock.segments = newSegments;
    if (clock.filled > newSegments) clock.filled = newSegments;

    // If countdown mode and was at max, stay at max
    if (mode === 'countdown' && wasFull) clock.filled = newSegments;

    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  /**
   * Change a clock's mode between progress and countdown.
   * @param {string} clockId
   * @param {string} newMode - 'progress' | 'countdown'
   */
  #changeMode(clockId, newMode) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const oldMode = clock.mode || 'progress';
    if (newMode === oldMode) return;

    clock.mode = newMode;

    // Flip filled state when switching modes
    if (newMode === 'countdown' && clock.filled === 0) {
      clock.filled = clock.segments;
    } else if (newMode === 'progress' && clock.filled === clock.segments) {
      clock.filled = 0;
    }

    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  /**
   * Reset a clock to its start state.
   * @param {string} clockId
   */
  #resetClock(clockId) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const mode = clock.mode || 'progress';
    clock.filled = mode === 'countdown' ? clock.segments : 0;

    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  #updateClockProp(clockId, prop, value) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    clock[prop] = value;
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();

    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('updateClock', clockId);
    }
  }

  #editTitle(clockId, titleEl) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-widget-clock__title-input';
    input.value = clock.title || '';
    input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.ClockTitlePlaceholder');

    const save = () => {
      clock.title = input.value.trim();
      this.updateConfig({ clocks });
      this.engine.scheduleSave();
      this.refreshBody();

      if (this.#broadcastingClocks.has(clockId)) {
        this.#emitClockAction('updateClock', clockId);
      }
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); this.refreshBody(); }
    });

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  /**
   * Inline edit a clock's label tag.
   * @param {string} clockId
   * @param {HTMLElement} labelEl
   */
  #editLabel(clockId, labelEl) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-widget-clock__label-input';
    input.value = clock.label || '';
    input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.ClockLabelPlaceholder');

    const save = () => {
      clock.label = input.value.trim();
      this.updateConfig({ clocks });
      this.engine.scheduleSave();
      this.refreshBody();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); this.refreshBody(); }
    });

    labelEl.replaceWith(input);
    input.focus();
    input.select();
  }

  /* ---------------------------------------- */
  /*  Completion Detection                    */
  /* ---------------------------------------- */

  /**
   * Check if a clock just completed and handle linked clocks + auto-chat.
   * @param {object} clock - The clock that was just modified
   * @param {number} prevFilled - Previous filled value before the change
   * @param {object[]} clocks - All clocks in the widget (mutable)
   * @param {Set<string>} [visited] - Infinite loop guard for linked chains
   */
  #checkCompletion(clock, prevFilled, clocks, visited = new Set()) {
    const mode = clock.mode || 'progress';
    const isComplete = (mode === 'progress' && clock.filled === clock.segments && prevFilled < clock.segments)
                    || (mode === 'countdown' && clock.filled === 0 && prevFilled > 0);

    if (!isComplete) return;
    if (visited.has(clock.id)) return;
    visited.add(clock.id);

    // Auto-chat message
    const chatMsg = mode === 'progress' ? clock.chatOnComplete : clock.chatOnEmpty;
    if (chatMsg) {
      this.#sendCompletionChat(clock, mode, chatMsg);
    }

    // Auto-flash on completion
    if (this.#broadcastingClocks.has(clock.id)) {
      this.#emitClockAction('flashClock', clock.id);
    }

    // Linked clock chain
    if (clock.linkedClockId) {
      const linked = clocks.find(c => c.id === clock.linkedClockId);
      if (linked && linked.filled < linked.segments) {
        const linkedPrev = linked.filled;
        linked.filled += 1;

        // Update broadcast for linked clock
        if (this.#broadcastingClocks.has(linked.id)) {
          // Defer to after current save cycle
          requestAnimationFrame(() => this.#emitClockAction('updateClock', linked.id));
        }

        // Recursively check if linked clock also completed
        this.#checkCompletion(linked, linkedPrev, clocks, visited);
      }
    }
  }

  /**
   * Send a chat message when a clock completes.
   * @param {object} clock
   * @param {string} mode
   * @param {string} message
   */
  #sendCompletionChat(clock, mode, message) {
    const title = clock.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle');
    const color = clock.filledColor || ProgressClockWidget.DEFAULT_FILLED;
    const icon = mode === 'progress' ? 'fa-circle-check' : 'fa-hourglass-end';
    const statusLabel = mode === 'progress'
      ? game.i18n.localize('SESSIONFLOW.Canvas.ClockChatFilled')
      : game.i18n.localize('SESSIONFLOW.Canvas.ClockChatEmptied');

    const content = `
      <div style="border-left:3px solid ${color};padding:6px 10px;border-radius:4px;">
        <div style="font-weight:700;font-size:13px;color:${color};margin-bottom:4px;">
          <i class="fas ${icon}" style="margin-right:4px;"></i>${statusLabel}
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${title}</div>
        <div style="font-style:italic;color:#ccc;">${message}</div>
      </div>
    `.trim();

    ChatMessage.create({
      content,
      speaker: { alias: 'SessionFlow' },
      whisper: []
    });
  }

  /* ---------------------------------------- */
  /*  Settings Popover (Chat Messages)        */
  /* ---------------------------------------- */

  /**
   * Toggle the settings popover for a clock.
   * @param {string} clockId
   * @param {HTMLElement} anchorBtn
   */
  #toggleSettingsPopover(clockId, anchorBtn) {
    if (this.#openSettingsClockId === clockId) {
      this.#openSettingsClockId = null;
    } else {
      this.#openSettingsClockId = clockId;
    }
    this.refreshBody();
  }

  /**
   * Build the settings popover for chat messages.
   * @param {object} clock
   * @returns {HTMLElement}
   */
  #buildSettingsPopover(clock) {
    const popover = document.createElement('div');
    popover.className = 'sessionflow-widget-clock__settings-popover';

    const header = document.createElement('div');
    header.className = 'sessionflow-widget-clock__settings-header';
    header.textContent = game.i18n.localize('SESSIONFLOW.Canvas.ClockSettings');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sessionflow-widget-clock__settings-close';
    closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openSettingsClockId = null;
      this.refreshBody();
    });
    header.appendChild(closeBtn);
    popover.appendChild(header);

    // Chat on complete (progress fills)
    const completeGroup = this.#buildSettingsField(
      clock,
      'chatOnComplete',
      game.i18n.localize('SESSIONFLOW.Canvas.ClockChatOnComplete'),
      game.i18n.localize('SESSIONFLOW.Canvas.ClockChatPlaceholder')
    );
    popover.appendChild(completeGroup);

    // Chat on empty (countdown drains)
    const emptyGroup = this.#buildSettingsField(
      clock,
      'chatOnEmpty',
      game.i18n.localize('SESSIONFLOW.Canvas.ClockChatOnEmpty'),
      game.i18n.localize('SESSIONFLOW.Canvas.ClockChatPlaceholder')
    );
    popover.appendChild(emptyGroup);

    return popover;
  }

  /**
   * Build a single settings field (label + input).
   * @param {object} clock
   * @param {string} prop - Config property name
   * @param {string} label - Display label
   * @param {string} placeholder
   * @returns {HTMLElement}
   */
  #buildSettingsField(clock, prop, label, placeholder) {
    const group = document.createElement('div');
    group.className = 'sessionflow-widget-clock__settings-field';

    const lbl = document.createElement('label');
    lbl.className = 'sessionflow-widget-clock__settings-label';
    lbl.textContent = label;
    group.appendChild(lbl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-widget-clock__settings-input';
    input.value = clock[prop] || '';
    input.placeholder = placeholder;

    input.addEventListener('change', (e) => {
      e.stopPropagation();
      this.#updateClockProp(clock.id, prop, e.target.value.trim());
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.#openSettingsClockId = null;
        this.refreshBody();
      }
    });

    group.appendChild(input);
    return group;
  }

  /* ---------------------------------------- */
  /*  Broadcast                               */
  /* ---------------------------------------- */

  /**
   * Flash a clock as a dramatic one-shot popup.
   * @param {string} clockId
   */
  #flashClock(clockId) {
    this.#emitClockAction('flashClock', clockId);
  }

  /**
   * Toggle broadcasting a clock to all players.
   * @param {string} clockId
   */
  #toggleClockBroadcast(clockId) {
    if (this.#broadcastingClocks.has(clockId)) {
      this.#emitClockAction('hideClock', clockId);
      this.#broadcastingClocks.delete(clockId);
    } else {
      this.#broadcastingClocks.add(clockId);
      this.#emitClockAction('showClock', clockId);
    }
    this.refreshBody();
  }

  /**
   * Build a payload for broadcasting a clock.
   * @param {string} clockId
   * @returns {object|null}
   */
  #getClockPayload(clockId) {
    const clock = (this.config.clocks ?? []).find(c => c.id === clockId);
    if (!clock) return null;
    return {
      clockId: clock.id,
      title: clock.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle'),
      segments: clock.segments,
      filled: clock.filled,
      filledColor: clock.filledColor || ProgressClockWidget.DEFAULT_FILLED,
      emptyColor: clock.emptyColor || ProgressClockWidget.DEFAULT_EMPTY,
      style: clock.style || 'pie',
      mode: clock.mode || 'progress',
      label: clock.label || '',
      senderId: game.user.id
    };
  }

  /**
   * Emit a clock broadcast action via socket + local hook.
   * @param {string} action - 'showClock' | 'updateClock' | 'hideClock' | 'flashClock'
   * @param {string} clockId
   */
  #emitClockAction(action, clockId) {
    const payload = action === 'hideClock'
      ? { action, clockId, senderId: game.user.id }
      : { action, ...this.#getClockPayload(clockId) };
    if (!payload) return;

    game.socket.emit(`module.${MODULE_ID}`, payload);
    Hooks.call(`sessionflow:${action}`, payload);
  }

  /* ---------------------------------------- */
  /*  Dock Sync                               */
  /* ---------------------------------------- */

  /**
   * Handle a clock update from the dock (GM clicked a segment in the HUD).
   * Sync the widget's internal config without re-broadcasting.
   * @param {{ clockId: string, filled: number }} data
   */
  #onDockClockUpdate(data) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === data.clockId);
    if (!clock) return;

    clock.filled = data.filled;
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  Clock Library                           */
  /* ---------------------------------------- */

  /**
   * Get all saved clocks from the library.
   * @returns {object[]}
   */
  #getSavedClocks() {
    const raw = game.settings.get(MODULE_ID, CLOCK_LIBRARY_SETTING) ?? [];
    return (Array.isArray(raw) ? raw : [])
      .map(entry => normalizeClockLibraryEntry(entry))
      .filter(Boolean)
      .sort((a, b) => (a.title || '').localeCompare(b.title || '') || (b.updatedAt - a.updatedAt));
  }

  /**
   * Queue a library write operation (prevents race conditions).
   * @param {Function} task
   * @returns {Promise}
   */
  #queueLibraryWrite(task) {
    const run = async () => {
      try {
        return await task();
      } catch (err) {
        console.warn(`[${MODULE_ID}] Failed to update clock library:`, err);
        return null;
      }
    };
    this.#libraryWritePromise = this.#libraryWritePromise.then(run, run);
    return this.#libraryWritePromise;
  }

  /**
   * Save a clock to the global library.
   * @param {string} clockId
   */
  async #saveClockToLibrary(clockId) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    const entry = normalizeClockLibraryEntry({
      id: foundry.utils.randomID(),
      title: clock.title,
      segments: clock.segments,
      filled: clock.filled,
      filledColor: clock.filledColor,
      emptyColor: clock.emptyColor,
      style: clock.style,
      mode: clock.mode,
      label: clock.label,
      chatOnComplete: clock.chatOnComplete,
      chatOnEmpty: clock.chatOnEmpty,
      updatedAt: Date.now()
    });
    if (!entry) return;

    await this.#queueLibraryWrite(async () => {
      const library = this.#getSavedClocks();
      library.push(entry);
      await game.settings.set(MODULE_ID, CLOCK_LIBRARY_SETTING, library);
    });

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.ClockLibrarySaved'));
  }

  /**
   * Load a clock from the library into this widget.
   * @param {string} libraryId
   */
  #loadClockFromLibrary(libraryId) {
    const saved = this.#getSavedClocks().find(e => e.id === libraryId);
    if (!saved) return;

    const clocks = this.config.clocks ?? [];
    clocks.push({
      id: foundry.utils.randomID(), // New ID — it's a copy
      title: saved.title,
      segments: saved.segments,
      filled: saved.filled,
      filledColor: saved.filledColor,
      emptyColor: saved.emptyColor,
      style: saved.style,
      mode: saved.mode,
      label: saved.label,
      linkedClockId: null, // Links are widget-local
      chatOnComplete: saved.chatOnComplete,
      chatOnEmpty: saved.chatOnEmpty
    });

    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.#isLibraryPanelOpen = false;
    this.refreshBody();

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.ClockLibraryLoaded'));
  }

  /**
   * Delete a clock from the library.
   * @param {string} libraryId
   */
  async #deleteClockFromLibrary(libraryId) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.ClockLibrary') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.ClockLibraryDeleteConfirm')}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;

    await this.#queueLibraryWrite(async () => {
      const library = this.#getSavedClocks().filter(e => e.id !== libraryId);
      await game.settings.set(MODULE_ID, CLOCK_LIBRARY_SETTING, library);
    });

    this.refreshBody();
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.ClockLibraryDeleted'));
  }

  /**
   * Build the library panel overlay.
   * @returns {HTMLElement}
   */
  #buildLibraryPanel() {
    const panel = document.createElement('div');
    panel.className = 'sessionflow-widget-clock__library-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'sessionflow-widget-clock__library-header';

    const title = document.createElement('span');
    title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.ClockLibrary');
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sessionflow-widget-clock__library-close';
    closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#isLibraryPanelOpen = false;
      this.refreshBody();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Library list
    const saved = this.#getSavedClocks();

    if (saved.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-clock__library-empty';
      empty.innerHTML = `<i class="fas fa-box-open"></i><p>${game.i18n.localize('SESSIONFLOW.Canvas.ClockLibraryNoSaved')}</p>`;
      panel.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'sessionflow-widget-clock__library-list';

      for (const entry of saved) {
        const item = document.createElement('div');
        item.className = 'sessionflow-widget-clock__library-item';

        // Mini preview
        const preview = document.createElement('div');
        preview.className = 'sessionflow-widget-clock__library-preview';
        const miniClock = this.#buildMiniPreview(entry, 36);
        preview.appendChild(miniClock);
        item.appendChild(preview);

        // Info
        const info = document.createElement('div');
        info.className = 'sessionflow-widget-clock__library-info';

        const name = document.createElement('span');
        name.className = 'sessionflow-widget-clock__library-name';
        name.textContent = entry.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle');
        info.appendChild(name);

        const meta = document.createElement('span');
        meta.className = 'sessionflow-widget-clock__library-meta';
        const modeLabel = (entry.mode || 'progress') === 'countdown' ? '⏳' : '';
        const labelTag = entry.label ? ` · ${entry.label}` : '';
        meta.textContent = `${entry.filled}/${entry.segments} ${modeLabel}${labelTag}`;
        info.appendChild(meta);

        item.appendChild(info);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'sessionflow-widget-clock__library-actions';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'sessionflow-widget-clock__library-load';
        loadBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLibraryLoad');
        loadBtn.innerHTML = '<i class="fas fa-download"></i>';
        loadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#loadClockFromLibrary(entry.id);
        });
        actions.appendChild(loadBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'sessionflow-widget-clock__library-delete';
        delBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockLibraryDelete');
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#deleteClockFromLibrary(entry.id);
        });
        actions.appendChild(delBtn);

        item.appendChild(actions);
        list.appendChild(item);
      }

      panel.appendChild(list);
    }

    return panel;
  }

  /**
   * Build a tiny preview clock for the library panel.
   * @param {object} data - Clock data
   * @param {number} size
   * @returns {HTMLElement|SVGElement}
   */
  #buildMiniPreview(data, size = 36) {
    const filledColor = data.filledColor || ProgressClockWidget.DEFAULT_FILLED;
    const emptyColor = data.emptyColor || ProgressClockWidget.DEFAULT_EMPTY;
    const style = data.style || 'pie';

    if (style === 'bar') {
      const bar = document.createElement('div');
      bar.className = 'sessionflow-widget-clock__bar sessionflow-widget-clock__bar--mini';
      bar.style.width = `${size}px`;
      bar.style.height = '8px';
      for (let i = 0; i < data.segments; i++) {
        const seg = document.createElement('div');
        seg.className = 'sessionflow-widget-clock__bar-segment';
        if (i < data.filled) {
          seg.classList.add('is-filled');
          seg.style.background = filledColor;
        } else {
          seg.style.background = emptyColor;
        }
        bar.appendChild(seg);
      }
      return bar;
    }

    if (style === 'dots') {
      const container = document.createElement('div');
      container.style.width = `${size}px`;
      container.style.height = `${size}px`;
      container.style.position = 'relative';
      const cx = size / 2;
      const cy = size / 2;
      const ringR = (size / 2) - 5;
      const dotSize = Math.max(3, Math.min(6, size / data.segments));
      for (let i = 0; i < data.segments; i++) {
        const angle = ((2 * Math.PI) / data.segments) * i - (Math.PI / 2);
        const x = cx + ringR * Math.cos(angle);
        const y = cy + ringR * Math.sin(angle);
        const dot = document.createElement('div');
        dot.style.cssText = `position:absolute;width:${dotSize}px;height:${dotSize}px;left:${x - dotSize / 2}px;top:${y - dotSize / 2}px;border-radius:50%;border:1px solid ${i < data.filled ? filledColor : emptyColor};background:${i < data.filled ? filledColor : 'transparent'};`;
        container.appendChild(dot);
      }
      return container;
    }

    // Pie (default)
    const NS = ProgressClockWidget.SVG_NS;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    const cxS = size / 2;
    const cyS = size / 2;
    const r = (size / 2) - 2;
    for (let i = 0; i < data.segments; i++) {
      const anglePerSeg = (2 * Math.PI) / data.segments;
      const startAngle = (i * anglePerSeg) - (Math.PI / 2);
      const endAngle = ((i + 1) * anglePerSeg) - (Math.PI / 2);
      const x1 = cxS + r * Math.cos(startAngle);
      const y1 = cyS + r * Math.sin(startAngle);
      const x2 = cxS + r * Math.cos(endAngle);
      const y2 = cyS + r * Math.sin(endAngle);
      const largeArc = anglePerSeg > Math.PI ? 1 : 0;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M ${cxS} ${cyS} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`);
      path.setAttribute('fill', i < data.filled ? filledColor : emptyColor);
      path.setAttribute('stroke', 'rgba(255,255,255,0.15)');
      path.setAttribute('stroke-width', '0.5');
      svg.appendChild(path);
    }
    return svg;
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    // Persist which clocks are currently broadcasting
    this.updateConfig({
      broadcastingClockIds: [...this.#broadcastingClocks]
    });
  }

  /** @override */
  destroy() {
    // Clean up dock update hook
    if (this.#dockUpdateHookId !== null) {
      Hooks.off('sessionflow:dockClockUpdate', this.#dockUpdateHookId);
      this.#dockUpdateHookId = null;
    }
    // Don't emit hideClock — broadcast state is persisted and will auto-restore
    // when the panel reopens. Only clear the local set.
    this.#broadcastingClocks.clear();
    super.destroy();
  }
}

// Auto-register
registerWidgetType(ProgressClockWidget.TYPE, ProgressClockWidget);
