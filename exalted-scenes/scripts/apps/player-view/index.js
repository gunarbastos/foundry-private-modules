/**
 * @file index.js
 * @description Central export point for PlayerView handlers.
 * This module re-exports all handler classes for convenient importing.
 *
 * @module player-view
 */

// Base class
export { BaseHandler } from './BaseHandler.js';

// Handlers
// D2: TransitionHandler - CSS transitions and animations
export { TransitionHandler } from './TransitionHandler.js';

// D3: LayoutCalculator - Positioning and dimension calculations
export { LayoutCalculator } from './LayoutCalculator.js';

// D4: EmotionPickerHandler - Emotion picker UI logic
export { EmotionPickerHandler } from './EmotionPickerHandler.js';

// Handlers - will be implemented in subsequent sub-phases

// D5: BorderPickerHandler - Border picker UI logic
export { BorderPickerHandler } from './BorderPickerHandler.js';

// D6: MediaHandler - Image/video handling
export { MediaHandler } from './MediaHandler.js';

/**
 * Stub classes for handlers not yet implemented.
 * These will be replaced with actual implementations in subsequent sub-phases.
 */

import { BaseHandler } from './BaseHandler.js';
import { TransitionHandler } from './TransitionHandler.js';
import { LayoutCalculator } from './LayoutCalculator.js';
import { EmotionPickerHandler } from './EmotionPickerHandler.js';
import { BorderPickerHandler } from './BorderPickerHandler.js';
import { MediaHandler } from './MediaHandler.js';

// NOTE: The actions (character-click, select-emotion, close-picker, toggle-emotion-favorite)
// remain in PlayerView.js as they are static ApplicationV2 action handlers.
// EmotionPickerHandler manages dynamic UI setup (search input, hover preview).

// NOTE: BorderPickerHandler is now implemented in ./BorderPickerHandler.js
// It handles border picker context preparation.
// Actions (open-border-picker, close-border-picker, etc.) remain in PlayerView.js
// as they are static ApplicationV2 action handlers.

// NOTE: MediaHandler is now implemented in ./MediaHandler.js
// It handles video autoplay, media error handling, and media type utilities.
// Called automatically in setup() to ensure videos play.

/**
 * Create all handlers for a PlayerView instance.
 * @param {ExaltedScenesPlayerView} view - The PlayerView instance
 * @returns {Object} Object containing all handler instances
 */
export function createHandlers(view) {
  return {
    transition: new TransitionHandler(view),
    layout: new LayoutCalculator(view),
    emotionPicker: new EmotionPickerHandler(view),
    borderPicker: new BorderPickerHandler(view),
    media: new MediaHandler(view)
  };
}

/**
 * Setup all handlers.
 * @param {Object} handlers - Object containing handler instances
 * @param {HTMLElement} element - The view's root element
 */
export function setupHandlers(handlers, element) {
  for (const handler of Object.values(handlers)) {
    handler.setup(element);
  }
}

/**
 * Cleanup all handlers.
 * @param {Object} handlers - Object containing handler instances
 */
export function cleanupHandlers(handlers) {
  for (const handler of Object.values(handlers)) {
    handler.cleanup();
  }
}
