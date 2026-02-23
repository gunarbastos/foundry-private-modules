/**
 * SessionFlow - Journal Board Widget
 * A curated board of Foundry Journal Entries for quick access and player sharing.
 * Features: list/card view, browsable journal picker with folder grouping, excerpts.
 * @module widgets/journal-board-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

export class JournalBoardWidget extends Widget {

  static TYPE = 'journal-board';
  static LABEL = 'SESSIONFLOW.Canvas.JournalBoard';
  static ICON = 'fas fa-book-atlas';
  static MIN_WIDTH = 280;
  static MIN_HEIGHT = 200;
  static DEFAULT_WIDTH = 360;
  static DEFAULT_HEIGHT = 340;

  /** @type {boolean} */
  #isSearchOpen = false;

  /** @type {string} */
  #searchQuery = '';

  /** @type {boolean} */
  #isDropdownOpen = false;

  /** @type {string} */
  #dropdownFilter = '';

  /** @type {Function|null} */
  #dropdownCloseHandler = null;

  /* ---------------------------------------- */
  /*  Config Helpers                          */
  /* ---------------------------------------- */

  /** @returns {{ id: string, journalId: string, category: string, order: number }[]} */
  #getEntries() {
    return this.config.entries ?? [];
  }

  /** @returns {'cards'|'list'} */
  #getViewMode() {
    return this.config.viewMode ?? 'list';
  }

  /* ---------------------------------------- */
  /*  Foundry Journal API                     */
  /* ---------------------------------------- */

  /**
   * Get a JournalEntry document by ID.
   * @param {string} journalId
   * @returns {JournalEntry|null}
   */
  #getJournal(journalId) {
    return game.journal?.get(journalId) ?? null;
  }

  /**
   * Get the first image from a journal entry's pages.
   * @param {JournalEntry} journal
   * @returns {string|null}
   */
  #getJournalImage(journal) {
    if (!journal?.pages) return null;
    for (const page of journal.pages) {
      if (page.type === 'image' && page.src) return page.src;
    }
    return null;
  }

  /**
   * Get a brief excerpt from a journal's first text page.
   * @param {JournalEntry} journal
   * @param {number} [maxLength=80]
   * @returns {string}
   */
  #getJournalExcerpt(journal, maxLength = 80) {
    if (!journal?.pages) return '';
    for (const page of journal.pages) {
      if (page.type === 'text' && page.text?.content) {
        const div = document.createElement('div');
        div.innerHTML = page.text.content;
        const text = div.textContent?.trim() || '';
        if (text.length > maxLength) return text.substring(0, maxLength) + '\u2026';
        return text;
      }
    }
    return '';
  }

  /**
   * Get all available journals grouped by folder, sorted alphabetically.
   * Excludes journals already on the board.
   * @returns {{ folderName: string|null, journals: JournalEntry[] }[]}
   */
  #getAvailableJournals() {
    if (!game.journal) return [];
    const existingIds = new Set(this.#getEntries().map(e => e.journalId));
    const available = [];
    for (const journal of game.journal) {
      if (!existingIds.has(journal.id)) available.push(journal);
    }
    available.sort((a, b) => a.name.localeCompare(b.name));

    // Group by folder
    const groups = new Map();
    for (const journal of available) {
      const folderName = journal.folder?.name ?? null;
      if (!groups.has(folderName)) groups.set(folderName, []);
      groups.get(folderName).push(journal);
    }

    // Sort groups: ungrouped (null) first, then alphabetical
    const result = [];
    if (groups.has(null)) {
      result.push({ folderName: null, journals: groups.get(null) });
      groups.delete(null);
    }
    const sortedFolders = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [folderName, journals] of sortedFolders) {
      result.push({ folderName, journals });
    }
    return result;
  }

  /**
   * Filter journal groups by search query.
   * @param {{ folderName: string|null, journals: JournalEntry[] }[]} groups
   * @param {string} query
   * @returns {{ folderName: string|null, journals: JournalEntry[] }[]}
   */
  #filterJournalGroups(groups, query) {
    if (!query) return groups;
    const lower = query.toLowerCase();
    const filtered = [];
    for (const group of groups) {
      const matchingJournals = group.journals.filter(j =>
        j.name?.toLowerCase().includes(lower)
      );
      if (matchingJournals.length > 0) {
        filtered.push({ folderName: group.folderName, journals: matchingJournals });
      }
    }
    return filtered;
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.JournalBoard');
  }

  /** @param {HTMLElement} bodyEl */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-journal';

    // Entries (top — leaves header area free for drag)
    this.#buildEntriesList(container);

    // Bottom bar: view toggle + search + add (all controls at bottom)
    this.#buildBottomBar(container);

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Entries List                            */
  /* ---------------------------------------- */

  #buildEntriesList(container) {
    const entries = this.#getEntries();
    const viewMode = this.#getViewMode();

    const list = document.createElement('div');
    list.className = `sessionflow-widget-journal__entries sessionflow-widget-journal__entries--${viewMode}`;

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-journal__empty';
      empty.innerHTML = `
        <i class="fas fa-book-atlas"></i>
        <span>${game.i18n.localize('SESSIONFLOW.Canvas.JournalEmpty')}</span>
        <span class="sessionflow-widget-journal__empty-subtitle">${game.i18n.localize('SESSIONFLOW.Canvas.JournalEmptySubtitle')}</span>
      `;
      list.appendChild(empty);
    } else {
      // Filter by search
      let filteredEntries = entries;
      if (this.#searchQuery) {
        const lower = this.#searchQuery.toLowerCase();
        filteredEntries = entries.filter(entry => {
          const journal = this.#getJournal(entry.journalId);
          return journal?.name?.toLowerCase().includes(lower) ||
                 entry.category?.toLowerCase().includes(lower);
        });
      }

      for (const entry of filteredEntries) {
        const journal = this.#getJournal(entry.journalId);
        if (!journal) continue; // Skip deleted journals

        if (viewMode === 'cards') {
          list.appendChild(this.#buildCard(entry, journal));
        } else {
          list.appendChild(this.#buildListItem(entry, journal));
        }
      }

      if (filteredEntries.length === 0 && this.#searchQuery) {
        const noResults = document.createElement('div');
        noResults.className = 'sessionflow-widget-journal__no-results';
        noResults.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalNoResults');
        list.appendChild(noResults);
      }
    }

    container.appendChild(list);
  }

  /* ---------------------------------------- */
  /*  Card View                               */
  /* ---------------------------------------- */

  /**
   * @param {{ journalId: string, category: string }} entry
   * @param {JournalEntry} journal
   * @returns {HTMLElement}
   */
  #buildCard(entry, journal) {
    const card = document.createElement('div');
    card.className = 'sessionflow-widget-journal__card';
    card.dataset.entryId = entry.id;

    // Thumbnail (with fallback)
    const thumb = document.createElement('div');
    thumb.className = 'sessionflow-widget-journal__card-thumb';
    const image = this.#getJournalImage(journal);
    if (image) {
      thumb.style.backgroundImage = `url(${image})`;
    } else {
      thumb.classList.add('sessionflow-widget-journal__card-thumb--fallback');
      thumb.innerHTML = '<i class="fas fa-book-open"></i>';
    }
    card.appendChild(thumb);

    // Info
    const info = document.createElement('div');
    info.className = 'sessionflow-widget-journal__card-info';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__card-title';
    title.textContent = journal.name;
    info.appendChild(title);

    // Excerpt
    const excerpt = this.#getJournalExcerpt(journal);
    if (excerpt) {
      const excerptEl = document.createElement('span');
      excerptEl.className = 'sessionflow-widget-journal__card-excerpt';
      excerptEl.textContent = excerpt;
      info.appendChild(excerptEl);
    }

    if (entry.category) {
      const cat = document.createElement('span');
      cat.className = 'sessionflow-widget-journal__card-category';
      cat.textContent = entry.category;
      info.appendChild(cat);
    }

    card.appendChild(info);

    // Actions overlay
    card.appendChild(this.#buildEntryActions(entry, journal));

    // Click to open
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      journal.sheet?.render(true);
    });

    return card;
  }

  /* ---------------------------------------- */
  /*  List View                               */
  /* ---------------------------------------- */

  /**
   * @param {{ journalId: string, category: string }} entry
   * @param {JournalEntry} journal
   * @returns {HTMLElement}
   */
  #buildListItem(entry, journal) {
    const item = document.createElement('div');
    item.className = 'sessionflow-widget-journal__list-item';
    item.dataset.entryId = entry.id;

    // Icon
    const icon = document.createElement('i');
    icon.className = 'fas fa-book-open sessionflow-widget-journal__list-icon';
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'sessionflow-widget-journal__list-name';
    name.textContent = journal.name;
    item.appendChild(name);

    // Category badge
    if (entry.category) {
      const cat = document.createElement('span');
      cat.className = 'sessionflow-widget-journal__list-category';
      cat.textContent = entry.category;
      item.appendChild(cat);
    }

    // Actions
    item.appendChild(this.#buildEntryActions(entry, journal));

    // Click to open
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      journal.sheet?.render(true);
    });

    return item;
  }

  /* ---------------------------------------- */
  /*  Entry Actions                           */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string }} entry
   * @param {JournalEntry} journal
   * @returns {HTMLElement}
   */
  #buildEntryActions(entry, journal) {
    const actions = document.createElement('div');
    actions.className = 'sessionflow-widget-journal__actions';

    // Show to players
    if (game.user.isGM) {
      const showBtn = document.createElement('button');
      showBtn.type = 'button';
      showBtn.className = 'sessionflow-widget-journal__action-btn';
      showBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalShowToPlayers');
      showBtn.innerHTML = '<i class="fas fa-eye"></i>';
      showBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#showToPlayers(journal);
      });
      actions.appendChild(showBtn);

      // Remove
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sessionflow-widget-journal__action-btn sessionflow-widget-journal__action-btn--remove';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalRemoveEntry');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#removeEntry(entry.id);
      });
      actions.appendChild(removeBtn);
    }

    return actions;
  }

  /* ---------------------------------------- */
  /*  Bottom Bar (View Toggle + Search + Add) */
  /* ---------------------------------------- */

  #buildBottomBar(container) {
    const bar = document.createElement('div');
    bar.className = 'sessionflow-widget-journal__bottom-bar';

    // Left: view mode toggle + search
    const controls = document.createElement('div');
    controls.className = 'sessionflow-widget-journal__controls';

    const viewMode = this.#getViewMode();

    const listBtn = document.createElement('button');
    listBtn.type = 'button';
    listBtn.className = `sessionflow-widget-journal__view-btn ${viewMode === 'list' ? 'is-active' : ''}`;
    listBtn.innerHTML = '<i class="fas fa-list"></i>';
    listBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalViewList');
    listBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateConfig({ viewMode: 'list' });
      this.engine.scheduleSave();
      this.#rerender();
    });
    controls.appendChild(listBtn);

    const cardBtn = document.createElement('button');
    cardBtn.type = 'button';
    cardBtn.className = `sessionflow-widget-journal__view-btn ${viewMode === 'cards' ? 'is-active' : ''}`;
    cardBtn.innerHTML = '<i class="fas fa-th-large"></i>';
    cardBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalViewCards');
    cardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateConfig({ viewMode: 'cards' });
      this.engine.scheduleSave();
      this.#rerender();
    });
    controls.appendChild(cardBtn);

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'sessionflow-widget-journal__search-btn';
    searchBtn.innerHTML = '<i class="fas fa-search"></i>';
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#isSearchOpen = !this.#isSearchOpen;
      this.#searchQuery = '';
      this.#rerender();
    });
    controls.appendChild(searchBtn);

    bar.appendChild(controls);

    // Search input (expands when open)
    if (this.#isSearchOpen) {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'sessionflow-widget-journal__search-input';
      searchInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.JournalSearchPlaceholder');
      searchInput.value = this.#searchQuery;
      searchInput.addEventListener('input', (e) => {
        e.stopPropagation();
        this.#searchQuery = e.target.value;
        this.#rerender();
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this.#isSearchOpen = false; this.#searchQuery = ''; this.#rerender(); }
      });
      bar.appendChild(searchInput);
      requestAnimationFrame(() => searchInput.focus());
    }

    // Right: add button (GM only)
    if (game.user.isGM && !this.#isSearchOpen) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'sessionflow-widget-journal__add-btn';
      addBtn.innerHTML = '<i class="fas fa-plus"></i>';
      addBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalAddEntry');
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleDropdown();
      });
      bar.appendChild(addBtn);
    }

    // Browsable dropdown (positioned above the bar)
    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-journal__dropdown';
    if (this.#isDropdownOpen) dropdown.classList.add('is-visible');

    const filterRow = document.createElement('div');
    filterRow.className = 'sessionflow-widget-journal__dropdown-filter';

    const filterIcon = document.createElement('i');
    filterIcon.className = 'fas fa-search';
    filterRow.appendChild(filterIcon);

    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.className = 'sessionflow-widget-journal__dropdown-filter-input';
    filterInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.JournalBrowseAll');
    filterInput.value = this.#dropdownFilter;
    filterInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#dropdownFilter = e.target.value;
      this.#rebuildDropdownList();
    });
    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.#closeDropdown();
      }
    });
    filterRow.appendChild(filterInput);
    dropdown.appendChild(filterRow);

    const listArea = document.createElement('div');
    listArea.className = 'sessionflow-widget-journal__dropdown-list';
    dropdown.appendChild(listArea);

    bar.appendChild(dropdown);
    container.appendChild(bar);

    if (this.#isDropdownOpen) {
      this.#populateDropdownList(listArea);
      requestAnimationFrame(() => filterInput.focus());
    }
  }

  /**
   * Populate the dropdown list with journal entries grouped by folder.
   * @param {HTMLElement} listArea
   */
  #populateDropdownList(listArea) {
    listArea.innerHTML = '';

    const groups = this.#getAvailableJournals();
    const filtered = this.#filterJournalGroups(groups, this.#dropdownFilter);

    // Count total available
    const totalCount = filtered.reduce((sum, g) => sum + g.journals.length, 0);

    if (totalCount === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sessionflow-widget-journal__dropdown-empty';
      // Differentiate: no journals exist at all vs. all already added vs. filter found nothing
      const allJournals = game.journal?.size ?? 0;
      const existingCount = this.#getEntries().length;
      if (allJournals === 0) {
        emptyEl.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalNoJournalsExist');
      } else if (this.#dropdownFilter) {
        emptyEl.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalNoJournals');
      } else {
        emptyEl.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalAllAdded');
      }
      listArea.appendChild(emptyEl);
      return;
    }

    for (const group of filtered) {
      // Folder header (if grouped)
      if (group.folderName) {
        const header = document.createElement('div');
        header.className = 'sessionflow-widget-journal__dropdown-folder';
        header.innerHTML = `<i class="fas fa-folder"></i><span>${group.folderName}</span>`;
        listArea.appendChild(header);
      }

      for (const journal of group.journals) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sessionflow-widget-journal__dropdown-item';

        const icon = document.createElement('i');
        icon.className = 'fas fa-book-open';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.textContent = journal.name;
        item.appendChild(name);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#addEntry(journal.id);
        });
        listArea.appendChild(item);
      }
    }
  }

  /**
   * Re-populate the dropdown list without full rerender (fast filter).
   */
  #rebuildDropdownList() {
    const listArea = this.element?.querySelector('.sessionflow-widget-journal__dropdown-list');
    if (listArea) this.#populateDropdownList(listArea);
  }

  /* ---------------------------------------- */
  /*  Dropdown Toggle                         */
  /* ---------------------------------------- */

  #toggleDropdown() {
    if (this.#isDropdownOpen) {
      this.#closeDropdown();
    } else {
      this.#openDropdown();
    }
  }

  #openDropdown() {
    this.#isDropdownOpen = true;
    this.#dropdownFilter = '';

    const dropdown = this.element?.querySelector('.sessionflow-widget-journal__dropdown');
    if (dropdown) {
      dropdown.classList.add('is-visible');
      const listArea = dropdown.querySelector('.sessionflow-widget-journal__dropdown-list');
      if (listArea) this.#populateDropdownList(listArea);

      // Reset and focus filter input
      const filterInput = dropdown.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
      if (filterInput) {
        filterInput.value = '';
        requestAnimationFrame(() => filterInput.focus());
      }
    }

    // Close on click outside (faction pattern)
    requestAnimationFrame(() => {
      this.#dropdownCloseHandler = (e) => {
        if (!e.target.closest('.sessionflow-widget-journal__dropdown, .sessionflow-widget-journal__add-btn')) {
          this.#closeDropdown();
        }
      };
      document.addEventListener('pointerdown', this.#dropdownCloseHandler, true);
    });
  }

  #closeDropdown() {
    this.#isDropdownOpen = false;
    this.#dropdownFilter = '';

    const dropdown = this.element?.querySelector('.sessionflow-widget-journal__dropdown');
    dropdown?.classList.remove('is-visible');

    if (this.#dropdownCloseHandler) {
      document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
      this.#dropdownCloseHandler = null;
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  #addEntry(journalId) {
    const entries = [...this.#getEntries()];
    entries.push({
      id: foundry.utils.randomID(),
      journalId,
      category: '',
      order: entries.length
    });
    this.updateConfig({ entries });
    this.engine.scheduleSave();
    this.#closeDropdown();
    this.#rerender();
  }

  #removeEntry(entryId) {
    const entries = this.#getEntries().filter(e => e.id !== entryId);
    this.updateConfig({ entries });
    this.engine.scheduleSave();
    this.#rerender();
  }

  /**
   * Show a journal entry to all connected players.
   * @param {JournalEntry} journal
   */
  async #showToPlayers(journal) {
    try {
      if (journal?.sheet) {
        await journal.sheet.render(true);
        if (typeof journal.show === 'function') {
          await journal.show();
          ui.notifications.info(
            game.i18n.format('SESSIONFLOW.Canvas.JournalShownToPlayers', { name: journal.name })
          );
        }
      }
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to show journal to players:`, err);
    }
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  destroy() {
    if (this.#dropdownCloseHandler) {
      document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
      this.#dropdownCloseHandler = null;
    }
    super.destroy();
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
registerWidgetType(JournalBoardWidget.TYPE, JournalBoardWidget);
