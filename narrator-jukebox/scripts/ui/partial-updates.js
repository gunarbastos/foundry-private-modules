/**
 * Partial Updates Module
 * Handles partial UI updates without full re-renders
 *
 * @module ui/partial-updates
 */

import { formatTime } from '../utils/time-format.js';
import { localize } from '../utils/i18n.js';

/**
 * Update the "Now Playing" section for music
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {Object} track - The current track object
 */
export function updateNowPlayingInfo(app, track) {
    const html = app.element;
    if (!html || !html.length) return;

    const artEl = html.find('.music-section .now-playing-art img, .music-section .now-playing-art .art-placeholder');
    const titleEl = html.find('#music-title');
    const artistEl = html.find('.np-artist');
    const tooltipEl = html.find('#music-title-tooltip');

    if (track && track.name) {
        // Update thumbnail
        if (track.thumbnail) {
            artEl.attr('src', track.thumbnail).removeClass('art-placeholder');
        }

        // Update title text and tooltip
        titleEl.text(track.name);
        tooltipEl.text(track.name);
        const tags = track.tags ? track.tags.join(', ') : localize('Player.SelectTrackToBegin');
        artistEl.text(tags);
    } else {
        titleEl.text(localize('Player.NoMusicPlaying'));
        tooltipEl.text(localize('Player.NoMusicPlaying'));
        artistEl.text(localize('Player.SelectTrackToBegin'));
    }
}

/**
 * Update the "Now Playing" section for ambience
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {Object} track - The current ambience track object
 */
export function updateAmbienceInfo(app, track) {
    const html = app.element;
    if (!html || !html.length) return;

    const artEl = html.find('.ambience-section .now-playing-art img, .ambience-section .now-playing-art .art-placeholder');
    const titleEl = html.find('#ambience-title');
    const tooltipEl = html.find('#ambience-title-tooltip');
    const tagsEl = html.find('.ambience-np-tags');

    if (track && track.name) {
        if (track.thumbnail) {
            artEl.attr('src', track.thumbnail).removeClass('art-placeholder');
        }
        titleEl.text(track.name);
        tooltipEl.text(track.name);
        const tags = track.tags ? track.tags.join(', ') : '';
        tagsEl.text(tags);
    } else {
        titleEl.text(localize('Player.NoAmbience'));
        tooltipEl.text(localize('Player.NoAmbience'));
        tagsEl.text(localize('Player.SelectAnAmbience'));
    }
}

/**
 * Update playback state icons (play/pause, shuffle, loop)
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function updatePlaybackState(app) {
    const html = app.element;
    if (!html || !html.length) return;

    const jukebox = app.jukebox;

    const playBtn = html.find('#play-pause-btn i');
    const shuffleBtn = html.find('#shuffle-btn i');
    const loopBtn = html.find('#loop-btn i');
    const ambiencePlayBtn = html.find('#ambience-play-btn i');
    const ambienceLoopBtn = html.find('#ambience-loop-btn i');

    // Update music play/pause icon
    if (jukebox.isPlaying) {
        playBtn.removeClass('fa-play-circle').addClass('fa-pause-circle');
    } else {
        playBtn.removeClass('fa-pause-circle').addClass('fa-play-circle');
    }

    // Update ambience play/pause icon
    if (jukebox.isAmbiencePlaying) {
        ambiencePlayBtn.removeClass('fa-play').addClass('fa-pause');
    } else {
        ambiencePlayBtn.removeClass('fa-pause').addClass('fa-play');
    }

    // Update shuffle state
    shuffleBtn.toggleClass('active', jukebox.shuffle);

    // Update loop states
    loopBtn.toggleClass('active', jukebox.musicLoop);
    ambienceLoopBtn.toggleClass('active', jukebox.ambienceLoop);
}

/**
 * Update the play button icon
 * @param {HTMLElement} btn - The button element
 * @param {boolean} isPlaying - Whether currently playing
 */
export function updatePlayButton(btn, isPlaying) {
    const icon = $(btn).find('i');
    if (isPlaying) {
        icon.removeClass('fa-play-circle').addClass('fa-pause-circle');
        btn.title = localize('Player.Pause');
    } else {
        icon.removeClass('fa-pause-circle').addClass('fa-play-circle');
        btn.title = localize('Player.Play');
    }
}

/**
 * Update mode toggle visual state
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function updateModeToggle(app) {
    const html = app.element;
    if (!html || !html.length) return;

    const toggle = html.find('.mode-toggle');
    const isPreview = app.jukebox.isPreviewMode;

    // Update toggle classes for visual state
    toggle.removeClass('preview broadcast');
    toggle.addClass(isPreview ? 'preview' : 'broadcast');

    // Update the toggle button's data-mode attribute
    const toggleBtn = toggle.find('.toggle-switch');
    toggleBtn.attr('data-mode', isPreview ? 'broadcast' : 'preview');

    // Update tooltip
    const tooltipText = isPreview
        ? localize('Mode.PreviewTooltip')
        : localize('Mode.BroadcastTooltip');
    toggle.attr('data-tooltip', tooltipText);
}

/**
 * Show loading state on the application
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {string} type - Type of loading ('track' or 'full')
 */
export function showLoadingState(app, type = 'track') {
    const html = app.element;
    if (!html || !html.length) return;

    if (type === 'track') {
        // Add loading indicator to now playing art
        html.find('.now-playing-art').addClass('loading');

        // Disable playback buttons
        html.find('#play-pause-btn, #prev-btn, #next-btn, .control-btn').prop('disabled', true);
    } else if (type === 'full') {
        // Show full overlay loading
        const overlay = $(`
            <div class="jb-loading-overlay">
                <div class="jb-spinner"></div>
                <div class="jb-loading-text">${localize('Player.Loading')}</div>
            </div>
        `);
        html.find('.jb-main').append(overlay);
    }
}

/**
 * Hide loading state on the application
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {string} type - Type of loading ('track' or 'full')
 */
export function hideLoadingState(app, type = 'track') {
    const html = app.element;
    if (!html || !html.length) return;

    if (type === 'track') {
        // Remove loading indicator
        html.find('.now-playing-art').removeClass('loading');

        // Re-enable playback buttons
        html.find('#play-pause-btn, #prev-btn, #next-btn, .control-btn').prop('disabled', false);
    } else if (type === 'full') {
        // Remove overlay
        html.find('.jb-loading-overlay').remove();
    }
}

/**
 * Show an error banner
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {string} message - Error message to display
 * @param {number} duration - Duration in ms (0 for permanent)
 */
export function showError(app, message, duration = 5000) {
    const html = app.element;
    if (!html || !html.length) return;

    // Remove existing error banners
    html.find('.jb-error-banner').remove();

    // Create new error banner
    const banner = $(`
        <div class="jb-error-banner">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="error-message">${message}</div>
            <button class="error-dismiss"><i class="fas fa-times"></i></button>
        </div>
    `);

    // Add to main content area
    html.find('.jb-main').prepend(banner);

    // Dismiss on click
    banner.find('.error-dismiss').on('click', () => banner.remove());

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => banner.remove(), duration);
    }
}

/**
 * Show a notification toast
 * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
 * @param {string} message - Message to display
 */
export function showNotification(type, message) {
    // Use Foundry's built-in notification system
    switch (type) {
        case 'success':
            ui.notifications.info(message);
            break;
        case 'warning':
            ui.notifications.warn(message);
            break;
        case 'error':
            ui.notifications.error(message);
            break;
        default:
            ui.notifications.info(message);
    }
}
