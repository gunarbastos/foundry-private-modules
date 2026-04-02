/**
 * SessionFlow - Ambience Widget
 * Minimalist ambience controller for Narrator Jukebox tracks and saved presets.
 * Two states: selector (pick a track/preset) -> player (circle with play/pause).
 * @module widgets/ambience-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const SOURCE_TYPES = new Set(['track', 'preset']);

export class AmbienceWidget extends Widget {

  static TYPE = 'ambience';
  static LABEL = 'SESSIONFLOW.Canvas.Ambience';
  static ICON = 'fas fa-wind';
  static MIN_WIDTH = 140;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 240;
  static DEFAULT_HEIGHT = 260;
  static HELP = 'SESSIONFLOW.Help.Ambience';

  /** @type {Record<string, number>} Hook IDs for Hooks.off cleanup */
  #hookIds = {};

  /** @type {'tracks'|'presets'} Active tab in source selector */
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

  /**
   * @returns {{
   *   sourceType: 'track'|'preset',
   *   sourceId: string,
   *   sourceName: string,
   *   sourceLayerCount: number|null,
   *   sourceTrackIds: string[]
   * }|null}
   */
  #getConfiguredSource() {
    const sourceType = SOURCE_TYPES.has(this.config.sourceType) ? this.config.sourceType : null;
    const sourceId = typeof this.config.sourceId === 'string' && this.config.sourceId ? this.config.sourceId : '';

    if (sourceType && sourceId) {
      return {
        sourceType,
        sourceId,
        sourceName: typeof this.config.sourceName === 'string' ? this.config.sourceName : '',
        sourceLayerCount: Number.isFinite(this.config.sourceLayerCount) ? this.config.sourceLayerCount : null,
        sourceTrackIds: Array.isArray(this.config.sourceTrackIds)
          ? this.config.sourceTrackIds.filter((id) => typeof id === 'string' && id)
          : []
      };
    }

    const legacyTrackId = typeof this.config.trackId === 'string' && this.config.trackId ? this.config.trackId : '';
    if (!legacyTrackId) return null;

    return {
      sourceType: 'track',
      sourceId: legacyTrackId,
      sourceName: typeof this.config.trackName === 'string' ? this.config.trackName : '',
      sourceLayerCount: 1,
      sourceTrackIds: [legacyTrackId]
    };
  }

  /** @returns {boolean} Whether a source has been selected */
  #isConfigured() {
    return this.#getConfiguredSource() !== null;
  }

  /**
   * @param {string} trackId
   * @returns {object|null}
   */
  #getTrack(trackId) {
    if (!trackId) return null;
    const api = this.#getApi();
    const tracks = api?.getAllAmbience?.() ?? [];
    return tracks.find((track) => track.id === trackId) ?? null;
  }

  /**
   * @param {string} presetId
   * @returns {object|null}
   */
  #getPreset(presetId) {
    if (!presetId) return null;
    return this.#getApi()?.getAmbiencePreset?.(presetId) ?? null;
  }

  /**
   * @param {object|null} preset
   * @returns {{ trackId: string, volume?: number }[]}
   */
  #getPresetLayers(preset) {
    const layers = preset?.layersState?.layers ?? preset?.layers ?? [];
    if (!Array.isArray(layers)) return [];
    return layers.filter((layer) => typeof layer?.trackId === 'string' && layer.trackId);
  }

  /**
   * @param {ReturnType<AmbienceWidget['#getConfiguredSource']>} source
   * @returns {string[]}
   */
  #getSourceTrackIds(source) {
    if (!source) return [];
    if (source.sourceType === 'track') return [source.sourceId];

    const livePreset = this.#getPreset(source.sourceId);
    const liveTrackIds = this.#getPresetLayers(livePreset).map((layer) => layer.trackId);
    if (liveTrackIds.length > 0) return liveTrackIds;

    return source.sourceTrackIds;
  }

  /**
   * @param {ReturnType<AmbienceWidget['#getConfiguredSource']>} source
   * @returns {number}
   */
  #getSourceLayerCount(source) {
    if (!source) return 0;
    if (source.sourceType === 'track') return 1;

    const livePreset = this.#getPreset(source.sourceId);
    const liveCount = this.#getPresetLayers(livePreset).length;
    if (liveCount > 0) return liveCount;

    return source.sourceLayerCount ?? source.sourceTrackIds.length ?? 0;
  }

  /**
   * @param {ReturnType<AmbienceWidget['#getConfiguredSource']>} source
   * @returns {{ title: string, subtitle: string, isMissing: boolean }}
   */
  #describeSource(source) {
    if (!source) {
      return {
        title: game.i18n.localize('SESSIONFLOW.Canvas.AmbienceNothingPlaying'),
        subtitle: '',
        isMissing: false
      };
    }

    if (source.sourceType === 'track') {
      const track = this.#getTrack(source.sourceId);
      if (track) {
        return {
          title: track.name,
          subtitle: game.i18n.localize('SESSIONFLOW.Canvas.AmbienceTrackLabel'),
          isMissing: false
        };
      }

      return {
        title: source.sourceName || game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMissingTrack'),
        subtitle: game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMissingTrack'),
        isMissing: true
      };
    }

    const preset = this.#getPreset(source.sourceId);
    const layerCount = this.#getSourceLayerCount(source);
    if (preset) {
      return {
        title: preset.name,
        subtitle: game.i18n.format('SESSIONFLOW.Canvas.AmbiencePresetLayers', { count: layerCount }),
        isMissing: false
      };
    }

    return {
      title: source.sourceName || game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMissingPreset'),
      subtitle: game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMissingPreset'),
      isMissing: true
    };
  }

  /**
   * @param {{ name: string }[]} items
   * @returns {{ name: string }[]}
   */
  #filterItems(items) {
    if (!this.#searchFilter) return items;
    const query = this.#searchFilter.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }

  /** @returns {string} */
  #getSearchPlaceholder() {
    return game.i18n.localize(
      this.#activeTab === 'presets'
        ? 'SESSIONFLOW.Canvas.AmbienceSearchPresetsPlaceholder'
        : 'SESSIONFLOW.Canvas.AmbienceSearchTracksPlaceholder'
    );
  }

  /**
   * @param {ReturnType<AmbienceWidget['#getConfiguredSource']>} source
   * @returns {object}
   */
  #buildSourceSnapshot(source) {
    if (!source) return {};

    if (source.sourceType === 'track') {
      const track = this.#getTrack(source.sourceId);
      return {
        sourceType: 'track',
        sourceId: source.sourceId,
        sourceName: track?.name ?? source.sourceName,
        sourceLayerCount: 1,
        sourceTrackIds: [source.sourceId],
        trackId: source.sourceId,
        trackName: track?.name ?? source.sourceName
      };
    }

    const preset = this.#getPreset(source.sourceId);
    const trackIds = this.#getSourceTrackIds(source);
    return {
      sourceType: 'preset',
      sourceId: source.sourceId,
      sourceName: preset?.name ?? source.sourceName,
      sourceLayerCount: this.#getSourceLayerCount(source),
      sourceTrackIds: trackIds,
      trackId: null,
      trackName: null
    };
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
  /*  Selector State                          */
  /* ---------------------------------------- */

  #buildSelector(container) {
    const api = this.#getApi();

    const tabs = document.createElement('div');
    tabs.className = 'sessionflow-widget-ambience__selector-tabs';

    const tracksTab = document.createElement('button');
    tracksTab.type = 'button';
    tracksTab.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceTabTracks');
    if (this.#activeTab === 'tracks') tracksTab.classList.add('is-active');
    tracksTab.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#switchTab('tracks');
    });
    tabs.appendChild(tracksTab);

    const presetsTab = document.createElement('button');
    presetsTab.type = 'button';
    presetsTab.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceTabPresets');
    if (this.#activeTab === 'presets') presetsTab.classList.add('is-active');
    presetsTab.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#switchTab('presets');
    });
    tabs.appendChild(presetsTab);

    container.appendChild(tabs);

    if (this.#activeTab === 'tracks' && api?.canAddAmbienceLayer && !api.canAddAmbienceLayer()) {
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

    const searchWrap = document.createElement('div');
    searchWrap.className = 'sessionflow-widget-ambience__selector-search';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = this.#getSearchPlaceholder();
    searchInput.value = this.#searchFilter;
    searchInput.addEventListener('input', (event) => {
      event.stopPropagation();
      this.#searchFilter = event.target.value;
      this.#rebuildList();
    });
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    this.#buildList(container);
  }

  #buildList(container) {
    const api = this.#getApi();

    const oldList = container.querySelector('.sessionflow-widget-ambience__selector-list');
    if (oldList) oldList.remove();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-ambience__selector-list';

    if (this.#activeTab === 'presets') {
      const presets = api?.getAmbiencePresets?.() ?? [];
      const filtered = this.#filterItems(presets);
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sessionflow-widget-ambience__selector-empty';
        empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceNoPresets');
        list.appendChild(empty);
      } else {
        for (const preset of filtered) {
          list.appendChild(this.#buildSelectorItem(preset, 'preset'));
        }
      }
    } else {
      const tracks = api?.getAllAmbience?.() ?? [];
      const filtered = this.#filterItems(tracks);
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sessionflow-widget-ambience__selector-empty';
        empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceNoTracks');
        list.appendChild(empty);
      } else {
        for (const track of filtered) {
          list.appendChild(this.#buildSelectorItem(track, 'track'));
        }
      }
    }

    container.appendChild(list);
  }

  /**
   * @param {{ id: string, name: string }} item
   * @param {'track'|'preset'} type
   * @returns {HTMLElement}
   */
  #buildSelectorItem(item, type) {
    const el = document.createElement('div');
    el.className = 'sessionflow-widget-ambience__selector-item';

    const iconEl = document.createElement('i');
    iconEl.className = type === 'preset' ? 'fas fa-layer-group' : 'fas fa-wind';
    el.appendChild(iconEl);

    const copy = document.createElement('div');
    copy.className = 'sessionflow-widget-ambience__selector-item-copy';

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-ambience__selector-item-name';
    name.textContent = item.name;
    copy.appendChild(name);

    if (type === 'preset') {
      const layerCount = this.#getPresetLayers(item).length;
      const meta = document.createElement('span');
      meta.className = 'sessionflow-widget-ambience__selector-item-meta';
      meta.textContent = game.i18n.format('SESSIONFLOW.Canvas.AmbiencePresetLayers', { count: layerCount });
      copy.appendChild(meta);
    }

    el.appendChild(copy);

    el.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#selectSource(type, item);
    });

    return el;
  }

  /**
   * @param {'tracks'|'presets'} tab
   */
  #switchTab(tab) {
    this.#activeTab = tab;
    this.#searchFilter = '';

    const container = this.element?.querySelector('.sessionflow-widget-ambience');
    if (!container) return;

    const tabs = container.querySelectorAll('.sessionflow-widget-ambience__selector-tabs button');
    tabs.forEach((btn, index) => {
      btn.classList.toggle('is-active', (index === 0 && tab === 'tracks') || (index === 1 && tab === 'presets'));
    });

    const input = container.querySelector('.sessionflow-widget-ambience__selector-search input');
    if (input) {
      input.value = '';
      input.placeholder = this.#getSearchPlaceholder();
    }

    this.refreshBody();
  }

  #rebuildList() {
    const container = this.element?.querySelector('.sessionflow-widget-ambience');
    if (!container) return;
    this.#buildList(container);

    const input = container.querySelector('.sessionflow-widget-ambience__selector-search input');
    if (input && this.#searchFilter) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  /**
   * @param {'track'|'preset'} type
   * @param {{ id: string, name: string }} item
   */
  #selectSource(type, item) {
    const source = {
      sourceType: type,
      sourceId: item.id,
      sourceName: item.name,
      sourceLayerCount: type === 'preset' ? this.#getPresetLayers(item).length : 1,
      sourceTrackIds: type === 'preset' ? this.#getPresetLayers(item).map((layer) => layer.trackId) : [item.id]
    };

    this.updateConfig(this.#buildSourceSnapshot(source));
    this.#searchFilter = '';
    this.#registerHooks();
    this.engine.scheduleSave();
    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  Player State                            */
  /* ---------------------------------------- */

  #buildPlayer(container) {
    const source = this.#getConfiguredSource();
    const details = this.#describeSource(source);
    const isPlaying = this.#isThisSourceActive();
    const liveVolume = source?.sourceType === 'track' && isPlaying
      ? this.#getApi()?.getAmbienceLayerVolume?.(source.sourceId)
      : null;
    const volume = source?.sourceType === 'track'
      ? (liveVolume ?? this.config.volume ?? 0.5)
      : null;

    if (details.isMissing) container.classList.add('is-missing');

    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'sessionflow-widget-ambience__circle';
    if (isPlaying) circle.classList.add('is-playing');
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.AmbiencePause' : 'SESSIONFLOW.Canvas.AmbiencePlay');

    const icon = document.createElement('i');
    icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    circle.appendChild(icon);

    circle.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.#onToggle();
    });
    container.appendChild(circle);

    const trackName = document.createElement('div');
    trackName.className = 'sessionflow-widget-ambience__track-name';
    trackName.textContent = details.title;
    container.appendChild(trackName);

    const trackMeta = document.createElement('div');
    trackMeta.className = 'sessionflow-widget-ambience__track-meta';
    trackMeta.textContent = details.subtitle;
    container.appendChild(trackMeta);

    if (source?.sourceType === 'track') {
      const volumeWrap = document.createElement('div');
      volumeWrap.className = 'sessionflow-widget-ambience__volume';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'sessionflow-widget-ambience__volume-slider';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = String(volume ?? 0.5);
      slider.title = game.i18n.localize('SESSIONFLOW.Canvas.AmbienceVolume');
      slider.addEventListener('input', (event) => {
        event.stopPropagation();
        this.#onVolumeInput(parseFloat(event.target.value));
      });
      slider.addEventListener('change', (event) => {
        event.stopPropagation();
        this.#onVolumeChange(parseFloat(event.target.value));
      });
      volumeWrap.appendChild(slider);

      container.appendChild(volumeWrap);
    }
  }

  /**
   * Check if THIS widget's source is currently active.
   * @returns {boolean}
   */
  #isThisSourceActive() {
    const api = this.#getApi();
    const source = this.#getConfiguredSource();
    if (!api || !source) return false;

    const activeLayers = api.getActiveAmbienceLayers?.() ?? [];
    if (source.sourceType === 'track') {
      return activeLayers.some((layer) => layer.id === source.sourceId || layer.trackId === source.sourceId);
    }

    const expectedTrackIds = this.#getSourceTrackIds(source);
    if (expectedTrackIds.length === 0 || activeLayers.length !== expectedTrackIds.length) return false;

    const activeTrackIds = new Set(activeLayers.map((layer) => layer.trackId ?? layer.id).filter(Boolean));
    return expectedTrackIds.every((trackId) => activeTrackIds.has(trackId));
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  async #onToggle() {
    const api = this.#getApi();
    const source = this.#getConfiguredSource();
    if (!api || !source) return;

    if (source.sourceType === 'track') {
      if (this.#isThisSourceActive()) {
        api.stopAmbienceLayer(source.sourceId);
      } else {
        await api.playAmbienceLayer(source.sourceId);
        const savedVolume = Number.isFinite(this.config.volume) ? this.config.volume : null;
        if (savedVolume != null) {
          api.setAmbienceLayerVolume?.(source.sourceId, savedVolume);
        }
      }
      return;
    }

    const preset = this.#getPreset(source.sourceId);
    if (!preset) {
      ui.notifications.warn(game.i18n.localize('SESSIONFLOW.Canvas.AmbienceMissingPresetAction'));
      return;
    }

    if (this.#isThisSourceActive()) {
      api.stopAllAmbienceLayers();
    } else {
      await api.loadAmbiencePreset(source.sourceId);
    }
  }

  #onVolumeInput(value) {
    const source = this.#getConfiguredSource();
    if (source?.sourceType !== 'track') return;
    this.#getApi()?.setAmbienceLayerVolume?.(source.sourceId, value);
  }

  #onVolumeChange(value) {
    const source = this.#getConfiguredSource();
    if (source?.sourceType !== 'track') return;
    this.updateConfig({ volume: value });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Targeted DOM Updates                    */
  /* ---------------------------------------- */

  #updatePlayIcon() {
    const circle = this.element?.querySelector('.sessionflow-widget-ambience__circle');
    if (!circle) return;

    const isPlaying = this.#isThisSourceActive();
    const icon = circle.querySelector('i');
    if (icon) {
      icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'}`;
    }
    circle.classList.toggle('is-playing', isPlaying);
    circle.title = game.i18n.localize(isPlaying ? 'SESSIONFLOW.Canvas.AmbiencePause' : 'SESSIONFLOW.Canvas.AmbiencePlay');
  }

  #updatePlayerDetails() {
    const container = this.element?.querySelector('.sessionflow-widget-ambience--player');
    if (!container) return;

    const details = this.#describeSource(this.#getConfiguredSource());
    const nameEl = container.querySelector('.sessionflow-widget-ambience__track-name');
    if (nameEl) nameEl.textContent = details.title;

    const metaEl = container.querySelector('.sessionflow-widget-ambience__track-meta');
    if (metaEl) metaEl.textContent = details.subtitle;

    container.classList.toggle('is-missing', details.isMissing);
  }

  #updateVolumeSlider(volume) {
    const slider = this.element?.querySelector('.sessionflow-widget-ambience__volume-slider');
    if (slider) slider.value = String(volume);
  }

  /* ---------------------------------------- */
  /*  Hooks (Narrator Jukebox Reactivity)     */
  /* ---------------------------------------- */

  #registerHooks() {
    if (Object.keys(this.#hookIds).length > 0) return;

    this.#hookIds.stateChanged = Hooks.on('narratorJukeboxStateChanged', () => {
      this.#updatePlayIcon();
      this.#updatePlayerDetails();
    });

    this.#hookIds.volumeChanged = Hooks.on('narratorJukebox.ambienceLayer.volumeChanged', (data) => {
      const source = this.#getConfiguredSource();
      if (source?.sourceType !== 'track') return;
      if (data.trackId === source.sourceId) {
        this.#updateVolumeSlider(data.volume);
      }
    });
  }

  #unregisterHooks() {
    if (this.#hookIds.stateChanged != null) Hooks.off('narratorJukeboxStateChanged', this.#hookIds.stateChanged);
    if (this.#hookIds.volumeChanged != null) Hooks.off('narratorJukebox.ambienceLayer.volumeChanged', this.#hookIds.volumeChanged);
    this.#hookIds = {};
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    const api = this.#getApi();
    const source = this.#getConfiguredSource();
    if (!api || !source) return;

    if (source.sourceType === 'track') {
      const vol = this.#isThisSourceActive()
        ? api.getAmbienceLayerVolume?.(source.sourceId)
        : this.config.volume;
      if (vol != null) this.updateConfig({ volume: vol });
      this.updateConfig(this.#buildSourceSnapshot(source));
      return;
    }

    this.updateConfig(this.#buildSourceSnapshot(source));
  }

  /** @override */
  destroy() {
    this.#unregisterHooks();
    super.destroy();
  }
}

registerWidgetType('ambience', AmbienceWidget);
