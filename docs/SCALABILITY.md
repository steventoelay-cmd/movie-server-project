# Scalability & Future Upgrade Architecture

**Status:** Design guide — single AWS VPS remains the production target today.  
**Principle:** Gradual growth. Add paid/shared infrastructure only when metrics prove need.  
**Constraint:** Do not rewrite working modules; extend behind contracts.

This document describes **current** architecture, **seams already in the codebase**, and **when** to introduce Redis, a database, queues, multiple servers, and CDN.

---

## 1. Current architecture (keep simple)

```
Flutter App
    │
    ├─ List JSON ──────────────► GitHub (raw/CDN)     [scale: browsing]
    │
    └─ Detail / Stream ────────► Nginx → Node (PM2)   [scale: live APIs]
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              Site adapters     Memory+File cache   node-cron jobs
              (tubev/sexvid)    (Detail/Stream/HTML)  (pipeline/cleanup)
```

| Concern | Today |
|---------|--------|
| Compute | 1× AWS VPS, PM2 fork, Express |
| List data | GitHub JSON pages (`title/img/url`) |
| Live APIs | `/detail`, `/stream`, `/health` |
| Cache | MemoryStore + FileStore via `CacheFacade` |
| Jobs | In-process `PipelineScheduler` + file lock |
| DB / Redis / MQ | **None** (intentional) |

**Why this works now:** Catalog traffic is offloaded to GitHub/CDN; the VPS only pays for Detail/Stream scrapes and periodic pipeline runs.

---

## 2. Layering (do not collapse)

Keep boundaries so upgrades stay local:

| Layer | Role | Today |
|-------|------|--------|
| **API** | HTTP, auth, rate limits | `src/api`, `src/middleware` |
| **Application** | Use-cases | `DetailService`, `StreamService`, `SyncOrchestrator`, catalog services |
| **Domain** | Entities, contracts | `VideoItem`, `ISiteAdapter`, new `ICatalogRepository`, `IObjectStorage`, `IJobQueue` |
| **Infrastructure** | IO adapters | cache stores, GitHub, HtmlFetcher, scrapers |

**Rule:** Controllers never open Redis/SQL/S3 clients. Application services depend on **interfaces**; infrastructure supplies implementations.

---

## 3. Cache upgrade strategy → Redis

### Current path

```
DetailCache / StreamCache / HtmlPageCache
        ↓
   CacheFacade
        ↓
 MemoryStore  (+ FileStore L2)
```

Contract: [`src/infrastructure/cache/base/ICacheStore.js`](../src/infrastructure/cache/base/ICacheStore.js)  
(`get` / `set` / `del` / `clear` / optional `cleanup` / `getStats`)

### Future path

```
Same facades
        ↓
   CacheFacade
        ↓
 RedisStore (implements ICacheStore)
   optional: keep FileStore as cold tier or drop
```

### Migration steps (when triggered)

1. Add `RedisStore` implementing `ICacheStore`.
2. Wire via env (`CACHE_BACKEND=redis`) in cache constructors — **no** Detail/Stream business changes.
3. Enable shared cache across instances.
4. Keep TTLs identical (`DETAIL_CACHE_TTL_MS`, `STREAM_CACHE_TTL_MS`).

### When to introduce Redis

| Signal | Action |
|--------|--------|
| Multi-instance API (load balancer) | **Required** for shared Detail/Stream cache |
| Memory pressure / frequent OOM near 512M PM2 cap | Strong candidate |
| Single VPS, cache hit rates healthy | **Defer** — Memory+File is enough |

---

## 4. Database migration strategy

### Current

- Listing: generated JSON files → GitHub  
- No queryable index on the VPS  

### Target DAL

Contract: [`src/domain/contracts/ICatalogRepository.js`](../src/domain/contracts/ICatalogRepository.js)

```
API / Application
        ↓
 ICatalogRepository
        ↓
 JsonFileCatalogRepository   (today, implicit via generator + CDN)
   or PostgresCatalogRepository
   or MongoCatalogRepository
```

### Suggested schema evolution (PostgreSQL example)

