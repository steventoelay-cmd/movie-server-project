'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function main() {
  const url =
    'https://www.xvideos.com/video.ooltike3264/doctor_non-stop_fuck_until_asian_girl_creampie_orgasm';
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.xvideos.com/' },
    timeout: 25000,
  });
  const html = res.data;

  const patterns = [
    /related[^=]*=\s*(\[[\s\S]{20,5000}?\])/i,
    /"relatedVideos"\s*:\s*(\[[\s\S]{20,8000}?\])/i,
    /video_related\s*=\s*(\[[\s\S]{20,8000}?\])/i,
    /window\.xv\.conf\s*=\s*(\{[\s\S]{50,20000}?\});/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    console.log(p.source.slice(0, 40), m ? 'HIT len=' + m[1].length : 'miss');
  }

  const apiMatch = html.match(/https?:\/\/[^\"'\s]+related[^\"'\s]*/gi);
  console.log('related URLs in page', apiMatch && [...new Set(apiMatch)].slice(0, 5));

  const thumbJson = html.match(/"thumb[^"]*"\s*:\s*"[^"]+"/gi);
  console.log('thumb json snippets', thumbJson && thumbJson.slice(0, 3));

  // Check for data-video or similar attributes
  const $ = cheerio.load(html);
  $('script').each((i, el) => {
    const t = $(el).html() || '';
    if (/related/i.test(t) && /video/i.test(t) && t.length < 50000) {
      if (/thumb|relatedVideos|video_related|related-videos/i.test(t)) {
        console.log('\n--- script', i, 'len', t.length, '---');
        console.log(t.slice(0, 500));
      }
    }
  });
}

main().catch((e) => console.error(e.message));
