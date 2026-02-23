import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { SocketHandler } from '../data/SocketHandler.js';
import { CharacterEditor } from './CharacterEditor.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * PlayerPanel - A simplified panel for players to manage their assigned characters
 * Shows only characters the player has permission to edit (emotion or full access)
 */
export class ExaltedScenesPlayerPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.uiState = {
      emotionPicker: { open: false, characterId: null, x: 0, y: 0 },
      borderPicker: { open: false, characterId: null, x: 0, y: 0 },
      musicPicker: { open: false, characterId: null, x: 0, y: 0, searchQuery: '' }
    };
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
      'select-border': ExaltedScenesPlayerPanel._onSelectBorder,
      'edit-character': ExaltedScenesPlayerPanel._onEditCharacter,
      'open-music-picker': ExaltedScenesPlayerPanel._onOpenMusicPicker,
      'close-music-picker': ExaltedScenesPlayerPanel._onCloseMusicPicker,
      'request-track': ExaltedScenesPlayerPanel._onRequestTrack,
      'back-to-emotions-from-music': ExaltedScenesPlayerPanel._onBackToEmotionsFromMusic
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
          currentState: char.currentState,
          borderStyle: char.borderStyle || 'gold',
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
          isFavorite: favoriteEmotions.has(key)
        }));
        emotions.sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.key.localeCompare(b.key);
        });

        const canEditBorder = char.hasPermission(userId, 'full');
        const hasMusicPlaylist = !!char.musicPlaylistId;

        pickerContext = {
          character: char,
          emotions: emotions,
          x: this.uiState.emotionPicker.x,
          y: this.uiState.emotionPicker.y,
          canEditBorder: canEditBorder,
          hasMusicPlaylist: hasMusicPlaylist
        };
      }
    }

    // Prepare Border Picker Context
    let borderPickerContext = null;
    if (this.uiState.borderPicker.open && this.uiState.borderPicker.characterId) {
      const char = Store.characters.get(this.uiState.borderPicker.characterId);
      if (char) {
        const currentBorder = char.borderStyle || 'gold';
        const presets = CONFIG.BORDER_PRESETS;

        const solid = [];
        const gradient = [];
        const animated = [];
        const styled = [];

        for (const [key, preset] of Object.entries(presets)) {
          const item = {
            key,
            name: preset.name,
            active: currentBorder === key,
            color: preset.color || '#888'
          };

          if (preset.type === 'solid') solid.push(item);
          else if (preset.type === 'gradient') gradient.push(item);
          else if (preset.type === 'animated') animated.push(item);
          else if (preset.type === 'styled') styled.push(item);
        }

        borderPickerContext = {
          character: char,
          solid,
          gradient,
          animated,
          styled,
          x: this.uiState.borderPicker.x,
          y: this.uiState.borderPicker.y
        };
      }
    }

    // Prepare Music Picker Context
    let musicPickerContext = null;
    if (this.uiState.musicPicker.open && this.uiState.musicPicker.characterId) {
      const char = Store.characters.get(this.uiState.musicPicker.characterId);
      if (char && char.musicPlaylistId) {
        const tracks = NarratorJukeboxIntegration.getPlaylistTracks(char.musicPlaylistId);
        const playlist = game.playlists.get(char.musicPlaylistId);

        // Filter tracks by search query
        const searchQuery = this.uiState.musicPicker.searchQuery?.toLowerCase() || '';
        const filteredTracks = searchQuery
          ? tracks.filter(t => t.name.toLowerCase().includes(searchQuery))
          : tracks;

        musicPickerContext = {
          character: char,
          playlistName: playlist?.name || 'Playlist',
          tracks: filteredTracks,
          totalTracks: tracks.length,
          hasSearch: tracks.length > 5,
          x: this.uiState.musicPicker.x,
          y: this.uiState.musicPicker.y
        };
      }
    }

    return {
      characters: myCharacters,
      hasCharacters: myCharacters.length > 0,
      emotionPicker: pickerContext,
      borderPicker: borderPickerContext,
      musicPicker: musicPickerContext,
      isBroadcasting: Store.isBroadcasting
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER HOOKS
     ═══════════════════════════════════════════════════════════════ */

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind music search input
    const musicSearchInput = this.element.querySelector('.es-music-picker__search-input');
    if (musicSearchInput) {
      musicSearchInput.addEventListener('input', (e) => {
        this.uiState.musicPicker.searchQuery = e.target.value;
        this.render();
      });
      // Maintain focus after re-render
      if (this.uiState.musicPicker.searchQuery) {
        musicSearchInput.focus();
        musicSearchInput.value = this.uiState.musicPicker.searchQuery;
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
      });
    }
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

    const rect = target.getBoundingClientRect();

    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: rect.left + (rect.width / 2),
      y: rect.top
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

  static _onOpenBorderPicker(event, target) {
    const charId = this.uiState.emotionPicker.characterId;
    const x = this.uiState.emotionPicker.x;
    const y = this.uiState.emotionPicker.y;

    this.uiState.emotionPicker.open = false;
    this.uiState.borderPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y
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

    this.uiState.borderPicker.open = false;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y
    };
    this.render();
  }

  static _onSelectBorder(event, target) {
    const charId = this.uiState.borderPicker.characterId;
    const preset = target.dataset.preset;

    SocketHandler.emitUpdateBorder(charId, preset);

    this.render();
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

    this.uiState.emotionPicker.open = false;
    this.uiState.musicPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y,
      searchQuery: ''
    };
    this.render();
  }

  static _onCloseMusicPicker(event, target) {
    this.uiState.musicPicker.open = false;
    this.render();
  }

  static _onBackToEmotionsFromMusic(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const x = this.uiState.musicPicker.x;
    const y = this.uiState.musicPicker.y;

    this.uiState.musicPicker.open = false;
    this.uiState.emotionPicker = {
      open: true,
      characterId: charId,
      x: x,
      y: y
    };
    this.render();
  }

  static _onRequestTrack(event, target) {
    const charId = this.uiState.musicPicker.characterId;
    const trackId = target.dataset.trackId;
    const trackName = target.dataset.trackName;

    const char = Store.characters.get(charId);
    if (!char || !char.musicPlaylistId) return;

    // Send music request via socket
    SocketHandler.emitMusicRequest(charId, char.name, trackId, trackName);

    // Close the picker
    this.uiState.musicPicker.open = false;
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
