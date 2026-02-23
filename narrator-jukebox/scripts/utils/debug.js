/**
 * Debug Logging Utility
 * Provides conditional logging based on debug mode setting
 */

import { JUKEBOX } from '../core/constants.js';

const PREFIX = "Narrator Jukebox |";

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
function isDebugEnabled() {
  try {
    return game?.settings?.get(JUKEBOX.ID, JUKEBOX.SETTINGS.DEBUG) ?? false;
  } catch {
    return false;
  }
}

/**
 * Log a debug message (only if debug mode is enabled)
 * @param {...any} args - Arguments to log
 */
export function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log(PREFIX, ...args);
  }
}

/**
 * Log a warning message (only if debug mode is enabled)
 * @param {...any} args - Arguments to log
 */
export function debugWarn(...args) {
  if (isDebugEnabled()) {
    console.warn(PREFIX, ...args);
  }
}

/**
 * Log an error message (always logs, errors are important)
 * @param {...any} args - Arguments to log
 */
export function debugError(...args) {
  console.error(PREFIX, ...args);
}

/**
 * Log an info message (only if debug mode is enabled)
 * @param {...any} args - Arguments to log
 */
export function debugInfo(...args) {
  if (isDebugEnabled()) {
    console.info(PREFIX, ...args);
  }
}
