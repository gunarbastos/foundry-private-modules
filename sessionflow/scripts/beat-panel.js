/**
 * SessionFlow - Beat Panel Controller
 * Manages the left slide-in panel that displays beat details and linked scenes.
 * @module beat-panel
 */

import { getSession, getBeats, getScenes, createScene, updateScene, deleteScene } from './session-store.js';

const MODULE_ID = 'sessionflow';

export class BeatPanel {

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {string|null} Session ID that owns the beat */
  #sessionId = null;

  /** @type {string|null} Beat ID being displayed */
  #beatId = null;

  /** @type {string|null} Scene ID currently being inline-edited */
  #editingSceneId = null;

  /** @type {boolean} Whether we're adding a new scene (not yet saved to store) */
  #isCreatingScene = false;

  /** @type {string} */
  #templatePath = `modules/${MODULE_ID}/templates/beat-panel.hbs`;

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Open the panel for a given beat.
   * @param {string} sessionId
   * @param {string} beatId
   */
  async open(sessionId, beatId) {
    if (!sessionId || !beatId) return;

    // If already open for the same beat, skip
    if (this.#isOpen && this.#sessionId === sessionId && this.#beatId === beatId) return;

    this.#sessionId = sessionId;
    this.#beatId = beatId;
    this.#editingSceneId = null;
    this.#isCreatingScene = false;

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
  }

  /** Close the panel (no hook fired). */
  close() {
    if (!this.#isOpen || !this.#element) return;
    // Discard any in-progress edit/creation without rerendering (we're closing)
    this.#editingSceneId = null;
    this.#isCreatingScene = false;
    this.#isOpen = false;
    this.#element.dataset.open = 'false';
  }

  /** Close without firing any hook (prevents circular calls). */
  closeQuiet() {
    this.close();
  }

  /** Re-render just the panel body content. */
  async rerender() {
    if (!this.#element) return;
    await this.#rerenderBody();
    this.#updateAnchorState();
  }

  /** Remove the panel from DOM entirely. */
  destroy() {
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
    this.#sessionId = null;
    this.#beatId = null;
    this.#editingSceneId = null;
    this.#isCreatingScene = false;
  }

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** @returns {string|null} */
  get sessionId() { return this.#sessionId; }

  /** @returns {string|null} */
  get beatId() { return this.#beatId; }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  async #render() {
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    document.body.insertAdjacentHTML('beforeend', html);
    this.#element = document.body.querySelector('.sessionflow-beat-panel');

    if (!this.#element) {
      console.error(`[${MODULE_ID}] Failed to find beat panel element after render!`);
      return;
    }

    this.#activateShellListeners();
    this.#activateBodyListeners();
  }

  async #rerenderBody() {
    if (!this.#element) return;

    const body = this.#element.querySelector('.sessionflow-beat-panel__body');
    const count = this.#element.querySelector('.sessionflow-beat-panel__count');

    // Re-render full template, then extract only the parts we need
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const newBody = temp.querySelector('.sessionflow-beat-panel__body');
    const newCount = temp.querySelector('.sessionflow-beat-panel__count');

    if (body && newBody) body.replaceWith(newBody);

    // Update count badge
    if (count && newCount) count.replaceWith(newCount);
    else if (!count && newCount) {
      const header = this.#element.querySelector('.sessionflow-beat-panel__header');
      const anchorBtn = header?.querySelector('[data-action="toggle-anchor"]');
      if (anchorBtn) header.insertBefore(newCount, anchorBtn);
    } else if (count && !newCount) {
      count.remove();
    }

    // Update beat color on root element
    const session = getSession(this.#sessionId);
    const beats = session?.beats ?? [];
    const beat = beats.find(b => b.id === this.#beatId);
    if (beat?.color) {
      this.#element.style.setProperty('--sf-beat-color', beat.color);
    }
    if (session?.color) {
      this.#element.style.setProperty('--sf-session-color', session.color);
    }

    this.#activateBodyListeners();
  }

  #getTemplateData() {
    const session = getSession(this.#sessionId);
    const beats = session?.beats ?? [];
    const beat = beats.find(b => b.id === this.#beatId);
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');

    // Get Exalted Scenes data
    const exaltedAvailable = this.#isExaltedScenesAvailable();
    const exaltedScenes = exaltedAvailable ? this.#getAllExaltedScenes() : [];

    // Enrich scenes with Exalted Scene data
    const enrichedScenes = scenes.map((sc, i) => {
      const exalted = sc.exaltedSceneId ? this.#getExaltedScene(sc.exaltedSceneId) : null;
      const bg = exalted?.background || '';
      return {
        ...sc,
        background: bg,
        exaltedSceneName: exalted?.name || '',
        hasBackground: !!bg,
        isVideo: this.#isVideoSource(bg),
        index: i
      };
    });

    return {
      // Beat data
      beatTitle: beat?.title ?? '',
      beatText: beat?.text ?? '',
      beatImage: beat?.image ?? '',
      hasBeatImage: !!beat?.image,
      isBeatImageVideo: this.#isVideoSource(beat?.image),
      beatColor: beat?.color || session?.color || '#7c5cbf',
      sessionColor: session?.color || '#7c5cbf',

      // Panel chrome
      title: game.i18n.localize('SESSIONFLOW.BeatPanel.Title'),
      backLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.Back'),
      anchorLabel: game.i18n.localize('SESSIONFLOW.Panel.AnchorPanel'),
      isAnchored: anchor?.panel === 'beat' &&
                  anchor?.sessionId === this.#sessionId &&
                  anchor?.beatId === this.#beatId,
      canEdit: game.user.isGM,

      // Scenes
      scenesLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.ScenesLabel'),
      sceneCount: scenes.length > 0 ? scenes.length : null,
      scenes: enrichedScenes,
      addSceneLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.AddScene'),
      editSceneLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.EditScene'),
      deleteSceneLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.DeleteScene'),
      sceneTitlePlaceholder: game.i18n.localize('SESSIONFLOW.BeatPanel.SceneTitlePlaceholder'),
      selectExaltedLabel: game.i18n.localize('SESSIONFLOW.BeatPanel.SelectExaltedScene'),
      emptyScenesMessage: game.i18n.localize('SESSIONFLOW.BeatPanel.NoScenesYet'),
      emptyScenesSubtitle: game.i18n.localize('SESSIONFLOW.BeatPanel.NoScenesSubtitle'),
      saveLabel: game.i18n.localize('SESSIONFLOW.Panel.SaveEdit'),
      cancelLabel: game.i18n.localize('SESSIONFLOW.Panel.CancelEdit'),

      // Exalted Scenes integration
      exaltedScenesAvailable: exaltedAvailable,
      exaltedScenes: exaltedScenes.map(es => ({
        id: es.id,
        name: es.name
      })),
      exaltedRequiredMessage: game.i18n.localize('SESSIONFLOW.BeatPanel.ExaltedRequired'),
      noExaltedScenesMessage: game.i18n.localize('SESSIONFLOW.BeatPanel.NoExaltedScenes')
    };
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Shell (once)          */
  /* ---------------------------------------- */

  #activateShellListeners() {
    if (!this.#element) return;

    // Close button
    this.#element.querySelector('[data-action="close"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromBeat');
      });

    // Backdrop click
    this.#element.querySelector('.sessionflow-beat-panel__backdrop')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromBeat');
      });

    // Back button
    this.#element.querySelector('[data-action="navigate-back"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBackFromBeat');
      });

    // Anchor button
    this.#element.querySelector('[data-action="toggle-anchor"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:setAnchor', 'beat', this.#sessionId, this.#beatId);
      });

    // Escape key — skip if a Foundry dialog/window is open above us
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        const openDialog = document.querySelector('.dialog .window-content, .app.window-app');
        if (openDialog) return; // Let Foundry handle it
        event.stopPropagation();
        if (this.#editingSceneId) {
          this.#cancelEdit();
        } else {
          Hooks.call('sessionflow:navigateBackFromBeat');
        }
      }
    });
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Body (on re-render)   */
  /* ---------------------------------------- */

  #activateBodyListeners() {
    if (!this.#element) return;
    const body = this.#element.querySelector('.sessionflow-beat-panel__body');
    if (!body) return;

    // Scene card click → select (future: open scene detail)
    body.querySelectorAll('[data-action="select-scene"]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't select if currently in edit mode (title input, select, etc.)
        if (e.currentTarget.classList.contains('is-editing')) return;
        if (e.target.closest('[data-action="edit-scene"]')) return;
        if (e.target.closest('[data-action="delete-scene"]')) return;
        this.#onSelectScene(e);
      });
    });

    // Edit scene button
    body.querySelectorAll('[data-action="edit-scene"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = e.currentTarget.dataset.sceneId;
        this.#beginEdit(sceneId);
      });
    });

    // Delete scene button
    body.querySelectorAll('[data-action="delete-scene"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = e.currentTarget.dataset.sceneId;
        this.#onDeleteScene(sceneId);
      });
    });

    // Add scene button
    body.querySelectorAll('[data-action="add-scene"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#onAddScene();
      });
    });

    // Edit mode listeners (if in edit mode)
    this.#activateEditListeners();
  }

  /* ---------------------------------------- */
  /*  Scene Selection                         */
  /* ---------------------------------------- */

  #onSelectScene(event) {
    const card = event.currentTarget;
    const sceneId = card.dataset.sceneId;

    // Fire hook for future use (scene detail panel)
    Hooks.call('sessionflow:selectScene', this.#sessionId, this.#beatId, sceneId);
  }

  /* ---------------------------------------- */
  /*  Scene Deletion                          */
  /* ---------------------------------------- */

  async #onDeleteScene(sceneId) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.BeatPanel.DeleteScene') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.BeatPanel.ConfirmDeleteScene')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    const result = await deleteScene(this.#sessionId, this.#beatId, sceneId);
    if (result) {
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SceneDeleted'));
      await this.rerender();
    }
  }

  /* ---------------------------------------- */
  /*  Scene Creation                          */
  /* ---------------------------------------- */

  async #onAddScene() {
    // Cancel any existing edit first
    if (this.#editingSceneId) {
      await this.#cancelEdit();
    }

    this.#isCreatingScene = true;
    this.#editingSceneId = '__new__';

    // Get Exalted Scenes for dropdown
    const exaltedScenes = this.#isExaltedScenesAvailable() ? this.#getAllExaltedScenes() : [];

    const selectLabel = game.i18n.localize('SESSIONFLOW.BeatPanel.SelectExaltedScene');
    let optionsHtml = `<option value="">${selectLabel}</option>`;
    for (const es of exaltedScenes) {
      optionsHtml += `<option value="${es.id}">${this.#escapeHtml(es.name)}</option>`;
    }

    // Build the inline creation form as a card
    const formHtml = `
      <article class="sessionflow-scene-card is-editing" data-scene-id="__new__">
        <div class="sessionflow-scene-edit__form">
          <input class="sessionflow-scene-edit__title" type="text"
                 value=""
                 placeholder="${game.i18n.localize('SESSIONFLOW.BeatPanel.SceneTitlePlaceholder')}"
                 data-field="title" />
          <select class="sessionflow-scene-edit__select" data-field="exaltedSceneId">
            ${optionsHtml}
          </select>
          <div class="sessionflow-scene-edit__actions">
            <button type="button" data-action="save-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.SaveEdit')}">
              <i class="fas fa-check"></i>
            </button>
            <button type="button" data-action="cancel-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.CancelEdit')}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </article>
    `;

    // Insert before the add button
    const addBtn = this.#element?.querySelector('[data-action="add-scene"]');
    const sceneList = this.#element?.querySelector('.sessionflow-beat-panel__scene-list');

    if (sceneList) {
      // Append to existing list
      sceneList.insertAdjacentHTML('beforeend', formHtml);
    } else {
      // No list exists (empty state) — replace empty state with list + form
      const emptyState = this.#element?.querySelector('.sessionflow-beat-panel__empty-scenes');
      if (emptyState) {
        const listWrapper = document.createElement('div');
        listWrapper.className = 'sessionflow-beat-panel__scene-list';
        listWrapper.innerHTML = formHtml;
        emptyState.replaceWith(listWrapper);
      }
    }

    this.#activateEditListeners();

    // Focus and scroll into view
    const newCard = this.#element?.querySelector('[data-scene-id="__new__"]');
    newCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const titleInput = newCard?.querySelector('[data-field="title"]');
    titleInput?.focus();
  }

  /* ---------------------------------------- */
  /*  Inline Editing                          */
  /* ---------------------------------------- */

  async #beginEdit(sceneId) {
    // Cancel any existing edit first
    if (this.#editingSceneId) {
      await this.#cancelEdit();
    }

    this.#editingSceneId = sceneId;
    const scenes = getScenes(this.#sessionId, this.#beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene) return;

    const card = this.#element?.querySelector(`[data-scene-id="${sceneId}"]`);
    if (!card) return;

    card.classList.add('is-editing');

    // Get Exalted Scenes for dropdown
    const exaltedScenes = this.#isExaltedScenesAvailable() ? this.#getAllExaltedScenes() : [];

    // Build options HTML for select
    const selectLabel = game.i18n.localize('SESSIONFLOW.BeatPanel.SelectExaltedScene');
    let optionsHtml = `<option value="">${selectLabel}</option>`;
    for (const es of exaltedScenes) {
      const selected = es.id === scene.exaltedSceneId ? 'selected' : '';
      optionsHtml += `<option value="${es.id}" ${selected}>${this.#escapeHtml(es.name)}</option>`;
    }

    // Replace card content with edit form
    card.innerHTML = `
      <div class="sessionflow-scene-edit__form">
        <input class="sessionflow-scene-edit__title" type="text"
               value="${this.#escapeHtml(scene.title)}"
               placeholder="${game.i18n.localize('SESSIONFLOW.BeatPanel.SceneTitlePlaceholder')}"
               data-field="title" />
        <select class="sessionflow-scene-edit__select" data-field="exaltedSceneId">
          ${optionsHtml}
        </select>
        <div class="sessionflow-scene-edit__actions">
          <button type="button" data-action="save-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.SaveEdit')}">
            <i class="fas fa-check"></i>
          </button>
          <button type="button" data-action="cancel-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.CancelEdit')}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;

    this.#activateEditListeners();

    // Auto-focus title input
    const titleInput = card.querySelector('[data-field="title"]');
    titleInput?.focus();
    titleInput?.select();
  }

  async #saveEdit() {
    if (!this.#editingSceneId) return;

    const card = this.#element?.querySelector(`[data-scene-id="${this.#editingSceneId}"]`);
    if (!card) return;

    const titleInput = card.querySelector('[data-field="title"]');
    const selectInput = card.querySelector('[data-field="exaltedSceneId"]');

    const title = titleInput?.value.trim() || game.i18n.localize('SESSIONFLOW.BeatPanel.AddScene');
    const exaltedSceneId = selectInput?.value || '';

    if (this.#isCreatingScene) {
      // Create new scene in store now
      await createScene(this.#sessionId, this.#beatId, { title, exaltedSceneId });
      this.#isCreatingScene = false;
      this.#editingSceneId = null;
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SceneCreated'));
    } else {
      // Update existing scene
      const changes = { title, exaltedSceneId };
      await updateScene(this.#sessionId, this.#beatId, this.#editingSceneId, changes);
      this.#editingSceneId = null;
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SceneUpdated'));
    }

    await this.rerender();
  }

  async #cancelEdit() {
    if (!this.#editingSceneId) return;
    this.#isCreatingScene = false;
    this.#editingSceneId = null;
    await this.rerender();
  }

  #activateEditListeners() {
    if (!this.#element) return;

    const editingCard = this.#element.querySelector('.sessionflow-scene-card.is-editing');
    if (!editingCard) return;

    // Save button
    editingCard.querySelector('[data-action="save-edit"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#saveEdit();
      });

    // Cancel button
    editingCard.querySelector('[data-action="cancel-edit"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#cancelEdit();
      });

    // Enter key on title input saves
    editingCard.querySelector('[data-field="title"]')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#saveEdit();
        }
      });
  }

  /* ---------------------------------------- */
  /*  Exalted Scenes Integration              */
  /* ---------------------------------------- */

  /**
   * Check if Exalted Scenes module is available and ready.
   * @returns {boolean}
   */
  #isExaltedScenesAvailable() {
    const mod = game.modules.get('exalted-scenes');
    return mod?.active && mod?.api?.isReady;
  }

  /**
   * Get all scenes from Exalted Scenes module.
   * @returns {object[]}
   */
  #getAllExaltedScenes() {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return [];
      return api.scenes.getAll() ?? [];
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Scenes:`, err);
      return [];
    }
  }

  /**
   * Get a single scene from Exalted Scenes module.
   * @param {string} sceneId - Exalted Scenes scene ID.
   * @returns {object|null}
   */
  #getExaltedScene(sceneId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return null;
      return api.scenes.get(sceneId) ?? null;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Scene ${sceneId}:`, err);
      return null;
    }
  }

  /* ---------------------------------------- */
  /*  Anchor State                            */
  /* ---------------------------------------- */

  #updateAnchorState() {
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');
    const btn = this.#element?.querySelector('[data-action="toggle-anchor"]');
    btn?.classList.toggle('is-active',
      anchor?.panel === 'beat' &&
      anchor?.sessionId === this.#sessionId &&
      anchor?.beatId === this.#beatId);
  }

  /* ---------------------------------------- */
  /*  Utilities                               */
  /* ---------------------------------------- */

  #isVideoSource(src) {
    if (!src) return false;
    const ext = src.split('.').pop()?.toLowerCase()?.split('?')[0];
    return ['mp4', 'webm', 'm4v'].includes(ext);
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }
}
