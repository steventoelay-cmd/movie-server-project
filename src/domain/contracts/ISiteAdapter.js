'use strict';

/**
 * Site adapter contract (port).
 *
 * Every website adapter MUST implement this surface.
 * Documented as JSDoc — CommonJS has no interfaces at runtime.
 *
 * @typedef {object} ISiteAdapter
 * @property {string} siteId
 * @property {string[]} [supportedSections]
 * @property {(url: string, ctx?: object) => Promise<string>} fetchHtml
 * @property {(html: string, pageUrl: string) => Array<{title:string,img:string,url:string}>} parseHome
 * @property {(html: string, pageUrl: string) => Array<{title:string,img:string,url:string}>} parseModelParents
 * @property {(html: string, pageUrl: string) => Array<{title:string,img:string,url:string}>} parseChannelParents
 * @property {(html: string, pageUrl: string) => Array<{title:string,img:string,url:string}>} parseTagParents
 * @property {(html: string, pageUrl: string, section: string) => Array<{title:string,img:string,url:string}>} parseChildren
 * @property {(section: string, page?: number) => string} buildSectionUrl
 * @property {(section: string, parentUrl: string, page?: number) => string} buildChildrenUrl
 * @property {(section: string) => boolean} supportsSection
 */

module.exports = {};
