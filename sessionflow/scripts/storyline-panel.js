/**
 * SessionFlow - Storyline Panel Controller
 * Manages the bottom slide-up panel that displays story beats for a session.
 * @module storyline-panel
 */

import { getSession, getBeats, createBeat, updateBeat, deleteBeat, reorderBeats } from './session-store.js';

const MODULE_ID = 'sessionflow';

export class StorylinePanel {

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {string|null} Session ID whose beats are displayed */
  #sessionId = null;

  /** @type {string|null} Beat ID currently being inline-edited */
  #editingBeatId = null;

  /** @type {string|null} Beat ID currently being dragged for reorder */
  #dragBeatId = null;

  /** @type {string} */
  #templatePath = `modules/${MODULE_ID}/templates/storyline-panel.hbs`;

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /**
   * Open the panel for a given session.
   * @param {string} sessionId
   */
  async open(sessionId) {
    if (!sessionId) return;

    // If already open for a different session, just update content
    if (this.#isOpen && this.#sessionId === sessionId) return;

    this.#sessionId = sessionId;
    this.#editingBeatId = null;

    if (!this.#element) {
      await this.#render();
    } else {
      await this.#rerenderBody();
    }

    this.#isOpen = true;
    this.#element.dataset.open = 'true';
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    this.#cancelEdit();
    this.#isOpen = false;
    this.#element.dataset.open = 'false';
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
    this.#editingBeatId = null;
  }

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** @returns {string|null} */
  get sessionId() { return this.#sessionId; }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  async #render() {
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    document.body.insertAdjacentHTML('beforeend', html);
    this.#element = document.body.querySelector('.sessionflow-storyline');

    if (!this.#element) {
      console.error(`[${MODULE_ID}] Failed to find storyline panel element after render!`);
      return;
    }

    this.#activateShellListeners();
    this.#activateBodyListeners();
  }

  async #rerenderBody() {
    if (!this.#element) return;

    const body = this.#element.querySelector('.sessionflow-storyline__body');
    const count = this.#element.querySelector('.sessionflow-storyline__count');
    const sessionName = this.#element.querySelector('.sessionflow-storyline__session-name');

    // Re-render full template, then extract only the parts we need
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const newBody = temp.querySelector('.sessionflow-storyline__body');
    const newCount = temp.querySelector('.sessionflow-storyline__count');
    const newSessionName = temp.querySelector('.sessionflow-storyline__session-name');

    if (body && newBody) body.replaceWith(newBody);

    // Update count badge
    if (count && newCount) count.replaceWith(newCount);
    else if (!count && newCount) {
      const header = this.#element.querySelector('.sessionflow-storyline__header');
      const closeBtn = header?.querySelector('.sessionflow-storyline__close');
      if (closeBtn) header.insertBefore(newCount, closeBtn);
    } else if (count && !newCount) {
      count.remove();
    }

    // Update session name
    if (sessionName && newSessionName) sessionName.replaceWith(newSessionName);

    // Update session color
    const session = getSession(this.#sessionId);
    if (session) {
      this.#element.style.setProperty('--sf-session-color', session.color);
    }

    this.#activateBodyListeners();
  }

  #getTemplateData() {
    const session = getSession(this.#sessionId);
    const beats = getBeats(this.#sessionId);
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');

    return {
      sessionName: session?.name ?? '',
      sessionColor: session?.color ?? '#7c5cbf',
      title: game.i18n.localize('SESSIONFLOW.Storyline.Title'),
      emptyMessage: game.i18n.localize('SESSIONFLOW.Storyline.NoBeats'),
      emptySubtitle: game.i18n.localize('SESSIONFLOW.Storyline.NoBeatsSubtitle'),
      addBeatLabel: game.i18n.localize('SESSIONFLOW.Storyline.AddBeat'),
      editLabel: game.i18n.localize('SESSIONFLOW.Storyline.EditBeat'),
      deleteLabel: game.i18n.localize('SESSIONFLOW.Storyline.DeleteBeat'),
      anchorLabel: game.i18n.localize('SESSIONFLOW.Panel.AnchorPanel'),
      backLabel: game.i18n.localize('SESSIONFLOW.Storyline.Back'),
      beatCount: beats.length > 0 ? beats.length : null,
      isAnchored: anchor?.panel === 'storyline' && anchor?.sessionId === this.#sessionId,
      canEdit: game.user.isGM,
      beats: beats.map((b, i) => ({
        ...b,
        isEditing: b.id === this.#editingBeatId,
        hasImage: !!b.image,
        isVideo: this.#isVideoSource(b.image),
        displayNumber: i + 1,
        index: i
      }))
    };
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Shell (once)          */
  /* ---------------------------------------- */

  #activateShellListeners() {
    if (!this.#element) return;

    // Close button
    this.#element.querySelector('[data-action="close"]')
      ?.addEventListener('click', () => this.close());

    // Backdrop click
    this.#element.querySelector('.sessionflow-storyline__backdrop')
      ?.addEventListener('click', () => this.close());

    // Back button
    this.#element.querySelector('[data-action="navigate-back"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:navigateBack');
      });

    // Anchor button
    this.#element.querySelector('[data-action="toggle-anchor"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:setAnchor', 'storyline', this.#sessionId);
      });

    // Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        event.stopPropagation();
        if (this.#editingBeatId) {
          this.#cancelEdit();
        } else {
          this.close();
        }
      }
    });
  }

  /* ---------------------------------------- */
  /*  Event Listeners — Body (on re-render)   */
  /* ---------------------------------------- */

  #activateBodyListeners() {
    if (!this.#element) return;
    const body = this.#element.querySelector('.sessionflow-storyline__body');
    if (!body) return;

    // Beat card click → select
    body.querySelectorAll('[data-action="select-beat"]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't select if currently in edit mode (color picker, textarea, etc.)
        if (e.currentTarget.classList.contains('is-editing')) return;
        // Don't select if clicking action buttons
        if (e.target.closest('[data-action="edit-beat"]')) return;
        if (e.target.closest('[data-action="delete-beat"]')) return;
        this.#onSelectBeat(e);
      });
    });

    // Edit button click
    body.querySelectorAll('[data-action="edit-beat"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const beatId = e.currentTarget.dataset.beatId;
        this.#beginEdit(beatId);
      });
    });

    // Delete button click
    body.querySelectorAll('[data-action="delete-beat"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const beatId = e.currentTarget.dataset.beatId;
        this.#onDeleteBeat(beatId);
      });
    });

    // Add beat button (both the card at end of timeline and the empty state button)
    body.querySelectorAll('[data-action="add-beat"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#onAddBeat();
      });
    });

    // Edit mode listeners (if in edit mode)
    this.#activateEditListeners();

    // Drag-and-drop reorder (skip cards being edited)
    body.querySelectorAll('.sessionflow-beat-card:not(.is-editing)').forEach(card => {
      card.setAttribute('draggable', 'true');

      card.addEventListener('dragstart', (e) => {
        // Don't allow drag from action buttons
        if (e.target.closest('.sessionflow-beat-card__actions')) {
          e.preventDefault();
          return;
        }
        this.#dragBeatId = card.dataset.beatId;
        card.classList.add('is-drag-source');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.beatId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-drag-source');
        this.#dragBeatId = null;
        // Clean up all drop indicators
        body.querySelectorAll('.is-drop-before, .is-drop-after').forEach(el => {
          el.classList.remove('is-drop-before', 'is-drop-after');
        });
      });

      card.addEventListener('dragover', (e) => {
        if (!this.#dragBeatId || this.#dragBeatId === card.dataset.beatId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Determine drop position (left half = before, right half = after)
        const rect = card.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const isBefore = e.clientX < midX;

        card.classList.toggle('is-drop-before', isBefore);
        card.classList.toggle('is-drop-after', !isBefore);
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drop-before', 'is-drop-after');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-drop-before', 'is-drop-after');
        if (!this.#dragBeatId || this.#dragBeatId === card.dataset.beatId) return;

        const rect = card.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const insertBefore = e.clientX < midX;

        this.#onReorderBeat(this.#dragBeatId, card.dataset.beatId, insertBefore);
      });
    });
  }

  /* ---------------------------------------- */
  /*  Beat Selection                          */
  /* ---------------------------------------- */

  #onSelectBeat(event) {
    const card = event.currentTarget;
    const beatId = card.dataset.beatId;

    // For now, just fire the hook (future: open beat detail panel)
    Hooks.call('sessionflow:selectBeat', this.#sessionId, beatId);
  }

  /* ---------------------------------------- */
  /*  Beat Deletion                           */
  /* ---------------------------------------- */

  async #onDeleteBeat(beatId) {
    // Simple confirmation
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Storyline.DeleteBeat') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Storyline.ConfirmDeleteBeat')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    const result = await deleteBeat(this.#sessionId, beatId);
    if (result) {
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.BeatDeleted'));
      await this.rerender();
    }
  }

  /* ---------------------------------------- */
  /*  Beat Reorder (Drag & Drop)              */
  /* ---------------------------------------- */

  async #onReorderBeat(draggedBeatId, targetBeatId, insertBefore) {
    const beats = getBeats(this.#sessionId);
    const orderedIds = beats.map(b => b.id);

    // Remove dragged from list
    const fromIndex = orderedIds.indexOf(draggedBeatId);
    if (fromIndex === -1) return;
    orderedIds.splice(fromIndex, 1);

    // Find target position and insert
    let toIndex = orderedIds.indexOf(targetBeatId);
    if (toIndex === -1) return;
    if (!insertBefore) toIndex += 1;

    orderedIds.splice(toIndex, 0, draggedBeatId);

    await reorderBeats(this.#sessionId, orderedIds);
    await this.rerender();
  }

  /* ---------------------------------------- */
  /*  Beat Creation                           */
  /* ---------------------------------------- */

  async #onAddBeat() {
    const beat = await createBeat(this.#sessionId, {
      title: game.i18n.localize('SESSIONFLOW.Storyline.DefaultBeatTitle'),
      text: '',
      image: ''
    });

    if (!beat) return;

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.BeatCreated'));
    await this.rerender();
    this.#beginEdit(beat.id);

    // Scroll the new card into view
    const newCard = this.#element?.querySelector(`[data-beat-id="${beat.id}"]`);
    newCard?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }

  /* ---------------------------------------- */
  /*  Inline Editing                          */
  /* ---------------------------------------- */

  async #beginEdit(beatId) {
    // Cancel any existing edit first
    if (this.#editingBeatId) {
      this.#cancelEdit();
      // Wait for rerender to complete before starting new edit
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    this.#editingBeatId = beatId;
    const beats = getBeats(this.#sessionId);
    const beat = beats.find(b => b.id === beatId);
    if (!beat) return;

    const card = this.#element?.querySelector(`[data-beat-id="${beatId}"]`);
    if (!card) return;

    card.classList.add('is-editing');

    // Build image button HTML
    const imagePreview = beat.image
      ? (this.#isVideoSource(beat.image)
          ? `<video src="${beat.image}" autoplay loop muted playsinline></video>`
          : `<img src="${beat.image}" />`)
      : '';
    const imageHtml = beat.image
      ? `${imagePreview}<span class="sessionflow-beat-edit__image-overlay"><i class="fas fa-camera"></i></span>`
      : `<i class="fas fa-image"></i> <span>${game.i18n.localize('SESSIONFLOW.Storyline.BeatImageLabel')}</span>`;

    // Get session color for default
    const session = getSession(this.#sessionId);
    const defaultColor = beat.color || session?.color || '#7c5cbf';

    // Replace card content with edit form
    card.innerHTML = `
      <button class="sessionflow-beat-edit__image-btn" type="button" data-action="pick-image">
        ${imageHtml}
      </button>
      <div class="sessionflow-beat-edit__fields">
        <div class="sessionflow-beat-edit__title-row">
          <input class="sessionflow-beat-edit__title" type="text"
                 value="${this.#escapeHtml(beat.title)}"
                 placeholder="${game.i18n.localize('SESSIONFLOW.Storyline.BeatTitlePlaceholder')}"
                 data-field="title" />
          <input class="sessionflow-beat-edit__color" type="color"
                 value="${defaultColor}"
                 data-field="color"
                 title="${game.i18n.localize('SESSIONFLOW.Storyline.BeatColorLabel')}" />
        </div>
        <textarea class="sessionflow-beat-edit__text"
                  placeholder="${game.i18n.localize('SESSIONFLOW.Storyline.BeatTextPlaceholder')}"
                  data-field="text" rows="2">${this.#escapeHtml(beat.text)}</textarea>
        <div class="sessionflow-beat-edit__actions">
          <button type="button" data-action="save-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.SaveEdit')}">
            <i class="fas fa-check"></i>
          </button>
          <button type="button" data-action="cancel-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.CancelEdit')}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;

    // Store current image path on the image button
    const imgBtn = card.querySelector('[data-action="pick-image"]');
    if (beat.image) imgBtn.dataset.imagePath = beat.image;

    this.#activateEditListeners();

    // Auto-focus title input
    const titleInput = card.querySelector('[data-field="title"]');
    titleInput?.focus();
    titleInput?.select();
  }

  async #saveEdit() {
    if (!this.#editingBeatId) return;

    const card = this.#element?.querySelector(`[data-beat-id="${this.#editingBeatId}"]`);
    if (!card) return;

    const titleInput = card.querySelector('[data-field="title"]');
    const textInput = card.querySelector('[data-field="text"]');
    const colorInput = card.querySelector('[data-field="color"]');
    const imgBtn = card.querySelector('[data-action="pick-image"]');

    const changes = {};
    if (titleInput) changes.title = titleInput.value.trim() || game.i18n.localize('SESSIONFLOW.Storyline.DefaultBeatTitle');
    if (textInput) changes.text = textInput.value.trim();
    if (colorInput) changes.color = colorInput.value;
    if (imgBtn) changes.image = imgBtn.dataset.imagePath || '';

    await updateBeat(this.#sessionId, this.#editingBeatId, changes);
    this.#editingBeatId = null;

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.BeatUpdated'));
    await this.rerender();
  }

  #cancelEdit() {
    if (!this.#editingBeatId) return;
    this.#editingBeatId = null;
    this.rerender();
  }

  #activateEditListeners() {
    if (!this.#element) return;

    const editingCard = this.#element.querySelector('.sessionflow-beat-card.is-editing');
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

    // Image picker button
    const imgBtn = editingCard.querySelector('[data-action="pick-image"]');
    imgBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openImagePicker(imgBtn);
    });
  }

  /* ---------------------------------------- */
  /*  Image Picker (FilePicker)               */
  /* ---------------------------------------- */

  #openImagePicker(imageButton) {
    const current = imageButton.dataset.imagePath || '';

    const picker = new FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        // Update the button preview
        imageButton.dataset.imagePath = path;
        const preview = this.#isVideoSource(path)
          ? `<video src="${path}" autoplay loop muted playsinline></video>`
          : `<img src="${path}" />`;
        imageButton.innerHTML = `
          ${preview}
          <span class="sessionflow-beat-edit__image-overlay"><i class="fas fa-camera"></i></span>
        `;
      }
    });

    picker.render(true);
  }

  /* ---------------------------------------- */
  /*  Anchor State                            */
  /* ---------------------------------------- */

  #updateAnchorState() {
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');
    const btn = this.#element?.querySelector('[data-action="toggle-anchor"]');
    btn?.classList.toggle('is-active',
      anchor?.panel === 'storyline' && anchor?.sessionId === this.#sessionId);
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
