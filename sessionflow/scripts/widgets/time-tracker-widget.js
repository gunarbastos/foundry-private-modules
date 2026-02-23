/**
 * SessionFlow - Time Tracker Widget ("The Sundial")
 * Tracks in-game time units (turns, hours, watches, days, etc.)
 * with SVG progress ring, optional secondary counter with conversion,
 * gear settings popover, and history log with relative timestamps.
 * NOT real time — for abstract game-time tracking.
 * @module widgets/time-tracker-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

const MAX_HISTORY = 50;

/** SVG ring constants */
const RING_RADIUS = 48;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export class TimeTrackerWidget extends Widget {

  static TYPE = 'time-tracker';
  static LABEL = 'SESSIONFLOW.Canvas.TimeTracker';
  static ICON = 'fas fa-clock-rotate-left';
  static MIN_WIDTH = 240;
  static MIN_HEIGHT = 180;
  static DEFAULT_WIDTH = 320;
  static DEFAULT_HEIGHT = 240;

  /** @type {boolean} */
  #showHistory = false;

  /** @type {boolean} */
  #isAddingNote = false;

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

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.TimeTracker');
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-timetracker';

    // Secondary counter display (ABOVE ring, if configured)
    if (this.#getSecondaryLabel()) {
      this.#buildSecondaryDisplay(container);
    }

    // SVG Progress Ring with counter overlay
    this.#buildRingArea(container);

    // Controls row (GM only)
    if (game.user.isGM) {
      this.#buildControls(container);
    }

    // History toggle + list
    this.#buildHistorySection(container);

    bodyEl.appendChild(container);

    // Inject gear button into widget header (GM only)
    if (game.user.isGM) {
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
    if (this.#isEditingSecondaryLabel && game.user.isGM) {
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
      if (game.user.isGM) {
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

    // SVG ring
    ringArea.appendChild(this.#buildRingSVG());

    // Overlay (number + label on top of ring)
    const overlay = document.createElement('div');
    overlay.className = 'sessionflow-widget-timetracker__ring-overlay';

    // Primary count
    if (this.#isEditingLabel && game.user.isGM) {
      // When editing label, show count as plain text + label input
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
      const countEl = document.createElement('span');
      countEl.className = 'sessionflow-widget-timetracker__count';
      countEl.textContent = String(this.#getCount());
      overlay.appendChild(countEl);

      const label = document.createElement('span');
      label.className = 'sessionflow-widget-timetracker__label';
      label.textContent = this.#getLabel();
      if (game.user.isGM) {
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

  /** Build the SVG progress ring */
  #buildRingSVG() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'sessionflow-widget-timetracker__ring-svg');

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
    arc.setAttribute('stroke', 'var(--sf-beat-color, var(--sf-color-primary))');
    arc.setAttribute('stroke-width', '5');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
    arc.setAttribute('stroke-dashoffset', String(offset));
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    arc.setAttribute('class', 'sessionflow-widget-timetracker__ring-progress');

    // Apply glow only when there's progress
    if (progress > 0) {
      arc.setAttribute('filter', `url(#${filterId})`);
    }

    // Tick animation class
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

    // Increment
    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'sessionflow-widget-timetracker__btn sessionflow-widget-timetracker__btn--inc';
    incBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerIncrement');
    incBtn.innerHTML = '<i class="fas fa-plus"></i>';
    incBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openNotePrompt();
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

    container.appendChild(controls);

    // Note input area (visible when adding note on increment)
    if (this.#isAddingNote) {
      this.#buildNoteRow(container);
    }
  }

  #buildNoteRow(container) {
    const noteRow = document.createElement('div');
    noteRow.className = 'sessionflow-widget-timetracker__note-row';

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'sessionflow-widget-timetracker__note-input';
    noteInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerNotePlaceholder');

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'sessionflow-widget-timetracker__note-confirm';
    confirmBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerConfirmNote');
    confirmBtn.innerHTML = '<i class="fas fa-check"></i>';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'sessionflow-widget-timetracker__note-skip';
    skipBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.TimeTrackerSkipNote');
    skipBtn.innerHTML = '<i class="fas fa-forward"></i>';

    const doIncrement = (note) => {
      this.#isAddingNote = false;
      this.#increment(this.#getStep(), note);
    };

    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doIncrement(noteInput.value.trim()); }
      if (e.key === 'Escape') { e.preventDefault(); doIncrement(''); }
    });

    confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); doIncrement(noteInput.value.trim()); });
    skipBtn.addEventListener('click', (e) => { e.stopPropagation(); doIncrement(''); });

    noteRow.appendChild(noteInput);
    noteRow.appendChild(confirmBtn);
    noteRow.appendChild(skipBtn);
    container.appendChild(noteRow);

    requestAnimationFrame(() => noteInput.focus());
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

      // Show most recent first
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        const item = document.createElement('div');
        item.className = 'sessionflow-widget-timetracker__history-item';

        const delta = document.createElement('span');
        delta.className = 'sessionflow-widget-timetracker__history-delta';
        delta.textContent = entry.delta > 0 ? `+${entry.delta}` : String(entry.delta);
        delta.style.color = entry.delta > 0 ? '#22c55e' : '#ef4444';
        item.appendChild(delta);

        if (entry.note) {
          const note = document.createElement('span');
          note.className = 'sessionflow-widget-timetracker__history-note';
          note.textContent = entry.note;
          item.appendChild(note);
        }

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

    // Don't duplicate
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

    // Insert before the collapse button
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

    // Step size row
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

    // Separator
    const sep = document.createElement('div');
    sep.className = 'sessionflow-widget-timetracker__settings-separator';
    body.appendChild(sep);

    if (!this.#getSecondaryLabel()) {
      // Add secondary button
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

    popover.appendChild(body);
    this.element?.appendChild(popover);

    // Close on click outside (delay to avoid immediate close)
    requestAnimationFrame(() => {
      this.#settingsCloseHandler = (e) => {
        if (!popover.contains(e.target) && !e.target.closest('.sessionflow-widget-timetracker__gear-btn')) {
          this.#closeSettings();
        }
      };
      document.addEventListener('pointerdown', this.#settingsCloseHandler, true);
    });
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

  #openNotePrompt() {
    this.#isAddingNote = true;
    this.#rerender();
  }

  /**
   * @param {number} delta
   * @param {string} [note]
   */
  #increment(delta, note = '') {
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

    // Add to history
    const history = [...this.#getHistory()];
    history.push({
      id: foundry.utils.randomID(),
      delta,
      note: note || '',
      timestamp: new Date().toISOString()
    });

    // Trim history to max
    while (history.length > MAX_HISTORY) history.shift();

    // If conversion happened, play tick animation
    if (didConvert) {
      this.#playTickAnimation(count, secondaryCount, history);
    } else {
      this.updateConfig({ count, secondaryCount, history });
      this.engine.scheduleSave();
      this.#rerender();
      this.#playBumpAnimation();
    }
  }

  /** Play tick animation: ring fills to 100%, then resets */
  #playTickAnimation(finalCount, finalSecondary, history) {
    // First, set ring to 100% visually
    this.#isTicking = true;
    const progressEl = this.element?.querySelector('.sessionflow-widget-timetracker__ring-progress');
    if (progressEl) {
      progressEl.setAttribute('stroke-dashoffset', '0');
      progressEl.classList.add('is-ticking');
    }

    // After animation delay, update actual values and rerender
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
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  destroy() {
    this.#closeSettingsQuiet();
    super.destroy();
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
