/**
 * Ambience Layer Mixer Listeners Module
 * Handles ambience layer interactions: toggle, volume, stop all, master controls
 *
 * @module ui/listeners/ambience-listeners
 */

import { MAX_AMBIENCE_LAYERS } from '../../core/constants.js';
import { debugLog } from '../../utils/debug.js';
import { localize, format } from '../../utils/i18n.js';

/**
 * Show layer limit warning toast
 * @private
 */
function showLayerLimitToast() {
    // Remove any existing toast
    const existing = document.querySelector('.ambience-limit-toast');
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'ambience-limit-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${format('Notifications.MaxLayersReached', { count: MAX_AMBIENCE_LAYERS })}`;
    document.body.appendChild(toast);

    // Auto-remove after animation
    setTimeout(() => toast.remove(), 3000);
}

/**
 * Add activation animation to card
 * @private
 * @param {jQuery} card - The card element
 */
function animateLayerActivation(card) {
    card.addClass('layer-activating');
    setTimeout(() => card.removeClass('layer-activating'), 500);
}

/**
 * Add deactivation animation to card
 * @private
 * @param {jQuery} card - The card element
 */
function animateLayerDeactivation(card) {
    card.addClass('layer-deactivating');
    setTimeout(() => card.removeClass('layer-deactivating'), 300);
}

/**
 * Show shake animation for layer limit reached
 * @private
 * @param {jQuery} card - The card element
 */
function animateLayerLimitShake(card) {
    card.addClass('layer-limit-reached');
    setTimeout(() => card.removeClass('layer-limit-reached'), 400);
}

/**
 * Update layer limit visual state
 * @private
 * @param {jQuery} html - The HTML element
 * @param {Object} jukebox - The jukebox instance
 */
function updateLayerLimitState(html, jukebox) {
    const count = jukebox.getAmbienceLayerCount();
    const atLimit = count >= MAX_AMBIENCE_LAYERS;

    // Update badge state
    html.find('.ambience-layer-badge').toggleClass('at-limit', atLimit);

    // Update layers indicator
    html.find('.ambience-layers-indicator').toggleClass('at-limit', atLimit);

    // Update inactive cards disabled state
    html.find('.ambience-card').each(function() {
        const card = $(this);
        const isActive = card.hasClass('active');
        card.toggleClass('layer-disabled', atLimit && !isActive);
    });
}

