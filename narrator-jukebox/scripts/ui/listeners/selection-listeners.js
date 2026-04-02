/**
 * Selection Listeners
 * Handles multi-selection functionality for tracks/cards across all library views
 *
 * @module ui/listeners/selection-listeners
 */

import { localize } from '../../utils/i18n.js';
import * as Dialogs from '../app-dialogs.js';

/**
 * Activate selection listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateSelectionListeners(app, html) {
    const jukebox = app.jukebox;

    // Only GMs can use selection mode
    if (!game.user.isGM) return;

    // Toggle selection mode button (shared across all views)
    html.on('click', '.selection-mode-btn', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.toggleSelectionMode();
    });

    // Clear selection button in toolbar
    html.on('click', '.btn-clear-selection', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.deselectAll();
    });

    // ==========================================
    // Music Library Selection
    // ==========================================

    // Individual track checkbox
    html.on('click', '.track-select-checkbox', (e) => {
        e.stopPropagation();
        const row = $(e.currentTarget).closest('.track-row');
        const id = row.data('musicId');
        if (id) {
            app.toggleTrackSelection(id);
        }
    });

    // Select all checkbox
    html.on('click', '.select-all-checkbox', (e) => {
        e.stopPropagation();
        const checked = e.currentTarget.checked;
        const visibleIds = getRootLevelIds(html, 'library');

        if (checked) {
            app.selectAllVisible(visibleIds);
        } else {
            app.setTrackSelection(visibleIds, false);
        }
    });

    // Folder selection button
    html.on('click', '.folder-select-btn', (e) => {
        if (!app.selectionMode) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const section = $(e.currentTarget).closest('.folder-section');
        toggleFolderSelection(app, section, app.view);
    });

    // Folder header selection (selection mode only; chevron keeps collapse behavior)
    html.on('click', '.folder-header', (e) => {
        if (!app.selectionMode) return;
        if ($(e.target).closest('.folder-actions, .folder-edit-btn, .folder-toggle, .folder-select-btn').length) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const section = $(e.currentTarget).closest('.folder-section');
        toggleFolderSelection(app, section, app.view);
    });

    // Ctrl+Click and Shift+Click on music track rows
    html.on('click', '.track-row[data-music-id]', (e) => {
        if (app.view !== 'library') return;

        const id = $(e.currentTarget).data('musicId');
        if (!id) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            if (!app.selectionMode) {
                app.selectTrack(id);
            } else {
                app.toggleTrackSelection(id);
            }
            return;
        }

        if (e.shiftKey && app.selectionMode) {
            e.preventDefault();
            e.stopPropagation();

            const visibleIds = getVisibleIds(html, 'library');
            app.selectRange(id, visibleIds);
            return;
        }
    });

    // ==========================================
    // Ambience Card Selection
    // ==========================================

    // Ambience card checkbox
    html.on('click', '.amb-select-checkbox', (e) => {
        e.stopPropagation();
        const card = $(e.currentTarget).closest('.ambience-card');
        const id = card.data('ambienceId');
        if (id) {
            app.toggleTrackSelection(id);
        }
    });

    // Ctrl+Click on ambience cards
    html.on('click', '.ambience-card[data-ambience-id]', (e) => {
        if (app.view !== 'ambience') return;

        // Don't intercept control interactions
        if ($(e.target).closest('.amb-card-controls, .amb-volume-control, .amb-toggle-btn, .card-select-overlay').length) return;

        const id = $(e.currentTarget).data('ambienceId');
        if (!id) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            if (!app.selectionMode) {
                app.selectTrack(id);
            } else {
                app.toggleTrackSelection(id);
            }
            return;
        }

        // In selection mode, clicking a card toggles selection
        if (app.selectionMode) {
            e.preventDefault();
            e.stopPropagation();
            app.toggleTrackSelection(id);
            return;
        }
    });

    // ==========================================
    // Soundboard Card Selection
    // ==========================================

    // Soundboard card checkbox
    html.on('click', '.sb-select-checkbox', (e) => {
        e.stopPropagation();
        const card = $(e.currentTarget).closest('.soundboard-card');
        const id = card.data('soundId');
        if (id) {
            app.toggleTrackSelection(id);
        }
    });

    // Ctrl+Click on soundboard cards
    html.on('click', '.soundboard-card[data-sound-id]', (e) => {
        if (app.view !== 'soundboard') return;

        // Don't intercept control interactions
        if ($(e.target).closest('.sb-card-controls, .card-select-overlay').length) return;

        const id = $(e.currentTarget).data('soundId');
        if (!id) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            if (!app.selectionMode) {
                app.selectTrack(id);
            } else {
                app.toggleTrackSelection(id);
            }
            return;
        }

        // In selection mode, clicking a card toggles selection
        if (app.selectionMode) {
            e.preventDefault();
            e.stopPropagation();
            app.toggleTrackSelection(id);
            return;
        }
    });

    // ==========================================
    // Shared Toolbar Actions
    // ==========================================

    // Add to playlist button (music only)
    html.on('click', '.selection-toolbar .btn-add-to-playlist', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        app.showAddSelectedToPlaylistDialog(selectedIds);
    });

    // Bulk delete button (all views)
    html.on('click', '.btn-bulk-delete', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        if (app.view === 'ambience') {
            showBulkDeleteAmbienceConfirm(app, jukebox, selectedIds);
        } else if (app.view === 'soundboard') {
            showBulkDeleteSoundboardConfirm(app, jukebox, selectedIds);
        } else {
            showBulkDeleteConfirm(app, jukebox, selectedIds);
        }
    });

    // Bulk add tag button (music and ambience)
    html.on('click', '.btn-bulk-tag', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        if (app.view === 'ambience') {
            showBulkAddTagDialog(app, jukebox, selectedIds, 'ambience');
        } else {
            showBulkAddTagDialog(app, jukebox, selectedIds, 'music');
        }
    });

    // Bulk remove tag button (music and ambience)
    html.on('click', '.btn-bulk-remove-tag', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        if (app.view === 'ambience') {
            showBulkRemoveTagDialog(app, jukebox, selectedIds, 'ambience');
        } else {
            showBulkRemoveTagDialog(app, jukebox, selectedIds, 'music');
        }
    });

    // Move to folder button (all views)
    html.on('click', '.btn-move-to-folder', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedIds = app.getSelectedTrackIds();
        if (selectedIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksSelected'));
            return;
        }

        const library = app.view === 'ambience' ? 'ambience' : app.view === 'soundboard' ? 'soundboard' : 'music';

        Dialogs.showMoveToFolderDialog({
            trackIds: selectedIds,
            library,
            jukebox: app.jukebox,
            onSuccess: () => {
                app.exitSelectionMode();
            }
        });
    });

    // Add All Visible button (when filter is active, music only)
    html.on('click', '.btn-add-all-visible', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const visibleIds = getVisibleIds(html, 'library');
        if (visibleIds.length === 0) {
            ui.notifications.warn(localize('Notifications.NoTracksToAdd'));
            return;
        }

        app.showAddSelectedToPlaylistDialog(visibleIds);
    });

    // ==========================================
    // Keyboard Shortcuts
    // ==========================================

    html.on('keydown', (e) => {
        // Only in selection-supported views
        if (!['library', 'ambience', 'soundboard'].includes(app.view)) return;

        // Don't interfere with input fields
        if ($(e.target).is('input, textarea, select')) return;

        // Escape: Exit selection mode
        if (e.key === 'Escape' && app.selectionMode) {
            e.preventDefault();
            app.exitSelectionMode();
            return;
        }

        // Ctrl+A: Select all visible
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            if (app.selectionMode) {
                e.preventDefault();
                const visibleIds = getRootLevelIds(html, app.view);
                app.selectAllVisible(visibleIds);
            }
        }
    });

    if (app.selectionMode) {
        app._updateSelectionUI();
    }
}

/**
 * Get all visible item IDs in order for a given view
 * @param {jQuery} html - The HTML element
 * @param {string} view - The current view ('library', 'ambience', 'soundboard')
 * @returns {string[]} Array of item IDs
 */
