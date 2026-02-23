/**
 * Internationalization (i18n) Helper
 * Provides utility functions for localization
 */

const MODULE_ID = 'exalted-scenes';
const PREFIX = 'EXALTED-SCENES';

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
 * Get a localized string using the full key (with prefix)
 * Useful for config keys that are stored with the full prefix
 * @param {string} fullKey - The full localization key (with module prefix)
 * @returns {string} The localized string
 */
export function localizeFull(fullKey) {
  return game.i18n.localize(fullKey);
}

export default { localize, format, has, localizeFull };
