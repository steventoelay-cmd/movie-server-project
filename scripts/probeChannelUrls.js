'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

async function check(url) {
  const r = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
    maxRedirects: 5,
    timeout: 25000,
    validateStatus: () => true,
  });
  const $ = cheerio.load(r.data);
  const thumbs = $('div.thumb-block').length;
  const videoUnderscore = $('div.thumb-block[id^="video_"]').length;
  const h1 = $('h1, h2.page-title').first().text().trim().slice(0, 80);
  console.log({ url, status: r.status, thumbs, videoUnderscore, h1 });
  if (thumbs === 0) {
    const links = $('a[href*="/video"]').slice(0, 3);
    links.each((i, el) => console.log('  link', $(el).attr('href')));
  }
}

async function main() {
  const urls = [
    'https://www.xvideos.com/aistoryly',
    'https://www.xvideos.com/aistoryly1',
    'https://www.xvideos.com/channels/aistoryly',
    'https://www.xvideos.com/asiam',
    'https://www.xvideos.com/javhd',
  ];
  for (const u of urls) {
    try {
      await check(u);
    } catch (e) {
      console.log({ url: u, err: e.message });
    }
  }
}

main();
