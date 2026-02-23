/**
 * SessionFlow - Side Panel Controller
 * Manages the slide-in panel that displays the session list.
 * @module panel
 */

import { getSessions, createSession, updateSession, deleteSession } from './session-store.js';

const MODULE_ID = 'sessionflow';

export class SessionPanel {

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {boolean} */
  #isOpen = false;

  /** @type {string|null} Active session ID */
  #activeSessionId = null;

  /** @type {string|null} Session ID currently being edited */
  #editingSessionId = null;

  /** @type {object|null} Temporary data for a session being created */
  #pendingCreate = null;

  /** @type {object|null} Active icon picker instance */
  #activeIconPicker = null;

  /** @type {string} */
  #templatePath = `modules/${MODULE_ID}/templates/session-panel.hbs`;

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  /** Toggle the panel open/closed. */
  toggle() {
    this.#isOpen ? this.close() : this.open();
  }

  /** Open the panel. */
  async open() {
    if (this.#isOpen) return;

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
    this.#activeSessionId = null;
    this.#isOpen = false;
    this.#element.dataset.open = 'false';

    // Notify other components that no session is selected
    Hooks.call('sessionflow:selectSession', null);
  }

  /**
   * Close the panel without firing the selectSession hook.
   * Used when the session panel is closed as a side-effect of opening the storyline panel,
   * to avoid circular hook calls.
   */
  closeQuiet() {
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

  /** @returns {boolean} */
  get isOpen() { return this.#isOpen; }

  /** Remove the panel from DOM entirely. */
  destroy() {
    this.#element?.remove();
    this.#element = null;
    this.#isOpen = false;
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  async #render() {
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    document.body.insertAdjacentHTML('beforeend', html);
    this.#element = document.body.querySelector('.sessionflow-panel');

    if (!this.#element) {
      console.error(`[${MODULE_ID}] Failed to find panel element after render!`);
      return;
    }

    this.#activateShellListeners();
    this.#activateBodyListeners();
  }

  async #rerenderBody() {
    if (!this.#element) return;

    const body = this.#element.querySelector('.sessionflow-panel__body');
    const footer = this.#element.querySelector('.sessionflow-panel__footer');
    const count = this.#element.querySelector('.sessionflow-panel__count');

    // Re-render full template, then extract only the body/footer/count parts
    const templateData = this.#getTemplateData();
    const html = await foundry.applications.handlebars.renderTemplate(this.#templatePath, templateData);

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const newBody = temp.querySelector('.sessionflow-panel__body');
    const newFooter = temp.querySelector('.sessionflow-panel__footer');
    const newCount = temp.querySelector('.sessionflow-panel__count');

    if (body && newBody) body.replaceWith(newBody);
    if (footer && newFooter) footer.replaceWith(newFooter);
    else if (!footer && newFooter) {
      this.#element.querySelector('.sessionflow-panel__content')?.appendChild(newFooter);
    }

    if (count && newCount) count.replaceWith(newCount);
    else if (!count && newCount) {
      const header = this.#element.querySelector('.sessionflow-panel__header');
      const closeBtn = header?.querySelector('.sessionflow-panel__close');
      if (closeBtn) header.insertBefore(newCount, closeBtn);
    } else if (count && !newCount) {
      count.remove();
    }

    this.#activateBodyListeners();
  }

  #getTemplateData() {
    const sessions = getSessions();
    const sessionCount = sessions.length;

    // Mark active session and determine icon type
    const sessionsData = sessions.map(s => ({
      ...s,
      isActive: s.id === this.#activeSessionId,
      isCustomImage: s.icon?.startsWith('img:') ?? false,
      imagePath: s.icon?.startsWith('img:') ? s.icon.replace(/^img:/, '') : null
    }));

    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');

    return {
      title: game.i18n.localize('SESSIONFLOW.Panel.Title'),
      emptyMessage: game.i18n.localize('SESSIONFLOW.Panel.NoSessions'),
      emptySubtitle: game.i18n.localize('SESSIONFLOW.Panel.NoSessionsSubtitle'),
      sessionPrefix: game.i18n.localize('SESSIONFLOW.Panel.SessionPrefix'),
      editLabel: game.i18n.localize('SESSIONFLOW.Panel.EditSession'),
      deleteLabel: game.i18n.localize('SESSIONFLOW.Panel.DeleteSession'),
      createLabel: game.i18n.localize('SESSIONFLOW.Panel.CreateSession'),
      anchorLabel: game.i18n.localize('SESSIONFLOW.Panel.AnchorPanel'),
      sessionCount: sessionCount > 0 ? sessionCount : null,
      isAnchored: anchor?.panel === 'sessions',
      canCreate: game.user.isGM,
      exportLabel: game.i18n.localize('SESSIONFLOW.Panel.ExportData'),
      importLabel: game.i18n.localize('SESSIONFLOW.Panel.ImportData'),
      sessions: sessionsData
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
    this.#element.querySelector('.sessionflow-panel__backdrop')
      ?.addEventListener('click', () => this.close());

    // Anchor button
    this.#element.querySelector('[data-action="toggle-anchor"]')
      ?.addEventListener('click', () => {
        Hooks.call('sessionflow:setAnchor', 'sessions');
      });

    // Export button
    this.#element.querySelector('[data-action="export-data"]')
      ?.addEventListener('click', () => this.#exportData());

    // Import button
    this.#element.querySelector('[data-action="import-data"]')
      ?.addEventListener('click', () => this.#importData());

    // Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#isOpen) {
        if (this.#editingSessionId || this.#pendingCreate) {
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
    const body = this.#element.querySelector('.sessionflow-panel__body');
    if (!body) return;

    // Session item click → select
    body.querySelectorAll('[data-action="select-session"]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't select if currently in edit mode (color picker, name input, etc.)
        if (e.currentTarget.classList.contains('is-editing')) return;
        // Don't select if clicking edit or delete button
        if (e.target.closest('[data-action="edit-session"]')) return;
        if (e.target.closest('[data-action="delete-session"]')) return;
        this.#onSelectSession(e);
      });
    });

    // Edit button click
    body.querySelectorAll('[data-action="edit-session"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = e.currentTarget.dataset.sessionId;
        this.#beginEdit(sessionId);
      });
    });

    // Delete button click
    body.querySelectorAll('[data-action="delete-session"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = e.currentTarget.dataset.sessionId;
        this.#onDeleteSession(sessionId);
      });
    });

    // Create session button
    this.#element.querySelector('[data-action="create-session"]')
      ?.addEventListener('click', () => this.#beginCreate());

    // Edit mode listeners (if in edit mode)
    this.#activateEditListeners();
  }

  /* ---------------------------------------- */
  /*  Session Selection                       */
  /* ---------------------------------------- */

  #onSelectSession(event) {
    const item = event.currentTarget;
    const sessionId = item.dataset.sessionId;

    // Toggle active
    this.#activeSessionId = (this.#activeSessionId === sessionId) ? null : sessionId;

    // Update UI
    this.#element.querySelectorAll('.sessionflow-session-list__item')
      .forEach(el => el.classList.toggle('is-active', el.dataset.sessionId === this.#activeSessionId));

    Hooks.call('sessionflow:selectSession', this.#activeSessionId);
  }

  /* ---------------------------------------- */
  /*  Session Deletion                        */
  /* ---------------------------------------- */

  async #onDeleteSession(sessionId) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('SESSIONFLOW.Panel.DeleteSession') },
      content: `<p>${game.i18n.localize('SESSIONFLOW.Panel.ConfirmDeleteSession')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;

    const result = await deleteSession(sessionId);
    if (result) {
      // Clear active if we deleted the active session
      if (this.#activeSessionId === sessionId) {
        this.#activeSessionId = null;
      }
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SessionDeleted'));
      await this.rerender();
    }
  }

  /* ---------------------------------------- */
  /*  Inline Editing                          */
  /* ---------------------------------------- */

  async #beginEdit(sessionId) {
    // Cancel any existing edit first
    this.#cancelEdit();

    this.#editingSessionId = sessionId;
    const sessions = getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const item = this.#element.querySelector(`[data-session-id="${sessionId}"]`);
    if (!item) return;

    item.classList.add('is-editing');

    const main = item.querySelector('.sessionflow-session-list__main');
    if (!main) return;

    // Determine icon preview for the edit button
    const isCustom = session.icon?.startsWith('img:');
    const imgPath = isCustom ? session.icon.replace(/^img:/, '') : null;
    const iconPreviewHtml = isCustom
      ? `<img src="${imgPath}" class="sessionflow-session-edit__icon-preview" />`
      : `<i class="${session.icon}"></i>`;

    main.innerHTML = `
      <button class="sessionflow-session-edit__icon-btn" type="button" data-action="pick-icon" title="Choose icon">
        ${iconPreviewHtml}
      </button>
      <input class="sessionflow-session-edit__name" type="text" value="${this.#escapeHtml(session.name)}" data-field="name" />
      <input class="sessionflow-session-edit__color" type="color" value="${session.color}" data-field="color" />
      <div class="sessionflow-session-edit__actions">
        <button type="button" data-action="save-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.SaveEdit')}">
          <i class="fas fa-check"></i>
        </button>
        <button type="button" data-action="cancel-edit" title="${game.i18n.localize('SESSIONFLOW.Panel.CancelEdit')}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    this.#activateEditListeners();

    // Auto-focus and select name input
    const nameInput = main.querySelector('[data-field="name"]');
    nameInput?.focus();
    nameInput?.select();
  }

  async #beginCreate() {
    this.#cancelEdit();

    const nextNumber = (getSessions().length > 0)
      ? Math.max(...getSessions().map(s => s.number)) + 1
      : 1;

    const defaultName = `${game.i18n.localize('SESSIONFLOW.Panel.DefaultSessionName')} ${nextNumber}`;

    // Create session immediately with defaults
    const session = await createSession({
      name: defaultName,
      icon: 'fa-solid fa-book-open',
      color: '#7c5cbf'
    });

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SessionCreated'));

    // Re-render, then enter edit mode on the new session
    await this.rerender();
    this.#beginEdit(session.id);

    // Scroll to the new item
    const newItem = this.#element?.querySelector(`[data-session-id="${session.id}"]`);
    newItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async #saveEdit() {
    if (!this.#editingSessionId) return;

    // Close icon picker if open
    if (this.#activeIconPicker) {
      this.#activeIconPicker.destroy();
      this.#activeIconPicker = null;
    }

    const item = this.#element?.querySelector(`[data-session-id="${this.#editingSessionId}"]`);
    if (!item) return;

    const nameInput = item.querySelector('[data-field="name"]');
    const colorInput = item.querySelector('[data-field="color"]');
    const iconBtn = item.querySelector('[data-action="pick-icon"]');

    const changes = {};
    if (nameInput) changes.name = nameInput.value.trim() || 'Unnamed Session';
    if (colorInput) changes.color = colorInput.value;

    // Get icon — could be FA class (from <i>) or custom image (from data attribute or <img>)
    if (iconBtn) {
      const customPath = iconBtn.dataset.customIcon;
      if (customPath) {
        changes.icon = customPath; // Already has "img:" prefix
      } else {
        const iconEl = iconBtn.querySelector('i');
        if (iconEl) changes.icon = iconEl.className;
      }
    }

    await updateSession(this.#editingSessionId, changes);
    this.#editingSessionId = null;

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.SessionUpdated'));
    await this.rerender();
  }

  #cancelEdit() {
    if (!this.#editingSessionId && !this.#pendingCreate) return;
    // Close icon picker if open
    if (this.#activeIconPicker) {
      this.#activeIconPicker.destroy();
      this.#activeIconPicker = null;
    }
    this.#editingSessionId = null;
    this.#pendingCreate = null;
    this.rerender();
  }

  #activateEditListeners() {
    if (!this.#element) return;

    const editingItem = this.#element.querySelector('.is-editing');
    if (!editingItem) return;

    // Save button
    editingItem.querySelector('[data-action="save-edit"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#saveEdit();
      });

    // Cancel button
    editingItem.querySelector('[data-action="cancel-edit"]')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#cancelEdit();
      });

    // Enter key saves
    editingItem.querySelector('[data-field="name"]')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#saveEdit();
        }
      });

    // Icon picker button
    const iconBtn = editingItem.querySelector('[data-action="pick-icon"]');
    iconBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openIconPicker(iconBtn);
    });
  }

  /* ---------------------------------------- */
  /*  Icon Picker Integration                 */
  /* ---------------------------------------- */

  async #openIconPicker(anchorButton) {
    // Close any existing picker first
    if (this.#activeIconPicker) {
      this.#activeIconPicker.destroy();
      this.#activeIconPicker = null;
    }

    // Dynamic import to keep initial load light
    const { IconPicker, isCustomImage } = await import('./icon-picker.js');

    // Determine current icon
    let currentIcon;
    const customPath = anchorButton.dataset.customIcon;
    if (customPath) {
      currentIcon = customPath;
    } else {
      currentIcon = anchorButton.querySelector('i')?.className || 'fa-solid fa-book-open';
    }

    this.#activeIconPicker = new IconPicker({
      anchor: anchorButton,
      currentIcon,
      onSelect: (iconValue) => {
        if (iconValue.startsWith('img:')) {
          // Custom image selected
          const imgPath = iconValue.replace(/^img:/, '');
          anchorButton.innerHTML = `<img src="${imgPath}" class="sessionflow-session-edit__icon-preview" />`;
          anchorButton.dataset.customIcon = iconValue;
        } else {
          // FA icon selected
          anchorButton.innerHTML = `<i class="${iconValue}"></i>`;
          delete anchorButton.dataset.customIcon;
        }
      },
      onClose: () => {
        this.#activeIconPicker = null;
      }
    });

    this.#activeIconPicker.open();
  }

  /* ---------------------------------------- */
  /*  Data Export / Import                    */
  /* ---------------------------------------- */

  /**
   * Export all SessionFlow data as a JSON file download.
   */
  async #exportData() {
    const payload = {
      moduleId: MODULE_ID,
      version: game.modules.get(MODULE_ID)?.version ?? '0.0.0',
      exportDate: new Date().toISOString(),
      worldName: game.world?.title ?? game.world?.id ?? 'unknown',
      data: {
        sessions: game.settings.get(MODULE_ID, 'sessions') ?? [],
        characterData: game.settings.get(MODULE_ID, 'characterData') ?? {},
        characterQuickSlots: game.settings.get(MODULE_ID, 'characterQuickSlots') ?? {},
        sceneTemplates: game.settings.get(MODULE_ID, 'sceneTemplates') ?? [],
        anchoredPanel: game.settings.get(MODULE_ID, 'anchoredPanel') ?? {}
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `sessionflow-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.DataExported'));
  }

  /**
   * Import SessionFlow data from a JSON file.
   * Shows a file picker, validates the data, and prompts for confirmation.
   */
  async #importData() {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;

      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch {
        ui.notifications.error(game.i18n.localize('SESSIONFLOW.Notifications.ImportInvalidFile'));
        return;
      }

      // Validate structure
      if (!payload?.moduleId || payload.moduleId !== MODULE_ID || !payload?.data) {
        ui.notifications.error(game.i18n.localize('SESSIONFLOW.Notifications.ImportInvalidFormat'));
        return;
      }

      // Build summary for confirmation
      const sessions = payload.data.sessions ?? [];
      const charCount = Object.keys(payload.data.characterData ?? {}).length;
      const templateCount = (payload.data.sceneTemplates ?? []).length;
      let beatCount = 0;
      let sceneCount = 0;
      for (const s of sessions) {
        const beats = s.beats ?? [];
        beatCount += beats.length;
        for (const b of beats) sceneCount += (b.scenes ?? []).length;
      }

      const exportDate = payload.exportDate
        ? new Date(payload.exportDate).toLocaleDateString()
        : '?';
      const worldName = payload.worldName ?? '?';
      const version = payload.version ?? '?';

      const summary = `
        <p><strong>${game.i18n.localize('SESSIONFLOW.Panel.ImportSource')}:</strong> ${worldName} (v${version}, ${exportDate})</p>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}</li>
          <li>${beatCount} ${beatCount === 1 ? 'beat' : 'beats'}</li>
          <li>${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'}</li>
          <li>${charCount} ${charCount === 1 ? 'character' : 'characters'}</li>
          <li>${templateCount} ${templateCount === 1 ? 'template' : 'templates'}</li>
        </ul>
        <p style="color: #ff9800;"><i class="fas fa-exclamation-triangle"></i> ${game.i18n.localize('SESSIONFLOW.Panel.ImportWarning')}</p>
      `;

      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('SESSIONFLOW.Panel.ImportData') },
        content: summary,
        rejectClose: false,
        modal: true
      });

      if (!confirmed) return;

      // Write all settings
      try {
        if (payload.data.sessions) {
          await game.settings.set(MODULE_ID, 'sessions', payload.data.sessions);
        }
        if (payload.data.characterData) {
          await game.settings.set(MODULE_ID, 'characterData', payload.data.characterData);
        }
        if (payload.data.characterQuickSlots) {
          await game.settings.set(MODULE_ID, 'characterQuickSlots', payload.data.characterQuickSlots);
        }
        if (payload.data.sceneTemplates) {
          await game.settings.set(MODULE_ID, 'sceneTemplates', payload.data.sceneTemplates);
        }
        if (payload.data.anchoredPanel) {
          await game.settings.set(MODULE_ID, 'anchoredPanel', payload.data.anchoredPanel);
        }
        ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.DataImported'));
        await this.rerender();
      } catch (err) {
        console.error(`[${MODULE_ID}] Import failed:`, err);
        ui.notifications.error(game.i18n.localize('SESSIONFLOW.Notifications.ImportFailed'));
      }
    });

    input.click();
  }

  /* ---------------------------------------- */
  /*  Anchor State                            */
  /* ---------------------------------------- */

  #updateAnchorState() {
    const anchor = game.settings.get(MODULE_ID, 'anchoredPanel');
    const btn = this.#element?.querySelector('[data-action="toggle-anchor"]');
    btn?.classList.toggle('is-active', anchor?.panel === 'sessions');
  }

  /* ---------------------------------------- */
  /*  Utilities                               */
  /* ---------------------------------------- */

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
