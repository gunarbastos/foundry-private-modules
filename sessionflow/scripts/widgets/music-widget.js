/**
 * SessionFlow - Music Widget
 * Minimalist circular music button on canvas with Narrator Jukebox integration.
 * Two states: selector (pick a track/playlist) → player (circle with play/pause).
 * Each widget represents ONE music source. Delete and create new to change.
 * @module widgets/music-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

export class MusicWidget extends Widget {

  static TYPE = 'music';
  static LABEL = 'SESSIONFLOW.Canvas.Music';
  static ICON = 'fas fa-music';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 240;
  static DEFAULT_HEIGHT = 260;

  /** @type {Record<string, number>} Hook IDs for Hooks.off cleanup */
  #hookIds = {};

  /** @type {'tracks'|'playlists'} Active tab in source selector */
  #activeTab = 'tracks';

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

  /** @returns {boolean} Whether a source has been selected */
  #isConfigured() {
    return !!(this.config.sourceType && this.config.sourceId);
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Music');
  }

  /** @override */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-music';

    if (!this.#isNJAvailable()) {
      this.#buildUnavailable(container);
    } else if (!this.#isConfigured()) {
      container.classList.add('sessionflow-widget-music--selector');
      this.#buildSelector(container);
    } else {
      container.classList.add('sessionflow-widget-music--player');
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
    msg.className = 'sessionflow-widget-music__unavailable';

    const icon = document.createElement('i');
    icon.className = 'fas fa-puzzle-piece';
    msg.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = game.i18n.localize('SESSIONFLOW.Canvas.MusicUnavailable');
    msg.appendChild(text);

    container.appendChild(msg);
  }

  /* ---------------------------------------- */
  /*  Selector State (pick a track/playlist)  */
  /* ---------------------------------------- */

  #buildSelector(container) {
    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'sessionflow-widget-music__selector-tabs';

    const tracksTab = document.createElement('button');
    tracksTab.type = 'button';
    tracksTab.textContent = game.i18n.localize('SESSIONFLOW.Canvas.MusicTabTracks');
    if (this.#activeTab === 'tracks') tracksTab.classList.add('is-active');
    tracksTab.addEventListener('click', (e) => { e.stopPropagation(); this.#switchTab('tracks'); });
    tabs.appendChild(tracksTab);

    const playlistsTab = document.createElement('button');
    playlistsTab.type = 'button';
    playlistsTab.textContent = game.i18n.localize('SESSIONFLOW.Canvas.MusicTabPlaylists');
    if (this.#activeTab === 'playlists') playlistsTab.classList.add('is-active');
    playlistsTab.addEventListener('click', (e) => { e.stopPropagation(); this.#switchTab('playlists'); });
    tabs.appendChild(playlistsTab);

    container.appendChild(tabs);

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'sessionflow-widget-music__selector-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.MusicSearchPlaceholder');
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
    const oldList = container.querySelector('.sessionflow-widget-music__selector-list');
    if (oldList) oldList.remove();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-music__selector-list';

    if (this.#activeTab === 'tracks') {
      const tracks = api?.getAllMusic?.() ?? [];
      const filtered = this.#filterItems(tracks);
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sessionflow-widget-music__selector-empty';
        empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.MusicNoTracks');
        list.appendChild(empty);
      } else {
        for (const track of filtered) {
          list.appendChild(this.#buildSelectorItem(track, 'track'));
        }
      }
    } else {
      const playlists = api?.getAllPlaylists?.() ?? [];
      const filtered = this.#filterItems(playlists);
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sessionflow-widget-music__selector-empty';
        empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.MusicNoPlaylists');
        list.appendChild(empty);
      } else {
        for (const pl of filtered) {
          list.appendChild(this.#buildSelectorItem(pl, 'playlist'));
        }
      }
    }

    container.appendChild(list);
  }

  /**
   * @param {{ id: string, name: string, thumbnail?: string }} item
   * @param {'track'|'playlist'} type
   * @returns {HTMLElement}
   */
  #buildSelectorItem(item, type) {
    const el = document.createElement('div');
    el.className = 'sessionflow-widget-music__selector-item';

    // Icon
    const iconEl = document.createElement('i');
    iconEl.className = type === 'track' ? 'fas fa-music' : 'fas fa-list';
    el.appendChild(iconEl);

    // Name
    const name = document.createElement('span');
    name.className = 'sessionflow-widget-music__selector-item-name';
    name.textContent = item.name;
    el.appendChild(name);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#selectSource(type, item.id, item.name);
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

  #switchTab(tab) {
    this.#activeTab = tab;
    this.#searchFilter = '';
    const container = this.element?.querySelector('.sessionflow-widget-music');
    if (container) {
      // Update tab active state
      const tabs = container.querySelectorAll('.sessionflow-widget-music__selector-tabs button');
      tabs.forEach((btn, i) => btn.classList.toggle('is-active', (i === 0 && tab === 'tracks') || (i === 1 && tab === 'playlists')));
      // Clear search input
      const input = container.querySelector('.sessionflow-widget-music__selector-search input');
      if (input) input.value = '';
      // Rebuild list
      this.#buildList(container);
    }
  }

  #rebuildList() {
    const container = this.element?.querySelector('.sessionflow-widget-music');
    if (!container) return;
    this.#buildList(container);

    // Restore focus to search input
    const input = container.querySelector('.sessionflow-widget-music__selector-search input');
    if (input && this.#searchFilter) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  #selectSource(type, id, name) {
    this.updateConfig({ sourceType: type, sourceId: id, sourceName: name });
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
    const isPlaying = this.#isThisSourcePlaying();
    const volume = api?.getVolume?.('music') ?? this.config.volume ?? 0.5;

    // Circle button
    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'sessionflow-widget-music__circle';
    if (isPlaying) circle.classList.add('is-playing');
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.MusicPause' : 'SESSIONFLOW.Canvas.MusicPlay');

    const icon = document.createElement('i');
    icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    circle.appendChild(icon);

    circle.addEventListener('click', (e) => { e.stopPropagation(); this.#onPlayPause(); });
    container.appendChild(circle);

    // Track name
    const trackName = document.createElement('div');
    trackName.className = 'sessionflow-widget-music__track-name';
    trackName.textContent = this.#getDisplayName();
    container.appendChild(trackName);

    // Volume slider
    const volumeWrap = document.createElement('div');
    volumeWrap.className = 'sessionflow-widget-music__volume';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-music__volume-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(volume);
    slider.title = game.i18n.localize('SESSIONFLOW.Canvas.MusicVolume');
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
   * Check if THIS widget's source is the one currently playing.
   * @returns {boolean}
   */
  #isThisSourcePlaying() {
    const api = this.#getApi();
    if (!api || !api.isPlaying()) return false;

    if (this.config.sourceType === 'track') {
      const current = api.getCurrentMusicTrack?.();
      return current?.id === this.config.sourceId;
    }
    if (this.config.sourceType === 'playlist') {
      const current = api.getCurrentPlaylist?.();
      return current?.id === this.config.sourceId;
    }
    return false;
  }

  #getDisplayName() {
    // For playlists, show current track name if this playlist is playing
    const api = this.#getApi();
    if (this.config.sourceType === 'playlist' && this.#isThisSourcePlaying()) {
      const track = api?.getCurrentMusicTrack?.();
      if (track?.name) return track.name;
    }
    return this.config.sourceName || game.i18n.localize('SESSIONFLOW.Canvas.MusicNothingPlaying');
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #onPlayPause() {
    const api = this.#getApi();
    if (!api) return;

    if (this.#isThisSourcePlaying()) {
      api.togglePlayPause('music');
    } else {
      // Start playing this widget's source
      if (this.config.sourceType === 'track') {
        api.playMusic(this.config.sourceId);
      } else if (this.config.sourceType === 'playlist') {
        api.playPlaylist(this.config.sourceId);
      }
    }
  }

  #onVolumeInput(value) {
    const api = this.#getApi();
    api?.setVolume?.(value, 'music');
  }

  #onVolumeChange(value) {
    this.updateConfig({ volume: value });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Targeted DOM Updates                    */
  /* ---------------------------------------- */

  #updatePlayIcon() {
    const circle = this.element?.querySelector('.sessionflow-widget-music__circle');
    if (!circle) return;
    const isPlaying = this.#isThisSourcePlaying();
    const icon = circle.querySelector('i');
    if (icon) {
      icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    }
    circle.classList.toggle('is-playing', isPlaying);
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.MusicPause' : 'SESSIONFLOW.Canvas.MusicPlay');
  }

  #updateTrackName() {
    const nameEl = this.element?.querySelector('.sessionflow-widget-music__track-name');
    if (nameEl) {
      nameEl.textContent = this.#getDisplayName();
    }
  }

  #updateVolumeSlider(volume) {
    const slider = this.element?.querySelector('.sessionflow-widget-music__volume-slider');
    if (slider) slider.value = String(volume);
  }

  /* ---------------------------------------- */
  /*  Hooks (Narrator Jukebox Reactivity)     */
  /* ---------------------------------------- */

  #registerHooks() {
    // Avoid double-registration
    if (Object.keys(this.#hookIds).length > 0) return;

    this.#hookIds.play = Hooks.on('narratorJukebox.play', (data) => {
      if (data.channel !== 'music') return;
      this.#updatePlayIcon();
      this.#updateTrackName();
    });

    this.#hookIds.stop = Hooks.on('narratorJukebox.stop', (data) => {
      if (data.channel !== 'music') return;
      this.#updatePlayIcon();
      this.#updateTrackName();
    });

    this.#hookIds.pause = Hooks.on('narratorJukebox.pause', (data) => {
      if (data.channel !== 'music') return;
      this.#updatePlayIcon();
    });

    this.#hookIds.resume = Hooks.on('narratorJukebox.resume', (data) => {
      if (data.channel !== 'music') return;
      this.#updatePlayIcon();
    });

    this.#hookIds.trackChanged = Hooks.on('narratorJukebox.trackChanged', (data) => {
      if (data.channel !== 'music') return;
      this.#updatePlayIcon();
      this.#updateTrackName();
    });

    this.#hookIds.playlistStarted = Hooks.on('narratorJukebox.playlistStarted', () => {
      this.#updatePlayIcon();
      this.#updateTrackName();
    });

    this.#hookIds.volumeChanged = Hooks.on('narratorJukebox.volumeChanged', (data) => {
      if (data.channel !== 'music') return;
      this.#updateVolumeSlider(data.volume);
    });

    this.#hookIds.muteChanged = Hooks.on('narratorJukebox.muteChanged', (data) => {
      if (data.channel !== 'music') return;
      const vol = data.muted ? 0 : (this.#getApi()?.getVolume?.('music') ?? this.config.volume ?? 0.5);
      this.#updateVolumeSlider(vol);
    });
  }

  #unregisterHooks() {
    if (this.#hookIds.play != null) Hooks.off('narratorJukebox.play', this.#hookIds.play);
    if (this.#hookIds.stop != null) Hooks.off('narratorJukebox.stop', this.#hookIds.stop);
    if (this.#hookIds.pause != null) Hooks.off('narratorJukebox.pause', this.#hookIds.pause);
    if (this.#hookIds.resume != null) Hooks.off('narratorJukebox.resume', this.#hookIds.resume);
    if (this.#hookIds.trackChanged != null) Hooks.off('narratorJukebox.trackChanged', this.#hookIds.trackChanged);
    if (this.#hookIds.playlistStarted != null) Hooks.off('narratorJukebox.playlistStarted', this.#hookIds.playlistStarted);
    if (this.#hookIds.volumeChanged != null) Hooks.off('narratorJukebox.volumeChanged', this.#hookIds.volumeChanged);
    if (this.#hookIds.muteChanged != null) Hooks.off('narratorJukebox.muteChanged', this.#hookIds.muteChanged);
    this.#hookIds = {};
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    const api = this.#getApi();
    if (!api) return;
    const vol = api.getVolume?.('music');
    if (vol != null) this.updateConfig({ volume: vol });
  }

  /** @override */
  destroy() {
    this.#unregisterHooks();
    super.destroy();
  }
}

// Self-register
registerWidgetType('music', MusicWidget);
