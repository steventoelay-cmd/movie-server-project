# Storage, pagination & cache architecture

This document describes how **Movies_Server_Project** stores catalog JSON on GitHub, runs the scraper pipeline on a **1GB RAM VPS**, and serves **load-more** and **stream** data.

## 1. Folder structure

### GitHub (static listings)

Items in GitHub JSON are **only** `{ title, img, url }`. No m3u8, tokens, or stream URLs.

| Layout | Env | Paths |
|--------|-----|--------|
| **legacy** (default) | `CATALOG_LAYOUT=legacy` | `home/page-N.json`, `models/index.json`, `models/{parentId}/page-N.json`, same for `channels/`, `tags/`, optional `myanmar/` |
| **v2** | `CATALOG_LAYOUT=v2` | `home/page-N.json`, `model/page-N.json`, `model/child/{parentId}/page-N.json`, `channel/`, `tag/` |

With `CATALOG_MIRROR_LEGACY=true` (default when v2), the generator also writes **legacy paths** so existing Flutter clients keep working.

Repo prefix: `GITHUB_BASE_PATH` (e.g. `data/`).

### Server (runtime)

```
output/              # Latest generated catalog (source for load-more API)
data/previous/       # Last promoted snapshot (diff baseline for GitHub upload)
data/cache/
  catalog/           # SSD cache for /catalog load-more (8h)
  related/           # SSD cache for related lists (8h)
  detail/            # Detail API (RAM + disk, 30m default)
  stream/            # Optional disk when STREAM_CACHE_RAM_ONLY=false
data/locks/          # Pipeline lock
```

## 2. Scraper workflow (every 8 hours)

- Cron: `SCHEDULER_CRON=0 */8 * * *` (default).
- **Sequential sections** (default): `PIPELINE_SEQUENTIAL_SECTIONS=true`, concurrency `1`.
- Scheduled order: `PIPELINE_SCHEDULED_SECTIONS=home,model,channel,tag` (myanmar optional via `PIPELINE_SCHEDULE_INCLUDE_MYANMAR=true`).

Per section:

```
Scrape → Normalize → Generate paginated JSON → Diff vs data/previous/ → Upload changed files only → Promote output/ → previous/
```

Manual runs still support `--section=` and `npm run pipeline:local`; use `PIPELINE_SEQUENTIAL_SECTIONS=false` and `PIPELINE_SECTION_CONCURRENCY=2` only if RAM allows.

## 3. Pagination JSON

Each page file includes:

| Field | Meaning |
|-------|---------|
| `page` | Page number (1-based) |
| `items` | `{ title, img, url }[]` |
| `hasNext` | `true` if another page exists in this series |
| `totalItems` | Count on **this** page |
| `version` | Content hash (16 chars) |

Flutter **page 1**: GitHub raw CDN. **Page 2+**: backend load-more API (below).

## 4. Cache strategy

| Data | Store | TTL | Notes |
|------|--------|-----|--------|
| Catalog listings (bulk) | GitHub | Until next pipeline | Not loaded entirely into RAM |
| Load-more pages | SSD `data/cache/catalog` | `CATALOG_SSD_CACHE_TTL_MS` (8h) | Via `CatalogLoadService` |
| Related videos | SSD `data/cache/related` | `RELATED_CACHE_TTL_MS` (8h) | Written on detail scrape |
| Video detail | RAM + SSD `data/cache/detail` | 30m default | Existing DetailCache |
| m3u8 / stream | **RAM only** (default) | `STREAM_CACHE_TTL_MS` (4m) | `STREAM_CACHE_RAM_ONLY=true`, PromiseLock per URL |

## 5. Load-more API

```
GET /catalog/:section/page/:page
GET /catalog/:section/parent/:page?parentIndex=true
GET /catalog/:section/child/:parentId/page/:page
```

Same routes under `/api/catalog/`. Optional `X-Api-Key` if configured.

Flow:

```
Flutter → API → CatalogSsdCache hit? → return
              → miss → read output/{path}.json → cache SSD → return
```

## 6. GitHub sync (unchanged behavior, clarified)

- `CatalogDiffService` compares `output/` vs `data/previous/`.
- Only **changed** JSON files + `version.json` are committed (partial upload).
- Unchanged files are never uploaded.
- `scripts/forceUploadSections.js` bypasses diff for recovery.

## 7. Migration from older layout

1. **Keep legacy (recommended short term)**  
   Leave `CATALOG_LAYOUT=legacy`. Redeploy backend; redeploy Flutter as-is (`models/`, `index.json`).

2. **Enable v2 + mirror**  
   Set `CATALOG_LAYOUT=v2`, `CATALOG_MIRROR_LEGACY=true`. Run pipeline; GitHub gets both layouts. Point new clients at `model/child/...` when ready.

3. **Add load-more in Flutter**  
   Page 1: GitHub. Page N≥2: `API_BASE_URL/catalog/home/page/N` (etc.).

4. **VPS tuning (1GB)**  
   - `PIPELINE_SEQUENTIAL_SECTIONS=true`  
   - `PIPELINE_SECTION_CONCURRENCY=1`  
   - `PIPELINE_PARENT_CONCURRENCY=2`  
   - `STREAM_CACHE_RAM_ONLY=true`  

5. **Optional myanmar in schedule**  
   `PIPELINE_SCHEDULE_INCLUDE_MYANMAR=true` or manual `npm run pipeline:myanmar`.

## 8. Backward compatibility

- Detail `/detail`, stream `/stream`, admin pipeline unchanged.
- Legacy GitHub paths remain default generator output.
- Additive JSON field `hasNext` (old clients ignore it).
- New catalog routes are optional for clients that only use GitHub page-1.
