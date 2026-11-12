'use strict';

const { parseXvideosVideoRelated } = require('../../src/scrapers/parsers/parseRelatedScripts');
const { parseDetail } = require('../../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../../src/scrapers/parsers/parseStream');
const { validateStreamUrl } = require('../../src/utils/stream.validator');
const xv = require('../../src/scrapers/sites/xvideos/selectors');

describe('parseXvideosVideoRelated', () => {
  test('extracts related from video_related script', () => {
    const html = `<html><body><script>
      var video_related=[{"id":1,"u":"/video.abc123/sample_title","tf":"Sample Title","i":"https://cdn.example.com/t.jpg"}];
      xv.thumbs.write_related(video_related);
    </script></body></html>`;

    const related = parseXvideosVideoRelated(html, 'https://www.xvideos.com/video.xyz/main');
    expect(related).toHaveLength(1);
    expect(related[0].title).toBe('Sample Title');
    expect(related[0].url).toBe('https://www.xvideos.com/video.abc123/sample_title');
    expect(related[0].img).toContain('cdn.example.com');
  });

  test('parseDetail falls back to script related when DOM is empty', () => {
    const html = `<html><head><meta property="og:title" content="Main Video"/></head><body>
      <script>var video_related=[{"u":"/video.abc/rel_one","tf":"Rel One","i":"https://cdn.example.com/r.jpg"}];</script>
    </body></html>`;
    const raw = parseDetail(html, xv.detailConfig, 'https://www.xvideos.com/video.abc/main');
    expect(raw.related).toHaveLength(1);
    expect(raw.related[0].title).toBe('Rel One');
  });
});

describe('mp4 stream extraction', () => {
  test('parseStream returns mp4 when page has no m3u8', () => {
    const html = `<html><body><video src="https://vcdn.example.com/play.mp4?token=abc"></video></body></html>`;
    const parsed = parseStream(html, xv.streamConfig, 'https://www.xvideos.com/video.abc/sample');
    expect(parsed.m3u8).toBeNull();
    expect(parsed.mp4).toContain('.mp4');
    expect(validateStreamUrl(parsed.mp4, { requireM3u8: false }).valid).toBe(true);
  });
});
