/**
 * @file OrderingService.js
 * @description Service for managing custom ordering of scenes and characters.
 * Handles persistence and application of user-defined item order.
 *
 * @module data/store/OrderingService
 */

import { CONFIG } from '../../config.js';
import { BaseService } from './BaseService.js';

/**
 * Service for custom ordering management.
 * Allows users to define a custom sort order for scenes and characters
 * that persists across sessions.
 *
 * @extends BaseService
 */
export class OrderingService extends BaseService {
  /**
   * Creates a new OrderingService instance.
   * @param {ExaltedStore} store - Reference to the main store instance
   */
  constructor(store) {
    super(store);
  }

  /* ═══════════════════════════════════════════════════════════════
     GETTERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Get the custom order array for a specific type.
   *
   * @param {'scenes'|'characters'} type - The type of items to get order for
   * @returns {string[]} Array of item IDs in custom order
   *
   * @example
   * const sceneOrder = orderingService.getCustomOrder('scenes');
   * // ['scene-id-1', 'scene-id-3', 'scene-id-2']
   */
  getCustomOrder(type) {
    return this.customOrder[type] || [];
  }

  /**
   * Check if a custom order exists for the given type.
   *
   * @param {'scenes'|'characters'} type - The type to check
   * @returns {boolean} True if custom order has been set
   */
  hasCustomOrder(type) {
    const order = this.customOrder[type];
    return Array.isArray(order) && order.length > 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     SETTERS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Set the custom order for a specific type.
   * Automatically saves to persistent storage.
   *
   * @param {'scenes'|'characters'} type - The type of items to set order for
   * @param {string[]} orderedIds - Array of item IDs in desired order
   * @returns {Promise<void>}
   *
   * @example
   * await orderingService.setCustomOrder('scenes', ['scene-3', 'scene-1', 'scene-2']);
   */
  async setCustomOrder(type, orderedIds) {
    if (!Array.isArray(orderedIds)) {
      this._warn('setCustomOrder: orderedIds must be an array');
      return;
    }

    this.store.customOrder[type] = orderedIds;
    await this.saveCustomOrder();

    this._log(`Custom order set for ${type}: ${orderedIds.length} items`);
  }

  /**
   * Clear the custom order for a specific type.
   * Items will revert to default sorting.
   *
   * @param {'scenes'|'characters'} type - The type to clear order for
   * @returns {Promise<void>}
   */
  async clearCustomOrder(type) {
    this.store.customOrder[type] = [];
    await this.saveCustomOrder();

    this._log(`Custom order cleared for ${type}`);
  }

  /* ═══════════════════════════════════════════════════════════════
     PERSISTENCE
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Save the current custom order to persistent storage.
   * Called automatically by setCustomOrder.
   *
   * @returns {Promise<void>}
   */
  async saveCustomOrder() {
    if (!this.isInitialized) return;

    await game.settings.set(
      CONFIG.MODULE_ID,
      CONFIG.SETTINGS.CUSTOM_ORDER,
      this.store.customOrder
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     ORDER APPLICATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Apply custom order to an array of items.
   * Items not in the custom order are placed at the end, preserving
   * their relative order.
   *
   * @param {Array<{id: string}>} items - Array of items with id property
   * @param {'scenes'|'characters'} type - The type to use for ordering
   * @returns {Array} Sorted array of items
   *
   * @example
   * const scenes = store.scenes.contents;
   * const orderedScenes = orderingService.applyCustomOrder(scenes, 'scenes');
   */
  applyCustomOrder(items, type) {
    const order = this.getCustomOrder(type);

    // If no custom order, return items as-is
    if (!order.length) return items;

    // Create a map of id -> position for O(1) lookup
    const orderMap = new Map(order.map((id, idx) => [id, idx]));

    // Sort items: ordered items first, then unordered items at the end
    return [...items].sort((a, b) => {
      const aIdx = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
      const bIdx = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
      return aIdx - bIdx;
    });
  }

  /**
   * Update the custom order when an item is moved.
   * Handles reordering by removing item from old position and
   * inserting at new position.
   *
   * @param {'scenes'|'characters'} type - The type of items
   * @param {string} itemId - ID of the item being moved
   * @param {number} newIndex - New position in the order
   * @returns {Promise<void>}
   *
   * @example
   * // Move scene to position 2
   * await orderingService.moveItem('scenes', 'scene-id', 2);
   */
  async moveItem(type, itemId, newIndex) {
    const order = [...this.getCustomOrder(type)];

    // Remove from current position if exists
    const currentIndex = order.indexOf(itemId);
    if (currentIndex !== -1) {
      order.splice(currentIndex, 1);
    }

    // Insert at new position
    order.splice(newIndex, 0, itemId);

    await this.setCustomOrder(type, order);
  }

  /**
   * Add a new item to the custom order at a specific position.
   * If no position specified, adds to the end.
   *
   * @param {'scenes'|'characters'} type - The type of items
   * @param {string} itemId - ID of the item to add
   * @param {number} [position] - Optional position to insert at
   * @returns {Promise<void>}
   */
  async addItem(type, itemId, position = undefined) {
    const order = [...this.getCustomOrder(type)];

    // Don't add duplicates
    if (order.includes(itemId)) return;

    if (position !== undefined) {
      order.splice(position, 0, itemId);
    } else {
      order.push(itemId);
    }

    await this.setCustomOrder(type, order);
  }

  /**
   * Remove an item from the custom order.
   * Called when an item is deleted.
   *
   * @param {'scenes'|'characters'} type - The type of items
   * @param {string} itemId - ID of the item to remove
   * @returns {Promise<void>}
   */
  async removeItem(type, itemId) {
    const order = this.getCustomOrder(type);
    const index = order.indexOf(itemId);

    if (index === -1) return;

    const newOrder = [...order];
    newOrder.splice(index, 1);

    await this.setCustomOrder(type, newOrder);
  }

  /**
   * Synchronize the custom order with existing items.
   * Removes IDs of items that no longer exist and optionally
   * adds new items to the end.
   *
   * @param {'scenes'|'characters'} type - The type to sync
   * @param {boolean} [addNew=false] - Whether to add new items to the order
   * @returns {Promise<void>}
   */
  async syncWithItems(type, addNew = false) {
    const order = this.getCustomOrder(type);
    const collection = type === 'scenes' ? this.scenes : this.characters;
    const existingIds = new Set(collection.map(item => item.id));

    // Filter out deleted items
    let newOrder = order.filter(id => existingIds.has(id));

    // Optionally add new items
    if (addNew) {
      const orderedSet = new Set(newOrder);
      collection.forEach(item => {
        if (!orderedSet.has(item.id)) {
          newOrder.push(item.id);
        }
      });
    }

    // Only save if changed
    if (newOrder.length !== order.length || !newOrder.every((id, i) => order[i] === id)) {
      await this.setCustomOrder(type, newOrder);
    }
  }
}
