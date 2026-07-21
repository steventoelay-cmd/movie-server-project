# Testing & Quality Assurance

Production-ready test system for the Movies Server backend.

## Principles

- **No live website dependency** in automated Jest tests (HTML fixtures + mocks).
- **Existing offline CLI checks kept** (`test:pipeline`, `test:detail`, …).
- **API contracts unchanged** — tests assert Contract v1 shapes from `docs/API_CONTRACT.md`.
- **Production code not rewritten** for tests; services mocked at the Express boundary.

## Stack

| Tool | Role |
|------|------|
| **Jest** | Unit, API, integration, failure, load |
| **Supertest** | HTTP API tests against `createApp()` |
| **ESLint** | Lint (`npm run lint`) |
| **Prettier** | Format (`npm run format`) |
| **Node assert CLIs** | Legacy offline smoke (`npm run test:legacy`) |

## Quick start

```bash
npm install
npm test                 # Jest suite (excludes load by default)
npm run test:ci          # CI: Jest + coverage → coverage/
npm run test:legacy      # Existing offline CLI checks
npm run test:all         # Jest + legacy
npm run test:load        # 50k JSON / concurrent API (slower)
npm run lint
```

## Environment

| Variable | Purpose |
|----------|---------|
| `NODE_ENV=test` | Set automatically in `tests/setup.js` |
| `REQUIRE_API_KEY=false` | API tests without keys |
| `TEST_LOAD=1` | Include `tests/load` in Jest |
| `LOG_LEVEL=error` | Quiet logs during tests |

No GitHub token or real scrapers required for `npm test`.

## Layout

```
tests/
  setup.js                 # env defaults
  helpers/                 # fixtures, createTestApp
  fixtures/html/           # mock HTML pages
  unit/                    # parsers, normalizers, cache, JSON, diff, validators
  api/                     # /health /detail /stream
  integration/             # pipeline + detail→stream flows
  failure/                 # recovery / corrupt cache / errors
  load/                    # 50k+ scale (opt-in)
```

## What is covered

| Area | Location |
|------|----------|
| HTML parsing / selectors | `unit/parsers.test.js` + fixtures |
| Normalizers / dedupe | `unit/normalizers.test.js` |
| JSON generator / pagination / empty | `unit/jsonGenerator.test.js` |
| Diff / large compare | `unit/catalogDiff.test.js` |
| Cache hit/miss/TTL/lock | `unit/cache.test.js` |
| Stream + SSRF validators | `unit/validators.test.js` |
| GitHub API failure (mocked) | `unit/githubUploader.test.js` |
| Health / Detail / Stream HTTP | `api/*.test.js` |
| Full catalog workflow | `integration/pipeline.flow.test.js` |
| Detail → related → m3u8 shape | `integration/pipeline.flow.test.js` |
| Timeouts, scrape fail, corrupt cache | `failure/failures.test.js` |
| 50k JSON + concurrent APIs | `load/jsonGeneration.load.test.js` |

## Expected results

- `npm test` → all non-load Jest tests **pass**
- Responses match Contract v1:
  - Detail: flat body, **no** `m3u8`
  - Stream: `{ success, stream.url, expiresIn, … }`
  - Errors: `{ error: { code, message } }` (stream adds `success: false`)
- Coverage report under `coverage/` when using `npm run test:ci`

## CI recommendation

```yaml
- run: npm ci
- run: npm run test:ci
- run: npm run test:legacy
- run: npm run lint
```

Optional nightly: `npm run test:load`.

## Adding tests

1. Prefer unit tests against pure modules (`utils`, parsers, generators).
2. For HTTP, use `createMockedApp({ getDetail, getStream })` — never hit real sites.
3. Add HTML fixtures under `tests/fixtures/html/` for structure-change cases.
4. Keep assertions aligned with `docs/API_CONTRACT.md` (do not invent new success shapes).
