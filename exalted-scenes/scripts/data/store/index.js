/**
 * @file index.js
 * @description Central export point for all Store services.
 * Each service handles a specific domain of the data store.
 *
 * @module data/store
 */

// Base class
export { BaseService } from './BaseService.js';

// Entity services (CRUD operations)
export { SceneService } from './SceneService.js';           // C2: Scene CRUD + cast management
export { CharacterService } from './CharacterService.js';   // C3: Character CRUD + tags
export { FolderService } from './FolderService.js';         // C4: Folder CRUD + navigation
export { SlideshowService } from './SlideshowService.js';   // C5: Slideshow CRUD (no playback)

// Playback services (state management + broadcasting)
export { SlideshowPlaybackService } from './SlideshowPlaybackService.js';  // C6: Slideshow playback
export { SequencePlaybackService } from './SequencePlaybackService.js';    // C7: Sequence playback
export { CastOnlyService } from './CastOnlyService.js';                    // C8: Cast-only mode

// Utility services
export { OrderingService } from './OrderingService.js';        // C9: Custom ordering

// Internal imports for initializeServices
import { SceneService } from './SceneService.js';
import { CharacterService } from './CharacterService.js';
import { FolderService } from './FolderService.js';
import { SlideshowService } from './SlideshowService.js';
import { SlideshowPlaybackService } from './SlideshowPlaybackService.js';
import { SequencePlaybackService } from './SequencePlaybackService.js';
import { CastOnlyService } from './CastOnlyService.js';
import { OrderingService } from './OrderingService.js';

/**
 * Initialize all services for a store instance.
 * Called during Store initialization.
 *
 * @param {ExaltedStore} store - The store instance
 * @returns {Object} Map of service name to service instance
 *
 * @example
 * // In Store.js constructor or initialize():
 * this._services = initializeServices(this);
 */
export function initializeServices(store) {
  const services = {};

  // Entity services
  services.scene = new SceneService(store);
  services.character = new CharacterService(store);
  services.folder = new FolderService(store);
  services.slideshow = new SlideshowService(store);

  // Playback services
  services.slideshowPlayback = new SlideshowPlaybackService(store);
  services.sequencePlayback = new SequencePlaybackService(store);
  services.castOnly = new CastOnlyService(store);

  // Utility services
  services.ordering = new OrderingService(store);

  return services;
}
