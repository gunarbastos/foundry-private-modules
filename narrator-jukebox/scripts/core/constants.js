/**
 * Narrator's Jukebox - Constants and Configuration
 * Centralized location for all magic numbers and configuration values
 */

// Module Identity
export const JUKEBOX = {
  ID: 'narrator-jukebox',
  TITLE: "Narrator's Jukebox",
  SOCKET: 'module.narrator-jukebox',
  SETTINGS: {
    MUSIC: 'music',
    AMBIENCE: 'ambience',
    SOUNDBOARD: 'soundboard',
    PLAYLISTS: 'playlists',
    VOLUME: 'volume',
    AMBIENCE_VOLUME: 'ambienceVolume',
    SOUNDBOARD_VOLUME: 'soundboardVolume',
    MUSIC_MUTED: 'musicMuted',
    AMBIENCE_MUTED: 'ambienceMuted',
    // Ambience Layer Mixer settings
    AMBIENCE_PRESETS: 'ambiencePresets',
    ACTIVE_AMBIENCE_LAYERS: 'activeAmbienceLayers',
    AMBIENCE_MASTER_VOLUME: 'ambienceMasterVolume',
    // Debug
    DEBUG: 'debug'
  }
};

// Ambience Layer Mixer Configuration
export const MAX_AMBIENCE_LAYERS = 8;

// Public API Configuration
export const API_VERSION = '1.0.0';

// API Hook Names (for reference)
export const API_HOOKS = {
  READY: 'narratorJukebox.ready',
  PLAY: 'narratorJukebox.play',
  PAUSE: 'narratorJukebox.pause',
  RESUME: 'narratorJukebox.resume',
  STOP: 'narratorJukebox.stop',
  TRACK_CHANGED: 'narratorJukebox.trackChanged',
  PLAYLIST_STARTED: 'narratorJukebox.playlistStarted',
  SEEK: 'narratorJukebox.seek',
  VOLUME_CHANGED: 'narratorJukebox.volumeChanged',
  MUTE_CHANGED: 'narratorJukebox.muteChanged',
  SHUFFLE_CHANGED: 'narratorJukebox.shuffleChanged',
  LOOP_CHANGED: 'narratorJukebox.loopChanged',
  PREVIEW_MODE_CHANGED: 'narratorJukebox.previewModeChanged',
  SOUNDBOARD_PLAY: 'narratorJukebox.soundboard.play',
  SOUNDBOARD_STOP: 'narratorJukebox.soundboard.stop',
  SOUNDBOARD_STOP_ALL: 'narratorJukebox.soundboard.stopAll',
  // Ambience Layer Mixer hooks
  AMBIENCE_LAYER_ADDED: 'narratorJukebox.ambience.layerAdded',
  AMBIENCE_LAYER_REMOVED: 'narratorJukebox.ambience.layerRemoved',
  AMBIENCE_LAYERS_CHANGED: 'narratorJukebox.ambience.layersChanged',
  AMBIENCE_PRESET_LOADED: 'narratorJukebox.ambience.presetLoaded',
  AMBIENCE_STOPPED_ALL: 'narratorJukebox.ambience.stoppedAll',
  ERROR: 'narratorJukebox.error'
};

// Audio Fade Configuration
export const FADE_DURATION = 2000;      // Total fade duration in ms
export const FADE_STEP = 0.05;          // Volume step per interval (local audio)
export const FADE_INTERVAL = 50;        // Interval between steps in ms
export const YOUTUBE_VOLUME_STEP = 5;   // Volume step for YouTube (0-100 scale)
export const YOUTUBE_FADE_INTERVAL = 100; // Fade interval for YouTube in ms

// UI Configuration
export const DEBOUNCE_DELAY = 300;      // Default debounce delay in ms
export const DISPLAY_LIMIT = 50;        // Default number of items to show
export const PREV_RESTART_THRESHOLD = 3; // Seconds before prev restarts track
export const SOUNDBOARD_END_CHECK = 100; // Interval for soundboard end check in ms
export const PROGRESS_UPDATE_INTERVAL = 500; // Progress bar update interval in ms

// Audio Extensions
export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'webm', 'flac', 'm4a', 'aac'];

// Soundboard Color Presets
export const SOUNDBOARD_COLORS = [
  '#1db954', // Spotify green
  '#e91e63', // Pink
  '#ff9800', // Orange
  '#2196f3', // Blue
  '#9c27b0', // Purple
  '#00bcd4', // Cyan
  '#ff5722', // Deep Orange
  '#607d8b'  // Blue Grey
];

