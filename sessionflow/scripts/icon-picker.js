/**
 * SessionFlow - Icon Picker Component
 * A popup grid for selecting FontAwesome icons, with custom image upload.
 * @module icon-picker
 */

import { ICON_CATEGORIES, getIconLabel } from './icon-picker-data.js';

const MODULE_ID = 'sessionflow';

export class IconPicker {

  /** @type {HTMLElement} */
  #anchor;

  /** @type {string} */
  #currentIcon;

  /** @type {Function} */
  #onSelect;

  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {Function|null} */
  #outsideClickHandler = null;

  /** @type {Function|null} */
  #escapeHandler = null;

  /** @type {Function|null} */
  #onClose = null;

  /**
   * @param {object} options
   * @param {HTMLElement} options.anchor - Element to position near.
   * @param {string} options.currentIcon - Currently selected icon class or image path.
   * @param {Function} options.onSelect - Callback: (iconClassOrPath) => void.
   * @param {Function} [options.onClose] - Callback when picker closes.
   */
  constructor({ anchor, currentIcon, onSelect, onClose }) {
    this.#anchor = anchor;
    this.#currentIcon = currentIcon;
    this.#onSelect = onSelect;
    this.#onClose = onClose || null;
  }

  /* ---------------------------------------- */
  /*  Public API                              */
  /* ---------------------------------------- */

  open() {
    if (this.#element) return;
    this.#render();
    this.#position();
    this.#bindDismissHandlers();
  }

  close() {
    this.#unbindDismissHandlers();
    this.#element?.remove();
    this.#element = null;
    this.#onClose?.();
  }

  destroy() {
    this.close();
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  #render() {
    const el = document.createElement('div');
    el.classList.add('sessionflow-root', 'sessionflow-icon-picker');

    // Header with title
    const header = document.createElement('div');
    header.classList.add('sessionflow-icon-picker__header');
    header.innerHTML = `
      <span class="sessionflow-icon-picker__title">${game.i18n.localize('SESSIONFLOW.IconPicker.Title')}</span>
      <button class="sessionflow-icon-picker__upload-btn" type="button" title="${game.i18n.localize('SESSIONFLOW.IconPicker.UploadCustom')}">
        <i class="fas fa-upload"></i>
      </button>
    `;
    el.appendChild(header);

    // Upload button listener
    header.querySelector('.sessionflow-icon-picker__upload-btn')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#openFilePicker();
      });

    // Search bar
    const search = document.createElement('input');
    search.type = 'text';
    search.classList.add('sessionflow-icon-picker__search');
    search.placeholder = game.i18n.localize('SESSIONFLOW.IconPicker.SearchPlaceholder');
    search.addEventListener('input', () => this.#filterIcons(search.value));
    el.appendChild(search);

    // Categories grid
    const grid = document.createElement('div');
    grid.classList.add('sessionflow-icon-picker__grid');

    for (const [categoryKey, icons] of Object.entries(ICON_CATEGORIES)) {
      const categoryLabel = game.i18n.localize(categoryKey);

      const heading = document.createElement('h4');
      heading.classList.add('sessionflow-icon-picker__category');
      heading.textContent = categoryLabel;
      grid.appendChild(heading);

      const row = document.createElement('div');
      row.classList.add('sessionflow-icon-picker__row');

      for (const iconClass of icons) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('sessionflow-icon-picker__btn');
        btn.dataset.icon = iconClass;
        btn.title = getIconLabel(iconClass);

        if (iconClass === this.#currentIcon) {
          btn.classList.add('is-selected');
        }

        const i = document.createElement('i');
        i.className = iconClass;
        btn.appendChild(i);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#onSelect(iconClass);
          this.close();
        });

