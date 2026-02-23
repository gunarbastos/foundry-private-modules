import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { localize, format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(characterId, options = {}) {
    super(options);
    this.characterId = characterId;
    
    // Clone data for editing to avoid direct mutation until save
    const char = Store.characters.get(characterId);
    if (!char) throw new Error(`Character ${characterId} not found`);

    this.uiState = {
      activeTab: 'identity',
      data: {
        name: char.name,
        tags: Array.from(char.tags),
        states: { ...char.states }, // Clone states
        locked: char.locked || false, // Lock state
        actorId: char.actorId || null, // Linked Foundry Actor
        musicPlaylistId: char.musicPlaylistId || null // Player music request playlist
      }
    };
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-character-editor',
    classes: ['exalted-scenes', 'es-char-editor'],
    window: {
      title: 'Edit Character',
      icon: 'fas fa-user-edit',
      resizable: true,
      controls: []
    },
    position: {
      width: 520,
      height: 680
    },
    actions: {
      'tab-switch': CharacterEditor._onTabSwitch,
      'remove-tag': CharacterEditor._onRemoveTag,
      'rename-emotion': CharacterEditor._onRenameEmotion,
      'delete-emotion': CharacterEditor._onDeleteEmotion,
      'add-emotion': CharacterEditor._onAddEmotion,
      'delete-character': CharacterEditor._onDeleteCharacter,
      'toggle-lock': CharacterEditor._onToggleLock,
      'open-permissions': CharacterEditor._onOpenPermissions,
      'clear-actor-link': CharacterEditor._onClearActorLink,
      'clear-music-playlist': CharacterEditor._onClearMusicPlaylist,
      'change-avatar': CharacterEditor._onChangeAvatar,
      'save': CharacterEditor._onSave,
      'close': CharacterEditor._onClose
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/character-editor.hbs',
      scrollable: ['.es-char-editor__content']
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  async _prepareContext(options) {
    const char = Store.characters.get(this.characterId);
    if (!char) return {};

    // Prepare emotions list
    const emotions = Object.entries(this.uiState.data.states).map(([key, path]) => ({
      key,
      path
    }));

    // Check if user can browse files (players typically can't)
    const canBrowseFiles = game.user.isGM || game.user.can("FILES_BROWSE");

    // Prepare list of available Actors for linking (GM only)
    let availableActors = [];
    let linkedActor = null;
    let availablePlaylists = [];
    let linkedPlaylist = null;
    const hasNarratorJukebox = NarratorJukeboxIntegration.isAvailable;

    if (game.user.isGM) {
      availableActors = game.actors.contents
        .filter(a => a.visible)
        .map(a => ({ id: a.id, name: a.name, img: a.img }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get currently linked actor info
      if (this.uiState.data.actorId) {
        const actor = game.actors.get(this.uiState.data.actorId);
        if (actor) {
          linkedActor = { id: actor.id, name: actor.name, img: actor.img };
        }
      }

      // Get available playlists for music requests (from Narrator Jukebox)
      const njPlaylists = NarratorJukeboxIntegration.getAllPlaylists();
      availablePlaylists = njPlaylists.map(p => {
        // Get track count from the playlist
        const tracks = NarratorJukeboxIntegration.getPlaylistTracks(p.id);
        return { id: p.id, name: p.name, trackCount: tracks.length };
      }).sort((a, b) => a.name.localeCompare(b.name));

      // Get currently linked playlist info (from Narrator Jukebox)
      if (this.uiState.data.musicPlaylistId) {
        const playlist = NarratorJukeboxIntegration.getPlaylist(this.uiState.data.musicPlaylistId);
        if (playlist) {
          const tracks = NarratorJukeboxIntegration.getPlaylistTracks(playlist.id);
          linkedPlaylist = { id: playlist.id, name: playlist.name, trackCount: tracks.length };
        }
      }
    }

    return {
      character: {
        ...this.uiState.data,
        image: char.image // Use current image for avatar
      },
      emotions: emotions,
      activeTab: this.uiState.activeTab,
      locked: this.uiState.data.locked,
      canBrowseFiles: canBrowseFiles,
      isGM: game.user.isGM,
      availableActors: availableActors,
      linkedActor: linkedActor,
      availablePlaylists: availablePlaylists,
      linkedPlaylist: linkedPlaylist,
      hasNarratorJukebox: hasNarratorJukebox
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind Name Input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.uiState.data.name = e.target.value;
      });
    }

    // Bind File Picker for New Emotion (supports images and videos)
    const pickerBtn = this.element.querySelector('.es-char-editor__file-btn');
    if (pickerBtn) {
      pickerBtn.addEventListener('click', (e) => {
        const targetInput = this.element.querySelector('input[name="newEmotionPath"]');
        new FilePicker({
          type: 'imagevideo',
          callback: (path) => {
            targetInput.value = path;
          }
        }).render(true);
      });
    }

    // Bind Tag Input (Enter Key)
    const tagInput = this.element.querySelector('.es-char-editor__tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tag = e.target.value.trim();
          if (tag && !this.uiState.data.tags.includes(tag)) {
            this.uiState.data.tags.push(tag);
            e.target.value = '';
            this.render();
          }
        }
      });
    }

    // Bind Actor Link Select
    const actorSelect = this.element.querySelector('select[name="actorId"]');
    if (actorSelect) {
      actorSelect.addEventListener('change', (e) => {
        this.uiState.data.actorId = e.target.value || null;
        this.render();
      });
    }

    // Bind Music Playlist Select
    const playlistSelect = this.element.querySelector('select[name="musicPlaylistId"]');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (e) => {
        this.uiState.data.musicPlaylistId = e.target.value || null;
        this.render();
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onTabSwitch(event, target) {
    this.uiState.activeTab = target.dataset.tab;
    this.render();
  }

  static _onClose(event, target) {
    this.close();
  }

  // --- TAGS ---

  static _onRemoveTag(event, target) {
    const tag = target.dataset.tag;
    this.uiState.data.tags = this.uiState.data.tags.filter(t => t !== tag);
    this.render();
  }

  // --- EMOTIONS ---

  static _onRenameEmotion(event, target) {
    const originalKey = target.dataset.originalKey;
    const newKey = target.value.trim();
    
    if (newKey && newKey !== originalKey) {
      const path = this.uiState.data.states[originalKey];
      delete this.uiState.data.states[originalKey];
      this.uiState.data.states[newKey] = path;
    }
  }

  static _onDeleteEmotion(event, target) {
    const key = target.dataset.key;
    delete this.uiState.data.states[key];
    this.render();
  }

  static _onAddEmotion(event, target) {
    const nameInput = this.element.querySelector('input[name="newEmotionName"]');
    const pathInput = this.element.querySelector('input[name="newEmotionPath"]');

    const name = nameInput.value.trim();
    const path = pathInput.value.trim();

    if (name && path) {
      this.uiState.data.states[name] = path;
      this.render();
    } else {
      ui.notifications.warn(localize('Notifications.WarnNoNameAndPathEmotion'));
    }
  }

  // --- LOCK ---

  static _onToggleLock(event, target) {
    this.uiState.data.locked = !this.uiState.data.locked;
    this.render();
  }

  // --- PERMISSIONS ---

  static _onOpenPermissions(event, target) {
    import('./PermissionEditor.js').then(({ PermissionEditor }) => {
      PermissionEditor.open(this.characterId);
    });
  }

  // --- ACTOR LINK ---

  static _onClearActorLink(event, target) {
    this.uiState.data.actorId = null;
    this.render();
  }

  // --- MUSIC PLAYLIST ---

  static _onClearMusicPlaylist(event, target) {
    this.uiState.data.musicPlaylistId = null;
    this.render();
  }

  // --- AVATAR ---

  static _onChangeAvatar(event, target) {
    const char = Store.characters.get(this.characterId);
    new FilePicker({
      type: 'image',
      current: char?.image,
      callback: (path) => {
        // Update the character image directly
        if (char) {
          char.image = path;
          Store.saveData();
          this.render();
        }
      }
    }).render(true);
  }

  // --- SAVE & DELETE ---

  static async _onSave(event, target) {
    const char = Store.characters.get(this.characterId);
    if (!char) return;

    // Add loading state to button
    const btn = target;
    const originalHtml = btn.innerHTML;
    btn.classList.add('es-btn-loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
      // Update Character Model
      char.name = this.uiState.data.name;
      char.tags = new Set(this.uiState.data.tags);
      char.states = this.uiState.data.states;
      char.locked = this.uiState.data.locked;
      char.actorId = this.uiState.data.actorId;
      char.musicPlaylistId = this.uiState.data.musicPlaylistId;

      // Ensure current state is valid
      if (!char.states[char.currentState]) {
        char.currentState = Object.keys(char.states)[0] || 'normal';
      }

      await Store.saveData();

      // Broadcast lock change to all clients
      const { SocketHandler } = await import('../data/SocketHandler.js');
      SocketHandler.emitUpdateLock(char.id, char.locked);

      ui.notifications.info(format('Notifications.CharacterSavedName', { name: char.name }));

      this.close();

      // Refresh GM Panel
      const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
      if (gmPanel) gmPanel.render();
    } catch (error) {
      console.error('Exalted Scenes | Error saving character:', error);
      ui.notifications.error(localize('Notifications.ErrorSaveCharacter'));
      // Restore button state on error
      btn.classList.remove('es-btn-loading');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  static async _onDeleteCharacter(event, target) {
    const char = Store.characters.get(this.characterId);
    
    Dialog.confirm({
      title: format('Dialog.DeleteCharacter.Title', { name: char.name }),
      content: format('Dialog.DeleteCharacter.Content', { name: char.name }),
      yes: async () => {
        Store.deleteItem(this.characterId, 'character');
        ui.notifications.info(format('Notifications.CharacterDeletedName', { name: char.name }));
        this.close();
        
        // Refresh GM Panel
        const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
        if (gmPanel) gmPanel.render();
      },
      no: () => {},
      defaultYes: false
    });
  }
}
