/**
 * YouTube Utilities
 * Extracted from narrator-jukebox.js for modular architecture
 */

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL or video ID
 * @returns {string|null} Video ID or null if invalid
 */
export function extractYouTubeVideoId(url) {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Alternative YouTube ID extractor (more permissive regex)
 * Used by AudioChannel class
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if invalid
 */
export function extractYouTubeId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

/**
 * Get YouTube thumbnail URL for a video
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality: 'default', 'medium', 'high', 'maxres'
 * @returns {string} Thumbnail URL
 */
export function getYouTubeThumbnail(videoId, quality = 'medium') {
  if (!videoId) return '';

  const qualities = {
    default: 'default',      // 120x90
    medium: 'mqdefault',     // 320x180
    high: 'hqdefault',       // 480x360
    maxres: 'maxresdefault'  // 1280x720
  };

  const qualityCode = qualities[quality] || qualities.medium;
  return `https://img.youtube.com/vi/${videoId}/${qualityCode}.jpg`;
}

/**
 * Validate if a string is a valid YouTube URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid YouTube URL
 */
export function validateYouTubeUrl(url) {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Check if a URL is a YouTube URL (without full validation)
 * @param {string} url - URL to check
 * @returns {boolean} True if appears to be a YouTube URL
 */
export function isYouTubeUrl(url) {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}