        row.appendChild(btn);
      }

      grid.appendChild(row);
    }

    el.appendChild(grid);

    // Insert into a zero-size wrapper on <body> to avoid Foundry layout interference
    let container = document.getElementById('sessionflow-picker-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sessionflow-picker-container';
      container.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:10001;';
      document.body.appendChild(container);
    }
    el.style.pointerEvents = 'auto';
    container.appendChild(el);
    this.#element = el;

    // Focus search after render
    requestAnimationFrame(() => search.focus());
  }

  /* ---------------------------------------- */
  /*  Positioning                             */
  /* ---------------------------------------- */

  #position() {
    if (!this.#element || !this.#anchor) return;

    // Find the SessionFlow panel to position to the right of it
    const panel = document.querySelector('.sessionflow-panel__content');
    const pickerWidth = 300;
    const pickerMaxHeight = 500;

    let left, top;

    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      // Position immediately to the right of the panel
      left = panelRect.right + 4;
      top = panelRect.top;
    } else {
      // Fallback: position near the anchor
      const anchorRect = this.#anchor.getBoundingClientRect();
      left = anchorRect.right + 8;
      top = anchorRect.top;
    }

    // If overflows right edge, position overlapping the panel's right side
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 8;
    }

    // Clamp vertically
    if (top + pickerMaxHeight > window.innerHeight) {
      top = window.innerHeight - pickerMaxHeight - 8;
    }
    if (top < 8) top = 8;

    this.#element.style.left = `${left}px`;
    this.#element.style.top = `${top}px`;
  }

  /* ---------------------------------------- */
  /*  Search / Filter                         */
  /* ---------------------------------------- */

  #filterIcons(searchTerm) {
    if (!this.#element) return;
    const term = searchTerm.toLowerCase().trim();

    this.#element.querySelectorAll('.sessionflow-icon-picker__btn').forEach(btn => {
      const iconClass = btn.dataset.icon || '';
      const label = getIconLabel(iconClass).toLowerCase();
      btn.style.display = (!term || label.includes(term) || iconClass.includes(term)) ? '' : 'none';
    });

    // Hide categories where all icons are hidden
    this.#element.querySelectorAll('.sessionflow-icon-picker__category').forEach(heading => {
      const row = heading.nextElementSibling;
      if (!row || !row.classList.contains('sessionflow-icon-picker__row')) return;
      const hasVisible = [...row.querySelectorAll('.sessionflow-icon-picker__btn')]
        .some(btn => btn.style.display !== 'none');
      heading.style.display = hasVisible ? '' : 'none';
      row.style.display = hasVisible ? '' : 'none';
    });
  }

  /* ---------------------------------------- */
  /*  Custom Image Upload (Foundry FilePicker) */
  /* ---------------------------------------- */

  #openFilePicker() {
    const fp = new FilePicker({
      type: 'image',
      current: '',
      callback: (path) => {
        if (path) {
          // Prefix with "img:" so we can distinguish from FA class names
          this.#onSelect(`img:${path}`);
          this.close();
        }
      }
    });
    fp.render(true);
  }

  /* ---------------------------------------- */
  /*  Dismiss Handlers                        */
  /* ---------------------------------------- */

  #bindDismissHandlers() {
    this.#outsideClickHandler = (e) => {
      if (!this.#element?.contains(e.target) && !this.#anchor.contains(e.target)) {
        this.close();
      }
    };

    this.#escapeHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    };

    // Delay so the opening click doesn't immediately close
    requestAnimationFrame(() => {
      document.addEventListener('click', this.#outsideClickHandler, true);
      document.addEventListener('keydown', this.#escapeHandler, true);
    });
  }

  #unbindDismissHandlers() {
    if (this.#outsideClickHandler) {
      document.removeEventListener('click', this.#outsideClickHandler, true);
      this.#outsideClickHandler = null;
    }
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler, true);
      this.#escapeHandler = null;
    }
  }
}

/* ---------------------------------------- */
/*  Utility: Check if value is a custom img */
/* ---------------------------------------- */

/**
 * Check if an icon value is a custom image path.
 * @param {string} icon
 * @returns {boolean}
 */
export function isCustomImage(icon) {
  return icon?.startsWith('img:') ?? false;
}

/**
 * Extract the image path from a custom image icon value.
 * @param {string} icon
 * @returns {string}
 */
export function getImagePath(icon) {
  return icon?.replace(/^img:/, '') ?? '';
}
