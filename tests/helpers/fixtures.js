'use strict';

const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'html');

/**
 * @param {string} name - filename under fixtures/html
 * @returns {string}
 */
function loadHtml(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

const DETAIL_CONFIG = {
  fields: {
    title: { selector: 'h1', attribute: 'text' },
    image: { selector: 'meta[property="og:image"]', attribute: 'attr:content' },
    description: { selector: 'meta[property="og:description"]', attribute: 'attr:content' },
    duration: { selector: '.duration', attribute: 'text' },
    tags: { item: 'a.tag', attribute: 'text' },
  },
  related: {
    selectors: {
      item: '#related_video_block figure.drop-label_else',
      title: 'a.i.tur',
      image: 'img',
      url: 'a.i.tur',
    },
    attributes: {
      title: 'attr:title',
      image: 'attr:src',
      url: 'attr:href',
    },
  },
};

const SAMPLE_PAGE_URL = 'https://www.tubev.sex/watch/sample';

/**
 * Build N catalog items for pagination / load tests.
 * @param {number} count
 * @param {string} [prefix]
 */
function makeItems(count, prefix = 'https://www.tubev.sex/watch') {
  const items = [];
  for (let i = 1; i <= count; i += 1) {
    items.push({
      title: `Video ${i}`,
      img: `https://cdn.example.com/${i}.jpg`,
      url: `${prefix}/${i}`,
    });
  }
  return items;
}

module.exports = {
  loadHtml,
  DETAIL_CONFIG,
  SAMPLE_PAGE_URL,
  makeItems,
  FIXTURES_DIR,
};
