# Flutter ↔ Node.js API & JSON Contract (Official)

**Contract version:** `1.0`  
**Status:** Stable — documents the **currently deployed** backend shapes.  
**Principle:** Stability over optimization. Do not break existing formats without a version bump.

This document is the communication contract between:

- Flutter app (Home / Model / Channel / Tag / Details / Player)
- Node.js backend (GitHub CDN lists + live Detail / Stream APIs)

---

## 1. Architecture split (why)

| Data | Source | Why |
|------|--------|-----|
| Home / Model / Channel / Tag **lists** | GitHub JSON (CDN) | Scalable for 50k+ videos; no VPS hit for browsing |
| Video **details** + related | `GET /detail` | Lazy, cacheable; no m3u8 |
| Playable **stream** | `GET /stream` | Only on Play; temporary m3u8; never in GitHub |

**Never** put m3u8, stream tokens, or ephemeral URLs in GitHub JSON.

---

## 2. GitHub JSON layout (listing only)

```
output/   (synced to GitHub repo root or GITHUB_BASE_PATH)
  home/page-1.json
  home/page-2.json
  models/index.json
  models/{parentId}/page-1.json
  channels/index.json
  channels/{parentId}/page-1.json
  tags/index.json
  tags/{parentId}/page-1.json
  version.json          # sync metadata (optional for Flutter)
```

### 2.1 Common list document schema (Contract v1 — live)

Every list/index/children page file uses this shape (already generated):

```json
{
  "schemaVersion": 1,
  "generatorVersion": "1.0.0",
  "section": "home",
  "page": 1,
  "totalItems": 100,
  "hasNext": true,
  "version": "a1b2c3d4e5f67890",
  "generatedAt": "2026-07-21T06:00:00.000Z",
  "lastUpdate": "2026-07-21T06:00:00.000Z",
  "meta": {
    "compression": "none",
    "kind": "list"
  },
  "items": [
    {
      "id": "a1b2c3d4e5f67890",
      "title": "Video title",
      "img": "https://cdn.example.com/poster.jpg",
      "url": "https://www.example.com/watch/abc"
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schemaVersion` | int | yes | Flutter JSON schema version |
| `generatorVersion` | string | yes | Backend generator semver |
| `section` | string | yes | `home` \| `model` \| `channel` \| `tag` |
| `page` | int | yes | 1-based page index |
| `totalItems` | int | yes | Items **on this page** (not global total) |
| `hasNext` | bool | yes | `true` when another page file exists |
| `version` | string | yes | Content hash of items (ignore volatile timestamps when caching) |
| `generatedAt` | ISO-8601 | yes | Generation time |
| `lastUpdate` | ISO-8601 | yes | Same as generatedAt today; reserved for future |
| `meta` | object | yes | Extensible; unknown keys ignored by Flutter |
| `items` | array | yes | List items |

**Item fields (list / parent / child):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable `sha256(canonicalUrl).slice(0,16)` — use for Flutter keys |
| `title` | string | yes | Never null; may be `"Untitled"` only in edge cases on APIs |
| `img` | string | yes* | Absolute URL; may be `""` if missing. *Tag parents omit `img` |
| `url` | string | yes | Absolute child or parent page URL |

**Not included:** `m3u8`, stream URLs, tokens, nested related, detail text.

### 2.2 Flutter pagination mapping (from file pages)

Backend paginates by **files** (`page-N.json`), page size = `JSON_PAGE_SIZE` (default 100).

Flutter should treat:

| Contract concept | How to derive (v1) |
|------------------|--------------------|
| `page` | From JSON `page` or filename `page-{n}` |
| `limit` | Configured page size (same as server `JSON_PAGE_SIZE`) |
| `hasNext` | Prefer document `hasNext`; fallback `items.length == limit` |
| `total` | Optional; not global today — do not require for infinite scroll |
| `updatedAt` | Map from `lastUpdate` or `generatedAt` |
| `version` | Use JSON `version` (content) + `schemaVersion` (schema) |
| `id` | Prefer item `id`; fallback `sha256(url).substring(0, 16)` |

**Recommended Flutter parse aliases (null-safe):**

```dart
updatedAt <- lastUpdate ?? generatedAt
hasNext   <- hasNext ?? (items.length >= pageSize)
id        <- item.id.isNotEmpty ? item.id : sha256(url).substring(0, 16)
```

### 2.3 Home

