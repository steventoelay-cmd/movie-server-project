# Final Production Audit & Engineering Review

**Date:** 2026-07-21  
**Scope:** Full backend (architecture → scrapers → pipeline → APIs → security → deploy → ops)  
**Method:** Read-only audit — no system rewrite  
**Companion canvas:** IDE canvas `production-audit`

---

## 1. Production readiness score

| Area | Score | Notes |
|------|------:|-------|
| Architecture | 85 | Clean layers; future contracts exist |
| Scrapers | 80 | Isolation good; resume/circuit gaps |
| Data pipeline | 68 | **Empty → previous/ promotion risk** |
| GitHub sync | 82 | Changed-only + retry + rollback |
| Detail system | 90 | Cache + single-flight; no m3u8 |
| Stream system | 88 | Short TTL; local disk cache note |
| Performance | 80 | Bounded concurrency; VPS-appropriate |
| Security | 78 | Strong baseline; SSRF DNS gap |
| AWS deployment | 85 | PM2/Nginx/SSL/firewall/backup |
| Monitoring | 55 | Liveness; PROMPT 9 incomplete |
| Reliability (PROMPT 13) | 48 | **Planned, not fully implemented** |
| Testing & documentation | 82 | Jest + contract/ops docs |

### **Overall: 76 / 100 — Conditional GO**

Ready for a careful first production launch **after** addressing the two High findings below and completing the launch checklist. Not a blind “fully hardened SRE” bar until reliability + monitoring follow-ups land.

---

## 2. Architecture review

**Strengths**
- Clear separation: `api` → `application` → `domain` → `infrastructure` / `scrapers` / `jobs`
- Site adapters reusable; parsers/normalizers shared
- Scalability seams documented (`docs/SCALABILITY.md`, `ICacheStore`, repository/storage/queue contracts)

**Issues**
- Domain contracts are not yet wired into application services (documentation/duck-type only) — acceptable for now
- Unused `compression` import in `app.js` (Nginx gzip covers production)

**Verdict:** Maintainable and upgrade-ready without rewrite.

---

## 3. Scraper audit

**Strengths**
- Per-section try/catch in `SyncOrchestrator` — one site failure does not stop other sections
- Parent child failures continue to next parent
- `withRetry` + `RequestQueue` rate limiting
- Normalize → validate → dedupe before JSON

**Issues**
- Page scrape failure stops further pages for that list (partial data, no resume)
- `SiteResolver` fallback to first detail adapter is risky (fail-closed preferred)
- Tag site empty by default (intentional)

**Verdict:** Failure isolation is production-adequate; improve fail-closed adapter resolution.

---

## 4. Data pipeline audit

Flow is correct: scrape → normalize → generate → diff → GitHub.

**Strengths**
- Pagination via `page-N.json` and `JSON_PAGE_SIZE`
- Content-hash compare ignores volatile timestamps
- Items limited to `title` / `img` / `url`
- File lock prevents overlapping pipelines

**High risk — empty overwrite vs promote**

`filterEmptyOverwrites` blocks empty files from the **upload** set, but `output/` may still be promoted to `previous/` on `unchanged` / `not_configured` / local-only paths. That can wipe a good local baseline and later allow empty uploads.

**Also:** `diff.removed` is not deleted on GitHub → stale CDN pages possible.

---

## 5. GitHub integration audit

**Strengths**
- Token from env only; redacted logs
- Changed files only (content hash)
- Retries on 429/5xx
- Rollback helper if publish fails after commit

**Issues**
- No durable failed-upload queue (PROMPT 13)
- Missing `GITHUB_TOKEN` → local-only with warning (CDN clients see stale remote)
- Removals not synced

**Verdict:** Solid for v1 if token is configured and empty-promote bug fixed.

---

## 6. Detail system audit

**Verified**
- Cache hit/miss + PromiseLock / single-flight → repeated URLs do not stampede scrapes
- Related one-level; soft-fail
- **No m3u8** in response or parsers used by Detail

---

## 7. Stream system audit

**Verified**
- m3u8 only via `/stream`
- Short TTL + grace / stale fallback
- Concurrent single-flight
- **Never** written into GitHub catalog JSON

**Note:** File cache under `data/cache/stream` holds ephemeral URLs locally; exclude from backups when possible.

---

## 8. Performance audit (qualitative)

| Topic | Assessment |
|-------|------------|
| CPU | Bounded outbound concurrency; Cheerio on demand |
| RAM | LRU caches + PM2 `512M` restart |
| API latency | Cache hits fast; misses = scrape RTT |
| JSON gen | Skip unchanged writes; page chunking; load tests opt-in |
| Blocking | Mostly async I/O; no DB queries |
| Leaks | Cleanup job + shutdown prune; long-run watch via PM2/logs |

No load test run in this audit window — use `npm run test:load` on a staging box before claiming 50k/1M readiness under live scrape depth.

---

## 9. Security audit

| Control | Status |
|---------|--------|
| Secrets in `.env` / gitignore | OK |
| Helmet / hide X-Powered-By | OK |
| CORS (no `*` in prod by default) | OK |
| Rate limits | OK (in-memory; single node) |
| API / admin keys | OK if prod env set |
| SSRF literal private/localhost | OK |
| SSRF after DNS resolve | **Gap** |
| Timing-safe key compare | **Gap** |
| Path traversal helper | Present; not on every path |

---

## 10. AWS deployment audit

