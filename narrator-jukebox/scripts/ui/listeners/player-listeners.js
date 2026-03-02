/**
 * Player Listeners Module
 * Handles playback controls: play/pause, next/prev, shuffle, loop, volume, mute, progress bar
 *
 * @module ui/listeners/player-listeners
 */

import { formatTime } from '../../utils/time-format.js';
import { localize } from '../../utils/i18n.js';
import { syncService } from '../../core/jukebox-state.js';

/**
 * Activate music player control listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activatePlayerListeners(app, html) {
    const jukebox = app.jukebox;

    // Cache progress elements
    const progressFillEl = html.find('#progress-fill');
    const currentTimeEl = html.find('#current-time');

    // ========== MUSIC PLAYBACK CONTROLS ==========

    // Play/Pause
    html.find('#play-pause-btn').click(e => {
        jukebox.togglePlay('music');
        updatePlayButton(e.currentTarget, jukebox.isPlaying);
    });

    // Next (wrap=true: manual click always wraps around at end of library/playlist)
    html.find('#next-btn').click(() => {
        jukebox.next(true);
    });

    // Prev
    html.find('#prev-btn').click(() => {
        jukebox.prev();
    });

    // Shuffle toggle
    html.find('#shuffle-btn').click(e => {
        jukebox.toggleShuffle();
        $(e.currentTarget).find('i').toggleClass('active', jukebox.shuffle);
        e.currentTarget.title = jukebox.shuffle ? localize('Player.ShuffleOn') : localize('Player.ShuffleOff');
    });

    // Loop toggle (music)
    html.find('#loop-btn').click(e => {
        jukebox.toggleMusicLoop();
        $(e.currentTarget).find('i').toggleClass('active', jukebox.musicLoop);
        e.currentTarget.title = jukebox.musicLoop ? localize('Player.LoopOn') : localize('Player.LoopOff');
    });

    // ========== MUSIC VOLUME CONTROLS ==========

    const muteBtn = html.find('#mute-btn');

    // Volume slider
    html.find('#volume-slider').on('input', e => {
        const vol = parseFloat(e.target.value) / 100;
        jukebox.setVolume(vol, 'music');
        updateVolumeIcon(muteBtn, vol * 100, jukebox.isMuted);
    });

    // Mute button
    html.find('#mute-btn').on('click', () => {
        jukebox.toggleMute('music');
        const vol = parseFloat(html.find('#volume-slider').val());
        updateVolumeIcon(muteBtn, vol, jukebox.isMuted);
    });

    // ========== MUSIC PROGRESS BAR ==========
    activateProgressBarListeners(app, html, jukebox, progressFillEl, currentTimeEl);

    // ========== AMBIENCE CONTROLS ==========
    activateAmbienceListeners(app, html, jukebox);

    // ========== TRACK LIST INTERACTIONS ==========
    activateTrackListListeners(app, html, jukebox);
}

/**
 * Activate progress bar interaction listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 * @param {jQuery} progressFillEl - Progress fill element
 * @param {jQuery} currentTimeEl - Current time display element
 */
function activateProgressBarListeners(app, html, jukebox, progressFillEl, currentTimeEl) {
    const progressBar = html.find('#progress-bar');

    // Initialize dragging state if not present
    if (app.isDragging === undefined) app.isDragging = false;

    progressBar.on('mousedown', () => {
        app.isDragging = true;
    });

    progressBar.on('input', e => {
        app.isDragging = true;
        const percent = e.target.value;
        progressFillEl.css('width', `${percent}%`);

        // Update time text while dragging
        const duration = jukebox.channels.music.duration;
        if (duration) {
            const currentTime = (percent / 100) * duration;
            currentTimeEl.text(formatTime(currentTime));
        }
    });

    progressBar.on('change', e => {
        const percent = e.target.value;
        jukebox.channels.music.seek(percent);

        // Broadcast seek to players (GM in broadcast mode only)
        if (game.user.isGM && !jukebox.isPreviewMode) {
            syncService.broadcastSeek('music', parseFloat(percent));
        }

        // Small delay to prevent timer from jumping back immediately
        setTimeout(() => {
            app.isDragging = false;
        }, 200);
    });

    progressBar.on('mouseup', () => {
        setTimeout(() => {
            app.isDragging = false;
        }, 200);
    });
}