- Path: `home/page-{n}.json`
- `meta.kind`: `"list"`
- Items are **child video** links (open Details with `item.url`)

### 2.4 Model / Channel / Tag (parent → child)

**Parent index**

- Paths: `models/index.json`, `channels/index.json`, `tags/index.json`
- `meta.kind`: `"index"`
- `meta.parentCount`: number of parents
- Items: parents `{ title, img, url }`

**Children pages**

- Paths: `models/{parentId}/page-{n}.json` (same for channels/tags)
- `meta.kind`: `"children"`
- `meta.parentId`, `meta.parentTitle`, `meta.parentUrl`
- Items: child videos `{ title, img, url }` — **real video pages**

**`id` (Flutter):**

- Server folder `parentId` is stable (slug + hash).
- List JSON items **embed** `id` (`sha256(canonicalUrl).slice(0,16)`).
- For parents opened from index, prefer `meta.parentId` from children pages when available; otherwise use parent item `id`.

---

## 3. Live HTTP APIs (Contract v1)

Base URL: your VPS (e.g. `https://api.example.com`)

Headers (required for client apps when `API_KEY` is set in server `.env`):

| Header | When |
|--------|------|
| `X-Api-Key` | **Required** on `/detail`, `/stream`, `/catalog`, and `/data/*` when `API_KEY` is configured (default in production) |
| `X-Request-Id` | Optional; echoed if sent |

Server startup **fails** if `REQUIRE_API_KEY=true` (default) and `API_KEY` is missing or shorter than 16 characters.

`GET /health` remains public (no API key).

Generate a key on the server:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set in `.env`:

```env
API_KEY=<generated_hex>
REQUIRE_API_KEY=true
```

Flutter must use the **same** value at build time:

```bash
flutter build apk --dart-define=API_BASE_URL=http://52.64.145.223:3000 --dart-define=API_KEY=<same_hex>
```

### 3.1 Health

`GET /health`

```json
{
  "status": "ok",
  "uptimeSec": 12345,
  "timestamp": "2026-07-21T06:00:00.000Z"
}
```

Additional fields may appear when `HEALTH_EXPOSE_METRICS=true`. Flutter should ignore unknown keys.

### 3.2 Video Details

`GET /detail?url={childVideoUrl}`  
Alias: `GET /api/detail?url=`

**Success (Contract v1 — live today):**

```json
{
  "schemaVersion": 1,
  "id": "a1b2c3d4e5f67890",
  "title": "Video title",
  "img": "https://cdn.example.com/poster.jpg",
  "description": "Optional description",
  "metadata": {
    "duration": "12:34",
    "releaseDate": "",
    "category": "",
    "tags": ["Action"],
    "locale": null,
    "subtitles": [],
    "rating": null
  },
  "related": [
    {
      "id": "b2c3d4e5f6789012",
      "title": "Related one",
      "img": "https://cdn.example.com/r1.jpg",
      "url": "https://www.example.com/watch/rel1"
    }
  ],
  "extensions": {
    "sourceUrl": "https://www.example.com/watch/abc"
  }
}
```

| Rule | Value |
|------|--------|
| Related depth | **One level only** |
| m3u8 | **Never** in this response |
| Missing description | Empty string `""` — still success |
| Missing related | `[]` — still success |
| Cache | Header `X-Cache: HIT\|MISS` |
| Child URL only | Parent/index URLs return `URL_NOT_CHILD_VIDEO` |

**Flutter mapping:** treat response body as `VideoDetail`. Prefer `id`; fallback from `extensions.sourceUrl` or request `url`.

### 3.3 Stream (Play only)

`GET /stream?url={childVideoUrl}`  
Alias: `GET /api/stream?url=`

**Success (Contract v1 — live today):**

```json
{
  "success": true,
  "stream": {
    "url": "https://cdn.example.com/play.m3u8?token=...",
    "expiresIn": 300,
    "type": "m3u8",
    "qualities": [],
    "mirrors": [],
    "subtitles": [],
    "audioTracks": [],
    "drm": null,
    "adaptive": true
  },
  "cache": {
    "hit": true,
    "age": 120,
    "stale": false
  },
  "meta": {
    "siteId": "tubev",
    "durationMs": 45,
    "retries": 0,
    "schemaVersion": 1
  }
}
```

| Flutter field | Map from |
|---------------|----------|
| `streamUrl` | `stream.url` |
| `expiresIn` | `stream.expiresIn` (seconds) |

