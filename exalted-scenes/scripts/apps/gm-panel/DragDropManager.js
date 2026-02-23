/**
 * @file DragDropManager.js
 * @description Manages all drag-and-drop functionality for the GMPanel.
 * Handles dragging of cast members, cards (scenes/characters), folders,
 * and dropping onto various targets like cast strips, folders, and timelines.
 *
 * @module gm-panel/DragDropManager
 */

import { BaseManager } from './BaseManager.js';
import { Store } from '../../data/Store.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Manages drag-and-drop interactions in the GMPanel.
 * @extends BaseManager
 */
export class DragDropManager extends BaseManager {
  /**
   * Sets up all drag-and-drop event listeners.
   * @param {HTMLElement} element - The panel's root element
   */
  setup(element) {
    super.setup(element);

    this._setupCastMemberDragDrop();
    this._setupCardDragDrop();
    this._setupFolderDropTargets();
    this._setupCastStripDropZone();
    this._setupSequenceTimelineDrop();
    this._setupLibraryDropZone();
  }

  /**
   * Sets up drag-and-drop for cast members (reordering within cast strip).
   * Also handles right-click context menu for removal.
   * @private
   */
  _setupCastMemberDragDrop() {
    const castMembers = this.element.querySelectorAll('.es-cast-member:not(.add-new)');

    castMembers.forEach(member => {
      // Get the scene ID from the parent cast strip
      const parentStrip = member.closest('.es-cast-strip');
      const memberSceneId = parentStrip?.dataset.sceneId || this.uiState.selectedId;

      // Right-click context menu to remove from scene
      member.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const charId = member.dataset.characterId;

        Dialog.confirm({
          title: localize('Dialog.RemoveFromScene.Title'),
          content: `<p>${localize('Dialog.RemoveFromScene.Content')}</p>`,
          yes: () => {
            Store.removeCastMember(memberSceneId, charId);
            if (this.uiState.emotionPicker.characterId === charId) {
              this.uiState.emotionPicker.open = false;
            }
            this.render();
          }
        });
      }, { signal: this.signal });

      // Drag Start for Cast Member (Reordering)
      member.addEventListener('dragstart', (e) => {
        // Set drag data before anything else
        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'cast-reorder',
          id: member.dataset.characterId,
          fromIndex: parseInt(member.dataset.index),
          sceneId: memberSceneId
        }));
        e.dataTransfer.effectAllowed = 'move';

