/**
 * App Dialogs Facade
 * Central export point for all dialog functions
 *
 * Usage in NarratorsJukeboxApp:
 *   import * as Dialogs from './ui/app-dialogs.js';
 *   Dialogs.showAddMusicDialog({ jukebox: this.jukebox, onSuccess: () => this.render() });
 */

// Music dialogs
export { showAddMusicDialog } from '../dialogs/add-music-dialog.js';
export { showEditMusicDialog } from '../dialogs/edit-music-dialog.js';

// Ambience dialogs
export { showAddAmbienceDialog } from '../dialogs/add-ambience-dialog.js';
export { showEditAmbienceDialog } from '../dialogs/edit-ambience-dialog.js';
export { showSavePresetDialog } from '../dialogs/save-preset-dialog.js';

// Soundboard dialogs
export { showAddSoundboardDialog } from '../dialogs/add-soundboard-dialog.js';
export { showEditSoundboardDialog } from '../dialogs/edit-soundboard-dialog.js';

// Playlist dialogs
export { showAddPlaylistDialog } from '../dialogs/add-playlist-dialog.js';
export { showAddToPlaylistDialog } from '../dialogs/add-to-playlist-dialog.js';
export { showAddSelectedToPlaylistDialog } from '../dialogs/add-selected-to-playlist-dialog.js';

// Bulk import dialog
export { showBulkImportDialog } from '../dialogs/bulk-import-dialog.js';

// Mood editor dialog
export { showEditMoodsDialog } from '../dialogs/edit-moods-dialog.js';

// Base dialog utilities (for custom dialogs)
export {
  applyDarkTheme,
  applyMoodEditorTheme,
  DIALOG_THEME,
  MOOD_EDITOR_THEME,
  DIALOG_CLASSES,
  createDialogHeader,
  createFormGroup,
  createUrlInputGroup,
  createThumbnailGroup,
  createSourceSelector,
  escapeHtml
} from '../dialogs/base-dialog.js';
