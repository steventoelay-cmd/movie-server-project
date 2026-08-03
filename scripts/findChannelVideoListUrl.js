'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

async function count(url) {
  try {
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
      timeout: 25000,
      validateStatus: () => true,
    });
    const $ = cheerio.load(r.data);
    const vu = $('div.thumb-block[id^="video_"]').length;
    const vt = $('div.thumb-block[id^="video-thumb-"]').length;
    if (vu > 0 || vt > 0) {
      console.log({ url, status: r.status, vu, vt });
    }
  } catch (e) {
    console.log({ url, err: e.message });
  }
}

async function main() {
  const slug = 'javhd';
  const candidates = [
    `https://www.xvideos.com/?k=${encodeURIComponent(`channel:${slug}`)}`,
    `https://www.xvideos.com/?k=${slug}`,
    `https://www.xvideos.com/?k=${encodeURIComponent('uploader:' + slug)}`,
    `https://www.xvideos.com/profiles/${slug}`,
    `https://www.xvideos.com/profiles/${slug}/videos`,
    `https://www.xvideos.com/channels/${slug}/videos`,
    `https://www.xvideos.com/channels/${slug}/videos/new`,
    `https://www.xvideos.com/${slug}/videos/new/1`,
    // Broken for channel-specific lists — same generic 48 videos for every slug:
    `https://www.xvideos.com/?u=${slug}`,
  ];
  for (const u of candidates) {
    await count(u);
  }
  // aistoryly from user
  await count('https://www.xvideos.com/?k=aistoryly');
  await count('https://www.xvideos.com/?k=AIStoryly');
}

main();
