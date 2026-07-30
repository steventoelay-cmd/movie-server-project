'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const { parseList } = require('../src/scrapers/parsers/parseList');
const { SECTIONS } = require('../src/domain/constants/sections');
const tubev = require('../src/scrapers/sites/tubev/selectors');
const xv = require('../src/scrapers/sites/xvideos/selectors');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function inspectXvideosRelated() {
  const url =
    'https://www.xvideos.com/video.ooltike3264/doctor_non-stop_fuck_until_asian_girl_creampie_orgasm';
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.xvideos.com/' },
    timeout: 25000,
  });
  const html = res.data;
  const $ = cheerio.load(html);

  console.log('\n=== xvideos related DOM ===');
  const markers = [
    '#related-videos',
    '#video-related',
    '.related-videos',
    '.under-player',
    'div.thumb-block',
    'div[id^="video-thumb-"]',
    'div[id^="video_"]',
  ];
  for (const sel of markers) {
    console.log(sel, $(sel).length);
  }

  const configs = [
    ['current', xv.detailConfig.related],
    ['scoped related-videos', {
      selectors: {
        item: '#related-videos div.thumb-block, #video-related div.thumb-block',
        title: 'p.title a, .title a',
        image: 'img',
        url: 'p.title a, .title a',
      },
      attributes: xv.detailConfig.related.attributes,
    }],
    ['under-player', {
      selectors: {
        item: '.under-player div.thumb-block, .under-player div[id^="video-thumb-"]',
        title: 'p.title a, .title a',
        image: 'img',
        url: 'p.title a, .title a',
      },
      attributes: xv.detailConfig.related.attributes,
    }],
  ];

  for (const [name, cfg] of configs) {
    const items = parseList(html, cfg, url);
    console.log(`parseList ${name}:`, items.length, items[0] && items[0].title?.slice(0, 40));
  }
}

async function inspectTubev() {
  console.log('\n=== tubev list ===');
  const res = await axios.get('https://www.tubev.sex/videos', {
    headers: { 'User-Agent': UA },
    timeout: 25000,
  });
  const html = res.data;
  console.log('bytes', html.length);
  const items = parseList(html, tubev.sectionConfigs[SECTIONS.HOME], 'https://www.tubev.sex/videos');
  console.log('home list items', items.length, items[0]);
}

async function main() {
  await inspectXvideosRelated();
  await inspectTubev();
}

main().catch((e) => console.error(e.message));
