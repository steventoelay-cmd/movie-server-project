'use strict';

/**
 * Default m3u8 extraction patterns (site adapters may override via streamConfig).
 */
const DEFAULT_STREAM_EXTRACTION = Object.freeze({
  selectors: {
    m3u8: {
      selector: 'source[type="application/x-mpegURL"], source[src*=".m3u8"], video[src*=".m3u8"]',
      attribute: 'attr:src',
    },
    mp4: {
      selector: 'video source[type="video/mp4"], video[src*=".mp4"]',
      attribute: 'attr:src',
    },
  },
  m3u8Patterns: [
    /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
    /'(https?:\/\/[^'\\]+\.m3u8[^'\\]*)'/i,
    /hlsUrl\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /src\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
  ],
  mp4Patterns: [
    /"(https?:\/\/[^"\\]+\.mp4[^"\\]*)"/i,
    /file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
  ],
  scriptM3u8Patterns: [
    /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
    /m3u8\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /hls[_]?url\s*[=:]\s*["']([^"']+)["']/i,
  ],
  scriptMp4Patterns: [
    /"(https?:\/\/[^"\\]+\.mp4[^"\\]*)"/i,
    /video_url\s*[=:]\s*["']([^"']+)["']/i,
  ],
  followIframe: true,
  iframeSelector: 'iframe.player, iframe#player, iframe[src*="embed"], iframe[src*="player"]',
});

module.exports = { DEFAULT_STREAM_EXTRACTION };
