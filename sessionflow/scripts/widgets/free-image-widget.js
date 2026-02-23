/**
 * SessionFlow - Free Image Widget
 * Displays a user-selected image on the canvas with broadcast-to-players
 * capability, configurable timer, and auto-journal creation.
 * @module widgets/free-image-widget
 */

import { Widget, registerWidgetType } from '../widget.js';

const MODULE_ID = 'sessionflow';

/** Timer preset options in seconds (null = manual) */
const TIMER_PRESETS = [
  { value: null, label: 'SESSIONFLOW.Canvas.FreeImageTimerManual' },
  { value: 5,    label: 'SESSIONFLOW.Canvas.FreeImageTimer5s' },
  { value: 10,   label: 'SESSIONFLOW.Canvas.FreeImageTimer10s' },
  { value: 15,   label: 'SESSIONFLOW.Canvas.FreeImageTimer15s' },
  { value: 30,   label: 'SESSIONFLOW.Canvas.FreeImageTimer30s' },
  { value: 60,   label: 'SESSIONFLOW.Canvas.FreeImageTimer60s' }
];

export class FreeImageWidget extends Widget {

  static TYPE = 'free-image';
  static LABEL = 'SESSIONFLOW.Canvas.FreeImage';
  static ICON = 'fas fa-photo-film';
  static MIN_WIDTH = 160;
  static MIN_HEIGHT = 120;
  static DEFAULT_WIDTH = 320;
  static DEFAULT_HEIGHT = 240;

  /* -- Private fields -- */

  /** @type {boolean} */
  #isBroadcasting = false;

  /** @type {number|null} */
  #countdownIntervalId = null;

  /** @type {number} */
  #countdownRemaining = 0;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.FreeImage');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'sessionflow-widget-free-image';

    const src = this.config.src;

    if (src) {
      this.#buildImageView(container, src);
    } else {
      this.#buildEmptyState(container);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Image View                              */
  /* ---------------------------------------- */

  #buildImageView(container, src) {
    // Image
    const img = document.createElement('img');
    img.className = 'sessionflow-widget-free-image__img';
    img.src = src;
    img.alt = this.config.title || '';
    container.appendChild(img);

    // Title overlay
    if (this.config.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'sessionflow-widget-free-image__title-overlay';
      titleEl.textContent = this.config.title;
      container.appendChild(titleEl);
    }

    // GM controls
    if (game.user.isGM) {
      this.#buildBroadcastControls(container);
      this.#buildChangeButton(container);
    }
  }

  /* ---------------------------------------- */
  /*  Empty State                             */
  /* ---------------------------------------- */

  #buildEmptyState(container) {
    const placeholder = document.createElement('div');
    placeholder.className = 'sessionflow-widget-free-image__placeholder';
    placeholder.innerHTML = `
      <i class="fas fa-image"></i>
      <span>${game.i18n.localize('SESSIONFLOW.Canvas.FreeImagePlaceholder')}</span>
    `;