| Item | Status |
|------|--------|
| PM2 autorestart + memory limit | OK |
| PM2 max_restarts / backoff | **Missing** |
| Bind `127.0.0.1` behind Nginx | OK (prod ecosystem) |
| Nginx + TLS docs | OK |
| UFW 22/80/443 | OK |
| Backup / restore scripts | OK |
| Graceful SIGTERM | OK (does not await in-flight pipeline) |
| Recover after reboot | OK via `pm2 startup` + `pm2 save` |

---

## 11. Monitoring audit

| Item | Status |
|------|--------|
| `/health` liveness | OK |
| Rich metrics | Opt-in only; off in prod PM2 by default |
| Request access logs | Incomplete (PROMPT 9) |
| Prometheus / OTel | Not integrated |
| `MONITORING.md` / `RELIABILITY.md` | Missing |

Problems are detectable via PM2 logs + health curl, but not “quickly and centrally” yet.

---

## 12. Cost optimization

**Keep disabled until triggers in `docs/SCALABILITY.md`:** Redis, managed DB, multi-AZ, always-on workers.

**Keep doing:** GitHub/CDN for lists, Memory+File cache, skip unchanged JSON, logrotate, stream/detail TTLs, single VPS.

---

## 13. Remaining risks

1. Catalog baseline corruption via empty promote (**High**)
2. Unbounded PM2 restart loops / unhandled crashes (**High** ops)
3. DNS-based SSRF edge cases (**Med**)
4. Wrong-site adapter fallback (**Med**)
5. Stale GitHub JSON after local prune (**Med**)
6. Stream URLs in disk backups (**Low**)
7. Silent CDN staleness if GitHub not configured (**Med** ops)

---

## 14. Recommended improvements (ordered)

| Priority | Action |
|----------|--------|
| **P0** | Fix empty-overwrite: do not promote `output→previous` when empties were refused; restore prior section JSON on scrape fail |
| **P0** | Production secrets + CORS + GitHub token verification |
| **P1** | Implement PROMPT 13: crash handlers, PM2 `max_restarts`/`min_uptime`, reliability doc |
| **P1** | Complete PROMPT 9 monitoring |
| **P2** | SSRF DNS re-check; SiteResolver fail-closed |
| **P2** | Push deletes for `diff.removed`; exclude stream cache from backups |
| **P3** | Redis / DB / queue only per scalability triggers |

---

## 15. Future upgrade priorities

1. Reliability + monitoring (stability)  
2. Catalog integrity fixes (data)  
3. Security hardening (SSRF DNS, timing-safe auth)  
4. Horizontal scale (Redis + worker split) — when concurrent users demand it  
5. DB/search — when Flutter needs server-side filter  

---

## 16. Maintenance guide

### Daily
- [ ] `pm2 status` → online  
- [ ] `curl https://YOUR_DOMAIN/health` → `"status":"ok"`  
- [ ] Skim `pm2 logs` / Nginx error log for spikes  
- [ ] Disk free space (`df -h`)  

### Weekly
- [ ] Confirm last pipeline run / GitHub commit appeared  
- [ ] Spot-check one Home JSON page + one Detail + one Stream (Play)  
- [ ] Verify backup cron wrote under `/var/backups/movies-server`  
- [ ] Review rate-limit / auth warnings  

### Monthly
- [ ] `sudo apt update && apt upgrade` (careful reboot window)  
- [ ] `npm outdated` on staging; patch high CVEs  
- [ ] Rotate `API_KEY` / `ADMIN_API_KEY` if policy requires  
- [ ] Certbot renew dry-run  
- [ ] Re-check site selectors (HTML drift) against fixtures + one live page  
- [ ] Restore-backup drill on a copy directory  
- [ ] Review `LOG_RETENTION_DAYS` / cache dirs size  

---

## 17. Production launch checklist

### Before launch
- [ ] `.env` from `.env.production.example` filled; `chmod 600`  
- [ ] `NODE_ENV=production`, `REQUIRE_API_KEY=true`, `REQUIRE_ADMIN_KEY=true`  
- [ ] `CORS_ORIGIN` = real Flutter origins (not `*`)  
- [ ] `GITHUB_TOKEN` / owner / repo verified with a dry `pipeline:local` then upload test  
- [ ] PM2: `pm2 start … --env production`, `pm2 save`, `pm2 startup`  
- [ ] Nginx + Let's Encrypt HTTPS; HTTP→HTTPS redirect  
- [ ] UFW: 22/80/443 only; Node not public on 3000  
- [ ] `/health` public OK  
- [ ] Detail + Stream with `X-Api-Key` OK; confirm **no m3u8** in Detail  
- [ ] Catalog JSON generated; pagination files exist  
- [ ] GitHub sync: only changed files in commit  
- [ ] Flutter pointed at CDN base + API base  
- [ ] Invalid URL / SSRF / missing key error paths tested  
- [ ] Backup script run once; restore dry-run  
- [ ] `npm run test:ci` + `npm run test:legacy` green on build machine  
- [ ] **Empty-overwrite promote fix applied** (or manual confirm previous/ not wiped)  

### After launch (first 24h)
- [ ] Watch PM2 memory vs 512M restart  
- [ ] Confirm scheduler cron fired once  
- [ ] No 502 bursts from Nginx  
- [ ] Sample Flutter Home infinite scroll + Play stream  

---

## 18. Final verdict

The system is **architecturally production-capable** for a single AWS VPS serving Flutter via GitHub lists + live Detail/Stream, with strong security and deploy documentation.

It is **not** fully SRE-complete until catalog promote integrity is fixed and reliability/monitoring follow-ups (PROMPTs 9 & 13) are implemented.

**Ship with eyes open: Conditional GO after P0 items.**
