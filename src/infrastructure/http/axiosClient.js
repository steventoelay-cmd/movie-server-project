'use strict';

const axios = require('axios');
const { scraperConfig } = require('../../config/scraper.config');
const { buildHeaders } = require('./headers');

/**
 * Shared Axios instance for outbound HTML fetches.
 */
const axiosClient = axios.create({
  timeout: scraperConfig.timeoutMs,
  maxRedirects: 5,
  responseType: 'text',
  validateStatus: (status) => status >= 200 && status < 400,
});

/**
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function getHtml(url, options = {}) {
  const timeout = options.timeoutMs ?? scraperConfig.timeoutMs;
  return axiosClient.get(url, {
    headers: buildHeaders(options),
    timeout,
  });
}

module.exports = {
  axiosClient,
  getHtml,
};
