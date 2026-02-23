/**
 * Internationalization (i18n) Helper
 * Provides utility functions for localization
 */

const MODULE_ID = 'narrator-jukebox';
const PREFIX = 'NARRATOR-JUKEBOX';

/**
 * Get a localized string
 * @param {string} key - The localization key (without module prefix)
 * @returns {string} The localized string
 */
export function localize(key) {
  return game.i18n.localize(`${PREFIX}.${key}`);
}

/**
 * Get a localized string with variable substitution
 * @param {string} key - The localization key (without module prefix)
 * @param {Object} data - Data object for variable substitution
 * @returns {string} The localized string with substitutions
 */
export function format(key, data = {}) {
  return game.i18n.format(`${PREFIX}.${key}`, data);
}

/**
 * Check if a localization key exists
 * @param {string} key - The localization key (without module prefix)
 * @returns {boolean} Whether the key exists
 */
export function has(key) {
  return game.i18n.has(`${PREFIX}.${key}`);
}

/**
 * Shorthand aliases for common keys
 */
export const i18n = {
  // Common buttons
  cancel: () => localize('Common.Cancel'),
  save: () => localize('Common.Save'),
  saveChanges: () => localize('Common.SaveChanges'),
  add: () => localize('Common.Add'),
  delete: () => localize('Common.Delete'),
  edit: () => localize('Common.Edit'),
  optional: () => localize('Common.Optional'),
  browse: () => localize('Common.Browse'),
  apply: () => localize('Common.Apply'),

  // Labels
  labels: {
    name: () => localize('Labels.Name'),
    trackName: () => localize('Labels.TrackName'),
    ambienceName: () => localize('Labels.AmbienceName'),
    soundName: () => localize('Labels.SoundName'),
    playlistName: () => localize('Labels.PlaylistName'),
    presetName: () => localize('Labels.PresetName'),
    source: () => localize('Labels.Source'),
    localFile: () => localize('Labels.LocalFile'),
    youtube: () => localize('Labels.YouTube'),
    filePath: () => localize('Labels.FilePath'),
    youtubeURL: () => localize('Labels.YouTubeURL'),
    url: () => localize('Labels.URL'),
    tags: () => localize('Labels.Tags'),
    thumbnail: () => localize('Labels.Thumbnail'),
    defaultVolume: () => localize('Labels.DefaultVolume'),
    cardColor: () => localize('Labels.CardColor'),
    icon: () => localize('Labels.Icon')
  },

  // Placeholders
  placeholders: {
    enterTrackName: () => localize('Placeholders.EnterTrackName'),
    enterAmbienceName: () => localize('Placeholders.EnterAmbienceName'),
    soundNameExamples: () => localize('Placeholders.SoundNameExamples'),
    selectFileOrPastePath: () => localize('Placeholders.SelectFileOrPastePath'),
    pasteYouTubeURL: () => localize('Placeholders.PasteYouTubeURL'),
    musicTags: () => localize('Placeholders.MusicTags'),
    ambienceTags: () => localize('Placeholders.AmbienceTags'),
    imageURL: () => localize('Placeholders.ImageURL'),
    imageURLAutoFilled: () => localize('Placeholders.ImageURLAutoFilled')
  },

  // Hints
  hints: {
    tagsHelpOrganize: () => localize('Hints.TagsHelpOrganize'),
    tagsHelpOrganizeAmbience: () => localize('Hints.TagsHelpOrganizeAmbience')
  },

  // Validation
  validation: {
    trackNameRequired: () => localize('Validation.TrackNameRequired'),
    ambienceNameRequired: () => localize('Validation.AmbienceNameRequired'),
    soundNameRequired: () => localize('Validation.SoundNameRequired'),
    urlRequired: () => localize('Validation.URLRequired'),
    validURLRequired: () => localize('Validation.ValidURLRequired'),
    invalidYouTubeURL: () => localize('Validation.InvalidYouTubeURL'),
    fixValidationErrors: () => localize('Validation.FixValidationErrors')
  },

  // Notifications
  notify: {
    addedTrack: (name) => format('Notifications.AddedTrack', { name }),
    addedAmbience: (name) => format('Notifications.AddedAmbience', { name }),
    addedSound: (name) => format('Notifications.AddedSound', { name }),
    updated: (name) => format('Notifications.Updated', { name }),
    failedToAdd: (error) => format('Notifications.FailedToAdd', { error }),
    failedToAddAmbience: (error) => format('Notifications.FailedToAddAmbience', { error }),
    failedToUpdate: (error) => format('Notifications.FailedToUpdate', { error })
  },

  // Player
  player: {
    noMusicPlaying: () => localize('Player.NoMusicPlaying'),
    selectTrackToBegin: () => localize('Player.SelectTrackToBegin'),
    noAmbience: () => localize('Player.NoAmbience'),
    selectAnAmbience: () => localize('Player.SelectAnAmbience'),
    play: () => localize('Player.Play'),
    pause: () => localize('Player.Pause')
  },

  // Dialogs
  dialog: {
    music: {
      addTitle: () => localize('Dialog.Music.AddTitle'),
      addTitlePlayer: () => localize('Dialog.Music.AddTitlePlayer'),
      addSubtitle: () => localize('Dialog.Music.AddSubtitle'),
      addSubtitlePlayer: () => localize('Dialog.Music.AddSubtitlePlayer'),
      addButton: () => localize('Dialog.Music.AddButton'),
      suggestButton: () => localize('Dialog.Music.SuggestButton'),
      editTitle: () => localize('Dialog.Music.EditTitle'),
      editHeader: () => localize('Dialog.Music.EditHeader'),
      editSubtitle: (name) => format('Dialog.Music.EditSubtitle', { name })
    },
    ambience: {
      addTitle: () => localize('Dialog.Ambience.AddTitle'),
      addSubtitle: () => localize('Dialog.Ambience.AddSubtitle'),
      addButton: () => localize('Dialog.Ambience.AddButton'),
      editTitle: () => localize('Dialog.Ambience.EditTitle'),
      editSubtitle: (name) => format('Dialog.Ambience.EditSubtitle', { name })
    },
    soundboard: {
      addTitle: () => localize('Dialog.Soundboard.AddTitle'),
      addButton: () => localize('Dialog.Soundboard.AddButton'),
      editTitle: () => localize('Dialog.Soundboard.EditTitle')
    },
    playlist: {
      newTitle: () => localize('Dialog.Playlist.NewTitle'),
      createHeader: () => localize('Dialog.Playlist.CreateHeader'),
      createSubtitle: () => localize('Dialog.Playlist.CreateSubtitle'),
      createButton: () => localize('Dialog.Playlist.CreateButton'),
      addToTitle: () => localize('Dialog.Playlist.AddToTitle'),
      addToButton: () => localize('Dialog.Playlist.AddToButton')
    },
    preset: {
      saveTitle: () => localize('Dialog.Preset.SaveTitle'),
      saveHeader: () => localize('Dialog.Preset.SaveHeader'),
      saveButton: () => localize('Dialog.Preset.SaveButton')
    },
    confirm: {
      deleteTrack: () => localize('Dialog.Confirm.DeleteTrack'),
      deleteTrackContent: () => localize('Dialog.Confirm.DeleteTrackContent'),
      deleteAmbience: () => localize('Dialog.Confirm.DeleteAmbience')
    }
  },

  // Colors
  color: (name) => localize(`Colors.${name}`),

  // Icons
  icon: (name) => localize(`Icons.${name}`)
};

export default { localize, format, has, i18n };
