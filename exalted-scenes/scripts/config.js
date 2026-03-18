/**
 * @file config.js
 * @description Configuration constants for the Exalted Scenes module.
 * Contains all static configuration including templates, settings keys,
 * transitions, layout presets, size presets, and border style presets.
 *
 * @module config
 */

/**
 * Debug mode flag. When false, debug-level log messages are suppressed.
 * Set to true during development for verbose logging.
 * @type {boolean}
 */
const DEBUG = false;

/**
 * Logs a debug message to the console (only when DEBUG is true).
 * @param {...*} args - Arguments to log
 */
export function log(...args) {
  if (DEBUG) console.log('Exalted Scenes |', ...args);
}

/**
 * Logs a warning message to the console (always visible).
 * @param {...*} args - Arguments to log
 */
export function logWarn(...args) {
  console.warn('Exalted Scenes |', ...args);
}

/**
 * Logs an error message to the console (always visible).
 * @param {...*} args - Arguments to log
 */
export function logError(...args) {
  console.error('Exalted Scenes |', ...args);
}

/**
 * Module configuration object containing all constants and presets.
 * @constant {Object} CONFIG
 */
export const CONFIG = {
  /** @type {string} Module identifier used for settings and flags */
  MODULE_ID: 'exalted-scenes',

  /** @type {string} Display name of the module */
  MODULE_NAME: 'Exalted Scenes',

  /** @type {string} Socket channel name for real-time communication */
  SOCKET_NAME: 'module.exalted-scenes',

  /**
   * Template paths for Handlebars templates.
   * @type {Object.<string, string>}
   */
  TEMPLATES: {
    GM_PANEL: 'modules/exalted-scenes/templates/gm-panel.hbs',
    PLAYER_VIEW: 'modules/exalted-scenes/templates/player-view.hbs',
    SLIDESHOW_EDITOR: 'modules/exalted-scenes/templates/slideshow-editor.hbs'
  },

  /**
   * Setting keys for Foundry's settings storage.
   * @type {Object.<string, string>}
   */
  SETTINGS: {
    DATA_VERSION: 'dataVersion',
    SCENES: 'scenes',
    CHARACTERS: 'characters',
    FOLDERS: 'folders',
    PREFERENCES: 'preferences',
    CUSTOM_ORDER: 'customOrder',
    SLIDESHOWS: 'slideshows',
    SKIP_PREVIEW_MODE: 'skipPreviewMode',
    BACKGROUND_FIT_MODE: 'backgroundFitMode',
    DEFAULT_SCENE_PRESET: 'defaultScenePreset',
    DEFAULT_SCENE_DISPLAY_MODE: 'defaultSceneDisplayMode',
    DEFAULT_SCENE_SHAPE: 'defaultSceneShape',
    DEFAULT_SCENE_SIZE: 'defaultSceneSize',
    COLOR_THEME: 'colorTheme',
    FREEFORM_PLAYER_CONTROL: 'freeformPlayerControl',
    CAST_PRESETS: 'castPresets',
    BROADCAST_STATE: 'broadcastState'
  },

  /**
   * Color theme presets for the module UI.
   * Each theme has a CSS class and display name.
   * @type {Object.<string, {name: string, cssClass: string, description: string}>}
   */
  COLOR_THEMES: {
    rose: {
      name: 'EXALTED-SCENES.Config.Themes.Rose.Name',
      cssClass: 'es-theme-rose',
      description: 'EXALTED-SCENES.Config.Themes.Rose.Desc'
    },
    purple: {
      name: 'EXALTED-SCENES.Config.Themes.Purple.Name',
      cssClass: 'es-theme-purple',
      description: 'EXALTED-SCENES.Config.Themes.Purple.Desc'
    },
    teal: {
      name: 'EXALTED-SCENES.Config.Themes.Teal.Name',
      cssClass: 'es-theme-teal',
      description: 'EXALTED-SCENES.Config.Themes.Teal.Desc'
    },
    amber: {
      name: 'EXALTED-SCENES.Config.Themes.Amber.Name',
      cssClass: 'es-theme-amber',
      description: 'EXALTED-SCENES.Config.Themes.Amber.Desc'
    },
    steel: {
      name: 'EXALTED-SCENES.Config.Themes.Steel.Name',
      cssClass: 'es-theme-steel',
      description: 'EXALTED-SCENES.Config.Themes.Steel.Desc'
    },
    emerald: {
      name: 'EXALTED-SCENES.Config.Themes.Emerald.Name',
      cssClass: 'es-theme-emerald',
      description: 'EXALTED-SCENES.Config.Themes.Emerald.Desc'
    },
    parchment: {
      name: 'EXALTED-SCENES.Config.Themes.Parchment.Name',
      cssClass: 'es-theme-parchment',
      description: 'EXALTED-SCENES.Config.Themes.Parchment.Desc'
    },
    blood: {
      name: 'EXALTED-SCENES.Config.Themes.Blood.Name',
      cssClass: 'es-theme-blood',
      description: 'EXALTED-SCENES.Config.Themes.Blood.Desc'
    },
    cyberpunk: {
      name: 'EXALTED-SCENES.Config.Themes.Cyberpunk.Name',
      cssClass: 'es-theme-cyberpunk',
      description: 'EXALTED-SCENES.Config.Themes.Cyberpunk.Desc'
    },
    solar: {
      name: 'EXALTED-SCENES.Config.Themes.Solar.Name',
      cssClass: 'es-theme-solar',
      description: 'EXALTED-SCENES.Config.Themes.Solar.Desc'
    },
    void: {
      name: 'EXALTED-SCENES.Config.Themes.Void.Name',
      cssClass: 'es-theme-void',
      description: 'EXALTED-SCENES.Config.Themes.Void.Desc'
    },
    jade: {
      name: 'EXALTED-SCENES.Config.Themes.Jade.Name',
      cssClass: 'es-theme-jade',
      description: 'EXALTED-SCENES.Config.Themes.Jade.Desc'
    },
    ice: {
      name: 'EXALTED-SCENES.Config.Themes.Ice.Name',
      cssClass: 'es-theme-ice',
      description: 'EXALTED-SCENES.Config.Themes.Ice.Desc'
    },
    inferno: {
      name: 'EXALTED-SCENES.Config.Themes.Inferno.Name',
      cssClass: 'es-theme-inferno',
      description: 'EXALTED-SCENES.Config.Themes.Inferno.Desc'
    },
    travertine: {
      name: 'EXALTED-SCENES.Config.Themes.Travertine.Name',
      cssClass: 'es-theme-travertine',
      description: 'EXALTED-SCENES.Config.Themes.Travertine.Desc'
    },
    verdigris: {
      name: 'EXALTED-SCENES.Config.Themes.Verdigris.Name',
      cssClass: 'es-theme-verdigris',
      description: 'EXALTED-SCENES.Config.Themes.Verdigris.Desc'
    },
    harbor: {
      name: 'EXALTED-SCENES.Config.Themes.Harbor.Name',
      cssClass: 'es-theme-harbor',
      description: 'EXALTED-SCENES.Config.Themes.Harbor.Desc'
    },
    saffron: {
      name: 'EXALTED-SCENES.Config.Themes.Saffron.Name',
      cssClass: 'es-theme-saffron',
      description: 'EXALTED-SCENES.Config.Themes.Saffron.Desc'
    },
    mahogany: {
      name: 'EXALTED-SCENES.Config.Themes.Mahogany.Name',
      cssClass: 'es-theme-mahogany',
      description: 'EXALTED-SCENES.Config.Themes.Mahogany.Desc'
    },
    canopy: {
      name: 'EXALTED-SCENES.Config.Themes.Canopy.Name',
      cssClass: 'es-theme-canopy',
      description: 'EXALTED-SCENES.Config.Themes.Canopy.Desc'
    },
    cinder: {
      name: 'EXALTED-SCENES.Config.Themes.Cinder.Name',
      cssClass: 'es-theme-cinder',
      description: 'EXALTED-SCENES.Config.Themes.Cinder.Desc'
    },
    moonstone: {
      name: 'EXALTED-SCENES.Config.Themes.Moonstone.Name',
      cssClass: 'es-theme-moonstone',
      description: 'EXALTED-SCENES.Config.Themes.Moonstone.Desc'
    },
    fresco: {
      name: 'EXALTED-SCENES.Config.Themes.Fresco.Name',
      cssClass: 'es-theme-fresco',
      description: 'EXALTED-SCENES.Config.Themes.Fresco.Desc'
    },
    porcelain: {
      name: 'EXALTED-SCENES.Config.Themes.Porcelain.Name',
      cssClass: 'es-theme-porcelain',
      description: 'EXALTED-SCENES.Config.Themes.Porcelain.Desc'
    }
  },

  /**
   * Background fit modes for scene display.
   * Controls how background images scale to fill the viewport.
   * @type {Object.<string, {name: string, value: string, description: string}>}
   */
  BACKGROUND_FIT_MODES: {
    fill: {
      name: 'EXALTED-SCENES.Config.FitModes.Fill.Name',
      value: 'cover',
      description: 'EXALTED-SCENES.Config.FitModes.Fill.Desc'
    },
    fit: {
      name: 'EXALTED-SCENES.Config.FitModes.Fit.Name',
      value: 'contain',
      description: 'EXALTED-SCENES.Config.FitModes.Fit.Desc'
    },
    smart: {
      name: 'EXALTED-SCENES.Config.FitModes.Smart.Name',
      value: 'smart',
      description: 'EXALTED-SCENES.Config.FitModes.Smart.Desc'
    }
  },

  /**
   * Playback modes for scene soundtrack tracks.
   * Controls how multiple tracks in a soundtrack are played.
   * @type {Object.<string, {name: string, value: string}>}
   */
  PLAYBACK_MODES: {
    sequential: { name: 'EXALTED-SCENES.Config.PlaybackModes.Sequential', value: 'sequential' },
    shuffle: { name: 'EXALTED-SCENES.Config.PlaybackModes.Shuffle', value: 'shuffle' },
    single: { name: 'EXALTED-SCENES.Config.PlaybackModes.Single', value: 'single' }
  },

  /**
   * Display modes for the Player View cast rendering.
   * 'token' = traditional shaped portraits with borders
   * 'hero' = transparent sprite images (Visual Novel style)
   * @type {Object.<string, {name: string, icon: string}>}
   */
  DISPLAY_MODES: {
    token: { name: 'EXALTED-SCENES.Config.DisplayModes.Token', icon: 'fa-circle-user' },
    hero:  { name: 'EXALTED-SCENES.Config.DisplayModes.Hero',  icon: 'fa-person' }
  },

  /**
   * Hero pose types for character sprites.
   * 'half' = half-body (waist up) — positioned at screen bottom
   * 'full' = full-body — uses free positioning
   * @type {Object.<string, {name: string}>}
   */
  HERO_TYPES: {
    half: { name: 'EXALTED-SCENES.Config.HeroTypes.Half' },
    full: { name: 'EXALTED-SCENES.Config.HeroTypes.Full' }
  },

  /**
   * Maximum number of simultaneous ambience layers.
   * Matches Narrator Jukebox's hard limit.
   * @type {number}
   */
  MAX_AMBIENCE_LAYERS: 8,

  /**
   * Available transition types for slideshows.
   * Simplified to dissolve for reliable cross-browser support.
   * @type {Object.<string, {name: string, cssClass: string}>}
   */
  TRANSITIONS: {
    dissolve: { name: 'EXALTED-SCENES.Config.Transitions.Dissolve', cssClass: 'transition-dissolve' },
    none: { name: 'EXALTED-SCENES.Config.Transitions.None', cssClass: 'transition-none' }
  },

  /**
   * Background motion presets for slideshow Ken Burns effects.
   * Each preset defines scale and translate transformations.
   * Pan effects use pre-zoom to avoid showing empty edges.
   *
   * @type {Object.<string, {name: string, scale: number[], translate: number[], isRandom?: boolean}>}
   * @property {string} name - Display name for the preset
   * @property {number[]} scale - [startScale, endScale] values
   * @property {number[]} translate - [xStart, xEnd, yStart, yEnd] percentages
   * @property {boolean} [isRandom] - If true, randomly picks from other presets
   */
  BACKGROUND_MOTION: {
    none: {
      name: 'EXALTED-SCENES.Config.Motion.None',
      scale: [1, 1],
      translate: [0, 0, 0, 0]
    },
    'zoom-in': {
      name: 'EXALTED-SCENES.Config.Motion.ZoomIn',
      scale: [1, 1.06],
      translate: [0, 0, 0, 0]
    },
    'zoom-out': {
      name: 'EXALTED-SCENES.Config.Motion.ZoomOut',
      scale: [1.06, 1],
      translate: [0, 0, 0, 0]
    },
    'pan-left': {
      name: 'EXALTED-SCENES.Config.Motion.PanLeft',
      scale: [1.08, 1.08],
      translate: [2, -2, 0, 0]
    },
    'pan-right': {
      name: 'EXALTED-SCENES.Config.Motion.PanRight',
      scale: [1.08, 1.08],
      translate: [-2, 2, 0, 0]
    },
    'ken-burns': {
      name: 'EXALTED-SCENES.Config.Motion.KenBurns',
      scale: [1, 1.05],
      translate: [0, 1.5, 0, -0.5]
    },
    'random': {
      name: 'EXALTED-SCENES.Config.Motion.Random',
      isRandom: true
    }
  },

  /**
   * Default values for scenes and characters.
   * @type {Object.<string, string>}
   */
  DEFAULTS: {
    SCENE_BG: 'modules/exalted-scenes/assets/default-scene.jpg',
    CHAR_IMG: 'icons/svg/mystery-man.svg'
  },

  /**
   * Layout presets for cast positioning on screen.
   * Each preset defines position (top/bottom/left/right), alignment, and icon.
   * @type {Object.<string, {name: string, position: string, align: string, icon: string}>}
   */
  LAYOUT_PRESETS: {
    'bottom-center': {
      name: 'EXALTED-SCENES.Config.Layouts.BottomCenter',
      position: 'bottom',
      align: 'center',
      icon: 'fa-arrows-down-to-line'
    },
    'bottom-left': {
      name: 'EXALTED-SCENES.Config.Layouts.BottomLeft',
      position: 'bottom',
      align: 'left',
      icon: 'fa-arrow-down-left'
    },
    'bottom-right': {
      name: 'EXALTED-SCENES.Config.Layouts.BottomRight',
      position: 'bottom',
      align: 'right',
      icon: 'fa-arrow-down-right'
    },
    'top-center': {
      name: 'EXALTED-SCENES.Config.Layouts.TopCenter',
      position: 'top',
      align: 'center',
      icon: 'fa-arrows-up-to-line'
    },
    'top-left': {
      name: 'EXALTED-SCENES.Config.Layouts.TopLeft',
      position: 'top',
      align: 'left',
      icon: 'fa-arrow-up-left'
    },
    'top-right': {
      name: 'EXALTED-SCENES.Config.Layouts.TopRight',
      position: 'top',
      align: 'right',
      icon: 'fa-arrow-up-right'
    },
    'sidebar-left': {
      name: 'EXALTED-SCENES.Config.Layouts.SidebarLeft',
      position: 'left',
      align: 'middle',
      icon: 'fa-sidebar'
    },
    'sidebar-right': {
      name: 'EXALTED-SCENES.Config.Layouts.SidebarRight',
      position: 'right',
      align: 'middle',
      icon: 'fa-sidebar-flip'
    },
    'freeform': {
      name: 'EXALTED-SCENES.Config.Layouts.Freeform',
      position: 'free',
      align: 'free',
      icon: 'fa-hand'
    }
  },

  /**
   * Size presets for character portrait dimensions.
   * Values are in viewport height (vh) units.
   * @type {Object.<string, {name: string, value: string}>}
   */
  SIZE_PRESETS: {
    small: { name: 'EXALTED-SCENES.Config.Sizes.Small', value: '12vh' },
    medium: { name: 'EXALTED-SCENES.Config.Sizes.Medium', value: '18vh' },
    large: { name: 'EXALTED-SCENES.Config.Sizes.Large', value: '24vh' },
    xlarge: { name: 'EXALTED-SCENES.Config.Sizes.XLarge', value: '30vh' }
  },

  /**
   * Size presets available in Cast Only mode.
   * Includes an extra-smaller option without affecting scene layout controls.
   * @type {Object.<string, {name: string, value: string}>}
   */
  CAST_ONLY_SIZE_PRESETS: {
    xsmall: { name: 'EXALTED-SCENES.Config.Sizes.XSmall', value: '9vh' },
    small: { name: 'EXALTED-SCENES.Config.Sizes.Small', value: '12vh' },
    medium: { name: 'EXALTED-SCENES.Config.Sizes.Medium', value: '18vh' },
    large: { name: 'EXALTED-SCENES.Config.Sizes.Large', value: '24vh' },
    xlarge: { name: 'EXALTED-SCENES.Config.Sizes.XLarge', value: '30vh' }
  },

  /**
   * Shape presets for character portrait clipping.
   * Controls border-radius and aspect ratio of portraits in the Player View.
   * @type {Object.<string, {name: string}>}
   */
  SHAPE_PRESETS: {
    circle:   { name: 'EXALTED-SCENES.Config.Shapes.Circle' },
    rounded:  { name: 'EXALTED-SCENES.Config.Shapes.Rounded' },
    square:   { name: 'EXALTED-SCENES.Config.Shapes.Square' },
    portrait: { name: 'EXALTED-SCENES.Config.Shapes.Portrait' }
  },

  /**
   * Default layout settings applied to new scenes.
   * @type {{preset: string, size: string, shape: string, spacing: number, offsetX: number, offsetY: number}}
   */
  DEFAULT_LAYOUT: {
    preset: 'bottom-center',
    size: 'medium',
    shape: 'circle',
    spacing: 24,
    offsetX: 0,
    offsetY: 5,
    positions: {},
    displayMode: 'token',
    theaterMode: false,
    theaterShots: [],
    theaterStripPosition: null,
    theaterStripHeight: null
  },

  /**
   * Default transform state for a positioned character.
   * layer is used by hero half-body sprites to control front/back overlap.
   * @type {{x: number, y: number, scale: number, flipped: boolean, layer: number}}
   */
  DEFAULT_CHARACTER_POSITION: { x: 50, y: 75, scale: 1, flipped: false, layer: 0 },

  /**
   * Limits for freeform layout scale adjustments.
   * @type {{minScale: number, maxScale: number, scaleStep: number}}
   */
  FREEFORM_LIMITS: { minScale: 0.3, maxScale: 3.0, scaleStep: 0.1 },

  /**
   * Border effects for character portraits.
   * Each effect defines a distinct visual border style. Color is chosen freely by the user.
   *
   * @type {Object.<string, {name: string, colorCount: number, animated: boolean, icon: string}>}
   * @property {string} name - i18n key for display name
   * @property {number} colorCount - Number of colors needed: 0 (fixed), 1 (single), 2 (dual/gradient)
   * @property {boolean} animated - Whether this effect uses CSS animation
   * @property {string} icon - FontAwesome icon class (without 'fas' prefix)
   */
  BORDER_EFFECTS: {
    none:      { name: 'EXALTED-SCENES.Border.None',      colorCount: 0, animated: false, icon: 'fa-ban' },
    solid:     { name: 'EXALTED-SCENES.Border.Solid',     colorCount: 1, animated: false, icon: 'fa-circle' },
    thick:     { name: 'EXALTED-SCENES.Border.Thick',     colorCount: 1, animated: false, icon: 'fa-circle-dot' },
    double:    { name: 'EXALTED-SCENES.Border.Double',    colorCount: 1, animated: false, icon: 'fa-bullseye' },
    ornate:    { name: 'EXALTED-SCENES.Border.Ornate',    colorCount: 1, animated: false, icon: 'fa-gem' },
    runic:     { name: 'EXALTED-SCENES.Border.Runic',     colorCount: 1, animated: true,  icon: 'fa-sun' },
    gradient:  { name: 'EXALTED-SCENES.Border.Gradient',  colorCount: 2, animated: false, icon: 'fa-palette' },
    ethereal:  { name: 'EXALTED-SCENES.Border.Ethereal',  colorCount: 2, animated: true,  icon: 'fa-ghost' },
    pulse:     { name: 'EXALTED-SCENES.Border.Pulse',     colorCount: 1, animated: true,  icon: 'fa-heart-pulse' },
    glow:      { name: 'EXALTED-SCENES.Border.Glow',      colorCount: 1, animated: true,  icon: 'fa-sparkles' },
    heartbeat: { name: 'EXALTED-SCENES.Border.Heartbeat', colorCount: 1, animated: true,  icon: 'fa-heartbeat' },
    rainbow:   { name: 'EXALTED-SCENES.Border.Rainbow',   colorCount: 0, animated: true,  icon: 'fa-rainbow' },
    prismatic: { name: 'EXALTED-SCENES.Border.Prismatic', colorCount: 0, animated: true,  icon: 'fa-diamond' }
  },

  /**
   * Quick-pick color swatches for the border color picker.
   * @type {Object.<string, string>}
   */
  BORDER_COLORS: {
    gold:     '#c9a227',
    silver:   '#a8a9ad',
    bronze:   '#cd7f32',
    crimson:  '#dc143c',
    emerald:  '#50c878',
    sapphire: '#0f52ba',
    amethyst: '#9966cc',
    cyan:     '#00ffff',
    coral:    '#ff6f61',
    teal:     '#008080',
    ivory:    '#fffff0',
    obsidian: '#1a1a2e'
  },

  /**
   * Default border style applied to new characters.
   * @type {{ effect: string, color: string }}
   */
  BORDER_DEFAULT: { effect: 'solid', color: '#c9a227' },

  /**
   * Migration map from old v5 border preset keys to new v6 { effect, color, color2? } format.
   * Used by CharacterModel constructor and MigrationService for backward compatibility.
   * @type {Object.<string, {effect: string, color?: string, color2?: string}>}
   */
  BORDER_MIGRATION_MAP: {
    // Solid colors → solid effect
    gold: { effect: 'solid', color: '#c9a227' },
    silver: { effect: 'solid', color: '#a8a9ad' },
    bronze: { effect: 'solid', color: '#cd7f32' },
    copper: { effect: 'solid', color: '#b87333' },
    platinum: { effect: 'solid', color: '#e5e4e2' },
    crimson: { effect: 'solid', color: '#dc143c' },
    scarlet: { effect: 'solid', color: '#ff2400' },
    rose: { effect: 'solid', color: '#ff007f' },
    coral: { effect: 'solid', color: '#ff6f61' },
    emerald: { effect: 'solid', color: '#50c878' },
    jade: { effect: 'solid', color: '#00a86b' },
    mint: { effect: 'solid', color: '#98ff98' },
    forest: { effect: 'solid', color: '#228b22' },
    sapphire: { effect: 'solid', color: '#0f52ba' },
    azure: { effect: 'solid', color: '#007fff' },
    navy: { effect: 'solid', color: '#000080' },
    cyan: { effect: 'solid', color: '#00ffff' },
    teal: { effect: 'solid', color: '#008080' },
    amethyst: { effect: 'solid', color: '#9966cc' },
    violet: { effect: 'solid', color: '#8f00ff' },
    lavender: { effect: 'solid', color: '#b57edc' },
    plum: { effect: 'solid', color: '#8e4585' },
    obsidian: { effect: 'solid', color: '#1a1a2e' },
    onyx: { effect: 'solid', color: '#353839' },
    ivory: { effect: 'solid', color: '#fffff0' },
    pearl: { effect: 'solid', color: '#f0ead6' },
    // Gradients → gradient effect (first and last color)
    sunset: { effect: 'gradient', color: '#ff6b6b', color2: '#ff9ff3' },
    sunrise: { effect: 'gradient', color: '#ff9a9e', color2: '#fecfef' },
    ocean: { effect: 'gradient', color: '#0077b6', color2: '#90e0ef' },
    deep_sea: { effect: 'gradient', color: '#000428', color2: '#004e92' },
    aurora: { effect: 'gradient', color: '#7400b8', color2: '#80ffdb' },
    northern_lights: { effect: 'gradient', color: '#43cea2', color2: '#185a9d' },
    fire: { effect: 'gradient', color: '#f12711', color2: '#f5af19' },
    inferno: { effect: 'gradient', color: '#ff0000', color2: '#fffb00' },
    ember: { effect: 'gradient', color: '#ff416c', color2: '#ff4b2b' },
    ice: { effect: 'gradient', color: '#caf0f8', color2: '#00b4d8' },
    frost: { effect: 'gradient', color: '#e0eafc', color2: '#cfdef3' },
    glacier: { effect: 'gradient', color: '#74ebd5', color2: '#acb6e5' },
    nature: { effect: 'gradient', color: '#2d6a4f', color2: '#95d5b2' },
    spring: { effect: 'gradient', color: '#a8e063', color2: '#56ab2f' },
    autumn: { effect: 'gradient', color: '#d76d77', color2: '#3a1c71' },
    royal: { effect: 'gradient', color: '#141e30', color2: '#243b55' },
    mystic: { effect: 'gradient', color: '#6441a5', color2: '#2a0845' },
    cosmic: { effect: 'gradient', color: '#ff00cc', color2: '#333399' },
    nebula: { effect: 'gradient', color: '#667eea', color2: '#764ba2' },
    galaxy: { effect: 'gradient', color: '#0f0c29', color2: '#24243e' },
    blood_moon: { effect: 'gradient', color: '#870000', color2: '#190a05' },
    shadow: { effect: 'gradient', color: '#232526', color2: '#414345' },
    light: { effect: 'gradient', color: '#fffbd5', color2: '#b20a2c' },
    divine: { effect: 'gradient', color: '#f5f7fa', color2: '#c3cfe2' },
    // Animated → matching effect
    pulse_gold: { effect: 'pulse', color: '#c9a227' },
    pulse_silver: { effect: 'pulse', color: '#a8a9ad' },
    pulse_crimson: { effect: 'pulse', color: '#dc143c' },
    pulse_emerald: { effect: 'pulse', color: '#50c878' },
    pulse_sapphire: { effect: 'pulse', color: '#0f52ba' },
    pulse_amethyst: { effect: 'pulse', color: '#9966cc' },
    rainbow: { effect: 'rainbow' },
    prismatic: { effect: 'prismatic' },
    ethereal: { effect: 'glow', color: '#a855f7' },
    holy: { effect: 'glow', color: '#ffd700' },
    shadow_flame: { effect: 'glow', color: '#4a0080' },
    spirit: { effect: 'glow', color: '#00ffcc' },
    breathing: { effect: 'pulse', color: '#6366f1' },
    heartbeat: { effect: 'heartbeat', color: '#ef4444' },
    // Styled → matching effect
    thick_gold: { effect: 'thick', color: '#c9a227' },
    thick_silver: { effect: 'thick', color: '#a8a9ad' },
    thick_obsidian: { effect: 'thick', color: '#1a1a2e' },
    double_gold: { effect: 'double', color: '#c9a227' },
    double_silver: { effect: 'double', color: '#a8a9ad' },
    double_crimson: { effect: 'double', color: '#dc143c' },
    ornate_gold: { effect: 'ornate', color: '#c9a227' },
    ornate_silver: { effect: 'ornate', color: '#a8a9ad' },
    ornate_bronze: { effect: 'ornate', color: '#cd7f32' },
    runic: { effect: 'runic', color: '#00ffcc' },
    runic_fire: { effect: 'runic', color: '#ff4500' },
    runic_ice: { effect: 'runic', color: '#00bfff' },
    ethereal_glow: { effect: 'ethereal', color: '#a855f7', color2: '#6366f1' },
    celestial: { effect: 'ethereal', color: '#ffd700', color2: '#fff4a3' },
    void: { effect: 'ethereal', color: '#1a0033', color2: '#0d001a' }
  }
};

