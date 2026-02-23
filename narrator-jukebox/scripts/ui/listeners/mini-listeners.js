/**
 * Mini Mode Listeners Module
 * Handles mini player interactions: tabs, search, track rows, player controls, drag
 *
 * @module ui/listeners/mini-listeners
 */

import { debounce } from '../../utils/debounce.js';
import { debugLog } from '../../utils/debug.js';

/**
 * Activate mini mode listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
export function activateMiniListeners(app, html) {
    const jukebox = app.jukebox;

    // ========== TAB SWITCHING ==========
    html.find('.mini-tab').click(e => {
        const tab = e.currentTarget.dataset.tab;
        app._miniActiveTab = tab;

        // Update tabs UI
        html.find('.mini-tab').removeClass('active');
        $(e.currentTarget).addClass('active');

        // Update content panels
        html.find('.mini-tab-panel').addClass('hidden');
        html.find(`[data-panel="${tab}"]`).removeClass('hidden');

        // Update player bar sections
        html.find('.mini-player-section').addClass('hidden');
        html.find(`.${tab}-player`).removeClass('hidden');
    });

    // ========== MUSIC SUB-TAB SWITCHING (Library/Queue) ==========
    html.find('.mini-subtab').click(e => {
        const subtab = e.currentTarget.dataset.subtab;
        if ($(e.currentTarget).hasClass('disabled')) return;

        app._miniMusicView = subtab;

        // Update subtabs UI
        html.find('.mini-subtab').removeClass('active');
        $(e.currentTarget).addClass('active');

        // Update music views
        html.find('.mini-music-view').addClass('hidden');
        html.find(`[data-view="${subtab}"]`).removeClass('hidden');
    });

    // ========== HEADER CONTROLS ==========
    html.find('.mini-expand-btn').click(() => app._exitMiniMode());
    html.find('.mini-collapse-btn').click(() => app._enterMicroMode());

    // ========== BROADCAST TOGGLE ==========
    html.find('#mini-broadcast-toggle').on('click', e => {
        e.stopPropagation();
        e.preventDefault();

        // Toggle both modes for consistency
        jukebox.isPreviewMode = !jukebox.isPreviewMode;
        jukebox.soundboardBroadcastMode = !jukebox.isPreviewMode;

        debugLog('Broadcast mode toggled:', {
            isPreviewMode: jukebox.isPreviewMode,
            soundboardBroadcastMode: jukebox.soundboardBroadcastMode
        });

        app.render(false);
    });

    // ========== DRAG FUNCTIONALITY ==========
    initMiniDrag(app, html);

    // ========== SEARCH ==========
    activateMiniSearchListeners(app, html);

    // ========== TRACK INTERACTIONS ==========
    activateMiniTrackListeners(app, html, jukebox);

    // ========== PLAYER CONTROLS ==========
    activateMiniPlayerControls(app, html, jukebox);
}

/**
 * Initialize mini mode drag functionality
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
function initMiniDrag(app, html) {
    const header = html.find('.mini-header');
    const windowEl = app.element[0];

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.on('mousedown', e => {
        // Don't drag from interactive elements
        const $target = $(e.target);
        if ($target.closest('button, input, .mini-tab, .mini-broadcast-toggle, .mini-control-btn, .mini-tabs, .mini-header-controls').length) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = app.position.left;
        startTop = app.position.top;

        windowEl.style.cursor = 'grabbing';
        e.preventDefault();
    });

    $(document).on('mousemove.miniDrag', e => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        app.setPosition({
            left: startLeft + dx,
            top: startTop + dy
        });
    });

    $(document).on('mouseup.miniDrag', () => {
        if (isDragging) {
            isDragging = false;
            windowEl.style.cursor = '';
        }
    });
}

/**
 * Activate mini mode search listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 */
