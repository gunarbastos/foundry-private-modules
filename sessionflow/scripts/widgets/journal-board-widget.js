/**
 * SessionFlow - Journal Board Widget
 * A curated board of Foundry Journal references for quick access and player sharing.
 * Features: journal/page/heading targets, list/card view, browsable picker, excerpts.
 * @module widgets/journal-board-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const TARGET_TYPES = new Set(['journal', 'page', 'heading']);

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

  /** @type {string|null} */
  #dropdownJournalId = null;

  /** @type {Function|null} */
  #dropdownCloseHandler = null;

  /* ---------------------------------------- */
  /*  Config Helpers                          */
  /* ---------------------------------------- */

  /**
   * @param {object} entry
   * @param {number} index
   * @returns {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }|null}
   */
  #normalizeEntry(entry, index) {
    if (!entry || typeof entry !== 'object') return null;

    let targetType = TARGET_TYPES.has(entry.targetType) ? entry.targetType : 'journal';
    let pageId = typeof entry.pageId === 'string' && entry.pageId ? entry.pageId : null;
    let headingSlug = typeof entry.headingSlug === 'string' && entry.headingSlug ? entry.headingSlug : null;

    if (targetType === 'heading' && !pageId) targetType = 'journal';
    if (targetType === 'page' && !pageId) targetType = 'journal';
    if (targetType === 'page') headingSlug = null;
    if (targetType === 'journal') {
      pageId = null;
      headingSlug = null;
    }

    const journalId = typeof entry.journalId === 'string' ? entry.journalId : '';
    if (!journalId) return null;

    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : foundry.utils.randomID(),
      journalId,
      targetType,
      pageId,
      headingSlug,
      category: typeof entry.category === 'string' ? entry.category : '',
      order: Number.isFinite(entry.order) ? entry.order : index
    };
  }

  /** @returns {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }[]} */
  #getEntries() {
    return [...(this.config.entries ?? [])]
      .map((entry, index) => this.#normalizeEntry(entry, index))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * @param {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }[]} entries
   * @returns {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }[]}
   */
  #reindexEntries(entries) {
    return entries.map((entry, index) => ({
      ...entry,
      order: index
    }));
  }

  /** @returns {'cards'|'list'} */
  #getViewMode() {
    return this.config.viewMode ?? 'list';
  }

  /**
   * @param {{ journalId: string, targetType?: 'journal'|'page'|'heading', pageId?: string|null, headingSlug?: string|null }} target
   * @returns {string}
   */
  #buildTargetKey(target) {
    const targetType = TARGET_TYPES.has(target.targetType) ? target.targetType : 'journal';
    const pageId = targetType === 'journal' ? '' : (target.pageId ?? '');
    const headingSlug = targetType === 'heading' ? (target.headingSlug ?? '') : '';
    return [targetType, target.journalId ?? '', pageId, headingSlug].join('::');
  }

  /** @returns {Set<string>} */
  #getExistingTargetKeys() {
    return new Set(this.#getEntries().map(entry => this.#buildTargetKey(entry)));
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
   * Get a JournalEntryPage document by ID.
   * @param {JournalEntry|null} journal
   * @param {string|null} pageId
   * @returns {JournalEntryPage|null}
   */
  #getPage(journal, pageId) {
    if (!journal || !pageId) return null;
    return journal.pages?.get(pageId) ?? null;
  }

  /**
   * Get the first image from a journal entry's pages.
   * @param {JournalEntry|null} journal
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
   * @param {JournalEntryPage|null} page
   * @param {JournalEntry|null} journal
   * @returns {string|null}
   */
  #getPageImage(page, journal) {
    if (page?.type === 'image' && page.src) return page.src;
    return this.#getJournalImage(journal);
  }

  /**
   * Convert HTML content to a brief plain-text excerpt.
   * @param {string} html
   * @param {number} [maxLength=80]
   * @returns {string}
   */
  #getTextExcerpt(html, maxLength = 80) {
    if (typeof html !== 'string' || !html.trim()) return '';

    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!text) return '';
    if (text.length > maxLength) return `${text.substring(0, maxLength)}...`;
    return text;
  }

  /**
   * Get a brief excerpt from a journal's first text page.
   * @param {JournalEntry|null} journal
   * @param {number} [maxLength=80]
   * @returns {string}
   */
  #getJournalExcerpt(journal, maxLength = 80) {
    if (!journal?.pages) return '';
    for (const page of journal.pages) {
      if (page.type === 'text' && page.text?.content) {
        return this.#getTextExcerpt(page.text.content, maxLength);
      }
    }
    return '';
  }

  /**
   * @param {JournalEntryPage|null} page
   * @param {number} [maxLength=80]
   * @returns {string}
   */
  #getPageExcerpt(page, maxLength = 80) {
    if (!page || page.type !== 'text') return '';
    return this.#getTextExcerpt(page.text?.content ?? '', maxLength);
  }

  /**
   * @param {string} text
   * @param {JournalEntryPage|null} page
   * @returns {string}
   */
  #slugifyHeading(text, page) {
    const slugify = page?.constructor?.slugifyHeading;
    if (typeof slugify === 'function') {
      try {
        return slugify.call(page.constructor, text);
      } catch {
        // Fall through to generic slugify.
      }
    }

    if (typeof foundry?.utils?.slugify === 'function') {
      try {
        return foundry.utils.slugify(text, { strict: true });
      } catch {
        // Fall through to manual cleanup.
      }
    }

    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  /**
   * @param {string} slug
   * @returns {string}
   */
  #humanizeSlug(slug) {
    return String(slug ?? '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  /**
   * @param {JournalEntryPage|null} page
   * @returns {{ slug: string, text: string, level: number, order: number }[]}
   */
  #getPageHeadings(page) {
    if (!page || page.type !== 'text') return [];

    const tocEntries = [];
    if (page.toc && typeof page.toc === 'object') {
      for (const node of Object.values(page.toc)) {
        if (!node || typeof node !== 'object') continue;
        const slug = typeof node.slug === 'string' && node.slug ? node.slug : '';
        const text = typeof node.text === 'string' && node.text ? node.text.trim() : '';
        if (!slug || !text) continue;
        tocEntries.push({
          slug,
          text,
          level: Number.isFinite(node.level) ? node.level : 1,
          order: Number.isFinite(node.order) ? node.order : tocEntries.length
        });
      }
    }

    if (tocEntries.length > 0) {
      return tocEntries
        .sort((a, b) => a.order - b.order)
        .filter((entry, index, items) => items.findIndex(other => other.slug === entry.slug) === index);
    }

    const html = page.text?.content;
    if (typeof html !== 'string' || !html.trim()) return [];

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    const seen = new Map();
    const headings = [];
    let order = 0;

    for (const headingEl of wrapper.querySelectorAll(HEADING_SELECTOR)) {
      const text = headingEl.textContent?.replace(/\s+/g, ' ').trim();
      if (!text) continue;

      const baseSlug = headingEl.id || this.#slugifyHeading(text, page);
      const duplicateCount = seen.get(baseSlug) ?? 0;
      seen.set(baseSlug, duplicateCount + 1);

      headings.push({
        slug: duplicateCount > 0 ? `${baseSlug}-${duplicateCount}` : baseSlug,
        text,
        level: Number.parseInt(headingEl.tagName.substring(1), 10) || 1,
        order: order++
      });
    }

    return headings;
  }

  /**
   * @param {JournalEntryPage|null} page
   * @param {string|null} headingSlug
   * @returns {{ slug: string, text: string, level: number, order: number }|null}
   */
  #getHeading(page, headingSlug) {
    if (!page || !headingSlug) return null;
    return this.#getPageHeadings(page).find(heading => heading.slug === headingSlug) ?? null;
  }

  /**
   * @param {JournalEntryPage|null} page
   * @returns {string}
   */
  #getPageIconClass(page) {
    switch (page?.type) {
      case 'image': return 'fas fa-image';
      case 'pdf': return 'fas fa-file-pdf';
      case 'video': return 'fas fa-film';
      case 'text':
      default:
        return 'fas fa-file-lines';
    }
  }

  /**
   * @param {JournalEntry|null} journal
   * @param {JournalEntryPage|null} page
   * @returns {string}
   */
  #getEntrySubtitle(journal, page) {
    if (journal && page) return `${journal.name} / ${page.name}`;
    if (journal) return journal.name;
    return '';
  }

  /**
   * @param {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }} entry
   * @returns {{
   *   journal: JournalEntry|null,
   *   page: JournalEntryPage|null,
   *   heading: { slug: string, text: string, level: number, order: number }|null,
   *   title: string,
   *   subtitle: string,
   *   excerpt: string,
   *   image: string|null,
   *   iconClass: string,
   *   isMissing: boolean,
   *   shareDocument: JournalEntry|JournalEntryPage|null
   * }}
   */
  #describeEntry(entry) {
    const journal = this.#getJournal(entry.journalId);
    const page = this.#getPage(journal, entry.pageId);
    const heading = entry.targetType === 'heading' ? this.#getHeading(page, entry.headingSlug) : null;

    if (!journal) {
      return {
        journal: null,
        page: null,
        heading: null,
        title: game.i18n.localize('SESSIONFLOW.Canvas.JournalMissingJournal'),
        subtitle: '',
        excerpt: '',
        image: null,
        iconClass: 'fas fa-triangle-exclamation',
        isMissing: true,
        shareDocument: null
      };
    }

    if (entry.targetType === 'journal') {
      return {
        journal,
        page: null,
        heading: null,
        title: journal.name,
        subtitle: '',
        excerpt: this.#getJournalExcerpt(journal),
        image: this.#getJournalImage(journal),
        iconClass: 'fas fa-book-open',
        isMissing: false,
        shareDocument: journal
      };
    }

    if (!page) {
      return {
        journal,
        page: null,
        heading: null,
        title: game.i18n.localize('SESSIONFLOW.Canvas.JournalMissingPage'),
        subtitle: journal.name,
        excerpt: this.#getJournalExcerpt(journal),
        image: this.#getJournalImage(journal),
        iconClass: 'fas fa-triangle-exclamation',
        isMissing: true,
        shareDocument: null
      };
    }

    if (entry.targetType === 'page') {
      return {
        journal,
        page,
        heading: null,
        title: page.name || journal.name,
        subtitle: journal.name,
        excerpt: this.#getPageExcerpt(page),
        image: this.#getPageImage(page, journal),
        iconClass: this.#getPageIconClass(page),
        isMissing: false,
        shareDocument: page
      };
    }

    if (heading) {
      return {
        journal,
        page,
        heading,
        title: heading.text,
        subtitle: this.#getEntrySubtitle(journal, page),
        excerpt: this.#getPageExcerpt(page),
        image: this.#getPageImage(page, journal),
        iconClass: 'fas fa-heading',
        isMissing: false,
        shareDocument: page
      };
    }

    return {
      journal,
      page,
      heading: null,
      title: entry.headingSlug
        ? `${game.i18n.localize('SESSIONFLOW.Canvas.JournalMissingHeading')}: ${this.#humanizeSlug(entry.headingSlug)}`
        : game.i18n.localize('SESSIONFLOW.Canvas.JournalMissingHeading'),
      subtitle: this.#getEntrySubtitle(journal, page),
      excerpt: this.#getPageExcerpt(page),
      image: this.#getPageImage(page, journal),
      iconClass: 'fas fa-triangle-exclamation',
      isMissing: true,
      shareDocument: page
    };
  }

  /**
   * @param {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }} entry
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   * @returns {string}
   */
  #getEntrySearchText(entry, details) {
    return [
      details.title,
      details.subtitle,
      details.excerpt,
      entry.category,
      details.journal?.name,
      details.page?.name,
      details.heading?.text
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  /* ---------------------------------------- */
  /*  Journal Browser Data                    */
  /* ---------------------------------------- */

  /**
   * @param {JournalEntry} journal
   * @param {Set<string>} existingKeys
   * @returns {{
   *   journal: JournalEntry,
   *   canAddJournal: boolean,
   *   hasAddableTargets: boolean,
   *   pages: {
   *     page: JournalEntryPage,
   *     canAdd: boolean,
   *     hasAddableTargets: boolean,
   *     headings: { slug: string, text: string, level: number, order: number, canAdd: boolean }[]
   *   }[]
   * }}
   */
  #getJournalBrowseData(journal, existingKeys) {
    const pages = [...(journal.pages ?? [])]
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((page) => {
        const headings = this.#getPageHeadings(page).map((heading) => ({
          ...heading,
          canAdd: !existingKeys.has(this.#buildTargetKey({
            journalId: journal.id,
            targetType: 'heading',
            pageId: page.id,
            headingSlug: heading.slug
          }))
        }));

        const canAdd = !existingKeys.has(this.#buildTargetKey({
          journalId: journal.id,
          targetType: 'page',
          pageId: page.id
        }));

        return {
          page,
          canAdd,
          hasAddableTargets: canAdd || headings.some((heading) => heading.canAdd),
          headings
        };
      });

    const canAddJournal = !existingKeys.has(this.#buildTargetKey({
      journalId: journal.id,
      targetType: 'journal'
    }));

    return {
      journal,
      canAddJournal,
      hasAddableTargets: canAddJournal || pages.some((page) => page.hasAddableTargets),
      pages
    };
  }

  /**
   * Get addable journals grouped by folder, sorted alphabetically.
   * @returns {{ folderName: string|null, journals: ReturnType<JournalBoardWidget['#getJournalBrowseData']>[] }[]}
   */
  #getAvailableJournals() {
    if (!game.journal) return [];

    const existingKeys = this.#getExistingTargetKeys();
    const available = [];
    for (const journal of game.journal) {
      const browseData = this.#getJournalBrowseData(journal, existingKeys);
      if (browseData.hasAddableTargets) available.push(browseData);
    }

    available.sort((a, b) => a.journal.name.localeCompare(b.journal.name));

    const groups = new Map();
    for (const browseData of available) {
      const folderName = browseData.journal.folder?.name ?? null;
      if (!groups.has(folderName)) groups.set(folderName, []);
      groups.get(folderName).push(browseData);
    }

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
   * @param {ReturnType<JournalBoardWidget['#getJournalBrowseData']>} browseData
   * @param {string} lowerQuery
   * @returns {boolean}
   */
  #journalMatchesQuery(browseData, lowerQuery) {
    if (!lowerQuery) return true;
    if (browseData.journal.name?.toLowerCase().includes(lowerQuery)) return true;

    return browseData.pages.some((pageData) => {
      if (pageData.page.name?.toLowerCase().includes(lowerQuery)) return true;
      return pageData.headings.some((heading) => heading.text?.toLowerCase().includes(lowerQuery));
    });
  }

  /**
   * Filter journal groups by search query.
   * @param {{ folderName: string|null, journals: ReturnType<JournalBoardWidget['#getJournalBrowseData']>[] }[]} groups
   * @param {string} query
   * @returns {{ folderName: string|null, journals: ReturnType<JournalBoardWidget['#getJournalBrowseData']>[] }[]}
   */
  #filterJournalGroups(groups, query) {
    if (!query) return groups;

    const lower = query.toLowerCase();
    const filtered = [];

    for (const group of groups) {
      const matchingJournals = group.journals.filter((browseData) => this.#journalMatchesQuery(browseData, lower));
      if (matchingJournals.length > 0) {
        filtered.push({ folderName: group.folderName, journals: matchingJournals });
      }
    }

    return filtered;
  }

  /**
   * @param {ReturnType<JournalBoardWidget['#getJournalBrowseData']>} browseData
   * @param {string} query
   * @returns {{
   *   page: JournalEntryPage,
   *   canAdd: boolean,
   *   hasAddableTargets: boolean,
   *   headings: { slug: string, text: string, level: number, order: number, canAdd: boolean }[],
   *   visibleHeadings: { slug: string, text: string, level: number, order: number, canAdd: boolean }[]
   * }[]}
   */
  #filterBrowsePages(browseData, query) {
    if (!query) {
      return browseData.pages.map((pageData) => ({
        ...pageData,
        visibleHeadings: pageData.headings
      }));
    }

    const lower = query.toLowerCase();
    if (browseData.journal.name?.toLowerCase().includes(lower)) {
      return browseData.pages.map((pageData) => ({
        ...pageData,
        visibleHeadings: pageData.headings
      }));
    }

    return browseData.pages
      .map((pageData) => {
        const pageMatches = pageData.page.name?.toLowerCase().includes(lower);
        const visibleHeadings = pageMatches
          ? pageData.headings
          : pageData.headings.filter((heading) => heading.text?.toLowerCase().includes(lower));

        if (!pageMatches && visibleHeadings.length === 0) return null;

        return {
          ...pageData,
          visibleHeadings
        };
      })
      .filter(Boolean);
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

    this.#buildEntriesList(container);
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
      container.appendChild(list);
      return;
    }

    const visibleEntries = [];
    for (const entry of entries) {
      const details = this.#describeEntry(entry);
      if (this.#searchQuery) {
        const haystack = this.#getEntrySearchText(entry, details);
        if (!haystack.includes(this.#searchQuery.toLowerCase())) continue;
      }
      visibleEntries.push({ entry, details });
    }

    if (visibleEntries.length === 0 && this.#searchQuery) {
      const noResults = document.createElement('div');
      noResults.className = 'sessionflow-widget-journal__no-results';
      noResults.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalNoResults');
      list.appendChild(noResults);
      container.appendChild(list);
      return;
    }

    for (const { entry, details } of visibleEntries) {
      if (viewMode === 'cards') {
        list.appendChild(this.#buildCard(entry, details));
      } else {
        list.appendChild(this.#buildListItem(entry, details));
      }
    }

    container.appendChild(list);
  }

  /* ---------------------------------------- */
  /*  Card View                               */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }} entry
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   * @returns {HTMLElement}
   */
  #buildCard(entry, details) {
    const card = document.createElement('div');
    card.className = 'sessionflow-widget-journal__card';
    if (details.isMissing) card.classList.add('is-missing');
    card.dataset.entryId = entry.id;

    const thumb = document.createElement('div');
    thumb.className = 'sessionflow-widget-journal__card-thumb';
    if (details.image) {
      thumb.style.backgroundImage = `url(${details.image})`;
    } else {
      thumb.classList.add('sessionflow-widget-journal__card-thumb--fallback');
      thumb.innerHTML = `<i class="${details.isMissing ? 'fas fa-triangle-exclamation' : details.iconClass}"></i>`;
    }
    card.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'sessionflow-widget-journal__card-info';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__card-title';
    title.textContent = details.title;
    info.appendChild(title);

    if (details.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'sessionflow-widget-journal__card-subtitle';
      subtitle.textContent = details.subtitle;
      info.appendChild(subtitle);
    }

    if (details.excerpt) {
      const excerptEl = document.createElement('span');
      excerptEl.className = 'sessionflow-widget-journal__card-excerpt';
      excerptEl.textContent = details.excerpt;
      info.appendChild(excerptEl);
    }

    if (entry.category) {
      const category = document.createElement('span');
      category.className = 'sessionflow-widget-journal__card-category';
      category.textContent = entry.category;
      info.appendChild(category);
    }

    card.appendChild(info);
    card.appendChild(this.#buildEntryActions(entry, details));

    if (details.journal) {
      card.addEventListener('click', async (event) => {
        if (event.target.closest('button')) return;
        event.stopPropagation();
        await this.#openEntry(entry, details);
      });
    }

    return card;
  }

  /* ---------------------------------------- */
  /*  List View                               */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string, journalId: string, targetType: 'journal'|'page'|'heading', pageId: string|null, headingSlug: string|null, category: string, order: number }} entry
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   * @returns {HTMLElement}
   */
  #buildListItem(entry, details) {
    const item = document.createElement('div');
    item.className = 'sessionflow-widget-journal__list-item';
    if (details.isMissing) item.classList.add('is-missing');
    item.dataset.entryId = entry.id;

    const icon = document.createElement('i');
    icon.className = `${details.iconClass} sessionflow-widget-journal__list-icon`;
    item.appendChild(icon);

    const copy = document.createElement('div');
    copy.className = 'sessionflow-widget-journal__list-copy';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__list-title';
    title.textContent = details.title;
    copy.appendChild(title);

    if (details.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'sessionflow-widget-journal__list-subtitle';
      subtitle.textContent = details.subtitle;
      copy.appendChild(subtitle);
    }

    item.appendChild(copy);

    if (entry.category) {
      const category = document.createElement('span');
      category.className = 'sessionflow-widget-journal__list-category';
      category.textContent = entry.category;
      item.appendChild(category);
    }

    item.appendChild(this.#buildEntryActions(entry, details));

    if (details.journal) {
      item.addEventListener('click', async (event) => {
        if (event.target.closest('button')) return;
        event.stopPropagation();
        await this.#openEntry(entry, details);
      });
    }

    return item;
  }

  /* ---------------------------------------- */
  /*  Entry Actions                           */
  /* ---------------------------------------- */

  /**
   * @param {{ id: string }} entry
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   * @returns {HTMLElement}
   */
  #buildEntryActions(entry, details) {
    const actions = document.createElement('div');
    actions.className = 'sessionflow-widget-journal__actions';

    if (game.user.isGM && details.shareDocument) {
      const showBtn = document.createElement('button');
      showBtn.type = 'button';
      showBtn.className = 'sessionflow-widget-journal__action-btn';
      showBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalShowToPlayers');
      showBtn.innerHTML = '<i class="fas fa-eye"></i>';
      showBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await this.#showToPlayers(details);
      });
      actions.appendChild(showBtn);
    }

    if (game.user.isGM) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sessionflow-widget-journal__action-btn sessionflow-widget-journal__action-btn--remove';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalRemoveEntry');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
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

    const controls = document.createElement('div');
    controls.className = 'sessionflow-widget-journal__controls';

    const viewMode = this.#getViewMode();

    const listBtn = document.createElement('button');
    listBtn.type = 'button';
    listBtn.className = `sessionflow-widget-journal__view-btn ${viewMode === 'list' ? 'is-active' : ''}`;
    listBtn.innerHTML = '<i class="fas fa-list"></i>';
    listBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalViewList');
    listBtn.addEventListener('click', (event) => {
      event.stopPropagation();
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
    cardBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.updateConfig({ viewMode: 'cards' });
      this.engine.scheduleSave();
      this.#rerender();
    });
    controls.appendChild(cardBtn);

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'sessionflow-widget-journal__search-btn';
    searchBtn.innerHTML = '<i class="fas fa-search"></i>';
    searchBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#isSearchOpen = !this.#isSearchOpen;
      this.#searchQuery = '';
      this.#rerender();
    });
    controls.appendChild(searchBtn);

    bar.appendChild(controls);

    if (this.#isSearchOpen) {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'sessionflow-widget-journal__search-input';
      searchInput.placeholder = game.i18n.localize('SESSIONFLOW.Canvas.JournalSearchPlaceholder');
      searchInput.value = this.#searchQuery;
      searchInput.addEventListener('input', (event) => {
        event.stopPropagation();
        this.#searchQuery = event.target.value;
        this.#rerender();
      });
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.#isSearchOpen = false;
          this.#searchQuery = '';
          this.#rerender();
        }
      });
      bar.appendChild(searchInput);
      requestAnimationFrame(() => searchInput.focus());
    }

    if (game.user.isGM && !this.#isSearchOpen) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'sessionflow-widget-journal__add-btn';
      addBtn.innerHTML = '<i class="fas fa-plus"></i>';
      addBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalAddEntry');
      addBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.#toggleDropdown();
      });
      bar.appendChild(addBtn);
    }

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
    filterInput.placeholder = this.#getDropdownFilterPlaceholder();
    filterInput.value = this.#dropdownFilter;
    filterInput.addEventListener('input', (event) => {
      event.stopPropagation();
      this.#dropdownFilter = event.target.value;
      this.#rebuildDropdownList();
    });
    filterInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (this.#dropdownJournalId) {
          this.#showJournalList();
        } else {
          this.#closeDropdown();
        }
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

  /** @returns {string} */
  #getDropdownFilterPlaceholder() {
    return game.i18n.localize(
      this.#dropdownJournalId
        ? 'SESSIONFLOW.Canvas.JournalBrowseTargets'
        : 'SESSIONFLOW.Canvas.JournalBrowseAll'
    );
  }

  /**
   * Populate the dropdown list with either journals or page/heading targets.
   * @param {HTMLElement} listArea
   */
  #populateDropdownList(listArea) {
    listArea.innerHTML = '';

    const selectedJournal = this.#dropdownJournalId ? this.#getJournal(this.#dropdownJournalId) : null;
    if (this.#dropdownJournalId && selectedJournal) {
      const browseData = this.#getJournalBrowseData(selectedJournal, this.#getExistingTargetKeys());
      this.#populateTargetList(listArea, browseData);
      return;
    }

    if (this.#dropdownJournalId && !selectedJournal) {
      this.#dropdownJournalId = null;
      this.#updateDropdownFilterInput();
    }

    const groups = this.#getAvailableJournals();
    const filtered = this.#filterJournalGroups(groups, this.#dropdownFilter);
    const totalCount = filtered.reduce((sum, group) => sum + group.journals.length, 0);

    if (totalCount === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sessionflow-widget-journal__dropdown-empty';
      const allJournals = game.journal?.size ?? 0;
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
      if (group.folderName) {
        const header = document.createElement('div');
        header.className = 'sessionflow-widget-journal__dropdown-folder';
        header.innerHTML = `<i class="fas fa-folder"></i><span>${group.folderName}</span>`;
        listArea.appendChild(header);
      }

      for (const browseData of group.journals) {
        listArea.appendChild(this.#buildJournalBrowseItem(browseData));
      }
    }
  }

  /**
   * @param {ReturnType<JournalBoardWidget['#getJournalBrowseData']>} browseData
   * @returns {HTMLElement}
   */
  #buildJournalBrowseItem(browseData) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sessionflow-widget-journal__dropdown-item sessionflow-widget-journal__dropdown-item--journal';

    const icon = document.createElement('i');
    icon.className = 'fas fa-book-open';
    item.appendChild(icon);

    const copy = document.createElement('span');
    copy.className = 'sessionflow-widget-journal__dropdown-item-copy';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__dropdown-item-title';
    title.textContent = browseData.journal.name;
    copy.appendChild(title);

    const subtitle = document.createElement('span');
    subtitle.className = 'sessionflow-widget-journal__dropdown-item-subtitle';
    subtitle.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalBrowseTargetsHint');
    copy.appendChild(subtitle);

    item.appendChild(copy);

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-right sessionflow-widget-journal__dropdown-item-trailing';
    item.appendChild(chevron);

    item.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#showJournalTargets(browseData.journal.id);
    });

    return item;
  }

  /**
   * @param {HTMLElement} listArea
   * @param {ReturnType<JournalBoardWidget['#getJournalBrowseData']>} browseData
   */
  #populateTargetList(listArea, browseData) {
    listArea.appendChild(this.#buildTargetHeader(browseData));

    const pages = this.#filterBrowsePages(browseData, this.#dropdownFilter);
    if (pages.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sessionflow-widget-journal__dropdown-empty';
      emptyEl.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalNoTargets');
      listArea.appendChild(emptyEl);
      return;
    }

    for (const pageData of pages) {
      const pageGroup = document.createElement('div');
      pageGroup.className = 'sessionflow-widget-journal__dropdown-page-group';

      pageGroup.appendChild(this.#buildPageBrowseItem(browseData.journal, pageData));

      if (pageData.visibleHeadings.length > 0) {
        const headings = document.createElement('div');
        headings.className = 'sessionflow-widget-journal__dropdown-headings';

        for (const heading of pageData.visibleHeadings) {
          headings.appendChild(this.#buildHeadingBrowseItem(browseData.journal, pageData.page, heading));
        }

        pageGroup.appendChild(headings);
      }

      listArea.appendChild(pageGroup);
    }
  }

  /**
   * @param {ReturnType<JournalBoardWidget['#getJournalBrowseData']>} browseData
   * @returns {HTMLElement}
   */
  #buildTargetHeader(browseData) {
    const header = document.createElement('div');
    header.className = 'sessionflow-widget-journal__dropdown-titlebar';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'sessionflow-widget-journal__dropdown-back';
    backBtn.title = game.i18n.localize('SESSIONFLOW.Canvas.JournalBackToJournals');
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    backBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#showJournalList();
    });
    header.appendChild(backBtn);

    const copy = document.createElement('div');
    copy.className = 'sessionflow-widget-journal__dropdown-title-copy';

    const title = document.createElement('div');
    title.className = 'sessionflow-widget-journal__dropdown-title';
    title.textContent = browseData.journal.name;
    copy.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'sessionflow-widget-journal__dropdown-subtitle';
    subtitle.textContent = game.i18n.localize('SESSIONFLOW.Canvas.JournalBrowseTargetsHint');
    copy.appendChild(subtitle);

    header.appendChild(copy);

    const addJournalBtn = document.createElement('button');
    addJournalBtn.type = 'button';
    addJournalBtn.className = 'sessionflow-widget-journal__dropdown-add-journal';
    addJournalBtn.title = browseData.canAddJournal
      ? game.i18n.localize('SESSIONFLOW.Canvas.JournalAddThisJournal')
      : game.i18n.localize('SESSIONFLOW.Canvas.JournalAlreadyAdded');
    addJournalBtn.innerHTML = `<i class="fas ${browseData.canAddJournal ? 'fa-plus' : 'fa-check'}"></i>`;
    addJournalBtn.disabled = !browseData.canAddJournal;
    addJournalBtn.classList.toggle('is-disabled', !browseData.canAddJournal);
    addJournalBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!browseData.canAddJournal) return;
      this.#addEntry({
        journalId: browseData.journal.id,
        targetType: 'journal'
      });
    });
    header.appendChild(addJournalBtn);

    return header;
  }

  /**
   * @param {JournalEntry} journal
   * @param {{
   *   page: JournalEntryPage,
   *   canAdd: boolean,
   *   hasAddableTargets: boolean,
   *   headings: { slug: string, text: string, level: number, order: number, canAdd: boolean }[]
   * }} pageData
   * @returns {HTMLElement}
   */
  #buildPageBrowseItem(journal, pageData) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sessionflow-widget-journal__dropdown-item sessionflow-widget-journal__dropdown-item--page';
    item.disabled = !pageData.canAdd;
    if (!pageData.canAdd) item.classList.add('is-disabled');
    item.title = pageData.canAdd
      ? game.i18n.localize('SESSIONFLOW.Canvas.JournalAddEntry')
      : game.i18n.localize('SESSIONFLOW.Canvas.JournalAlreadyAdded');

    const icon = document.createElement('i');
    icon.className = this.#getPageIconClass(pageData.page);
    item.appendChild(icon);

    const copy = document.createElement('span');
    copy.className = 'sessionflow-widget-journal__dropdown-item-copy';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__dropdown-item-title';
    title.textContent = pageData.page.name || journal.name;
    copy.appendChild(title);

    const subtitle = document.createElement('span');
    subtitle.className = 'sessionflow-widget-journal__dropdown-item-subtitle';
    subtitle.textContent = journal.name;
    copy.appendChild(subtitle);

    item.appendChild(copy);

    const trailing = document.createElement('i');
    trailing.className = `fas ${pageData.canAdd ? 'fa-plus' : 'fa-check'} sessionflow-widget-journal__dropdown-item-trailing`;
    item.appendChild(trailing);

    item.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!pageData.canAdd) return;
      this.#addEntry({
        journalId: journal.id,
        targetType: 'page',
        pageId: pageData.page.id
      });
    });

    return item;
  }

  /**
   * @param {JournalEntry} journal
   * @param {JournalEntryPage} page
   * @param {{ slug: string, text: string, level: number, order: number, canAdd: boolean }} heading
   * @returns {HTMLElement}
   */
  #buildHeadingBrowseItem(journal, page, heading) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sessionflow-widget-journal__dropdown-item sessionflow-widget-journal__dropdown-item--heading';
    item.style.setProperty('--sf-heading-depth', String(Math.max(0, (heading.level ?? 1) - 1)));
    item.disabled = !heading.canAdd;
    if (!heading.canAdd) item.classList.add('is-disabled');
    item.title = heading.canAdd
      ? game.i18n.localize('SESSIONFLOW.Canvas.JournalAddEntry')
      : game.i18n.localize('SESSIONFLOW.Canvas.JournalAlreadyAdded');

    const level = document.createElement('span');
    level.className = 'sessionflow-widget-journal__dropdown-heading-level';
    level.textContent = `H${heading.level ?? 1}`;
    item.appendChild(level);

    const copy = document.createElement('span');
    copy.className = 'sessionflow-widget-journal__dropdown-item-copy';

    const title = document.createElement('span');
    title.className = 'sessionflow-widget-journal__dropdown-item-title';
    title.textContent = heading.text;
    copy.appendChild(title);

    const subtitle = document.createElement('span');
    subtitle.className = 'sessionflow-widget-journal__dropdown-item-subtitle';
    subtitle.textContent = page.name || journal.name;
    copy.appendChild(subtitle);

    item.appendChild(copy);

    const trailing = document.createElement('i');
    trailing.className = `fas ${heading.canAdd ? 'fa-plus' : 'fa-check'} sessionflow-widget-journal__dropdown-item-trailing`;
    item.appendChild(trailing);

    item.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!heading.canAdd) return;
      this.#addEntry({
        journalId: journal.id,
        targetType: 'heading',
        pageId: page.id,
        headingSlug: heading.slug
      });
    });

    return item;
  }

  /**
   * Re-populate the dropdown list without full rerender.
   */
  #rebuildDropdownList() {
    const listArea = this.element?.querySelector('.sessionflow-widget-journal__dropdown-list');
    if (listArea) this.#populateDropdownList(listArea);
    this.#updateDropdownFilterInput();
  }

  /** Update the dropdown filter placeholder to match the current mode. */
  #updateDropdownFilterInput() {
    const input = this.element?.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
    if (input) input.placeholder = this.#getDropdownFilterPlaceholder();
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
    this.#dropdownJournalId = null;

    const dropdown = this.element?.querySelector('.sessionflow-widget-journal__dropdown');
    if (dropdown) {
      dropdown.classList.add('is-visible');
      const listArea = dropdown.querySelector('.sessionflow-widget-journal__dropdown-list');
      if (listArea) this.#populateDropdownList(listArea);

      const filterInput = dropdown.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
      if (filterInput) {
        filterInput.value = '';
        filterInput.placeholder = this.#getDropdownFilterPlaceholder();
        requestAnimationFrame(() => filterInput.focus());
      }
    }

    requestAnimationFrame(() => {
      this.#dropdownCloseHandler = (event) => {
        if (!event.target.closest('.sessionflow-widget-journal__dropdown, .sessionflow-widget-journal__add-btn')) {
          this.#closeDropdown();
        }
      };
      document.addEventListener('pointerdown', this.#dropdownCloseHandler, true);
    });
  }

  #closeDropdown() {
    this.#isDropdownOpen = false;
    this.#dropdownFilter = '';
    this.#dropdownJournalId = null;

    const dropdown = this.element?.querySelector('.sessionflow-widget-journal__dropdown');
    dropdown?.classList.remove('is-visible');

    if (this.#dropdownCloseHandler) {
      document.removeEventListener('pointerdown', this.#dropdownCloseHandler, true);
      this.#dropdownCloseHandler = null;
    }
  }

  /**
   * @param {string} journalId
   */
  #showJournalTargets(journalId) {
    this.#dropdownJournalId = journalId;
    this.#dropdownFilter = '';
    this.#rebuildDropdownList();

    const input = this.element?.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
    if (input) {
      input.value = '';
      requestAnimationFrame(() => input.focus());
    }
  }

  #showJournalList() {
    this.#dropdownJournalId = null;
    this.#dropdownFilter = '';
    this.#rebuildDropdownList();

    const input = this.element?.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
    if (input) {
      input.value = '';
      requestAnimationFrame(() => input.focus());
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  /**
   * @param {{ journalId: string, targetType: 'journal'|'page'|'heading', pageId?: string|null, headingSlug?: string|null }} target
   */
  #addEntry(target) {
    const currentEntries = this.#getEntries();
    const normalized = this.#normalizeEntry({
      id: foundry.utils.randomID(),
      journalId: target.journalId,
      targetType: target.targetType,
      pageId: target.pageId ?? null,
      headingSlug: target.headingSlug ?? null,
      category: '',
      order: currentEntries.length
    }, currentEntries.length);

    if (!normalized) return;
    if (this.#getExistingTargetKeys().has(this.#buildTargetKey(normalized))) return;

    const entries = this.#reindexEntries([...currentEntries, normalized]);
    this.updateConfig({ entries });
    this.engine.scheduleSave();
    this.#rerender();

    if (this.#isDropdownOpen) {
      requestAnimationFrame(() => {
        const input = this.element?.querySelector('.sessionflow-widget-journal__dropdown-filter-input');
        if (input) input.focus();
      });
    }
  }

  /**
   * @param {string} entryId
   */
  #removeEntry(entryId) {
    const entries = this.#reindexEntries(this.#getEntries().filter(entry => entry.id !== entryId));
    this.updateConfig({ entries });
    this.engine.scheduleSave();
    this.#rerender();
  }

  /**
   * @param {{ targetType: 'journal'|'page'|'heading' }} entry
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   */
  async #openEntry(entry, details) {
    const journal = details.journal;
    if (!journal?.sheet) return;

    const page = details.page;
    const anchor = entry.targetType === 'heading' && details.heading ? details.heading.slug : null;

    try {
      if (!page) {
        await journal.sheet.render(true);
        return;
      }

      await journal.sheet.render(true, {
        pageId: page.id,
        ...(anchor ? { anchor } : {})
      });

      if (typeof journal.sheet.goToPage === 'function') {
        try {
          if (anchor) {
            await journal.sheet.goToPage(page.id, { anchor });
          } else {
            await journal.sheet.goToPage(page.id);
          }
          return;
        } catch {
          try {
            if (anchor) {
              await journal.sheet.goToPage(page.id, anchor);
            } else {
              await journal.sheet.goToPage(page.id);
            }
            return;
          } catch {
            // Fall back to render-only navigation.
          }
        }
      }
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to open journal target:`, err);
    }
  }

  /**
   * Show a journal reference to all connected players.
   * Page and heading targets share the containing page.
   * @param {ReturnType<JournalBoardWidget['#describeEntry']>} details
   */
  async #showToPlayers(details) {
    const shareDocument = details.shareDocument;
    if (!game.user.isGM || !shareDocument) return;

    try {
      if (details.journal?.sheet) {
        await details.journal.sheet.render(true, details.page ? { pageId: details.page.id } : {});
      }

      if (game.journal && typeof game.journal.show === 'function') {
        await game.journal.show(shareDocument);
      } else if (details.journal && typeof details.journal.show === 'function') {
        await details.journal.show(details.page ?? undefined);
      } else {
        return;
      }

      ui.notifications.info(
        game.i18n.format('SESSIONFLOW.Canvas.JournalShownToPlayers', { name: details.title })
      );
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

registerWidgetType(JournalBoardWidget.TYPE, JournalBoardWidget);
