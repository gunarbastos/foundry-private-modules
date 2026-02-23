/**
 * SessionFlow - Relationships Widget (Character Panel only)
 * Tracks sentiment between the panel's owner character and other characters
 * via a 13-level discrete slider (Nemesis → Bonded) with inline notes.
 * @module widgets/relationships-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

/* ---------------------------------------- */
/*  Constants                               */
/* ---------------------------------------- */

const SENTIMENT_LEVELS = [
  { level: 0,  label: 'SESSIONFLOW.Canvas.RelationshipsNemesis',       color: '#991b1b' },
  { level: 1,  label: 'SESSIONFLOW.Canvas.RelationshipsHostile',       color: '#ef4444' },
  { level: 2,  label: 'SESSIONFLOW.Canvas.RelationshipsAntagonistic',  color: '#ea580c' },
  { level: 3,  label: 'SESSIONFLOW.Canvas.RelationshipsUnfriendly',    color: '#f97316' },
  { level: 4,  label: 'SESSIONFLOW.Canvas.RelationshipsDistrustful',   color: '#d97706' },
  { level: 5,  label: 'SESSIONFLOW.Canvas.RelationshipsWary',          color: '#eab308' },
  { level: 6,  label: 'SESSIONFLOW.Canvas.RelationshipsNeutral',       color: '#9ca3af' },
  { level: 7,  label: 'SESSIONFLOW.Canvas.RelationshipsCordial',       color: '#84cc16' },
  { level: 8,  label: 'SESSIONFLOW.Canvas.RelationshipsAmiable',       color: '#4ade80' },
  { level: 9,  label: 'SESSIONFLOW.Canvas.RelationshipsFriendly',      color: '#22c55e' },
  { level: 10, label: 'SESSIONFLOW.Canvas.RelationshipsTrusted',       color: '#16a34a' },
  { level: 11, label: 'SESSIONFLOW.Canvas.RelationshipsDevoted',       color: '#15803d' },
  { level: 12, label: 'SESSIONFLOW.Canvas.RelationshipsBonded',        color: '#166534' }
];

const MAX_LEVEL = SENTIMENT_LEVELS.length - 1;
const DEFAULT_LEVEL = 6; // Neutral

export class RelationshipsWidget extends Widget {

  static TYPE = 'relationships';
  static LABEL = 'SESSIONFLOW.Canvas.Relationships';
  static ICON = 'fas fa-heart-pulse';
  static MIN_WIDTH = 280;
  static MIN_HEIGHT = 160;
  static DEFAULT_WIDTH = 360;
  static DEFAULT_HEIGHT = 320;

  /** @type {boolean} */
  #isDropdownOpen = false;

  /** @type {string|null} ID of relationship whose note is being edited */
  #editingNoteId = null;

  /** @type {number|null} Debounce timer for note saves */
  #noteSaveTimer = null;

  /* ---------------------------------------- */
  /*  Helpers                                 */
  /* ---------------------------------------- */