// Soundboard Color Presets (Alternative set for dialogs)
export const SOUNDBOARD_COLOR_PRESETS = [
  { color: '#ff6b35', name: 'Orange' },
  { color: '#e74c3c', name: 'Red' },
  { color: '#9b59b6', name: 'Purple' },
  { color: '#3498db', name: 'Blue' },
  { color: '#1abc9c', name: 'Teal' },
  { color: '#2ecc71', name: 'Green' },
  { color: '#f39c12', name: 'Yellow' },
  { color: '#e91e63', name: 'Pink' }
];

// Mood Preset Gradients - Organized by category
export const MOOD_GRADIENTS = {
  combat: [
    { name: 'Fire', value: 'linear-gradient(135deg, #f12711, #f5af19)' },
    { name: 'Ember', value: 'linear-gradient(135deg, #ff416c, #ff4b2b)' },
    { name: 'Blood', value: 'linear-gradient(135deg, #8E0E00, #1F1C18)' },
    { name: 'Inferno', value: 'linear-gradient(135deg, #ff0844, #ffb199)' },
    { name: 'Rage', value: 'linear-gradient(135deg, #ED213A, #93291E)' }
  ],
  magic: [
    { name: 'Purple Haze', value: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { name: 'Mystic', value: 'linear-gradient(135deg, #41295a, #2F0743)' },
    { name: 'Arcane', value: 'linear-gradient(135deg, #8E2DE2, #4A00E0)' },
    { name: 'Enchanted', value: 'linear-gradient(135deg, #c471f5, #fa71cd)' },
    { name: 'Nebula', value: 'linear-gradient(135deg, #E040FB, #536DFE)' }
  ],
  nature: [
    { name: 'Forest', value: 'linear-gradient(135deg, #11998e, #38ef7d)' },
    { name: 'Mint', value: 'linear-gradient(135deg, #00b09b, #96c93d)' },
    { name: 'Leaf', value: 'linear-gradient(135deg, #134E5E, #71B280)' },
    { name: 'Jungle', value: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)' },
    { name: 'Spring', value: 'linear-gradient(135deg, #00d2ff, #3a7bd5)' }
  ],
  water: [
    { name: 'Ocean', value: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
    { name: 'Deep Sea', value: 'linear-gradient(135deg, #1A2980, #26D0CE)' },
    { name: 'Tidal', value: 'linear-gradient(135deg, #0052D4, #65C7F7, #9CECFB)' },
    { name: 'Arctic', value: 'linear-gradient(135deg, #74ebd5, #ACB6E5)' },
    { name: 'Frozen', value: 'linear-gradient(135deg, #c2e9fb, #a1c4fd)' }
  ],
  dark: [
    { name: 'Night', value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
    { name: 'Midnight', value: 'linear-gradient(135deg, #232526, #414345)' },
    { name: 'Shadow', value: 'linear-gradient(135deg, #000000, #434343)' },
    { name: 'Abyss', value: 'linear-gradient(135deg, #0f0f0f, #2d2d2d)' },
    { name: 'Void', value: 'linear-gradient(135deg, #16222A, #3A6073)' }
  ],
  calm: [
    { name: 'Rose', value: 'linear-gradient(135deg, #ee9ca7, #ffdde1)' },
    { name: 'Dusk', value: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
    { name: 'Peach', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
    { name: 'Blossom', value: 'linear-gradient(135deg, #f6d365, #fda085)' },
    { name: 'Serenity', value: 'linear-gradient(135deg, #89f7fe, #66a6ff)' }
  ],
  sky: [
    { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { name: 'Dawn', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
    { name: 'Twilight', value: 'linear-gradient(135deg, #544a7d, #ffd452)' },
    { name: 'Aurora', value: 'linear-gradient(135deg, #00c6ff, #0072ff)' },
    { name: 'Golden Hour', value: 'linear-gradient(135deg, #f7971e, #ffd200)' }
  ],
  weather: [
    { name: 'Storm', value: 'linear-gradient(135deg, #373b44, #4286f4)' },
    { name: 'Thunder', value: 'linear-gradient(135deg, #0F2027, #2C5364)' },
    { name: 'Lightning', value: 'linear-gradient(135deg, #f7ff00, #db36a4)' },
    { name: 'Fog', value: 'linear-gradient(135deg, #606c88, #3f4c6b)' },
    { name: 'Sandstorm', value: 'linear-gradient(135deg, #c79081, #dfa579)' }
  ],
  royal: [
    { name: 'Royal', value: 'linear-gradient(135deg, #141E30, #243B55)' },
    { name: 'Crown', value: 'linear-gradient(135deg, #F7971E, #FFD200)' },
    { name: 'Imperial', value: 'linear-gradient(135deg, #360033, #0b8793)' },
    { name: 'Majestic', value: 'linear-gradient(135deg, #5f2c82, #49a09d)' },
    { name: 'Regal', value: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)' }
  ]
};

// Flatten gradients for easy iteration
export const ALL_MOOD_GRADIENTS = Object.values(MOOD_GRADIENTS).flat();

// Popular FontAwesome Icons - Organized by category for RPG moods
export const MOOD_ICONS = {
  combat: [
    'fas fa-sword', 'fas fa-shield-alt', 'fas fa-axe', 'fas fa-bow-arrow',
    'fas fa-fist-raised', 'fas fa-skull-crossbones', 'fas fa-skull', 'fas fa-khanda',
    'fas fa-bomb', 'fas fa-crosshairs', 'fas fa-bullseye', 'fas fa-chess-knight'
  ],
  magic: [
    'fas fa-magic', 'fas fa-hat-wizard', 'fas fa-wand-magic', 'fas fa-fire-alt',
    'fas fa-bolt', 'fas fa-star', 'fas fa-moon', 'fas fa-sun',
    'fas fa-hand-sparkles', 'fas fa-scroll', 'fas fa-book-spells', 'fas fa-crystal-ball'
  ],
  creatures: [
    'fas fa-dragon', 'fas fa-spider', 'fas fa-ghost', 'fas fa-cat',
    'fas fa-crow', 'fas fa-horse', 'fas fa-wolf-pack-battalion', 'fas fa-bat',
    'fas fa-snake', 'fas fa-fish', 'fas fa-bug', 'fas fa-paw'
  ],
  nature: [
    'fas fa-leaf', 'fas fa-tree', 'fas fa-seedling', 'fas fa-mountain',
    'fas fa-water', 'fas fa-wind', 'fas fa-snowflake', 'fas fa-cloud',
    'fas fa-feather', 'fas fa-flower', 'fas fa-sun', 'fas fa-rainbow'
  ],
  places: [
    'fas fa-dungeon', 'fas fa-castle', 'fas fa-church', 'fas fa-home',
    'fas fa-campground', 'fas fa-landmark', 'fas fa-monument', 'fas fa-torii-gate',
    'fas fa-archway', 'fas fa-store', 'fas fa-warehouse', 'fas fa-city'
  ],
  emotions: [
    'fas fa-heart', 'fas fa-heart-broken', 'fas fa-grin-tears', 'fas fa-sad-tear',
    'fas fa-angry', 'fas fa-surprise', 'fas fa-meh', 'fas fa-laugh',
    'fas fa-tired', 'fas fa-dizzy', 'fas fa-grimace', 'fas fa-grin-stars'
  ],
  objects: [
    'fas fa-gem', 'fas fa-coins', 'fas fa-crown', 'fas fa-key',
    'fas fa-lock', 'fas fa-hourglass', 'fas fa-compass', 'fas fa-map',
    'fas fa-chess', 'fas fa-dice-d20', 'fas fa-ring', 'fas fa-trophy'
  ],
  music: [
    'fas fa-music', 'fas fa-guitar', 'fas fa-drum', 'fas fa-headphones',
    'fas fa-volume-up', 'fas fa-microphone', 'fas fa-record-vinyl', 'fas fa-bell',
    'fas fa-broadcast-tower', 'fas fa-radio', 'fas fa-sliders-h', 'fas fa-wave-square'
  ],
  spiritual: [
    'fas fa-cross', 'fas fa-pray', 'fas fa-bible', 'fas fa-church',
    'fas fa-dove', 'fas fa-hand-holding-heart', 'fas fa-yin-yang', 'fas fa-om',
    'fas fa-ankh', 'fas fa-peace', 'fas fa-star-of-david', 'fas fa-menorah'
  ],
  misc: [
    'fas fa-fire', 'fas fa-anchor', 'fas fa-flask', 'fas fa-eye',
    'fas fa-binoculars', 'fas fa-search', 'fas fa-cog', 'fas fa-flag',
    'fas fa-hammer', 'fas fa-wrench', 'fas fa-quill', 'fas fa-pen-fancy'
  ]
};

// Default folders for file pickers
export const DEFAULT_FOLDERS = {
  music: 'audio/music',
  ambience: 'audio/ambience',
  soundboard: 'audio/soundboard'
};
