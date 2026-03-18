import { CONFIG, log } from '../config.js';
import { Store } from './Store.js';
import { NarratorJukeboxIntegration } from './NarratorJukeboxIntegration.js';
import { localize } from '../utils/i18n.js';

export class MigrationService {
  static async migrate() {
    log('Checking for migration...');

    // First, check for existing v4 data and normalize it (add new fields)
    const v4Scenes = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.SCENES);
    const v4Characters = game.settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.CHARACTERS);

    let needsSave = false;

    // Normalize scenes - add layoutSettings if missing
    if (v4Scenes && v4Scenes.length > 0) {
      for (const scene of v4Scenes) {
        if (!scene.layoutSettings) {
          scene.layoutSettings = {
            preset: 'bottom-center',
            size: 'medium',
            spacing: 24,
            offsetX: 0,
            offsetY: 5
          };
          needsSave = true;
        }
      }
    }

    // Normalize characters - add permissions if missing
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        if (!char.permissions) {
          char.permissions = {
            default: 'none',
            players: {}
          };
          needsSave = true;
        }
      }
    }

    // v6.0 migration: Reshape scene audio from flat to expanded schema
    if (v4Scenes && v4Scenes.length > 0) {
      for (const scene of v4Scenes) {
        if (scene.audio && !scene.audio._migrated) {
          const audio = scene.audio;
          // Detect old-format audio: has playlistId/ambiencePresetId but no tracks[]
          if ((audio.playlistId || audio.ambiencePresetId) && !audio.tracks) {
            log(`Migrating audio for scene "${scene.name}" to v6.0 schema`);
            scene.audio = {
              tracks: [],
              layers: [],
              sounds: [],
              volume: 1.0,
              fadeOut: 0,
              playbackMode: 'sequential',
              autoPlayMusic: audio.autoPlayMusic ?? false,
              autoPlayAmbience: audio.autoPlayAmbience ?? false,
              stopOnEnd: audio.stopOnEnd ?? false,
              _legacyPlaylistId: audio.playlistId || null,
              _legacyAmbiencePresetId: audio.ambiencePresetId || null,
              _migrated: true
            };
            needsSave = true;
          }
        }
      }
    }

    // v6.0 migration: Reshape character musicPlaylistId to music object
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        if (char.musicPlaylistId && !char.music) {
          log(`Migrating music for character "${char.name}" to v6.0 schema`);
          char.music = {
            playlists: [char.musicPlaylistId],
            playlistNames: char.musicPlaylistName ? { [char.musicPlaylistId]: char.musicPlaylistName } : {},
            entranceSoundId: null
          };
          // Keep musicPlaylistId for backward compat in serialized form
          needsSave = true;
        }
      }
    }

    // v6.2 migration: Persist playlist names alongside assigned playlist IDs
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        const playlistIds = char.music?.playlists || (char.musicPlaylistId ? [char.musicPlaylistId] : []);
        if (!playlistIds.length) continue;

        if (!char.music) {
          char.music = {
            playlists: [...playlistIds],
            playlistNames: {},
            entranceSoundId: null
          };
          needsSave = true;
        }

        if (!char.music.playlistNames || typeof char.music.playlistNames !== 'object') {
          char.music.playlistNames = {};
          needsSave = true;
        }

        for (const playlistId of playlistIds) {
          if (!playlistId || char.music.playlistNames[playlistId]) continue;

          const resolvedName = NarratorJukeboxIntegration.getPlaylistName(
            playlistId,
            char.musicPlaylistId === playlistId ? char.musicPlaylistName : null
          );

          if (resolvedName && resolvedName !== 'Unknown Playlist') {
            char.music.playlistNames[playlistId] = resolvedName;
            needsSave = true;
          }
        }
      }
    }

    // v6.0 migration: Convert borderStyle from string to { effect, color, color2? } object
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        if (char.borderStyle && typeof char.borderStyle === 'string') {
          log(`Migrating border for character "${char.name}" to v6.0 schema`);
          const migrated = CONFIG.BORDER_MIGRATION_MAP[char.borderStyle];
          char.borderStyle = migrated ? { ...migrated } : { ...CONFIG.BORDER_DEFAULT };
          needsSave = true;
        }
      }
    }

    // v6.0 migration: Add heroStates to characters without them
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        if (!char.heroStates) {
          char.heroStates = {};
          char.currentHeroState = null;
          needsSave = true;
        }
      }
    }

    // v6.1 migration: Add per-emotion portrait focus map
    if (v4Characters && v4Characters.length > 0) {
      for (const char of v4Characters) {
        if (!char.stateFocus) {
          char.stateFocus = {};
          needsSave = true;
        }
      }
    }

    // v6.0 migration: Add displayMode to scene layoutSettings
    if (v4Scenes && v4Scenes.length > 0) {
      for (const scene of v4Scenes) {
        if (scene.layoutSettings && !scene.layoutSettings.displayMode) {
          scene.layoutSettings.displayMode = 'token';
          needsSave = true;
        }
      }
    }

    // Save normalized data if changes were made
    if (needsSave) {
      log('Normalizing/migrating data...');
      await game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.SCENES, v4Scenes);
      await game.settings.set(CONFIG.MODULE_ID, CONFIG.SETTINGS.CHARACTERS, v4Characters);
      log('Data normalization complete.');
    }

    // Check if v4 data exists (skip legacy migration if so)
    if (v4Scenes && v4Scenes.length > 0) {
      log('V4+ data found. Skipping legacy migration.');
      return;
    }

    // Try to find v2/v3 data
    // Note: The user previously mentioned 'exalted-scenes.data-v2' and 'exalted-scenes.data-v3'
    // We need to check if those settings keys exist in the world settings storage
    
    // For now, we will look for the most common legacy keys
    let legacyData = null;
    try {
      legacyData = game.settings.get(CONFIG.MODULE_ID, 'data-v3');
    } catch (e) {
      try {
        legacyData = game.settings.get(CONFIG.MODULE_ID, 'data-v2');
      } catch (e2) {
        log('No legacy data found.');
      }
    }

    if (!legacyData) return;

    log('Migrating legacy data...');
    
    // Perform Migration
    // Assuming legacy structure: { scenes: [], characters: [], folders: [] }
    
    if (legacyData.scenes) {
      for (const s of legacyData.scenes) {
        Store.createScene({
          id: s.id,
          name: s.name,
          background: s.background,
          bgType: s.bgType || 'image',
          favorite: s.favorite || false,
          folder: s.folder,
          cast: s.characters || [] // Legacy used 'characters' array in scene
        });
      }
    }

    if (legacyData.characters) {
      for (const c of legacyData.characters) {
        Store.createCharacter({
          id: c.id,
          name: c.name,
          states: c.states || { normal: c.image },
          currentState: c.currentState || 'normal',
          folder: c.folder,
          favorite: c.favorite || false
        });
      }
    }

    log('Migration Complete.');
    ui.notifications.info(localize('Notifications.DataMigrated'));
  }
}
