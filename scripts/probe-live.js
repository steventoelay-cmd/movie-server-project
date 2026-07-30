'use strict';

const axios = require('axios');
const { parseDetail } = require('../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../src/scrapers/parsers/parseStream');
const tubev = require('../src/scrapers/sites/tubev/selectors');
const xv = require('../src/scrapers/sites/xvideos/selectors');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function probeSite(label, listUrl, config, headers = {}) {
  console.log('\n===', label, '===');
  const listRes = await axios.get(listUrl, {
    headers: { 'User-Agent': UA, ...headers },
    timeout: 20000,
  });
  const listHtml = listRes.data;
  const videoMatch =
    listHtml.match(/href="(\/video[^"]+)"/i) ||
    listHtml.match(/href="(https?:\/\/[^"]+\/watch\/[^"]+)"/i) ||
    listHtml.match(/href="(\/watch\/[^"]+)"/i);
  if (!videoMatch) {
    console.log('No video link found on list page');
    return;
  }
  let videoUrl = videoMatch[1];
  if (videoUrl.startsWith('/')) {
    videoUrl = new URL(videoUrl, listUrl).href;
  }
  console.log('Video URL:', videoUrl);

  const pageRes = await axios.get(videoUrl, {
    headers: { 'User-Agent': UA, Referer: listUrl, ...headers },
    timeout: 25000,
  });
  const html = pageRes.data;
  console.log('HTML bytes:', html.length);

  const detail = parseDetail(html, config.detailConfig, videoUrl);
  console.log('Title:', detail.title?.slice(0, 60));
  console.log('Related raw:', detail.related?.length || 0);

  const stream = parseStream(html, config.streamConfig, videoUrl);
  console.log('m3u8:', stream.m3u8 ? stream.m3u8.slice(0, 80) + '...' : null);
  console.log('mp4:', stream.mp4 ? stream.mp4.slice(0, 80) + '...' : null);
  console.log('iframe:', stream.iframeSrc || null);
}

async function main() {
  try {
    await probeSite('xvideos', 'https://www.xvideos.com/best/2026-05', xv, {
      Referer: 'https://www.xvideos.com/',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });
  } catch (e) {
    console.error('xvideos error:', e.message);
  }

  try {
    await probeSite('tubev', 'https://www.tubev.sex/videos', tubev);
  } catch (e) {
    console.error('tubev error:', e.message);
  }
}

main();