function getVisibleIds(html, view) {
    const ids = [];
    if (view === 'library') {
        html.find('#view-library .track-row[data-music-id]').each((_, el) => {
            const id = $(el).data('musicId');
            if (id) ids.push(id);
        });
    } else if (view === 'ambience') {
        html.find('#view-ambience .ambience-card[data-ambience-id]').each((_, el) => {
            const id = $(el).data('ambienceId');
            if (id) ids.push(id);
        });
    } else if (view === 'soundboard') {
        html.find('#view-soundboard .soundboard-card[data-sound-id]').each((_, el) => {
            const id = $(el).data('soundId');
            if (id) ids.push(id);
        });
    }
    return ids;
}

/**
 * Get root-level visible item IDs only, excluding items already inside folders.
 * @param {jQuery} html - The HTML element
 * @param {string} view - The current view ('library', 'ambience', 'soundboard')
 * @returns {string[]} Array of item IDs
 */
function getRootLevelIds(html, view) {
    const ids = [];

    if (view === 'library') {
        html.find('#view-library .track-list > .track-row[data-music-id]').each((_, el) => {
            const id = $(el).data('musicId');
            if (id) ids.push(id);
        });
    } else if (view === 'ambience') {
        html.find('#view-ambience > .ambience-layer-grid > .ambience-card[data-ambience-id]').each((_, el) => {
            const id = $(el).data('ambienceId');
            if (id) ids.push(id);
        });
    } else if (view === 'soundboard') {
        html.find('#view-soundboard > .soundboard-grid > .soundboard-card[data-sound-id]').each((_, el) => {
            const id = $(el).data('soundId');
            if (id) ids.push(id);
        });
    }

    return ids;
}