  /** @returns {{ id: string, characterId: string, level: number, note: string }[]} */
  #getRelationships() {
    return this.config.relationships ?? [];
  }

  #getSentiment(level) {
    return SENTIMENT_LEVELS[level] ?? SENTIMENT_LEVELS[2];
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

  /** @returns {string|null} Effective owner character ID (context or config fallback) */
  #getOwnerId() {
    return this.context.characterId ?? this.config.ownerCharacterId ?? null;
  }

  #getOwnerCharacter() {
    const id = this.#getOwnerId();
    return id ? this.#getExaltedCharacter(id) : null;
  }

  /** @returns {boolean} Whether the widget has a known owner */
  #hasOwner() {
    return !!this.#getOwnerId();
  }

  #escapeAttr(str) {
    return (str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Relationships');
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';
    this.#isDropdownOpen = false;

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-relationships';

    // Check Exalted Scenes availability
    if (!this.#isExaltedScenesAvailable()) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-puzzle-piece',
        game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsUnavailable')
      ));
      bodyEl.appendChild(container);
      return;
    }

    // If no owner character context, show owner picker
    if (!this.#hasOwner()) {
      this.#buildOwnerPicker(container);
      bodyEl.appendChild(container);
      return;
    }

    // Owner indicator (when owner was picked via config, not context)
    if (!this.context.characterId && this.config.ownerCharacterId) {
      this.#buildOwnerIndicator(container);
    }

    // Relationships list
    this.#buildRelationshipsList(container);

    // Add button (GM only)
    if (game.user.isGM) {
      this.#buildAddArea(container);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Owner Picker (Scene Panel context)      */
  /* ---------------------------------------- */

  #buildOwnerPicker(container) {
    const picker = document.createElement('div');
    picker.className = 'sessionflow-widget-relationships__owner-picker';

    const icon = document.createElement('i');
    icon.className = 'fas fa-user-circle';
    picker.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsSelectOwner');
    picker.appendChild(label);

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-relationships__owner-list';

    const allChars = this.#getAllExaltedCharacters();
    if (allChars.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-relationships__owner-empty';
      empty.textContent = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsUnavailable');
      list.appendChild(empty);
    } else {
      for (const ch of allChars) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-widget-relationships__owner-item';

        const portrait = document.createElement('div');
        portrait.className = 'sessionflow-widget-relationships__owner-portrait';
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
          this.updateConfig({ ownerCharacterId: ch.id });
          this.engine.scheduleSave();
          this.#rerender();
        });
        list.appendChild(item);
      }
    }

    picker.appendChild(list);
    container.appendChild(picker);
  }

  #buildOwnerIndicator(container) {
    const owner = this.#getOwnerCharacter();
    if (!owner) return;

    const indicator = document.createElement('div');
    indicator.className = 'sessionflow-widget-relationships__owner-indicator';

    const portrait = document.createElement('div');
    portrait.className = 'sessionflow-widget-relationships__owner-indicator-portrait';
    if (owner.image) {
      portrait.innerHTML = `<img src="${this.#escapeAttr(owner.image)}" alt="${this.#escapeAttr(owner.name)}" />`;
    } else {
      portrait.innerHTML = '<i class="fas fa-user"></i>';
    }
    indicator.appendChild(portrait);

    const label = document.createElement('span');
    label.textContent = owner.name;
    indicator.appendChild(label);

    if (game.user.isGM) {
      const changeBtn = document.createElement('button');
      changeBtn.type = 'button';
      changeBtn.className = 'sessionflow-widget-relationships__owner-change';
      changeBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsChangeOwner');
      changeBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
      changeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateConfig({ ownerCharacterId: null, relationships: [] });
        this.engine.scheduleSave();
        this.#rerender();
      });
      indicator.appendChild(changeBtn);
    }

    container.appendChild(indicator);
  }

  /* ---------------------------------------- */
  /*  Relationships List                      */
  /* ---------------------------------------- */

  #buildRelationshipsList(container) {
    const relationships = this.#getRelationships();

    const list = document.createElement('div');
    list.className = 'sessionflow-widget-relationships__list';

    if (relationships.length === 0) {
      list.appendChild(this.#buildEmptyState(
        'fas fa-heart-pulse',
        game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsEmpty'),
        game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsEmptySubtitle')
      ));
    } else {
      for (const rel of relationships) {
        list.appendChild(this.#buildRelationshipRow(rel));
      }
    }

    container.appendChild(list);
  }

  /* ---------------------------------------- */
  /*  Single Relationship Row                 */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, characterId: string, level: number, note: string }} rel
   * @returns {HTMLElement}
   */
  #buildRelationshipRow(rel) {
    const owner = this.#getOwnerCharacter();
    const other = this.#getExaltedCharacter(rel.characterId);
    const sentiment = this.#getSentiment(rel.level);

    const row = document.createElement('div');
    row.className = 'sessionflow-widget-relationships__row';
    row.dataset.relId = rel.id;
    row.style.setProperty('--sf-rel-color', sentiment.color);

    // Bar area: [owner portrait] — slider — [other portrait]
    const barArea = document.createElement('div');
    barArea.className = 'sessionflow-widget-relationships__bar-area';

    barArea.appendChild(this.#buildPortrait(owner, 'owner'));
    barArea.appendChild(this.#buildTrack(rel));
    barArea.appendChild(this.#buildPortrait(other, 'other'));

    row.appendChild(barArea);

    // Info line: name + level label
    const info = document.createElement('div');
    info.className = 'sessionflow-widget-relationships__info';

    const nameEl = document.createElement('span');
    nameEl.className = 'sessionflow-widget-relationships__name';
    nameEl.textContent = other?.name ?? 'Unknown';
    info.appendChild(nameEl);

    const dot = document.createElement('span');
    dot.className = 'sessionflow-widget-relationships__info-dot';
    dot.textContent = '\u00B7';
    info.appendChild(dot);

    const levelLabel = document.createElement('span');
    levelLabel.className = 'sessionflow-widget-relationships__level-label';
    levelLabel.textContent = game.i18n.localize(sentiment.label);
    info.appendChild(levelLabel);

    row.appendChild(info);

    // Note area
    row.appendChild(this.#buildNoteArea(rel));

    // Delete button (GM only)
    if (game.user.isGM) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'sessionflow-widget-relationships__delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#deleteRelationship(rel.id);
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
   * @param {'owner'|'other'} role
   * @returns {HTMLElement}
   */
  #buildPortrait(character, role) {
    const portrait = document.createElement('div');
    portrait.className = `sessionflow-widget-relationships__${role}-portrait`;

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
   * @param {{ id: string, level: number }} rel
   * @returns {HTMLElement}
   */
  #buildTrack(rel) {
    const track = document.createElement('div');
    track.className = 'sessionflow-widget-relationships__track';

    // Fill bar (width based on level)
    const fill = document.createElement('div');
    fill.className = 'sessionflow-widget-relationships__track-fill';
    fill.style.width = `${(rel.level / MAX_LEVEL) * 100}%`;
    track.appendChild(fill);

    // Range slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sessionflow-widget-relationships__slider';
    slider.min = '0';
    slider.max = String(MAX_LEVEL);
    slider.step = '1';
    slider.value = String(rel.level);

    // Instant visual feedback on input (no re-render)
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      const newLevel = parseInt(e.target.value);
      const newSentiment = this.#getSentiment(newLevel);

      const row = e.target.closest('.sessionflow-widget-relationships__row');
      if (!row) return;

      // Update CSS variable for instant color change
      row.style.setProperty('--sf-rel-color', newSentiment.color);

      // Update track fill width
      const fillEl = row.querySelector('.sessionflow-widget-relationships__track-fill');
      if (fillEl) fillEl.style.width = `${(newLevel / MAX_LEVEL) * 100}%`;

      // Update level label
      const labelEl = row.querySelector('.sessionflow-widget-relationships__level-label');
      if (labelEl) labelEl.textContent = game.i18n.localize(newSentiment.label);
    });

    // Persist on change (release)
    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      const newLevel = parseInt(e.target.value);
      this.#updateLevel(rel.id, newLevel);
    });

    track.appendChild(slider);
    return track;
  }

  /* ---------------------------------------- */
  /*  Note Area                               */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, note: string }} rel
   * @returns {HTMLElement}
   */
  #buildNoteArea(rel) {
    const noteArea = document.createElement('div');
    noteArea.className = 'sessionflow-widget-relationships__note-area';

    if (this.#editingNoteId === rel.id) {
      // Inline edit input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sessionflow-widget-relationships__note-input';
      input.value = rel.note ?? '';
      input.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsNotePlaceholder');

      input.addEventListener('input', (e) => {
        e.stopPropagation();
        this.#onNoteInput(rel.id, e.target.value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#finishNoteEdit(rel.id, e.target.value);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.#cancelNoteEdit();
        }
      });

      input.addEventListener('blur', (e) => {
        // Small delay to allow click-away detection
        setTimeout(() => {
          if (this.#editingNoteId === rel.id) {
            this.#finishNoteEdit(rel.id, e.target.value);
          }
        }, 100);
      });

      noteArea.appendChild(input);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      // Display span (click to edit)
      const noteSpan = document.createElement('span');
      noteSpan.className = 'sessionflow-widget-relationships__note';
      noteSpan.dataset.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsNotePlaceholder');
      noteSpan.textContent = rel.note ?? '';

      if (game.user.isGM) {
        noteSpan.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#startNoteEdit(rel.id);
        });
      }

      noteArea.appendChild(noteSpan);
    }

    return noteArea;
  }

  /* ---------------------------------------- */
  /*  Add Area (dropdown)                     */
  /* ---------------------------------------- */

  #buildAddArea(container) {
    const addArea = document.createElement('div');
    addArea.className = 'sessionflow-widget-relationships__add-area';

    // Add button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sessionflow-widget-relationships__add-btn';
    addBtn.innerHTML = `<i class="fas fa-plus"></i><span>${game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsAdd')}</span>`;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleDropdown();
    });
    addArea.appendChild(addBtn);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-relationships__dropdown';

    // Get available characters (exclude self + already added)
    const existingIds = new Set(this.#getRelationships().map(r => r.characterId));
    const ownerId = this.#getOwnerId();
    if (ownerId) existingIds.add(ownerId); // exclude self
    const allChars = this.#getAllExaltedCharacters();
    const available = allChars.filter(ch => !existingIds.has(ch.id));

    if (available.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'sessionflow-widget-relationships__dropdown-empty';
      emptyItem.textContent = game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsEmpty');
      dropdown.appendChild(emptyItem);
    } else {
      for (const ch of available) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-widget-relationships__dropdown-item';
        item.dataset.characterId = ch.id;

        const portrait = document.createElement('div');
        portrait.className = 'sessionflow-widget-relationships__dropdown-portrait';
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
          this.#addRelationship(ch.id);
        });
        dropdown.appendChild(item);
      }
    }

    addArea.appendChild(dropdown);
    container.appendChild(addArea);
  }

  /* ---------------------------------------- */
  /*  Dropdown Toggle                         */
  /* ---------------------------------------- */

  #toggleDropdown() {
    this.#isDropdownOpen = !this.#isDropdownOpen;
    const dropdown = this.element?.querySelector('.sessionflow-widget-relationships__dropdown');
    dropdown?.classList.toggle('is-visible', this.#isDropdownOpen);
  }

  /* ---------------------------------------- */
  /*  CRUD                                    */
  /* ---------------------------------------- */

  #addRelationship(characterId) {
    const relationships = [...this.#getRelationships()];
    relationships.push({
      id: foundry.utils.randomID(),
      characterId,
      level: DEFAULT_LEVEL,
      note: ''
    });
    this.updateConfig({ relationships });
    this.engine.scheduleSave();
    this.#rerender();
  }

  #deleteRelationship(relId) {
    Dialog.confirm({
      title: game.i18n.localize('SESSIONFLOW.Canvas.Relationships'),
      content: `<p>${game.i18n.localize('SESSIONFLOW.Canvas.RelationshipsConfirmDelete')}</p>`,
      yes: () => {
        const relationships = this.#getRelationships().filter(r => r.id !== relId);
        this.updateConfig({ relationships });
        this.engine.scheduleSave();
        this.#rerender();
      }
    });
  }

  #updateLevel(relId, level) {
    const relationships = [...this.#getRelationships()];
    const rel = relationships.find(r => r.id === relId);
    if (!rel) return;
    rel.level = level;
    this.updateConfig({ relationships });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Note Editing                            */
  /* ---------------------------------------- */

  #startNoteEdit(relId) {
    this.#editingNoteId = relId;
    this.#rerender();
  }

  #onNoteInput(relId, text) {
    // Update config immediately (in memory)
    const relationships = [...this.#getRelationships()];
    const rel = relationships.find(r => r.id === relId);
    if (rel) rel.note = text;
    this.updateConfig({ relationships });

    // Debounced save
    if (this.#noteSaveTimer) clearTimeout(this.#noteSaveTimer);
    this.#noteSaveTimer = setTimeout(() => {
      this.engine.scheduleSave();
      this.#noteSaveTimer = null;
    }, 500);
  }

  #finishNoteEdit(relId, text) {
    const relationships = [...this.#getRelationships()];
    const rel = relationships.find(r => r.id === relId);
    if (rel) rel.note = text.trim();
    this.updateConfig({ relationships });
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
    empty.className = 'sessionflow-widget-relationships__empty';
    empty.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
    if (subtitle) {
      const sub = document.createElement('span');
      sub.className = 'sessionflow-widget-relationships__empty-subtitle';
      sub.textContent = subtitle;
      empty.appendChild(sub);
    }
    return empty;
  }

  /* ---------------------------------------- */
  /*  Re-render Helper                        */
  /* ---------------------------------------- */

  #rerender() {
    const body = this.element?.querySelector('.sessionflow-widget__body');
    if (body) this.renderBody(body);
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  /** @override */
  beforeSave() {
    // Snapshot any active note input
    if (this.#editingNoteId) {
      const input = this.element?.querySelector('.sessionflow-widget-relationships__note-input');
      if (input) {
        const relationships = [...this.#getRelationships()];
        const rel = relationships.find(r => r.id === this.#editingNoteId);
        if (rel) rel.note = input.value.trim();
        this.updateConfig({ relationships });
      }
    }
  }

  /** @override */
  destroy() {
    if (this.#noteSaveTimer) {
      clearTimeout(this.#noteSaveTimer);
      this.#noteSaveTimer = null;
    }
    super.destroy();
  }
}

// Self-register
registerWidgetType(RelationshipsWidget.TYPE, RelationshipsWidget);
