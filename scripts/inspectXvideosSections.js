'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const urls = {
  myanmar: 'https://www.xvideos.com/?k=myanmar',
  models: 'https://www.xvideos.com/pornstars-index',
  channels: 'https://www.xvideos.com/channels-index',
  tags: 'https://www.xvideos.com/tags',
};

async function main() {
  for (const [name, url] of Object.entries(urls)) {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
      timeout: 25000,
    });
    const $ = cheerio.load(data);
    console.log(`\n=== ${name} ===`);

    if (name === 'myanmar') {
      console.log('video-thumb', $('div.thumb-block[id^="video-thumb-"]').length);
      console.log('video_', $('div.thumb-block[id^="video_"]').length);
      const $i = $('div.thumb-block[id^="video_"]').first();
      console.log('id', $i.attr('id'));
      console.log('p.title', $i.find('p.title').text().trim().slice(0, 80));
      console.log('div.title', $i.find('div.title').text().trim().slice(0, 80));
      console.log('thumb-link', $i.find('a.thumb-link').attr('href'));
      console.log('p.title a', $i.find('p.title a').attr('href'));
      console.log('img data-src', ($i.find('div.thumb img').attr('data-src') || '').slice(0, 100));
      console.log('snippet', ($i.html() || '').replace(/\s+/g, ' ').slice(0, 400));
    }

    if (name === 'models' || name === 'channels') {
      console.log('thumb-block', $('div.thumb-block').length);
      console.log('profile_', $(`div[id^="profile_"]`).length);
      $('div.thumb-block, div[id^="profile_"]').slice(0, 2).each((i, el) => {
        const $i = $(el);
        console.log(`--- item ${i} id=${$i.attr('id')}`);
        console.log('p.profile-name a', $i.find('p.profile-name a').text().trim());
        console.log('span.profile-name', $i.find('span.profile-name').text().trim());
        console.log('.profile-name text', $i.find('.profile-name').first().text().trim().slice(0, 80));
        console.log('a.href profile', $i.find('p.profile-name a, .profile-name a').first().attr('href'));
        console.log('imgs', $i.find('img').length);
        const sc = $i.find('script').first().html() || '';
        const m =
          sc.match(/src=["'](https?:[^"']+)["']/i) ||
          sc.match(/(https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*)/i);
        console.log('script img', m ? m[1].slice(0, 120) : 'none');
        console.log('snippet', ($i.html() || '').replace(/\s+/g, ' ').slice(0, 450));
      });
    }

    if (name === 'tags') {
      console.log('#tags li', $('#tags li').length);
      const $li = $('#tags li').first();
      console.log('first', $li.find('a').attr('href'), $li.find('a').text().trim().slice(0, 40));
      console.log('/lang/', $('#tags a[href*="/lang/"]').length);
      console.log('/tags/', $('#tags a[href*="/tags/"]').length);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
