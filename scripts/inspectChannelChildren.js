'use strict';

const cheerio = require('cheerio');
const { createXvideosAdapter } = require('../src/scrapers/sites/xvideos');
const { parseList } = require('../src/scrapers/parsers/parseList');
const { SECTIONS } = require('../src/domain/constants/sections');

async function probe(section, parentUrl) {
  const adapter = createXvideosAdapter();
  const childCfg = adapter.childrenConfigs[section];
  const listUrl =
    typeof childCfg.resolveChildrenBaseUrl === 'function'
      ? childCfg.resolveChildrenBaseUrl(parentUrl)
      : parentUrl;
  const html = await adapter.fetchHtml(listUrl);
  const items = parseList(html, childCfg, listUrl);
  const $ = cheerio.load(html);
  console.log(`\n=== ${section} ${parentUrl} ===`);
  console.log('listUrl', listUrl);
  console.log('parsed items', items.length);
  console.log('video-thumb', $('div.thumb-block[id^="video-thumb-"]').length);
  console.log('video_', $('div.thumb-block[id^="video_"]').length);
  console.log('thumb-block total', $('div.thumb-block').length);
  if (items[0]) {
    console.log('first', { title: items[0].title?.slice(0, 50), url: items[0].url?.slice(0, 60) });
  }
  const page2 = adapter.buildChildrenUrl(section, parentUrl, 2);
  console.log('page2 url', page2);
}

async function main() {
  await probe(SECTIONS.CHANNEL, 'https://www.xvideos.com/aistoryly');
  await probe(SECTIONS.CHANNEL, 'https://www.xvideos.com/javhd');
  await probe(SECTIONS.MODEL, 'https://www.xvideos.com/amateurs/myanma_porn1');
  await probe(SECTIONS.TAG, 'https://www.xvideos.com/tags/amateur');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
