# PF News — Project Finance News Aggregator

A small Next.js app that ingests, normalizes, and classifies project finance,
infrastructure, and energy-transition news from a mix of public RSS feeds, the
open GDELT index, and (optionally) commercial news APIs.

## Highlights

- Mixed-source ingestion: RSS, GDELT (no key required), NewsAPI/Marketaux
  (auto-skipped without keys).
- Local SQLite persistence via Prisma — zero-config dev, easy swap to Postgres.
- Lightweight rules-based classifier tags sector, region, and a relevance score.
- Server components + client dashboard with search, faceted filters, freshness
  badges, and source health.
- One-shot CLI ingest plus an authenticated `/api/ingest` endpoint for cron.

## Quick start

```bash
# 1. Install
npm install

# 2. Initialise the database
cp .env.example .env
npm run db:migrate

# 3. (optional) Seed source catalog so it shows up before first ingest
npm run seed:sources

# 4. Pull the first batch of news
npm run ingest

# 5. Open the dashboard
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000).

## Configuration

All settings live in `.env`. See `.env.example` for the full list:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Prisma connection string. Defaults to `file:./prisma/dev.db`. |
| `NEWS_API_KEY` | Optional. Enables the NewsAPI.org provider when present. |
| `MARKETAUX_API_KEY` | Optional. Enables the Marketaux provider when present. |
| `INGEST_TOKEN` | Optional. Required as `Bearer` for `/api/ingest` when set. |
| `INGEST_MAX_PER_SOURCE` | Cap of articles persisted per source per run. |

## CLI

```bash
# Run all sources
npm run ingest

# Filter sources by name (case-insensitive substring)
npm run ingest -- --filter gdelt

# Cap persisted items per source
npm run ingest -- --max 25
```

## Scheduling

The `/api/ingest` endpoint runs the same pipeline as the CLI. Schedule it from
any cron service (Vercel Cron, GitHub Actions, etc.). Example:

```bash
curl -X POST https://your-deploy.example.com/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

## Adding a source

Edit `src/lib/sources/feeds.ts` and append a `SourceConfig`. Re-running the
ingest will register the new source and start collecting items. RSS feeds and
GDELT queries need no credentials; commercial providers gate themselves on the
matching `*_API_KEY` env var.

## Architecture

```
RSS / GDELT / APIs  ->  fetchers  ->  normalize + classify  ->  Prisma (SQLite)
                                                                   |
                                                                   v
                                                       Next.js API + dashboard
```

Key files:

- `prisma/schema.prisma` — `Article`, `Source`, `FetchRun` models.
- `src/lib/sources/*.ts` — provider-specific fetchers.
- `src/lib/ingest.ts` — orchestration, dedupe, persistence.
- `src/lib/normalize.ts`, `src/lib/classify.ts` — cleaning and tagging.
- `src/app/api/articles/route.ts`, `src/app/api/ingest/route.ts` — server APIs.
- `src/app/page.tsx`, `src/components/Dashboard.tsx` — UI.

## Notes

- RSS feeds change frequently; the dashboard surfaces per-source error state so
  bad URLs are easy to spot and prune.
- The classifier is intentionally simple. If a domain expert wants finer
  taxonomy, swap rules in `src/lib/classify.ts` or wire in an embedding model.
