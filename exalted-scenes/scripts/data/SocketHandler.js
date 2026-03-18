/**
 * @file SocketHandler.js
 * @description Handles real-time socket communication between GM and players.
 * Manages broadcasting scenes, emotion updates, slideshows, sequences, and cast-only mode.
 *
 * Socket message types:
 * - broadcast-scene: Start broadcasting a scene
 * - stop-broadcast: Stop the current broadcast
 * - update-emotion: Character emotion change
 * - update-cast: Cast member list update
 * - update-border: Character border style change
 * - update-lock: Character lock state change
 * - slideshow-*: Slideshow control messages
 * - sequence-*: Sequence control messages
 * - update-positions: Character position updates (freeform mode)
 * - cast-only-*: Cast-only mode messages
 *
 * @module data/SocketHandler
 */

import { CONFIG, log } from '../config.js';
import { ExaltedScenesPlayerView } from '../apps/PlayerView.js';
import { Store } from './Store.js';
import { localize, format } from '../utils/i18n.js';
import { HOOK_NAMES } from '../api/index.js';
import { normalizeYouTubeUrl, isYouTubeEmbedBlockedCode } from '../utils/youtube-embed-validator.js';
import { ensureTheaterShots, getTheaterShot, isSceneTheaterMode } from '../apps/player-view/theater-mode-utils.js';

/**
 * Handles real-time socket communication for the module.
 * All methods are static; this class acts as a singleton service.
 *
 * @class SocketHandler
 */
export class SocketHandler {
  static _recentMusicAddApprovals = new Map();
  static _recentPlaybackFailures = new Map();
  static _RECENT_APPROVAL_TTL_MS = 5 * 60 * 1000;
  static _RECENT_FAILURE_TTL_MS = 45 * 1000;

  /**
   * Required fields for each socket message type.
   * Messages with no required data fields use an empty array.
   * @private
   */
  static _requiredFields = {
    'broadcast-scene': ['sceneId'],
    'theater-shot-activate': ['sceneId', 'shotId'],
    'stop-broadcast': [],
    'update-emotion': ['characterId', 'state'],
    'update-cast': ['sceneId'],
    'update-border': ['characterId', 'borderStyle'],
    'update-lock': ['characterId', 'locked'],
    'slideshow-start': ['slideshowId'],
    'slideshow-scene': ['sceneId'],
    'slideshow-pause': [],
    'slideshow-resume': [],
    'slideshow-stop': [],
    'sequence-start': ['sceneId', 'background'],
    'sequence-change': ['background'],
    'sequence-stop': [],
    'cast-only-start': ['characterIds'],
    'cast-only-update': [],
    'cast-only-stop': [],
    'music-request': ['requestId', 'userId', 'characterId', 'trackId'],
    'music-request-approve': ['playlistId', 'trackId'],
    'music-request-deny': ['userId'],
    'music-add-request': ['requestId', 'userId', 'characterId', 'playlistId', 'trackName', 'trackUrl'],
    'music-add-approve': ['requestId', 'userId', 'trackName'],
    'music-add-deny': ['requestId', 'userId'],
    'music-add-playback-failed': ['requestId', 'listenerId', 'listenerName', 'trackName'],
    'update-positions': ['sceneId', 'positions']
  };

