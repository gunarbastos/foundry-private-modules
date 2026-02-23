/**
 * Browser Detection & Audio Format Support
 * Extracted from narrator-jukebox.js for modular architecture
 */

export const JukeboxBrowser = {
  /**
   * Detect the current browser
   * @returns {string} Browser name: 'chrome', 'firefox', 'safari', 'edge', 'opera', 'unknown'
   */
  detect() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('opr/') || ua.includes('opera')) return 'opera';
    if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('firefox')) return 'firefox';
    return 'unknown';
  },

  /**
   * Get supported audio formats for a browser
   * @param {string} browser - Browser name
   * @returns {string[]} Array of supported formats
   */
  getFormats(browser) {
    const formats = {
      chrome: ['mp3', 'wav', 'ogg', 'webm', 'flac', 'm4a', 'aac'],
      firefox: ['mp3', 'wav', 'ogg', 'webm', 'flac'],
      edge: ['mp3', 'wav', 'ogg', 'webm', 'flac', 'm4a', 'aac'],
      opera: ['mp3', 'wav', 'ogg', 'webm', 'flac'],
      safari: ['mp3', 'wav', 'm4a', 'aac'],
      unknown: ['mp3', 'wav']
    };
    return formats[browser] || formats.unknown;
  },

  /**
   * Check if a file extension is supported by the current browser
   * @param {string} filename - File path or name
   * @returns {boolean}
   */
  isFormatSupported(filename) {
    if (!filename) return true;
    const ext = filename.split('.').pop().toLowerCase();
    const browser = this.detect();
    const supported = this.getFormats(browser);
    return supported.includes(ext);
  },

  /**
   * Get browser display info for the tooltip
   * @returns {object} Object with browser info
   */
  getBrowserInfo() {
    const browser = this.detect();
    const icons = {
      chrome: 'fab fa-chrome',
      firefox: 'fab fa-firefox',
      safari: 'fab fa-safari',
      edge: 'fab fa-edge',
      opera: 'fab fa-opera',
      unknown: 'fas fa-globe'
    };
    const names = {
      chrome: 'Chrome',
      firefox: 'Firefox',
      safari: 'Safari',
      edge: 'Edge',
      opera: 'Opera',
      unknown: 'Your Browser'
    };
    return {
      id: browser,
      icon: icons[browser],
      name: names[browser],
      formats: this.getFormats(browser)
    };
  },

  /**
   * Generate the HTML for the formats tag with tooltip
   * @returns {string} HTML string
   */
  getFormatsTagHTML() {
    const current = this.getBrowserInfo();
    const browsers = [
      { id: 'chrome', icon: 'fab fa-chrome', name: 'Chrome / Edge', formats: ['mp3', 'wav', 'ogg', 'webm', 'flac', 'm4a'] },
      { id: 'firefox', icon: 'fab fa-firefox', name: 'Firefox', formats: ['mp3', 'wav', 'ogg', 'webm', 'flac'] },
      { id: 'safari', icon: 'fab fa-safari', name: 'Safari', formats: ['mp3', 'wav', 'm4a', 'aac'] }
    ];

    const isSafari = current.id === 'safari';
    const warningHTML = isSafari ? `
      <div class="format-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Safari does not support .ogg files</span>
      </div>
    ` : '';

    const browsersHTML = browsers.map(b => {
      const isCurrent = (current.id === b.id) ||
                        (current.id === 'edge' && b.id === 'chrome') ||
                        (current.id === 'opera' && b.id === 'firefox');
      return `
        <div class="formats-browser ${isCurrent ? 'current' : ''}">
          <div class="formats-browser-icon"><i class="${b.icon}"></i></div>
          <div class="formats-browser-info">
            <div class="formats-browser-name">${b.name}</div>
            <div class="formats-browser-formats">${b.formats.join(', ')}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <span class="formats-tag">
        <i class="fas fa-music"></i> Supported Formats
        <div class="formats-tooltip">
          <div class="formats-tooltip-title">
            <i class="fas fa-headphones"></i> Audio Format Compatibility
          </div>
          ${browsersHTML}
          ${warningHTML}
        </div>
      </span>
    `;
  }
};
