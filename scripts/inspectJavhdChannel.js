'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

async function main() {
  const url = 'https://www.xvideos.com/javhd';
  const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(r.data);
  $('div.thumb-block').slice(0, 2).each((i, el) => {
    const $i = $(el);
    console.log('---', i, 'id=', $i.attr('id'), 'class=', $i.attr('class'));
    console.log('  a href', $i.find('a').first().attr('href'));
    console.log('  p.title', $i.find('p.title a').attr('href'), $i.find('p.title').text().trim().slice(0, 50));
    console.log('  script', ($i.find('script').first().html() || '').slice(0, 120));
  });
  // mozaique is common container for videos
  console.log('mozaique blocks', $('#main .mozaique .thumb-block').length);
  console.log('all video_ anywhere', $('[id^="video_"]').length);
  console.log('all video-thumb', $('[id^="video-thumb-"]').length);
}

main();
