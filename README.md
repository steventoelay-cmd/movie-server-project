# Movies Server Project

Node.js backend for the **movie_project** Flutter app: scrape catalog JSON → GitHub CDN, plus live **detail** and **stream** APIs.

Full HTTP/JSON contract: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Quick start

```bash
npm install
copy .env.example .env   # Windows — edit scrape URLs / GitHub token as needed
npm start                # http://0.0.0.0:3000
```

Generate catalog locally (no upload):

```bash
npm run pipeline:local
```

Sections: `home`, `myanmar`, `model`, `channel`, `tag` (`npm run pipeline:myanmar`, etc.).

## Flutter app wiring

| Flutter need | Server / CDN |
|--------------|----------------|
| Home, Myanmar, Models, Channels, Tags lists | GitHub raw JSON under `data/` **or** local `GET /data/...` mirror |
| Video detail + related | `GET /detail?url=` (alias `/api/detail`) |
| Play (m3u8) | `GET /stream?url=` (alias `/api/stream`) |
| Load-more (page 2+) | `GET /catalog/:section/page/:page` (see API contract) |

### Local dev (single machine)

1. Run pipeline: `npm run pipeline:local`
2. Start API: `npm start`
3. Run Flutter:

```bash
flutter run -d windows ^
  --dart-define=CATALOG_BASE_URL=http://127.0.0.1:3000/data ^
  --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

**Android emulator** — use `http://10.0.2.2:3000` for both bases.

Optional `X-Api-Key` when `API_KEY` is set in `.env`:

```bash
--dart-define=API_KEY=your_key
```

### Production

- Upload catalog: configure `GITHUB_*` in `.env`, run `npm run pipeline`
- Point Flutter `CATALOG_BASE_URL` at `https://raw.githubusercontent.com/OWNER/REPO/main/data`
- Point `API_BASE_URL` at your VPS HTTPS origin
- Set `CORS_ORIGIN` to your app origins (not `*` in production)

## HTTP routes (consumer)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | Public |
| GET | `/detail`, `/api/detail` | Optional API key |
| GET | `/stream`, `/api/stream` | Optional API key |
| GET | `/data/home/page-1.json`, … | Public (CDN mirror) |
| GET | `/catalog/...`, `/api/catalog/...` | Optional API key |

Scheduler (default once daily): `SCHEDULER_CRON=0 0 * * *` (00:00 UTC) — includes **Myanmar** when `PIPELINE_SCHEDULE_INCLUDE_MYANMAR=true` (default).

## Docs

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — PM2, Nginx, SSL
- [`docs/ARCHITECTURE_STORAGE.md`](docs/ARCHITECTURE_STORAGE.md) — GitHub vs server storage
- [`SECURITY.md`](SECURITY.md)

## Tests

```bash
npm run test:unit
npm test
```
