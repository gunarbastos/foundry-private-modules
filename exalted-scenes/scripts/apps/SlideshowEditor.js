import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { localize, format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * SlideshowEditor - Editor for creating and managing slideshows
 */
export class SlideshowEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(slideshowId = null, options = {}) {
    super(options);
    this.slideshowId = slideshowId;

    // Initialize UI state
    const slideshow = slideshowId ? Store.slideshows.get(slideshowId) : null;
    this.uiState = {
      data: {
        name: slideshow?.name || 'New Slideshow',
        scenes: slideshow?.scenes?.map(s => ({ ...s })) || [],
        defaultDuration: slideshow?.defaultDuration || 5000,
        transitionType: slideshow?.transitionType || 'dissolve',
        transitionDuration: slideshow?.transitionDuration || 500,
        backgroundMotion: slideshow?.backgroundMotion || 'none',
        loop: slideshow?.loop || false,
        shuffle: slideshow?.shuffle || false,
        cinematicMode: slideshow?.cinematicMode || false
      }
    };
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-slideshow-editor',
    classes: ['exalted-scenes', 'es-slideshow-editor'],
    window: {
      title: 'Slideshow Editor',
      icon: 'fas fa-images',
      resizable: true
    },
    position: {
      width: 600,
      height: 700
    },
    actions: {
      'add-scene': SlideshowEditor._onAddScene,
      'remove-scene': SlideshowEditor._onRemoveScene,
      'move-scene-up': SlideshowEditor._onMoveSceneUp,
      'move-scene-down': SlideshowEditor._onMoveSceneDown,
      'save': SlideshowEditor._onSave,
      'cancel': SlideshowEditor._onCancel,
      'play-preview': SlideshowEditor._onPlayPreview
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/slideshow-editor.hbs',
      scrollable: ['.es-slideshow-editor__content']
    }
  };

  get title() {
    return this.slideshowId ? `Edit Slideshow: ${this.uiState.data.name}` : 'Create New Slideshow';
  }

  async _prepareContext(options) {
    const availableScenes = Store.getScenes()
      .filter(scene => !this.uiState.data.scenes.some(s => s.sceneId === scene.id))
      .map(scene => ({
        id: scene.id,
        name: scene.name,
        thumbnail: scene.thumbnail
      }));

    const scenesWithDetails = this.uiState.data.scenes.map((sceneItem, index) => {
      const scene = Store.scenes.get(sceneItem.sceneId);
      return {
        ...sceneItem,
        index,
        name: scene?.name || 'Unknown Scene',
        thumbnail: scene?.thumbnail || CONFIG.DEFAULTS.SCENE_BG,
        durationSeconds: sceneItem.duration / 1000
      };
    });

    const transitions = Object.entries(CONFIG.TRANSITIONS).map(([key, value]) => ({
      key,
      name: game.i18n.localize(value.name),
      selected: this.uiState.data.transitionType === key
    }));

    const motionPresets = Object.entries(CONFIG.BACKGROUND_MOTION).map(([key, value]) => ({
      key,
      name: game.i18n.localize(value.name),
      selected: this.uiState.data.backgroundMotion === key
    }));

    return {
      isNew: !this.slideshowId,
      data: this.uiState.data,
      scenes: scenesWithDetails,
      availableScenes,
      transitions,
      motionPresets,
      totalDuration: this._formatDuration(this._calculateTotalDuration()),
      sceneCount: this.uiState.data.scenes.length
    };
  }

  _calculateTotalDuration() {
    return this.uiState.data.scenes.reduce((sum, s) => sum + s.duration, 0);
  }

  _formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind name input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('change', (e) => {
        this.uiState.data.name = e.target.value;
      });
    }

    // Bind default duration input
    const durationInput = this.element.querySelector('input[name="defaultDuration"]');
    if (durationInput) {
      durationInput.addEventListener('change', (e) => {
        this.uiState.data.defaultDuration = parseInt(e.target.value) * 1000;
      });
    }

    // Bind transition type select
    const transitionSelect = this.element.querySelector('select[name="transitionType"]');
    if (transitionSelect) {
      transitionSelect.addEventListener('change', (e) => {
        this.uiState.data.transitionType = e.target.value;
      });
    }

    // Bind transition duration input
    const transitionDuration = this.element.querySelector('input[name="transitionDuration"]');
    if (transitionDuration) {
      transitionDuration.addEventListener('change', (e) => {
        this.uiState.data.transitionDuration = parseInt(e.target.value);
      });
    }

    // Bind background motion select
    const motionSelect = this.element.querySelector('select[name="backgroundMotion"]');
    if (motionSelect) {
      motionSelect.addEventListener('change', (e) => {
        this.uiState.data.backgroundMotion = e.target.value;
      });
    }

    // Bind checkbox options
    const loopCheckbox = this.element.querySelector('input[name="loop"]');
    if (loopCheckbox) {
      loopCheckbox.addEventListener('change', (e) => {
        this.uiState.data.loop = e.target.checked;
      });
    }

    const shuffleCheckbox = this.element.querySelector('input[name="shuffle"]');
    if (shuffleCheckbox) {
      shuffleCheckbox.addEventListener('change', (e) => {
        this.uiState.data.shuffle = e.target.checked;
      });
    }

    const cinematicCheckbox = this.element.querySelector('input[name="cinematicMode"]');
    if (cinematicCheckbox) {
      cinematicCheckbox.addEventListener('change', (e) => {
        this.uiState.data.cinematicMode = e.target.checked;
      });
    }

    // Bind scene duration inputs
    const sceneDurationInputs = this.element.querySelectorAll('input[name="sceneDuration"]');
    sceneDurationInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.uiState.data.scenes[index].duration = parseFloat(e.target.value) * 1000;
        this.render();
      });
    });

    // Setup drag and drop for reordering
    this._setupDragAndDrop();
  }

  _setupDragAndDrop() {
    const container = this.element.querySelector('.es-slideshow-editor__scenes');
    if (!container) return;

    // Make scene items draggable
    const items = container.querySelectorAll('.es-slideshow-editor__scene');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        item.classList.add('es-slideshow-editor__scene--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.index);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('es-slideshow-editor__scene--dragging');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = container.querySelector('.es-slideshow-editor__scene--dragging');
        if (dragging && dragging !== item) {
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            container.insertBefore(dragging, item);
          } else {
            container.insertBefore(dragging, item.nextSibling);
          }
        }
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        // Reorder based on new DOM order
        const newOrder = Array.from(container.querySelectorAll('.es-slideshow-editor__scene'))
          .map(el => parseInt(el.dataset.index));

        const newScenes = newOrder.map(oldIndex => this.uiState.data.scenes[oldIndex]);
        this.uiState.data.scenes = newScenes;
        this.render();
      });
    });

    // Allow dropping from available scenes list
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('es-slideshow-editor__scenes--drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('es-slideshow-editor__scenes--drag-over');
    });

    // Available scenes drag handling
    const availableScenes = this.element.querySelectorAll('.es-slideshow-editor__available-scene');
    availableScenes.forEach(scene => {
      scene.draggable = true;
      scene.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-scene-id', scene.dataset.sceneId);
      });
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('es-slideshow-editor__scenes--drag-over');

      const sceneId = e.dataTransfer.getData('application/x-scene-id');
      if (sceneId) {
        this._addScene(sceneId);
      }
    });
  }

  _addScene(sceneId) {
    if (this.uiState.data.scenes.some(s => s.sceneId === sceneId)) return;

    this.uiState.data.scenes.push({
      sceneId,
      duration: this.uiState.data.defaultDuration
    });
    this.render();
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════

  static _onAddScene(event, target) {
    const sceneId = target.dataset.sceneId;
    if (sceneId) {
      this._addScene(sceneId);
    }
  }

  static _onRemoveScene(event, target) {
    const index = parseInt(target.dataset.index);
    this.uiState.data.scenes.splice(index, 1);
    this.render();
  }

  static _onMoveSceneUp(event, target) {
    const index = parseInt(target.dataset.index);
    if (index > 0) {
      [this.uiState.data.scenes[index], this.uiState.data.scenes[index - 1]] =
      [this.uiState.data.scenes[index - 1], this.uiState.data.scenes[index]];
      this.render();
    }
  }

  static _onMoveSceneDown(event, target) {
    const index = parseInt(target.dataset.index);
    if (index < this.uiState.data.scenes.length - 1) {
      [this.uiState.data.scenes[index], this.uiState.data.scenes[index + 1]] =
      [this.uiState.data.scenes[index + 1], this.uiState.data.scenes[index]];
      this.render();
    }
  }

  static async _onSave(event, target) {
    const data = this.uiState.data;

    if (!data.name.trim()) {
      ui.notifications.warn(localize('Notifications.WarnSlideshowNoName'));
      return;
    }

    if (data.scenes.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnSlideshowNoScenes'));
      return;
    }

    if (this.slideshowId) {
      // Update existing slideshow
      const slideshow = Store.slideshows.get(this.slideshowId);
      if (slideshow) {
        slideshow.name = data.name;
        slideshow.scenes = data.scenes;
        slideshow.defaultDuration = data.defaultDuration;
        slideshow.transitionType = data.transitionType;
        slideshow.transitionDuration = data.transitionDuration;
        slideshow.backgroundMotion = data.backgroundMotion;
        slideshow.loop = data.loop;
        slideshow.shuffle = data.shuffle;
        slideshow.cinematicMode = data.cinematicMode;
        await Store.saveSlideshows();
        ui.notifications.info(format('Notifications.SlideshowUpdated', { name: data.name }));
      }
    } else {
      // Create new slideshow
      Store.createSlideshow(data);
      ui.notifications.info(format('Notifications.SlideshowCreatedName', { name: data.name }));
    }

    this.close();

    // Refresh GM Panel if open
    const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
    if (gmPanel) gmPanel.render();
  }

  static _onCancel(event, target) {
    this.close();
  }

  static _onPlayPreview(event, target) {
    if (this.uiState.data.scenes.length === 0) {
      ui.notifications.warn(localize('Notifications.WarnSlideshowAddScenes'));
      return;
    }

    // Save first if it's a new slideshow
    if (!this.slideshowId) {
      ui.notifications.info(localize('Notifications.WarnSlideshowSaveFirst'));
      return;
    }

    Store.startSlideshow(this.slideshowId);
    this.close();
  }
}