/**
 * Activate ambience library management listeners
 * Note: Ambience player bar controls removed - now handled by Layer Mixer
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 */
function activateAmbienceListeners(app, html, jukebox) {
    // Ambience track management (library buttons, not player bar)
    html.on('click', '.edit-ambience-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.ambienceId;
        if (id) app.showEditAmbienceDialog(id);
    });

    html.on('click', '.delete-ambience-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.ambienceId;
        if (!id) return;

        Dialog.confirm({
            title: localize('Dialog.Confirm.DeleteAmbience'),
            content: `<p>${localize('Dialog.Confirm.DeleteTrackContent')}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: async () => {
                await jukebox.deleteAmbience(id);
                app.render();
            }
        });
    });
}

/**
 * Activate track list interaction listeners (event delegation)
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 */
function activateTrackListListeners(app, html, jukebox) {
    // Play music button (event delegation for dynamic content)
    html.on('click', '.play-music-btn', e => {
        const id = e.currentTarget.dataset.musicId;
        if (!id) return;

        const currentTrackId = jukebox.channels.music.currentTrack?.id;
        if (id === currentTrackId) {
            // Toggle play/pause for current track
            jukebox.togglePlay('music');
            app.render(false);
        } else {
            // Play the new track
            jukebox.playMusic(id);
        }
    });

    // Edit track button
    html.on('click', '.edit-track-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (id) app.showEditMusicDialog(id);
    });

    // Delete track button
    html.on('click', '.delete-track-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (!id) return;

        Dialog.confirm({
            title: localize('Dialog.Confirm.DeleteTrack'),
            content: `<p>${localize('Dialog.Confirm.DeleteTrackContent')}</p>`,
            classes: ['narrator-jukebox-dialog'],
            yes: () => {
                jukebox.deleteMusic(id);
                app.render();
            }
        });
    });

    // Add to playlist button
    html.on('click', '.add-to-playlist-btn', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.musicId;
        if (id) app.showAddToPlaylistDialog(id);
    });

    // Remove from playlist button
    html.on('click', '.remove-from-playlist-btn', e => {
        e.stopPropagation();
        const musicId = e.currentTarget.dataset.musicId;
        const playlistId = e.currentTarget.dataset.playlistId;
        if (musicId && playlistId) {
            jukebox.removeFromPlaylist(playlistId, musicId);
        }
    });
}

/**
 * Update volume icon based on volume level and mute state
 * @param {jQuery} btn - The mute button element
 * @param {number} volume - Volume level (0-100)
 * @param {boolean} isMuted - Whether currently muted
 */
function updateVolumeIcon(btn, volume, isMuted) {
    const icon = btn.find('i');
    // Remove all volume classes
    icon.removeClass('fa-volume-mute fa-volume-off fa-volume-down fa-volume-up');

    if (isMuted || volume === 0) {
        icon.addClass('fa-volume-mute');
        btn.attr('data-tooltip', localize('Player.Unmute'));
    } else if (volume > 50) {
        icon.addClass('fa-volume-up');
        btn.attr('data-tooltip', localize('Player.Mute'));
    } else {
        icon.addClass('fa-volume-down');
        btn.attr('data-tooltip', localize('Player.Mute'));
    }
}

/**
 * Update play button icon based on playing state
 * @param {HTMLElement} btn - The button element
 * @param {boolean} isPlaying - Whether currently playing
 */
function updatePlayButton(btn, isPlaying) {
    const icon = $(btn).find('i');
    if (isPlaying) {
        icon.removeClass('fa-play-circle').addClass('fa-pause-circle');
        btn.title = localize('Player.Pause');
    } else {
        icon.removeClass('fa-pause-circle').addClass('fa-play-circle');
        btn.title = localize('Player.Play');
    }
}

export { updatePlayButton, updateVolumeIcon };
