/**
 * SessionFlow - Characters Widget
 * Displays the scene cast with search, dual view modes (grid/list),
 * folder grouping from Exalted Scenes, tag badges, and add/remove controls.
 * @module widgets/characters-widget
 */

import { Widget, registerWidgetType } from '../widget.js';
import { getScenes } from '../session-store.js';

const MODULE_ID = 'sessionflow';

export class CharactersWidget extends Widget {

  static TYPE = 'characters';
  static LABEL = 'SESSIONFLOW.Canvas.Characters';
  static ICON = 'fas fa-users';
  static MIN_WIDTH = 180;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 240;
  static DEFAULT_HEIGHT = 340;
  static MAX_INSTANCES = 1;
  static HELP = 'SESSIONFLOW.Help.Characters';

  /* ---- Private state (transient) ---- */

  /** @type {boolean} */
  #isDropdownOpen = false;

  /** @type {string} Live search filter for the cast list */
  #searchQuery = '';

  /** @type {string} Live search filter for the add dropdown */
  #dropdownSearchQuery = '';

  /* ---- Config accessors ---- */

  #getViewMode() {
    return this.config.viewMode ?? 'list';
  }

  #getCollapsedFolders() {
    return this.config.collapsedFolders ?? [];
  }

  #isCollapsed(folderId) {
    const key = folderId ?? '__unfiled__';
    return this.#getCollapsedFolders().includes(key);
  }

  #toggleFolderCollapse(folderId) {
    const key = folderId ?? '__unfiled__';
    const collapsed = [...this.#getCollapsedFolders()];
    const idx = collapsed.indexOf(key);
    if (idx >= 0) collapsed.splice(idx, 1);
    else collapsed.push(key);
    this.updateConfig({ collapsedFolders: collapsed });
    this.engine.scheduleSave();
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.Characters');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';
    this.#isDropdownOpen = false;
    this.#dropdownSearchQuery = '';

    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);

    const exaltedAvailable = this.#isExaltedScenesAvailable();

    // Container
    const container = document.createElement('div');
    container.className = 'sessionflow-widget-characters';

    if (!exaltedAvailable) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-puzzle-piece',
        game.i18n.localize('SESSIONFLOW.ScenePanel.ExaltedRequired')
      ));
      bodyEl.appendChild(container);
      return;
    }

    if (!scene?.exaltedSceneId) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-link-slash',
        game.i18n.localize('SESSIONFLOW.ScenePanel.ExaltedRequired')
      ));
      bodyEl.appendChild(container);
      return;
    }

    // Prepare data
    const data = this.#prepareCastData(scene.exaltedSceneId);

    // Header
    container.appendChild(this.#buildHeader(data));

    if (data.cast.length > 0) {
      // Search bar
      container.appendChild(this.#buildSearchBar());

      // Content area
      const content = document.createElement('div');
      content.className = 'sessionflow-widget-characters__content';
      this.#renderContent(content, data);
      container.appendChild(content);
    } else {
      container.appendChild(this.#buildEmptyState(
        'fas fa-users',
        game.i18n.localize('SESSIONFLOW.ScenePanel.NoCharactersYet'),
        game.i18n.localize('SESSIONFLOW.ScenePanel.NoCharactersSubtitle')
      ));
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Data Preparation                        */
  /* ---------------------------------------- */

  /**
   * Enriches cast data with folder and tag info, groups by folder.
   * @param {string} exaltedSceneId
   * @returns {{ cast, folderGroups: Map, folders: Array, availableCharacters: Array }}
   */
  #prepareCastData(exaltedSceneId) {
    // Get cast
    const rawCast = this.#getCast(exaltedSceneId);
    const cast = rawCast.map(member => {
      const character = this.#getExaltedCharacter(member.id);
      return {
        id: member.id,
        name: character?.name || member.name,
        image: character?.image || member.image,
        folder: character?.folder ?? null,
        tags: character?.tags ? [...character.tags] : []
      };
    });

    // Get folders
    const folders = this.#getExaltedFolders();

    // Group cast by folder
    const folderGroups = new Map();
    for (const ch of cast) {
      const key = ch.folder;
      if (!folderGroups.has(key)) folderGroups.set(key, []);
      folderGroups.get(key).push(ch);
    }

    // Available characters for add dropdown
    const castIds = new Set(cast.map(c => c.id));
    const allChars = this.#getAllExaltedCharacters();
    const availableCharacters = allChars
      .filter(ch => !castIds.has(ch.id))
      .map(ch => {
        const full = this.#getExaltedCharacter(ch.id);
        return {
          id: ch.id,
          name: ch.name,
          image: ch.image,
          folder: full?.folder ?? null,
          tags: full?.tags ? [...full.tags] : []
        };
      });

    return { cast, folderGroups, folders, availableCharacters };
  }

  /**
   * Returns ordered folder entries for rendering. Named folders first (sorted), unfiled last.
   * @param {Map} folderGroups
   * @param {Array} folders
   * @returns {{ folderId: string|null, folderName: string, folderColor: string|null, characters: Array }[]}
   */
  #getOrderedGroups(folderGroups, folders) {
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const groups = [];

    // Named folders (sorted by name)
    const namedKeys = [...folderGroups.keys()].filter(k => k !== null && folderMap.has(k));
    namedKeys.sort((a, b) => (folderMap.get(a)?.name ?? '').localeCompare(folderMap.get(b)?.name ?? ''));

    for (const key of namedKeys) {
      const folder = folderMap.get(key);
      groups.push({
        folderId: key,
        folderName: folder?.name ?? key,
        folderColor: folder?.color ?? null,
        characters: folderGroups.get(key)
      });
    }

    // Unfiled (null key + any folder IDs not in the folder list)
    const unfiledChars = [];
    for (const [key, chars] of folderGroups) {
      if (key === null || !folderMap.has(key)) {
        unfiledChars.push(...chars);
      }
    }
    if (unfiledChars.length > 0) {
      groups.push({
        folderId: null,
        folderName: game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersUnfiled'),
        folderColor: null,
        characters: unfiledChars
      });
    }

    return groups;
  }

  /* ---------------------------------------- */
  /*  Header                                  */
  /* ---------------------------------------- */

  #buildHeader(data) {
    const header = document.createElement('header');
    header.className = 'sessionflow-widget-characters__header';

    const headerIcon = document.createElement('i');
    headerIcon.className = 'fas fa-users';
    header.appendChild(headerIcon);

    const headerTitle = document.createElement('span');
    headerTitle.className = 'sessionflow-widget-characters__header-title';
    headerTitle.textContent = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersLabel');
    header.appendChild(headerTitle);

    if (data.cast.length > 0) {
      const count = document.createElement('span');
      count.className = 'sessionflow-widget-characters__count';
      count.textContent = data.cast.length;
      header.appendChild(count);
    }

    // View toggle
    if (data.cast.length > 0) {
      header.appendChild(this.#buildViewToggle());
    }

    // Add button (GM only)
    if (game.user.isGM) {
      header.appendChild(this.#buildAddButton(data));
    }

    return header;
  }

  /* ---------------------------------------- */
  /*  View Toggle                             */
  /* ---------------------------------------- */

  #buildViewToggle() {
    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-characters__view-toggle';
    const viewMode = this.#getViewMode();

    const listBtn = document.createElement('button');
    listBtn.className = 'sessionflow-widget-characters__view-btn';
    if (viewMode === 'list') listBtn.classList.add('is-active');
    listBtn.type = 'button';
    listBtn.title = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersViewList');
    listBtn.innerHTML = '<i class="fas fa-list"></i>';
    listBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateConfig({ viewMode: 'list' });
      this.engine.scheduleSave();
      this.refreshBody();
    });
    wrapper.appendChild(listBtn);

    const gridBtn = document.createElement('button');
    gridBtn.className = 'sessionflow-widget-characters__view-btn';
    if (viewMode === 'grid') gridBtn.classList.add('is-active');
    gridBtn.type = 'button';
    gridBtn.title = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersViewGrid');
    gridBtn.innerHTML = '<i class="fas fa-th-large"></i>';
    gridBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateConfig({ viewMode: 'grid' });
      this.engine.scheduleSave();
      this.refreshBody();
    });
    wrapper.appendChild(gridBtn);

    return wrapper;
  }

  /* ---------------------------------------- */
  /*  Search Bar                              */
  /* ---------------------------------------- */

  #buildSearchBar() {
    const bar = document.createElement('div');
    bar.className = 'sessionflow-widget-characters__search';

    const icon = document.createElement('i');
    icon.className = 'fas fa-search sessionflow-widget-characters__search-icon';
    bar.appendChild(icon);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sessionflow-widget-characters__search-input';
    input.placeholder = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersSearch');
    input.value = this.#searchQuery;
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#searchQuery = e.target.value;
      this.#rebuildContent();
    });
    bar.appendChild(input);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sessionflow-widget-characters__search-clear';
    clearBtn.innerHTML = '<i class="fas fa-times"></i>';
    clearBtn.style.display = this.#searchQuery ? '' : 'none';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#searchQuery = '';
      input.value = '';
      clearBtn.style.display = 'none';
      this.#rebuildContent();
    });
    bar.appendChild(clearBtn);

    return bar;
  }

  /* ---------------------------------------- */
  /*  Content Rendering                       */
  /* ---------------------------------------- */

  /**
   * Re-renders just the content area (preserving search focus).
   */
  #rebuildContent() {
    const content = this.element?.querySelector('.sessionflow-widget-characters__content');
    if (!content) return;

    // Re-prepare data (needed for filtering)
    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene?.exaltedSceneId) return;

    const data = this.#prepareCastData(scene.exaltedSceneId);
    this.#renderContent(content, data);

    // Update clear button visibility
    const clearBtn = this.element?.querySelector('.sessionflow-widget-characters__search-clear');
    if (clearBtn) clearBtn.style.display = this.#searchQuery ? '' : 'none';
  }

  /**
   * Renders the cast content into the given container.
   */
  #renderContent(container, data) {
    container.innerHTML = '';
    const viewMode = this.#getViewMode();
    const query = this.#searchQuery.toLowerCase().trim();

    // Filter cast by search
    const filteredCast = query
      ? data.cast.filter(ch => ch.name.toLowerCase().includes(query))
      : data.cast;

    if (filteredCast.length === 0 && query) {
      container.appendChild(this.#buildEmptyState(
        'fas fa-search',
        game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersNoResults')
      ));
      return;
    }

    // Rebuild folder groups with filtered cast
    const filteredGroups = new Map();
    for (const ch of filteredCast) {
      const key = ch.folder;
      if (!filteredGroups.has(key)) filteredGroups.set(key, []);
      filteredGroups.get(key).push(ch);
    }

    const orderedGroups = this.#getOrderedGroups(filteredGroups, data.folders);
    const showFolderHeaders = orderedGroups.length > 1 || (orderedGroups.length === 1 && orderedGroups[0].folderId !== null);

    if (viewMode === 'list') {
      this.#buildListView(container, orderedGroups, showFolderHeaders);
    } else {
      this.#buildGridView(container, orderedGroups, showFolderHeaders);
    }
  }

  /* ---------------------------------------- */
  /*  List View                               */
  /* ---------------------------------------- */

  #buildListView(container, orderedGroups, showFolderHeaders) {
    const list = document.createElement('div');
    list.className = 'sessionflow-widget-characters__list';
    let charIndex = 0;

    for (const group of orderedGroups) {
      if (showFolderHeaders) {
        list.appendChild(this.#buildFolderHeader(group));
      }

      if (!this.#isCollapsed(group.folderId) || !showFolderHeaders) {
        const content = document.createElement('div');
        content.className = 'sessionflow-widget-characters__folder-content';

        for (const ch of group.characters) {
          content.appendChild(this.#buildListRow(ch, charIndex++));
        }

        list.appendChild(content);
      }
    }

    container.appendChild(list);
  }

  #buildListRow(ch, index) {
    const row = document.createElement('div');
    row.className = 'sessionflow-widget-characters__list-row';
    row.style.setProperty('--sf-char-index', index);

    // Portrait
    const portrait = document.createElement('div');
    portrait.className = 'sessionflow-widget-characters__list-portrait';
    if (ch.image) {
      portrait.innerHTML = `<img src="${this.#escapeAttr(ch.image)}" alt="${this.#escapeAttr(ch.name)}" />`;
    } else {
      portrait.innerHTML = '<i class="fas fa-user"></i>';
    }
    row.appendChild(portrait);

    // Info: name + tags
    const info = document.createElement('div');
    info.className = 'sessionflow-widget-characters__list-info';

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-characters__list-name';
    name.textContent = ch.name;
    info.appendChild(name);

    if (ch.tags && ch.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'sessionflow-widget-characters__tags';
      for (const tag of ch.tags) {
        const pill = document.createElement('span');
        pill.className = 'sessionflow-widget-characters__tag';
        pill.textContent = tag;
        tags.appendChild(pill);
      }
      info.appendChild(tags);
    }

    row.appendChild(info);

    // Remove button (GM only)
    if (game.user.isGM) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'sessionflow-widget-characters__list-remove';
      removeBtn.type = 'button';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.ScenePanel.RemoveCharacter');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#onRemoveCharacter(ch.id);
      });
      row.appendChild(removeBtn);
    }

    // Click to open character panel
    row.addEventListener('click', (e) => {
      if (e.target.closest('.sessionflow-widget-characters__list-remove')) return;
      e.stopPropagation();
      Hooks.call('sessionflow:selectCharacter', ch.id, this.context);
    });
    row.style.cursor = 'pointer';

    return row;
  }

  /* ---------------------------------------- */
  /*  Grid View                               */
  /* ---------------------------------------- */

  #buildGridView(container, orderedGroups, showFolderHeaders) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-characters__grid-wrapper';
    let charIndex = 0;

    for (const group of orderedGroups) {
      if (showFolderHeaders) {
        wrapper.appendChild(this.#buildFolderHeader(group));
      }

      if (!this.#isCollapsed(group.folderId) || !showFolderHeaders) {
        const grid = document.createElement('div');
        grid.className = 'sessionflow-widget-characters__grid';
        this.#applyGridColumns(grid, this.width);

        for (const ch of group.characters) {
          grid.appendChild(this.#buildGridCard(ch, charIndex++));
        }

        wrapper.appendChild(grid);
      }
    }

    container.appendChild(wrapper);
  }

  #buildGridCard(ch, index) {
    const item = document.createElement('div');
    item.className = 'sessionflow-widget-characters__character';
    item.style.setProperty('--sf-char-index', index);

    const portrait = document.createElement('div');
    portrait.className = 'sessionflow-widget-characters__portrait';
    if (ch.image) {
      portrait.innerHTML = `<img src="${this.#escapeAttr(ch.image)}" alt="${this.#escapeAttr(ch.name)}" />`;
    } else {
      portrait.innerHTML = '<i class="fas fa-user"></i>';
    }
    item.appendChild(portrait);

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-characters__name';
    name.textContent = ch.name;
    item.appendChild(name);

    // Remove button (GM only)
    if (game.user.isGM) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'sessionflow-widget-characters__remove-btn';
      removeBtn.type = 'button';
      removeBtn.title = game.i18n.localize('SESSIONFLOW.ScenePanel.RemoveCharacter');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.dataset.characterId = ch.id;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#onRemoveCharacter(ch.id);
      });
      item.appendChild(removeBtn);
    }

    // Click portrait to open character panel
    item.addEventListener('click', (e) => {
      if (e.target.closest('.sessionflow-widget-characters__remove-btn')) return;
      e.stopPropagation();
      Hooks.call('sessionflow:selectCharacter', ch.id, this.context);
    });
    item.style.cursor = 'pointer';

    return item;
  }

  /* ---------------------------------------- */
  /*  Folder Header                           */
  /* ---------------------------------------- */

  #buildFolderHeader(group) {
    const header = document.createElement('div');
    header.className = 'sessionflow-widget-characters__folder-header';
    if (this.#isCollapsed(group.folderId)) header.classList.add('is-collapsed');

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down sessionflow-widget-characters__folder-chevron';
    header.appendChild(chevron);

    const icon = document.createElement('i');
    icon.className = group.folderId ? 'fas fa-folder' : 'fas fa-folder-open';
    icon.classList.add('sessionflow-widget-characters__folder-icon');
    if (group.folderColor) icon.style.color = group.folderColor;
    header.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'sessionflow-widget-characters__folder-name';
    name.textContent = group.folderName;
    header.appendChild(name);

    const count = document.createElement('span');
    count.className = 'sessionflow-widget-characters__folder-count';
    count.textContent = group.characters.length;
    header.appendChild(count);

    header.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleFolderCollapse(group.folderId);
      this.#rebuildContent();
    });

    return header;
  }

  /* ---------------------------------------- */
  /*  Add Button + Dropdown                   */
  /* ---------------------------------------- */

  #buildAddButton(data) {
    const addWrapper = document.createElement('div');
    addWrapper.className = 'sessionflow-widget-characters__add-wrapper';

    const addBtn = document.createElement('button');
    addBtn.className = 'sessionflow-widget-characters__add-btn';
    addBtn.type = 'button';
    addBtn.title = game.i18n.localize('SESSIONFLOW.ScenePanel.AddCharacter');
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleDropdown();
    });
    addWrapper.appendChild(addBtn);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-characters__dropdown';
    this.#buildDropdownContent(dropdown, data);
    addWrapper.appendChild(dropdown);

    return addWrapper;
  }

  #buildDropdownContent(dropdown, data) {
    dropdown.innerHTML = '';

    // Search input
    const searchRow = document.createElement('div');
    searchRow.className = 'sessionflow-widget-characters__dropdown-search';

    const searchIcon = document.createElement('i');
    searchIcon.className = 'fas fa-search';
    searchRow.appendChild(searchIcon);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersSearch');
    searchInput.value = this.#dropdownSearchQuery;
    searchInput.addEventListener('input', (e) => {
      e.stopPropagation();
      this.#dropdownSearchQuery = e.target.value;
      this.#rebuildDropdownList();
    });
    searchRow.appendChild(searchInput);
    dropdown.appendChild(searchRow);

    // List area
    const listArea = document.createElement('div');
    listArea.className = 'sessionflow-widget-characters__dropdown-list';
    dropdown.appendChild(listArea);

    this.#renderDropdownList(listArea, data);
  }

  #rebuildDropdownList() {
    const listArea = this.element?.querySelector('.sessionflow-widget-characters__dropdown-list');
    if (!listArea) return;

    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene?.exaltedSceneId) return;

    const data = this.#prepareCastData(scene.exaltedSceneId);
    this.#renderDropdownList(listArea, data);
  }

  #renderDropdownList(listArea, data) {
    listArea.innerHTML = '';
    const query = this.#dropdownSearchQuery.toLowerCase().trim();

    const available = query
      ? data.availableCharacters.filter(ch => ch.name.toLowerCase().includes(query))
      : data.availableCharacters;

    if (available.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sessionflow-widget-characters__dropdown-empty';
      empty.textContent = query
        ? game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersNoResults')
        : game.i18n.localize('SESSIONFLOW.ScenePanel.NoExaltedCharacters');
      listArea.appendChild(empty);
      return;
    }

    // Group by folder
    const groups = new Map();
    for (const ch of available) {
      const key = ch.folder;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ch);
    }

    const orderedGroups = this.#getOrderedGroups(groups, data.folders);
    const showHeaders = orderedGroups.length > 1 || (orderedGroups.length === 1 && orderedGroups[0].folderId !== null);

    for (const group of orderedGroups) {
      if (showHeaders) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'sessionflow-widget-characters__dropdown-folder';
        if (group.folderColor) {
          const folderIcon = document.createElement('i');
          folderIcon.className = 'fas fa-folder';
          folderIcon.style.color = group.folderColor;
          sectionHeader.appendChild(folderIcon);
        }
        const folderLabel = document.createElement('span');
        folderLabel.textContent = group.folderName;
        sectionHeader.appendChild(folderLabel);
        listArea.appendChild(sectionHeader);
      }

      for (const ch of group.characters) {
        const item = document.createElement('button');
        item.className = 'sessionflow-widget-characters__dropdown-item';
        item.type = 'button';
        item.dataset.characterId = ch.id;

        const portrait = document.createElement('div');
        portrait.className = 'sessionflow-widget-characters__dropdown-portrait';
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
          this.#onAddCharacter(ch.id);
        });

        listArea.appendChild(item);
      }
    }
  }

  /* ---------------------------------------- */
  /*  Responsive Layout                       */
  /* ---------------------------------------- */

  onResize(width, height) {
    if (this.#getViewMode() === 'grid') {
      const grids = this.element?.querySelectorAll('.sessionflow-widget-characters__grid');
      if (grids) {
        for (const grid of grids) this.#applyGridColumns(grid, width);
      }
    }
  }

  #applyGridColumns(gridEl, width) {
    const cols = width < 200 ? 1 : width < 350 ? 2 : 3;
    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }

  /* ---------------------------------------- */
  /*  Character Management                    */
  /* ---------------------------------------- */

  async #onAddCharacter(characterId) {
    if (!characterId) return;

    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene?.exaltedSceneId) return;

    const success = await this.#addCastMember(scene.exaltedSceneId, characterId);
    if (success) {
      this.#isDropdownOpen = false;
      this.#dropdownSearchQuery = '';
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.CharacterAdded'));
      this.refreshBody();
    }
  }

  async #onRemoveCharacter(characterId) {
    if (!characterId) return;

    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene?.exaltedSceneId) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.ScenePanel.RemoveCharacter') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.ScenePanel.ConfirmRemoveCharacter')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    const success = await this.#removeCastMember(scene.exaltedSceneId, characterId);
    if (success) {
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.CharacterRemoved'));
      this.refreshBody();
    }
  }

  /* ---------------------------------------- */
  /*  Dropdown                                */
  /* ---------------------------------------- */

  #toggleDropdown() {
    this.#isDropdownOpen = !this.#isDropdownOpen;
    const dropdown = this.element?.querySelector('.sessionflow-widget-characters__dropdown');
    dropdown?.classList.toggle('is-visible', this.#isDropdownOpen);

    // Focus search input when opening
    if (this.#isDropdownOpen) {
      const input = dropdown?.querySelector('input');
      if (input) setTimeout(() => input.focus(), 50);
    } else {
      this.#dropdownSearchQuery = '';
    }
  }

  /* ---------------------------------------- */
  /*  Empty State Builder                     */
  /* ---------------------------------------- */

  #buildEmptyState(iconClass, title, subtitle = '') {
    const el = document.createElement('div');
    el.className = 'sessionflow-widget-characters__empty';
    el.innerHTML = `
      <i class="${iconClass}"></i>
      <p class="sessionflow-widget-characters__empty-title">${this.#escapeHtml(title)}</p>
      ${subtitle ? `<p class="sessionflow-widget-characters__empty-subtitle">${this.#escapeHtml(subtitle)}</p>` : ''}
    `;
    return el;
  }

  /* ---------------------------------------- */
  /*  Exalted Scenes Helpers                  */
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

  #getExaltedFolders() {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady || !api?.folders) return [];
      return api.folders.getAll('character') ?? [];
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Folders:`, err);
      return [];
    }
  }

  #getCast(exaltedSceneId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return [];
      return api.scenes.getCast(exaltedSceneId) ?? [];
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get cast for scene ${exaltedSceneId}:`, err);
      return [];
    }
  }

  async #addCastMember(exaltedSceneId, characterId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return false;
      try {
        const result = await api.scenes.addCastMember(exaltedSceneId, characterId);
        if (result && !result.success) {
          console.warn(`[${MODULE_ID}] addCastMember rejected:`, result.error);
          return false;
        }
      } catch (apiErr) {
        console.warn(`[${MODULE_ID}] addCastMember threw (data likely saved):`, apiErr.message);
      }
      return true;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to add cast member:`, err);
      return false;
    }
  }

  async #removeCastMember(exaltedSceneId, characterId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return false;
      try {
        const result = await api.scenes.removeCastMember(exaltedSceneId, characterId);
        if (result && !result.success) {
          console.warn(`[${MODULE_ID}] removeCastMember rejected:`, result.error);
          return false;
        }
      } catch (apiErr) {
        console.warn(`[${MODULE_ID}] removeCastMember threw (data likely saved):`, apiErr.message);
      }
      return true;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to remove cast member:`, err);
      return false;
    }
  }

  /* ---------------------------------------- */
  /*  Utilities                               */
  /* ---------------------------------------- */

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  #escapeAttr(str) {
    return (str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

// Auto-register
registerWidgetType(CharactersWidget.TYPE, CharactersWidget);
