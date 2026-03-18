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
 * Normalize a YouTube URL into a canonical watch URL when possible.
 * @param {string} url - YouTube URL or video ID
 * @returns {string} Canonical URL or the original trimmed input
 */
export function normalizeYouTubeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  const videoId = extractYouTubeVideoId(trimmed);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : trimmed;
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

/**
 * Style a hidden YouTube container so the iframe still gets a valid viewport.
 * @param {HTMLElement} element - Container element
 */
export function styleHiddenYouTubeContainer(element) {
  if (!element) return;

  element.style.position = 'fixed';
  element.style.left = '-10000px';
  element.style.top = '-10000px';
  element.style.width = '200px';
  element.style.height = '200px';
  element.style.opacity = '0';
  element.style.pointerEvents = 'none';
  element.style.overflow = 'hidden';
  element.style.display = 'block';
}

/**
 * Classify YouTube player error codes into actionable metadata.
 * @param {number|string} code - YouTube iframe API error code
 * @returns {{code: number, reason: string, isPermanent: boolean, userMessage: string}}
 */
export function getYouTubeErrorDetails(code) {
  const numericCode = Number(code) || 0;

  switch (numericCode) {
    case 2:
      return {
        code: numericCode,
        reason: 'invalid_parameter',
        isPermanent: true,
        userMessage: 'Invalid YouTube URL or video ID.'
      };
    case 5:
      return {
        code: numericCode,
        reason: 'html5_player_error',
        isPermanent: false,
        userMessage: 'YouTube could not start playback in the embedded player.'
      };
    case 100:
      return {
        code: numericCode,
        reason: 'video_not_found',
        isPermanent: true,
        userMessage: 'This YouTube video is unavailable or has been removed.'
      };
    case 101:
    case 150:
      return {
        code: numericCode,
        reason: 'embed_not_allowed',
        isPermanent: true,
        userMessage: 'This YouTube video does not allow embedded playback. Use another video or a local file.'
      };
    case 153:
      return {
        code: numericCode,
        reason: 'missing_referrer',
        isPermanent: true,
        userMessage: 'YouTube blocked playback because the player request was rejected by the host environment.'
      };
    default:
      return {
        code: numericCode,
        reason: 'unknown',
        isPermanent: false,
        userMessage: `YouTube playback failed (code ${numericCode || 'unknown'}).`
      };
  }
}

/**
 * Probe whether a YouTube URL can play inside the current embedded player environment.
 * @param {string} url - YouTube URL or video ID
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs=12000] - Probe timeout
 * @returns {Promise<{ok: boolean, videoId: string|null, code: number|null, details: object}>}
 */
export async function probeYouTubePlayback(url, options = {}) {
  const { timeoutMs = 12000 } = options;
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return {
      ok: false,
      videoId: null,
      code: 2,
      details: getYouTubeErrorDetails(2)
    };
  }

  if (!window?.NarratorJukeboxYTReady) {
    return {
      ok: false,
      videoId,
      code: null,
      details: {
        code: 0,
        reason: 'youtube_api_unavailable',
        isPermanent: false,
        userMessage: 'YouTube API is not ready yet.'
      }
    };
  }

  await window.NarratorJukeboxYTReady;

  if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
    return {
      ok: false,
      videoId,
      code: null,
      details: {
        code: 0,
        reason: 'youtube_api_unavailable',
        isPermanent: false,
        userMessage: 'YouTube API is not available in this client.'
      }
    };
  }

  const container = document.createElement('div');
  container.id = `njb-yt-probe-${videoId}-${Date.now()}`;
  styleHiddenYouTubeContainer(container);
  document.body.appendChild(container);

  return new Promise((resolve) => {
    let settled = false;
    let player = null;
    let timeoutId = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      try {
        player?.stopVideo?.();
      } catch (error) {}
      try {
        player?.destroy?.();
      } catch (error) {}
      container.remove();

      resolve(result);
    };

    timeoutId = setTimeout(() => {
      finish({
        ok: false,
        videoId,
        code: null,
        details: {
          code: 0,
          reason: 'probe_timeout',
          isPermanent: false,
          userMessage: 'Timed out while testing YouTube playback.'
        }
      });
    }, timeoutMs);

    player = new YT.Player(container.id, {
      width: '200',
      height: '200',
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady: (event) => {
          try {
            event.target.setVolume?.(0);
            event.target.loadVideoById(videoId);
            event.target.playVideo?.();
          } catch (error) {
            clearTimeout(timeoutId);
            finish({
              ok: false,
              videoId,
              code: null,
              details: {
                code: 0,
                reason: 'probe_start_failed',
                isPermanent: false,
                userMessage: error?.message || 'Failed to start the YouTube playback probe.'
              }
            });
          }
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING ||
              event.data === YT.PlayerState.BUFFERING ||
              event.data === YT.PlayerState.CUED) {
            clearTimeout(timeoutId);
            finish({
              ok: true,
              videoId,
              code: null,
              details: {
                code: 0,
                reason: 'ok',
                isPermanent: false,
                userMessage: 'YouTube video can play in the embedded player.'
              }
            });
          }
        },
        onError: (event) => {
          clearTimeout(timeoutId);
          finish({
            ok: false,
            videoId,
            code: event.data,
            details: getYouTubeErrorDetails(event.data)
          });
        }
      }
    });
  });
}
