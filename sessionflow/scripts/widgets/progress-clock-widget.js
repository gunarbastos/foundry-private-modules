/**
 * SessionFlow - Progress Clock Widget
 * Blades-in-the-Dark-style clocks with configurable segments, colors, and broadcast.
 * Supports multiple clocks per widget instance.
 * @module widgets/progress-clock-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

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

export class ProgressClockWidget extends Widget {

  static TYPE = 'progress-clock';
  static LABEL = 'SESSIONFLOW.Canvas.ProgressClock';
  static ICON = 'fas fa-circle-notch';
  static MIN_WIDTH = 160;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 280;
  static DEFAULT_HEIGHT = 240;

  /** SVG namespace */
  static SVG_NS = 'http://www.w3.org/2000/svg';

  /** Available segment presets */
  static SEGMENT_OPTIONS = [2, 3, 4, 6, 8, 10, 12];

  /** Default colors */
  static DEFAULT_FILLED = '#7c5cbf';
  static DEFAULT_EMPTY = '#2a2a3a';

  /** @type {Set<string>} Clock IDs currently broadcasting */
  #broadcastingClocks = new Set();

  /** @type {boolean} Whether initial state restoration has been done */
  #restored = false;

  /** @type {number|null} Hook ID for dock clock update listener */
  #dockUpdateHookId = null;

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

    if (clocks.length === 0) {
      // Empty state — prompt to add first clock
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-clock__empty';
      empty.innerHTML = `
        <i class="fas fa-circle-notch"></i>
        <p>${game.i18n.localize('SESSIONFLOW.Canvas.ClockEmpty')}</p>
      `;
      container.appendChild(empty);
    } else {
      // Clock grid
      const grid = document.createElement('div');
      grid.className = 'sessionflow-widget-clock__grid';

      for (const clock of clocks) {
        grid.appendChild(this.#buildClock(clock));
      }

      container.appendChild(grid);
    }

    // Add clock button (GM only)
    if (game.user.isGM) {
      const addBtn = document.createElement('button');
      addBtn.className = 'sessionflow-widget-clock__add-btn';
      addBtn.type = 'button';
      addBtn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.ClockAdd')}`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#addClock();
      });
      container.appendChild(addBtn);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Clock Builder                           */
  /* ---------------------------------------- */

  /**
   * Build a single clock element with visual, title, and controls.
   * @param {object} clock - { id, title, segments, filled, filledColor, emptyColor, style }
   * @returns {HTMLElement}
   */
  #buildClock(clock) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-clock__item';
    wrapper.dataset.clockId = clock.id;

    // Visual: pie or dots
    const style = clock.style || 'pie';
    const visual = style === 'dots' ? this.#buildDotsVisual(clock) : this.#buildPieVisual(clock);
    wrapper.appendChild(visual);

    // Color preset dots (GM only, between visual and title)
    if (game.user.isGM) {
      wrapper.appendChild(this.#buildColorDots(clock));
    }

    // Title (editable)
    const title = document.createElement('span');
    title.className = 'sessionflow-widget-clock__title';
    title.textContent = clock.title || game.i18n.localize('SESSIONFLOW.Canvas.ClockDefaultTitle');
    title.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockEditTitle');

    if (game.user.isGM) {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#editTitle(clock.id, title);
      });
    }

    wrapper.appendChild(title);

    // Progress label (e.g., "2/4")
    const progress = document.createElement('span');
    progress.className = 'sessionflow-widget-clock__progress';
    progress.textContent = `${clock.filled}/${clock.segments}`;
    wrapper.appendChild(progress);

    // Controls row (GM only) — compact: segments + style + action buttons
    if (game.user.isGM) {
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

      // Style selector (Pie / Dots)
      const styleSelect = document.createElement('select');
      styleSelect.className = 'sessionflow-widget-clock__style-select';
      styleSelect.title = game.i18n.localize('SESSIONFLOW.Canvas.ClockStyle');
      for (const [val, labelKey] of [['pie', 'SESSIONFLOW.Canvas.ClockStylePie'], ['dots', 'SESSIONFLOW.Canvas.ClockStyleDots']]) {
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

      if (game.user.isGM) {
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

      if (game.user.isGM) {
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
      style: 'pie'
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
    const clocks = (this.config.clocks ?? []).filter(c => c.id !== clockId);
    this.updateConfig({ clocks });
    this.engine.scheduleSave();
    this.refreshBody();
  }

  #toggleSegment(clockId, segmentIndex) {
    const clocks = this.config.clocks ?? [];
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return;

    if (segmentIndex < clock.filled) {
      clock.filled = segmentIndex;
    } else {
      clock.filled = segmentIndex + 1;
    }

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

    clock.segments = newSegments;
    if (clock.filled > newSegments) clock.filled = newSegments;

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

  /* ---------------------------------------- */
  /*  Broadcast                               */
  /* ---------------------------------------- */

  /**
   * Toggle broadcasting a clock to all players.
   * @param {string} clockId
   */
  /**
   * Flash a clock as a dramatic one-shot popup.
   * @param {string} clockId
   */
  #flashClock(clockId) {
    this.#emitClockAction('flashClock', clockId);
  }

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
      senderId: game.user.id
    };
  }

  /**
   * Emit a clock broadcast action via socket + local hook.
   * @param {string} action - 'showClock' | 'updateClock' | 'hideClock'
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
