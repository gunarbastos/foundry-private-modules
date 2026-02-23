/**
 * @file SequenceManager.js
 * @description Manages scene sequence operations and playback controls for the GMPanel.
 * Handles converting scenes to sequences, adding/removing backgrounds, and navigation.
 *
 * @module gm-panel/SequenceManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SocketHandler } from '../../data/SocketHandler.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Manages scene sequence operations in the GMPanel.
 * Sequences are scenes with multiple backgrounds that can be navigated.
 * @extends BaseManager
 */
export class SequenceManager extends BaseManager {
  /**
   * Creates a new SequenceManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);
  }

  /* ═══════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Sets up sequence settings event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);

    const sequencePanel = element.querySelector('.es-sequence-panel');
    if (!sequencePanel) return;

    // Transition Type Select
    const transitionSelect = sequencePanel.querySelector('[data-action="sequence-transition-type"]');
    if (transitionSelect) {
      transitionSelect.addEventListener('change', (e) => this._handleTransitionTypeChange(e), { signal: this.signal });
    }

    // Transition Duration Input
    const durationInput = sequencePanel.querySelector('[data-action="sequence-transition-duration"]');
    if (durationInput) {
      durationInput.addEventListener('change', (e) => this._handleDurationChange(e), { signal: this.signal });
    }

    // On End Select
    const onEndSelect = sequencePanel.querySelector('[data-action="sequence-on-end"]');
    if (onEndSelect) {
      onEndSelect.addEventListener('change', (e) => this._handleOnEndChange(e), { signal: this.signal });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Handles transition type setting change.
   * @param {Event} e - Change event
   * @private
   */
  _handleTransitionTypeChange(e) {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (scene && scene.isSequence) {
      scene.sequenceSettings.transitionType = e.target.value;
      Store.saveData();
      // Update live sequence if active
      if (Store.sequenceState.isActive && Store.sequenceState.sceneId === sceneId) {
        Store.sequenceState.transitionType = e.target.value;
      }
      this.render();
    }
  }

  /**
   * Handles transition duration setting change.
   * @param {Event} e - Change event
   * @private
   */
  _handleDurationChange(e) {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (scene && scene.isSequence) {
      const duration = parseFloat(e.target.value) || 1.0;
      scene.sequenceSettings.transitionDuration = Math.max(0.1, Math.min(5, duration));
      Store.saveData();
      // Update live sequence if active
      if (Store.sequenceState.isActive && Store.sequenceState.sceneId === sceneId) {
        Store.sequenceState.transitionDuration = scene.sequenceSettings.transitionDuration;
      }
    }
  }

  /**
   * Handles on-end behavior setting change.
   * @param {Event} e - Change event
   * @private
   */
  _handleOnEndChange(e) {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (scene && scene.isSequence) {
      scene.sequenceSettings.onEnd = e.target.value;
      Store.saveData();
      // Update live sequence if active
      if (Store.sequenceState.isActive && Store.sequenceState.sceneId === sceneId) {
        Store.sequenceState.onEnd = e.target.value;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - CONVERSION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Converts a regular scene to a sequence.
   */
  handleConvertToSequence() {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    scene.convertToSequence();
    Store.saveData();
    this.render();
    ui.notifications.info(format('Notifications.SequenceConvertedName', { name: scene.name }));
  }

  /**
   * Converts a sequence back to a regular scene.
   */
  handleRemoveSequence() {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    Dialog.confirm({
      title: localize('Dialog.ConvertToRegular.Title'),
      content: localize('Dialog.ConvertToRegular.Content'),
      yes: () => {
        // Stop sequence if it's playing
        if (Store.sequenceState.isActive && Store.sequenceState.sceneId === sceneId) {
          Store.stopSequence();
        }
        scene.convertToRegular();
        Store.saveData();
        this.render();
        ui.notifications.info(format('Notifications.SequenceRevertedName', { name: scene.name }));
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - BACKGROUNDS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens file picker to add a new background to the sequence.
   */
  async handleAddSequenceBg() {
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    const fp = new FilePicker({
      type: 'imagevideo',
      current: scene.sequenceBackgrounds.length > 0
        ? scene.sequenceBackgrounds[scene.sequenceBackgrounds.length - 1].path
        : scene.background,
      callback: (path) => {
        const isVideo = path.match(/\.(mp4|webm|ogg|mov)$/i);
        scene.addSequenceBackground(path, isVideo ? 'video' : 'image');
        Store.saveData();
        this.render();
      }
    });
    fp.browse();
  }

  /**
   * Removes a background from the sequence.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Element with bg-id data attribute
   */
  handleRemoveSequenceBg(event, target) {
    event.stopPropagation();
    const bgId = target.dataset.bgId;
    const sceneId = this.uiState.selectedId;
    const scene = Store.scenes.get(sceneId);
    if (!scene || !bgId) return;

    // Don't allow removing last background
    if (scene.sequenceBackgrounds.length <= 1) {
      ui.notifications.warn(localize('Notifications.WarnCannotRemoveLastBg'));
      return;
    }

    scene.removeSequenceBackground(bgId);
    Store.saveData();
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - NAVIGATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Navigates to a specific background index in the sequence.
   * @param {HTMLElement} target - Element with index data attribute
   */
  handleSequenceGoto(target) {
    const index = parseInt(target.dataset.index, 10);
    if (isNaN(index)) return;

    // Only navigate if sequence is active
    if (Store.sequenceState.isActive) {
      Store.sequenceGoTo(index);
    }
  }

  /**
   * Starts broadcasting a sequence.
   */
  handleBroadcastSequence() {
    const sceneId = this.uiState.selectedId;
    if (!sceneId) return;

    Store.startSequence(sceneId);
    this.render();
  }

  /**
   * Goes to the previous background in the sequence.
   */
  handleSequencePrev() {
    Store.sequencePrevious();
    this.render();
  }

  /**
   * Goes to the next background in the sequence.
   */
  handleSequenceNext() {
    Store.sequenceNext();
    this.render();
  }
}
