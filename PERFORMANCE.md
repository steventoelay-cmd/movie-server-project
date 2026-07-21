# Performance Optimizations (PROMPT 7)

This document lists production optimizations added without changing Detail/Stream API response contracts or Flutter JSON schemas.

## Why each optimization exists

| Optimization | Module | Why it improves performance |
|--------------|--------|------------------------------|
| **HTML page cache** | `HtmlPageCache` + `HtmlFetcher` | Detail and Stream often hit the same child URL. Caching HTML for ~60s avoids duplicate downloads, cutting network/CPU/Cheerio cost. |
| **Promise single-flight (HTML)** | `HtmlPageCache.getOrLoad` | 100 concurrent users for one URL → one fetch; others await. Prevents thundering herd. |
| **Priority request queue** | `RequestQueue` | Caps outbound concurrency, paces requests, supports priority/retry/delay. Protects source sites and VPS CPU. Redis/distributed queue can replace later with the same `schedule()` API. |
| **Bounded parallel parents** | `CatalogScrapeService` + `mapLimit` | Scrapes independent parent pages concurrently (configurable). Faster catalog builds without unbounded `Promise.all`. |
| **Bounded parallel sections** | `SyncOrchestrator` | Home/Model/Channel/Tag can run in parallel (default 2). Wall-clock pipeline time drops; outbound queue still limits load. |
| **Skip unchanged JSON writes** | `JsonGeneratorService.writeDoc` | Content-hash compare skips disk writes when items unchanged. Less disk IO and smaller GitHub diffs. |
| **Prune obsolete pages** | `JsonGeneratorService.pruneSection` | Removes stale `page-N.json` without full folder wipe when possible. Keeps output lean. |
| **GitHub upload single-flight** | `PromiseLock` in orchestrator | Prevents duplicate concurrent uploads of the same change set. |
| **Cache cleanup job** | `cleanup.job.js` hourly | Evicts expired Detail/Stream/HTML entries and stale `lastGood` stream fallbacks. Controls memory/disk growth. |
| **Temp/log cleanup** | `cleanup.job.js` | Removes old temp files and logs (configurable retention). |
| **LRU memory stores** | `MemoryStore` | Caps cache size; evicts least-recently-used. Future Redis implements same get/set/del/stats. |
| **Metrics collector** | `MetricsCollector` | Timings/counters/memory for ops. Additive `/health` fields only — no Flutter contract change. |
| **API response-time middleware** | `responseTime.js` | Tracks average latency without altering JSON bodies. |
| **Scheduler overlap guard** | `PipelineScheduler` | Skips cron if pipeline still running. Avoids double scrape/upload and lock storms. |
| **Graceful shutdown** | `server.js` | Closes HTTP, stops cron, closes outbound queue within timeout. Cleaner restarts, fewer leaked sockets. |
| **Periodic memory logs** | scheduler metrics interval | Detects leaks early on VPS without external APM (ready for future exporters). |

## Config knobs

See `.env.example`:

- `HTML_CACHE_TTL_MS`, `HTML_CACHE_MAX_ENTRIES`
- `PIPELINE_SECTION_CONCURRENCY`, `PIPELINE_PARENT_CONCURRENCY`
- `CLEANUP_CRON`, `CLEANUP_ENABLED`
- `METRICS_INTERVAL_MS`, `LOG_MEMORY_STATS`
- `SKIP_UNCHANGED_JSON_WRITES`
- `SHUTDOWN_TIMEOUT_MS`
- `START_SCHEDULER_WITH_SERVER=true` to run cron inside `npm start`

## Future-compatible seams

- **Redis**: implement `ICacheStore` and swap Memory/File stores in facades — see `docs/SCALABILITY.md`.
- **Worker threads**: `ConcurrencyPool.run(fn)` can offload CPU-heavy parse later.
- **Distributed queue**: replace job scheduling via `IJobQueue`; keep `RequestQueue` for outbound HTTP pacing.
- **DB / object storage**: `ICatalogRepository`, `IObjectStorage` contracts in `src/domain/contracts/`.

## What was intentionally not changed

- Detail / Stream API response JSON shapes
- Flutter catalog JSON schema (`schemaVersion`, `items`, etc.)
- GitHub still uploads **changed files only** (existing behavior, reinforced)