/**
 * Get all item IDs inside a folder section for the given view.
 * @param {jQuery} section - Folder section element
 * @param {string} view - Current view
 * @returns {string[]} Array of contained item IDs
 */
function getFolderIds(section, view) {
    const ids = [];

    if (view === 'library') {
        section.find('.track-row[data-music-id]').each((_, el) => {
            const id = $(el).data('musicId');
            if (id) ids.push(id);
        });
    } else if (view === 'ambience') {
        section.find('.ambience-card[data-ambience-id]').each((_, el) => {
            const id = $(el).data('ambienceId');
            if (id) ids.push(id);
        });
    } else if (view === 'soundboard') {
        section.find('.soundboard-card[data-sound-id]').each((_, el) => {
            const id = $(el).data('soundId');
            if (id) ids.push(id);
        });
    }

    return ids;
}

/**
 * Toggle selection for every item inside a folder.
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} section - Folder section element
 * @param {string} view - Current view
 */
function toggleFolderSelection(app, section, view) {
    const ids = getFolderIds(section, view);
    if (!ids.length) return;
    app.toggleTrackGroup(ids);
}

// ==========================================
// Bulk Action Dialogs
// ==========================================

/**
 * Show bulk delete confirmation for music tracks
 */
function showBulkDeleteConfirm(app, jukebox, selectedIds) {
    const tracks = selectedIds.map(id => jukebox.music.find(m => m.id === id)).filter(Boolean);
    const previewNames = tracks.slice(0, 5).map(t => t.name);
    const remaining = tracks.length - previewNames.length;

    let listHtml = previewNames.map(n => `<li>${escapeHtml(n)}</li>`).join('');
    if (remaining > 0) {
        listHtml += `<li><em>...and ${remaining} more</em></li>`;
    }

    Dialog.confirm({
        title: `Delete ${tracks.length} Track${tracks.length !== 1 ? 's' : ''}`,
        content: `
            <div style="color: #ccc; padding: 8px 0;">
                <p style="margin-bottom: 8px;">Are you sure you want to delete <strong>${tracks.length}</strong> track${tracks.length !== 1 ? 's' : ''}? This will also remove them from all playlists.</p>
                <ul style="margin: 8px 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">${listHtml}</ul>
                <p style="color: #e91e63; margin-top: 8px;"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
            </div>
        `,
        classes: ['narrator-jukebox-dialog'],
        yes: async () => {
            const currentMusicId = jukebox.channels?.music?.currentTrack?.id;
            if (currentMusicId && selectedIds.includes(currentMusicId)) {
                jukebox.stop('music');
            }

            const deleted = await jukebox.deleteMultipleMusic(selectedIds);
            ui.notifications.info(`Deleted ${deleted} track${deleted !== 1 ? 's' : ''}`);
            app.exitSelectionMode();
            app.render();
        }
    });
}

