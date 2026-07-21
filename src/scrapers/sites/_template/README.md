# New website adapter template

Copy this folder to `src/scrapers/sites/{siteId}/` and implement:

1. `selectors.js` — base URLs, CSS selectors, attributes, pagination (site-specific only)
2. `index.js` — export `createAdapter()` returning a `SelectorSiteAdapter` (or custom `SiteAdapter`)

Then register it in `src/scrapers/registerSites.js`.

## Required interface

Every adapter must support the same surface:

- `fetchHtml(url, ctx)`
- `parseHome(html, pageUrl)`
- `parseModelParents(html, pageUrl)`
- `parseChannelParents(html, pageUrl)`
- `parseTagParents(html, pageUrl)`
- `parseChildren(html, pageUrl, section)`
- `buildSectionUrl(section, page)`
- `buildChildrenUrl(section, parentUrl, page)`
- `supportsSection(section)`

Prefer `SelectorSiteAdapter` and keep all CSS selectors inside this site folder.

Optional for Detail API (Prompt 5):

- `detailHosts: ['example.com']`
- `detailConfig.fields` — title/image/description/duration/releaseDate/category/tags
- `detailConfig.related` — one-level related list selectors

Optional for Stream API (Prompt 6 — Play only):

- `streamConfig.videoExtraction` — m3u8 selectors/patterns/iframe follow
- Never call parseStream from Detail API


## Do not

- Put selectors in common engine modules
- Scrape detail / related / m3u8 in list adapters
- Call GitHub, scheduler, or API layers from adapters