    if (game.user.isGM) {
      placeholder.classList.add('is-clickable');
      placeholder.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#openFilePicker();
      });
    }

    container.appendChild(placeholder);
  }

  /* ---------------------------------------- */
  /*  Change Image Button                     */
  /* ---------------------------------------- */

  #buildChangeButton(container) {
    const btn = document.createElement('button');
    btn.className = 'sessionflow-widget-free-image__change-btn';
    btn.type = 'button';
    btn.title = game.i18n.localize('SESSIONFLOW.Canvas.FreeImageChange');
    btn.innerHTML = '<i class="fas fa-pen"></i>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#openFilePicker();
    });
    container.appendChild(btn);
  }

  /* ---------------------------------------- */
  /*  Broadcast Controls                      */
  /* ---------------------------------------- */

  #buildBroadcastControls(container) {
    // Central broadcast button
    const btn = document.createElement('button');
    btn.className = 'sessionflow-widget-free-image__broadcast-btn';
    if (this.#isBroadcasting) btn.classList.add('is-active');
    btn.type = 'button';
    btn.title = this.#isBroadcasting
      ? game.i18n.localize('SESSIONFLOW.Canvas.FreeImageStopBroadcast')
      : game.i18n.localize('SESSIONFLOW.Canvas.FreeImageStartBroadcast');
    btn.innerHTML = `<i class="fas ${this.#isBroadcasting ? 'fa-stop' : 'fa-play'}"></i>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleBroadcast();
    });
    container.appendChild(btn);

    // Timer selector (top-right)
    this.#buildTimerSelector(container);

    // Countdown display (during timed broadcast)
    if (this.#isBroadcasting && this.#countdownRemaining > 0) {
      const countdown = document.createElement('div');
      countdown.className = 'sessionflow-widget-free-image__countdown';
      countdown.textContent = `${this.#countdownRemaining}s`;
      container.appendChild(countdown);
    }
  }

  /* ---------------------------------------- */
  /*  Timer Selector                          */
  /* ---------------------------------------- */

  #buildTimerSelector(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sessionflow-widget-free-image__timer-wrapper';

    const currentTimer = this.config.timer;
    const timerLabel = currentTimer
      ? `${currentTimer}s`
      : game.i18n.localize('SESSIONFLOW.Canvas.FreeImageTimerManualShort');

    // Timer button
    const btn = document.createElement('button');
    btn.className = 'sessionflow-widget-free-image__timer-btn';
    btn.type = 'button';
    btn.title = game.i18n.localize('SESSIONFLOW.Canvas.FreeImageTimerLabel');
    btn.innerHTML = `<i class="fas fa-clock"></i><span>${timerLabel}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = wrapper.querySelector('.sessionflow-widget-free-image__timer-dropdown');
      dropdown?.classList.toggle('is-visible');
    });
    wrapper.appendChild(btn);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'sessionflow-widget-free-image__timer-dropdown';

    for (const preset of TIMER_PRESETS) {
      const item = document.createElement('button');
      item.className = 'sessionflow-widget-free-image__timer-option';
      item.type = 'button';
      item.textContent = game.i18n.localize(preset.label);
      if (preset.value === currentTimer) item.classList.add('is-selected');

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#selectTimer(preset.value);
      });
      dropdown.appendChild(item);
    }

    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);
  }

  #selectTimer(value) {
    this.updateConfig({ timer: value });
    this.engine.scheduleSave();
    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  FilePicker                              */
  /* ---------------------------------------- */

  #openFilePicker() {
    const fp = new FilePicker({
      type: 'image',
      current: this.config.src || '',
      callback: (path) => {
        this.updateConfig({ src: path });
        this.engine.scheduleSave();
        this.refreshBody();
      }
    });
    fp.render(true);
  }

  /* ---------------------------------------- */
  /*  Broadcast Logic                         */
  /* ---------------------------------------- */

  #toggleBroadcast() {
    if (this.#isBroadcasting) {
      this.#stopBroadcast();
    } else {
      this.#startBroadcast();
    }
  }

  #startBroadcast() {
    const src = this.config.src;
    if (!src) return;

    this.#isBroadcasting = true;
    const timer = this.config.timer ?? null;
    const title = this.config.title || '';

    // Emit to all other clients (socket does NOT deliver to sender)
    game.socket.emit(`module.${MODULE_ID}`, {
      action: 'showImage',
      src,
      title,
      timer,
      senderId: game.user.id
    });

    // Also trigger locally on GM — socket.emit doesn't reach sender
    Hooks.call('sessionflow:showImage', { src, title, timer });

    // Start countdown if timed
    if (timer && timer > 0) {
      this.#countdownRemaining = timer;
      this.#countdownIntervalId = setInterval(() => {
        this.#countdownRemaining--;
        this.#updateCountdownDisplay();
        if (this.#countdownRemaining <= 0) {
          this.#stopBroadcast();
        }
      }, 1000);
    }

    this.refreshBody();
  }

  #stopBroadcast() {
    const wasTimed = this.config.timer != null && this.config.timer > 0;

    // Clear countdown
    if (this.#countdownIntervalId) {
      clearInterval(this.#countdownIntervalId);
      this.#countdownIntervalId = null;
    }

    this.#isBroadcasting = false;
    this.#countdownRemaining = 0;

    // Notify all other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      action: 'hideImage',
      senderId: game.user.id
    });

    // Also trigger locally on GM
    Hooks.call('sessionflow:hideImage');

    // Auto-journal for timed broadcasts
    if (wasTimed) {
      this.#createJournalEntry();
    }

    this.refreshBody();
  }

  #updateCountdownDisplay() {
    const el = this.element?.querySelector('.sessionflow-widget-free-image__countdown');
    if (el) {
      el.textContent = `${this.#countdownRemaining}s`;
    }
  }

  /* ---------------------------------------- */
  /*  Auto-Journal                            */
  /* ---------------------------------------- */

  async #createJournalEntry() {
    const src = this.config.src;
    if (!src) return;

    const title = this.config.title || game.i18n.localize('SESSIONFLOW.Canvas.FreeImage');
    const timestamp = new Date().toLocaleString();
    const journalName = `${game.i18n.localize('SESSIONFLOW.Canvas.FreeImageJournalPrefix')}: ${title}`;

    try {
      await JournalEntry.create({
        name: journalName,
        pages: [{
          name: title,
          type: 'image',
          src,
          image: {
            caption: `${game.i18n.localize('SESSIONFLOW.Canvas.FreeImageJournalCaption')} ${timestamp}`
          }
        }]
      });
      ui.notifications.info(game.i18n.localize('SESSIONFLOW.Notifications.FreeImageJournalCreated'));
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to create journal entry for broadcast image:`, err);
    }
  }

  /* ---------------------------------------- */
  /*  Lifecycle                               */
  /* ---------------------------------------- */

  destroy() {
    if (this.#isBroadcasting) {
      if (this.#countdownIntervalId) {
        clearInterval(this.#countdownIntervalId);
        this.#countdownIntervalId = null;
      }
      try {
        game.socket.emit(`module.${MODULE_ID}`, {
          action: 'hideImage',
          senderId: game.user.id
        });
        Hooks.call('sessionflow:hideImage');
      } catch { /* socket may not be available */ }
    }
    super.destroy();
  }
}

// Auto-register
registerWidgetType(FreeImageWidget.TYPE, FreeImageWidget);
