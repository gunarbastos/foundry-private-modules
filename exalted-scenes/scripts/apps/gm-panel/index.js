/**
 * @file index.js
 * @description Central export point for all GMPanel managers.
 * Import managers from this file to ensure proper loading order.
 *
 * @module gm-panel
 */

// Base class (for extension by other managers)
export { BaseManager } from './BaseManager.js';

// === MANAGERS (will be added incrementally) ===

// B2: Drag & Drop functionality
export { DragDropManager } from './DragDropManager.js';

// B3: Keyboard shortcuts
export { KeyboardManager } from './KeyboardManager.js';

// B4: Context menu (right-click)
export { ContextMenuManager } from './ContextMenuManager.js';

// B5: Search and sorting
export { SearchSortManager } from './SearchSortManager.js';

// B6: Cast management
export { CastManager } from './CastManager.js';

// B7: Emotion picker
export { EmotionPickerManager } from './EmotionPickerManager.js';

// B8: Folder navigation
export { FolderManager } from './FolderManager.js';

// B9: Slideshow controls
export { SlideshowManager } from './SlideshowManager.js';

// B10: Sequence backgrounds
export { SequenceManager } from './SequenceManager.js';

// B11: Cast-only mode
export { CastOnlyManager } from './CastOnlyManager.js';