- `videos(id, url UNIQUE, title, img, section, parent_id, updated_at)`  
- `parents(id, section, title, img, url)`  
- Indexes: `(section, updated_at)`, `(parent_id, updated_at)`, optional `tsvector` for search  

MySQL: same relational shape. MongoDB: document-per-video + indexes on `url`, `section`, `parentId`.

### Migration path

1. Keep GitHub JSON as **CDN read model** (Flutter unchanged).  
2. Optionally write-through DB during pipeline (`upsertPage`).  
3. Later: API list endpoints read DB; Flutter can keep GitHub until cutover.  
4. Never put m3u8 in DB or GitHub.

### When to introduce a database

| Signal | Action |
|--------|--------|
| Need search / filter / admin CMS | Introduce DB |
| 100k+ items + frequent partial updates | Strong candidate |
| Lists only via static pages, no search | **Defer** |

---

## 5. Storage strategy (GitHub → object storage)

Contract: [`src/domain/contracts/IObjectStorage.js`](../src/domain/contracts/IObjectStorage.js)

| Phase | Implementation | Notes |
|-------|----------------|-------|
| Now | `GitHubSyncService` | Cheap CDN via raw.githubusercontent / Pages |
| Next | S3 / R2 / GCS adapter | Same `putObjects([{path, content}])` |
| Optional | Dual-write then flip Flutter base URL | Versioned paths (`home/page-1.json?v=` or folder `v/{contentHash}/`) |

CDN: CloudFront / Cloudflare in front of bucket; cache JSON with long TTL + content-hash invalidation (`version` field already in JSON).

### When to leave GitHub

| Signal | Action |
|--------|--------|
| GitHub API rate limits / large diffs | Object storage |
| Need global edge latency | CDN + object storage |
| Fine on rate limits | **Defer** |

---

## 6. Queue system upgrade

Contract: [`src/domain/contracts/IJobQueue.js`](../src/domain/contracts/IJobQueue.js)

### Current jobs (names stay stable)

| Job name | Today |
|----------|--------|
| `catalog.scrape` | `CatalogScrapeService` via orchestrator |
| `catalog.generateJson` | `JsonGeneratorService` |
| `catalog.githubSync` | `GitHubSyncService` |
| `cache.cleanup` | `cleanup.job.js` |

### Future

```
Producer (cron / admin API)
        ↓
 IJobQueue.enqueue({ name, payload })
        ↓
 BullMQ / SQS / RabbitMQ worker process
```

In-process `RequestQueue` remains for **outbound HTTP pacing**; distributed queue is for **jobs**, not every Axios call.

### When to introduce a queue

| Signal | Action |
|--------|--------|
| Pipeline + API on same process starve each other | Split worker + queue |
| Multiple servers / duplicate cron risk | Queue + single consumer or leader election |
| Single VPS, cron fine | **Defer** — keep `PipelineScheduler` + file lock |

---

## 7. Multi-server support

### Requirements when scaling out APIs

| Concern | Approach |
|---------|----------|
| Duplicate scheduler | Run cron/workers on **one** “worker” process only; API instances set `START_SCHEDULER_WITH_SERVER=false` |
| Distributed lock | Replace/augment `data/locks/pipeline.lock` with Redis `SET NX` or DB advisory lock |
| Shared cache | Redis (`ICacheStore`) |
| Centralized queue | BullMQ/SQS |

### Stateless API checklist

- No in-memory-only correctness for Detail/Stream across nodes (use Redis).  
- Uploads/pipeline not on every node.  
- Sessions: already API-key based (stateless).  

---

## 8. Load balancing

```
Clients → Cloud LB / Nginx upstream
              ├─ api-1:3000
              ├─ api-2:3000
              └─ api-3:3000
         worker-1 (scheduler/queue consumer only)
```

Nginx snippet direction (future): `upstream movies_api { least_conn; server ...; }`  
Health: `GET /health` already returns `{ status: "ok" }` — keep for LB probes.

Today: single upstream in `deploy/nginx/movies-api.conf` is correct.

---

## 9. CDN strategy

| Asset | Strategy |
|-------|----------|
| List JSON | GitHub or object storage + CDN; honor `version` / `generatedAt` for invalidation |
| Images | Hotlink source CDN or mirror later; Flutter caches posters |
| Metadata | Prefer static JSON; Detail API only when needed |
| Headers | CDN: long `Cache-Control` for versioned paths; short/no-store for `/health` |

