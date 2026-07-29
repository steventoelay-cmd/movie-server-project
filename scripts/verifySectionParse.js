'use strict';

const { createXvideosAdapter } = require('../src/scrapers/sites/xvideos');
const { parseList } = require('../src/scrapers/parsers/parseList');
const { SECTIONS } = require('../src/domain/constants/sections');

async function sample(section, url) {
  const adapter = createXvideosAdapter();
  const cfg = adapter.getSectionConfig(section);
  const html = await adapter.fetchHtml(url || cfg.baseUrl);
  const items = parseList(html, cfg, url || cfg.baseUrl);
  console.log(`\n=== ${section} count=${items.length} ===`);
  for (const it of items.slice(0, 3)) {
    console.log({
      title: (it.title || '').slice(0, 60),
      img: (it.img || '').slice(0, 90),
      url: (it.url || '').slice(0, 80),
    });
  }
  const missingTitle = items.filter((i) => !i.title).length;
  const missingImg = items.filter((i) => !i.img).length;
  const missingUrl = items.filter((i) => !i.url).length;
  console.log({ missingTitle, missingImg, missingUrl });
}

async function main() {
  await sample(SECTIONS.MYANMAR);
  await sample(SECTIONS.MODEL);
  await sample(SECTIONS.CHANNEL);
  await sample(SECTIONS.TAG);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
