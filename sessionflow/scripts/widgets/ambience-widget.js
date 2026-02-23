/**
 * SessionFlow - Ambience Widget
 * Minimalist circular ambience layer button on canvas with Narrator Jukebox integration.
 * Two states: selector (pick a track) → player (circle with play/pause).
 * Each widget represents ONE ambience layer. Multiple widgets = multiple simultaneous layers.
 * @module widgets/ambience-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

export class AmbienceWidget extends Widget {

  static TYPE = 'ambience';
  static LABEL = 'SESSIONFLOW.Canvas.Ambience';
  static ICON = 'fas fa-wind';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 240;
  static DEFAULT_HEIGHT = 260;

  /** @type {Record<string, number>} Hook IDs for Hooks.off cleanup */
  #hookIds = {};

  /** @type {string} Current search filter text */
  #searchFilter = '';

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

  /** @returns {boolean} Whether a track has been selected */
  #isConfigured() {
    return !!this.config.trackId;
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Ambience');
  }

  /** @override */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-ambience';

    if (!this.#isNJAvailable()) {
      this.#buildUnavailable(container);
    } else if (!this.#isConfigured()) {
      container.classList.add('sessionflow-widget-ambience--selector');
      this.#buildSelector(container);
    } else {
      container.classList.add('sessionflow-widget-ambience--player');
      this.#buildPlayer(container);
    }

    bodyEl.appendChild(container);
  }

  /** @override */
  render() {
    const el = super.render();
    if (this.#isNJAvailable() && this.#isConfigured()) {
      this.#registerHooks();
    }
    return el;
  }

  /* ---------------------------------------- */
  /*  Unavailable State                       */
  /* ---------------------------------------- */

  #buildUnavailable(container) {
    const msg = document.createElement('div');
    msg.className = 'sessionflow-widget-ambience__unavailable';

    const icon = document.createElement('i');
    icon.className = 'fas fa-puzzle-piece';
    msg.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceUnavailable');
    msg.appendChild(text);

    container.appendChild(msg);
  }

  /* ---------------------------------------- */
  /*  Selector State (pick an ambience track) */
  /* ---------------------------------------- */

  #buildSelector(container) {
    const api = this.#getApi();

    // Max layers warning
    if (api?.canAddAmbienceLayer && !api.canAddAmbienceLayer()) {
      const warning = document.createElement('div');
      warning.className = 'sessionflow-widget-ambience__max-layers';

      const warnIcon = document.createElement('i');
      warnIcon.className = 'fas fa-exclamation-triangle';
      warning.appendChild(warnIcon);

      const warnText = document.createElement('span');
      warnText.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMaxLayers');
      warning.appendChild(warnText);

      container.appendChild(warning);
    }

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'sessionflow-widget-ambience__selector-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceSearchPlaceholder');
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
    const oldList = container.querySelector('.sessionflow-widget-ambience__selector-list');
    if (oldList) oldList.remove();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-ambience__selector-list';

    const tracks = api?.getAllAmbience?.() ?? [];
    const filtered = this.#filterItems(tracks);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-ambience__selector-empty';
      empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceNoTracks');
      list.appendChild(empty);
    } else {
      for (const track of filtered) {
        list.appendChild(this.#buildSelectorItem(track));
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
    el.className = 'sessionflow-widget-ambience__selector-item';

    const iconEl = document.createElement('i');
    iconEl.className = 'fas fa-wind';
    el.appendChild(iconEl);

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-ambience__selector-item-name';
    name.textContent = item.name;
    el.appendChild(name);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#selectTrack(item.id, item.name);
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
    const container = this.element?.querySelector('.sessionflow-widget-ambience');
    if (!container) return;
    this.#buildList(container);

    // Restore focus to search input
    const input = container.querySelector('.sessionflow-widget-ambience__selector-search input');
    if (input && this.#searchFilter) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  #selectTrack(id, name) {
    this.updateConfig({ trackId: id, trackName: name });
    this.#searchFilter = '';
    this.#registerHooks();
    this.engine.scheduleSave();
    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  Player State (circle + name + volume)   */
  /* ---------------------------------------- */

  #buildPlayer(container) {
    const api = this.#getApi();
    const isPlaying = this.#isThisLayerActive();
    const volume = api?.getAmbienceLayerVolume?.(this.config.trackId) ?? this.config.volume ?? 0.5;

    // Circle button
    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'sessionflow-widget-ambience__circle';
    if (isPlaying) circle.classList.add('is-playing');
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.AmbiencePause' : 'SESSIONFLOW.Canvas.AmbiencePlay');

    const icon = document.createElement('i');
    icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    circle.appendChild(icon);

    circle.addEventListener('click', (e) => { e.stopPropagation(); this.#onToggle(); });
    container.appendChild(circle);

    // Track name
    const trackName = document.createElement('div');
    trackName.className = 'sessionflow-widget-ambience__track-name';
    trackName.textContent = this.config.trackName || game.i18n.localize('SESSIONFLOW.Canvas.AmbienceNothingPlaying');
    container.appendChild(trackName);

    // Volume slider (per-layer)
    const volumeWrap = document.createElement('div');
    volumeWrap.className = 'sessionflow-widget-ambience__volume';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-ambience__volume-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(volume);
    slider.title = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceVolume');
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#onVolumeInput(parseFloat(e.target.value));
    });
    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      this.#onVolumeChange(parseFloat(e.target.value));
    });
    volumeWrap.appendChild(slider);

    container.appendChild(volumeWrap);
  }

  /**
   * Check if THIS widget's track is currently an active ambience layer.
   * @returns {boolean}
   */
  #isThisLayerActive() {
    const api = this.#getApi();
    if (!api) return false;
    const activeLayers = api.getActiveAmbienceLayers?.() ?? [];
    return activeLayers.some(layer =>
      layer.id === this.config.trackId || layer.trackId === this.config.trackId
    );
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #onToggle() {
    const api = this.#getApi();
    if (!api) return;

    if (this.#isThisLayerActive()) {
      api.stopAmbienceLayer(this.config.trackId);
    } else {
      api.playAmbienceLayer(this.config.trackId);
    }
  }

  #onVolumeInput(value) {
    const api = this.#getApi();
    api?.setAmbienceLayerVolume?.(this.config.trackId, value);
  }

  #onVolumeChange(value) {
    this.updateConfig({ volume: value });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Targeted DOM Updates                    */
  /* ---------------------------------------- */

  #updatePlayIcon() {
    const circle = this.element?.querySelector('.sessionflow-widget-ambience__circle');
    if (!circle) return;
    const isPlaying = this.#isThisLayerActive();
    const icon = circle.querySelector('i');
    if (icon) {
      icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    }
    circle.classList.toggle('is-playing', isPlaying);
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.AmbiencePause' : 'SESSIONFLOW.Canvas.AmbiencePlay');
  }

  #updateVolumeSlider(volume) {
    const slider = this.element?.querySelector('.sessionflow-widget-ambience__volume-slider');
    if (slider) slider.value = String(volume);
  }

  /* ---------------------------------------- */
  /*  Hooks (Narrator Jukebox Reactivity)     */
  /* ---------------------------------------- */

  #registerHooks() {
    // Avoid double-registration
    if (Object.keys(this.#hookIds).length > 0) return;

    this.#hookIds.layerPlay = Hooks.on('narratorJukebox.ambienceLayer.play', (data) => {
      if (data.trackId === this.config.trackId) {
        this.#updatePlayIcon();
      }
    });

    this.#hookIds.layerStop = Hooks.on('narratorJukebox.ambienceLayer.stop', (data) => {
      if (data.trackId === this.config.trackId) {
        this.#updatePlayIcon();
      }
    });

    this.#hookIds.volumeChanged = Hooks.on('narratorJukebox.ambienceLayer.volumeChanged', (data) => {
      if (data.trackId === this.config.trackId) {
        this.#updateVolumeSlider(data.volume);
      }
    });

    this.#hookIds.stopAll = Hooks.on('narratorJukebox.ambienceLayer.stopAll', () => {
      this.#updatePlayIcon();
    });
  }

  #unregisterHooks() {
    if (this.#hookIds.layerPlay != null) Hooks.off('narratorJukebox.ambienceLayer.play', this.#hookIds.layerPlay);
    if (this.#hookIds.layerStop != null) Hooks.off('narratorJukebox.ambienceLayer.stop', this.#hookIds.layerStop);
    if (this.#hookIds.volumeChanged != null) Hooks.off('narratorJukebox.ambienceLayer.volumeChanged', this.#hookIds.volumeChanged);
    if (this.#hookIds.stopAll != null) Hooks.off('narratorJukebox.ambienceLayer.stopAll', this.#hookIds.stopAll);
    this.#hookIds = {};
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    const api = this.#getApi();
    if (!api || !this.config.trackId) return;
    const vol = api.getAmbienceLayerVolume?.(this.config.trackId);
    if (vol != null) this.updateConfig({ volume: vol });
  }

  /** @override */
  destroy() {
    this.#unregisterHooks();
    super.destroy();
  }
}

// Self-register
registerWidgetType('ambience', AmbienceWidget);
