'use strict';

const axios = require('axios');
const { parseDetail } = require('../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../src/scrapers/parsers/parseStream');
const { normalizeDetail } = require('../src/scrapers/normalizers/detail.normalizer');
const { validateStreamUrl } = require('../src/utils/stream.validator');
const xv = require('../src/scrapers/sites/xvideos/selectors');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function verify(label, videoUrl, config, headers = {}) {
  const res = await axios.get(videoUrl, {
    headers: { 'User-Agent': UA, ...headers },
    timeout: 30000,
  });
  const raw = parseDetail(res.data, config.detailConfig, videoUrl);
  const detail = normalizeDetail(raw, videoUrl, { siteId: label });
  const stream = parseStream(res.data, config.streamConfig, videoUrl);
  const streamUrl = stream.m3u8 || stream.mp4;
  const streamType = stream.m3u8 ? 'm3u8' : 'mp4';
  const valid = streamUrl
    ? validateStreamUrl(streamUrl, { requireM3u8: streamType !== 'mp4' }).valid
    : false;

  console.log(`\n[${label}] ${videoUrl}`);
  console.log('  title:', detail.title.slice(0, 50));
  console.log('  related:', detail.related.length);
  console.log('  stream:', streamType, valid ? streamUrl.slice(0, 70) + '...' : 'MISSING');
}

async function main() {
  const xvList = await axios.get('https://www.xvideos.com/best/2026-05', {
    headers: { 'User-Agent': UA, Referer: 'https://www.xvideos.com/' },
    timeout: 25000,
  });
  const xvMatch = xvList.data.match(/href="(\/video[^"]+)"/i);
  const xvUrl = new URL(xvMatch[1], 'https://www.xvideos.com').href;
  await verify('xvideos', xvUrl, xv, { Referer: 'https://www.xvideos.com/' });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
