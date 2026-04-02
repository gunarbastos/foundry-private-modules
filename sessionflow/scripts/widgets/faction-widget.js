/**
 * SessionFlow - Faction Widget
 * Tracks character reputation with a faction using customizable levels,
 * reusable saved factions, and per-character notes.
 * @module widgets/faction-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';
const FACTION_LIBRARY_SETTING = 'factionLibrary';
const MIN_LEVEL_COUNT = 2;

const DEFAULT_LEVEL_DEFS = [
  { key: 'SESSIONFLOW.Canvas.FactionLevelHunted', fallback: 'Hunted', color: '#991b1b' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelHostile', fallback: 'Hostile', color: '#dc2626' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelAntagonistic', fallback: 'Antagonistic', color: '#ea580c' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelUnfriendly', fallback: 'Unfriendly', color: '#f97316' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelSuspicious', fallback: 'Suspicious', color: '#d97706' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelWary', fallback: 'Wary', color: '#eab308' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelNeutral', fallback: 'Neutral', color: '#9ca3af' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelTolerated', fallback: 'Tolerated', color: '#84cc16' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelAccepted', fallback: 'Accepted', color: '#4ade80' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelFriendly', fallback: 'Friendly', color: '#22c55e' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelHonored', fallback: 'Honored', color: '#16a34a' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelRevered', fallback: 'Revered', color: '#15803d' },
  { key: 'SESSIONFLOW.Canvas.FactionLevelExalted', fallback: 'Exalted', color: '#166534' }
];

function localizeOrFallback(key, fallback) {
  const localized = game?.i18n?.localize?.(key);
  return localized && localized !== key ? localized : fallback;
}

function normalizeHexColor(color, fallback = '#9ca3af') {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return fallback;
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs((2 * l) - 1)) * s;
  const h = hue / 60;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 1) [r, g, b] = [chroma, x, 0];
  else if (h < 2) [r, g, b] = [x, chroma, 0];
  else if (h < 3) [r, g, b] = [0, chroma, x];
  else if (h < 4) [r, g, b] = [0, x, chroma];
  else if (h < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  const match = l - (chroma / 2);
  const toHex = (value) => Math.round((value + match) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getSuggestedLevelColor(index, total) {
  if (DEFAULT_LEVEL_DEFS[index]?.color) return DEFAULT_LEVEL_DEFS[index].color;
  const safeTotal = Math.max(total - 1, 1);
  const ratio = Math.max(0, Math.min(index / safeTotal, 1));
  const hue = ratio * 135;
  return hslToHex(hue, 74, 44);
}

function buildDefaultLevels() {
  return DEFAULT_LEVEL_DEFS.map((entry, index, defs) => ({
    label: localizeOrFallback(entry.key, entry.fallback),
    color: normalizeHexColor(entry.color, getSuggestedLevelColor(index, defs.length))
  }));
}

function cloneLevels(levels) {
  return (levels ?? []).map((level, index, all) => ({
    label: typeof level?.label === 'string' ? level.label : '',
    color: normalizeHexColor(level?.color, getSuggestedLevelColor(index, all.length || DEFAULT_LEVEL_DEFS.length))
  }));
}

function cloneMembers(members) {
  return (members ?? []).map((member) => ({
    id: typeof member?.id === 'string' && member.id ? member.id : foundry.utils.randomID(),
    characterId: typeof member?.characterId === 'string' ? member.characterId : '',
    level: Number.isFinite(member?.level) ? Math.round(member.level) : 0,
    note: typeof member?.note === 'string' ? member.note : ''
  }));
}

function getDefaultLevelIndex(levelCount) {
  return Math.floor(Math.max(levelCount - 1, 0) / 2);
}

function clampLevel(level, maxLevel, fallbackLevel = getDefaultLevelIndex(maxLevel + 1)) {
  const candidate = Number.isFinite(level) ? Math.round(level) : fallbackLevel;
  return Math.max(0, Math.min(candidate, Math.max(0, maxLevel)));
}

function normalizeFactionLevels(rawLevels) {
  const defaults = buildDefaultLevels();

  if (Array.isArray(rawLevels)) {
    const normalized = rawLevels
      .map((level, index, all) => {
        const fallback = defaults[index] ?? {
          label: '',
          color: getSuggestedLevelColor(index, all.length || defaults.length)
        };

        if (typeof level === 'string') {
          return {
            label: level,
            color: fallback.color
          };
        }

        if (!level || typeof level !== 'object') return fallback;

        return {
          label: typeof level.label === 'string'
            ? level.label
            : (typeof level.name === 'string' ? level.name : fallback.label),
          color: normalizeHexColor(level.color, fallback.color)
        };
      })
      .filter(Boolean);

    while (normalized.length < MIN_LEVEL_COUNT) {
      normalized.push({
        label: '',
        color: getSuggestedLevelColor(normalized.length, Math.max(normalized.length + 1, defaults.length))
      });
    }

    return normalized;
  }

  if (rawLevels && typeof rawLevels === 'object') {
    return defaults.map((fallback, index) => {
      const level = rawLevels[index] ?? rawLevels[String(index)];
      if (typeof level === 'string') {
        return {
          label: level,
          color: fallback.color
        };
      }

      if (level && typeof level === 'object') {
        return {
          label: typeof level.label === 'string'
            ? level.label
            : (typeof level.name === 'string' ? level.name : fallback.label),
          color: normalizeHexColor(level.color, fallback.color)
        };
      }

      return fallback;
    });
  }

  return defaults;
}

function normalizeFactionMembers(rawMembers, maxLevel) {
  if (!Array.isArray(rawMembers)) return [];

  const fallbackLevel = getDefaultLevelIndex(maxLevel + 1);
  const seenCharacterIds = new Set();

  return rawMembers
    .map((member) => {
      if (!member || typeof member !== 'object') return null;
      const characterId = typeof member.characterId === 'string' ? member.characterId : '';
      if (!characterId || seenCharacterIds.has(characterId)) return null;
      seenCharacterIds.add(characterId);

      return {
        id: typeof member.id === 'string' && member.id ? member.id : foundry.utils.randomID(),
        characterId,
        level: clampLevel(member.level, maxLevel, fallbackLevel),
        note: typeof member.note === 'string' ? member.note : ''
      };
    })
    .filter(Boolean);
}

function normalizeLibraryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const levels = normalizeFactionLevels(entry.levels);
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : foundry.utils.randomID(),
    name: typeof entry.name === 'string' ? entry.name : '',
    image: typeof entry.image === 'string' ? entry.image : '',
    levels,
    members: normalizeFactionMembers(entry.members, levels.length - 1),
    updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0
  };
}

function sortLibraryEntries(entries) {
  return [...entries].sort((a, b) => {
    const nameCompare = (a.name || '').localeCompare(b.name || '');
    if (nameCompare !== 0) return nameCompare;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

function areLevelsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((level, index) => {
    const other = b[index];
    return other &&
      (typeof level?.label === 'string' ? level.label : '') === other.label &&
      normalizeHexColor(level?.color, other.color) === other.color;
  });
}

function areMembersEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((member, index) => {
    const other = b[index];
    return other &&
      (typeof member?.id === 'string' ? member.id : '') === other.id &&
      (typeof member?.characterId === 'string' ? member.characterId : '') === other.characterId &&
      clampLevel(member?.level, other.level, other.level) === other.level &&
      (typeof member?.note === 'string' ? member.note : '') === other.note;
  });
}

export class FactionWidget extends Widget {

  static TYPE = 'faction';
  static LABEL = 'SESSIONFLOW.Canvas.Faction';
  static ICON = 'fas fa-flag';
  static MIN_WIDTH = 280;
  static MIN_HEIGHT = 180;
  static DEFAULT_WIDTH = 360;
  static DEFAULT_HEIGHT = 320;
  static PLAYER_MODES = ['view'];
  static HELP = 'SESSIONFLOW.Help.Faction';

  /** @type {boolean} */
  #isDropdownOpen = false;

  /** @type {Function|null} */
  #dropdownCloseHandler = null;

  /** @type {string|null} */
  #editingNoteId = null;

  /** @type {number|null} */
  #noteSaveTimer = null;

  /** @type {boolean} */
  #isEditingName = false;

  /** @type {boolean} */
  #isLevelEditorOpen = false;

  /** @type {number|null} */
  #levelSaveTimer = null;

  /** @type {Function|null} */
  #levelEditorCloseHandler = null;

  /** @type {boolean} */
  #isLibraryPanelOpen = false;

  /** @type {Function|null} */
  #libraryPanelCloseHandler = null;

  /** @type {boolean} */
  #libraryHydrated = false;

  /** @type {boolean} */
  #isHydratingLibrary = false;

  /** @type {boolean|null} */
  #linkedFactionExists = null;

  /** @type {number|null} */
  #librarySyncTimer = null;

  /** @type {Promise<unknown>} */
  #libraryWritePromise = Promise.resolve();

  /* ---------------------------------------- */
  /*  Config Helpers                          */
  /* ---------------------------------------- */

  #ensureConfigNormalized() {
    const levels = normalizeFactionLevels(this.config.levels);
    const members = normalizeFactionMembers(this.config.members, levels.length - 1);
    const name = typeof this.config.name === 'string' ? this.config.name : '';
    const image = typeof this.config.image === 'string' ? this.config.image : '';
    const rawFactionId = typeof this.config.factionId === 'string' ? this.config.factionId.trim() : '';
    const factionId = rawFactionId || null;

    if (
      !Array.isArray(this.config.levels) ||
      !areLevelsEqual(this.config.levels, levels) ||
      !Array.isArray(this.config.members) ||
      !areMembersEqual(this.config.members, members) ||
      typeof this.config.name !== 'string' ||
      typeof this.config.image !== 'string' ||
      this.config.factionId !== factionId
    ) {
      this.updateConfig({ levels, members, name, image, factionId });
    }
  }

  #getFactionId() {
    return typeof this.config.factionId === 'string' && this.config.factionId ? this.config.factionId : null;
  }

  #getFactionNameRaw() {
    return typeof this.config.name === 'string' ? this.config.name : '';
  }

  #getFactionName() {
    return this.#getFactionNameRaw().trim() || game.i18n.localize('SESSIONFLOW.Canvas.FactionNameDefault');
  }

  #getFactionImage() {
    return typeof this.config.image === 'string' ? this.config.image : '';
  }

  #getLevels() {
    this.#ensureConfigNormalized();
    return this.config.levels ?? buildDefaultLevels();
  }

  #getMembers() {
    this.#ensureConfigNormalized();
    return this.config.members ?? [];
  }

  #getMaxLevel() {
    return Math.max(0, this.#getLevels().length - 1);
  }

  #getDefaultLevel() {
    return getDefaultLevelIndex(this.#getLevels().length);
  }

  #getLevelData(levelIndex) {
    const levels = this.#getLevels();
    const safeIndex = clampLevel(levelIndex, levels.length - 1, this.#getDefaultLevel());
    return levels[safeIndex] ?? levels[this.#getDefaultLevel()] ?? { label: '', color: '#9ca3af' };
  }

  #getTrackedCountLabel(count = this.#getMembers().length) {
    return game.i18n.format('SESSIONFLOW.Canvas.FactionTrackedCount', { count });
  }

  #isLinkedToLibrary() {
    return !!this.#getFactionId();
  }

  #getLibraryState() {
    if (!this.#isLinkedToLibrary()) {
      return {
        label: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryLocalOnly'),
        detail: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryLocalOnly'),
        className: 'is-local'
      };
    }

    if (this.#linkedFactionExists === false) {
      return {
        label: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryMissing'),
        detail: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryMissing'),
        className: 'is-missing'
      };
    }

    return {
      label: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryLinked'),
      detail: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryAutoSync'),
      className: 'is-linked'
    };
  }

  #hasMeaningfulContent() {
    return !!(
      this.#getFactionNameRaw().trim() ||
      this.#getFactionImage() ||
      this.#getMembers().length ||
      this.#isLinkedToLibrary()
    );
  }

  /* ---------------------------------------- */
  /*  Exalted Scenes API                      */
  /* ---------------------------------------- */

  #isExaltedScenesAvailable() {
    const mod = game.modules.get('exalted-scenes');
    return mod?.active && mod?.api?.isReady;
  }

  #getAllExaltedCharacters() {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return [];
      return [...(api.characters.getAll() ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Characters:`, err);
      return [];
    }
  }

  #getExaltedCharacter(characterId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return null;
      return api.characters.get(characterId) ?? null;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Character ${characterId}:`, err);
      return null;
    }
  }

  #getAvailableCharacters() {
    const trackedIds = new Set(this.#getMembers().map((member) => member.characterId));
    return this.#getAllExaltedCharacters().filter((character) => !trackedIds.has(character.id));
  }

  /* ---------------------------------------- */
  /*  Library                                 */
  /* ---------------------------------------- */

  #getSavedFactions() {
    const raw = game.settings.get(MODULE_ID, FACTION_LIBRARY_SETTING) ?? [];
    return sortLibraryEntries(
      (Array.isArray(raw) ? raw : [])
        .map((entry) => normalizeLibraryEntry(entry))
        .filter(Boolean)
    );
  }

  #getSavedFaction(factionId = this.#getFactionId()) {
    if (!factionId) return null;
    return this.#getSavedFactions().find((entry) => entry.id === factionId) ?? null;
  }

  #queueLibraryWrite(task) {
    const run = async () => {
      try {
        return await task();
      } catch (err) {
        console.warn(`[${MODULE_ID}] Failed to update faction library:`, err);
        return null;
      }
    };

    this.#libraryWritePromise = this.#libraryWritePromise.then(run, run);
    return this.#libraryWritePromise;
  }

  #serializeCurrentFaction(factionId = this.#getFactionId() ?? foundry.utils.randomID()) {
    return normalizeLibraryEntry({
      id: factionId,
      name: this.#getFactionNameRaw(),
      image: this.#getFactionImage(),
      levels: cloneLevels(this.#getLevels()),
      members: cloneMembers(this.#getMembers()),
      updatedAt: Date.now()
    });
  }

  #ensureLinkedFactionHydrated() {
    const factionId = this.#getFactionId();
    if (!factionId) {
      this.#libraryHydrated = true;
      this.#linkedFactionExists = null;
      return;
    }

    if (this.#libraryHydrated || this.#isHydratingLibrary) return;

    this.#isHydratingLibrary = true;
    Promise.resolve().then(() => {
      const savedFaction = this.#getSavedFaction(factionId);
      this.#linkedFactionExists = !!savedFaction;
      this.#libraryHydrated = true;

      if (!savedFaction) return;

      this.updateConfig({
        factionId: savedFaction.id,
        name: savedFaction.name,
        image: savedFaction.image,
        levels: cloneLevels(savedFaction.levels),
        members: cloneMembers(savedFaction.members)
      });
    }).catch((err) => {
      console.warn(`[${MODULE_ID}] Failed to hydrate linked faction ${factionId}:`, err);
      this.#linkedFactionExists = false;
      this.#libraryHydrated = true;
    }).finally(() => {
      this.#isHydratingLibrary = false;
      this.#rerender();
    });
  }

  #queueLibrarySync() {
    if (!this.#isLinkedToLibrary() || !this.#libraryHydrated) return;

    if (this.#librarySyncTimer) clearTimeout(this.#librarySyncTimer);
    this.#librarySyncTimer = setTimeout(() => {
      this.#librarySyncTimer = null;
      void this.#syncLinkedFactionToLibrary();
    }, 500);
  }

  async #syncLinkedFactionToLibrary() {
    const factionId = this.#getFactionId();
    if (!factionId || !this.#libraryHydrated) return;

    const payload = this.#serializeCurrentFaction(factionId);
    if (!payload) return;

    await this.#queueLibraryWrite(async () => {
      const factions = this.#getSavedFactions();
      const index = factions.findIndex((entry) => entry.id === factionId);
      if (index === -1) factions.push(payload);
      else factions[index] = payload;

      await game.settings.set(MODULE_ID, FACTION_LIBRARY_SETTING, sortLibraryEntries(factions));
      this.#linkedFactionExists = true;
      if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
    });
  }

  async #saveCurrentToLibrary() {
    this.#ensureConfigNormalized();

    const targetId = this.#getFactionId() ?? foundry.utils.randomID();
    this.updateConfig({ factionId: targetId });
    this.#libraryHydrated = true;

    await this.#syncLinkedFactionToLibrary();

    this.engine.scheduleSave();
    this.#rerender();
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.FactionLibrarySaved'));
  }

  async #confirmLoadSavedFaction(factionId) {
    if (factionId && factionId === this.#getFactionId()) return true;
    if (!this.#hasMeaningfulContent()) return true;
    return foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibrary') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryLoadConfirm')}</p>`,
      rejectClose: false,
      modal: true
    });
  }

  async #loadLibraryFaction(factionId) {
    const faction = this.#getSavedFaction(factionId);
    if (!faction) {
      this.#linkedFactionExists = false;
      this.#rerender();
      return;
    }

    const confirmed = await this.#confirmLoadSavedFaction(factionId);
    if (!confirmed) return;

    this.updateConfig({
      factionId: faction.id,
      name: faction.name,
      image: faction.image,
      levels: cloneLevels(faction.levels),
      members: cloneMembers(faction.members)
    });

    this.#libraryHydrated = true;
    this.#linkedFactionExists = true;
    this.#isEditingName = false;
    this.#editingNoteId = null;
    this.#closeDropdown();
    this.engine.scheduleSave();
    this.#closeLibraryPanel();
    this.#rerender();
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.FactionLibraryLoaded'));
  }

  async #unlinkLibraryFaction() {
    if (!this.#isLinkedToLibrary()) return;
    this.updateConfig({ factionId: null });
    this.#libraryHydrated = true;
    this.#linkedFactionExists = null;
    this.engine.scheduleSave();
    this.#rerender();
    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.FactionLibraryUnlinked'));
  }

  async #deleteLibraryFaction(factionId) {
    const savedFaction = this.#getSavedFaction(factionId);
    if (!savedFaction) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Canvas.FactionLibrary') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryDeleteConfirm')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    await this.#queueLibraryWrite(async () => {
      const factions = this.#getSavedFactions().filter((entry) => entry.id !== factionId);
      await game.settings.set(MODULE_ID, FACTION_LIBRARY_SETTING, factions);
    });

    if (this.#getFactionId() === factionId) {
      this.updateConfig({ factionId: null });
      this.#linkedFactionExists = null;
      this.#libraryHydrated = true;
      this.engine.scheduleSave();
      this.#rerender();
    } else if (this.#isLibraryPanelOpen) {
      this.#rebuildLibraryPanel();
    }

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.FactionLibraryDeleted'));
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return this.#getFactionName();
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    this.#ensureConfigNormalized();
    this.#ensureLinkedFactionHydrated();
    this.#detachDropdownCloseHandler();
    this.#isDropdownOpen = false;

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-faction';

    if (!this.#isExaltedScenesAvailable()) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-puzzle-piece',
        game.i18n.localize('SESSIONFLOW.Canvas.FactionUnavailable')
      ));
      bodyEl.appendChild(container);
      if (this.canEdit) {
        this.#injectHeaderButtons();
        if (this.#isLevelEditorOpen) this.#rebuildLevelEditor();
        if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
      }
      return;
    }

    this.#buildBanner(container);
    this.#buildMembersList(container);

    if (this.canEdit) {
      this.#buildAddArea(container);
    }

    bodyEl.appendChild(container);

    if (this.canEdit) {
      this.#injectHeaderButtons();
      if (this.#isLevelEditorOpen) this.#rebuildLevelEditor();
      if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
    } else {
      this.#closeLevelEditor();
      this.#closeLibraryPanel();
    }
  }

  #buildBanner(container) {
    const banner = document.createElement('div');
    banner.className = 'sessionflow-widget-faction__banner';

    const art = document.createElement(this.canEdit ? 'button' : 'div');
    art.className = 'sessionflow-widget-faction__banner-art';
    if (art instanceof HTMLButtonElement) art.type = 'button';
    art.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionImagePrompt');

    if (this.canEdit) {
      art.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#openFilePicker();
      });
    }

    const imagePath = this.#getFactionImage();
    if (imagePath) {
      const img = document.createElement('img');
      img.src = imagePath;
      img.alt = this.#getFactionName();
      art.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'sessionflow-widget-faction__banner-placeholder';
      placeholder.innerHTML = '<i class="fas fa-shield-halved"></i>';

      const prompt = document.createElement('span');
      prompt.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionImagePrompt');
      placeholder.appendChild(prompt);
      art.appendChild(placeholder);
    }
    banner.appendChild(art);

    const summary = document.createElement('div');
    summary.className = 'sessionflow-widget-faction__banner-summary';

    const heading = document.createElement('div');
    heading.className = 'sessionflow-widget-faction__banner-heading';

    if (this.#isEditingName && this.canEdit) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-faction__banner-name-input';
      input.value = this.#getFactionNameRaw();
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNamePlaceholder');

      const save = () => {
        this.updateConfig({ name: input.value.trim() });
        this.#isEditingName = false;
        this.engine.scheduleSave();
        this.#queueLibrarySync();
        this.#rerender();
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          save();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.#isEditingName = false;
          this.#rerender();
        }
      });

      heading.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const name = document.createElement('div');
      name.className = 'sessionflow-widget-faction__banner-name';
      name.textContent = this.#getFactionName();

      if (this.canEdit) {
        name.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionNamePlaceholder');
        name.addEventListener('click', (event) => {
          event.stopPropagation();
          this.#isEditingName = true;
          this.#rerender();
        });
      }

      heading.appendChild(name);
    }

    summary.appendChild(heading);

    const badges = document.createElement('div');
    badges.className = 'sessionflow-widget-faction__banner-badges';

    const libraryState = this.#getLibraryState();

    const libraryBadge = document.createElement('span');
    libraryBadge.className = `sessionflow-widget-faction__badge ${libraryState.className}`;
    libraryBadge.textContent = libraryState.label;
    badges.appendChild(libraryBadge);

    const countBadge = document.createElement('span');
    countBadge.className = 'sessionflow-widget-faction__badge is-count';
    countBadge.textContent = this.#getTrackedCountLabel();
    badges.appendChild(countBadge);

    summary.appendChild(badges);

    const subtitle = document.createElement('div');
    subtitle.className = 'sessionflow-widget-faction__banner-subtitle';
    subtitle.textContent = libraryState.detail;
    summary.appendChild(subtitle);

    banner.appendChild(summary);
    container.appendChild(banner);
  }

  #buildMembersList(container) {
    const members = this.#getMembers();
    const levels = this.#getLevels();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-faction__list';

    if (members.length === 0) {
      list.appendChild(this.#buildEmptyState(
        'fas fa-handshake-angle',
        game.i18n.localize('SESSIONFLOW.Canvas.FactionEmpty'),
        game.i18n.localize('SESSIONFLOW.Canvas.FactionEmptySubtitle')
      ));
    } else {
      for (const member of members) {
        list.appendChild(this.#buildMemberRow(member, levels));
      }
    }

    container.appendChild(list);
  }

  #buildMemberRow(member, levels) {
    const maxLevel = Math.max(0, levels.length - 1);
    const levelIndex = clampLevel(member.level, maxLevel, this.#getDefaultLevel());
    const levelData = levels[levelIndex] ?? levels[this.#getDefaultLevel()] ?? { label: '', color: '#9ca3af' };
    const character = this.#getExaltedCharacter(member.characterId);

    const row = document.createElement('div');
    row.className = 'sessionflow-widget-faction__row';
    row.dataset.memberId = member.id;
    row.style.setProperty('--sf-faction-level-color', levelData.color);

    const barArea = document.createElement('div');
    barArea.className = 'sessionflow-widget-faction__bar-area';

    barArea.appendChild(this.#buildPortrait(character));
    barArea.appendChild(this.#buildTrack(member, levelIndex, maxLevel));
    row.appendChild(barArea);

    const info = document.createElement('div');
    info.className = 'sessionflow-widget-faction__info';

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-faction__member-name';
    name.textContent = character?.name ?? 'Unknown';
    info.appendChild(name);

    const dot = document.createElement('span');
    dot.className = 'sessionflow-widget-faction__info-dot';
    dot.textContent = '\u00B7';
    dot.hidden = !levelData.label;
    info.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'sessionflow-widget-faction__level-label';
    label.textContent = levelData.label;
    label.hidden = !levelData.label;
    info.appendChild(label);

    row.appendChild(info);
    row.appendChild(this.#buildNoteArea(member));

    if (this.canEdit) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sessionflow-widget-faction__delete-btn';
      removeBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#removeMember(member.id);
      });
      row.appendChild(removeBtn);
    }

    return row;
  }

  #buildPortrait(character) {
    const portrait = document.createElement('div');
    portrait.className = 'sessionflow-widget-faction__portrait';

    if (character?.image) {
      const img = document.createElement('img');
      img.src = character.image;
      img.alt = character.name ?? '';
      portrait.appendChild(img);
    } else {
      const icon = document.createElement('i');
      icon.className = character ? 'fas fa-user' : 'fas fa-user-slash';
      portrait.appendChild(icon);
    }

    return portrait;
  }

  #buildTrack(member, currentLevel, maxLevel) {
    const track = document.createElement('div');
    track.className = 'sessionflow-widget-faction__track';

    const fill = document.createElement('div');
    fill.className = 'sessionflow-widget-faction__track-fill';
    fill.style.width = `${maxLevel > 0 ? (currentLevel / maxLevel) * 100 : 100}%`;
    track.appendChild(fill);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-faction__slider';
    slider.min = '0';
    slider.max = String(maxLevel);
    slider.step = '1';
    slider.value = String(currentLevel);
    slider.disabled = !this.canEdit || maxLevel <= 0;

    slider.addEventListener('input', (event) => {
      event.stopPropagation();
      const nextLevel = clampLevel(Number.parseInt(event.target.value, 10), maxLevel, currentLevel);
      this.#updateMemberLevel(member.id, nextLevel);

      const row = slider.closest('.sessionflow-widget-faction__row');
      if (!row) return;

      const nextLevelData = this.#getLevelData(nextLevel);
      row.style.setProperty('--sf-faction-level-color', nextLevelData.color);

      const rowFill = row.querySelector('.sessionflow-widget-faction__track-fill');
      if (rowFill) {
        rowFill.style.width = `${maxLevel > 0 ? (nextLevel / maxLevel) * 100 : 100}%`;
      }

      const dot = row.querySelector('.sessionflow-widget-faction__info-dot');
      if (dot) dot.hidden = !nextLevelData.label;

      const label = row.querySelector('.sessionflow-widget-faction__level-label');
      if (label) {
        label.textContent = nextLevelData.label;
        label.hidden = !nextLevelData.label;
      }
    });

    track.appendChild(slider);
    return track;
  }

  #buildNoteArea(member) {
    const noteArea = document.createElement('div');
    noteArea.className = 'sessionflow-widget-faction__note-area';

    if (this.#editingNoteId === member.id && this.canEdit) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-faction__note-input';
      input.value = member.note ?? '';
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNotePlaceholder');

      input.addEventListener('input', (event) => {
        event.stopPropagation();
        this.#onNoteInput(member.id, input.value);
      });

      input.addEventListener('blur', () => {
        this.#finishNoteEdit(member.id, input.value);
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.#finishNoteEdit(member.id, input.value);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.#cancelNoteEdit();
        }
      });

      noteArea.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
      return noteArea;
    }

    const note = document.createElement('div');
    note.className = 'sessionflow-widget-faction__note';
    note.textContent = member.note ?? '';
    note.dataset.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNotePlaceholder');

    if (this.canEdit) {
      note.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#editingNoteId = member.id;
        this.#rerender();
      });
    }

    noteArea.appendChild(note);
    return noteArea;
  }

  #buildAddArea(container) {
    const addArea = document.createElement('div');
    addArea.className = 'sessionflow-widget-faction__add-area';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-widget-faction__add-btn';
    addBtn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.FactionAddMember')}`;
    addBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#toggleDropdown();
    });
    addArea.appendChild(addBtn);

    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-faction__dropdown';

    const availableCharacters = this.#getAvailableCharacters();
    if (availableCharacters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-faction__dropdown-empty';
      empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionNoCharacters');
      dropdown.appendChild(empty);
    } else {
      for (const character of availableCharacters) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-widget-faction__dropdown-item';

        const portrait = document.createElement('div');
        portrait.className = 'sessionflow-widget-faction__dropdown-portrait';
        if (character.image) {
          const img = document.createElement('img');
          img.src = character.image;
          img.alt = character.name ?? '';
          portrait.appendChild(img);
        } else {
          portrait.innerHTML = '<i class="fas fa-user"></i>';
        }
        item.appendChild(portrait);

        const name = document.createElement('span');
        name.textContent = character.name;
        item.appendChild(name);

        item.addEventListener('click', (event) => {
          event.stopPropagation();
          this.#addMember(character.id);
        });

        dropdown.appendChild(item);
      }
    }

    if (this.#isDropdownOpen) {
      dropdown.classList.add('is-visible');
      this.#attachDropdownCloseHandler(dropdown);
    }

    addArea.appendChild(dropdown);
    container.appendChild(addArea);
  }

  #buildEmptyState(iconClass, text, subtitle) {
    const empty = document.createElement('div');
    empty.className = 'sessionflow-widget-faction__empty';
    empty.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;

    if (subtitle) {
      const sub = document.createElement('span');
      sub.className = 'sessionflow-widget-faction__empty-subtitle';
      sub.textContent = subtitle;
      empty.appendChild(sub);
    }

    return empty;
  }

  /* ---------------------------------------- */
  /*  Header Controls                         */
  /* ---------------------------------------- */

  #injectHeaderButtons() {
    const header = this.element?.querySelector('.sessionflow-widget__header');
    if (!header) return;

    if (!header.querySelector('.sessionflow-widget-faction__library-btn')) {
      const libraryBtn = document.createElement('button');
      libraryBtn.type = 'button';
      libraryBtn.className = 'sessionflow-widget-faction__library-btn';
      libraryBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionLibrary');
      libraryBtn.innerHTML = '<i class="fas fa-book-open"></i>';
      libraryBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#toggleLibraryPanel();
      });

      const collapseBtn = header.querySelector('.sessionflow-widget__collapse-btn');
      if (collapseBtn) header.insertBefore(libraryBtn, collapseBtn);
      else header.appendChild(libraryBtn);
    }

    if (!header.querySelector('.sessionflow-widget-faction__gear-btn')) {
      const gearBtn = document.createElement('button');
      gearBtn.type = 'button';
      gearBtn.className = 'sessionflow-widget-faction__gear-btn';
      gearBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionEditLevels');
      gearBtn.innerHTML = '<i class="fas fa-gear"></i>';
      gearBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#toggleLevelEditor();
      });

      const collapseBtn = header.querySelector('.sessionflow-widget__collapse-btn');
      if (collapseBtn) header.insertBefore(gearBtn, collapseBtn);
      else header.appendChild(gearBtn);
    }

    this.#updateHeaderButtonStates();
  }

  #updateHeaderButtonStates() {
    const libraryBtn = this.element?.querySelector('.sessionflow-widget-faction__library-btn');
    const gearBtn = this.element?.querySelector('.sessionflow-widget-faction__gear-btn');

    if (libraryBtn) {
      const isActive = this.#isLibraryPanelOpen || this.#isLinkedToLibrary();
      libraryBtn.classList.toggle('is-active', isActive);
      libraryBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    if (gearBtn) {
      gearBtn.classList.toggle('is-active', this.#isLevelEditorOpen);
      gearBtn.setAttribute('aria-pressed', this.#isLevelEditorOpen ? 'true' : 'false');
    }
  }

  /* ---------------------------------------- */
  /*  Dropdown                                */
  /* ---------------------------------------- */

  #attachDropdownCloseHandler(dropdown) {
    this.#detachDropdownCloseHandler();
    requestAnimationFrame(() => {
      this.#dropdownCloseHandler = (event) => {
        if (!dropdown.contains(event.target) && !event.target.closest('.sessionflow-widget-faction__add-btn')) {
          this.#closeDropdown();
        }
      };
      document.addEventListener('pointerdown', this.#dropdownCloseHandler, true);
    });
  }

  #detachDropdownCloseHandler() {
    if (!this.#dropdownCloseHandler) return;
    document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
    this.#dropdownCloseHandler = null;
  }

  #toggleDropdown() {
    this.#isDropdownOpen = !this.#isDropdownOpen;
    const dropdown = this.element?.querySelector('.sessionflow-widget-faction__dropdown');
    dropdown?.classList.toggle('is-visible', this.#isDropdownOpen);

    if (dropdown && this.#isDropdownOpen) this.#attachDropdownCloseHandler(dropdown);
    if (!this.#isDropdownOpen) this.#detachDropdownCloseHandler();
  }

  #closeDropdown() {
    this.#isDropdownOpen = false;
    const dropdown = this.element?.querySelector('.sessionflow-widget-faction__dropdown');
    dropdown?.classList.remove('is-visible');
    this.#detachDropdownCloseHandler();
  }

  /* ---------------------------------------- */
  /*  Level Editor                            */
  /* ---------------------------------------- */

  #toggleLevelEditor() {
    if (this.#isLevelEditorOpen) this.#closeLevelEditor();
    else this.#openLevelEditor();
  }

  #openLevelEditor() {
    this.#closeLibraryPanel();
    this.#isLevelEditorOpen = true;
    this.#rebuildLevelEditor();
    this.#updateHeaderButtonStates();
  }

  #closeLevelEditor() {
    this.#isLevelEditorOpen = false;
    this.element?.querySelector('.sessionflow-widget-faction__level-editor')?.remove();

    if (this.#levelEditorCloseHandler) {
      document.removeEventListener('pointerdown', this.#levelEditorCloseHandler, true);
      this.#levelEditorCloseHandler = null;
    }

    this.#updateHeaderButtonStates();
  }

  #rebuildLevelEditor() {
    if (!this.#isLevelEditorOpen) return;

    this.element?.querySelector('.sessionflow-widget-faction__level-editor')?.remove();
    if (this.#levelEditorCloseHandler) {
      document.removeEventListener('pointerdown', this.#levelEditorCloseHandler, true);
      this.#levelEditorCloseHandler = null;
    }

    const popover = document.createElement('div');
    popover.className = 'sessionflow-widget-faction__level-editor';
    this.#renderLevelEditorContent(popover);
    this.element?.appendChild(popover);

    requestAnimationFrame(() => {
      this.#levelEditorCloseHandler = (event) => {
        if (!popover.contains(event.target) && !event.target.closest('.sessionflow-widget-faction__gear-btn')) {
          this.#closeLevelEditor();
        }
      };
      document.addEventListener('pointerdown', this.#levelEditorCloseHandler, true);
    });
  }

  #renderLevelEditorContent(popover) {
    popover.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sessionflow-widget-faction__level-editor-title';
    title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionEditLevels');
    popover.appendChild(title);

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-faction__level-editor-list';

    const levels = cloneLevels(this.#getLevels());
    for (const [index, level] of levels.entries()) {
      const row = document.createElement('div');
      row.className = 'sessionflow-widget-faction__level-editor-row';

      const color = document.createElement('input');
      color.type = 'color';
      color.className = 'sessionflow-widget-faction__level-editor-color';
      color.value = normalizeHexColor(level.color, getSuggestedLevelColor(index, levels.length));
      color.addEventListener('input', (event) => {
        event.stopPropagation();
        this.#updateLevelDefinition(index, { color: color.value });
      });
      row.appendChild(color);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-faction__level-editor-input';
      input.value = level.label;
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionLevelPlaceholder');
      input.addEventListener('input', (event) => {
        event.stopPropagation();
        this.#updateLevelDefinition(index, { label: input.value.trim() });
      });
      row.appendChild(input);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sessionflow-widget-faction__level-editor-remove';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionRemoveLevel');
      removeBtn.innerHTML = '<i class="fas fa-minus"></i>';
      removeBtn.disabled = levels.length <= MIN_LEVEL_COUNT;
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#removeLevel(index);
      });
      row.appendChild(removeBtn);

      list.appendChild(row);
    }

    popover.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-widget-faction__level-editor-add';
    addBtn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.FactionAddLevel')}`;
    addBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#addLevel();
    });
    popover.appendChild(addBtn);
  }

  #updateLevelDefinition(index, changes) {
    const levels = cloneLevels(this.#getLevels());
    const current = levels[index];
    if (!current) return;

    levels[index] = {
      ...current,
      ...changes,
      label: typeof changes.label === 'string' ? changes.label : current.label,
      color: normalizeHexColor(changes.color, current.color)
    };

    this.updateConfig({ levels });
    this.#refreshVisibleMemberLevels();

    if (this.#levelSaveTimer) clearTimeout(this.#levelSaveTimer);
    this.#levelSaveTimer = setTimeout(() => {
      this.#levelSaveTimer = null;
      this.engine.scheduleSave();
      this.#queueLibrarySync();
      if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
    }, 350);
  }

  #addLevel() {
    const levels = cloneLevels(this.#getLevels());
    levels.push({
      label: '',
      color: getSuggestedLevelColor(levels.length, levels.length + 1)
    });

    this.updateConfig({ levels });
    this.engine.scheduleSave();
    this.#queueLibrarySync();
    this.#rerender();
  }

  #removeLevel(index) {
    const currentLevels = cloneLevels(this.#getLevels());
    if (currentLevels.length <= MIN_LEVEL_COUNT || !currentLevels[index]) return;

    const nextLevels = currentLevels.filter((_, levelIndex) => levelIndex !== index);
    const nextMaxLevel = nextLevels.length - 1;
    const members = cloneMembers(this.#getMembers()).map((member) => {
      let nextLevel = member.level;
      if (nextLevel > index) nextLevel -= 1;
      else if (nextLevel === index) nextLevel = Math.max(0, nextLevel - 1);
      return {
        ...member,
        level: clampLevel(nextLevel, nextMaxLevel, getDefaultLevelIndex(nextLevels.length))
      };
    });

    this.updateConfig({ levels: nextLevels, members });
    this.engine.scheduleSave();
    this.#queueLibrarySync();
    this.#rerender();
  }

  #refreshVisibleMemberLevels() {
    const rows = this.element?.querySelectorAll('.sessionflow-widget-faction__row');
    if (!rows?.length) return;

    const members = this.#getMembers();
    const levels = this.#getLevels();
    const maxLevel = Math.max(0, levels.length - 1);

    for (const row of rows) {
      const member = members.find((entry) => entry.id === row.dataset.memberId);
      if (!member) continue;

      const level = levels[clampLevel(member.level, maxLevel, this.#getDefaultLevel())];
      if (!level) continue;

      row.style.setProperty('--sf-faction-level-color', level.color);

      const dot = row.querySelector('.sessionflow-widget-faction__info-dot');
      if (dot) dot.hidden = !level.label;

      const label = row.querySelector('.sessionflow-widget-faction__level-label');
      if (label) {
        label.textContent = level.label;
        label.hidden = !level.label;
      }

      const fill = row.querySelector('.sessionflow-widget-faction__track-fill');
      if (fill) {
        fill.style.width = `${maxLevel > 0 ? (member.level / maxLevel) * 100 : 100}%`;
      }

      const slider = row.querySelector('.sessionflow-widget-faction__slider');
      if (slider) {
        slider.max = String(maxLevel);
        slider.value = String(clampLevel(member.level, maxLevel, this.#getDefaultLevel()));
        slider.disabled = !this.canEdit || maxLevel <= 0;
      }
    }
  }

  /* ---------------------------------------- */
  /*  Library Panel                           */
  /* ---------------------------------------- */

  #toggleLibraryPanel() {
    if (this.#isLibraryPanelOpen) this.#closeLibraryPanel();
    else this.#openLibraryPanel();
  }

  #openLibraryPanel() {
    this.#closeLevelEditor();
    this.#isLibraryPanelOpen = true;
    this.#rebuildLibraryPanel();
    this.#updateHeaderButtonStates();
  }

  #closeLibraryPanel() {
    this.#isLibraryPanelOpen = false;
    this.element?.querySelector('.sessionflow-widget-faction__library-panel')?.remove();

    if (this.#libraryPanelCloseHandler) {
      document.removeEventListener('pointerdown', this.#libraryPanelCloseHandler, true);
      this.#libraryPanelCloseHandler = null;
    }

    this.#updateHeaderButtonStates();
  }

  #rebuildLibraryPanel() {
    if (!this.#isLibraryPanelOpen) return;

    this.element?.querySelector('.sessionflow-widget-faction__library-panel')?.remove();
    if (this.#libraryPanelCloseHandler) {
      document.removeEventListener('pointerdown', this.#libraryPanelCloseHandler, true);
      this.#libraryPanelCloseHandler = null;
    }

    const panel = document.createElement('div');
    panel.className = 'sessionflow-widget-faction__library-panel';
    this.#renderLibraryPanelContent(panel);
    this.element?.appendChild(panel);

    requestAnimationFrame(() => {
      this.#libraryPanelCloseHandler = (event) => {
        if (!panel.contains(event.target) && !event.target.closest('.sessionflow-widget-faction__library-btn')) {
          this.#closeLibraryPanel();
        }
      };
      document.addEventListener('pointerdown', this.#libraryPanelCloseHandler, true);
    });
  }

  #renderLibraryPanelContent(panel) {
    panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sessionflow-widget-faction__library-title';
    title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionLibrary');
    panel.appendChild(title);

    const description = document.createElement('div');
    description.className = 'sessionflow-widget-faction__library-description';
    description.textContent = this.#getLibraryState().detail;
    panel.appendChild(description);

    const actions = document.createElement('div');
    actions.className = 'sessionflow-widget-faction__library-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sessionflow-widget-faction__library-action';
    saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.FactionLibrarySave')}`;
    saveBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await this.#saveCurrentToLibrary();
      if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
    });
    actions.appendChild(saveBtn);

    if (this.#isLinkedToLibrary()) {
      const unlinkBtn = document.createElement('button');
      unlinkBtn.type = 'button';
      unlinkBtn.className = 'sessionflow-widget-faction__library-action is-secondary';
      unlinkBtn.innerHTML = `<i class="fas fa-unlink"></i> ${game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryUnlink')}`;
      unlinkBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await this.#unlinkLibraryFaction();
        if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
      });
      actions.appendChild(unlinkBtn);
    }

    panel.appendChild(actions);

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-faction__library-list';

    const factions = this.#getSavedFactions();
    if (factions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-faction__library-empty';
      empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryNoSaved');
      list.appendChild(empty);
    } else {
      const currentId = this.#getFactionId();

      for (const faction of factions) {
        const item = document.createElement('div');
        item.className = 'sessionflow-widget-faction__library-item';
        if (faction.id === currentId) item.classList.add('is-current');

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'sessionflow-widget-faction__library-item-main';
        loadBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryLoad');
        loadBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          await this.#loadLibraryFaction(faction.id);
        });

        const preview = document.createElement('div');
        preview.className = 'sessionflow-widget-faction__library-preview';
        if (faction.image) {
          const img = document.createElement('img');
          img.src = faction.image;
          img.alt = faction.name || game.i18n.localize('SESSIONFLOW.Canvas.FactionNameDefault');
          preview.appendChild(img);
        } else {
          preview.innerHTML = '<i class="fas fa-shield-halved"></i>';
        }
        loadBtn.appendChild(preview);

        const copy = document.createElement('div');
        copy.className = 'sessionflow-widget-faction__library-copy';

        const name = document.createElement('div');
        name.className = 'sessionflow-widget-faction__library-name';
        name.textContent = faction.name.trim() || game.i18n.localize('SESSIONFLOW.Canvas.FactionNameDefault');
        copy.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'sessionflow-widget-faction__library-meta';
        meta.textContent = faction.id === currentId
          ? `${this.#getTrackedCountLabel(faction.members.length)} \u00B7 ${game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryCurrent')}`
          : this.#getTrackedCountLabel(faction.members.length);
        copy.appendChild(meta);

        loadBtn.appendChild(copy);
        item.appendChild(loadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'sessionflow-widget-faction__library-delete';
        deleteBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionLibraryDelete');
        deleteBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
        deleteBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          await this.#deleteLibraryFaction(faction.id);
          if (this.#isLibraryPanelOpen) this.#rebuildLibraryPanel();
        });
        item.appendChild(deleteBtn);

        list.appendChild(item);
      }
    }

    panel.appendChild(list);
  }

  /* ---------------------------------------- */
  /*  CRUD                                    */
  /* ---------------------------------------- */

  #addMember(characterId) {
    const members = cloneMembers(this.#getMembers());
    members.push({
      id: foundry.utils.randomID(),
      characterId,
      level: this.#getDefaultLevel(),
      note: ''
    });

    this.updateConfig({ members });
    this.#closeDropdown();
    this.engine.scheduleSave();
    this.#queueLibrarySync();
    this.#rerender();
  }

  #removeMember(memberId) {
    const members = this.#getMembers().filter((member) => member.id !== memberId);
    this.updateConfig({ members });
    this.engine.scheduleSave();
    this.#queueLibrarySync();
    this.#rerender();
  }

  #updateMemberLevel(memberId, level) {
    const members = cloneMembers(this.#getMembers());
    const member = members.find((entry) => entry.id === memberId);
    if (!member) return;

    member.level = clampLevel(level, this.#getMaxLevel(), this.#getDefaultLevel());
    this.updateConfig({ members });
    this.engine.scheduleSave();
    this.#queueLibrarySync();
  }

  /* ---------------------------------------- */
  /*  Note Editing                            */
  /* ---------------------------------------- */

  #onNoteInput(memberId, note) {
    const members = cloneMembers(this.#getMembers());
    const member = members.find((entry) => entry.id === memberId);
    if (!member) return;

    member.note = note;
    this.updateConfig({ members });

    if (this.#noteSaveTimer) clearTimeout(this.#noteSaveTimer);
    this.#noteSaveTimer = setTimeout(() => {
      this.#noteSaveTimer = null;
      this.engine.scheduleSave();
      this.#queueLibrarySync();
    }, 500);
  }

  #finishNoteEdit(memberId, note) {
    const members = cloneMembers(this.#getMembers());
    const member = members.find((entry) => entry.id === memberId);
    if (member) member.note = note.trim();

    this.updateConfig({ members });
    this.#editingNoteId = null;
    this.engine.scheduleSave();
    this.#queueLibrarySync();
    this.#rerender();
  }

  #cancelNoteEdit() {
    this.#editingNoteId = null;
    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  FilePicker                              */
  /* ---------------------------------------- */

  #openFilePicker() {
    const picker = new FilePicker({
      type: 'image',
      current: this.#getFactionImage(),
      callback: (path) => {
        this.updateConfig({ image: path });
        this.engine.scheduleSave();
        this.#queueLibrarySync();
        this.#rerender();
      }
    });
    picker.render(true);
  }

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  #rerender() {
    const title = this.element?.querySelector('.sessionflow-widget__title');
    if (title) title.textContent = this.getTitle();

    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  beforeSave() {
    this.#ensureConfigNormalized();

    if (this.#isEditingName) {
      const input = this.element?.querySelector('.sessionflow-widget-faction__banner-name-input');
      if (input) this.updateConfig({ name: input.value.trim() });
      this.#isEditingName = false;
    }

    if (this.#editingNoteId) {
      const input = this.element?.querySelector('.sessionflow-widget-faction__note-input');
      if (input) {
        const members = cloneMembers(this.#getMembers());
        const member = members.find((entry) => entry.id === this.#editingNoteId);
        if (member) member.note = input.value.trim();
        this.updateConfig({ members });
      }
      this.#editingNoteId = null;
    }

    if (this.#noteSaveTimer) {
      clearTimeout(this.#noteSaveTimer);
      this.#noteSaveTimer = null;
    }

    if (this.#levelSaveTimer) {
      clearTimeout(this.#levelSaveTimer);
      this.#levelSaveTimer = null;
    }

    if (this.#librarySyncTimer) {
      clearTimeout(this.#librarySyncTimer);
      this.#librarySyncTimer = null;
    }

    if (this.#isLinkedToLibrary() && this.#libraryHydrated) {
      void this.#syncLinkedFactionToLibrary();
    }
  }

  destroy(reason = 'dispose') {
    this.beforeSave();
    this.#closeDropdown();
    this.#closeLevelEditor();
    this.#closeLibraryPanel();
    super.destroy(reason);
  }
}

registerWidgetType(FactionWidget.TYPE, FactionWidget);
