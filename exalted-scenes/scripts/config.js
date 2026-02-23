/**
 * @file config.js
 * @description Configuration constants for the Exalted Scenes module.
 * Contains all static configuration including templates, settings keys,
 * transitions, layout presets, size presets, and border style presets.
 *
 * @module config
 */

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
    COLOR_THEME: 'colorTheme'
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
   * Default layout settings applied to new scenes.
   * @type {{preset: string, size: string, spacing: number, offsetX: number, offsetY: number}}
   */
  DEFAULT_LAYOUT: {
    preset: 'bottom-center',
    size: 'medium',
    spacing: 24,
    offsetX: 0,
    offsetY: 5
  },

  /**
   * Border style presets for character portraits.
   * Types: solid (single color), gradient (multi-color), animated (effects), styled (textures).
   *
   * @type {Object.<string, {name: string, type: string, color?: string, colors?: string[], animation?: string, style?: string}>}
   * @property {string} name - Display name for the preset
   * @property {string} type - Border type: 'solid', 'gradient', 'animated', or 'styled'
   * @property {string} [color] - Color for solid/animated/styled types
   * @property {string[]} [colors] - Color array for gradient types
   * @property {string} [animation] - Animation name for animated types (pulse, rainbow, glow, etc.)
   * @property {string} [style] - Style variant for styled types (thick, double, ornate, runic, ethereal)
   */
  BORDER_PRESETS: {
    // ═══════════════════════════════════════════════════════════════
    // SOLID COLORS - Classic single-color borders
    // ═══════════════════════════════════════════════════════════════
    gold: { name: 'Gold', type: 'solid', color: '#c9a227' },
    silver: { name: 'Silver', type: 'solid', color: '#a8a9ad' },
    bronze: { name: 'Bronze', type: 'solid', color: '#cd7f32' },
    copper: { name: 'Copper', type: 'solid', color: '#b87333' },
    platinum: { name: 'Platinum', type: 'solid', color: '#e5e4e2' },

    crimson: { name: 'Crimson', type: 'solid', color: '#dc143c' },
    scarlet: { name: 'Scarlet', type: 'solid', color: '#ff2400' },
    rose: { name: 'Rose', type: 'solid', color: '#ff007f' },
    coral: { name: 'Coral', type: 'solid', color: '#ff6f61' },

    emerald: { name: 'Emerald', type: 'solid', color: '#50c878' },
    jade: { name: 'Jade', type: 'solid', color: '#00a86b' },
    mint: { name: 'Mint', type: 'solid', color: '#98ff98' },
    forest: { name: 'Forest', type: 'solid', color: '#228b22' },

    sapphire: { name: 'Sapphire', type: 'solid', color: '#0f52ba' },
    azure: { name: 'Azure', type: 'solid', color: '#007fff' },
    navy: { name: 'Navy', type: 'solid', color: '#000080' },
    cyan: { name: 'Cyan', type: 'solid', color: '#00ffff' },
    teal: { name: 'Teal', type: 'solid', color: '#008080' },

    amethyst: { name: 'Amethyst', type: 'solid', color: '#9966cc' },
    violet: { name: 'Violet', type: 'solid', color: '#8f00ff' },
    lavender: { name: 'Lavender', type: 'solid', color: '#b57edc' },
    plum: { name: 'Plum', type: 'solid', color: '#8e4585' },

    obsidian: { name: 'Obsidian', type: 'solid', color: '#1a1a2e' },
    onyx: { name: 'Onyx', type: 'solid', color: '#353839' },
    ivory: { name: 'Ivory', type: 'solid', color: '#fffff0' },
    pearl: { name: 'Pearl', type: 'solid', color: '#f0ead6' },

    // ═══════════════════════════════════════════════════════════════
    // GRADIENTS - Multi-color flowing borders
    // ═══════════════════════════════════════════════════════════════
    sunset: { name: 'Sunset', type: 'gradient', colors: ['#ff6b6b', '#feca57', '#ff9ff3'] },
    sunrise: { name: 'Sunrise', type: 'gradient', colors: ['#ff9a9e', '#fecfef', '#fecfef'] },
    ocean: { name: 'Ocean', type: 'gradient', colors: ['#0077b6', '#00b4d8', '#90e0ef'] },
    deep_sea: { name: 'Deep Sea', type: 'gradient', colors: ['#000428', '#004e92'] },
    aurora: { name: 'Aurora', type: 'gradient', colors: ['#7400b8', '#5390d9', '#56cfe1', '#80ffdb'] },
    northern_lights: { name: 'Northern Lights', type: 'gradient', colors: ['#43cea2', '#185a9d'] },

    fire: { name: 'Fire', type: 'gradient', colors: ['#f12711', '#f5af19'] },
    inferno: { name: 'Inferno', type: 'gradient', colors: ['#ff0000', '#ff7300', '#fffb00'] },
    ember: { name: 'Ember', type: 'gradient', colors: ['#ff416c', '#ff4b2b'] },

    ice: { name: 'Ice', type: 'gradient', colors: ['#caf0f8', '#90e0ef', '#00b4d8'] },
    frost: { name: 'Frost', type: 'gradient', colors: ['#e0eafc', '#cfdef3'] },
    glacier: { name: 'Glacier', type: 'gradient', colors: ['#74ebd5', '#acb6e5'] },

    nature: { name: 'Nature', type: 'gradient', colors: ['#2d6a4f', '#40916c', '#95d5b2'] },
    spring: { name: 'Spring', type: 'gradient', colors: ['#a8e063', '#56ab2f'] },
    autumn: { name: 'Autumn', type: 'gradient', colors: ['#d76d77', '#ffaf7b', '#3a1c71'] },

    royal: { name: 'Royal', type: 'gradient', colors: ['#141e30', '#243b55'] },
    mystic: { name: 'Mystic', type: 'gradient', colors: ['#6441a5', '#2a0845'] },
    cosmic: { name: 'Cosmic', type: 'gradient', colors: ['#ff00cc', '#333399'] },
    nebula: { name: 'Nebula', type: 'gradient', colors: ['#667eea', '#764ba2'] },
    galaxy: { name: 'Galaxy', type: 'gradient', colors: ['#0f0c29', '#302b63', '#24243e'] },

    blood_moon: { name: 'Blood Moon', type: 'gradient', colors: ['#870000', '#190a05'] },
    shadow: { name: 'Shadow', type: 'gradient', colors: ['#232526', '#414345'] },
    light: { name: 'Light', type: 'gradient', colors: ['#fffbd5', '#b20a2c'] },
    divine: { name: 'Divine', type: 'gradient', colors: ['#f5f7fa', '#c3cfe2'] },

    // ═══════════════════════════════════════════════════════════════
    // ANIMATED - Moving/pulsing effects
    // ═══════════════════════════════════════════════════════════════
    pulse_gold: { name: 'Pulse Gold', type: 'animated', animation: 'pulse', color: '#c9a227' },
    pulse_silver: { name: 'Pulse Silver', type: 'animated', animation: 'pulse', color: '#a8a9ad' },
    pulse_crimson: { name: 'Pulse Crimson', type: 'animated', animation: 'pulse', color: '#dc143c' },
    pulse_emerald: { name: 'Pulse Emerald', type: 'animated', animation: 'pulse', color: '#50c878' },
    pulse_sapphire: { name: 'Pulse Sapphire', type: 'animated', animation: 'pulse', color: '#0f52ba' },
    pulse_amethyst: { name: 'Pulse Amethyst', type: 'animated', animation: 'pulse', color: '#9966cc' },

    rainbow: { name: 'Rainbow', type: 'animated', animation: 'rainbow', color: '#ff6b6b' },
    prismatic: { name: 'Prismatic', type: 'animated', animation: 'prismatic', color: '#fff' },

    ethereal: { name: 'Ethereal', type: 'animated', animation: 'glow', color: '#a855f7' },
    holy: { name: 'Holy', type: 'animated', animation: 'glow', color: '#ffd700' },
    shadow_flame: { name: 'Shadow Flame', type: 'animated', animation: 'glow', color: '#4a0080' },
    spirit: { name: 'Spirit', type: 'animated', animation: 'glow', color: '#00ffcc' },

    breathing: { name: 'Breathing', type: 'animated', animation: 'breathe', color: '#6366f1' },
    heartbeat: { name: 'Heartbeat', type: 'animated', animation: 'heartbeat', color: '#ef4444' },

    // ═══════════════════════════════════════════════════════════════
    // STYLED - Different border textures/styles
    // ═══════════════════════════════════════════════════════════════
    thick_gold: { name: 'Thick Gold', type: 'styled', style: 'thick', color: '#c9a227' },
    thick_silver: { name: 'Thick Silver', type: 'styled', style: 'thick', color: '#a8a9ad' },
    thick_obsidian: { name: 'Thick Obsidian', type: 'styled', style: 'thick', color: '#1a1a2e' },

    double_gold: { name: 'Double Gold', type: 'styled', style: 'double', color: '#c9a227' },
    double_silver: { name: 'Double Silver', type: 'styled', style: 'double', color: '#a8a9ad' },
    double_crimson: { name: 'Double Crimson', type: 'styled', style: 'double', color: '#dc143c' },

    ornate_gold: { name: 'Ornate Gold', type: 'styled', style: 'ornate', color: '#c9a227' },
    ornate_silver: { name: 'Ornate Silver', type: 'styled', style: 'ornate', color: '#a8a9ad' },
    ornate_bronze: { name: 'Ornate Bronze', type: 'styled', style: 'ornate', color: '#cd7f32' },

    runic: { name: 'Runic', type: 'styled', style: 'runic', color: '#00ffcc' },
    runic_fire: { name: 'Runic Fire', type: 'styled', style: 'runic', color: '#ff4500' },
    runic_ice: { name: 'Runic Ice', type: 'styled', style: 'runic', color: '#00bfff' },

    ethereal_glow: { name: 'Ethereal Glow', type: 'styled', style: 'ethereal', color: '#a855f7' },
    celestial: { name: 'Celestial', type: 'styled', style: 'ethereal', color: '#ffd700' },
    void: { name: 'Void', type: 'styled', style: 'ethereal', color: '#1a0033' }
  }
};
