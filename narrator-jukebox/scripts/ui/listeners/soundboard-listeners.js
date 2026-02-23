/**
 * Soundboard Listeners Module
 * Handles soundboard interactions: play/stop, loop toggle, edit, delete, stop all, broadcast mode
 *
 * @module ui/listeners/soundboard-listeners
 */

import { localize, format } from '../../utils/i18n.js';

/**
 * Activate soundboard-related listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateSoundboardListeners(app, html) {
    const jukebox = app.jukebox;

    // ========== STOP ALL SOUNDS BUTTON ==========
    html.find('.stop-all-sounds-btn').click(() => {
        jukebox.stopAllSoundboardSounds();
        ui.notifications.info(localize('Notifications.AllSoundsStopped'));
    });

    // ========== GLOBAL BROADCAST MODE TOGGLE ==========
    html.on('click', '.broadcast-toggle-btn', e => {
        e.stopPropagation();
        jukebox.soundboardBroadcastMode = !jukebox.soundboardBroadcastMode;
        jukebox.isPreviewMode = !jukebox.soundboardBroadcastMode;
        app.render(false);
    });

    // ========== PLAY SOUNDBOARD SOUND ==========
    html.on('click', '.soundboard-card .sb-play-btn', e => {
        e.stopPropagation();
        const card = $(e.currentTarget).closest('.soundboard-card');
        const id = card.data('soundId');

        // Read loop state from the card's button
        const isLooping = card.find('.sb-loop-btn').hasClass('active');
        // Use global broadcast mode
        const isBroadcast = jukebox.soundboardBroadcastMode;

        if (jukebox.isSoundboardSoundPlaying(id)) {
            jukebox.stopSoundboardSound(id);
        } else {
            // Store the loop state before playing
            jukebox.soundboardLoopState.set(id, isLooping);
            jukebox.playSoundboardSound(id, { loop: isLooping, preview: !isBroadcast });
        }
    });

    // ========== TOGGLE LOOP MODE ==========
    html.on('click', '.soundboard-card .sb-loop-btn', e => {
        e.stopPropagation();
        const btn = $(e.currentTarget);
        btn.toggleClass('active');

        const card = btn.closest('.soundboard-card');
        const id = card.data('soundId');

        // Store state
        jukebox.soundboardLoopState.set(id, btn.hasClass('active'));

        // If sound is currently playing, restart with new loop setting
        if (jukebox.isSoundboardSoundPlaying(id)) {
            const isBroadcast = jukebox.soundboardBroadcastMode;
            jukebox.stopSoundboardSound(id, false);
            jukebox.playSoundboardSound(id, {
                loop: btn.hasClass('active'),
                preview: !isBroadcast
            });
        }
    });

    // ========== EDIT SOUNDBOARD SOUND ==========
    html.on('click', '.soundboard-card .sb-edit-btn', e => {
        e.stopPropagation();
        const id = $(e.currentTarget).closest('.soundboard-card').data('soundId');
        if (id) app.showEditSoundboardDialog(id);
    });

    // ========== DELETE SOUNDBOARD SOUND ==========
    html.on('click', '.soundboard-card .sb-delete-btn', e => {
        e.stopPropagation();
        const id = $(e.currentTarget).closest('.soundboard-card').data('soundId');
        if (!id) return;

        const sound = jukebox.soundboard.find(s => s.id === id);
        Dialog.confirm({
            title: localize('Dialog.Confirm.DeleteSound'),
            content: `<p>${format('Dialog.Confirm.DeleteSoundContent', { name: sound?.name || localize('Common.ThisSound') })}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                jukebox.deleteSoundboardSound(id);
                app.render();
            }
        });
    });
}