  /**
   * Validates a socket message payload against required fields.
   * @private
   * @param {Object} payload - The full socket payload
   * @returns {boolean} True if valid, false otherwise
   */
  static _validatePayload(payload) {
    if (!payload?.type || typeof payload.type !== 'string') {
      console.warn(`${CONFIG.MODULE_NAME} | Socket message missing type`);
      return false;
    }

    const required = this._requiredFields[payload.type];
    if (required === undefined) {
      console.warn(`${CONFIG.MODULE_NAME} | Unknown socket message type: ${payload.type}`);
      return false;
    }

    if (required.length > 0) {
      const data = payload.data;
      if (!data || typeof data !== 'object') {
        console.warn(`${CONFIG.MODULE_NAME} | Socket message '${payload.type}' missing data object`);
        return false;
      }
      for (const field of required) {
        if (data[field] === undefined || data[field] === null) {
          console.warn(`${CONFIG.MODULE_NAME} | Socket message '${payload.type}' missing required field: ${field}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Initializes the socket handler by registering the message listener.
   * Should be called once during module ready hook.
   */
  static initialize() {
    game.socket.on(CONFIG.SOCKET_NAME, this._handleSocketMessage.bind(this));
    log('Socket Handler Initialized');
  }

  /**
   * Routes incoming socket messages to appropriate handlers.
   * @private
   * @param {Object} payload - Socket message payload
   * @param {string} payload.type - Message type identifier
   * @param {Object} payload.data - Message data
   */
  static _handleSocketMessage(payload) {
    if (!this._validatePayload(payload)) return;

    log('Socket Message Received:', payload);

    switch (payload.type) {
      case 'broadcast-scene':
        this._onBroadcastScene(payload.data);
        break;
      case 'theater-shot-activate':
        this._onTheaterShotActivate(payload.data);
        break;
      case 'stop-broadcast':
        this._onStopBroadcast();
        break;
      case 'update-emotion':
        this._onUpdateEmotion(payload.data);
        break;
      case 'update-cast':
        this._onUpdateCast(payload.data);
        break;
      case 'update-border':
        this._onUpdateBorder(payload.data);
        break;
      case 'update-lock':
        this._onUpdateLock(payload.data);
        break;
      case 'slideshow-start':
        this._onSlideshowStart(payload.data);
        break;
      case 'slideshow-scene':
        this._onSlideshowScene(payload.data);
        break;
      case 'slideshow-pause':
        this._onSlideshowPause();
        break;
      case 'slideshow-resume':
        this._onSlideshowResume();
        break;
      case 'slideshow-stop':
        this._onSlideshowStop();
        break;
      case 'sequence-start':
        this._onSequenceStart(payload.data);
        break;
      case 'sequence-change':
        this._onSequenceChange(payload.data);
        break;
      case 'sequence-stop':
        this._onSequenceStop();
        break;
      case 'cast-only-start':
        this._onCastOnlyStart(payload.data);
        break;
      case 'cast-only-update':
        this._onCastOnlyUpdate(payload.data);
        break;
      case 'cast-only-stop':
        this._onCastOnlyStop();
        break;
      case 'music-request':
        this._onMusicRequest(payload.data);
        break;
      case 'music-request-approve':
        this._onMusicRequestApprove(payload.data);
        break;
      case 'music-request-deny':
        this._onMusicRequestDeny(payload.data);
        break;
      case 'music-add-request':
        this._onMusicAddRequest(payload.data);
        break;
      case 'music-add-approve':
        this._onMusicAddApprove(payload.data);
        break;
      case 'music-add-deny':
        this._onMusicAddDeny(payload.data);
        break;
      case 'music-add-playback-failed':
        this._onMusicAddPlaybackFailed(payload.data);
        break;
      case 'update-positions':
        this._onUpdatePositions(payload.data);
        break;
    }
  }

  static _pruneRecentMusicAddApprovals() {
    const cutoff = Date.now() - this._RECENT_APPROVAL_TTL_MS;
    for (const [key, value] of this._recentMusicAddApprovals.entries()) {
      if ((value?.approvedAt ?? 0) < cutoff) {
        this._recentMusicAddApprovals.delete(key);
      }
    }
  }

  static _pruneRecentPlaybackFailures() {
    const cutoff = Date.now() - this._RECENT_FAILURE_TTL_MS;
    for (const [key, value] of this._recentPlaybackFailures.entries()) {
      if ((value ?? 0) < cutoff) {
        this._recentPlaybackFailures.delete(key);
      }
    }
  }

  static _recordMusicAddApproval(data) {
    const entry = {
      ...data,
      trackUrl: normalizeYouTubeUrl(data.trackUrl),
      approvedAt: Date.now()
    };

    this._pruneRecentMusicAddApprovals();

    if (entry.newTrackId) {
      this._recentMusicAddApprovals.set(`id:${entry.newTrackId}`, entry);
    }
    if (entry.trackUrl) {
      this._recentMusicAddApprovals.set(`url:${entry.trackUrl}`, entry);
    }
  }

  static findRecentMusicAddApproval(track) {
    if (!track) return null;

    this._pruneRecentMusicAddApprovals();

    const trackId = track.id || track._id || null;
    if (trackId) {
      const byId = this._recentMusicAddApprovals.get(`id:${trackId}`);
      if (byId) return byId;
    }

    const normalizedUrl = normalizeYouTubeUrl(track.url || track.path || '');
    if (!normalizedUrl) return null;
    return this._recentMusicAddApprovals.get(`url:${normalizedUrl}`) ?? null;
  }

  static shouldReportMusicAddPlaybackFailure(requestId, listenerId, code) {
    this._pruneRecentPlaybackFailures();

    const key = `${requestId}:${listenerId}:${code ?? 'unknown'}`;
    if (this._recentPlaybackFailures.has(key)) return false;

    this._recentPlaybackFailures.set(key, Date.now());
    return true;
  }

  /**
   * Persists the current broadcast state so reconnecting players can restore it.
   * Only called by the GM who controls the broadcast.
   * @private
   * @param {Object} state - Broadcast state to persist
   */
  static _saveBroadcastState(state) {
    if (!game.user.isGM) return;
    game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.BROADCAST_STATE, state)
      .catch(e => console.error('Exalted Scenes | Failed to save broadcast state:', e));
  }

  /* ═══════════════════════════════════════════════════════════════
     HANDLERS - Process incoming socket messages
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Handles scene broadcast message.
   * @private
   * @param {Object} data - Message data
   * @param {string} data.sceneId - ID of scene to broadcast
   */
  static _onBroadcastScene(data) {
    const { sceneId, theaterShotId = null } = data;
    Store.setActiveScene(sceneId);
    ExaltedScenesPlayerView.activate(sceneId, { theaterShotId });
    const scene = Store.scenes.get(sceneId);
    Hooks.callAll(HOOK_NAMES.SCENE_BROADCAST, {
      sceneId,
      scene: scene ? foundry.utils.deepClone(scene.toJSON()) : null
    });
  }

  static _onTheaterShotActivate(data) {
    const { sceneId, shotId } = data;
    ExaltedScenesPlayerView.activateTheaterShot(sceneId, shotId);
  }

  static _onStopBroadcast() {
    const previousSceneId = Store.activeSceneId;
    ExaltedScenesPlayerView.deactivate();
    Store.clearActiveScene();
    Hooks.callAll(HOOK_NAMES.BROADCAST_STOP, { previousSceneId });
  }

  static _onUpdateEmotion(data) {
    const { characterId, state, userId, isHeroMode } = data;
    // Update the local store character instance if needed, or just refresh the view
    const character = Store.characters.get(characterId);
    if (character) {
      // Server-side (GM) permission validation for non-GM users
      if (game.user.isGM && userId && userId !== game.user.id) {
        // Check if the user has permission to edit this character
        if (!character.hasPermission(userId, 'emotion')) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted unauthorized emotion change on ${character.name}`);
          return; // Reject the change
        }
        // Also check lock status
        if (character.locked) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted to change locked character ${character.name}`);
          return;
        }
      }

      const previousState = isHeroMode ? character.currentHeroState : character.currentState;
      if (isHeroMode) {
        character.currentHeroState = state;
      } else {
        character.currentState = state;
      }

      // If we are the GM, we must persist this change!
      if (game.user.isGM) {
        Store.saveData();
      }

      // Refresh only the specific character to avoid flickering other characters
      ExaltedScenesPlayerView.refreshCharacter(characterId);

      // Emit hook for API consumers
      Hooks.callAll(HOOK_NAMES.EMOTION_CHANGE, {
        characterId, previousState, newState: state, userId
      });

      // Also refresh GM Panel if open
      if (game.user.isGM) {
        import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
             if (ExaltedScenesGMPanel._instance && ExaltedScenesGMPanel._instance.rendered) {
                 ExaltedScenesGMPanel._instance.render();
             }
        }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
      }

      import('../apps/PlayerPanel.js').then(({ ExaltedScenesPlayerPanel }) => {
        if (ExaltedScenesPlayerPanel._instance?.rendered) {
          ExaltedScenesPlayerPanel.refresh();
        }
      }).catch(e => console.error('Exalted Scenes | Failed to load PlayerPanel:', e));
    }
  }

  static _onUpdateCast(data) {
    // Refresh the cast (add/remove characters) without triggering scene transition animations
    ExaltedScenesPlayerView.refreshCast();
    const { sceneId } = data;
    const scene = Store.scenes.get(sceneId);
    Hooks.callAll(HOOK_NAMES.CAST_UPDATE, {
      sceneId,
      cast: scene ? foundry.utils.deepClone(scene.cast) : []
    });
  }

  static _onUpdateBorder(data) {
    const { characterId, borderStyle, userId } = data;
    const character = Store.characters.get(characterId);
    if (character) {
      // Server-side (GM) permission validation for non-GM users
      // Border changes require 'full' permission level
      if (game.user.isGM && userId && userId !== game.user.id) {
        if (!character.hasPermission(userId, 'full')) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted unauthorized border change on ${character.name}`);
          return;
        }
        if (character.locked) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted to change locked character ${character.name}`);
          return;
        }
      }

      const previousBorder = character.borderStyle;
      character.borderStyle = borderStyle;

      // If we are the GM, we must persist this change!
      if (game.user.isGM) {
        Store.saveData();
      }

      // Refresh only the specific character's border to avoid flickering
      ExaltedScenesPlayerView.refreshCharacterBorder(characterId, borderStyle);

      // Emit hook for API consumers
      Hooks.callAll(HOOK_NAMES.BORDER_CHANGE, {
        characterId, previousBorder, newBorder: borderStyle, userId
      });

      // Also refresh GM Panel if open
      if (game.user.isGM) {
        import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
          if (ExaltedScenesGMPanel._instance && ExaltedScenesGMPanel._instance.rendered) {
            ExaltedScenesGMPanel._instance.render();
          }
        }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
      }
    }
  }

  static _onUpdateLock(data) {
    const { characterId, locked } = data;
    const character = Store.characters.get(characterId);
    if (character) {
      character.locked = locked;

      // If we are the GM, we must persist this change!
      if (game.user.isGM) {
        Store.saveData();
      }

      // Refresh views
      ExaltedScenesPlayerView.refresh();

      // Emit hook for API consumers
      Hooks.callAll(HOOK_NAMES.LOCK_CHANGE, { characterId, locked });

      // Also refresh GM Panel if open
      if (game.user.isGM) {
        import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
          if (ExaltedScenesGMPanel._instance && ExaltedScenesGMPanel._instance.rendered) {
            ExaltedScenesGMPanel._instance.render();
          }
        }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     EMITTERS - Send socket messages to other clients
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Broadcasts a scene to all connected clients.
   * @param {string} sceneId - ID of scene to broadcast
   */
  static emitBroadcastScene(sceneId, theaterShotId = null) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'broadcast-scene',
      data: { sceneId, theaterShotId }
    });
    // Also trigger locally
    this._onBroadcastScene({ sceneId, theaterShotId });
    this._saveBroadcastState({ mode: 'scene', sceneId, theaterShotId });
  }

  static emitActivateTheaterShot(sceneId, shotId) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'theater-shot-activate',
      data: { sceneId, shotId }
    });
    this._onTheaterShotActivate({ sceneId, shotId });
    this._saveBroadcastState({ mode: 'scene', sceneId, theaterShotId: shotId });
  }

  /**
   * Stops the current broadcast for all clients.
   */
  static emitStopBroadcast() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'stop-broadcast',
      data: {}
    });
    this._onStopBroadcast();
    this._saveBroadcastState({ mode: null });
  }

  /**
   * Updates a character's emotion state across all clients.
   * @param {string} characterId - ID of character to update
   * @param {string} state - New emotion state name
   */
  static emitUpdateEmotion(characterId, state, isHeroMode = false) {
    const userId = game.user.id;
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'update-emotion',
      data: { characterId, state, userId, isHeroMode }
    });
    this._onUpdateEmotion({ characterId, state, userId, isHeroMode });
  }

  /**
   * Notifies all clients that the cast list has changed.
   * @param {string} sceneId - ID of scene with updated cast
   */
  static emitUpdateCast(sceneId) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'update-cast',
      data: { sceneId }
    });
    this._onUpdateCast({ sceneId });
  }

  /**
   * Updates a character's border style across all clients.
   * @param {string} characterId - ID of character to update
   * @param {Object} borderStyle - Border style object { effect: string, color?: string, color2?: string }
   */
  static emitUpdateBorder(characterId, borderStyle) {
    const userId = game.user.id;
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'update-border',
      data: { characterId, borderStyle, userId }
    });
    this._onUpdateBorder({ characterId, borderStyle, userId });
  }

  /**
   * Updates a character's lock state across all clients.
   * @param {string} characterId - ID of character to update
   * @param {boolean} locked - New lock state
   */
  static emitUpdateLock(characterId, locked) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'update-lock',
      data: { characterId, locked }
    });
    this._onUpdateLock({ characterId, locked });
  }

  /**
   * Updates character positions for freeform layout across all clients.
   * @param {string} sceneId - ID of scene being updated
   * @param {Object} positions - Map of characterId → {x, y, scale, flipped}
   */
  static emitUpdatePositions(sceneId, positions, shotId = null) {
    const userId = game.user.id;
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'update-positions',
      data: { sceneId, positions, userId, shotId }
    });
  }

  /**
   * Handles position updates for freeform layout.
   * Updates in-memory data and applies DOM-only updates on player side.
   * @private
   * @param {Object} data
   * @param {string} data.sceneId
   * @param {Object} data.positions
   */
  static _onUpdatePositions(data) {
    const { sceneId, positions, userId, shotId = null } = data;
    const scene = Store.scenes.get(sceneId);
    if (!scene) return;

    if (game.user.isGM && userId && userId !== game.user.id) {
      const currentPositions = (isSceneTheaterMode(scene) && shotId)
        ? (getTheaterShot(scene, shotId)?.positions || {})
        : (scene.layoutSettings.positions || {});
      const changedIds = new Set([
        ...Object.keys(currentPositions),
        ...Object.keys(positions || {})
      ]);

      for (const charId of changedIds) {
        const previous = currentPositions[charId] || null;
        const next = positions?.[charId] || null;
        if (foundry.utils.deepEqual(previous, next)) continue;

        const character = Store.characters.get(charId);
        if (!character?.hasPermission(userId, 'full')) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted unauthorized layout change on ${character?.name || charId}`);
          return;
        }
        if (character.locked) {
          console.warn(`${CONFIG.MODULE_NAME} | User ${userId} attempted to move locked character ${character.name}`);
          return;
        }
      }
    }

    if (isSceneTheaterMode(scene) && shotId) {
      const shot = getTheaterShot(scene, shotId);
      if (!shot) return;
      shot.positions = positions;
      scene.layoutSettings.theaterShots = ensureTheaterShots(scene).map(existing => {
        return existing.id === shot.id ? shot : existing;
      });
    } else {
      scene.layoutSettings.positions = positions;
    }

    if (game.user.isGM && userId && userId !== game.user.id) {
      Store.saveData();
    }

    ExaltedScenesPlayerView.updateCharacterPositions(positions);
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW HANDLERS - Process slideshow control messages
     ═══════════════════════════════════════════════════════════════ */

  static _onSlideshowStart(data) {
    const { slideshowId, cinematicMode, cast, backgroundMotion } = data;
    // Non-GM clients just track that a slideshow started
    // The first scene will be sent via slideshow-scene
    // Pass the fixed cast and background motion that will be used for the entire slideshow
    ExaltedScenesPlayerView.setSlideshowMode(true, cinematicMode, cast, backgroundMotion || 'none');
    const slideshow = Store.slideshows.get(slideshowId);
    Hooks.callAll(HOOK_NAMES.SLIDESHOW_START, {
      slideshowId,
      slideshow: slideshow ? foundry.utils.deepClone(slideshow.toJSON()) : null
    });
  }

  static _onSlideshowScene(data) {
    const { sceneId, index, total, transitionType, transitionDuration, duration } = data;
    Store.setActiveScene(sceneId);
    // Pass slide duration for Ken Burns animation sync
    ExaltedScenesPlayerView.activateWithTransition(sceneId, transitionType, transitionDuration, duration || 5000);
    Hooks.callAll(HOOK_NAMES.SLIDESHOW_SCENE, {
      slideshowId: Store.slideshowState.slideshowId,
      sceneId, index, total
    });
  }

  static _onSlideshowPause() {
    ExaltedScenesPlayerView.setSlideshowPaused(true);
    Hooks.callAll(HOOK_NAMES.SLIDESHOW_PAUSE, {
      slideshowId: Store.slideshowState.slideshowId
    });
  }

  static _onSlideshowResume() {
    ExaltedScenesPlayerView.setSlideshowPaused(false);
    Hooks.callAll(HOOK_NAMES.SLIDESHOW_RESUME, {
      slideshowId: Store.slideshowState.slideshowId
    });
  }

  static _onSlideshowStop() {
    const slideshowId = Store.slideshowState.slideshowId;
    ExaltedScenesPlayerView.setSlideshowMode(false);
    ExaltedScenesPlayerView.deactivate();
    Store.clearActiveScene();
    Hooks.callAll(HOOK_NAMES.SLIDESHOW_STOP, { slideshowId });
  }

  /* ═══════════════════════════════════════════════════════════════
     SLIDESHOW EMITTERS - Send slideshow control messages
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts a slideshow for all clients.
   * @param {Object} data - Slideshow start data
   * @param {string} data.slideshowId - ID of slideshow to start
   * @param {boolean} data.cinematicMode - Whether to use cinematic mode
   * @param {Array} data.cast - Fixed cast for the slideshow
   */
  static emitSlideshowStart(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'slideshow-start',
      data
    });
    this._onSlideshowStart(data);
  }

  /**
   * Changes the current slideshow scene for all clients.
   * @param {Object} data - Scene change data
   * @param {string} data.sceneId - ID of scene to display
   * @param {number} data.index - Current scene index
   * @param {number} data.total - Total scenes in slideshow
   * @param {string} data.transitionType - Transition type to use
   * @param {number} data.transitionDuration - Transition duration in seconds
   */
  static emitSlideshowScene(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'slideshow-scene',
      data
    });
    this._onSlideshowScene(data);
    this._saveBroadcastState({ mode: 'slideshow', sceneId: data.sceneId });
  }

  /** Pauses the current slideshow for all clients. */
  static emitSlideshowPause() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'slideshow-pause',
      data: {}
    });
    this._onSlideshowPause();
  }

  /** Resumes the current slideshow for all clients. */
  static emitSlideshowResume() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'slideshow-resume',
      data: {}
    });
    this._onSlideshowResume();
  }

  /** Stops the current slideshow for all clients. */
  static emitSlideshowStop() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'slideshow-stop',
      data: {}
    });
    this._onSlideshowStop();
    this._saveBroadcastState({ mode: null });
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE HANDLERS - Process sequence control messages
     Sequences allow GM to manually navigate through backgrounds
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Handles sequence start message.
   * @private
   * @param {Object} data - Sequence data
   */
  static _onSequenceStart(data) {
    const { sceneId, backgroundIndex, background, cast, transitionType, transitionDuration } = data;
    Store.setActiveScene(sceneId);
    ExaltedScenesPlayerView.activateSequence(sceneId, background, transitionType, transitionDuration);
    const scene = Store.scenes.get(sceneId);
    Hooks.callAll(HOOK_NAMES.SEQUENCE_START, {
      sceneId,
      totalBackgrounds: scene?.sequenceBackgrounds?.length || 0
    });
  }

  static _onSequenceChange(data) {
    const { sceneId, backgroundIndex, background, transitionType, transitionDuration } = data;
    ExaltedScenesPlayerView.updateSequenceBackground(background, transitionType, transitionDuration);
    const scene = Store.scenes.get(sceneId);
    Hooks.callAll(HOOK_NAMES.SEQUENCE_CHANGE, {
      sceneId,
      backgroundIndex,
      totalBackgrounds: scene?.sequenceBackgrounds?.length || 0
    });

    // Refresh GM Panel to update controls
    if (game.user.isGM) {
      import('../apps/GMPanel.js').then(({ ExaltedScenesGMPanel }) => {
        if (ExaltedScenesGMPanel._instance && ExaltedScenesGMPanel._instance.rendered) {
          ExaltedScenesGMPanel._instance.render();
        }
      }).catch(e => console.error('Exalted Scenes | Failed to load GMPanel:', e));
    }
  }

  static _onSequenceStop() {
    const sceneId = Store.sequenceState.sceneId;
    ExaltedScenesPlayerView.deactivate();
    Store.clearActiveScene();
    Hooks.callAll(HOOK_NAMES.SEQUENCE_STOP, { sceneId });
  }

  /* ═══════════════════════════════════════════════════════════════
     SCENE SEQUENCE EMITTERS - Send sequence control messages
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts a sequence for all clients.
   * @param {Object} data - Sequence start data
   * @param {string} data.sceneId - ID of sequence scene
   * @param {number} data.backgroundIndex - Initial background index
   * @param {Object} data.background - Background data
   * @param {Array} data.cast - Cast members
   * @param {string} data.transitionType - Transition type
   * @param {number} data.transitionDuration - Transition duration
   */
  static emitSequenceStart(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'sequence-start',
      data
    });
    this._onSequenceStart(data);
    this._saveBroadcastState({
      mode: 'sequence', sceneId: data.sceneId,
      background: data.background, transitionType: data.transitionType
    });
  }

  /**
   * Changes the current sequence background for all clients.
   * @param {Object} data - Background change data
   * @param {string} data.sceneId - ID of sequence scene
   * @param {number} data.backgroundIndex - New background index
   * @param {Object} data.background - Background data
   * @param {string} data.transitionType - Transition type
   * @param {number} data.transitionDuration - Transition duration
   */
  static emitSequenceChange(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'sequence-change',
      data
    });
    this._onSequenceChange(data);
    this._saveBroadcastState({
      mode: 'sequence', sceneId: data.sceneId,
      background: data.background, transitionType: data.transitionType
    });
  }

  /** Stops the current sequence for all clients. */
  static emitSequenceStop() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'sequence-stop',
      data: {}
    });
    this._onSequenceStop();
    this._saveBroadcastState({ mode: null });
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE HANDLERS - Process cast-only mode messages
     Cast-only mode shows characters without a background scene
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Handles cast-only mode start message.
   * @private
   * @param {Object} data - Cast-only data
   * @param {string[]} data.characterIds - IDs of characters to display
   * @param {Object} data.layoutSettings - Layout settings
   */
  static _onCastOnlyStart(data) {
    const { characterIds, layoutSettings } = data;
    // Update local store state (non-GM clients)
    if (!game.user.isGM) {
      Store.castOnlyState = {
        isActive: true,
        characterIds: [...characterIds],
        layoutSettings: { ...layoutSettings }
      };
    }
    ExaltedScenesPlayerView.activateCastOnly(characterIds, layoutSettings);
    Hooks.callAll(HOOK_NAMES.CAST_ONLY_START, {
      characterIds: [...characterIds],
      layoutSettings: foundry.utils.deepClone(layoutSettings)
    });
  }

  static _onCastOnlyUpdate(data) {
    if (!Store.castOnlyState.isActive) return;
    const { characterIds, layoutSettings } = data;
    // Update local store state
    if (characterIds) {
      Store.castOnlyState.characterIds = [...characterIds];
    }
    if (layoutSettings) {
      Store.castOnlyState.layoutSettings = { ...layoutSettings };
    }
    ExaltedScenesPlayerView.updateCastOnly(characterIds, layoutSettings);
    Hooks.callAll(HOOK_NAMES.CAST_ONLY_UPDATE, {
      characterIds: characterIds ? [...characterIds] : undefined,
      layoutSettings: layoutSettings ? foundry.utils.deepClone(layoutSettings) : undefined
    });
  }

  static _onCastOnlyStop() {
    Store.castOnlyState.isActive = false;
    Store.castOnlyState.characterIds = [];
    ExaltedScenesPlayerView.deactivateCastOnly();
    Hooks.callAll(HOOK_NAMES.CAST_ONLY_STOP, {});
  }

  /* ═══════════════════════════════════════════════════════════════
     CAST-ONLY MODE EMITTERS - Send cast-only mode messages
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts cast-only mode for all clients.
   * @param {Object} data - Cast-only data
   * @param {string[]} data.characterIds - IDs of characters to display
   * @param {Object} data.layoutSettings - Layout settings
   */
  static emitCastOnlyStart(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'cast-only-start',
      data
    });
    this._onCastOnlyStart(data);
    this._saveBroadcastState({
      mode: 'cast-only',
      characterIds: data.characterIds,
      layoutSettings: data.layoutSettings
    });
  }

  /**
   * Updates cast-only mode settings for all clients.
   * @param {Object} data - Update data
   * @param {string[]} [data.characterIds] - Updated character IDs
   * @param {Object} [data.layoutSettings] - Updated layout settings
   */
  static emitCastOnlyUpdate(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'cast-only-update',
      data
    });
    this._onCastOnlyUpdate(data);
    // Update persisted state with latest character IDs and layout
    this._saveBroadcastState({
      mode: 'cast-only',
      characterIds: Store.castOnlyState.characterIds,
      layoutSettings: Store.castOnlyState.layoutSettings
    });
  }

  /** Stops cast-only mode for all clients. */
  static emitCastOnlyStop() {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'cast-only-stop',
      data: {}
    });
    this._onCastOnlyStop();
    this._saveBroadcastState({ mode: null });
  }

  /* ═══════════════════════════════════════════════════════════════
     MUSIC REQUEST HANDLERS - Process music request messages
     Players can request songs, GMs approve or deny
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Handles music request from a player.
   * Only processed by GM clients.
   * @private
   * @param {Object} data - Request data
   * @param {string} data.requestId - Unique request ID
   * @param {string} data.userId - Requesting user ID
   * @param {string} data.userName - Requesting user name
   * @param {string} data.characterId - Character ID making the request
   * @param {string} data.characterName - Character name
   * @param {string} data.playlistId - Playlist ID
   * @param {string} data.trackId - Track ID
   * @param {string} data.trackName - Track name
   */
  static _onMusicRequest(data) {
    // Only GM processes music requests
    if (!game.user.isGM) return;

    const { requestId, userId, userName, characterId, characterName, playlistId, trackId, trackName } = data;

    // Show notification to GM
    import('./MusicRequestManager.js').then(({ MusicRequestManager }) => {
      MusicRequestManager.showRequest({
        requestId,
        userId,
        userName,
        characterId,
        characterName,
        playlistId,
        trackId,
        trackName
      });
    }).catch(e => console.error('Exalted Scenes | Failed to load MusicRequestManager:', e));
  }

  /**
   * Handles music request approval from GM.
   * @private
   * @param {Object} data - Approval data
   * @param {string} data.requestId - Request ID being approved
   * @param {string} data.playlistId - Playlist ID
   * @param {string} data.trackId - Track ID to play
   */
  static _onMusicRequestApprove(data) {
    const { playlistId, trackId, trackName, userId, approverId } = data;

    // Only the GM who approved the request should start playback.
    // Narrator Jukebox will then broadcast/sync that playback to every player.
    const isApprovingGM = game.user.isGM && (!approverId || game.user.id === approverId);
    if (isApprovingGM) {
      import('./NarratorJukeboxIntegration.js').then(async ({ NarratorJukeboxIntegration }) => {
        await NarratorJukeboxIntegration.playTrack(playlistId, trackId);
      }).catch(e => console.error('Exalted Scenes | Failed to load NarratorJukeboxIntegration:', e));
    }

    // Notify the requesting player
    if (game.user.id === userId) {
      ui.notifications.info(format('Notifications.MusicRequestApproved', { track: trackName }));
    }
  }

  /**
   * Handles music request denial from GM.
   * @private
   * @param {Object} data - Denial data
   * @param {string} data.requestId - Request ID being denied
   * @param {string} data.userId - User who made the request
   */
  static _onMusicRequestDeny(data) {
    const { requestId, trackName, userId } = data;

    // Notify the requesting player
    if (game.user.id === userId) {
      ui.notifications.warn(format('Notifications.MusicRequestDenied', { track: trackName }));
    }
  }

  /**
   * Handles YouTube music add request from player. GM-only.
   * @private
   */
  static _onMusicAddRequest(data) {
    if (!game.user.isGM) return;

    import('./MusicRequestManager.js').then(({ MusicRequestManager }) => {
      MusicRequestManager.showAddRequest(data);
    }).catch(e => console.error('Exalted Scenes | Failed to load MusicRequestManager:', e));
  }

  /**
   * Handles YouTube music add approval.
   * Invalidates NJ cache so the new track appears, then notifies the requesting player.
   * @private
   */
  static _onMusicAddApprove(data) {
    const { trackName, userId } = data;

    this._recordMusicAddApproval(data);

    // Invalidate NJ cache for ALL clients so the new track appears in the music picker
    import('./NarratorJukeboxIntegration.js').then(({ NarratorJukeboxIntegration }) => {
      NarratorJukeboxIntegration.invalidateCache();
    }).catch(e => console.error('Exalted Scenes | Failed to load NarratorJukeboxIntegration:', e));

    if (game.user.id === userId) {
      ui.notifications.info(format('Notifications.MusicAddApproved', { track: trackName }));
    }
  }

  /**
   * Handles YouTube music add denial. Notifies the requesting player.
   * @private
   */
  static _onMusicAddDeny(data) {
    const { trackName, userId } = data;
    if (game.user.id === userId) {
      ui.notifications.warn(format('Notifications.MusicAddDenied', { track: trackName }));
    }
  }

  /**
   * Handles playback failures for recently approved YouTube add requests.
   * Only GMs need to receive cross-client failure reports.
   * @private
   */
  static _onMusicAddPlaybackFailed(data) {
    if (!game.user.isGM) return;

    const { listenerName, trackName, code } = data;
    const isBlocked = isYouTubeEmbedBlockedCode(code);
    const key = isBlocked
      ? 'Notifications.MusicAddPlaybackBlockedGM'
      : 'Notifications.MusicAddPlaybackFailedGM';
    const fallback = isBlocked
      ? `${listenerName} could not play "${trackName}" because YouTube blocked the embed on that client (error ${code}).`
      : `${listenerName} could not play "${trackName}" on that client${code ? ` (error ${code})` : ''}.`;
    const message = game.i18n.has(`EXALTED-SCENES.${key}`)
      ? format(key, { player: listenerName, track: trackName, code: code ?? 'unknown' })
      : fallback;

    ui.notifications.warn(message);
  }

  /* ═══════════════════════════════════════════════════════════════
     MUSIC REQUEST EMITTERS - Send music request messages
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Emits a music request from player to GM.
   * @param {string} characterId - Character ID making the request
   * @param {string} characterName - Character name
   * @param {string} trackId - Track ID
   * @param {string} trackName - Track name
   */
  static emitMusicRequest(characterId, characterName, trackId, trackName) {
    const requestId = foundry.utils.randomID();

    // Get the character to retrieve playlistId (prefer new music.playlists, fall back to legacy)
    const char = Store.characters.get(characterId);
    const playlistId = char?.music?.playlists?.[0] || char?.musicPlaylistId || null;

    const payload = {
      requestId,
      userId: game.user.id,
      userName: game.user.name,
      characterId,
      characterName,
      playlistId,
      trackId,
      trackName
    };

    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-request',
      data: payload
    });
    this._onMusicRequest(payload);

    ui.notifications.info(format('Notifications.MusicRequestSentSocket', { track: trackName }));
  }

  /**
   * Emits music request approval from GM.
   * @param {Object} data - Approval data
   */
  static emitMusicRequestApprove(data) {
    const payload = {
      ...data,
      approverId: game.user.id
    };

    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-request-approve',
      data: payload
    });
    this._onMusicRequestApprove(payload);
  }

  /**
   * Emits music request denial from GM.
   * @param {Object} data - Denial data
   */
  static emitMusicRequestDeny(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-request-deny',
      data
    });
    this._onMusicRequestDeny(data);
  }

  /**
   * Emits a YouTube music add request from player to GM.
   * @param {string} characterId - Character ID
   * @param {string} characterName - Character name
   * @param {string} playlistId - Target playlist ID
   * @param {string} trackName - Track display name
   * @param {string} trackUrl - YouTube URL
   */
  static emitMusicAddRequest(characterId, characterName, playlistId, trackName, trackUrl) {
    const requestId = foundry.utils.randomID();
    const payload = {
      requestId,
      userId: game.user.id,
      userName: game.user.name,
      characterId,
      characterName,
      playlistId,
      trackName,
      trackUrl
    };

    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-add-request',
      data: payload
    });
    this._onMusicAddRequest(payload);
  }

  /**
   * Emits YouTube music add approval from GM.
   * @param {Object} data - Approval data
   */
  static emitMusicAddApprove(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-add-approve',
      data
    });
    this._onMusicAddApprove(data);
  }

  /**
   * Emits YouTube music add denial from GM.
   * @param {Object} data - Denial data
   */
  static emitMusicAddDeny(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-add-deny',
      data
    });
    this._onMusicAddDeny(data);
  }

  /**
   * Emits a playback failure for a recently approved YouTube add request.
   * Used when a specific player cannot play the approved YouTube embed.
   * @param {Object} data - Failure payload
   */
  static emitMusicAddPlaybackFailed(data) {
    game.socket.emit(CONFIG.SOCKET_NAME, {
      type: 'music-add-playback-failed',
      data
    });
  }
}