Call **only** when user presses Play. Refresh when player fails or near expiry.
Parent/index URLs are rejected (`URL_NOT_CHILD_VIDEO`).

### 3.4 Catalog: GitHub pages + `/loadmore` live scrape

| Surface | Source |
|---------|--------|
| Home / Myanmar / parents / children `page-1..3.json` when published | **GitHub** (pipeline) |
| Scroll load-more when CDN page is missing (e.g. Myanmar only has page-1) | **`GET /loadmore`** → SSD (24h) → else live scrape |
| Home page **4+** (typical) | **`GET /loadmore`** live scrape |

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/loadmore?section=home&page=4` | Flat load-more (always live) |
| `GET` | `/loadmore?section=myanmar&page=2` | Myanmar when GitHub has no page-2 |
| `GET` | `/loadmore?section=model&parentId=&parentUrl=&page=2` | Child load-more |
| `GET` | `/catalog/:section/page/:page` | Live when `page >= LOADMORE_MIN_PAGE` (default 4) or `?live=1` |
| `GET` | `/catalog/:section/child/:parentId/page/:page?parentUrl=` | Child pages |

Requires `X-Api-Key`. Response matches GitHub list JSON + `meta.source: "live-scrape"`.  
Headers: `X-Catalog-Source`, `X-Cache: HIT\|MISS`. SSD TTL: `CATALOG_SSD_CACHE_TTL_MS` (default 24h).  
`GET /loadmore` always sets `live=1` and **live-scrapes any page** (not only page ≥ 4).

### 3.5 Catalog CDN mirror (Flutter `CATALOG_BASE_URL` on the API host)

When `CATALOG_CDN_ENABLED=true` (default), the server exposes the **same relative paths** as GitHub raw JSON under `/data` (and `/api/data`). Flutter can set:

`CATALOG_BASE_URL=http://127.0.0.1:3000/data`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/data/home/page-{n}.json` | Flat lists (`home`, `myanmar`) |
| `GET` | `/data/models/index.json` | Parent index (`models`, `channels`, `tags`) |
| `GET` | `/data/models/{parentId}/page-{n}.json` | Child videos |
| `GET` | `/data/version.json` | Sync metadata (if pipeline wrote it) |

Public read; rate-limited. Source: local `output/` (+ SSD cache). Use for local dev or when GitHub CDN is unavailable.

### 3.6 Admin (ops only — not for Flutter app users)

`POST /admin/pipeline` — requires admin key. Not part of consumer Flutter contract.

---

## 4. Error response standard

### Stream errors (already wrapped)

```json
{
  "success": false,
  "error": {
    "code": "M3U8_NOT_FOUND",
    "message": "No playable m3u8 found on video page",
    "requestId": "uuid"
  }
}
```

### Detail / other API errors (live today)

```json
{
  "error": {
    "code": "URL_REQUIRED",
    "message": "url query parameter is required",
    "requestId": "uuid"
  }
}
```

### Recommended Flutter error handling

Normalize both shapes:

```text
success == false OR body.error != null  →  failure
code    <- error.code
message <- error.message
```

### Common error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `URL_REQUIRED` | 400 | Missing `url` |
| `URL_MALFORMED` | 400 | Bad URL |
| `URL_PROTOCOL_FORBIDDEN` | 400 | Not http(s) |
| `URL_LOCALHOST_FORBIDDEN` / `URL_PRIVATE_IP_FORBIDDEN` | 400 | SSRF block |
| `URL_HOST_NOT_ALLOWED` | 400 | Host not allowlisted |
| `URL_NOT_CHILD_VIDEO` | 400 | Parent/index URL passed to Detail/Stream |
| `UNAUTHORIZED` | 401 | Bad/missing API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `REQUEST_TIMEOUT` | 408 | Timed out |
| `M3U8_NOT_FOUND` | 404 | Stream unavailable |
| `INVALID_M3U8` | 422 | Extracted URL rejected |
| `FETCH_FAILED` / `SCRAPE_ERROR` | 502 | Upstream scrape failed |
| `INTERNAL_ERROR` | 500 | Unexpected |

---

## 5. Pagination standard (Flutter-facing)

One conceptual model for all list UIs:

```json
{
  "page": 1,
  "limit": 100,
  "hasNext": true,
  "total": null,
  "items": []
}
```

