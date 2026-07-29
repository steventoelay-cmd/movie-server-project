'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

async function check(url) {
  const r = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
    timeout: 25000,
    validateStatus: () => true,
  });
  const $ = cheerio.load(r.data);
  const vt = $('div.thumb-block[id^="video-thumb-"]').length;
  const vu = $('div.thumb-block[id^="video_"]').length;
  const tb = $('div.thumb-block').length;
  const videoLinks = $('a[href*="/video."]').length;
  console.log({ url, status: r.status, tb, vt, vu, videoLinks });
}

async function main() {
  const slugs = ['javhd', 'asiam', 'myanma_porn', 'aistoryly'];
  const paths = ['', '/videos', '/1', '/2', '/videos/1'];
  for (const slug of slugs) {
    for (const p of paths) {
      await check(`https://www.xvideos.com/${slug}${p}`);
    }
    await check(`https://www.xvideos.com/channels/${slug}`);
    await check(`https://www.xvideos.com/channels/${slug}/videos`);
  }
}

main().catch(console.error);
