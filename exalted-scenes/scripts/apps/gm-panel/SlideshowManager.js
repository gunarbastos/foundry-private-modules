/**
 * @file SlideshowManager.js
 * @description Manages slideshow CRUD operations and playback controls for the GMPanel.
 * Handles creating, editing, playing, pausing, and navigating slideshows.
 *
 * @module gm-panel/SlideshowManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { SlideshowEditor } from '../SlideshowEditor.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Manages slideshow operations in the GMPanel.
 * @extends BaseManager
 */
export class SlideshowManager extends BaseManager {
  /**
   * Creates a new SlideshowManager instance.
   * @param {ExaltedScenesGMPanel} panel - The parent GMPanel instance
   */
  constructor(panel) {
    super(panel);
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - CRUD
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Opens the SlideshowEditor to create a new slideshow.
   */
  handleCreateSlideshow() {
    new SlideshowEditor().render(true);
  }

  /**
   * Opens the SlideshowEditor to edit an existing slideshow.
   * @param {HTMLElement} target - The element with slideshow-id data attribute
   */
  handleEditSlideshow(target) {
    const slideshowId = target.dataset.slideshowId;
    if (slideshowId) {
      new SlideshowEditor(slideshowId).render(true);
    }
  }

  /**
   * Deletes a slideshow after user confirmation.
   * @param {HTMLElement} target - The element with slideshow-id data attribute
   */
  async handleDeleteSlideshow(target) {
    const slideshowId = target.dataset.slideshowId;
    const slideshow = Store.slideshows.get(slideshowId);
    if (!slideshow) return;

    const confirmed = await Dialog.confirm({
      title: localize('Dialog.DeleteSlideshow.Title'),
      content: format('Dialog.DeleteSlideshow.Content', { name: slideshow.name }),
      yes: () => true,
      no: () => false
    });

    if (confirmed) {
      Store.deleteSlideshow(slideshowId);
      this.render();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTION HANDLERS - PLAYBACK
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts playing a slideshow.
   * @param {HTMLElement} target - The element with slideshow-id data attribute
   */
  handlePlaySlideshow(target) {
    const slideshowId = target.dataset.slideshowId;
    if (slideshowId) {
      Store.startSlideshow(slideshowId);
    }
  }

  /**
   * Pauses the currently playing slideshow.
   */
  handleSlideshowPause() {
    Store.pauseSlideshow();
    this.render();
  }

  /**
   * Resumes a paused slideshow.
   */
  handleSlideshowResume() {
    Store.resumeSlideshow();
    this.render();
  }

  /**
   * Advances to the next scene in the slideshow.
   */
  handleSlideshowNext() {
    Store.nextScene();
    this.render();
  }

  /**
   * Goes back to the previous scene in the slideshow.
   */
  handleSlideshowPrev() {
    Store.previousScene();
    this.render();
  }

  /**
   * Stops the slideshow playback completely.
   */
  handleSlideshowStop() {
    Store.stopSlideshow();
    this.render();
  }
}
