# Papa — apify.beenex.org

Crawlee & Playwright scraping service deployed via Coolify on Lenovo (`http://apify.beenex.org`).

## Endpoints

- `GET /` — Service landing page
- `GET /tiktok` — Interactive Web UI for TikTok Posts & Comments scraping with CSV/JSON exports
- `GET /tiktok/posts?handle=<HANDLE>&limit=50&timeout=60000` — Scrapes creator profile info and all videos/posts metadata
- `GET /tiktok/comments?url=<URL>&timeout=60000` — Scrapes video details and all comments
- `GET /zapier?limit=100&pages=1` — Zapier integration directory dump
- `GET /crawl?url=https://crawlee.dev` — CheerioCrawler smoke test
- `GET /crawl?case=books` — books.toscrape pagination
- `GET /health` — Health check

## Tech Stack & Architecture

- **Runtime**: Node.js 22+ (TypeScript -> `tsc` -> `dist/`)
- **Docker Base**: `apify/actor-node-playwright-chrome:22` (Headed Chrome with xvfb virtual display)
- **Anti-Bot Bypass**: `playwright-extra` + `puppeteer-extra-plugin-stealth` + CDP network body extraction
