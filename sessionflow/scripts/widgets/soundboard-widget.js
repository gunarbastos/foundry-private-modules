/**
 * SessionFlow - Soundboard Widget
 * Minimalist circular fire-and-forget sound effect button on canvas.
 * Two states: selector (pick a sound) → player (circle, click to fire).
 * Each widget represents ONE sound effect. No sustained playback state.
 * @module widgets/soundboard-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

export class SoundboardWidget extends Widget {

  static TYPE = 'soundboard';
  static LABEL = 'SESSIONFLOW.Canvas.Soundboard';
  static ICON = 'fas fa-bullhorn';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 240;
  static DEFAULT_HEIGHT = 260;

  /** @type {string} Current search filter text */
  #searchFilter = '';

  /** @type {number|null} Timeout ID for visual feedback pulse */
  #pulseTimeout = null;

  /* ---------------------------------------- */
  /*  API Helpers                              */
  /* ---------------------------------------- */

  /** @returns {object|null} Narrator Jukebox API or null */
  #getApi() {
    const mod = game.modules.get('narrator-jukebox');
    if (!mod?.active) return null;
    const api = mod.api;
    if (!api || typeof api.isReady !== 'function') return null;
    return api.isReady() ? api : null;
  }

  /** @returns {boolean} */
  #isNJAvailable() {
    return this.#getApi() !== null;
  }

  /** @returns {boolean} Whether a sound has been selected */
  #isConfigured() {
    return !!this.config.soundId;
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Soundboard');
  }

  /** @override */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-soundboard';

    if (!this.#isNJAvailable()) {
      this.#buildUnavailable(container);
    } else if (!this.#isConfigured()) {
      container.classList.add('sessionflow-widget-soundboard--selector');
      this.#buildSelector(container);
    } else {
      container.classList.add('sessionflow-widget-soundboard--player');
      this.#buildPlayer(container);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Unavailable State                       */
  /* ---------------------------------------- */

  #buildUnavailable(container) {
    const msg = document.createElement('div');
    msg.className = 'sessionflow-widget-soundboard__unavailable';

    const icon = document.createElement('i');
    icon.className = 'fas fa-puzzle-piece';
    msg.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = game.i18n.localize('SESSIONFLOW.Canvas.SoundboardUnavailable');
    msg.appendChild(text);

    container.appendChild(msg);
  }

  /* ---------------------------------------- */
  /*  Selector State (pick a sound effect)    */
  /* ---------------------------------------- */

  #buildSelector(container) {
    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'sessionflow-widget-soundboard__selector-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.SoundboardSearchPlaceholder');
    searchInput.value = this.#searchFilter;
    searchInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#searchFilter = e.target.value;
      this.#rebuildList();
    });
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    // List
    this.#buildList(container);
  }

  #buildList(container) {
    const api = this.#getApi();

    // Remove existing list if present
    const oldList = container.querySelector('.sessionflow-widget-soundboard__selector-list');
    if (oldList) oldList.remove();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-soundboard__selector-list';

    const sounds = api?.getAllSoundboardSounds?.() ?? [];
    const filtered = this.#filterItems(sounds);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-soundboard__selector-empty';
      empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.SoundboardNoSounds');
      list.appendChild(empty);
    } else {
      for (const sound of filtered) {
        list.appendChild(this.#buildSelectorItem(sound));
      }
    }

    container.appendChild(list);
  }

  /**
   * @param {{ id: string, name: string }} item
   * @returns {HTMLElement}
   */
  #buildSelectorItem(item) {
    const el = document.createElement('div');
    el.className = 'sessionflow-widget-soundboard__selector-item';

    const iconEl = document.createElement('i');
    iconEl.className = 'fas fa-bullhorn';
    el.appendChild(iconEl);

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-soundboard__selector-item-name';
    name.textContent = item.name;
    el.appendChild(name);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#selectSound(item.id, item.name);
    });

    return el;
  }

  /**
   * @param {{ name: string }[]} items
   * @returns {{ name: string }[]}
   */
  #filterItems(items) {
    if (!this.#searchFilter) return items;
    const q = this.#searchFilter.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(q));
  }

  #rebuildList() {
    const container = this.element?.querySelector('.sessionflow-widget-soundboard');
    if (!container) return;
    this.#buildList(container);

    // Restore focus to search input
    const input = container.querySelector('.sessionflow-widget-soundboard__selector-search input');
    if (input && this.#searchFilter) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  #selectSound(id, name) {
    this.updateConfig({ soundId: id, soundName: name });
    this.#searchFilter = '';
    this.engine.scheduleSave();
    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  Player State (circle + name)            */
  /* ---------------------------------------- */

  #buildPlayer(container) {
    // Circle button (fire-and-forget, no sustained state)
    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'sessionflow-widget-soundboard__circle';
    circle.title = game.i18n.localize('SESSIONFLOW.Canvas.SoundboardFire');

    const icon = document.createElement('i');
    icon.className = 'fas fa-bullhorn';
    circle.appendChild(icon);

    circle.addEventListener('click', (e) => { e.stopPropagation(); this.#onFire(); });
    container.appendChild(circle);

    // Sound name
    const soundName = document.createElement('div');
    soundName.className = 'sessionflow-widget-soundboard__sound-name';
    soundName.textContent = this.config.soundName || game.i18n.localize('SESSIONFLOW.Canvas.SoundboardNoSound');
    container.appendChild(soundName);

    // Volume slider
    const volumeWrap = document.createElement('div');
    volumeWrap.className = 'sessionflow-widget-soundboard__volume';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-soundboard__volume-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(this.config.volume ?? 0.8);
    slider.title = game.i18n.localize('SESSIONFLOW.Canvas.SoundboardVolume');
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
    });
    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      this.updateConfig({ volume: parseFloat(e.target.value) });
      this.engine.scheduleSave();
    });
    volumeWrap.appendChild(slider);

    container.appendChild(volumeWrap);
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #onFire() {
    const api = this.#getApi();
    if (!api || !this.config.soundId) return;

    // Fire the sound effect
    const volume = this.config.volume ?? 0.8;
    api.playSoundboardSound(this.config.soundId, { volume });

    // Visual pulse feedback on the circle
    this.#pulseCircle();
  }

  /**
   * Briefly adds a "is-firing" class for visual feedback,
   * since soundboard has no sustained play state.
   */
  #pulseCircle() {
    const circle = this.element?.querySelector('.sessionflow-widget-soundboard__circle');
    if (!circle) return;

    // Clear any existing pulse
    if (this.#pulseTimeout != null) {
      clearTimeout(this.#pulseTimeout);
      circle.classList.remove('is-firing');
    }

    circle.classList.add('is-firing');
    this.#pulseTimeout = setTimeout(() => {
      circle.classList.remove('is-firing');
      this.#pulseTimeout = null;
    }, 400);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  destroy() {
    if (this.#pulseTimeout != null) {
      clearTimeout(this.#pulseTimeout);
      this.#pulseTimeout = null;
    }
    super.destroy();
  }
}

// Self-register
registerWidgetType('soundboard', SoundboardWidget);
