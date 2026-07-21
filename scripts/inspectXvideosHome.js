'use strict';

const cheerio = require('cheerio');
const { createXvideosAdapter } = require('../src/scrapers/sites/xvideos');

async function main() {
  const adapter = createXvideosAdapter();
  const html = await adapter.fetchHtml('https://www.xvideos.com/best/2026-05');
  const $ = cheerio.load(html);
  const $el = $('div.thumb-block').first();
  console.log('FULL first block text nodes classes:');
  $el.find('*').each((_, n) => {
    const tag = n.tagName;
    const cls = $(n).attr('class') || '';
    if (/title|name|under|meta/i.test(cls) || tag === 'p' || tag === 'span') {
      console.log(tag, cls, 'text=', String($(n).text()).slice(0, 120));
    }
  });
  console.log('--- outerHTML length', $el.html().length);
  // title might be after thumb-inside
  console.log('children classes', $el.children().map((_, c) => $(c).attr('class')).get());
  $el.children().each((i, c) => {
    console.log('child', i, $(c).attr('class'), String($(c).text()).replace(/\s+/g, ' ').slice(0, 150));
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