/**
 * Show bulk delete confirmation for ambience tracks
 */
function showBulkDeleteAmbienceConfirm(app, jukebox, selectedIds) {
    const tracks = selectedIds.map(id => jukebox.ambience.find(a => a.id === id)).filter(Boolean);
    const previewNames = tracks.slice(0, 5).map(t => t.name);
    const remaining = tracks.length - previewNames.length;

    let listHtml = previewNames.map(n => `<li>${escapeHtml(n)}</li>`).join('');
    if (remaining > 0) {
        listHtml += `<li><em>...and ${remaining} more</em></li>`;
    }

    Dialog.confirm({
        title: `Delete ${tracks.length} Ambience${tracks.length !== 1 ? ' Tracks' : ''}`,
        content: `
            <div style="color: #ccc; padding: 8px 0;">
                <p style="margin-bottom: 8px;">Are you sure you want to delete <strong>${tracks.length}</strong> ambience track${tracks.length !== 1 ? 's' : ''}?</p>
                <ul style="margin: 8px 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">${listHtml}</ul>
                <p style="color: #e91e63; margin-top: 8px;"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
            </div>
        `,
        classes: ['narrator-jukebox-dialog'],
        yes: async () => {
            // Stop any playing layers
            for (const id of selectedIds) {
                if (jukebox.isAmbienceLayerActive(id)) {
                    jukebox.stopAmbienceLayer?.(id);
                }
            }

            const deleted = await jukebox.deleteMultipleAmbience(selectedIds);
            ui.notifications.info(`Deleted ${deleted} ambience track${deleted !== 1 ? 's' : ''}`);
            app.exitSelectionMode();
            app.render();
        }
    });
}

/**
 * Show bulk delete confirmation for soundboard sounds
 */
function showBulkDeleteSoundboardConfirm(app, jukebox, selectedIds) {
    const sounds = selectedIds.map(id => jukebox.soundboard.find(s => s.id === id)).filter(Boolean);
    const previewNames = sounds.slice(0, 5).map(s => s.name);
    const remaining = sounds.length - previewNames.length;

    let listHtml = previewNames.map(n => `<li>${escapeHtml(n)}</li>`).join('');
    if (remaining > 0) {
        listHtml += `<li><em>...and ${remaining} more</em></li>`;
    }

    Dialog.confirm({
        title: `Delete ${sounds.length} Sound${sounds.length !== 1 ? 's' : ''}`,
        content: `
            <div style="color: #ccc; padding: 8px 0;">
                <p style="margin-bottom: 8px;">Are you sure you want to delete <strong>${sounds.length}</strong> sound${sounds.length !== 1 ? 's' : ''}?</p>
                <ul style="margin: 8px 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">${listHtml}</ul>
                <p style="color: #e91e63; margin-top: 8px;"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
            </div>
        `,
        classes: ['narrator-jukebox-dialog'],
        yes: async () => {
            const deleted = await jukebox.deleteMultipleSoundboard(selectedIds);
            ui.notifications.info(`Deleted ${deleted} sound${deleted !== 1 ? 's' : ''}`);
            app.exitSelectionMode();
            app.render();
        }
    });
}

/**
 * Show bulk add tag dialog (music or ambience)
 */
