import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { SocketHandler } from '../data/SocketHandler.js';
import { CharacterEditor } from './CharacterEditor.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';
import { borderStyleToInline } from '../utils/border-utils.js';
import { mediaFocusToInlineStyle } from '../utils/media-focus.js';
import {
  applyPopoverPosition,
  buildPopoverAnchorFromElement,
  clonePopoverAnchor,
  getFallbackPopoverAnchor
} from '../utils/popover-position.js';
import { captureTextInputState, restoreTextInputState } from '../utils/text-input-state.js';
import { buildShortcutReference, resolveShortcutText } from '../shortcuts.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * PlayerPanel - A simplified panel for players to manage their assigned characters
 * Shows only characters the player has permission to edit (emotion or full access)
 */
export class ExaltedScenesPlayerPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.uiState = {
      emotionPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, anchor: null },
      borderPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, anchor: null },
      musicPicker: { open: false, characterId: null, x: 0, y: 0, pickerBelow: false, searchQuery: '', anchor: null },
      shortcutsOpen: false
    };

    this._musicSearchState = null;
    this._hasFocusedMusicSearch = false;
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-player-panel',
    classes: ['exalted-scenes', 'player-panel'],
    window: {
      title: 'My Characters',
      icon: 'fas fa-users',
      resizable: true,
      controls: []
    },
    position: {
      width: 400,
      height: 500
    },
    actions: {
      'character-click': ExaltedScenesPlayerPanel._onCharacterClick,
      'select-emotion': ExaltedScenesPlayerPanel._onSelectEmotion,
      'close-picker': ExaltedScenesPlayerPanel._onClosePicker,
      'open-border-picker': ExaltedScenesPlayerPanel._onOpenBorderPicker,
      'close-border-picker': ExaltedScenesPlayerPanel._onCloseBorderPicker,
      'back-to-emotions': ExaltedScenesPlayerPanel._onBackToEmotions,
      'select-effect': ExaltedScenesPlayerPanel._onSelectEffect,
      'select-border-color': ExaltedScenesPlayerPanel._onSelectBorderColor,
      'select-border-color2': ExaltedScenesPlayerPanel._onSelectBorderColor2,
      'open-actor-sheet': ExaltedScenesPlayerPanel._onOpenActorSheet,
      'edit-character': ExaltedScenesPlayerPanel._onEditCharacter,
      'open-music-picker': ExaltedScenesPlayerPanel._onOpenMusicPicker,
      'close-music-picker': ExaltedScenesPlayerPanel._onCloseMusicPicker,
      'request-track': ExaltedScenesPlayerPanel._onRequestTrack,
      'back-to-emotions-from-music': ExaltedScenesPlayerPanel._onBackToEmotionsFromMusic,
      'toggle-shortcuts': ExaltedScenesPlayerPanel._onToggleShortcuts
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/player-panel.hbs'
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     SINGLETON PATTERN
     ═══════════════════════════════════════════════════════════════ */

  static _instance = null;

  static show() {
    if (!this._instance) {
      this._instance = new ExaltedScenesPlayerPanel();
    }
    this._instance.render(true);
    return this._instance;
  }

  _onClose(options) {
    this._renderAbortController?.abort();
    super._onClose?.(options);
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  async _prepareContext(options) {
    const userId = game.user.id;

    // Get all characters the player has permission to edit
    const myCharacters = [];
    Store.characters.forEach((char, id) => {
      const permLevel = char.hasPermission(userId, 'emotion');
      if (permLevel) {
        const canEditBorder = char.hasPermission(userId, 'full');
        myCharacters.push({
          id: char.id,
          name: char.name,
          image: char.image,
          focusStyle: mediaFocusToInlineStyle(char.currentFocus),
          currentState: char.currentState,
          borderStyle: char.borderStyle || { ...CONFIG.BORDER_DEFAULT },
          locked: char.locked || false,
          canEditBorder: canEditBorder
        });
      }
    });

    // Prepare Emotion Picker Context
    let pickerContext = null;
    if (this.uiState.emotionPicker.open && this.uiState.emotionPicker.characterId) {
      const char = Store.characters.get(this.uiState.emotionPicker.characterId);
      if (char) {
        const favoriteEmotions = char.favoriteEmotions || new Set();
        const emotions = Object.entries(char.states).map(([key, path]) => ({
          key,
          path,
          focusStyle: mediaFocusToInlineStyle(char.getStateFocus(key)),
          isFavorite: favoriteEmotions.has(key)
        }));
        emotions.sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.key.localeCompare(b.key);
        });

        const canEditBorder = char.hasPermission(userId, 'full');
        const hasMusicPlaylist = (char.music?.playlists?.length > 0) || !!char.musicPlaylistId;
        let linkedActor = null;
        if (char.actorId) {
          const actor = game.actors.get(char.actorId);
          if (actor && actor.testUserPermission(game.user, "LIMITED")) {
            linkedActor = { id: actor.id, name: actor.name };
          }
        }

        pickerContext = {
          character: char,
          emotions: emotions,
          x: this.uiState.emotionPicker.x,
          y: this.uiState.emotionPicker.y,
          pickerBelow: this.uiState.emotionPicker.pickerBelow || false,
          canEditBorder: canEditBorder,
          hasMusicPlaylist: hasMusicPlaylist,
          linkedActor: linkedActor,
          openActorTitle: linkedActor ? format('Picker.OpenActorSheet', { name: linkedActor.name }) : '',
          pickerModeLabel: localize('CharEditor.Emotions'),
          pickerModeIcon: 'fa-theater-masks',
          pickerCount: emotions.length,
          activeStateLabel: char.currentState || localize('CharEditor.NoEmotionsYet')
        };
      }
    }

    // Prepare Border Picker Context (v6.0: effect-based)
    let borderPickerContext = null;
    if (this.uiState.borderPicker.open && this.uiState.borderPicker.characterId) {
      const char = Store.characters.get(this.uiState.borderPicker.characterId);
      if (char) {
        const currentBorder = char.borderStyle || { ...CONFIG.BORDER_DEFAULT };
        const effects = Object.entries(CONFIG.BORDER_EFFECTS).map(([key, effect]) => ({
          key,
          name: effect.name,
          icon: effect.icon,
          animated: effect.animated,
          colorCount: effect.colorCount,
          active: currentBorder.effect === key
        }));
        const swatches = Object.entries(CONFIG.BORDER_COLORS).map(([key, hex]) => ({
          key,
          hex,
          active: currentBorder.color === hex
        }));

        borderPickerContext = {
          character: char,
          effects,
          swatches,
          currentEffect: currentBorder.effect,
          currentColor: currentBorder.color || CONFIG.BORDER_DEFAULT.color,
          currentColor2: currentBorder.color2 || null,
          showColor2: CONFIG.BORDER_EFFECTS[currentBorder.effect]?.colorCount === 2,
          noColor: CONFIG.BORDER_EFFECTS[currentBorder.effect]?.colorCount === 0,
          x: this.uiState.borderPicker.x,
          y: this.uiState.borderPicker.y,
          pickerBelow: this.uiState.borderPicker.pickerBelow || false
        };
      }
    }

    // Prepare Music Picker Context
    let musicPickerContext = null;
    if (this.uiState.musicPicker.open && this.uiState.musicPicker.characterId) {
      const char = Store.characters.get(this.uiState.musicPicker.characterId);
      const playlistId = char?.music?.playlists?.[0] || char?.musicPlaylistId;
      if (char && playlistId) {
        const tracks = NarratorJukeboxIntegration.getPlaylistTracks(playlistId);
        const playlistName = NarratorJukeboxIntegration.getPlaylistName(
          playlistId,
          char.music?.playlistNames?.[playlistId]
        );

        musicPickerContext = {
          character: char,
          playlistName: playlistName || 'Playlist',
          tracks,
          totalTracks: tracks.length,
          hasSearch: tracks.length > 5,
          x: this.uiState.musicPicker.x,
          y: this.uiState.musicPicker.y,
          pickerBelow: this.uiState.musicPicker.pickerBelow || false
        };
      }
    }

    return {
      characters: myCharacters,
      hasCharacters: myCharacters.length > 0,
      emotionPicker: pickerContext,
      borderPicker: borderPickerContext,
      musicPicker: musicPickerContext,
      isBroadcasting: Store.isBroadcasting,
      shortcutsOpen: this.uiState.shortcutsOpen,
      shortcutButtonLabel: resolveShortcutText('Shortcuts.Button', 'Shortcuts'),
      shortcutDialogTitle: resolveShortcutText('Shortcuts.Title', 'Keyboard Shortcuts'),
      shortcutDialogHint: resolveShortcutText(
        'Shortcuts.RebindHint',
        'Global shortcuts can be changed in Foundry\'s Configure Controls.'
      ),
      shortcutGroups: buildShortcutReference(CONFIG.MODULE_ID, {
        isGM: game.user.isGM,
        context: 'player-panel'
      })
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER HOOKS
     ═══════════════════════════════════════════════════════════════ */

  _onRender(context, options) {
    super._onRender(context, options);

    this._renderAbortController?.abort();
    this._renderAbortController = new AbortController();
    const { signal } = this._renderAbortController;

    document.addEventListener('keydown', (e) => this._handleKeydown(e), { signal, capture: true });
    window.addEventListener('resize', () => this._positionOpenPopovers(), { signal });

    // Bind music search input — filter client-side without re-render (same pattern as emotion search)
    const musicSearchInput = this.element.querySelector('.es-music-picker__search-input');
    if (musicSearchInput) {
      musicSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = this.element.querySelectorAll('.es-music-picker__track');
        items.forEach(item => {
          const label = item.querySelector('.es-music-picker__track-name')?.textContent?.toLowerCase() || '';
          item.style.display = label.includes(query) ? '' : 'none';
        });
      }, { signal });

      if (!this._hasFocusedMusicSearch) {
        musicSearchInput.focus();
        this._hasFocusedMusicSearch = true;
      }
    }

    // Bind emotion search input
    const emotionSearchInput = this.element.querySelector('.es-picker-search-input');
    if (emotionSearchInput) {
      emotionSearchInput.addEventListener('input', (e) => {
        // Filter emotions client-side without re-render
        const query = e.target.value.toLowerCase();
        const items = this.element.querySelectorAll('.es-picker-item');
        items.forEach(item => {
          const label = item.querySelector('.es-picker-label')?.textContent?.toLowerCase() || '';
          item.style.display = label.includes(query) ? '' : 'none';
        });
      }, { signal });
    }

    // Bind custom color inputs for border picker
    const colorInputs = this.element.querySelectorAll('.es-border-color-input');
    for (const input of colorInputs) {
      const target = input.dataset.target;

      input.addEventListener('input', (e) => {
        const charId = this.uiState.borderPicker.characterId;
        if (!charId) return;
        const charEl = this.element.querySelector(`.es-player-panel__character[data-id="${charId}"]`);
        const portrait = charEl?.querySelector('.es-player-panel__portrait');
        if (!portrait) return;

        const char = Store.characters.get(charId);
        if (!char) return;
        const currentBorder = { ...(char.borderStyle || CONFIG.BORDER_DEFAULT) };
        if (target === 'color2') currentBorder.color2 = e.target.value;
        else currentBorder.color = e.target.value;

        const inlineStyle = borderStyleToInline(currentBorder);
        const existing = portrait.style.cssText.replace(/--es-border[^;]*;?\s*/g, '');
        portrait.style.cssText = existing + (existing && inlineStyle ? '; ' : '') + inlineStyle;
      }, { signal });

      input.addEventListener('change', (e) => {
        const charId = this.uiState.borderPicker.characterId;
        if (!charId) return;
        const char = Store.characters.get(charId);
        if (!char) return;
        const currentBorder = { ...(char.borderStyle || CONFIG.BORDER_DEFAULT) };
        if (target === 'color2') currentBorder.color2 = e.target.value;
        else currentBorder.color = e.target.value;

        SocketHandler.emitUpdateBorder(charId, currentBorder);
      }, { signal });
    }

    this._positionOpenPopovers();
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

  _handleKeydown(event) {
    const isOurApp = this.element?.contains(document.activeElement) ||
      document.activeElement === document.body ||
      this.element?.contains(event.target);

    if (!isOurApp) return;

    const isTyping = this._isTypingTarget(event.target);
    const isToggleKey = event.key === '?' || (event.key === '/' && event.shiftKey);

    if (this.uiState.shortcutsOpen) {
      if (event.key === 'Escape' || (!isTyping && isToggleKey)) {
        event.preventDefault();
        event.stopPropagation();
        this.uiState.shortcutsOpen = false;
        this.render();
      }
      return;
    }

    if (!isTyping && isToggleKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      this.uiState.shortcutsOpen = true;
      this.render();
      return;
    }

    if (event.key === 'Escape' && this._closeOpenOverlay()) {
      event.preventDefault();
      event.stopPropagation();
      this.render();
    }
  }

  _closeOpenOverlay() {
    if (this.uiState.musicPicker.open) {
      this.uiState.musicPicker.open = false;
      return true;
    }

    if (this.uiState.borderPicker.open) {
      this.uiState.borderPicker.open = false;
      return true;
    }

    if (this.uiState.emotionPicker.open) {
      this.uiState.emotionPicker.open = false;
      return true;
    }

    return false;
  }

  _isTypingTarget(target) {
    return Boolean(
      target?.matches?.('input, textarea, select, [contenteditable="true"]') ||
      target?.closest?.('input, textarea, select, [contenteditable="true"]')
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onCharacterClick(event, target) {
    const charId = target.dataset.id;
    const character = Store.characters.get(charId);

    if (character?.locked) {
      ui.notifications.warn(format('Notifications.CharacterLocked', { name: character.name }));
      return;
    }

    const anchor = buildPopoverAnchorFromElement(target);
    const pickerBelow = anchor?.preferBelow ?? false;

    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: anchor?.anchorX ?? 0,
      y: pickerBelow ? (anchor?.anchorBelowY ?? 0) : (anchor?.anchorAboveY ?? 0),
      pickerBelow: pickerBelow,
      anchor: clonePopoverAnchor(anchor)
    };
    this.render();
  }

  static _onClosePicker(event, target) {
    this.uiState.emotionPicker.open = false;
    this.render();
  }

  static _onSelectEmotion(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const state = target.dataset.state;

    SocketHandler.emitUpdateEmotion(charId, state);

    this.uiState.emotionPicker.open = false;
    this.render();
  }

  static _onOpenActorSheet(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    if (!charId) return;

    const character = Store.characters.get(charId);
    if (!character?.actorId) return;

    const actor = game.actors.get(character.actorId);
    if (actor) {
      if (actor.testUserPermission(game.user, "LIMITED")) {
        actor.sheet.render(true);
      } else {
        ui.notifications.warn(localize('Notifications.NoPermissionSheet'));
      }
    } else {
      ui.notifications.warn(localize('Notifications.ActorNotFound'));
    }
  }

  static _onOpenBorderPicker(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.emotionPicker.anchor);

    this.uiState.emotionPicker.open = false;
    this.uiState.borderPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      anchor: anchor
    };
    this.render();
  }

  static _onCloseBorderPicker(event, target) {
    this.uiState.borderPicker.open = false;
    this.render();
  }

  static _onBackToEmotions(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const x = this.uiState.borderPicker.x;
    const y = this.uiState.borderPicker.y;
    const pickerBelow = this.uiState.borderPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.borderPicker.anchor);

    this.uiState.borderPicker.open = false;
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
    const char = Store.characters.get(charId);
    if (!char) return;

    const currentBorder = char.borderStyle || { ...CONFIG.BORDER_DEFAULT };
    const newBorder = { ...currentBorder, effect: effectKey };

    const effectDef = CONFIG.BORDER_EFFECTS[effectKey];
    if (effectDef?.colorCount === 0) {
      delete newBorder.color;
      delete newBorder.color2;
    } else if (effectDef?.colorCount === 1) {
      delete newBorder.color2;
    }

    SocketHandler.emitUpdateBorder(charId, newBorder);

    // DOM-only picker update (no full re-render to avoid flash)
    const picker = this.element.querySelector('.es-border-picker');
    if (picker) {
      picker.querySelectorAll('.es-border-effect-option').forEach(el => {
        el.classList.toggle('es-border-effect-option--active', el.dataset.effect === effectKey);
      });
      const colorSections = picker.querySelectorAll('.es-border-category');
      const showColor = effectDef?.colorCount > 0;
      const showColor2 = effectDef?.colorCount === 2;
      if (colorSections[1]) colorSections[1].style.display = showColor ? '' : 'none';
      if (colorSections[2]) colorSections[2].style.display = showColor2 ? '' : 'none';
    }

    // Update portrait inline style
    const charEl = this.element.querySelector(`.es-player-panel__character[data-id="${charId}"]`);
    const portrait = charEl?.querySelector('.es-player-panel__portrait');
    if (portrait) {
      portrait.dataset.effect = newBorder.effect;
      portrait.style.cssText = borderStyleToInline(newBorder);
    }

    this._positionOpenPopovers();
  }

  static _onSelectBorderColor(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const color = target.dataset.color;
    const char = Store.characters.get(charId);
    if (!char) return;

    const currentBorder = char.borderStyle || { ...CONFIG.BORDER_DEFAULT };
    const newBorder = { ...currentBorder, color };
    SocketHandler.emitUpdateBorder(charId, newBorder);

    // DOM-only swatch update
    const row = target.closest('.es-border-color-row');
    if (row) {
      row.querySelectorAll('.es-border-swatch').forEach(el => {
        el.classList.toggle('es-border-swatch--active', el.dataset.color === color);
      });
    }

    // Update portrait inline style
    const charEl = this.element.querySelector(`.es-player-panel__character[data-id="${charId}"]`);
    const portrait = charEl?.querySelector('.es-player-panel__portrait');
    if (portrait) portrait.style.cssText = borderStyleToInline(newBorder);
  }

  static _onSelectBorderColor2(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const color2 = target.dataset.color;
    const char = Store.characters.get(charId);
    if (!char) return;

    const currentBorder = char.borderStyle || { ...CONFIG.BORDER_DEFAULT };
    const newBorder = { ...currentBorder, color2 };
    SocketHandler.emitUpdateBorder(charId, newBorder);

    // DOM-only swatch update
    const row = target.closest('.es-border-color-row');
    if (row) {
      row.querySelectorAll('.es-border-swatch').forEach(el => {
        el.classList.toggle('es-border-swatch--active', el.dataset.color === color2);
      });
    }

    // Update portrait inline style
    const charEl = this.element.querySelector(`.es-player-panel__character[data-id="${charId}"]`);
    const portrait = charEl?.querySelector('.es-player-panel__portrait');
    if (portrait) portrait.style.cssText = borderStyleToInline(newBorder);
  }

  static _onEditCharacter(event, target) {
    event.stopPropagation();
    const charId = target.dataset.id;
    new CharacterEditor(charId).render(true);
  }

  // --- MUSIC PICKER ---

  static _onOpenMusicPicker(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;
    const pickerBelow = this.uiState.emotionPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.emotionPicker.anchor);

    this._musicSearchState = null;
    this._hasFocusedMusicSearch = false;
    this.uiState.emotionPicker.open = false;
    this.uiState.musicPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      pickerBelow: pickerBelow,
      searchQuery: '',
      anchor: anchor
    };
    this.render();
  }

  static _onCloseMusicPicker(event, target) {
    this._musicSearchState = null;
    this._hasFocusedMusicSearch = false;
    this.uiState.musicPicker.open = false;
    this.render();
  }

  static _onBackToEmotionsFromMusic(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const x = this.uiState.musicPicker.x;
    const y = this.uiState.musicPicker.y;
    const pickerBelow = this.uiState.musicPicker.pickerBelow;
    const anchor = clonePopoverAnchor(this.uiState.musicPicker.anchor);

    this._musicSearchState = null;
    this._hasFocusedMusicSearch = false;
    this.uiState.musicPicker.open = false;
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

  static _onRequestTrack(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const trackId = target.dataset.trackId;
    const trackName = target.dataset.trackName;

    const char = Store.characters.get(charId);
    const playlistId = char?.music?.playlists?.[0] || char?.musicPlaylistId;
    if (!char || !playlistId) return;

    // Send music request via socket
    SocketHandler.emitMusicRequest(charId, char.name, trackId, trackName);

    // Close the picker
    this.uiState.musicPicker.open = false;
    this.render();
  }

  static _onToggleShortcuts(event, target) {
    this.uiState.shortcutsOpen = !this.uiState.shortcutsOpen;
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     REFRESH
     ═══════════════════════════════════════════════════════════════ */

  static refresh() {
    if (this._instance) {
      this._instance.render();
    }
  }
}