function cloneDefaultSceneLayoutSettings() {
  return {
    ...CONFIG.DEFAULT_LAYOUT,
    positions: {},
    theaterShots: [],
    theaterStripPosition: null,
    theaterStripHeight: null
  };
}

export function getDefaultSceneLayoutSettings() {
  const defaults = cloneDefaultSceneLayoutSettings();
  const settings = globalThis.game?.settings;
  if (!settings) return defaults;

  const configuredPreset = settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.DEFAULT_SCENE_PRESET);
  if (typeof configuredPreset === 'string' && CONFIG.LAYOUT_PRESETS[configuredPreset]) {
    defaults.preset = configuredPreset;
  }

  const configuredDisplayMode = settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.DEFAULT_SCENE_DISPLAY_MODE);
  if (typeof configuredDisplayMode === 'string' && CONFIG.DISPLAY_MODES[configuredDisplayMode]) {
    defaults.displayMode = configuredDisplayMode;
  }

  const configuredShape = settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.DEFAULT_SCENE_SHAPE);
  if (typeof configuredShape === 'string' && CONFIG.SHAPE_PRESETS[configuredShape]) {
    defaults.shape = configuredShape;
  }

  const configuredSize = settings.get(CONFIG.MODULE_ID, CONFIG.SETTINGS.DEFAULT_SCENE_SIZE);
  if (typeof configuredSize === 'string' && CONFIG.SIZE_PRESETS[configuredSize]) {
    defaults.size = configuredSize;
  }

  return defaults;
}
