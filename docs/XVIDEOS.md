# xvideos.com catalog (current primary source)

Configured via `.env` / `.env.example`:

| Section | Env | Example URL |
|---------|-----|-------------|
| Home | `HOME_BASE_URL` + `HOME_LIST_PATH` | `https://www.xvideos.com/best/2026-05` |
| Models | `MODELS_*` | `.../pornstars-index` |
| Tags | `TAGS_*` | `.../tags` |
| Channels | `CHANNELS_*` | `.../channels-index` |
| Myanmar | `MYANMAR_*` | `.../?k=myanmar` → `output/myanmar/page-N.json` |
| Watch | `WATCH_REFERER` | Sent as Referer on scrapes / detail / stream |

Adapter: `src/scrapers/sites/xvideos/`  
Defaults: `SECTION_*=xvideos`

```bash
npm run pipeline:local
npm run pipeline:home
npm run pipeline:myanmar
```

If list HTML changes, update selectors only in `src/scrapers/sites/xvideos/selectors.js`.
