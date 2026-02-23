/**
 * Validation Service
 * Handles form validation for dialogs
 */

/**
 * YouTube URL regex pattern
 */
const YOUTUBE_REGEX = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;

/**
 * Validates a form field and shows visual feedback
 * @param {HTMLElement} input - The input element to validate
 * @param {string} errorMessage - Error message to display
 * @returns {boolean} - True if valid
 */
export function validateField(input, errorMessage = "This field is required") {
  if (!input.value || input.value.trim() === "") {
    showFieldError(input, errorMessage);
    return false;
  }
  return true;
}

/**
 * Shows an error message on a field
 * @param {HTMLElement} input - The input element
 * @param {string} errorMessage - Error message to display
 */
export function showFieldError(input, errorMessage) {
  input.classList.add('input-error');

  // Remove existing error message
  const existingError = input.parentElement.querySelector('.field-error');
  if (existingError) existingError.remove();

  // Add error message
  const errorEl = document.createElement('div');
  errorEl.className = 'field-error';
  errorEl.textContent = errorMessage;
  input.parentElement.appendChild(errorEl);

  // Remove error on input
  input.addEventListener('input', () => {
    clearFieldError(input);
  }, { once: true });
}

/**
 * Clears error state from a field
 * @param {HTMLElement} input - The input element
 */
export function clearFieldError(input) {
  input.classList.remove('input-error');
  const error = input.parentElement.querySelector('.field-error');
  if (error) error.remove();
}

/**
 * Validates a URL based on source type
 * @param {string} url - The URL to validate
 * @param {string} source - Source type ('youtube' or 'local')
 * @returns {boolean} - True if valid
 */
export function validateUrl(url, source) {
  if (!url || url.trim() === "") return false;

  if (source === 'youtube') {
    return YOUTUBE_REGEX.test(url);
  }

  return true; // For local files, just check it's not empty
}

/**
 * Validates that a value is a valid YouTube URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid YouTube URL
 */
export function validateYouTubeUrl(url) {
  if (!url || url.trim() === "") return false;
  return YOUTUBE_REGEX.test(url);
}

/**
 * Validates that a playlist name is unique
 * @param {string} name - The playlist name to validate
 * @param {Array} existingPlaylists - Array of existing playlists
 * @param {string} excludeId - Optional ID to exclude (for editing)
 * @returns {boolean} - True if valid (unique)
 */
export function validatePlaylistName(name, existingPlaylists, excludeId = null) {
  if (!name || name.trim() === "") return false;

  const normalizedName = name.trim().toLowerCase();
  return !existingPlaylists.some(p => {
    if (excludeId && p.id === excludeId) return false;
    return p.name.toLowerCase() === normalizedName;
  });
}

/**
 * Validates required fields and shows errors
 * @param {Object} fields - Object with field names as keys and {input, message} as values
 * @returns {boolean} - True if all fields are valid
 */
export function validateRequired(fields) {
  let isValid = true;

  for (const [name, config] of Object.entries(fields)) {
    const { input, message } = config;
    if (!validateField(input, message || `${name} is required`)) {
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Validates a time string in format "mm:ss" or "hh:mm:ss"
 * @param {string} timeStr - The time string to validate
 * @returns {boolean} - True if valid
 */
export function validateTimeFormat(timeStr) {
  if (!timeStr || timeStr.trim() === "") return true; // Empty is valid (optional)

  // Match mm:ss or hh:mm:ss
  const regex = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  return regex.test(timeStr.trim());
}

/**
 * Validates a number is within a range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} - True if valid
 */
export function validateRange(value, min, max) {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

/**
 * Validates and normalizes tags input
 * @param {string} tagsStr - Comma-separated tags string
 * @returns {Array<string>} - Array of normalized tags
 */
export function normalizeTags(tagsStr) {
  if (!tagsStr) return [];
  return tagsStr
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

/**
 * Validation service singleton for convenience
 */
export const validationService = {
  validateField,
  showFieldError,
  clearFieldError,
  validateUrl,
  validateYouTubeUrl,
  validatePlaylistName,
  validateRequired,
  validateTimeFormat,
  validateRange,
  normalizeTags
};

export default validationService;
