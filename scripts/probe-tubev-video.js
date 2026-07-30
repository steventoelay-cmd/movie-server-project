'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const { parseDetail } = require('../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../src/scrapers/parsers/parseStream');
const { parseList } = require('../src/scrapers/parsers/parseList');
const { SECTIONS } = require('../src/domain/constants/sections');
const tubev = require('../src/scrapers/sites/tubev/selectors');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function probeTubevVideo(videoUrl) {
  console.log('\n=== tubev video ===', videoUrl);
  const res = await axios.get(videoUrl, {
    headers: { 'User-Agent': UA, Referer: 'https://www.tubev.sex/videos' },
    timeout: 30000,
  });
  const html = res.data;
  console.log('bytes', html.length);

  const $ = cheerio.load(html);
  console.log('#related_video_block', $('#related_video_block').length);
  console.log('figure.drop-label_else', $('figure.drop-label_else').length);
  console.log('iframe count', $('iframe').length);

  const detail = parseDetail(html, tubev.detailConfig, videoUrl);
  console.log('title', detail.title?.slice(0, 50));
  console.log('related raw', detail.related?.length);

  const stream = parseStream(html, tubev.streamConfig, videoUrl);
  console.log('m3u8', stream.m3u8?.slice(0, 100) || null);
  console.log('mp4', stream.mp4?.slice(0, 100) || null);
  console.log('iframe', stream.iframeSrc);

  if (!stream.m3u8 && stream.iframeSrc) {
    const iframeRes = await axios.get(stream.iframeSrc, {
      headers: { 'User-Agent': UA, Referer: videoUrl },
      timeout: 30000,
    });
    const iframeStream = parseStream(iframeRes.data, tubev.streamConfig, stream.iframeSrc);
    console.log('iframe m3u8', iframeStream.m3u8?.slice(0, 100) || null);
    console.log('iframe mp4', iframeStream.mp4?.slice(0, 100) || null);
  }

  // scan scripts for m3u8/mp4 hints
  const scriptHits = (html.match(/\.m3u8/gi) || []).length;
  const mp4Hits = (html.match(/\.mp4/gi) || []).length;
  console.log('script m3u8 mentions', scriptHits, 'mp4 mentions', mp4Hits);
}

async function main() {
  const listRes = await axios.get('https://www.tubev.sex/videos', {
    headers: { 'User-Agent': UA },
    timeout: 25000,
  });
  const items = parseList(
    listRes.data,
    tubev.sectionConfigs[SECTIONS.HOME],
    'https://www.tubev.sex/videos',
  );
  await probeTubevVideo(items[0].url);
}

main().catch((e) => console.error(e.response?.status, e.message));