Flutter should cache GitHub pages by content `version` (see `docs/API_CONTRACT.md`).

---

## 10. Large dataset optimization (50k → 1M+)

| Scale | Tactic (mostly already aligned) |
|-------|----------------------------------|
| 50k | Page files (`JSON_PAGE_SIZE`), infinite scroll via `page-N.json` |
| 100k+ | Cap pipeline pages per run; incremental parents; skip unchanged writes |
| 1M+ | DB + indexes; search service; shard list by section/parent; object storage; workers |

**Pagination:** Keep page-based files/API; add `hasNext` when generating if useful (additive).  
**Search/filter:** Requires DB or search index — not JSON scan on device for 1M.  
**Indexing:** `url` unique, `(section, page)`, parent FK — only after DAL exists.

---

## 11. API scaling

| Capability | Today | Future |
|------------|-------|--------|
| Versioning | `schemaVersion` in JSON/Detail; Contract v1 | `/v2/...` or Accept header when breaking |
| Compression | Nginx gzip | Keep; optional Brotli at CDN |
| Request caching | Detail/Stream caches + HTML cache | Redis + CDN for public metadata if added |
| Rate limiting | Per-route in-process | Redis-backed limiter when multi-node |
| Horizontal scale | 1 node | LB + Redis + worker split |

**Do not** change Detail/Stream success bodies without a version bump.

---

## 12. Monitoring upgrade

| Phase | Stack |
|-------|--------|
| Now | `MetricsCollector`, logs, PM2, `/health` (+ metrics flag) |
| Next | Prometheus exporter from existing counters; Grafana dashboards |
| Cloud | CloudWatch agent on VPS (CPU/mem/disk) |
| Deep | OpenTelemetry traces around scrape → cache → response |

Export **existing** metrics; don’t invent a parallel instrumentation system.

---

## 13. Cost optimization (small VPS)

| Do | Don’t (yet) |
|----|-------------|
| GitHub/CDN for lists | Managed Redis “just in case” |
| Memory+File cache | Always-on multi-AZ DB |
| Bound concurrency (`REQUEST_MAX_CONCURRENCY`) | Unbounded `Promise.all` scrapes |
| Skip unchanged JSON / prune pages | Full catalog rewrite every run |
| Log rotation + cache cleanup | Keep forever growth on disk |
| Single worker for cron | N nodes all running pipeline |

Add paid services only when a **trigger** in this doc is met.

---

## 14. Decision checklist (“when to upgrade”)

```text
More API nodes needed?
  └─ YES → Redis + disable scheduler on API nodes + LB
       └─ Pipeline heavy? → Job queue + dedicated worker

Search / complex queries?
  └─ YES → Database + ICatalogRepository

GitHub rate limit / huge sync?
  └─ YES → IObjectStorage (S3/R2) + CDN

Observability insufficient?
  └─ YES → Prometheus/Grafana or CloudWatch (export MetricsCollector)
```

---

## 15. What we intentionally did **not** build now

- No Redis, Postgres, BullMQ, or second server  
- No rewrite of Detail/Stream/catalog generators  
- Only **contracts + this plan** so future adapters plug in cleanly  

---

## 16. Related docs

| Doc | Topic |
|-----|--------|
| [`API_CONTRACT.md`](API_CONTRACT.md) | Flutter ↔ API JSON |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Single-VPS ops |
| [`../PERFORMANCE.md`](../PERFORMANCE.md) | Current perf seams |
| [`../SECURITY.md`](../SECURITY.md) | Auth, SSRF, rate limits |
| [`TESTING.md`](TESTING.md) | Test strategy |

---

## 17. Code seams (quick reference)

| Future need | Seam |
|-------------|------|
| Redis | `ICacheStore` + `CacheFacade` |
| DB | `ICatalogRepository` |
| S3/R2 | `IObjectStorage` |
| BullMQ/SQS | `IJobQueue` |
| More sites | `SiteAdapter` / `AdapterRegistry` |
| Multi-node lock | Extend file lock → Redis/DB lock (same acquire API later) |
