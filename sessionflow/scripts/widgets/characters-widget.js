/**
 * SessionFlow - Characters Widget
 * Displays the scene cast with add/remove controls.
 * Migrated from the right column of the original scene panel.
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

  /** @type {boolean} */
  #isDropdownOpen = false;

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

    // Get cast (no artificial cap — Exalted Scenes enforces its own limit)
    const rawCast = this.#getCast(scene.exaltedSceneId);
    const cast = rawCast.map(member => {
      const character = this.#getExaltedCharacter(member.id);
      return {
        id: member.id,
        name: character?.name || member.name,
        image: character?.image || member.image
      };
    });

    // Get available characters for dropdown
    const castIds = new Set(cast.map(c => c.id));
    const allChars = this.#getAllExaltedCharacters();
    const availableCharacters = allChars
      .filter(ch => !castIds.has(ch.id))
      .map(ch => ({ id: ch.id, name: ch.name, image: ch.image }));

    // Header with count + add button
    const header = document.createElement('header');
    header.className = 'sessionflow-widget-characters__header';

    const headerIcon = document.createElement('i');
    headerIcon.className = 'fas fa-users';
    header.appendChild(headerIcon);

    const headerTitle = document.createElement('span');
    headerTitle.className = 'sessionflow-widget-characters__header-title';
    headerTitle.textContent = game.i18n.localize('SESSIONFLOW.ScenePanel.CharactersLabel');
    header.appendChild(headerTitle);

    if (cast.length > 0) {
      const count = document.createElement('span');
      count.className = 'sessionflow-widget-characters__count';
      count.textContent = cast.length;
      header.appendChild(count);
    }

    // Add button (GM only)
    if (game.user.isGM) {
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

      if (availableCharacters.length > 0) {
        for (const ch of availableCharacters) {
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

          dropdown.appendChild(item);
        }
      } else {
        const empty = document.createElement('div');
        empty.className = 'sessionflow-widget-characters__dropdown-empty';
        empty.textContent = game.i18n.localize('SESSIONFLOW.ScenePanel.NoExaltedCharacters');
        dropdown.appendChild(empty);
      }

      addWrapper.appendChild(dropdown);
      header.appendChild(addWrapper);
    }

    container.appendChild(header);

    // Character grid or empty state
    if (cast.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'sessionflow-widget-characters__grid';

      // Responsive columns based on current width
      this.#applyGridColumns(grid, this.width);

      cast.forEach((ch, index) => {
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

        grid.appendChild(item);
      });

      container.appendChild(grid);
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
  /*  Responsive Layout                       */
  /* ---------------------------------------- */

  onResize(width, height) {
    const grid = this.element?.querySelector('.sessionflow-widget-characters__grid');
    if (grid) this.#applyGridColumns(grid, width);
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
