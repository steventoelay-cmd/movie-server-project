# Security Hardening (PROMPT 8)

Production protections added without changing Detail/Stream success response contracts or catalog JSON schemas.

## Decisions and why

| Control | Why it is necessary |
|---------|---------------------|
| **Secrets only in `.env`** | Prevents token/key leakage via source control or accidental commits. |
| **`validateEnv()` at startup** | Fail fast on missing `API_KEY` in production / bad CORS — better than running half-secure. |
| **Helmet + hide `X-Powered-By`** | Reduces fingerprinting and common header-based attacks. |
| **Strict CORS (no `*` in production by default)** | Stops arbitrary browser origins from calling the API with a victim’s session/network. |
| **`assertSafeFetchUrl` (SSRF)** | `?url=` must not reach `localhost`, private IPs, `file://`, or cloud metadata. |
| **Host allowlist (existing + SSRF)** | Even valid public URLs are limited to known scrape hosts. |
| **Per-route rate limits** | Stream is costly; Detail/Health/Admin have separate budgets to stop floods. |
| **Request size + query length limits** | Blocks memory exhaustion via huge bodies/query strings. |
| **Request timeout** | Cancels hung scrape handlers under load. |
| **API key + Admin key middleware** | Auth today; JWT/OAuth can plug into `createAuthMiddleware` later. |
| **`POST /admin/pipeline` gated** | Prevents unauthorized scheduler/manual runs. |
| **Secret redaction in logs** | Tokens in errors/meta never print as plaintext. |
| **Safe client errors** | No stacks, env, or internal paths in HTTP responses. |
| **Minimal `/health` in production** | Avoid leaking cache/queue internals; metrics opt-in via `HEALTH_EXPOSE_METRICS`. |
| **Path traversal helper** | `assertSafeRelativePath` for any future user-influenced paths. |

## Env (see `.env.example`)

- `API_KEY`, `REQUIRE_API_KEY`
- `ADMIN_API_KEY`, `REQUIRE_ADMIN_KEY`
- `CORS_ORIGIN`, `CORS_ALLOW_WILDCARD_IN_PRODUCTION`
- `RATE_LIMIT_*`
- `REQUEST_JSON_LIMIT`, `REQUEST_URL_MAX_LENGTH`, `REQUEST_TIMEOUT_MS_HTTP`
- `HEALTH_EXPOSE_METRICS`, `SSRF_BLOCK_PRIVATE_IPS`

## Auth future path

```text
createAuthMiddleware('apiKey' | 'admin' | 'public')
  → later: 'jwt' mode parsing Authorization without changing controllers
```

Controllers stay unaware of auth details; they only see `req.auth` when set.

## Production deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for AWS VPS, PM2, Nginx TLS, firewall, and secret handling on the host.