function showBulkAddTagDialog(app, jukebox, selectedIds, library) {
    const label = library === 'ambience' ? 'ambience track' : 'track';
    const content = `
        <div style="color: #ccc; padding: 8px 0;">
            <p style="margin-bottom: 12px;">Add a tag to <strong>${selectedIds.length}</strong> selected ${label}${selectedIds.length !== 1 ? 's' : ''}:</p>
            <input type="text" name="tag" placeholder="Enter tag name..." style="width: 100%; padding: 8px 12px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 14px;" spellcheck="false" autofocus>
        </div>
    `;

    new Dialog({
        title: `Add Tag to ${selectedIds.length} ${label.charAt(0).toUpperCase() + label.slice(1)}${selectedIds.length !== 1 ? 's' : ''}`,
        content,
        classes: ['narrator-jukebox-dialog'],
        default: 'add',
        render: (html) => {
            setTimeout(() => html.find('input[name="tag"]').trigger('focus'), 50);
        },
        buttons: {
            add: {
                icon: '<i class="fas fa-tag"></i>',
                label: 'Add Tag',
                callback: async (html) => {
                    const tag = html.find('input[name="tag"]').val()?.trim();
                    if (!tag) {
                        ui.notifications.warn('Please enter a tag name');
                        return false;
                    }
                    let count;
                    if (library === 'ambience') {
                        count = await jukebox.addTagToMultipleAmbience(selectedIds, tag);
                    } else {
                        count = await jukebox.addTagToMultiple(selectedIds, tag);
                    }
                    if (count > 0) {
                        ui.notifications.info(`Added tag "${tag}" to ${count} ${label}${count !== 1 ? 's' : ''}`);
                    } else {
                        ui.notifications.info(`All selected ${label}s already have the "${tag}" tag`);
                    }
                    app.render();
                }
            },
            cancel: {
                label: 'Cancel'
            }
        }
    }).render(true);
}

/**
 * Show bulk remove tag dialog (music or ambience)
 */
function showBulkRemoveTagDialog(app, jukebox, selectedIds, library) {
    const label = library === 'ambience' ? 'ambience track' : 'track';
    const items = library === 'ambience' ? jukebox.ambience : jukebox.music;

    // Collect all tags from selected items with usage counts
    const tagCounts = {};
    for (const id of selectedIds) {
        const item = items.find(i => i.id === id);
        if (!item?.tags) continue;
        for (const tag of item.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
    }

    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    if (sortedTags.length === 0) {
        ui.notifications.info(`Selected ${label}s have no tags to remove`);
        return;
    }

    const tagListHtml = sortedTags.map(([tag, count]) => `
        <label class="bulk-tag-option" style="display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: background 0.15s;">
            <input type="checkbox" name="tags" value="${escapeHtml(tag)}" style="accent-color: #1db954;">
            <span style="flex: 1; color: #fff;">${escapeHtml(tag)}</span>
            <span style="color: rgba(255,255,255,0.4); font-size: 12px;">${count}/${selectedIds.length}</span>
        </label>
    `).join('');

    const content = `
        <div style="color: #ccc; padding: 8px 0;">
            <p style="margin-bottom: 12px;">Select tags to remove from <strong>${selectedIds.length}</strong> ${label}${selectedIds.length !== 1 ? 's' : ''}:</p>
            <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${tagListHtml}
            </div>
        </div>
    `;

    new Dialog({
        title: `Remove Tags from ${selectedIds.length} ${label.charAt(0).toUpperCase() + label.slice(1)}${selectedIds.length !== 1 ? 's' : ''}`,
        content,
        classes: ['narrator-jukebox-dialog'],
        default: 'remove',
        buttons: {
            remove: {
                icon: '<i class="fas fa-minus-circle"></i>',
                label: 'Remove Selected Tags',
                callback: async (html) => {
                    const checked = html.find('input[name="tags"]:checked');
                    const tagsToRemove = [];
                    checked.each((_, el) => tagsToRemove.push(el.value));

                    if (tagsToRemove.length === 0) {
                        ui.notifications.warn('No tags selected for removal');
                        return false;
                    }

                    let totalRemoved = 0;
                    for (const tag of tagsToRemove) {
                        if (library === 'ambience') {
                            totalRemoved += await jukebox.removeTagFromMultipleAmbience(selectedIds, tag);
                        } else {
                            totalRemoved += await jukebox.removeTagFromMultiple(selectedIds, tag);
                        }
                    }

                    ui.notifications.info(`Removed ${tagsToRemove.length} tag${tagsToRemove.length !== 1 ? 's' : ''} from ${totalRemoved} ${label}${totalRemoved !== 1 ? 's' : ''}`);
                    app.render();
                }
            },
            cancel: {
                label: 'Cancel'
            }
        }
    }).render(true);
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(value) {
    if (!value) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}
