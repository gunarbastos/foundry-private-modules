/**
 * Time Formatting Utilities
 * Extracted from narrator-jukebox.js for modular architecture
 */

/**
 * Format seconds into mm:ss display format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "3:45")
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse a time string (mm:ss or seconds) into total seconds
 * @param {string} timeStr - Time string to parse
 * @returns {number} Time in seconds
 */
export function parseTimeInput(timeStr) {
  if (!timeStr) return 0;

  // If it's already a number, return it
  if (!isNaN(timeStr)) return parseFloat(timeStr);

  // Parse mm:ss format
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }

  // Try to parse as seconds
  return parseFloat(timeStr) || 0;
}

/**
 * Format seconds into input-friendly format (mm:ss)
 * Used for form inputs that need to display/accept time values
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string for input fields
 */
export function formatTimeForInput(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
