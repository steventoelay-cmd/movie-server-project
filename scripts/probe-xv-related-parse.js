'use strict';

const axios = require('axios');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseVideoRelated(html, pageUrl) {
  const m = html.match(/var\s+video_related\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) return [];
  const items = JSON.parse(m[1]);
  const origin = new URL(pageUrl).origin;
  return items.slice(0, 24).map((item) => ({
    title: item.tf || item.t || item.title || slugTitle(item.u),
    img: item.i || item.il || item.if || item.ip || '',
    url: item.u?.startsWith('http') ? item.u : `${origin}${item.u}`,
  }));
}

function slugTitle(u = '') {
  const slug = u.split('/').filter(Boolean).pop() || '';
  return slug.replace(/_/g, ' ').replace(/-/g, ' ');
}

async function main() {
  const url =
    'https://www.xvideos.com/video.ooltike3264/doctor_non-stop_fuck_until_asian_girl_creampie_orgasm';
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.xvideos.com/' },
    timeout: 25000,
  });
  const related = parseVideoRelated(res.data, url);
  console.log('count', related.length);
  console.log(related[0]);
}

main().catch((e) => console.error(e.message));