function activateMiniSearchListeners(app, html) {
    const searchInput = html.find('.mini-search-input');
    const searchClear = html.find('.mini-search-clear');

    const debouncedSearch = debounce(() => {
        app._miniSearchQuery = searchInput.val();

        // Update clear button visibility
        if (app._miniSearchQuery) {
            searchClear.removeClass('hidden');
        } else {
            searchClear.addClass('hidden');
        }

        app.render(false);
    }, 200);

    searchInput.on('input', debouncedSearch);

    // ESC to clear search
    searchInput.on('keydown', e => {
        if (e.key === 'Escape') {
            app._miniSearchQuery = '';
            searchInput.val('');
            searchClear.addClass('hidden');
            app.render(false);
        }
    });

    searchClear.click(() => {
        app._miniSearchQuery = '';
        searchInput.val('');
        searchClear.addClass('hidden');
        app.render(false);
    });
}

/**
 * Activate mini mode track interaction listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 */
function activateMiniTrackListeners(app, html, jukebox) {
    // Music track clicks
    html.on('click', '.mini-track-row[data-music-id]', e => {
        const id = e.currentTarget.dataset.musicId;
        if (!id) return;

        const currentId = jukebox.channels.music.currentTrack?.id;
        if (id === currentId) {
            jukebox.togglePlay('music');
        } else {
            jukebox.playMusic(id);
        }
        app.render(false);
    });

    // Ambience track clicks - Toggle layer on/off
    html.on('click', '.mini-track-row[data-ambience-id]', e => {
        // Don't toggle if clicking on volume slider
        if ($(e.target).closest('.mini-layer-volume').length) return;

        const id = e.currentTarget.dataset.ambienceId;
        if (!id) return;

        // Toggle this track as a layer
        jukebox.toggleAmbienceLayer(id);
        app.render(false);
    });

    // Layer individual volume control
    html.on('input', '.mini-layer-volume', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.layerId;
        const vol = parseFloat(e.target.value) / 100;
        jukebox.setAmbienceLayerVolume(id, vol);
    });

    // Soundboard card clicks
    html.on('click', '.mini-sound-card', e => {
        const id = e.currentTarget.dataset.soundId;
        if (!id) return;

        if (jukebox.isSoundboardSoundPlaying(id)) {
            jukebox.stopSoundboardSound(id);
        } else {
            const isBroadcast = jukebox.soundboardBroadcastMode;
            jukebox.playSoundboardSound(id, { loop: false, preview: !isBroadcast });
        }
        app.render(false);
    });
}

/**
 * Activate mini mode player control listeners
 * @param {NarratorsJukeboxApp} app - The application instance
 * @param {jQuery} html - The HTML element
 * @param {NarratorJukebox} jukebox - The jukebox instance
 */
function activateMiniPlayerControls(app, html, jukebox) {
    // ========== MUSIC CONTROLS ==========
    html.find('#mini-play-pause').click(() => {
        jukebox.togglePlay('music');
        app.render(false);
    });

    html.find('#mini-prev').click(() => {
        jukebox.prev();
    });

    html.find('#mini-next').click(() => {
        jukebox.next();
    });

    html.find('#mini-mute').click(() => {
        jukebox.toggleMute('music');
        app.render(false);
    });

    html.find('#mini-volume-slider').on('input', e => {
        const vol = parseFloat(e.target.value) / 100;
        jukebox.setVolume(vol, 'music');
    });

    // ========== AMBIENCE LAYER MIXER CONTROLS ==========

    // Stop all layers
    html.find('#mini-stop-all-layers').click(() => {
        jukebox.stopAllAmbienceLayers();
        app.render(false);
    });

    // Master mute toggle
    html.find('#mini-ambience-master-mute').click(() => {
        jukebox.toggleAmbienceMasterMute();
        app.render(false);
    });

    // Master volume slider
    html.find('#mini-ambience-master-volume').on('input', e => {
        const vol = parseFloat(e.target.value) / 100;
        jukebox.setAmbienceMasterVolume(vol);
    });

    // Click on layer thumbnail to stop that layer
    html.on('click', '.mini-layer-thumb', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.layerId;
        if (id) {
            jukebox.stopAmbienceLayer(id);
            app.render(false);
        }
    });

    // ========== SOUNDBOARD CONTROLS ==========
    html.find('#mini-stop-all-sounds').click(() => {
        jukebox.stopAllSoundboardSounds();
        app.render(false);
    });
}

export { initMiniDrag };