/**
 * Activate ambience layer mixer listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateAmbienceListeners(app, html) {
    const jukebox = app.jukebox;

    // Initialize layer limit state
    updateLayerLimitState(html, jukebox);

    // Initialize ARIA attributes for cards
    html.find('.ambience-card').each(function() {
        const card = $(this);
        const id = card.data('ambienceId');
        const isActive = card.hasClass('active');

        card.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-pressed': isActive ? 'true' : 'false',
            'aria-label': card.data('tooltip') + (isActive ? ' (playing)' : '')
        });
    });

    // ========== TOGGLE AMBIENCE LAYER (Card Click) ==========
    html.on('click', '.ambience-card', e => {
        // Don't trigger if clicking on controls
        if ($(e.target).closest('.amb-card-controls, .amb-volume-control, .amb-edit-btn, .amb-delete-btn').length) {
            return;
        }

        const card = $(e.currentTarget);
        const id = card.data('ambienceId');
        if (!id) return;

        const isActive = jukebox.isAmbienceLayerActive(id);

        // Check layer limit before activating
        if (!isActive && !jukebox.canAddAmbienceLayer()) {
            animateLayerLimitShake(card);
            showLayerLimitToast();
            return;
        }

        // Animate based on action
        if (isActive) {
            animateLayerDeactivation(card);
        } else {
            animateLayerActivation(card);
        }

        jukebox.toggleAmbienceLayer(id);
    });

    // ========== KEYBOARD NAVIGATION FOR CARDS ==========
    html.on('keydown', '.ambience-card', e => {
        // Don't trigger if inside controls
        if ($(e.target).closest('.amb-card-controls, .amb-volume-control').length) {
            return;
        }

        const card = $(e.currentTarget);
        const id = card.data('ambienceId');

        // Enter or Space to toggle
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();

            const isActive = jukebox.isAmbienceLayerActive(id);

            // Check layer limit before activating
            if (!isActive && !jukebox.canAddAmbienceLayer()) {
                animateLayerLimitShake(card);
                showLayerLimitToast();
                return;
            }

            // Animate based on action
            if (isActive) {
                animateLayerDeactivation(card);
            } else {
                animateLayerActivation(card);
            }

            jukebox.toggleAmbienceLayer(id);
        }

        // Arrow key navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const cards = html.find('.ambience-card');
            const currentIndex = cards.index(card);
            let nextIndex;

            // Calculate grid columns (approximate)
            const gridWidth = card.parent().width();
            const cardWidth = card.outerWidth(true);
            const columns = Math.floor(gridWidth / cardWidth) || 1;

            switch (e.key) {
                case 'ArrowRight':
                    nextIndex = (currentIndex + 1) % cards.length;
                    break;
                case 'ArrowLeft':
                    nextIndex = (currentIndex - 1 + cards.length) % cards.length;
                    break;
                case 'ArrowDown':
                    nextIndex = Math.min(currentIndex + columns, cards.length - 1);
                    break;
                case 'ArrowUp':
                    nextIndex = Math.max(currentIndex - columns, 0);
                    break;
            }

            cards.eq(nextIndex).trigger('focus');
        }
    });

    // ========== TOGGLE BUTTON (explicit toggle) ==========
    html.on('click', '.ambience-card .amb-toggle-btn', e => {
        e.stopPropagation();
        const card = $(e.currentTarget).closest('.ambience-card');
        const id = card.data('ambienceId');
        if (!id) return;

        const isActive = jukebox.isAmbienceLayerActive(id);

        // Check layer limit before activating
        if (!isActive && !jukebox.canAddAmbienceLayer()) {
            animateLayerLimitShake(card);
            showLayerLimitToast();
            return;
        }

        // Animate based on action
        if (isActive) {
            animateLayerDeactivation(card);
        } else {
            animateLayerActivation(card);
        }

        jukebox.toggleAmbienceLayer(id);
    });

    // ========== LAYER VOLUME SLIDER ==========
    html.on('input', '.amb-layer-volume', e => {
        e.stopPropagation();
        const slider = $(e.currentTarget);
        const id = slider.data('ambienceId');
        const volume = parseInt(slider.val()) / 100;

        if (id) {
            jukebox.setAmbienceLayerVolume(id, volume);
        }
    });

    // Prevent card toggle when interacting with volume slider
    html.on('click', '.amb-volume-control', e => {
        e.stopPropagation();
    });

    // ========== MASTER VOLUME SLIDER ==========
    // Prevent Foundry from capturing mousedown for window drag
    // Must use native addEventListener to catch before Foundry's capture phase
    html.find('.ambience-master-volume, .amb-layer-volume').each(function() {
        this.addEventListener('mousedown', e => e.stopPropagation(), true);
        this.addEventListener('pointerdown', e => e.stopPropagation(), true);
    });

    html.on('input', '.ambience-master-volume', e => {
        const volume = parseInt($(e.currentTarget).val()) / 100;
        jukebox.setAmbienceMasterVolume(volume);

        // Update display value
        html.find('.master-volume-value').text(`${Math.round(volume * 100)}%`);
    });

    // ========== MASTER MUTE BUTTON ==========
    html.on('click', '.ambience-master-mute-btn', e => {
        e.preventDefault();
        jukebox.toggleAmbienceMasterMute();
        app.render(false);
    });

    // ========== STOP ALL AMBIENCE LAYERS ==========
    html.on('click', '.stop-all-ambience-btn', e => {
        e.preventDefault();
        jukebox.stopAllAmbienceLayers();
        ui.notifications.info(localize('Notifications.AllAmbienceLayersStopped'));
    });

    // ========== TAG FILTER ==========
    html.on('change', '.ambience-tag-filter', e => {
        const tag = $(e.currentTarget).val();
        app.ambienceTagFilter = tag || null;
        app.render(false);
    });

    // ========== EDIT AMBIENCE ==========
    html.on('click', '.ambience-card .amb-edit-btn', e => {
        e.stopPropagation();
        const id = $(e.currentTarget).data('ambienceId');
        if (id) app.showEditAmbienceDialog(id);
    });

    // ========== DELETE AMBIENCE ==========
    html.on('click', '.ambience-card .amb-delete-btn', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = $(e.currentTarget).data('ambienceId');
        debugLog('Delete ambience clicked, id:', id);
        if (!id) return;

        const track = jukebox.ambience.find(a => a.id === id);
        Dialog.confirm({
            title: localize('Dialog.Confirm.DeleteAmbience'),
            content: `<p>${format('Dialog.Confirm.DeleteAmbienceContent', { name: track?.name || localize('Common.ThisAmbience') })}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: async () => {
                // Stop layer if active (broadcast to players)
                if (jukebox.isAmbienceLayerActive(id)) {
                    jukebox.stopAmbienceLayer(id, true);
                }
                await jukebox.deleteAmbience(id);
                app.render();
            }
        });
    });

    // NOTE: Add Ambience button click is handled in main-listeners.js

    // ========== PRESET: LOAD (dropdown change) ==========
    html.on('change', '.ambience-preset-select', async e => {
        const presetId = $(e.currentTarget).val();
        if (!presetId) {
            app.selectedPresetId = null;
            return;
        }

        // Store selected preset in app state so it persists across re-renders
        app.selectedPresetId = presetId;
        await jukebox.loadAmbiencePreset(presetId);
    });

    // ========== PRESET: SAVE BUTTON ==========
    html.on('click', '.preset-save-btn', e => {
        e.preventDefault();
        if (jukebox.getAmbienceLayerCount() === 0) {
            ui.notifications.warn(localize('Notifications.NoActiveLayersToSave'));
            return;
        }
        app.showSavePresetDialog();
    });

    // ========== PRESET: DELETE BUTTON ==========
    html.on('click', '.preset-delete-btn', async e => {
        e.preventDefault();
        const presetId = app.selectedPresetId;

        if (!presetId) {
            ui.notifications.warn(localize('Notifications.SelectPresetToDelete'));
            return;
        }

        const preset = jukebox.getAmbiencePreset(presetId);
        if (!preset) return;

        Dialog.confirm({
            title: localize('Dialog.Confirm.DeletePreset'),
            content: `<p>${format('Dialog.Confirm.DeletePresetContent', { name: preset.name })}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: async () => {
                await jukebox.deleteAmbiencePreset(presetId);
                app.selectedPresetId = null; // Clear selection after delete
                ui.notifications.info(format('Notifications.DeletedPreset', { name: preset.name }));
                app.render();
            }
        });
    });
}
