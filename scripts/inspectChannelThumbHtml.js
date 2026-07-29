'use strict';

const cheerio = require('cheerio');
const { createXvideosAdapter } = require('../src/scrapers/sites/xvideos');
const { parseList } = require('../src/scrapers/parsers/parseList');
const { SECTIONS } = require('../src/domain/constants/sections');

async function probe(parentUrl) {
  const adapter = createXvideosAdapter();
  const childCfg = adapter.childrenConfigs[SECTIONS.CHANNEL];
  const html = await adapter.fetchHtml(parentUrl);
  const items = parseList(html, childCfg, parentUrl);
  const $ = cheerio.load(html);
  const $first = $('div.thumb-block').first();
  console.log('\nURL', parentUrl);
  console.log('parsed', items.length, 'blocks', $('div.thumb-block').length);
  console.log('id sample', $first.attr('id'));
  console.log('div.title', $first.find('div.title').text().trim().slice(0, 40));
  console.log('p.title', $first.find('p.title').text().trim().slice(0, 40));
  if ($first.length) console.log('snippet', ($first.html() || '').replace(/\s+/g, ' ').slice(0, 280));
}

async function main() {
  await probe('https://www.xvideos.com/asiam');
  await probe('https://www.xvideos.com/aistoryly');
  await probe('https://www.xvideos.com/myanma_porn');
}

main();
