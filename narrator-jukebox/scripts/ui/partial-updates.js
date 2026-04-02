/**
 * Partial Updates Module
 * Handles partial UI updates without full re-renders
 *
 * @module ui/partial-updates
 */

import { JUKEBOX } from '../core/constants.js';
import { formatTime } from '../utils/time-format.js';
import { localize } from '../utils/i18n.js';

function escapeHTML(value) {
    if (foundry?.utils?.escapeHTML) {
        return foundry.utils.escapeHTML(String(value ?? ''));
    }

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildNowPlayingSubtitle(app) {
    const currentTrack = app.jukebox.channels.music.currentTrack;
    const currentPlaylist = app.jukebox.currentPlaylist;

    if (currentPlaylist?.name) {
        return `<i class="fas fa-list-music"></i> ${escapeHTML(currentPlaylist.name)}`;
    }

    if (currentTrack) {
        return '<i class="fas fa-music"></i> Library';
    }

    return 'Music';
}

function setBadgeCount(container, count, className = '') {
    if (!container?.length) return;

    let badge = container.find(`.badge${className ? `.${className}` : ''}`).first();
    if (count > 0) {
        if (!badge.length) {
            badge = $(`<span class="badge${className ? ` ${className}` : ''}"></span>`);
            container.append(badge);
        }
        badge.text(count).show();
    } else if (badge.length) {
        badge.remove();
    }
}

/**
 * Update the "Now Playing" section for music
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {Object} track - The current track object
 */
export function updateNowPlayingInfo(app, track) {
    const html = app.element;
    if (!html || !html.length) return;

    const artContainer = html.find('.music-section .now-playing-art');
    const titleEl = html.find('#music-title');
    const artistEl = html.find('.np-artist');
    const tooltipEl = html.find('#music-title-tooltip');
    const subtitleEl = html.find('.music-section .np-subtitle');

    if (track && track.name) {
        // Hide track info from non-GM players when track is marked as hidden (spoiler protection)
        const isHidden = track.hidden && !game.user.isGM;
        const displayName = isHidden ? 'Now Playing' : track.name;

        // Update thumbnail
        if (isHidden) {
            // Replace with mask placeholder
            artContainer.html('<div class="art-placeholder"><i class="fas fa-mask"></i></div>');
        } else if (track.thumbnail) {
            artContainer.html(`<img src="${track.thumbnail}" alt="${escapeHTML(displayName)}">`);
        } else {
            artContainer.html('<div class="art-placeholder"><i class="fas fa-music"></i></div>');
        }

        // Update title text and tooltip
        titleEl.text(displayName);
        tooltipEl.text(displayName);
        const tags = isHidden ? '' : (track.tags ? track.tags.join(', ') : localize('Player.SelectTrackToBegin'));
        artistEl.text(tags);
        subtitleEl.html(buildNowPlayingSubtitle(app));
    } else {
        artContainer.html('<div class="art-placeholder"><i class="fas fa-music"></i></div>');
        titleEl.text(localize('Player.NoMusicPlaying'));
        tooltipEl.text(localize('Player.NoMusicPlaying'));
        artistEl.text(localize('Player.SelectTrackToBegin'));
        subtitleEl.html(buildNowPlayingSubtitle(app));
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

    const artContainer = html.find('.ambience-section .now-playing-art');
    const titleEl = html.find('#ambience-title');
    const tooltipEl = html.find('#ambience-title-tooltip');
    const tagsEl = html.find('.ambience-np-tags');

    if (track && track.name) {
        if (track.thumbnail) {
            artContainer.html(`<img src="${track.thumbnail}" alt="${escapeHTML(track.name)}">`);
        } else {
            artContainer.html('<div class="art-placeholder"><i class="fas fa-cloud-sun"></i></div>');
        }
        titleEl.text(track.name);
        tooltipEl.text(track.name);
        const tags = track.tags ? track.tags.join(', ') : '';
        tagsEl.text(tags);
    } else {
        artContainer.html('<div class="art-placeholder"><i class="fas fa-cloud-sun"></i></div>');
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
    const playBtnEl = html.find('#play-pause-btn');
    const shuffleBtnEl = html.find('#shuffle-btn');
    const loopBtnEl = html.find('#loop-btn');

    // Update music play/pause icon
    if (jukebox.isPlaying) {
        playBtn.removeClass('fa-play fa-play-circle fa-pause-circle').addClass('fa-pause');
        playBtnEl.attr('data-tooltip', localize('Player.Pause'));
    } else {
        playBtn.removeClass('fa-pause fa-play-circle fa-pause-circle').addClass('fa-play');
        playBtnEl.attr('data-tooltip', localize('Player.Play'));
    }

    // Update ambience play/pause icon
    if (jukebox.isAmbiencePlaying) {
        ambiencePlayBtn.removeClass('fa-play').addClass('fa-pause');
    } else {
        ambiencePlayBtn.removeClass('fa-pause').addClass('fa-play');
    }

    // Update shuffle state
    shuffleBtn.toggleClass('active', jukebox.shuffle);
    shuffleBtnEl.attr('data-tooltip', jukebox.shuffle ? localize('Player.ShuffleOn') : localize('Player.ShuffleOff'));

    // Update loop states
    loopBtn.toggleClass('active', jukebox.musicLoop);
    ambienceLoopBtn.toggleClass('active', jukebox.ambienceLoop);
    loopBtnEl.attr('data-tooltip', jukebox.musicLoop ? localize('Player.LoopOn') : localize('Player.LoopOff'));
}

/**
 * Update the play button icon
 * @param {HTMLElement} btn - The button element
 * @param {boolean} isPlaying - Whether currently playing
 */
export function updatePlayButton(btn, isPlaying) {
    const icon = $(btn).find('i');
    if (isPlaying) {
        icon.removeClass('fa-play fa-play-circle').addClass('fa-pause');
        $(btn).attr('data-tooltip', localize('Player.Pause'));
    } else {
        icon.removeClass('fa-pause fa-pause-circle').addClass('fa-play');
        $(btn).attr('data-tooltip', localize('Player.Play'));
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

    const broadcastIndicator = html.find('.broadcast-indicator');
    if (broadcastIndicator.length) {
        broadcastIndicator.removeClass('preview broadcast').addClass(isPreview ? 'preview' : 'broadcast');
        broadcastIndicator.find('i')
            .removeClass('fa-headphones fa-broadcast-tower')
            .addClass(isPreview ? 'fa-headphones' : 'fa-broadcast-tower');
        broadcastIndicator.attr('data-tooltip', isPreview
            ? 'Preview Mode - Only you can hear'
            : 'Broadcast Mode - All players can hear');
    }
}

/**
 * Update music volume slider and mute icon without re-rendering the app.
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function updateMusicVolume(app) {
    const html = app.element;
    if (!html || !html.length) return;

    const volume = Math.round((app.jukebox.channels.music.volume || 0) * 100);
    const isMuted = app.jukebox.isMuted;
    const slider = html.find('#volume-slider');
    const button = html.find('#mute-btn');
    const icon = button.find('i');

    if (slider.length) {
        slider.val(volume);
    }

    icon.removeClass('fa-volume-mute fa-volume-off fa-volume-down fa-volume-up');
    if (isMuted || volume === 0) {
        icon.addClass('fa-volume-mute');
        button.attr('data-tooltip', localize('Player.Unmute'));
    } else if (volume > 50) {
        icon.addClass('fa-volume-up');
        button.attr('data-tooltip', localize('Player.Mute'));
    } else {
        icon.addClass('fa-volume-down');
        button.attr('data-tooltip', localize('Player.Mute'));
    }
}

/**
 * Update active/playing classes for visible music items without re-rendering lists.
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function updateMusicTrackRows(app) {
    const html = app.element;
    if (!html || !html.length) return;

    const currentId = app.jukebox.channels.music.currentTrack?.id || null;
    const nextId = app._getNextTrack()?.id || null;
    const isPlaying = app.jukebox.isPlaying;

    html.find('.play-music-btn[data-music-id]').each((_, element) => {
        const row = $(element);
        const musicId = row.data('musicId');
        const isCurrent = musicId === currentId;
        const isNext = musicId === nextId;

        row.toggleClass('active', isCurrent);
        row.toggleClass('playing', isCurrent && isPlaying);
        row.toggleClass('paused', isCurrent && !isPlaying);
        row.toggleClass('up-next', isNext);

        const titleWrapper = row.find('.t-name').first();
        if (titleWrapper.length) {
            let nextBadge = titleWrapper.find('.next-badge');
            if (isNext) {
                if (!nextBadge.length) {
                    titleWrapper.append('<span class="next-badge" data-tooltip="Up Next" data-tooltip-position="top">NEXT</span>');
                }
            } else if (nextBadge.length) {
                nextBadge.remove();
            }
        }
    });
}

/**
 * Update sidebar/header badges that reflect active ambience layers, soundboard sounds, and suggestions.
 * @param {NarratorsJukeboxApp} app - The application instance
 */
export function updateSidebarBadges(app) {
    const html = app.element;
    if (!html || !html.length) return;

    const ambienceCount = app.jukebox.getAmbienceLayerCount?.() || 0;
    const soundboardCount = app.jukebox.activeSoundboardSounds?.size || 0;
    const suggestionsCount = (game.settings.get(JUKEBOX.ID, 'suggestions') || []).length;

    setBadgeCount(html.find('.nav-item[data-view="ambience"]'), ambienceCount, 'ambience-badge');
    setBadgeCount(html.find('.nav-item[data-view="soundboard"]'), soundboardCount, 'soundboard-badge');
    setBadgeCount(html.find('.nav-item[data-view="suggestions"]'), suggestionsCount);

    const ambienceLayerBadge = html.find('.ambience-layer-badge');
    if (ambienceLayerBadge.length) {
        ambienceLayerBadge
            .text(`${ambienceCount}/8`)
            .toggleClass('at-limit', ambienceCount >= 8);
    }
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
