/**
 * SessionFlow - Faction Reputation Widget (Premium Redesign)
 * Tracks character reputation within a specific faction/organization.
 * Each widget instance = one faction. Characters come from Exalted Scenes.
 * Features: faction banner with image, per-character slider, editable level labels.
 * @module widgets/faction-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

/* ---------------------------------------- */
/*  Reputation Levels                       */
/* ---------------------------------------- */

const REPUTATION_LEVELS = [
  { level: 0,  key: 'SESSIONFLOW.Canvas.FactionLevelHunted',       fallback: 'Hunted',       color: '#991b1b' },
  { level: 1,  key: 'SESSIONFLOW.Canvas.FactionLevelHostile',      fallback: 'Hostile',      color: '#ef4444' },
  { level: 2,  key: 'SESSIONFLOW.Canvas.FactionLevelAntagonistic', fallback: 'Antagonistic', color: '#ea580c' },
  { level: 3,  key: 'SESSIONFLOW.Canvas.FactionLevelUnfriendly',   fallback: 'Unfriendly',   color: '#f97316' },
  { level: 4,  key: 'SESSIONFLOW.Canvas.FactionLevelSuspicious',   fallback: 'Suspicious',   color: '#d97706' },
  { level: 5,  key: 'SESSIONFLOW.Canvas.FactionLevelWary',         fallback: 'Wary',         color: '#eab308' },
  { level: 6,  key: 'SESSIONFLOW.Canvas.FactionLevelNeutral',      fallback: 'Neutral',      color: '#9ca3af' },
  { level: 7,  key: 'SESSIONFLOW.Canvas.FactionLevelTolerated',    fallback: 'Tolerated',    color: '#84cc16' },
  { level: 8,  key: 'SESSIONFLOW.Canvas.FactionLevelAccepted',     fallback: 'Accepted',     color: '#4ade80' },
  { level: 9,  key: 'SESSIONFLOW.Canvas.FactionLevelFriendly',     fallback: 'Friendly',     color: '#22c55e' },
  { level: 10, key: 'SESSIONFLOW.Canvas.FactionLevelHonored',      fallback: 'Honored',      color: '#16a34a' },
  { level: 11, key: 'SESSIONFLOW.Canvas.FactionLevelRevered',      fallback: 'Revered',      color: '#15803d' },
  { level: 12, key: 'SESSIONFLOW.Canvas.FactionLevelExalted',      fallback: 'Exalted',      color: '#166534' }
];

const MAX_LEVEL = REPUTATION_LEVELS.length - 1;
const DEFAULT_LEVEL = 6; // Neutral

export class FactionWidget extends Widget {

  static TYPE = 'faction';
  static LABEL = 'SESSIONFLOW.Canvas.Faction';
  static ICON = 'fas fa-flag';
  static MIN_WIDTH = 300;
  static MIN_HEIGHT = 200;
  static DEFAULT_WIDTH = 360;
  static DEFAULT_HEIGHT = 380;

  /** @type {boolean} */
  #isDropdownOpen = false;

  /** @type {boolean} */
  #isEditingName = false;

  /** @type {string|null} ID of member whose note is being edited */
  #editingNoteId = null;

  /** @type {number|null} Debounce timer for note saves */
  #noteSaveTimer = null;

  /** @type {boolean} */
  #isLevelEditorOpen = false;

  /** @type {number|null} Debounce timer for level label saves */
  #levelSaveTimer = null;

  /** @type {Function|null} Click-outside handler for level editor */
  #levelEditorCloseHandler = null;

  /** @type {Function|null} Click-outside handler for dropdown */
  #dropdownCloseHandler = null;

  /* ---------------------------------------- */
  /*  Config Helpers                          */
  /* ---------------------------------------- */