| Surface | Server reality (v1) | Flutter adapter |
|---------|---------------------|-----------------|
| Home | `home/page-N.json` | Map document → pagination model |
| Parents | `*/index.json` (single file today) | `hasNext=false` unless split later |
| Children | `{parentId}/page-N.json` | Same as Home |
| Related | Embedded in Detail (array) | No pagination in v1; if long, client-side only |

---

## 6. Versioning strategy

| Version field | Purpose |
|---------------|---------|
| `schemaVersion` | Flutter model compatibility (breaking changes bump this) |
| `generatorVersion` | Backend generator release |
| `version` (content hash) | Detect list data changes for cache invalidation |
| `meta.schemaVersion` / Stream `meta.schemaVersion` | API envelope version |

### Rules

1. **Additive fields are non-breaking** — Flutter must ignore unknown keys (`JsonIgnore` / freezed `unknown`).
2. **Removing/renaming fields** requires `schemaVersion` bump + dual-read period.
3. Old apps keep working if they only read known fields.
4. GitHub list `schemaVersion` and Detail `schemaVersion` are independent but both start at `1`.

### App compatibility

Suggested Flutter constant:

```text
supportedSchemaVersions = {1}
if (schemaVersion not in supported) → show upgrade / graceful degrade
```

---

## 7. Backward compatibility strategy

1. **Contract v1 = current production shapes** (this document).  
2. Do **not** change live Detail flat body or Stream `{ success, stream.url }` without a Flutter release plan.  
3. Optional **Contract v2** (future): unify envelopes as:

```json
{ "success": true, "data": { ... }, "schemaVersion": 2 }
```

Migration path if adopted later:

- Ship v2 under `/v2/detail` and `/v2/stream` **or** Accept-header negotiation.
- Keep v1 routes unchanged for ≥1 app release cycle.
- Prefer **aliases** (`streamUrl` alongside `stream.url`) over renames.

4. Prompt-example fields (`hasNext`, `id` on items, Detail `success/data`) are **Flutter-side derived** in v1 unless a versioned backend change is approved.

---

## 8. Flutter model mapping recommendation

| Flutter model | Source | Key fields |
|---------------|--------|------------|
| `VideoListItem` | GitHub / `/catalog` list item | `id`, `title`, `img`, `url` |
| `ParentItem` | index `items` | same + folder `parentId` when opening children |
| `PagedList` | list document | `page`, `items`, `version`, `updatedAt`, `hasNext` |
| `VideoDetail` | `/detail` | `id`, `title`, `img`, `description`, `metadata`, `related` |
| `RelatedItem` | `related[]` | same as `VideoListItem` |
| `StreamResult` | `/stream` | `streamUrl` ← `stream.url`, `expiresIn` |
| `ApiError` | error bodies | `code`, `message`, `requestId?` |

### Dio client guidelines

- Timeouts: Detail 20–30s; Stream 20–30s; GitHub CDN 15s  
- Retry: network/5xx only; **do not** retry Stream 404 `M3U8_NOT_FOUND` blindly  
- Cache: GitHub list pages by `version` / ETag; Detail by URL + soft TTL; Stream short TTL ≤ `expiresIn`  
- States: loading / empty (`items.isEmpty`) / error (`ApiError`) / success  

### Null safety

- Prefer non-nullable `String` with defaults `''` for title/img/description  
- `related` / `tags` / `subtitles` default to `[]`  
- `locale` / `rating` / `drm` nullable  

---

## 9. Security notes for Flutter

- Send `X-Api-Key` when backend requires it  
- Never log full stream URLs with tokens in crash reports  
- Only pass **child** video URLs to `/detail` and `/stream` (never parent listing URLs)  

---

## 10. What this contract intentionally does **not** change

- Live Detail response remains a **flat** object (no forced `success/data` wrap in v1)  
- Live Stream remains `{ success, stream.url, ... }`  
- Additive fields (`id`, `hasNext`) are non-breaking — old apps may ignore them  
- No Flutter UI code in this repository  

---

## 11. Approval / next steps

Contract v1 + additive Flutter fields (`id`, `hasNext`, `/catalog` docs) are the live backend target.

1. Point Flutter GitHub CDN base at the synced JSON repo.  
2. Call `GET /detail` on open; `GET /stream` only on Play.  
3. Optionally use `/catalog/...` for load-more when CDN pages are incomplete.
