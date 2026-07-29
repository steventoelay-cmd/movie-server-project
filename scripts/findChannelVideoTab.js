'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

async function links(url) {
  const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true });
  const $ = cheerio.load(r.data);
  console.log('\n', url, 'status', r.status);
  const seen = new Set();
  $('a[href]').each((_, el) => {
    const h = $(el).attr('href') || '';
    if (!h.includes('javhd') && !h.includes('video') && !h.includes('channel')) return;
    if (seen.has(h)) return;
    seen.add(h);
    if (seen.size > 25) return false;
    const t = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 40);
    console.log(' ', h, t ? '| ' + t : '');
  });
}

async function main() {
  await links('https://www.xvideos.com/channels/javhd');
  await links('https://www.xvideos.com/javhd');
  // model comparison
  const r = await axios.get('https://www.xvideos.com/amateurs/myanma_porn1', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const $ = cheerio.load(r.data);
  console.log('\n model page video blocks', $('div.thumb-block[id^="video_"]').length);
}

main();