  /** @returns {string} */
  #getFactionName() {
    return this.config.factionName || game.i18n.localize('SESSIONFLOW.Canvas.FactionNameDefault');
  }

  /** @returns {string} */
  #getFactionImage() {
    return this.config.factionImage || '';
  }

  /** @returns {{ id: string, characterId: string, level: number, note: string }[]} */
  #getMembers() {
    return this.config.members ?? [];
  }

  /**
   * Get the label for a reputation level.
   * Checks custom labels first, then falls back to i18n defaults.
   * @param {number} level
   * @returns {string}
   */
  #getLevelLabel(level) {
    const customLevels = this.config.levels ?? {};
    if (customLevels[String(level)]) return customLevels[String(level)];
    const rep = REPUTATION_LEVELS[level];
    if (!rep) return String(level);
    return game.i18n.localize(rep.key) || rep.fallback;
  }

  /**
   * Get the color for a reputation level.
   * @param {number} level
   * @returns {string}
   */
  #getLevelColor(level) {
    return REPUTATION_LEVELS[level]?.color ?? '#9ca3af';
  }

  #escapeAttr(str) {
    return (str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      return api.characters.getAll() ?? [];
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

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return this.#getFactionName();
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';
    this.#isDropdownOpen = false;

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-faction';

    // Check Exalted Scenes availability
    if (!this.#isExaltedScenesAvailable()) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-puzzle-piece',
        game.i18n.localize('SESSIONFLOW.Canvas.FactionUnavailable')
      ));
      bodyEl.appendChild(container);
      return;
    }

    // Faction banner
    this.#buildBanner(container);

    // Members list
    this.#buildMembersList(container);

    // Add member (GM only)
    if (game.user.isGM) {
      this.#buildAddArea(container);
    }

    bodyEl.appendChild(container);

    // Inject gear button into widget header (for level editor)
    this.#injectGearButton();
  }

  /* ---------------------------------------- */
  /*  Faction Banner                          */
  /* ---------------------------------------- */

  #buildBanner(container) {
    const banner = document.createElement('div');
    banner.className = 'sessionflow-widget-faction__banner';

    const image = this.#getFactionImage();

    if (image) {
      const img = document.createElement('img');
      img.className = 'sessionflow-widget-faction__banner-img';
      img.src = image;
      img.alt = this.#escapeAttr(this.#getFactionName());
      banner.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'sessionflow-widget-faction__banner-placeholder';
      placeholder.innerHTML = `<i class="fas fa-flag"></i>`;
      if (game.user.isGM) {
        const hint = document.createElement('span');
        hint.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionImagePrompt');
        placeholder.appendChild(hint);
      }
      banner.appendChild(placeholder);
    }

    // Dark gradient overlay for text
    const overlay = document.createElement('div');
    overlay.className = 'sessionflow-widget-faction__banner-overlay';
    banner.appendChild(overlay);

    // Faction name on banner
    if (this.#isEditingName && game.user.isGM) {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'sessionflow-widget-faction__banner-name-input';
      nameInput.value = this.config.factionName || '';
      nameInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNamePlaceholder');

      const saveName = () => {
        const name = nameInput.value.trim() || '';
        this.updateConfig({ factionName: name });
        this.engine.scheduleSave();
        this.#isEditingName = false;
        this.#rerender();
        // Update widget header title
        this.#updateHeaderTitle();
      };

      nameInput.addEventListener('blur', saveName);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveName(); }
        if (e.key === 'Escape') { e.preventDefault(); this.#isEditingName = false; this.#rerender(); }
      });

      overlay.appendChild(nameInput);
      requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });
    } else {
      const nameEl = document.createElement('span');
      nameEl.className = 'sessionflow-widget-faction__banner-name';
      nameEl.textContent = this.#getFactionName();
      if (game.user.isGM) {
        nameEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#isEditingName = true;
          this.#rerender();
        });
      }
      overlay.appendChild(nameEl);
    }

    // Click banner image area to pick new image (GM only)
    if (game.user.isGM) {
      banner.addEventListener('click', (e) => {
        // Don't trigger if clicking the name or input
        if (e.target.closest('.sessionflow-widget-faction__banner-name, .sessionflow-widget-faction__banner-name-input')) return;
        e.stopPropagation();
        this.#openFilePicker();
      });
    }

    container.appendChild(banner);
  }

  /* ---------------------------------------- */
  /*  Members List                            */
  /* ---------------------------------------- */

  #buildMembersList(container) {
    const members = this.#getMembers();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-faction__list';

    if (members.length === 0) {
      list.appendChild(this.#buildEmptyState(
        'fas fa-users',
        game.i18n.localize('SESSIONFLOW.Canvas.FactionEmpty'),
        game.i18n.localize('SESSIONFLOW.Canvas.FactionEmptySubtitle')
      ));
    } else {
      for (const member of members) {
        list.appendChild(this.#buildMemberRow(member));
      }
    }

    container.appendChild(list);
  }

  /* ---------------------------------------- */
  /*  Single Member Row                       */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, characterId: string, level: number, note: string }} member
   * @returns {HTMLElement}
   */
  #buildMemberRow(member) {
    const character = this.#getExaltedCharacter(member.characterId);
    const levelColor = this.#getLevelColor(member.level);

    const row = document.createElement('div');
    row.className = 'sessionflow-widget-faction__row';
    row.dataset.memberId = member.id;
    row.style.setProperty('--sf-faction-level-color', levelColor);

    // Bar area: [portrait] — slider track
    const barArea = document.createElement('div');
    barArea.className = 'sessionflow-widget-faction__bar-area';

    barArea.appendChild(this.#buildPortrait(character));
    barArea.appendChild(this.#buildTrack(member));

    row.appendChild(barArea);

    // Info line: name · level label
    const info = document.createElement('div');
    info.className = 'sessionflow-widget-faction__info';

    const nameEl = document.createElement('span');
    nameEl.className = 'sessionflow-widget-faction__member-name';
    nameEl.textContent = character?.name ?? 'Unknown';
    info.appendChild(nameEl);

    const dot = document.createElement('span');
    dot.className = 'sessionflow-widget-faction__info-dot';
    dot.textContent = '\u00B7';
    info.appendChild(dot);

    const levelLabel = document.createElement('span');
    levelLabel.className = 'sessionflow-widget-faction__level-label';
    levelLabel.textContent = this.#getLevelLabel(member.level);
    info.appendChild(levelLabel);

    row.appendChild(info);

    // Note area
    row.appendChild(this.#buildNoteArea(member));

    // Delete button (GM only)
    if (game.user.isGM) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sessionflow-widget-faction__delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#deleteMember(member.id);
      });
      row.appendChild(deleteBtn);
    }

    return row;
  }

  /* ---------------------------------------- */
  /*  Portrait                                */
  /* ---------------------------------------- */

  /**
   * @param {object|null} character
   * @returns {HTMLElement}
   */
  #buildPortrait(character) {
    const portrait = document.createElement('div');
    portrait.className = 'sessionflow-widget-faction__portrait';

    if (character?.image) {
      const img = document.createElement('img');
      img.src = character.image;
      img.alt = this.#escapeAttr(character.name ?? '');
      portrait.appendChild(img);
    } else {
      const icon = document.createElement('i');
      icon.className = character ? 'fas fa-user' : 'fas fa-user-slash';
      portrait.appendChild(icon);
    }

    return portrait;
  }

  /* ---------------------------------------- */
  /*  Track + Slider                          */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, level: number }} member
   * @returns {HTMLElement}
   */
  #buildTrack(member) {
    const track = document.createElement('div');
    track.className = 'sessionflow-widget-faction__track';

    // Fill bar
    const fill = document.createElement('div');
    fill.className = 'sessionflow-widget-faction__track-fill';
    fill.style.width = `${(member.level / MAX_LEVEL) * 100}%`;
    track.appendChild(fill);

    // Range slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-faction__slider';
    slider.min = '0';
    slider.max = String(MAX_LEVEL);
    slider.step = '1';
    slider.value = String(member.level);
    if (!game.user.isGM) slider.disabled = true;

    // Instant visual feedback on input
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      const newLevel = parseInt(e.target.value);
      const newColor = this.#getLevelColor(newLevel);

      const row = e.target.closest('.sessionflow-widget-faction__row');
      if (!row) return;

      row.style.setProperty('--sf-faction-level-color', newColor);

      const fillEl = row.querySelector('.sessionflow-widget-faction__track-fill');
      if (fillEl) fillEl.style.width = `${(newLevel / MAX_LEVEL) * 100}%`;

      const labelEl = row.querySelector('.sessionflow-widget-faction__level-label');
      if (labelEl) labelEl.textContent = this.#getLevelLabel(newLevel);
    });

    // Persist on change
    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      this.#updateLevel(member.id, parseInt(e.target.value));
    });

    track.appendChild(slider);
    return track;
  }

  /* ---------------------------------------- */
  /*  Note Area                               */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, note: string }} member
   * @returns {HTMLElement}
   */
  #buildNoteArea(member) {
    const noteArea = document.createElement('div');
    noteArea.className = 'sessionflow-widget-faction__note-area';

    if (this.#editingNoteId === member.id) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-faction__note-input';
      input.value = member.note ?? '';
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNotePlaceholder');

      input.addEventListener('input', (e) => {
        e.stopPropagation();
        this.#onNoteInput(member.id, e.target.value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.#finishNoteEdit(member.id, e.target.value); }
        if (e.key === 'Escape') { e.preventDefault(); this.#cancelNoteEdit(); }
      });

      input.addEventListener('blur', (e) => {
        setTimeout(() => {
          if (this.#editingNoteId === member.id) {
            this.#finishNoteEdit(member.id, e.target.value);
          }
        }, 100);
      });

      noteArea.appendChild(input);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'sessionflow-widget-faction__note';
      noteSpan.dataset.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.FactionNotePlaceholder');
      noteSpan.textContent = member.note ?? '';

      if (game.user.isGM) {
        noteSpan.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#startNoteEdit(member.id);
        });
      }

      noteArea.appendChild(noteSpan);
    }

    return noteArea;
  }

  /* ---------------------------------------- */
  /*  Add Area (Dropdown)                     */
  /* ---------------------------------------- */

  #buildAddArea(container) {
    const addArea = document.createElement('div');
    addArea.className = 'sessionflow-widget-faction__add-area';

    // Add button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-widget-faction__add-btn';
    addBtn.innerHTML = `<i class="fas fa-plus"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.FactionAddMember')}</span>`;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleDropdown();
    });
    addArea.appendChild(addBtn);

    // Dropdown list
    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-faction__dropdown';

    // Exclude already-added characters
    const existingIds = new Set(this.#getMembers().map(m => m.characterId));
    const allChars = this.#getAllExaltedCharacters();
    const available = allChars.filter(ch => !existingIds.has(ch.id));

    if (available.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'sessionflow-widget-faction__dropdown-empty';
      emptyItem.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionNoCharacters');
      dropdown.appendChild(emptyItem);
    } else {
      for (const ch of available) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-widget-faction__dropdown-item';
        item.dataset.characterId = ch.id;

        const portrait = document.createElement('div');
        portrait.className = 'sessionflow-widget-faction__dropdown-portrait';
        if (ch.image) {
          portrait.innerHTML = `<img src="${this.#escapeAttr(ch.image)}" alt="${this.#escapeAttr(ch.name)}" />`;
        } else {
          portrait.innerHTML = '<i class="fas fa-user"></i>';
        }
        item.appendChild(portrait);

        const name = document.createElement('span');
        name.textContent = ch.name;
        item.appendChild(name);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#addMember(ch.id);
        });
        dropdown.appendChild(item);
      }
    }

    addArea.appendChild(dropdown);
    container.appendChild(addArea);
  }

  /* ---------------------------------------- */
  /*  Gear Button (Level Editor)              */
  /* ---------------------------------------- */

  /**
   * Injects a gear button into the widget header for the level editor.
   * Called after renderBody since the header is built by the base Widget class.
   */
  #injectGearButton() {
    if (!game.user.isGM) return;
    const header = this.element?.querySelector('.sessionflow-widget__header');
    if (!header) return;

    // Don't duplicate
    if (header.querySelector('.sessionflow-widget-faction__gear-btn')) return;

    const gearBtn = document.createElement('button');
    gearBtn.type = 'button';
    gearBtn.className = 'sessionflow-widget-faction__gear-btn';
    gearBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.FactionEditLevels');
    gearBtn.innerHTML = '<i class="fas fa-gear"></i>';
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleLevelEditor();
    });

    // Insert before the collapse button
    const collapseBtn = header.querySelector('.sessionflow-widget__collapse-btn');
    if (collapseBtn) {
      header.insertBefore(gearBtn, collapseBtn);
    } else {
      header.appendChild(gearBtn);
    }
  }

  /* ---------------------------------------- */
  /*  Level Editor Popover                    */
  /* ---------------------------------------- */

  #toggleLevelEditor() {
    if (this.#isLevelEditorOpen) {
      this.#closeLevelEditor();
    } else {
      this.#openLevelEditor();
    }
  }

  #openLevelEditor() {
    // Close any existing
    this.#closeLevelEditor();

    this.#isLevelEditorOpen = true;

    const popover = document.createElement('div');
    popover.className = 'sessionflow-widget-faction__level-editor';

    const title = document.createElement('div');
    title.className = 'sessionflow-widget-faction__level-editor-title';
    title.textContent = game.i18n.localize('SESSIONFLOW.Canvas.FactionEditLevels');
    popover.appendChild(title);

    const levelsList = document.createElement('div');
    levelsList.className = 'sessionflow-widget-faction__level-editor-list';

    for (const rep of REPUTATION_LEVELS) {
      const row = document.createElement('div');
      row.className = 'sessionflow-widget-faction__level-editor-row';

      const colorDot = document.createElement('span');
      colorDot.className = 'sessionflow-widget-faction__level-editor-dot';
      colorDot.style.backgroundColor = rep.color;
      row.appendChild(colorDot);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-faction__level-editor-input';
      input.value = this.#getLevelLabel(rep.level);
      input.dataset.level = String(rep.level);

      input.addEventListener('input', (e) => {
        e.stopPropagation();
        this.#onLevelLabelInput(rep.level, e.target.value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.#closeLevelEditor();
        }
      });

      row.appendChild(input);
      levelsList.appendChild(row);
    }

    popover.appendChild(levelsList);

    // Append to the widget element (positioned absolute)
    this.element?.appendChild(popover);

    // Close on click outside (delay to avoid immediate close)
    requestAnimationFrame(() => {
      this.#levelEditorCloseHandler = (e) => {
        if (!popover.contains(e.target) && !e.target.closest('.sessionflow-widget-faction__gear-btn')) {
          this.#closeLevelEditor();
        }
      };
      document.addEventListener('pointerdown', this.#levelEditorCloseHandler, true);
    });
  }

  #closeLevelEditor() {
    this.#isLevelEditorOpen = false;
    const popover = this.element?.querySelector('.sessionflow-widget-faction__level-editor');
    popover?.remove();

    if (this.#levelEditorCloseHandler) {
      document.removeEventListener('pointerdown', this.#levelEditorCloseHandler, true);
      this.#levelEditorCloseHandler = null;
    }

    // Flush any pending level label save
    if (this.#levelSaveTimer) {
      clearTimeout(this.#levelSaveTimer);
      this.#levelSaveTimer = null;
      this.engine.scheduleSave();
    }

    // Re-render to update any level labels that changed
    this.#rerender();
  }

  #onLevelLabelInput(level, text) {
    const levels = { ...(this.config.levels ?? {}) };
    const trimmed = text.trim();

    if (trimmed) {
      levels[String(level)] = trimmed;
    } else {
      delete levels[String(level)]; // Fall back to i18n default
    }

    this.updateConfig({ levels });

    // Debounced save
    if (this.#levelSaveTimer) clearTimeout(this.#levelSaveTimer);
    this.#levelSaveTimer = setTimeout(() => {
      this.engine.scheduleSave();
      this.#levelSaveTimer = null;
    }, 500);
  }

  /* ---------------------------------------- */
  /*  Dropdown Toggle                         */
  /* ---------------------------------------- */

  #toggleDropdown() {
    this.#isDropdownOpen = !this.#isDropdownOpen;
    const dropdown = this.element?.querySelector('.sessionflow-widget-faction__dropdown');
    dropdown?.classList.toggle('is-visible', this.#isDropdownOpen);

    if (this.#isDropdownOpen) {
      // Close on click outside
      requestAnimationFrame(() => {
        this.#dropdownCloseHandler = (e) => {
          if (!e.target.closest('.sessionflow-widget-faction__dropdown, .sessionflow-widget-faction__add-btn')) {
            this.#isDropdownOpen = false;
            dropdown?.classList.remove('is-visible');
            document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
            this.#dropdownCloseHandler = null;
          }
        };
        document.addEventListener('pointerdown', this.#dropdownCloseHandler, true);
      });
    } else if (this.#dropdownCloseHandler) {
      document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
      this.#dropdownCloseHandler = null;
    }
  }

  /* ---------------------------------------- */
  /*  FilePicker                              */
  /* ---------------------------------------- */

  #openFilePicker() {
    const fp = new FilePicker({
      type: 'image',
      current: this.config.factionImage || '',
      callback: (path) => {
        this.updateConfig({ factionImage: path });
        this.engine.scheduleSave();
        this.#rerender();
      }
    });
    fp.render(true);
  }

  /* ---------------------------------------- */
  /*  CRUD                                    */
  /* ---------------------------------------- */

  #addMember(characterId) {
    const members = [...this.#getMembers()];
    members.push({
      id: foundry.utils.randomID(),
      characterId,
      level: DEFAULT_LEVEL,
      note: ''
    });
    this.updateConfig({ members });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #deleteMember(memberId) {
    const members = this.#getMembers().filter(m => m.id !== memberId);
    this.updateConfig({ members });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #updateLevel(memberId, level) {
    const members = [...this.#getMembers()];
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    member.level = level;
    this.updateConfig({ members });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Note Editing                            */
  /* ---------------------------------------- */

  #startNoteEdit(memberId) {
    this.#editingNoteId = memberId;
    this.#rerender();
  }

  #onNoteInput(memberId, text) {
    const members = [...this.#getMembers()];
    const member = members.find(m => m.id === memberId);
    if (member) member.note = text;
    this.updateConfig({ members });

    if (this.#noteSaveTimer) clearTimeout(this.#noteSaveTimer);
    this.#noteSaveTimer = setTimeout(() => {
      this.engine.scheduleSave();
      this.#noteSaveTimer = null;
    }, 500);
  }

  #finishNoteEdit(memberId, text) {
    const members = [...this.#getMembers()];
    const member = members.find(m => m.id === memberId);
    if (member) member.note = text.trim();
    this.updateConfig({ members });
    this.engine.scheduleSave();
    this.#editingNoteId = null;
    this.#rerender();
  }

  #cancelNoteEdit() {
    this.#editingNoteId = null;
    this.#rerender();
  }

  /* ---------------------------------------- */
  /*  Empty State                             */
  /* ---------------------------------------- */

  /**
   * @param {string} iconClass
   * @param {string} text
   * @param {string} [subtitle]
   * @returns {HTMLElement}
   */
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
  /*  Helpers                                 */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  #updateHeaderTitle() {
    const titleEl = this.element?.querySelector('.sessionflow-widget__title');
    if (titleEl) titleEl.textContent = this.getTitle();
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    if (this.#editingNoteId) {
      const input = this.element?.querySelector('.sessionflow-widget-faction__note-input');
      if (input) {
        const members = [...this.#getMembers()];
        const member = members.find(m => m.id === this.#editingNoteId);
        if (member) member.note = input.value.trim();
        this.updateConfig({ members });
      }
    }
  }

  /** @override */
  destroy() {
    if (this.#noteSaveTimer) {
      clearTimeout(this.#noteSaveTimer);
      this.#noteSaveTimer = null;
    }
    if (this.#levelSaveTimer) {
      clearTimeout(this.#levelSaveTimer);
      this.#levelSaveTimer = null;
    }
    if (this.#levelEditorCloseHandler) {
      document.removeEventListener('pointerdown', this.#levelEditorCloseHandler, true);
      this.#levelEditorCloseHandler = null;
    }
    if (this.#dropdownCloseHandler) {
      document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
      this.#dropdownCloseHandler = null;
    }
    super.destroy();
  }
}

// Self-register
registerWidgetType(FactionWidget.TYPE, FactionWidget);
