/**
 * SessionFlow - Storyline Panel Controller
 * Manages the bottom slide-up panel that displays story beats for a session.
 * @module storyline-panel
 */

import { getSession, getBeats, createBeat, updateBeat, deleteBeat, reorderBeats } from './session-store.js';
import { resumeManagedVideos, suspendManagedVideos } from './media-utils.js';
import { getCachedMediaPreview, requestMediaPreview, warmMediaPreviews } from './preview-cache.js';

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
    resumeManagedVideos(this.#element);
  }

  /** Close the panel. */
  close() {
    if (!this.#isOpen || !this.#element) return;
    suspendManagedVideos(this.#element);
    this.#editingBeatId = null;
    this.#dragBeatId = null;
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
    suspendManagedVideos(this.#element);
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
    this.#hydrateDeferredPreviews();
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
    this.#hydrateDeferredPreviews();

    if (this.#isOpen) {
      resumeManagedVideos(this.#element);
    }
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
      layout: game.settings.get(MODULE_ID, 'storylineLayout'),
      canEdit: game.user.isGM,
      beats: beats.map((b, i) => ({
        ...b,
        previewSource: b.image || '',
        previewImage: this.#isVideoSource(b.image) ? (b.image || '') : (b.image ? getCachedMediaPreview(b.image) : ''),
        isEditing: b.id === this.#editingBeatId,
        hasPreviewImage: this.#isVideoSource(b.image) ? !!b.image : !!(b.image ? getCachedMediaPreview(b.image) : ''),
        needsDeferredPreview: !!b.image && !this.#isVideoSource(b.image) && !(b.image ? getCachedMediaPreview(b.image) : ''),
        renderPreviewAsVideo: this.#isVideoSource(b.image),
        isVideo: this.#isVideoSource(b.image),
        displayNumber: i + 1,
        index: i,
        sceneCount: b.scenes?.length || 0
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

        // Determine drop position (vertical: top/bottom, horizontal: left/right)
        const isVertical = this.#element?.dataset.layout === 'vertical';
        const rect = card.getBoundingClientRect();
        const isBefore = isVertical
          ? e.clientY < (rect.top + rect.height / 2)
          : e.clientX < (rect.left + rect.width / 2);

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

        const isVertical = this.#element?.dataset.layout === 'vertical';
        const rect = card.getBoundingClientRect();
        const insertBefore = isVertical
          ? e.clientY < (rect.top + rect.height / 2)
          : e.clientX < (rect.left + rect.width / 2);

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

    // Get session color for default
    const session = getSession(this.#sessionId);
    const defaultColor = beat.color || session?.color || '#7c5cbf';

    // Build background media
    let mediaBg = '';
    if (beat.image) {
      mediaBg = this.#isVideoSource(beat.image)
        ? `<video src="${beat.image}" autoplay loop muted playsinline preload="metadata"></video>`
        : `<img src="${beat.image}" alt="" />`;
    }

    // Build image hint
    const imageHint = beat.image
      ? `<div class="sessionflow-beat-card__change-image-hint"><i class="fas fa-camera"></i></div>`
      : `<div class="sessionflow-beat-card__empty-media-slot">
          <div class="sessionflow-beat-card__add-image-hint">
            <i class="fas fa-camera"></i>
            <span>${game.i18n.localize('SESSIONFLOW.Storyline.ClickToAddImage')}</span>
          </div>
        </div>`;

    // Replace card content with immersive edit form
    card.innerHTML = `
      <div class="sessionflow-beat-card__media">${mediaBg}</div>
      <div class="sessionflow-beat-card__edit-overlay" data-image-path="${this.#escapeAttr(beat.image || '')}">
        ${imageHint}
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
                    data-field="text" rows="3">${this.#escapeHtml(beat.text)}</textarea>
          <div class="sessionflow-beat-edit__actions">
            <button type="button" data-action="save-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.SaveEdit')}">
              <i class="fas fa-check"></i>
            </button>
            <button type="button" data-action="cancel-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.CancelEdit')}">
              <i class="fas fa-times"></i>
            </button>
          </div>
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
    if (!this.#editingBeatId) return;

    const card = this.#element?.querySelector(`[data-beat-id="${this.#editingBeatId}"]`);
    if (!card) return;

    const titleInput = card.querySelector('[data-field="title"]');
    const textInput = card.querySelector('[data-field="text"]');
    const colorInput = card.querySelector('[data-field="color"]');
    const overlay = card.querySelector('.sessionflow-beat-card__edit-overlay');

    const changes = {};
    if (titleInput) changes.title = titleInput.value.trim() || game.i18n.localize('SESSIONFLOW.Storyline.DefaultBeatTitle');
    if (textInput) changes.text = textInput.value.trim();
    if (colorInput) changes.color = colorInput.value;
    if (overlay) changes.image = overlay.dataset.imagePath || '';

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

    // Image picker — click on the overlay background (not on form fields)
    const overlay = editingCard.querySelector('.sessionflow-beat-card__edit-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target.closest('input, textarea, button, .sessionflow-beat-edit__actions')) return;
      e.stopPropagation();
      this.#openImagePicker(overlay);
    });
  }

  /* ---------------------------------------- */
  /*  Image Picker (FilePicker)               */
  /* ---------------------------------------- */

  #openImagePicker(overlayElement) {
    const current = overlayElement.dataset.imagePath || '';
    const card = overlayElement.closest('.sessionflow-beat-card');

    const picker = new FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        // Update the data attribute
        overlayElement.dataset.imagePath = path;

        // Update background media
        const mediaDiv = card.querySelector('.sessionflow-beat-card__media');
        const cachedPreview = getCachedMediaPreview(path);
        if (cachedPreview) {
          mediaDiv.innerHTML = `<img src="${this.#escapeAttr(cachedPreview)}" alt="" />`;
        } else {
          mediaDiv.innerHTML = this.#isVideoSource(path)
            ? `<div class="sessionflow-beat-card__video-placeholder"><i class="fas fa-film"></i></div>`
            : `<div class="sessionflow-beat-card__video-placeholder"><i class="fas fa-image"></i></div>`;

          requestMediaPreview(path).then((previewPath) => {
            if (!previewPath || !card?.isConnected) return;
            mediaDiv.innerHTML = `<img src="${this.#escapeAttr(previewPath)}" alt="" />`;
          });
        }

        // Swap hint from "add" to "change"
        const emptyMediaSlot = overlayElement.querySelector('.sessionflow-beat-card__empty-media-slot');
        if (emptyMediaSlot) {
          emptyMediaSlot.outerHTML = `<div class="sessionflow-beat-card__change-image-hint"><i class="fas fa-camera"></i></div>`;
        }
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

  #escapeAttr(str) {
    return (str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  #hydrateDeferredPreviews() {
    if (!this.#element) return;

    const pendingSources = new Set();

    this.#element.querySelectorAll('[data-preview-src]').forEach((el) => {
      const src = el.dataset.previewSrc;
      if (!src) return;

      const cached = getCachedMediaPreview(src);
      if (cached) {
        this.#applyDeferredPreview(el, cached);
        return;
      }

      pendingSources.add(src);
      requestMediaPreview(src).then((previewPath) => {
        if (!previewPath || !this.#element?.contains(el)) return;
        this.#applyDeferredPreview(el, previewPath);
      });
    });

    if (pendingSources.size > 1) {
      warmMediaPreviews([...pendingSources]);
    }
  }

  #applyDeferredPreview(target, previewPath) {
    if (!target || !previewPath) return;

    target.innerHTML = `
      <img src="${this.#escapeAttr(previewPath)}"
           alt="${this.#escapeAttr(target.dataset.previewAlt || '')}"
           loading="lazy"
           decoding="async"
           fetchpriority="low" />
    `;

    if (target.dataset.videoBackground === 'true' && !target.querySelector('.sessionflow-beat-card__media-badge')) {
      target.insertAdjacentHTML('beforeend', `
        <span class="sessionflow-beat-card__media-badge">
          <i class="fas fa-film"></i>
        </span>
      `);
    }

    target.removeAttribute('data-preview-src');
  }
}
