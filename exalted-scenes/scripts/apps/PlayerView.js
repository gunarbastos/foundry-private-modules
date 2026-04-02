/**
 * @file PlayerView.js
 * @description Player-facing view for Exalted Scenes module. Displays broadcasted scenes
 * with cast members, handles emotion/border pickers, and manages transitions between scenes.
 *
 * This file coordinates multiple handlers for specific functionality domains:
 * - TransitionHandler: Scene and background transitions
 * - LayoutCalculator: Cast positioning and Foundry UI offsets
 * - EmotionPickerHandler: Emotion picker for players
 * - BorderPickerHandler: Border style picker
 * - MediaHandler: Video/image handling
 *
 * @module apps/PlayerView
 */

import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { createHandlers, setupHandlers, cleanupHandlers } from './player-view/index.js';
import {
  buildHeroHalfLayoutMeta,
  clampHeroHalfX,
  canUserControlCharacterLayout,
  getDefaultHeroFullPosition,
  getDefaultFreeformPosition,
  getFreeformPosition,
  getFreeformZIndex,
  getHeroFullPosition,
  getHeroHalfPosition,
  getHeroHalfZIndex,
  isValidHeroHalfX,
  isPlayerLayoutControlEnabled
} from './player-view/hero-layout-utils.js';
import {
  addTheaterShot,
  buildTheaterRenderState,
  ensureTheaterShots,
  getTheaterStripHeight,
  getTheaterShot,
  getTheaterStripPosition,
  isSceneTheaterMode,
  MIN_THEATER_STRIP_HEIGHT,
  replaceTheaterShot,
  setTheaterStripHeight,
  setTheaterStripPosition
} from './player-view/theater-mode-utils.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';
import { formatCharacterNotification } from '../utils/character-visibility.js';
import {
  isYouTubeEmbedBlockedCode,
  normalizeYouTubeUrl,
  validateYouTubeEmbed
} from '../utils/youtube-embed-validator.js';
import { borderStyleToInline } from '../utils/border-utils.js';
import { applyMediaFocusToElement, mediaFocusToInlineStyle } from '../utils/media-focus.js';
import {
  applyPopoverPosition,
  buildPopoverAnchorFromElement,
  clonePopoverAnchor,
  getFallbackPopoverAnchor
} from '../utils/popover-position.js';
import { resolveCharacterElementAtPoint } from './player-view/character-hit-test-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Player-facing view for broadcasting scenes to players.
 * Displays scene backgrounds, cast members with emotions, and handles
 * user interactions for emotion/border picking.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class ExaltedScenesPlayerView extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Creates a new PlayerView instance.
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);

    /**
     * UI state for the view
     * @type {Object}
     */
    this.uiState = {
      active: false,
      sceneId: null,
      emotionPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, anchor: null },
      borderPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, currentStyle: null, anchor: null },
      musicPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, searchQuery: '', addMode: false, anchor: null },
      previousSceneId: null,  // Para detectar troca de cena
      isSceneTransition: false, // Flag para controlar animações
      // Slideshow state
      slideshowMode: false,
      cinematicMode: false,
      slideshowPaused: false,
      // Cast-Only Mode state (cast without scene background)
      castOnlyMode: false,
      castOnlyCharacterIds: [],
      castOnlyLayoutSettings: null,
      // Preview Mode state (GM-only local preview before broadcasting)
      previewMode: false,
      previewType: null,  // 'scene', 'slideshow', 'sequence', 'cast-only'
      activeTheaterShotId: null
    };

    /**
     * Handler instances for delegated functionality
     * @type {Object}
     * @private
     */
    this._handlers = createHandlers(this);

    /**
     * Preserved background video between UI-only renders.
     * Prevents video backgrounds from reloading and flashing black when opening overlays.
     * @type {Object|null}
     * @private
     */
    this._preservedBackgroundMedia = null;
    this._theaterStripAbortController = null;
    this._renderAbortController = null;
    this._mcdStyleGuards = new Map();
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-player-view',
    classes: ['exalted-scenes'],
    window: {
      frame: false,
      positioned: false,
      controls: []
    },
    position: {
      width: '100%',
      height: '100%',
      top: 0,
      left: 0
    },
    actions: {
      'character-click': ExaltedScenesPlayerView._onCharacterClick,
      'select-emotion': ExaltedScenesPlayerView._onSelectEmotion,
      'close-picker': ExaltedScenesPlayerView._onClosePicker,
      'toggle-emotion-favorite': ExaltedScenesPlayerView._onToggleEmotionFavorite,
      'open-border-picker': ExaltedScenesPlayerView._onOpenBorderPicker,
      'close-border-picker': ExaltedScenesPlayerView._onCloseBorderPicker,
      'back-to-emotions': ExaltedScenesPlayerView._onBackToEmotions,
      'select-effect': ExaltedScenesPlayerView._onSelectEffect,
      'select-border-color': ExaltedScenesPlayerView._onSelectBorderColor,
      'select-border-color2': ExaltedScenesPlayerView._onSelectBorderColor2,
      'remove-from-scene': ExaltedScenesPlayerView._onRemoveFromScene,
      'open-actor-sheet': ExaltedScenesPlayerView._onOpenActorSheet,
      'go-live': ExaltedScenesPlayerView._onGoLive,
      'exit-preview': ExaltedScenesPlayerView._onExitPreview,
      'activate-theater-shot': ExaltedScenesPlayerView._onActivateTheaterShot,
      'add-theater-shot': ExaltedScenesPlayerView._onAddTheaterShot,
      'toggle-theater-character': ExaltedScenesPlayerView._onToggleTheaterCharacter,
      // Audio restore actions
      'restore-playlist': ExaltedScenesPlayerView._onRestorePlaylist,
      'restore-ambience': ExaltedScenesPlayerView._onRestoreAmbience,
      'stop-all-audio': ExaltedScenesPlayerView._onStopAllAudio,
      'play-soundboard-sound': ExaltedScenesPlayerView._onPlaySoundboardSound,
      'toggle-mixer': ExaltedScenesPlayerView._onToggleMixer,
      // Music Request actions
      'open-music-picker': ExaltedScenesPlayerView._onOpenMusicPicker,
      'close-music-picker': ExaltedScenesPlayerView._onCloseMusicPicker,
      'back-to-emotions-from-music': ExaltedScenesPlayerView._onBackToEmotionsFromMusic,
      'request-track': ExaltedScenesPlayerView._onRequestTrack,
      'toggle-add-mode': ExaltedScenesPlayerView._onToggleAddMode,
      'submit-youtube-add': ExaltedScenesPlayerView._onSubmitYouTubeAdd,
      // Free Composition actions
      'flip-character': ExaltedScenesPlayerView._onFlipCharacter,
      // Hero mode layout controls
      'move-hero-backward': ExaltedScenesPlayerView._onMoveHeroBackward,
      'move-hero-forward': ExaltedScenesPlayerView._onMoveHeroForward
    }
  };

  static PARTS = {
    main: {
      template: CONFIG.TEMPLATES.PLAYER_VIEW
    }
  };

  render(...args) {
    this._captureBackgroundMediaForRender();
    return super.render(...args);
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Called after the view is rendered.
   * Sets up handlers, calculates UI offsets, and manages animations.
   *
   * @param {Object} context - Render context
   * @param {Object} options - Render options
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this._syncMonksCommonDisplayVisibility();

    this._restorePreservedBackgroundMedia();

    if (this._theaterStripAbortController) {
      this._theaterStripAbortController.abort();
      this._theaterStripAbortController = null;
    }

    // Cleanup previous handlers before setting up new ones
    cleanupHandlers(this._handlers);

    // Setup all handlers with the new element
    // Note: LayoutCalculator.setup() will call setFoundryUIOffsets()
    // Note: MediaHandler.setup() will call ensureVideoPlays()
    setupHandlers(this._handlers, this.element);

    this._renderAbortController?.abort();
    this._renderAbortController = new AbortController();
    const { signal } = this._renderAbortController;
    window.addEventListener('resize', () => {
      this._positionOpenPopovers();
      this._syncTheaterPreviewStages();
    }, { signal });

    // Note: Scene entrance animations are now handled by TransitionHandler.setup()
    // Note: Emotion picker search/preview is now handled by EmotionPickerHandler.setup()
    // Note: Video autoplay is now handled by MediaHandler.setup()
    // All are called via setupHandlers() above
    this._positionOpenPopovers();
    this._syncTheaterPreviewStages();
    this._bindTheaterStrip();
  }

  _onClose(options) {
    this._restoreMonksCommonDisplayVisibility();
    this._renderAbortController?.abort();
    this._renderAbortController = null;
    cleanupHandlers(this._handlers);

    if (this._theaterStripAbortController) {
      this._theaterStripAbortController.abort();
      this._theaterStripAbortController = null;
    }

    super._onClose?.(options);
  }

  _rememberStyleGuard(element, property) {
    if (!(element instanceof HTMLElement)) return;

    let styleState = this._mcdStyleGuards.get(element);
    if (!styleState) {
      styleState = new Map();
      this._mcdStyleGuards.set(element, styleState);
    }

    if (styleState.has(property)) return;

    styleState.set(property, {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
      hadValue: element.style.getPropertyValue(property) !== ''
    });
  }

  _setGuardedStyle(element, property, value, priority = 'important') {
    if (!(element instanceof HTMLElement)) return;
    this._rememberStyleGuard(element, property);
    element.style.setProperty(property, value, priority);
  }

  _restoreMonksCommonDisplayVisibility() {
    if (!this._mcdStyleGuards.size) return;

    for (const [element, properties] of this._mcdStyleGuards.entries()) {
      if (!(element instanceof HTMLElement)) continue;

      for (const [property, previous] of properties.entries()) {
        if (previous?.hadValue) {
          element.style.setProperty(property, previous.value, previous.priority);
        } else {
          element.style.removeProperty(property);
        }
      }
    }

    this._mcdStyleGuards.clear();
  }

  _isMonksCommonDisplayClient() {
    if (!game.modules.get('monks-common-display')?.active) return false;

    try {
      const playerData = game.settings.get('monks-common-display', 'playerdata') || {};
      return playerData?.[game.user.id]?.display === true;
    } catch (error) {
      return document.body.classList.contains('hide-ui');
    }
  }

  _getMonksCommonDisplaySidebarWidth() {
    if (document.body.classList.contains('hide-chat')) return 0;

    const sidebar = document.getElementById('sidebar');
    if (!(sidebar instanceof HTMLElement) || sidebar.classList.contains('collapsed')) return 0;

    const computed = window.getComputedStyle(sidebar);
    if (computed.display === 'none' || computed.visibility === 'hidden') return 0;

    const width = sidebar.getBoundingClientRect().width;
    return Number.isFinite(width) && width > 0 ? Math.ceil(width) : 0;
  }

  _syncMonksCommonDisplayVisibility() {
    this._restoreMonksCommonDisplayVisibility();

    const hideUiActive = document.body.classList.contains('hide-ui');
    if (!this._isMonksCommonDisplayClient() || !hideUiActive || !this.uiState.active) return;

    const host = this.element;
    if (!(host instanceof HTMLElement)) return;

    const playerView = host.querySelector('.es-player-view');
    const windowContent = host.querySelector('.window-content');
    const sidebarWidth = this._getMonksCommonDisplaySidebarWidth();
    const rightInset = `${sidebarWidth}px`;
    const styledAncestors = [];

    let current = host;
    while (current instanceof HTMLElement && current !== document.body) {
      styledAncestors.push(current);
      current = current.parentElement;
    }

    for (const node of styledAncestors) {
      const computed = window.getComputedStyle(node);

      if (computed.display === 'none') {
        const fallbackDisplay = node === host || node === windowContent ? 'flex' : 'block';
        this._setGuardedStyle(node, 'display', fallbackDisplay);
      }

      if (computed.visibility === 'hidden') {
        this._setGuardedStyle(node, 'visibility', 'visible');
      }

      if (Number.parseFloat(computed.opacity) === 0) {
        this._setGuardedStyle(node, 'opacity', '1');
      }
    }

    this._setGuardedStyle(host, 'position', 'fixed');
    this._setGuardedStyle(host, 'top', '0');
    this._setGuardedStyle(host, 'right', rightInset);
    this._setGuardedStyle(host, 'bottom', '0');
    this._setGuardedStyle(host, 'left', '0');
    this._setGuardedStyle(host, 'width', sidebarWidth > 0 ? 'auto' : '100vw');
    this._setGuardedStyle(host, 'height', '100vh');
    this._setGuardedStyle(host, 'z-index', '1000');
    this._setGuardedStyle(host, 'background', 'transparent');
    this._setGuardedStyle(host, 'box-shadow', 'none');
    this._setGuardedStyle(host, 'border', 'none');

    if (windowContent instanceof HTMLElement) {
      this._setGuardedStyle(windowContent, 'display', 'flex');
      this._setGuardedStyle(windowContent, 'width', '100%');
      this._setGuardedStyle(windowContent, 'height', '100%');
      this._setGuardedStyle(windowContent, 'padding', '0');
      this._setGuardedStyle(windowContent, 'background', 'transparent');
      this._setGuardedStyle(windowContent, 'visibility', 'visible');
      this._setGuardedStyle(windowContent, 'opacity', '1');
      this._setGuardedStyle(windowContent, 'overflow', 'hidden');
    }

    if (playerView instanceof HTMLElement) {
      this._setGuardedStyle(playerView, 'top', '0');
      this._setGuardedStyle(playerView, 'right', rightInset);
      this._setGuardedStyle(playerView, 'bottom', '0');
      this._setGuardedStyle(playerView, 'left', '0');
      this._setGuardedStyle(playerView, 'width', sidebarWidth > 0 ? 'auto' : '100vw');
      this._setGuardedStyle(playerView, 'height', '100vh');
      this._setGuardedStyle(playerView, 'display', 'block');
      this._setGuardedStyle(playerView, 'visibility', 'visible');
      this._setGuardedStyle(playerView, 'opacity', '1');
      this._setGuardedStyle(playerView, 'z-index', '1001');
    }
  }

  _positionOpenPopovers() {
    this._positionPopoverElement('.es-emotion-picker', this.uiState.emotionPicker, {
      belowClass: 'es-emotion-picker--below',
      gapAbove: 8,
      gapBelow: 8
    });
    this._positionPopoverElement('.es-border-picker', this.uiState.borderPicker, {
      belowClass: 'es-border-picker--below',
      gapAbove: 8,
      gapBelow: 8
    });
    this._positionPopoverElement('.es-music-picker', this.uiState.musicPicker, {
      belowClass: 'es-music-picker--below',
      gapAbove: 12,
      gapBelow: 12
    });
  }

  _applySmartFitClass(container, img) {
    if (!(container instanceof HTMLElement) || !(img instanceof HTMLImageElement)) return;
    if (!Number.isFinite(img.naturalWidth) || !Number.isFinite(img.naturalHeight) || img.naturalHeight <= 0) return;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const viewportAspect = window.innerWidth / window.innerHeight;
    const aspectDifference = Math.abs(imgAspect - viewportAspect) / Math.max(imgAspect, viewportAspect);
    container.classList.toggle('es-pv-background--smart-contain', aspectDifference > 0.20);
  }

  _syncTheaterPreviewStages() {
    const medias = this.element?.querySelectorAll('.es-theater-shot__preview-media');
    if (!medias?.length) return;

    for (const media of medias) {
      if (!(media instanceof HTMLElement)) continue;
      const stage = media.querySelector('.es-theater-shot__preview-stage');
      if (!(stage instanceof HTMLElement)) continue;

      const stageWidth = Number.parseFloat(getComputedStyle(media).getPropertyValue('--es-preview-stage-width'));
      const stageHeight = Number.parseFloat(getComputedStyle(media).getPropertyValue('--es-preview-stage-height'));
      if (!Number.isFinite(stageWidth) || !Number.isFinite(stageHeight) || stageWidth <= 0 || stageHeight <= 0) {
        stage.style.setProperty('--es-preview-scale', '1');
        continue;
      }

      const scale = Math.min(media.clientWidth / stageWidth, media.clientHeight / stageHeight);
      stage.style.setProperty('--es-preview-scale', Number.isFinite(scale) && scale > 0 ? `${scale}` : '1');

      const bgContainer = media.querySelector('.es-pv-background--smart');
      const bgImage = bgContainer?.querySelector('.es-pv-bg-media');
      if (bgContainer instanceof HTMLElement && bgImage instanceof HTMLImageElement) {
        if (bgImage.complete && bgImage.naturalHeight > 0) {
          this._applySmartFitClass(bgContainer, bgImage);
        } else {
          bgImage.addEventListener('load', () => this._applySmartFitClass(bgContainer, bgImage), { once: true });
        }
      }
    }
  }

  _positionPopoverElement(selector, state, options = {}) {
    if (!state?.open) return;

    const element = this.element?.querySelector(selector);
    if (!(element instanceof HTMLElement)) return;

    const anchor = state.anchor || getFallbackPopoverAnchor(state);
    if (!anchor) return;

    const positioned = applyPopoverPosition(element, anchor, options);
    if (!positioned) return;

    state.x = positioned.x;
    state.y = positioned.y;
    state.pickerBelow = positioned.pickerBelow;
  }

  /**
   * Preserve the current background video before a re-render.
   * This keeps the decoded video frame and playback position alive for UI-only renders.
   *
   * @private
   */
  _captureBackgroundMediaForRender() {
    this._preservedBackgroundMedia = null;

    if (!this.uiState.active || this.uiState.castOnlyMode) return;

    const media = this.element?.querySelector('.es-pv-background > video.es-pv-bg-media');
    if (!(media instanceof HTMLVideoElement)) return;

    const src = this._normalizeMediaSource(media.currentSrc || media.getAttribute('src'));
    if (!src) return;

    this._preservedBackgroundMedia = {
      node: media,
      src,
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      paused: media.paused,
      playbackRate: media.playbackRate,
      muted: media.muted,
      loop: media.loop,
      volume: media.volume
    };
  }

  /**
   * Restore the preserved background video after a re-render when the scene did not change.
   *
   * @private
   */
  _restorePreservedBackgroundMedia() {
    const preserved = this._preservedBackgroundMedia;
    this._preservedBackgroundMedia = null;

    if (!preserved?.node) return;

    const background = this.element?.querySelector('.es-pv-background');
    const media = background?.querySelector('video.es-pv-bg-media');
    if (!(media instanceof HTMLVideoElement)) return;

    const nextSrc = this._normalizeMediaSource(media.currentSrc || media.getAttribute('src'));
    if (!nextSrc || nextSrc !== preserved.src) return;

    const video = preserved.node;
    if (video === media) return;

    video.className = media.className;
    video.style.cssText = media.style.cssText;
    video.muted = preserved.muted;
    video.loop = preserved.loop;
    video.volume = preserved.volume;
    video.playbackRate = preserved.playbackRate;

    background.replaceChild(video, media);

    try {
      video.currentTime = preserved.currentTime;
    } catch (error) {
      // Ignore seek failures; the preserved node still avoids a full reload.
    }

    if (!preserved.paused) {
      video.play().catch(() => {});
    }
  }

  /**
   * Normalize media sources so relative and absolute URLs compare reliably.
   *
   * @param {string|null} source - Media source path or URL
   * @returns {string}
   * @private
   */
  _normalizeMediaSource(source) {
    if (!source) return '';

    try {
      return new URL(source, window.location.href).href;
    } catch (error) {
      return String(source);
    }
  }

  _getSceneTheaterState(scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null, requestedShotId = this.uiState.activeTheaterShotId) {
    const state = buildTheaterRenderState(scene, requestedShotId);
    if (!state.theaterMode) {
      return {
        theaterMode: false,
        shots: [],
        activeShot: null,
        castSource: state.castSource,
        positions: state.positions,
        layoutScene: state.layoutScene || scene
      };
    }

    return state;
  }

  _syncActiveTheaterShot(scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null, requestedShotId = this.uiState.activeTheaterShotId) {
    const theaterState = this._getSceneTheaterState(scene, requestedShotId);
    if (theaterState.theaterMode && scene && !(scene.layoutSettings?.theaterShots?.length > 0)) {
      scene.layoutSettings.theaterShots = theaterState.shots;
    }
    this.uiState.activeTheaterShotId = theaterState.activeShot?.id || null;
    return theaterState;
  }

  _getDefaultTheaterStripPosition() {
    const isNarrowViewport = window.innerWidth <= 720;
    const stripWidth = isNarrowViewport ? 188 : 220;
    let leftOffset = 12;
    let rightOffset = 0;

    const controls = document.getElementById('controls');
    if (controls) {
      const controlsRect = controls.getBoundingClientRect();
      if (controlsRect.width > 0) {
        leftOffset = controlsRect.width + 16;
      }
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (sidebarRect.width > 0) {
        rightOffset = sidebarRect.width + 16;
      }
    }

    return {
      x: Math.max(leftOffset, window.innerWidth - rightOffset - stripWidth - 20),
      y: this.uiState.previewMode ? 92 : 72
    };
  }

  _getTheaterStripMaxHeight(top = 0) {
    const safeTop = Number.isFinite(top) ? top : 0;
    return Math.max(MIN_THEATER_STRIP_HEIGHT, window.innerHeight - safeTop - 16);
  }

  _clampTheaterStripHeight(height, top = 0) {
    const numericHeight = Number(height);
    if (!Number.isFinite(numericHeight)) return null;
    return Math.max(MIN_THEATER_STRIP_HEIGHT, Math.min(this._getTheaterStripMaxHeight(top), Math.round(numericHeight)));
  }

  /**
   * Build full position style string for a full body hero character.
   * @param {Object} scene - Scene object
   * @param {string} charId - Character ID
   * @param {number} index - Index in cast array
   * @param {number} castCount - Total cast count
   * @returns {string} Inline style string with CSS custom properties
   */
  _buildHeroFullPositionStyle(scene, charId, index, castCount) {
    const pos = getHeroFullPosition(scene, charId, index, castCount);
    return `--char-x: ${pos.x}%; --char-y: ${pos.y}%; --char-scale: ${pos.scale}; z-index: ${Math.round(pos.y)};${pos.flipped ? ' --char-flipped: -1;' : ''}`;
  }

  /**
   * Build inline style string for a free composition character.
   * Used by tokens and hero sprites whenever the preset is freeform.
   *
   * @param {Object} scene - Scene object
   * @param {string} charId - Character ID
   * @param {number} index - Index in cast array
   * @param {number} castCount - Total cast count
   * @param {Object} [fallbackPos] - Default position when the character has no stored freeform state
   * @returns {string} Inline style string with CSS custom properties
   */
  _buildFreeformPositionStyle(scene, charId, index, castCount, fallbackPos = undefined) {
    const defaultPos = fallbackPos || getDefaultFreeformPosition(index, castCount);
    const pos = getFreeformPosition(scene, charId, defaultPos);
    return `--char-x: ${pos.x}%; --char-y: ${pos.y}%; --char-scale: ${pos.scale}; z-index: ${getFreeformZIndex(pos)};${pos.flipped ? ' --char-flipped: -1;' : ''}`;
  }

  /**
   * Build inline style string for a half body hero character.
   * Half body heroes use absolute horizontal placement plus overlap layering.
   *
   * @param {Object} scene - Scene object
   * @param {string} charId - Character ID
   * @param {number} heroHalfIndex - Index among half-body heroes
   * @param {number} heroHalfCount - Total half-body hero count
   * @returns {string} Inline style string with CSS custom properties
   */
  _buildHeroHalfPositionStyle(scene, charId, heroHalfIndex, heroHalfCount) {
    const heroPos = getHeroHalfPosition(scene, charId, heroHalfIndex, heroHalfCount);
    const parts = [];
    parts.push(`--char-x: ${heroPos.x}%`);
    if (heroPos.scale && heroPos.scale !== 1) parts.push(`--char-scale: ${heroPos.scale}`);
    if (heroPos.flipped) parts.push('--char-flipped: -1');
    parts.push(`z-index: ${getHeroHalfZIndex(heroPos.layer)}`);
    return `${parts.join('; ')};`;
  }

  _buildHeroHalfLayoutMeta(castSource = []) {
    return buildHeroHalfLayoutMeta(castSource, id => Store.characters.get(id));
  }

  /**
   * Prepare render data for a single cast member.
   *
   * @param {Object} charRef - Cast reference
   * @param {Object|null} scene - Active scene
   * @param {number} index - Cast index
   * @param {number} castCount - Total cast size
   * @param {boolean} isHeroMode - Whether the scene is in hero display mode
   * @param {Object} [layoutMeta] - Precomputed layout metadata
   * @returns {Object} Template-ready character data
   */
  _prepareCastMemberContext(charRef, scene, index, castCount, isHeroMode = false, layoutMeta = {}) {
    const realChar = Store.characters.get(charRef.id);
    const isFreeform = scene?.layoutSettings?.preset === 'freeform';

    if (!realChar) {
      return {
        ...charRef,
        borderStyle: { ...CONFIG.BORDER_DEFAULT },
        locked: false,
        castIndex: index,
        showNameLabel: charRef.hideNameInBroadcast !== true,
        hintIconClass: 'fa-theater-masks'
      };
    }

    const canControlLayout = canUserControlCharacterLayout(realChar);
    const charData = {
      id: realChar.id,
      name: realChar.name,
      image: realChar.image,
      focus: realChar.currentFocus,
      focusStyle: mediaFocusToInlineStyle(realChar.currentFocus),
      borderStyle: realChar.borderStyle || { ...CONFIG.BORDER_DEFAULT },
      locked: realChar.locked || false,
      showNameLabel: !realChar.hideNameInBroadcast,
      castIndex: index,
      canControlLayout: isFreeform && canControlLayout,
      showDepthControls: isFreeform && canControlLayout,
      showHeroDragLabel: false,
      hintIconClass: realChar.locked ? 'fa-lock' : 'fa-theater-masks'
    };

    // Hero Mode: add hero sprite data for characters that have hero poses.
    // Characters without hero poses gracefully fall back to token rendering.
    if (isHeroMode && realChar.hasHeroPoses) {
      const heroHalfIndex = layoutMeta.heroHalfIndexById?.get(realChar.id) ?? 0;
      const heroHalfCount = layoutMeta.heroHalfCount ?? 1;
      const isHeroFull = (realChar.heroType || 'half') === 'full';

      charData.isHeroMode = true;
      charData.heroImage = realChar.heroImage;
      charData.heroType = realChar.heroType || 'half';
      charData.isHeroFull = isHeroFull;
      charData.canControlLayout = canControlLayout;
      charData.showHeroDragLabel = !isFreeform && !isHeroFull;
      charData.showDepthControls = isFreeform || charData.showHeroDragLabel;
      charData.heroHalfIndex = heroHalfIndex;
      charData.hintIconClass = realChar.locked
        ? 'fa-lock'
        : (!canControlLayout || !charData.showHeroDragLabel ? 'fa-hand-pointer' : 'fa-arrows-left-right');
      charData.positionStyle = isFreeform
        ? this._buildFreeformPositionStyle(
            scene,
            realChar.id,
            index,
            castCount,
            getDefaultHeroFullPosition(index, castCount)
          )
        : charData.isHeroFull
          ? this._buildHeroFullPositionStyle(scene, realChar.id, index, castCount)
          : this._buildHeroHalfPositionStyle(scene, realChar.id, heroHalfIndex, heroHalfCount);
    } else if (isFreeform) {
      charData.positionStyle = this._buildFreeformPositionStyle(scene, realChar.id, index, castCount);
    }

    return charData;
  }

  _buildLayoutToolbar(charData) {
    const toolbar = document.createElement('div');
    toolbar.className = 'es-hero-toolbar';

    if (charData.showHeroDragLabel) {
      const dragLabel = document.createElement('div');
      dragLabel.className = 'es-hero-toolbar__label';
      dragLabel.title = localize('PlayerView.DragHero');
      dragLabel.appendChild(document.createElement('i')).className = 'fa-solid fa-arrows-left-right';
      const dragText = document.createElement('span');
      dragText.textContent = localize('PlayerView.DragHero');
      dragLabel.appendChild(dragText);
      toolbar.appendChild(dragLabel);
    }

    if (charData.showDepthControls) {
      const moveBackward = document.createElement('button');
      moveBackward.type = 'button';
      moveBackward.className = 'es-hero-control es-hero-control--layer';
      moveBackward.dataset.action = 'move-hero-backward';
      moveBackward.title = localize('PlayerView.MoveHeroBackward');
      moveBackward.appendChild(document.createElement('i')).className = 'fa-solid fa-arrow-down';
      toolbar.appendChild(moveBackward);
    }

    const flipButton = document.createElement('button');
    flipButton.type = 'button';
    flipButton.className = 'es-flip-btn es-hero-control es-hero-control--flip';
    flipButton.dataset.action = 'flip-character';
    flipButton.title = localize('Config.Layouts.FlipCharacter');
    flipButton.appendChild(document.createElement('i')).className = 'fa-solid fa-right-left';
    toolbar.appendChild(flipButton);

    if (charData.showDepthControls) {
      const moveForward = document.createElement('button');
      moveForward.type = 'button';
      moveForward.className = 'es-hero-control es-hero-control--layer';
      moveForward.dataset.action = 'move-hero-forward';
      moveForward.title = localize('PlayerView.MoveHeroForward');
      moveForward.appendChild(document.createElement('i')).className = 'fa-solid fa-arrow-up';
      toolbar.appendChild(moveForward);
    }

    return toolbar;
  }

  _prepareTheaterPreviewLayoutContext(layoutScene) {
    const fallbackLayoutSettings = layoutScene?.layoutSettings || CONFIG.DEFAULT_LAYOUT;
    return this._handlers?.layout
      ? this._handlers.layout.prepareLayoutContext(layoutScene)
      : {
          preset: fallbackLayoutSettings.preset || 'bottom-center',
          size: CONFIG.SIZE_PRESETS[fallbackLayoutSettings.size || 'medium']?.value || CONFIG.SIZE_PRESETS.medium.value,
          shape: fallbackLayoutSettings.shape || 'circle',
          spacing: fallbackLayoutSettings.spacing || 24,
          offsetX: fallbackLayoutSettings.offsetX || 0,
          offsetY: fallbackLayoutSettings.offsetY || 5,
          displayMode: fallbackLayoutSettings.displayMode || 'token'
        };
  }

  _buildTheaterPreviewViewportStyle() {
    const stageWidth = Math.max(1, Math.round(window.innerWidth || document.documentElement?.clientWidth || 1280));
    const stageHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement?.clientHeight || 720));
    return `--es-preview-stage-width: ${stageWidth}px; --es-preview-stage-height: ${stageHeight}px;`;
  }

  _getTheaterPreviewBackgroundFitClass(backgroundFitMode = 'fill', bgType = 'image') {
    if (backgroundFitMode !== 'smart' || bgType === 'video') return '';

    const media = this.element?.querySelector('.es-pv-background .es-pv-bg-media');
    if (!(media instanceof HTMLImageElement)) return '';
    if (!Number.isFinite(media.naturalWidth) || !Number.isFinite(media.naturalHeight) || media.naturalHeight <= 0) return '';
    const imgAspect = media.naturalWidth / media.naturalHeight;
    const viewportAspect = window.innerWidth / window.innerHeight;
    const aspectDifference = Math.abs(imgAspect - viewportAspect) / Math.max(imgAspect, viewportAspect);
    return aspectDifference > 0.20 ? 'es-pv-background--smart-contain' : '';
  }

  _prepareTheaterShotContext(scene, shot, background, bgType, backgroundFitMode = 'fill') {
    const shotState = this._getSceneTheaterState(scene, shot.id);
    const layoutScene = shotState.layoutScene || scene;
    const isHeroMode = layoutScene?.layoutSettings?.displayMode === 'hero';
    const heroHalfMeta = this._buildHeroHalfLayoutMeta(shotState.castSource);
    const layoutMeta = {
      heroHalfCount: heroHalfMeta.count,
      heroHalfIndexById: heroHalfMeta.indexById
    };

    const previewLayout = this._prepareTheaterPreviewLayoutContext(layoutScene);
    const previewCast = shotState.castSource.map((charRef, index) =>
      this._prepareCastMemberContext(
        charRef,
        layoutScene,
        index,
        shotState.castSource.length,
        isHeroMode,
        layoutMeta
      )
    );

    const visibleIds = new Set(shot.characterIds || []);
    const characterToggles = (scene.cast || []).map(charRef => {
      const character = Store.characters.get(charRef.id);
      const name = character?.name || charRef.name || '';
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('');

      return {
        id: charRef.id,
        name,
        image: character?.image || charRef.image || '',
        visible: visibleIds.has(charRef.id),
        initials
      };
    });

    const countKey = previewCast.length === 1
      ? 'GMPanel.CharactersVisible'
      : 'GMPanel.CharactersVisiblePlural';

    return {
      id: shot.id,
      name: shot.name,
      background,
      bgType,
      backgroundFitMode,
      backgroundFitClass: this._getTheaterPreviewBackgroundFitClass(backgroundFitMode, bgType),
      isActive: this.uiState.activeTheaterShotId === shot.id,
      previewCast,
      previewLayout,
      previewViewportStyle: this._buildTheaterPreviewViewportStyle(),
      characterToggles,
      visibleCount: previewCast.length,
      visibleSummary: previewCast.length
        ? format(countKey, { count: previewCast.length })
        : localize('PlayerView.TheaterEmptyShot')
    };
  }

  /**
   * Build a character DOM node that mirrors the template structure.
   * Used by partial cast refreshes to avoid re-rendering the whole player view.
   *
   * @param {Object} charData - Template-ready character data
   * @returns {HTMLElement} Character element
   */
  _buildCharacterElement(charData) {
    const charDiv = document.createElement('div');
    const classes = ['es-pv-character'];
    if (charData.locked) classes.push('es-pv-character--locked');
    if (charData.isHeroMode) classes.push('es-pv-character--hero');
    if (charData.isHeroFull) classes.push('es-pv-character--hero-full');
    if (charData.canControlLayout) classes.push('es-pv-character--hero-controllable');
    charDiv.className = classes.join(' ');
    charDiv.dataset.id = charData.id;
    charDiv.dataset.action = 'character-click';
    charDiv.dataset.castIndex = String(charData.castIndex ?? 0);
    if (!charData.isHeroFull && Number.isInteger(charData.heroHalfIndex)) {
      charDiv.dataset.heroHalfIndex = String(charData.heroHalfIndex);
    }
    if (charData.positionStyle) charDiv.style.cssText = charData.positionStyle;
    charDiv.style.setProperty('--char-index', charData.castIndex ?? 0);

    if (charData.isHeroMode) {
      charDiv.title = localize('CharEditor.HeroPoses');

      const heroVisual = document.createElement('div');
      heroVisual.className = 'es-pv-hero-visual';

      const heroImg = document.createElement('img');
      heroImg.src = charData.heroImage;
      heroImg.className = 'es-pv-hero-sprite';
      heroImg.alt = charData.name;
      heroVisual.appendChild(heroImg);
      charDiv.appendChild(heroVisual);

      if (charData.canControlLayout) {
        charDiv.appendChild(this._buildLayoutToolbar(charData));
      }
    } else {
      const portrait = document.createElement('div');
      portrait.className = 'es-pv-portrait';
      portrait.dataset.effect = charData.borderStyle?.effect || CONFIG.BORDER_DEFAULT.effect;
      portrait.style.cssText = borderStyleToInline(charData.borderStyle);

      const imageSrc = charData.image;
      const isVideo = imageSrc && ['mp4', 'webm', 'ogg', 'mov'].includes(imageSrc.split('.').pop()?.toLowerCase());
      if (isVideo) {
        const video = document.createElement('video');
        video.src = imageSrc;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.disablePictureInPicture = true;
        applyMediaFocusToElement(video, charData.focus);
        portrait.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = charData.name;
        applyMediaFocusToElement(img, charData.focus);
        portrait.appendChild(img);
      }
      charDiv.appendChild(portrait);

      if (charData.canControlLayout && charData.showDepthControls) {
        charDiv.appendChild(this._buildLayoutToolbar(charData));
      }
    }

    if (charData.locked) {
      const lockIndicator = document.createElement('div');
      lockIndicator.className = 'es-pv-lock-indicator';
      lockIndicator.title = localize('PlayerView.LockedTooltip');
      lockIndicator.appendChild(document.createElement('i')).className = 'fas fa-lock';
      charDiv.appendChild(lockIndicator);
    }

    const hint = document.createElement('div');
    hint.className = 'es-pv-hint';
    const hintIcon = document.createElement('i');
    hintIcon.className = `fas ${charData.hintIconClass || 'fa-theater-masks'}`;
    hint.appendChild(hintIcon);
    charDiv.appendChild(hint);

    if (charData.showNameLabel !== false) {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'es-pv-name';
      nameDiv.textContent = charData.name;
      charDiv.appendChild(nameDiv);
    }

    return charDiv;
  }

  _getMainCastContainer(root = this.element) {
    const playerView = root?.querySelector('.es-player-view');
    if (playerView instanceof HTMLElement) {
      for (const child of playerView.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (!child.classList.contains('es-pv-cast')) continue;
        if (child.classList.contains('es-theater-shot__preview-cast')) continue;
        return child;
      }
    }

    return root?.querySelector('.es-pv-cast:not(.es-theater-shot__preview-cast)')
      || root?.querySelector('.es-pv-cast')
      || null;
  }

  _bindTheaterStrip() {
    const strip = this.element?.querySelector('.es-theater-strip');
    const handle = strip?.querySelector('[data-theater-drag-handle]');
    const resizeHandle = strip?.querySelector('[data-theater-resize-handle]');
    if (!strip || !handle || !game.user.isGM) return;

    const controller = new AbortController();
    const signal = controller.signal;
    this._theaterStripAbortController = controller;

    let isDragging = false;
    let dragPointerId = null;
    let isResizing = false;
    let resizePointerId = null;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let startHeight = 0;

    const getCurrentTop = () => {
      const inlineTop = Number.parseFloat(strip.style.top);
      return Number.isFinite(inlineTop) ? inlineTop : strip.getBoundingClientRect().top;
    };

    const persistStripLayout = () => {
      const scene = this.uiState.sceneId ? Store.scenes.get(this.uiState.sceneId) : null;
      if (!scene) return;

      const savedLeft = Number.parseFloat(strip.style.left);
      const savedTop = Number.parseFloat(strip.style.top);
      const savedHeight = Number.parseFloat(strip.style.height);

      setTheaterStripPosition(scene, {
        x: Number.isFinite(savedLeft) ? savedLeft : strip.offsetLeft,
        y: Number.isFinite(savedTop) ? savedTop : strip.offsetTop
      });
      setTheaterStripHeight(scene, Number.isFinite(savedHeight) ? savedHeight : null);
      Store.saveData();
    };

    const clampPosition = () => {
      const currentLeft = Number.parseFloat(strip.style.left);
      const currentTop = Number.parseFloat(strip.style.top);
      const nextLeft = Number.isFinite(currentLeft) ? currentLeft : strip.offsetLeft;
      const nextTop = Number.isFinite(currentTop) ? currentTop : strip.offsetTop;
      const clampedTop = Math.max(0, nextTop);

      const currentHeight = Number.parseFloat(strip.style.height);
      if (Number.isFinite(currentHeight)) {
        strip.style.height = `${this._clampTheaterStripHeight(currentHeight, clampedTop)}px`;
      }

      const maxLeft = Math.max(0, window.innerWidth - strip.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - strip.offsetHeight);

      strip.style.left = `${Math.max(0, Math.min(maxLeft, nextLeft))}px`;
      strip.style.top = `${Math.max(0, Math.min(maxTop, clampedTop))}px`;
    };

    clampPosition();
    window.addEventListener('resize', clampPosition, { signal });

    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();
      isDragging = true;
      dragPointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originLeft = strip.getBoundingClientRect().left;
      originTop = strip.getBoundingClientRect().top;
      strip.classList.add('es-theater-strip--dragging');
      handle.setPointerCapture(dragPointerId);
    }, { signal });

    window.addEventListener('pointermove', event => {
      if (isDragging && event.pointerId === dragPointerId) {
        const maxLeft = Math.max(0, window.innerWidth - strip.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - strip.offsetHeight);
        const nextLeft = Math.max(0, Math.min(maxLeft, originLeft + (event.clientX - startX)));
        const nextTop = Math.max(0, Math.min(maxTop, originTop + (event.clientY - startY)));
        strip.style.left = `${nextLeft}px`;
        strip.style.top = `${nextTop}px`;
        return;
      }

      if (!isResizing || event.pointerId !== resizePointerId) return;

      const nextHeight = this._clampTheaterStripHeight(
        startHeight + (event.clientY - startY),
        getCurrentTop()
      );
      if (nextHeight) {
        strip.style.height = `${nextHeight}px`;
      }
    }, { signal });

    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        isResizing = true;
        resizePointerId = event.pointerId;
        startY = event.clientY;
        startHeight = strip.getBoundingClientRect().height;
        strip.style.height = `${Math.round(startHeight)}px`;
        strip.classList.add('es-theater-strip--resizing');
        resizeHandle.setPointerCapture(resizePointerId);
      }, { signal });
    }

    const stopInteraction = event => {
      if (isDragging && event.pointerId === dragPointerId) {
        isDragging = false;
        strip.classList.remove('es-theater-strip--dragging');

        try {
          handle.releasePointerCapture(dragPointerId);
        } catch (_) {}
        dragPointerId = null;
        persistStripLayout();
        return;
      }

      if (!isResizing || event.pointerId !== resizePointerId) return;

      isResizing = false;
      strip.classList.remove('es-theater-strip--resizing');

      try {
        resizeHandle?.releasePointerCapture(resizePointerId);
      } catch (_) {}
      resizePointerId = null;
      persistStripLayout();
    };

    window.addEventListener('pointerup', stopInteraction, { signal });
    window.addEventListener('pointercancel', stopInteraction, { signal });
  }

  /**
   * Rebuild only the cast container, keeping the rest of the player view intact.
   *
   * @param {Object} scene - Scene whose cast should be rendered
   * @param {Object[]} [castSource] - Optional cast source override
   * @returns {boolean} True if the cast container was rebuilt
   */
  _rebuildCastContainer(scene, castSource = undefined) {
    const view = this.element;
    const castContainer = this._getMainCastContainer(view);
    if (!view || !scene || !castContainer) return false;

    const theaterState = this._getSceneTheaterState(scene);
    const activeCast = Array.isArray(castSource) ? castSource : theaterState.castSource;
    const layoutScene = Array.isArray(castSource)
      ? scene
      : (theaterState.layoutScene || scene);
    if (!Array.isArray(activeCast)) return false;

    const isHeroMode = layoutScene?.layoutSettings?.displayMode === 'hero';
    const heroHalfMeta = this._buildHeroHalfLayoutMeta(activeCast);
    const layoutMeta = {
      heroHalfCount: heroHalfMeta.count,
      heroHalfIndexById: heroHalfMeta.indexById
    };
    castContainer.replaceChildren();

    activeCast.forEach((charRef, index) => {
      const charData = this._prepareCastMemberContext(charRef, layoutScene, index, activeCast.length, isHeroMode, layoutMeta);
      castContainer.appendChild(this._buildCharacterElement(charData));
    });

    this._handlers?.media?.ensureVideoPlays();
    return true;
  }

  async _prepareContext(options) {
    const scene = this.uiState.sceneId
      ? (Store.ensureSceneAvailable(this.uiState.sceneId) || Store.scenes.get(this.uiState.sceneId))
      : null;
    const theaterState = (!this.uiState.castOnlyMode && !this.uiState.slideshowMode)
      ? this._syncActiveTheaterShot(scene)
      : {
          theaterMode: false,
          shots: [],
          activeShot: null,
          castSource: scene?.cast || [],
          positions: scene?.layoutSettings?.positions || {},
          layoutScene: scene
        };

    // Determine which cast to use:
    // - In cast-only mode: use castOnlyCharacterIds to build cast
    // - In slideshow mode: use the fixed slideshowCast (characters persist across all backgrounds)
    // - Otherwise: use the scene's cast
    let castSource;
    let layoutScene = theaterState.layoutScene || scene;
    if (this.uiState.castOnlyMode && this.uiState.castOnlyCharacterIds) {
      // Build cast from character IDs for cast-only mode
      castSource = this.uiState.castOnlyCharacterIds.map(id => {
        const char = Store.characters.get(id);
        return char ? { id: char.id, name: char.name, image: char.image } : null;
      }).filter(c => c !== null);
    } else if (this.uiState.slideshowMode && this.uiState.slideshowCast) {
      castSource = this.uiState.slideshowCast;
      layoutScene = scene;
    } else {
      castSource = theaterState.castSource;
      layoutScene = theaterState.layoutScene || scene;
    }

    // Determine display mode (hero vs token)
    const isHeroMode = layoutScene?.layoutSettings?.displayMode === 'hero';
    const heroHalfMeta = this._buildHeroHalfLayoutMeta(castSource);
    const layoutMeta = {
      heroHalfCount: heroHalfMeta.count,
      heroHalfIndexById: heroHalfMeta.indexById
    };

    // Prepare cast with current states and border styles
    const cast = castSource.map((charRef, i) =>
      this._prepareCastMemberContext(charRef, layoutScene, i, castSource.length, isHeroMode, layoutMeta)
    );

    // Add freeform position styles per character that still use defaults
    const isFreeform = layoutScene?.layoutSettings?.preset === 'freeform';
    if (isFreeform) {
      const castCount = cast.length;
      cast.forEach((c, i) => {
        if (c.positionStyle || !c.id) return;
        c.positionStyle = this._buildFreeformPositionStyle(layoutScene, c.id, i, castCount);
      });
    }

    // Prepare Emotion Picker Context
    let pickerContext = null;
    if (this.uiState.emotionPicker.open && this.uiState.emotionPicker.characterId) {
      const char = Store.characters.get(this.uiState.emotionPicker.characterId);
      if (char) {
        const favoriteEmotions = char.favoriteEmotions || new Set();
        const pickerHeroMode = this.uiState.emotionPicker.isHeroMode && char.hasHeroPoses;

        // Hero mode: show hero poses instead of token emotions
        let emotions;
        let currentStateKey;
        if (pickerHeroMode) {
          emotions = Object.entries(char.heroStates).map(([key, data]) => ({
            key,
            path: data.img,
            isFavorite: favoriteEmotions.has(key),
            heroPoseType: data.type || 'half',
            isHeroFull: data.type === 'full'
          }));
          currentStateKey = char.currentHeroState || Object.keys(char.heroStates)[0];
        } else {
          emotions = Object.entries(char.states).map(([key, path]) => ({
            key,
            path,
            focusStyle: mediaFocusToInlineStyle(char.getStateFocus(key)),
            isFavorite: favoriteEmotions.has(key)
          }));
          currentStateKey = char.currentState;
        }

        // Sort: favorites first, then alphabetically
        emotions.sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.key.localeCompare(b.key);
        });

        // Check for linked Actor (only show if user can view it)
        let linkedActor = null;
        if (char.actorId) {
          const actor = game.actors.get(char.actorId);
          if (actor && actor.testUserPermission(game.user, "LIMITED")) {
            linkedActor = { id: actor.id, name: actor.name };
          }
        }

        pickerContext = {
          character: { ...char, currentState: currentStateKey },
          emotions: emotions,
          x: this.uiState.emotionPicker.x,
          y: this.uiState.emotionPicker.y,
          locked: char.locked || false,
          pickerBelow: this.uiState.emotionPicker.pickerBelow || false,
          linkedActor: linkedActor,
          openActorTitle: linkedActor ? format('Picker.OpenActorSheet', { name: linkedActor.name }) : '',
          hasMusicPlaylist: (char.music?.playlists?.length > 0) || !!char.musicPlaylistId,
          canEditBorder: pickerHeroMode ? false : (game.user.isGM || char.hasPermission(game.user.id, 'full')),
          isHeroMode: pickerHeroMode,
          pickerModeLabel: localize(pickerHeroMode ? 'CharEditor.HeroPoses' : 'CharEditor.Emotions'),
          pickerModeIcon: pickerHeroMode ? 'fa-person' : 'fa-theater-masks',
          pickerCount: emotions.length,
          activeStateLabel: currentStateKey || localize(pickerHeroMode ? 'CharEditor.NoHeroPosesYet' : 'CharEditor.NoEmotionsYet')
        };
      }
    }

    // Prepare Border Picker Context
    // Delegate to BorderPickerHandler for organizing presets by type
    const borderPickerContext = this._handlers?.borderPicker
      ? this._handlers.borderPicker.prepareBorderPickerContext()
      : null;

    // Prepare Music Picker Context
    let musicPickerContext = null;
    if (this.uiState.musicPicker.open && this.uiState.musicPicker.characterId) {
      const char = Store.characters.get(this.uiState.musicPicker.characterId);
        const playlists = char?.music?.playlists || (char?.musicPlaylistId ? [char.musicPlaylistId] : []);
        if (char && playlists.length > 0) {
          const playlistDetails = playlists.map(playlistId => ({
            id: playlistId,
            name: NarratorJukeboxIntegration.getPlaylistName(playlistId, char.music?.playlistNames?.[playlistId])
          }));

        // Aggregate tracks from all assigned playlists
        let allTracks = [];
        for (const playlist of playlistDetails) {
          const tracks = NarratorJukeboxIntegration.getPlaylistTracks(playlist.id);
          allTracks = allTracks.concat(tracks.map(t => ({
            ...t,
            playlistId: playlist.id,
            playlistName: playlist.name
          })));
        }

        const searchQuery = this.uiState.musicPicker.searchQuery || '';
        const normalizedSearchQuery = searchQuery.trim().toLowerCase();
        const filteredTrackCount = normalizedSearchQuery
          ? allTracks.filter(track => {
              const trackName = track.name?.toLowerCase() || '';
              const playlistName = track.playlistName?.toLowerCase() || '';
              return trackName.includes(normalizedSearchQuery) || playlistName.includes(normalizedSearchQuery);
            }).length
          : allTracks.length;

        const playlistCount = playlists.length;
        const playlistLabel = playlistCount === 1
          ? (playlistDetails[0]?.name || '')
          : format('MusicPicker.PlaylistCount', { count: playlistCount });

        musicPickerContext = {
          character: char,
          playlistName: playlistLabel,
          tracks: allTracks,
          playlistCount: playlistCount,
          totalTracks: allTracks.length,
          filteredTrackCount: filteredTrackCount,
          hasVisibleTracks: filteredTrackCount > 0,
          hasSearch: allTracks.length > 5,
          isFiltered: !!normalizedSearchQuery,
          searchQuery: searchQuery,
          showPlaylistOrigin: playlistCount > 1,
          x: this.uiState.musicPicker.x,
          y: this.uiState.musicPicker.y,
          pickerBelow: this.uiState.musicPicker.pickerBelow || false,
          addMode: this.uiState.musicPicker.addMode || false,
          canAddYouTube: NarratorJukeboxIntegration.isAvailable && playlists.length > 0
        };
      }
    }

    // Determine the correct background to display
    // If we're in a sequence and have a stored sequence background, use that instead of scene.background
    let background = scene?.background;
    let bgType = scene?.bgType;

    if (this.uiState.sequenceBackground) {
      background = this.uiState.sequenceBackground.path;
      bgType = this.uiState.sequenceBackground.bgType;
    }

    // Prepare layout settings with CSS-ready values
    // Delegate to LayoutCalculator handler
    const fallbackLayoutSettings = this.uiState.castOnlyMode && this.uiState.castOnlyLayoutSettings
      ? this.uiState.castOnlyLayoutSettings
      : (layoutScene?.layoutSettings || CONFIG.DEFAULT_LAYOUT);
    const fallbackSizePresets = this.uiState.castOnlyMode
      ? (CONFIG.CAST_ONLY_SIZE_PRESETS || CONFIG.SIZE_PRESETS)
      : CONFIG.SIZE_PRESETS;
    const layoutContext = this._handlers?.layout
      ? this._handlers.layout.prepareLayoutContext(layoutScene)
      : {
          preset: 'bottom-center',
          size: fallbackSizePresets[fallbackLayoutSettings.size || 'medium']?.value || fallbackSizePresets.medium?.value || CONFIG.SIZE_PRESETS.medium.value,
          spacing: 24,
          offsetX: 0,
          offsetY: 5
        };

    // Determine background fit mode
    // Priority: scene override > global setting > default 'fill'
    let backgroundFitMode = 'fill';
    if (scene?.backgroundFit) {
      backgroundFitMode = scene.backgroundFit;
    } else {
      try {
        const globalFitMode = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.BACKGROUND_FIT_MODE);
        if (globalFitMode) {
          backgroundFitMode = globalFitMode;
        }
      } catch (e) {
        // Setting not registered yet, use default
      }
    }

    // Prepare audio panel context (GM only, delegated to AudioPanelHandler)
    const audioPanel = this._handlers.audioPanel.prepareContext(scene);

    let theaterContext = null;
    if (game.user.isGM && theaterState.theaterMode && scene) {
      const theaterPosition = getTheaterStripPosition(scene, this._getDefaultTheaterStripPosition());
      const storedTheaterHeight = getTheaterStripHeight(scene);
      theaterContext = {
        activeShotId: theaterState.activeShot?.id || null,
        position: theaterPosition,
        height: Number.isFinite(storedTheaterHeight)
          ? this._clampTheaterStripHeight(storedTheaterHeight, theaterPosition.y)
          : null,
        shots: theaterState.shots.map(shot => this._prepareTheaterShotContext(scene, shot, background, bgType, backgroundFitMode))
      };
    }

    return {
      active: this.uiState.active,
      scene: scene ? {
        ...scene.toJSON(),
        background: background,
        bgType: bgType
      } : null,
      cast: cast,
      isGM: game.user.isGM,
      emotionPicker: pickerContext,
      borderPicker: borderPickerContext,
      musicPicker: musicPickerContext,
      layout: layoutContext,
      // Free Composition mode flag (GM or players with setting enabled)
      isGMFreeform: isFreeform && (game.user.isGM || isPlayerLayoutControlEnabled()),
      // Hero mode layout controls
      isHeroLayoutEnabled: isHeroMode && (game.user.isGM || isPlayerLayoutControlEnabled()),
      // Cast-Only Mode flag
      castOnlyMode: this.uiState.castOnlyMode,
      // Preview Mode flags
      previewMode: this.uiState.previewMode,
      previewType: this.uiState.previewType,
      theater: theaterContext,
      isTheaterMode: theaterState.theaterMode,
      // Background Fit Mode
      backgroundFitMode: backgroundFitMode,
      // Audio panel (GM only, from AudioPanelHandler)
      audioPanel: audioPanel,
      // Cinematic Bars (slideshow letterbox effect)
      cinematicMode: this.uiState.cinematicMode,
      // Hero Mode (display transparent sprites instead of bordered tokens)
      isHeroMode: isHeroMode
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onCharacterClick(event, target) {
    // Skip if a freeform drag just completed (prevent click after drag)
    if (this._handlers?.freePosition?._justDragged) {
      this._handlers.freePosition._justDragged = false;
      return;
    }

    const fallbackTarget = target instanceof HTMLElement
      ? target.closest('.es-pv-character') || target
      : null;
    const resolvedTarget = resolveCharacterElementAtPoint(this.element, event?.clientX, event?.clientY)
      ?? fallbackTarget;
    if (!(resolvedTarget instanceof HTMLElement)) return;

    const charId = resolvedTarget.dataset.id;
    if (!charId) return;
    const character = Store.characters.get(charId);

    // Check if character is locked and user is not GM
    if (character?.locked && !game.user.isGM) {
      ui.notifications.warn(formatCharacterNotification(
        character,
        'Notifications.CharacterLocked',
        'Notifications.CharacterLockedHidden'
      ));
      return;
    }

    // Check permission level (GM always has access)
    if (!game.user.isGM && character) {
      const hasPermission = character.hasPermission(game.user.id, 'emotion');
      if (!hasPermission) {
        ui.notifications.warn(formatCharacterNotification(
          character,
          'Notifications.NoPermissionEdit',
          'Notifications.NoPermissionEditHidden'
        ));
        return;
      }
    }

    const isHeroSprite = resolvedTarget.classList.contains('es-pv-character--hero');
    const anchor = buildPopoverAnchorFromElement(resolvedTarget, isHeroSprite ? {
      mode: 'hero-face',
      heroFocalRatio: 0.3
    } : {});
    const showBelow = anchor?.preferBelow ?? false;
    const pickerX = anchor?.anchorX ?? 0;
    const pickerY = showBelow
      ? (anchor?.anchorBelowY ?? 0)
      : (anchor?.anchorAboveY ?? 0);

    // Position picker above or below character depending on position
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: pickerX,
      y: pickerY,
      pickerBelow: showBelow,
      isHeroMode: isHeroSprite,
      anchor: clonePopoverAnchor(anchor)
    };
    this.uiState.isSceneTransition = false; // Defensive: never re-trigger entrance animations
    this.render();
  }

  static _onClosePicker(event, target) {
    this.uiState.emotionPicker.open = false;
    this.uiState.isSceneTransition = false; // Defensive: never re-trigger entrance animations
    this.render();
  }

  static _onSelectEmotion(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;
    const isHeroMode = this.uiState.emotionPicker.isHeroMode;

    // Update character state locally FIRST to prevent race conditions
    const character = Store.characters.get(charId);
    if (character) {
      if (isHeroMode) {
        character.currentHeroState = state;
      } else {
        character.currentState = state;
      }
    }

    // Close picker state
    this.uiState.emotionPicker.open = false;
    this.uiState.isSceneTransition = false; // Defensive: never re-trigger entrance animations

    // Remove picker from DOM directly (avoids a full render which causes a flash
    // when all character portraits are rebuilt). The uiState is already updated
    // so the next render (from any source) will correctly not show the picker.
    const picker = this.element?.querySelector('.es-emotion-picker');
    if (picker) picker.remove();

    // Smooth character portrait update with crossfade transition
    ExaltedScenesPlayerView.refreshCharacter(charId);

    // Emit to other clients and persist (GM saves).
    // _onUpdateEmotion will also call refreshCharacter locally, which is harmless
    // since the character state is already updated and the image src matches.
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
        SocketHandler.emitUpdateEmotion(charId, state, isHeroMode);
    }).catch(e => console.error('Exalted Scenes | Failed to load SocketHandler:', e));
  }

  static _onToggleEmotionFavorite(event, target) {
    event.stopPropagation();
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;
    const character = Store.characters.get(charId);

    if (character && state) {
      if (character.favoriteEmotions.has(state)) {
        character.favoriteEmotions.delete(state);
      } else {
        character.favoriteEmotions.add(state);
      }
      Store.saveData();
      this.uiState.isSceneTransition = false; // Defensive: never re-trigger entrance animations
      this.render();
    }
  }

  /**
   * Removes a character from the current scene (GM only).
   * Handles normal scene mode, cast-only mode, and slideshow mode.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onRemoveFromScene(event, target) {
    // Safety check: only GM can remove characters
    if (!game.user.isGM) {
      ui.notifications.warn(localize('Notifications.GMOnlyRemove'));
      return;
    }

    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    const characterName = character?.name || 'Character';

    // Handle different modes
    if (this.uiState.castOnlyMode) {
      // Cast-Only Mode: remove from the character IDs array
      const index = this.uiState.castOnlyCharacterIds.indexOf(charId);
      if (index > -1) {
        this.uiState.castOnlyCharacterIds.splice(index, 1);

        // Emit socket update so all clients see the removal
        import('../data/SocketHandler.js').then(({ SocketHandler }) => {
          SocketHandler.emitCastOnlyUpdate({ characterIds: this.uiState.castOnlyCharacterIds, layoutSettings: this.uiState.castOnlyLayoutSettings });
        }).catch(e => console.error('Exalted Scenes | Failed to load SocketHandler:', e));
      }
    } else if (this.uiState.sceneId) {
      // Normal scene mode or slideshow mode: remove from scene cast
      Store.removeCastMember(this.uiState.sceneId, charId);

      // If in slideshow mode, also update the slideshow cast
      if (this.uiState.slideshowMode && this.uiState.slideshowCast) {
        const index = this.uiState.slideshowCast.findIndex(c => c.id === charId);
        if (index > -1) {
          this.uiState.slideshowCast.splice(index, 1);
        }
      }
    }

    // Close picker and refresh
    this.uiState.emotionPicker.open = false;
    this.render();

    ui.notifications.info(format('Notifications.CharacterRemoved', { name: characterName }));
  }

  /**
   * Opens the linked Actor's character sheet.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onOpenActorSheet(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    if (!character?.actorId) return;

    const actor = game.actors.get(character.actorId);
    if (actor) {
      // Check permission before opening
      if (actor.testUserPermission(game.user, "LIMITED")) {
        actor.sheet.render(true);
      } else {
        ui.notifications.warn(localize('Notifications.NoPermissionSheet'));
      }
    } else {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PREVIEW MODE ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Broadcasts the currently previewed scene to all players.
   * Transitions from preview mode to live broadcast.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onGoLive(event, target) {
    if (!game.user.isGM || !this.uiState.previewMode) return;

    const sceneId = this.uiState.sceneId;
    if (!sceneId) return;
    const theaterShotId = this.uiState.activeTheaterShotId;

    // Exit preview mode
    this.uiState.previewMode = false;
    this.uiState.previewType = null;

    // Now actually broadcast to everyone
    const { SocketHandler } = await import('../data/SocketHandler.js');
    Store.setActiveScene(sceneId);
    SocketHandler.emitBroadcastScene(sceneId, theaterShotId);
    ui.notifications.info(localize('Notifications.SceneNowLive'));

    // Trigger Narrator Jukebox audio if configured
    const scene = Store.scenes.get(sceneId);
    if (scene?.hasAudio) {
      await NarratorJukeboxIntegration.playSceneAudio(scene);
    }

    this.render();
  }

  /**
   * Exits preview mode without broadcasting.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onExitPreview(event, target) {
    if (!this.uiState.previewMode) return;

    // Reset preview state
    this.uiState.previewMode = false;
    this.uiState.previewType = null;
    this.uiState.active = false;
    this.uiState.sceneId = null;
    this.uiState.activeTheaterShotId = null;

    this.render();
  }

  static async _onActivateTheaterShot(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) return;

    const shotId = target.dataset.shotId || target.closest('[data-shot-id]')?.dataset.shotId;
    if (!shotId || !this.uiState.sceneId) return;

    const sceneId = this.uiState.sceneId;
    const switched = this.constructor.activateTheaterShot(sceneId, shotId);
    if (!switched) return;

    if (!this.uiState.previewMode) {
      const { SocketHandler } = await import('../data/SocketHandler.js');
      SocketHandler.emitActivateTheaterShot(sceneId, shotId);
    }
  }

  static _onAddTheaterShot(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM || !this.uiState.sceneId) return;

    const scene = Store.scenes.get(this.uiState.sceneId);
    if (!scene) return;

    addTheaterShot(scene, {
      name: `Shot ${ensureTheaterShots(scene).length + 1}`
    });
    Store.saveData();
    this.uiState.isSceneTransition = false;
    this.render();
  }

  static _onToggleTheaterCharacter(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM || !this.uiState.sceneId) return;

    const shotId = target.dataset.shotId;
    const characterId = target.dataset.characterId;
    if (!shotId || !characterId) return;

    const scene = Store.scenes.get(this.uiState.sceneId);
    if (!scene || !isSceneTheaterMode(scene)) return;

    const sceneCastOrder = new Map((scene.cast || []).map((charRef, index) => [charRef.id, index]));
    const updatedShot = replaceTheaterShot(scene, shotId, shot => {
      const visible = new Set(shot.characterIds || []);
      if (visible.has(characterId)) {
        visible.delete(characterId);
      } else {
        visible.add(characterId);
      }

      return {
        ...shot,
        characterIds: Array.from(visible).sort((left, right) => {
          return (sceneCastOrder.get(left) ?? 9999) - (sceneCastOrder.get(right) ?? 9999);
        })
      };
    });

    if (!updatedShot) return;

    Store.saveData();
    this.uiState.isSceneTransition = false;
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     BORDER PICKER ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onOpenBorderPicker(event, target) {
    // Switch from emotion picker to border picker (keep same position and character)
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.emotionPicker.anchor);
    const char = Store.characters.get(charId);

    this.uiState.emotionPicker.open = false;
    this.uiState.borderPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      currentStyle: foundry.utils.deepClone(char?.borderStyle || CONFIG.BORDER_DEFAULT),
      anchor: anchor
    };
    this.render();
  }

  static _onCloseBorderPicker(event, target) {
    this.uiState.borderPicker.open = false;
    this.uiState.borderPicker.currentStyle = null;
    this.render();
  }

  static _onBackToEmotions(event, target) {
    // Switch back from border picker to emotion picker
    const charId = this.uiState.borderPicker.characterId;
    const x = this.uiState.borderPicker.x;
    const y = this.uiState.borderPicker.y;
    const pickerBelow = this.uiState.borderPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.borderPicker.anchor);

    this.uiState.borderPicker.open = false;
    this.uiState.borderPicker.currentStyle = null;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      anchor: anchor
    };
    this.render();
  }

  static _onSelectEffect(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const effectKey = target.dataset.effect;
    const borderHandler = this._handlers?.borderPicker;
    const currentBorder = borderHandler
      ? borderHandler.getPickerBorderStyle(charId)
      : (Store.characters.get(charId)?.borderStyle || { ...CONFIG.BORDER_DEFAULT });
    const newBorder = borderHandler
      ? borderHandler.setPickerBorderStyle({ ...currentBorder, effect: effectKey })
      : { ...currentBorder, effect: effectKey };

    ExaltedScenesPlayerView._applyLocalBorderUpdate(charId, newBorder);
    ExaltedScenesPlayerView._emitBorderUpdate(charId, newBorder);
    this._positionOpenPopovers();
  }

  static _onSelectBorderColor(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const color = target.dataset.color;
    const borderHandler = this._handlers?.borderPicker;
    const currentBorder = borderHandler
      ? borderHandler.getPickerBorderStyle(charId)
      : (Store.characters.get(charId)?.borderStyle || { ...CONFIG.BORDER_DEFAULT });
    const newBorder = borderHandler
      ? borderHandler.setPickerBorderStyle({ ...currentBorder, color })
      : { ...currentBorder, color };

    ExaltedScenesPlayerView._applyLocalBorderUpdate(charId, newBorder);
    ExaltedScenesPlayerView._emitBorderUpdate(charId, newBorder);
  }

  static _onSelectBorderColor2(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const color2 = target.dataset.color;
    const borderHandler = this._handlers?.borderPicker;
    const currentBorder = borderHandler
      ? borderHandler.getPickerBorderStyle(charId)
      : (Store.characters.get(charId)?.borderStyle || { ...CONFIG.BORDER_DEFAULT });
    const newBorder = borderHandler
      ? borderHandler.setPickerBorderStyle({ ...currentBorder, color2 })
      : { ...currentBorder, color2 };

    ExaltedScenesPlayerView._applyLocalBorderUpdate(charId, newBorder);
    ExaltedScenesPlayerView._emitBorderUpdate(charId, newBorder);
  }

  static _applyLocalBorderUpdate(charId, borderStyle) {
    const character = Store.characters.get(charId);
    if (!character) return;

    character.borderStyle = foundry.utils.deepClone(borderStyle || CONFIG.BORDER_DEFAULT);
    this.refreshCharacterBorder(charId, character.borderStyle);
  }

  static _emitBorderUpdate(charId, borderStyle) {
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
      SocketHandler.emitUpdateBorder(charId, borderStyle);
    }).catch(e => console.error('Exalted Scenes | Failed to load SocketHandler:', e));
  }

  /* ═══════════════════════════════════════════════════════════════
     MUSIC REQUEST ACTIONS (Player Music Request Feature)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Open the music picker for a character
   */
  static _onOpenMusicPicker(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;
    const isHeroMode = this.uiState.emotionPicker.isHeroMode || false;
    const anchor = clonePopoverAnchor(this.uiState.emotionPicker.anchor);

    // Close emotion picker and open music picker
    this.uiState.emotionPicker.open = false;
    this.uiState.musicPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      searchQuery: '',
      addMode: false,
      isHeroMode: isHeroMode,
      anchor: anchor
    };
    this.render();
  }

  /**
   * Close the music picker
   */
  static _onCloseMusicPicker(event, target) {
    this.uiState.musicPicker.open = false;
    this.render();
  }

  /**
   * Go back to emotion picker from music picker
   */
  static _onBackToEmotionsFromMusic(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const x = this.uiState.musicPicker.x;
    const y = this.uiState.musicPicker.y;
    const pickerBelow = this.uiState.musicPicker.pickerBelow;
    const isHeroMode = this.uiState.musicPicker.isHeroMode || false;
    const anchor = clonePopoverAnchor(this.uiState.musicPicker.anchor);

    this.uiState.musicPicker.open = false;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      isHeroMode: isHeroMode,
      anchor: anchor
    };
    this.render();
  }

  /**
   * Request a track from the character's playlist
   */
  static _onRequestTrack(event, target) {
    const trackId = target.dataset.trackId;
    const trackName = target.dataset.trackName;
    const charId = this.uiState.musicPicker.characterId;

    const char = Store.characters.get(charId);
    if (!char) return;

    // Import SocketHandler dynamically to avoid circular dependencies
    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
      SocketHandler.emitMusicRequest(charId, char.name, trackId, trackName);
    }).catch(e => console.error('Exalted Scenes | Failed to load SocketHandler:', e));

    // Show feedback to the player
    ui.notifications.info(format('Notifications.MusicRequestSentTrack', { track: trackName }));

    // Close the music picker
    this.uiState.musicPicker.open = false;
    this.render();
  }

  /**
   * Toggle the music picker between browse mode and YouTube add mode.
   */
  static _onToggleAddMode(event, target) {
    this.uiState.musicPicker.addMode = !this.uiState.musicPicker.addMode;
    this.render();
  }

  /**
   * Submit a YouTube music add request from the add mode form.
   */
  static async _onSubmitYouTubeAdd(event, target) {
    const form = this.element.querySelector('.es-music-picker__add-form');
    const trackName = form?.querySelector('[name="track-name"]')?.value?.trim();
    const trackUrl = form?.querySelector('[name="track-url"]')?.value?.trim();

    if (!trackName || !trackUrl) {
      ui.notifications.warn(localize('MusicPicker.AddRequiredFields'));
      return;
    }

    if (!trackUrl.match(/(?:youtube\.com|youtu\.be)/i)) {
      ui.notifications.warn(localize('MusicPicker.AddInvalidUrl'));
      return;
    }

    const normalizedTrackUrl = normalizeYouTubeUrl(trackUrl);
    const validation = await validateYouTubeEmbed(normalizedTrackUrl);
    if (!validation.ok && (validation.reason === 'invalid-url' || isYouTubeEmbedBlockedCode(validation.code))) {
      const key = validation.reason === 'invalid-url'
        ? 'MusicPicker.AddInvalidUrl'
        : 'MusicPicker.AddYouTubeBlocked';
      const message = validation.reason === 'invalid-url'
        ? localize(key)
        : format(key, { code: validation.code ?? 'unknown' });
      ui.notifications.warn(message);
      return;
    }

    if (!validation.ok) {
      ui.notifications.warn(localize('MusicPicker.AddValidationUnavailable'));
    }

    const charId = this.uiState.musicPicker.characterId;
    const char = Store.characters.get(charId);
    if (!char) return;

    const playlistId = char.music?.playlists?.[0] || char.musicPlaylistId;
    if (!playlistId) return;

    import('../data/SocketHandler.js').then(({ SocketHandler }) => {
      SocketHandler.emitMusicAddRequest(charId, char.name, playlistId, trackName, normalizedTrackUrl);
    }).catch(e => console.error('Exalted Scenes | Failed to load SocketHandler:', e));

    ui.notifications.info(format('Notifications.MusicAddRequestSent', { track: trackName }));
    this.uiState.musicPicker.open = false;
    this.uiState.musicPicker.addMode = false;
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     AUDIO RESTORE ACTIONS (GM Only - Narrator Jukebox Integration)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Restore the scene's linked playlist / soundtrack.
   * Delegates to AudioPanelHandler.
   */
  static async _onRestorePlaylist(event, target) {
    if (!game.user.isGM) return;
    await this._handlers.audioPanel.restorePlaylist();
  }

  /**
   * Restore the scene's linked ambience preset / layers.
   * Delegates to AudioPanelHandler.
   */
  static async _onRestoreAmbience(event, target) {
    if (!game.user.isGM) return;
    await this._handlers.audioPanel.restoreAmbience();
  }

  /**
   * Stop all audio (music and ambience).
   * Delegates to AudioPanelHandler.
   */
  static async _onStopAllAudio(event, target) {
    if (!game.user.isGM) return;
    await this._handlers.audioPanel.stopAll();
  }

  /**
   * Play a soundboard sound.
   * Delegates to AudioPanelHandler.
   */
  static async _onPlaySoundboardSound(event, target) {
    if (!game.user.isGM) return;
    const soundId = target.dataset.soundId;
    if (soundId) await this._handlers.audioPanel.playSoundboardSound(soundId);
  }

  /**
   * Toggle the audio mixer panel.
   * Delegates to AudioPanelHandler.
   */
  static _onToggleMixer(event, target) {
    if (!game.user.isGM) return;
    this._handlers.audioPanel.toggleMixer();
  }

  /**
   * Flip a character horizontally. Works in both freeform and hero mode.
   */
  static _onFlipCharacter(event, target) {
    event.stopPropagation();
    const charEl = target.closest('.es-pv-character');
    if (!charEl) return;
    const charId = charEl.dataset.id;
    this._handlers?.freePosition?.flipCharacter(charId);
  }

  /**
   * Move a hero sprite one layer backward.
   */
  static _onMoveHeroBackward(event, target) {
    event.stopPropagation();
    const charEl = target.closest('.es-pv-character');
    if (!charEl) return;
    this._handlers?.freePosition?.moveHeroLayer(charEl.dataset.id, -1);
  }

  /**
   * Move a hero sprite one layer forward.
   */
  static _onMoveHeroForward(event, target) {
    event.stopPropagation();
    const charEl = target.closest('.es-pv-character');
    if (!charEl) return;
    this._handlers?.freePosition?.moveHeroLayer(charEl.dataset.id, 1);
  }

  /**
   * DOM-only update of character positions for smooth player-side transitions.
   * Called by SocketHandler when receiving position updates from GM.
   * @param {Object} positions - Map of { characterId: { x, y, scale, flipped } }
   */
  static updateCharacterPositions(positions) {
    if (!this._instance?.element) return;
    const castEl = this._instance._getMainCastContainer?.(this._instance.element);
    if (!castEl) return;

    const isFreeform = castEl.dataset.preset === 'freeform';
    const isHero = castEl.dataset.displayMode === 'hero';
    if (!isFreeform && !isHero) return;

    for (const [charId, pos] of Object.entries(positions)) {
      const charEl = castEl.querySelector(`.es-pv-character[data-id="${charId}"]`);
      if (!charEl) continue;
      if (charEl.classList.contains('es-dragging')) continue;

      const isHeroFull = charEl.classList.contains('es-pv-character--hero-full');
      const isHeroHalf = isHero && !isHeroFull;

      if (isFreeform || isHeroFull) {
        // Full position update (freeform + full body hero)
        charEl.classList.add('es-transitioning');
        charEl.style.setProperty('--char-x', `${pos.x}%`);
        charEl.style.setProperty('--char-y', `${pos.y}%`);
        charEl.style.setProperty('--char-scale', pos.scale);
        charEl.style.zIndex = getFreeformZIndex(pos);
      } else if (isHeroHalf) {
        charEl.classList.add('es-transitioning');
        if (isValidHeroHalfX(pos.x)) {
          charEl.style.setProperty('--char-x', `${clampHeroHalfX(pos.x)}%`);
        }
        if (Number.isFinite(Number(pos.scale))) {
          charEl.style.setProperty('--char-scale', pos.scale);
        }
        charEl.style.zIndex = getHeroHalfZIndex(pos.layer);
      }

      // Flip applies to all modes
      if (pos.flipped) {
        charEl.style.setProperty('--char-flipped', '-1');
      } else {
        charEl.style.removeProperty('--char-flipped');
      }

      // Remove transition class after animation (freeform + full body hero)
      if (isFreeform || isHeroFull || isHeroHalf) {
        setTimeout(() => charEl.classList.remove('es-transitioning'), 450);
      }
    }

  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API & SOCKET HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  static _resolveTheaterShotId(sceneId, preferredShotId = null) {
    const scene = sceneId ? Store.scenes.get(sceneId) : null;
    if (!scene || !isSceneTheaterMode(scene)) return null;
    return getTheaterShot(scene, preferredShotId)?.id || null;
  }

  static activateTheaterShot(sceneId, shotId) {
    if (!this._instance || !this._instance.uiState.active) return false;
    if (this._instance.uiState.sceneId !== sceneId) return false;

    const resolvedShotId = this._resolveTheaterShotId(sceneId, shotId);
    if (!resolvedShotId) return false;
    if (this._instance.uiState.activeTheaterShotId === resolvedShotId) return true;

    this._instance.uiState.activeTheaterShotId = resolvedShotId;
    this._instance.uiState.isSceneTransition = false;
    this._instance.render();
    return true;
  }

  /**
   * Activate the player view with a scene.
   * Creates instance if needed and triggers render.
   * @param {string} sceneId - The scene ID to display
   */
  static activate(sceneId, options = {}) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Detectar se é uma nova cena (transição) ou apenas um refresh
    const isNewScene = this._instance.uiState.sceneId !== sceneId;
    const preferredShotId = options.theaterShotId ?? (isNewScene ? null : this._instance.uiState.activeTheaterShotId);

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = isNewScene; // Só anima se for cena diferente
    this._instance.uiState.sequenceBackground = null; // Clear sequence background when activating a regular scene
    this._instance.uiState.previewMode = false;
    this._instance.uiState.previewType = null;
    this._instance.uiState.castOnlyMode = false;
    this._instance.uiState.activeTheaterShotId = this._resolveTheaterShotId(sceneId, preferredShotId);

    // Signal fullscreen broadcast (for MCD canvas hiding optimization)
    document.body.classList.add('es-broadcast-active');

    this._instance.render(true);
  }

  /**
   * Activate the player view in PREVIEW MODE (GM only, no socket broadcast).
   * The scene is displayed only to the GM until they click "Go Live".
   * @param {string} sceneId - The scene ID to preview
   * @param {string} previewType - Type of content being previewed ('scene', 'slideshow', 'sequence', 'cast-only')
   */
  static activatePreview(sceneId, previewType = 'scene', options = {}) {
    if (!game.user.isGM) return; // Only GM can preview

    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    const isNewScene = this._instance.uiState.sceneId !== sceneId;
    const preferredShotId = options.theaterShotId ?? (isNewScene ? null : this._instance.uiState.activeTheaterShotId);

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = isNewScene;
    this._instance.uiState.sequenceBackground = null;
    this._instance.uiState.activeTheaterShotId = this._resolveTheaterShotId(sceneId, preferredShotId);
    this._instance.uiState.castOnlyMode = false;

    // Set preview mode flags
    this._instance.uiState.previewMode = true;
    this._instance.uiState.previewType = previewType;

    // Signal fullscreen broadcast (for MCD canvas hiding optimization)
    document.body.classList.add('es-broadcast-active');

    this._instance.render(true);
  }

  /**
   * Deactivate the player view with closing animation.
   */
  static deactivate() {
    if (this._instance && this._instance.uiState.active) {
      // Remove broadcast class early so canvas becomes visible during close animation
      document.body.classList.remove('es-broadcast-active');

      const transitionHandler = this._instance._handlers?.transition;

      // Use transition handler for closing animation if available
      if (transitionHandler) {
        const animated = transitionHandler.animateClose(() => {
          this._instance.uiState.active = false;
          this._instance.uiState.sceneId = null;
          this._instance.uiState.sequenceBackground = null;
          this._instance.uiState.activeTheaterShotId = null;
          this._instance.render();
        });

        if (animated) return;
      }

      // Fallback if no handler or element
      this._instance.uiState.active = false;
      this._instance.uiState.sceneId = null;
      this._instance.uiState.sequenceBackground = null;
      this._instance.uiState.activeTheaterShotId = null;
      this._instance.render();
    }
  }

  /**
   * Refresh the current view without changing scene.
   */
  static refresh() {
    if (this._instance && this._instance.uiState.active) {
      this._instance.render();
    }
  }

  /**
   * Update only a specific character's image/video without full re-render.
   * Uses a smooth crossfade transition to avoid visual flicker.
   * Supports both static images and looping video portraits.
   */
  static refreshCharacter(characterId) {
    if (!this._instance || !this._instance.uiState.active) return;

    const view = this._instance.element;
    if (!view) return;

    const character = Store.characters.get(characterId);
    if (!character) return;

    const newSrc = character.image;
    const isVideo = newSrc && ['mp4', 'webm', 'ogg', 'mov'].includes(newSrc.split('.').pop()?.toLowerCase());

    // Find the character element
    const charElement = view.querySelector(`.es-pv-character[data-id="${characterId}"]`);
    if (!charElement) return;

    // Hero mode: update hero sprite src if the hero pose changed
    const heroSprite = charElement.querySelector('.es-pv-hero-sprite');
    if (heroSprite) {
      const shouldBeHeroFull = (character.heroType || 'half') === 'full';
      if (charElement.classList.contains('es-pv-character--hero-full') !== shouldBeHeroFull) {
        this.refreshCast();
        return;
      }

      const newHeroSrc = character.heroImage;
      if (newHeroSrc && heroSprite.src !== newHeroSrc && !heroSprite.src.endsWith(newHeroSrc)) {
        heroSprite.style.opacity = '0';
        const preload = new Image();
        preload.src = newHeroSrc;
        const doSwap = () => {
          heroSprite.src = newHeroSrc;
          heroSprite.style.opacity = '';
        };
        preload.complete ? doSwap() : (preload.onload = doSwap);
      }
      return; // Hero mode handled — skip token crossfade logic
    }

    const portrait = charElement.querySelector('.es-pv-portrait');
    if (!portrait) return;

    const currentMedia = portrait.querySelector('img, video');
    const currentIsVideo = currentMedia?.tagName === 'VIDEO';
    applyMediaFocusToElement(currentMedia, character.currentFocus);

    // Check if src actually changed
    const srcChanged = currentMedia
      && !currentMedia.src.endsWith(newSrc)
      && currentMedia.getAttribute('src') !== newSrc;

    if (!srcChanged && isVideo === currentIsVideo) return; // No change needed

    // If media type changed (image <-> video), swap directly (no crossfade for type changes)
    if (isVideo !== currentIsVideo) {
      if (currentMedia) currentMedia.remove();

      if (isVideo) {
        const video = document.createElement('video');
        video.src = newSrc;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.disablePictureInPicture = true;
        applyMediaFocusToElement(video, character.currentFocus);
        portrait.appendChild(video);
        video.play().catch(() => {});
      } else {
        const img = document.createElement('img');
        img.src = newSrc;
        img.alt = character.name;
        applyMediaFocusToElement(img, character.currentFocus);
        portrait.appendChild(img);
      }
      return;
    }

    // Same media type: smooth crossfade transition
    // 1. Pre-load the new image, then crossfade
    if (!isVideo) {
      const preload = new Image();
      preload.src = newSrc;

      const doSwap = () => {
        // Fade out current
        portrait.classList.add('es-emotion-transition', 'es-emotion-transition--changing');

        setTimeout(() => {
          // Swap src while invisible
          currentMedia.src = newSrc;
          applyMediaFocusToElement(currentMedia, character.currentFocus);
          // Fade back in
          portrait.classList.remove('es-emotion-transition--changing');

          // Clean up transition class after animation completes
          setTimeout(() => {
            portrait.classList.remove('es-emotion-transition');
          }, 250);
        }, 200); // Match CSS transition duration (var(--es-duration-normal) ~250ms, use 200 for snappy feel)
      };

      // If already cached, swap immediately with transition
      if (preload.complete) {
        doSwap();
      } else {
        // Wait for preload, then swap
        preload.onload = doSwap;
        // Fallback: if preload fails, swap anyway after a timeout
        preload.onerror = () => {
          currentMedia.src = newSrc;
          applyMediaFocusToElement(currentMedia, character.currentFocus);
        };
      }
    } else {
      // Video: just update src and play
      currentMedia.src = newSrc;
      applyMediaFocusToElement(currentMedia, character.currentFocus);
      currentMedia.play().catch(() => {});
    }
  }

  /**
   * Update cast (add/remove characters) with minimal re-render
   * Only re-renders the cast strip, not the entire view
   */
  static refreshCast() {
    if (!this._instance || !this._instance.uiState.active) return;

    const scene = this._instance.uiState.sceneId ? Store.scenes.get(this._instance.uiState.sceneId) : null;
    const castSource = this._instance.uiState.slideshowMode && this._instance.uiState.slideshowCast
      ? this._instance.uiState.slideshowCast
      : undefined;

    if (scene && this._instance._rebuildCastContainer(scene, castSource)) {
      return;
    }

    // Fallback: if we can't rebuild just the cast, do a full render without scene transition animations.
    this._instance.uiState.isSceneTransition = false;
    this._instance.render();
  }

  /**
   * Update only a specific character's border without full re-render
   * @param {string} characterId - Character ID
   * @param {Object} borderStyle - { effect: string, color?: string, color2?: string }
   */
  static refreshCharacterBorder(characterId, borderStyle) {
    if (!this._instance || !this._instance.uiState.active) return;

    const view = this._instance.element;
    if (!view) return;

    // Find the portrait element inside the character and update data-effect + inline CSS vars
    const charElement = view.querySelector(`.es-pv-character[data-id="${characterId}"]`);
    if (charElement) {
      const portrait = charElement.querySelector('.es-pv-portrait');
      if (portrait) {
        portrait.dataset.effect = borderStyle?.effect || CONFIG.BORDER_DEFAULT.effect;
        const inlineStyle = borderStyleToInline(borderStyle);
        // Preserve existing non-border styles (if any)
        const existing = portrait.style.cssText.replace(/--es-border[^;]*;?\s*/g, '');
        portrait.style.cssText = existing + (existing && inlineStyle ? '; ' : '') + inlineStyle;
      }
    }

    if (this._instance.uiState.borderPicker.open && this._instance.uiState.borderPicker.characterId === characterId) {
      this._instance.uiState.borderPicker.currentStyle = foundry.utils.deepClone(borderStyle || CONFIG.BORDER_DEFAULT);
      this._instance._handlers?.borderPicker?.syncPickerUi(borderStyle);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW METHODS
     ═══════════════════════════════════════════════════════════════ */

  static setSlideshowMode(enabled, cinematicMode = false, cast = null, backgroundMotion = 'none') {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }
    this._instance.uiState.slideshowMode = enabled;
    this._instance.uiState.cinematicMode = cinematicMode;
    this._instance.uiState.slideshowPaused = false;
    this._instance.uiState.backgroundMotion = backgroundMotion;

    // Store the fixed cast for the entire slideshow
    // This ensures characters persist across all background changes
    if (enabled && cast) {
      this._instance.uiState.slideshowCast = cast;
    } else if (!enabled) {
      this._instance.uiState.slideshowCast = null;
      this._instance.uiState.backgroundMotion = 'none';
    }

    if (this._instance.uiState.active) {
      this._instance.render();
    }
  }

  static setSlideshowPaused(paused) {
    if (this._instance) {
      this._instance.uiState.slideshowPaused = paused;
      if (this._instance.uiState.active) {
        this._instance.render();
      }
    }
  }

  static activateWithTransition(sceneId, transitionType = 'fade', transitionDuration = 500, slideDuration = 5000) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    const isNewScene = this._instance.uiState.sceneId !== sceneId;
    const wasActive = this._instance.uiState.active;

    // Update state
    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    // Store slide duration for background motion on first render
    this._instance.uiState.currentSlideDuration = slideDuration;
    this._instance.uiState.activeTheaterShotId = null;

    // Signal fullscreen broadcast (for MCD canvas hiding optimization)
    document.body.classList.add('es-broadcast-active');

    // If in slideshow mode and already active, only update background (don't re-render)
    if (this._instance.uiState.slideshowMode && wasActive && isNewScene) {
      this._updateBackgroundOnly(sceneId, transitionType, transitionDuration, slideDuration);
      return;
    }

    // Otherwise do full render (first activation or non-slideshow mode)
    this._instance.uiState.isSceneTransition = isNewScene;
    this._instance.render(true);
  }

  /**
   * Update the cast strip without full re-render
   * Used during slideshow transitions to update characters for new scene
   */
  static _updateCastOnly(scene) {
    const castSource = this._instance?.uiState.slideshowMode && this._instance.uiState.slideshowCast
      ? this._instance.uiState.slideshowCast
      : undefined;

    this._instance?._rebuildCastContainer(scene, castSource);
  }

  /**
   * Update background during slideshow without full re-render
   * This preserves picker state and keeps the fixed slideshow cast
   * Characters persist across all background changes in slideshow mode
   */
  static _updateBackgroundOnly(sceneId, transitionType = 'dissolve', transitionDuration = 500, slideDuration = 5000) {
    if (!this._instance?._handlers?.transition) return;

    // Build motion settings from slideshow state
    const motionPreset = this._instance.uiState.backgroundMotion || 'none';
    const motionSettings = motionPreset !== 'none' ? {
      preset: motionPreset,
      duration: slideDuration
    } : null;

    this._instance._handlers.transition.updateBackgroundOnly(sceneId, transitionType, transitionDuration, motionSettings);
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE METHODS (Manual navigation by GM)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Activate the player view with a sequence (starts at first background)
   */
  static activateSequence(sceneId, background, transitionType = 'dissolve', transitionDuration = 1.0) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Store current background info for sequence
    this._instance.uiState.sequenceBackground = background;

    this._instance.uiState.previousSceneId = this._instance.uiState.sceneId;
    this._instance.uiState.active = true;
    this._instance.uiState.sceneId = sceneId;
    this._instance.uiState.isSceneTransition = true;
    this._instance.uiState.activeTheaterShotId = null;

    // Signal fullscreen broadcast (for MCD canvas hiding optimization)
    document.body.classList.add('es-broadcast-active');

    this._instance.render(true);
  }

  /**
   * Update the background during a sequence without re-rendering everything
   */
  static updateSequenceBackground(background, transitionType = 'dissolve', transitionDuration = 1.0) {
    if (!this._instance?._handlers?.transition) return;
    this._instance._handlers.transition.updateSequenceBackground(background, transitionType, transitionDuration);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE METHODS (Cast without scene background)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Activate Cast-Only Mode
   * @param {string[]} characterIds - Array of character IDs to display
   * @param {Object} layoutSettings - Layout settings for cast positioning
   */
  static activateCastOnly(characterIds, layoutSettings) {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerView();
    }

    // Set cast-only mode state
    this._instance.uiState.active = true;
    this._instance.uiState.castOnlyMode = true;
    this._instance.uiState.castOnlyCharacterIds = [...characterIds];
    this._instance.uiState.castOnlyLayoutSettings = layoutSettings || CONFIG.DEFAULT_LAYOUT;
    this._instance.uiState.sceneId = null; // No scene in cast-only mode
    this._instance.uiState.isSceneTransition = true; // Trigger entrance animation
    this._instance.uiState.activeTheaterShotId = null;

    this._instance.render(true);
  }

  /**
   * Deactivate Cast-Only Mode
   */
  static deactivateCastOnly() {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;

    // Defensive: ensure broadcast class is removed (cast-only doesn't add it, but be safe)
    document.body.classList.remove('es-broadcast-active');

    const transitionHandler = this._instance._handlers?.transition;

    // Use transition handler for closing animation if available
    if (transitionHandler) {
      const animated = transitionHandler.animateClose(() => {
        this._instance.uiState.active = false;
        this._instance.uiState.castOnlyMode = false;
        this._instance.uiState.castOnlyCharacterIds = [];
        this._instance.uiState.activeTheaterShotId = null;
        this._instance.render();
      });

      if (animated) return;
    }

    // Fallback if no handler or element
    this._instance.uiState.active = false;
    this._instance.uiState.castOnlyMode = false;
    this._instance.uiState.castOnlyCharacterIds = [];
    this._instance.uiState.activeTheaterShotId = null;
    this._instance.render();
  }

  /**
   * Update Cast-Only Mode (characters or layout)
   * @param {string[]} characterIds - Updated character IDs (optional)
   * @param {Object} layoutSettings - Updated layout settings (optional)
   */
  static updateCastOnly(characterIds, layoutSettings) {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;

    if (characterIds) {
      this._instance.uiState.castOnlyCharacterIds = [...characterIds];
    }
    if (layoutSettings) {
      this._instance.uiState.castOnlyLayoutSettings = layoutSettings;
    }

    // Don't trigger scene transition animation
    this._instance.uiState.isSceneTransition = false;
    this._instance.render();
  }

  /**
   * Refresh a character in Cast-Only Mode
   * @param {string} characterId - Character ID to refresh
   */
  static refreshCastOnlyCharacter(characterId) {
    if (!this._instance || !this._instance.uiState.castOnlyMode) return;
    this.refreshCharacter(characterId);
  }
}