        // Create custom drag image (copy of element)
        const dragImage = member.cloneNode(true);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.opacity = '0.8';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 25, 25);

        // Add class after small delay to not affect drag image
        setTimeout(() => {
          member.classList.add('es-cast-member--dragging');
          document.body.removeChild(dragImage);
        }, 0);
      }, { signal: this.signal });

      member.addEventListener('dragend', (e) => {
        member.classList.remove('es-cast-member--dragging');
        this.element.querySelectorAll('.es-cast-member').forEach(m => {
          m.classList.remove('es-cast-member--drag-target');
        });
        // Remove class from all cast strips
        this.element.querySelectorAll('.es-cast-strip').forEach(strip => {
          strip.classList.remove('es-cast-strip--drag-over');
        });
      }, { signal: this.signal });

      // Drop target for reordering
      member.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        const dragging = this.element.querySelector('.es-cast-member--dragging');
        if (dragging && dragging !== member && !member.classList.contains('add-new')) {
          // Remove from all others
          this.element.querySelectorAll('.es-cast-member--drag-target').forEach(m => {
            if (m !== member) m.classList.remove('es-cast-member--drag-target');
          });
          member.classList.add('es-cast-member--drag-target');
        }
      }, { signal: this.signal });

      member.addEventListener('dragleave', (e) => {
        // Only remove if actually left the element
        if (!member.contains(e.relatedTarget)) {
          member.classList.remove('es-cast-member--drag-target');
        }
      }, { signal: this.signal });

      member.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        member.classList.remove('es-cast-member--drag-target');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.type === 'cast-reorder') {
            const toIndex = parseInt(member.dataset.index);
            if (data.fromIndex !== toIndex) {
              Store.reorderCastMember(data.sceneId, data.fromIndex, toIndex);
              this.render();
            }
          }
        } catch (err) {
          console.warn('Invalid drop data', err);
        }
      }, { signal: this.signal });
    });
  }

  /**
   * Sets up drag-and-drop for cards (scenes/characters) in the library grid.
   * Handles both moving to folders and reordering.
   * @private
   */
  _setupCardDragDrop() {
    const allCards = this.element.querySelectorAll('.es-card');
    const isFavorites = this.uiState.currentView.includes('favorites');
    const isInFolder = this.uiState.currentFolderId !== null;
    const canReorder = !isFavorites && !isInFolder; // Can only reorder in "All" view at root

    allCards.forEach((card, cardIndex) => {
      card.setAttribute('draggable', 'true');
      card.dataset.cardIndex = cardIndex; // Store index for reordering

      card.addEventListener('dragstart', (e) => {
        const itemType = card.dataset.type;
        const itemId = card.dataset.id;

        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: itemType === 'character' ? 'character' : 'scene',
          id: itemId,
          isLibraryItem: true, // Flag to identify library items for folder drop
          cardIndex: cardIndex // For reordering
        }));
        e.dataTransfer.effectAllowed = 'copyMove';

        card.classList.add('es-card--dragging');

        // Show drop zones on folders
        this.element.querySelectorAll('.es-folder-card:not(.es-folder-back)').forEach(f => {
          f.classList.add('es-folder-card--drop-zone');
        });

        // Show reorder indicators on other cards (only in reorderable views)
        if (canReorder) {
          allCards.forEach(c => {
            if (c !== card) c.classList.add('es-card--reorder-target');
          });
        }
      }, { signal: this.signal });

      card.addEventListener('dragend', (e) => {
        card.classList.remove('es-card--dragging');
        // Remove drop zone indicators
        this.element.querySelectorAll('.es-folder-card').forEach(f => {
          f.classList.remove('es-folder-card--drop-zone', 'es-folder-card--drag-over');
        });
        // Remove reorder indicators
        allCards.forEach(c => {
          c.classList.remove('es-card--reorder-target', 'es-card--drag-over-left', 'es-card--drag-over-right');
        });
      }, { signal: this.signal });

      // === REORDER DROP TARGET ===
      if (canReorder) {
        card.addEventListener('dragover', (e) => {
          e.preventDefault();

          // Check if dragging a card of the same type
          const draggingCard = this.element.querySelector('.es-card--dragging');
          if (!draggingCard || draggingCard === card) return;
          if (draggingCard.dataset.type !== card.dataset.type) return;

          e.dataTransfer.dropEffect = 'move';

          // Determine drop position (left or right of target)
          const rect = card.getBoundingClientRect();
          const midpoint = rect.left + rect.width / 2;
          const isLeft = e.clientX < midpoint;

          // Update visual indicator
          card.classList.remove('es-card--drag-over-left', 'es-card--drag-over-right');
          card.classList.add(isLeft ? 'es-card--drag-over-left' : 'es-card--drag-over-right');
        }, { signal: this.signal });

        card.addEventListener('dragleave', (e) => {
          if (!card.contains(e.relatedTarget)) {
            card.classList.remove('es-card--drag-over-left', 'es-card--drag-over-right');
          }
        }, { signal: this.signal });

        card.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove('es-card--drag-over-left', 'es-card--drag-over-right');

          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (!data.isLibraryItem) return;

            // Only reorder same type
            const targetType = card.dataset.type === 'scene' ? 'scene' : 'character';
            if (data.type !== targetType) return;

            // Get all current items in order
            const storeType = targetType === 'scene' ? 'scenes' : 'characters';
            const currentOrder = Array.from(this.element.querySelectorAll('.es-card'))
              .filter(c => c.dataset.type === card.dataset.type)
              .map(c => c.dataset.id);

            // Find positions
            const fromIndex = currentOrder.indexOf(data.id);
            const toIndex = currentOrder.indexOf(card.dataset.id);

            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

            // Determine if dropping left or right
            const rect = card.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const isLeft = e.clientX < midpoint;

            // Create new order
            const newOrder = [...currentOrder];
            newOrder.splice(fromIndex, 1); // Remove from old position
            let insertIndex = currentOrder.indexOf(card.dataset.id);
            if (fromIndex < insertIndex) insertIndex--; // Adjust for removed item
            if (!isLeft) insertIndex++; // Insert after if dropping on right
            newOrder.splice(insertIndex, 0, data.id);

            // Save custom order and switch to custom sort
            Store.setCustomOrder(storeType, newOrder);
            this.uiState.sortBy = 'custom';
            this.render();
            ui.notifications.info(localize('Notifications.CustomOrderSaved'));
          } catch (err) {
            console.warn('Invalid reorder drop', err);
          }
        }, { signal: this.signal });
      }
    });
  }

  /**
   * Sets up drop zones for folders (moving items into folders).
   * Also handles the "back" folder for moving items to parent.
   * @private
   */
  _setupFolderDropTargets() {
    // Regular folder drop zones
    const folderCards = this.element.querySelectorAll('.es-folder-card:not(.es-folder-back)');
    folderCards.forEach(folder => {
      folder.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          e.dataTransfer.dropEffect = 'move';
          folder.classList.add('es-folder-card--drag-over');
        } catch (err) {
          // Ignore
        }
      }, { signal: this.signal });

      folder.addEventListener('dragleave', (e) => {
        if (!folder.contains(e.relatedTarget)) {
          folder.classList.remove('es-folder-card--drag-over');
        }
      }, { signal: this.signal });

      folder.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        folder.classList.remove('es-folder-card--drag-over');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.isLibraryItem) {
            const folderId = folder.dataset.folderId;
            const itemType = data.type;
            Store.moveItemToFolder(data.id, itemType, folderId);
            this.render();
            ui.notifications.info(localize('Notifications.MovedToFolder'));
          }
        } catch (err) {
          console.warn('Invalid folder drop', err);
        }
      }, { signal: this.signal });
    });

    // "Back" folder - move items OUT of folder (to parent)
    const backFolder = this.element.querySelector('.es-folder-back');
    if (backFolder) {
      backFolder.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        backFolder.classList.add('es-folder-card--drag-over');
      }, { signal: this.signal });

      backFolder.addEventListener('dragleave', (e) => {
        if (!backFolder.contains(e.relatedTarget)) {
          backFolder.classList.remove('es-folder-card--drag-over');
        }
      }, { signal: this.signal });

      backFolder.addEventListener('drop', (e) => {
        e.preventDefault();
        backFolder.classList.remove('es-folder-card--drag-over');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.isLibraryItem) {
            // Move to parent folder (or root if already at first level)
            const currentFolder = Store.folders.get(this.uiState.currentFolderId);
            const targetFolderId = currentFolder?.parent || null;
            Store.moveItemToFolder(data.id, data.type, targetFolderId);
            this.render();
            ui.notifications.info(localize('Notifications.MovedToParentFolder'));
          }
        } catch (err) {
          console.warn('Invalid back-folder drop', err);
        }
      }, { signal: this.signal });
    }
  }

  /**
   * Sets up drop zones for cast strips (adding characters to scene cast).
   * Works for both inspector and floating cast strips.
   * @private
   */
  _setupCastStripDropZone() {
    const castStrips = this.element.querySelectorAll('.es-cast-strip');
    castStrips.forEach(castStrip => {
      const sceneId = castStrip.dataset.sceneId;

      castStrip.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        castStrip.classList.add('es-cast-strip--drag-over');
      }, { signal: this.signal });

      castStrip.addEventListener('dragleave', (e) => {
        if (!castStrip.contains(e.relatedTarget)) {
          castStrip.classList.remove('es-cast-strip--drag-over');
        }
      }, { signal: this.signal });

      castStrip.addEventListener('drop', async (e) => {
        e.preventDefault();
        castStrip.classList.remove('es-cast-strip--drag-over');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.type === 'character') {
            const targetSceneId = sceneId || this.uiState.selectedId;
            const scene = Store.scenes.get(targetSceneId);
            // Check if not already in cast
            if (scene && !scene.cast.some(c => c.id === data.id)) {
              this.panel._castManager._lastAddedCharId = data.id;
              Store.addCastMember(targetSceneId, data.id);
              this.render();
              this._showCastFeedback(castStrip, "Character added!");
            } else {
              ui.notifications.warn(localize('Notifications.CharacterAlreadyInCast'));
            }
          }
        } catch (err) {
          console.warn('Invalid cast drop', err);
        }
      }, { signal: this.signal });
    });
  }

  /**
   * Sets up drop zone for sequence timeline (adding scene backgrounds to sequence).
   * @private
   */
  _setupSequenceTimelineDrop() {
    const sequenceTimeline = this.element.querySelector('.es-sequence-timeline');
    if (!sequenceTimeline) return;

    sequenceTimeline.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        e.dataTransfer.dropEffect = 'copy';
        sequenceTimeline.classList.add('es-sequence-timeline--drag-over');
      } catch (err) {
        // Ignore
      }
    }, { signal: this.signal });

    sequenceTimeline.addEventListener('dragleave', (e) => {
      if (!sequenceTimeline.contains(e.relatedTarget)) {
        sequenceTimeline.classList.remove('es-sequence-timeline--drag-over');
      }
    }, { signal: this.signal });

    sequenceTimeline.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sequenceTimeline.classList.remove('es-sequence-timeline--drag-over');

      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));

        // Only accept scenes (not characters)
        if (data.type !== 'scene' || !data.isLibraryItem) return;

        const droppedScene = Store.scenes.get(data.id);
        if (!droppedScene) return;

        const currentSceneId = this.uiState.selectedId;
        const currentScene = Store.scenes.get(currentSceneId);
        if (!currentScene || !currentScene.isSequence) return;

        // Don't allow dropping the same scene onto itself
        if (data.id === currentSceneId) {
          ui.notifications.warn(localize('Notifications.CannotAddToOwnSequence'));
          return;
        }

        // Add the dropped scene's background to the sequence
        const bgPath = droppedScene.background;
        const isVideo = bgPath.match(/\.(mp4|webm|ogg|mov)$/i);
        currentScene.addSequenceBackground(bgPath, isVideo ? 'video' : 'image');
        Store.saveData();
        this.render();
        ui.notifications.info(format('Notifications.AddedBgToSequence', { name: droppedScene.name }));
      } catch (err) {
        console.warn('Invalid sequence drop', err);
      }
    }, { signal: this.signal });
  }

  /**
   * Sets up drop zone for main library area (removing cast members by dragging out).
   * @private
   */
  _setupLibraryDropZone() {
    const library = this.element.querySelector('.es-library');
    if (!library) return;

    library.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }, { signal: this.signal });

    library.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'cast-reorder') {
          Store.removeCastMember(data.sceneId, data.id);
          this.render();
          ui.notifications.info(localize('Notifications.CharacterRemovedFromScene'));
        }
      } catch (err) {
        // Ignore invalid drops
      }
    }, { signal: this.signal });
  }

  /**
   * Shows visual feedback toast on cast strip.
   * @param {HTMLElement} castStrip - The cast strip element
   * @param {string} message - Message to display
   * @private
   */
  _showCastFeedback(castStrip, message) {
    if (!castStrip) return;

    const toast = document.createElement('div');
    toast.className = 'es-feedback-toast';
    toast.textContent = message;
    castStrip.style.position = 'relative';
    castStrip.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }
}
