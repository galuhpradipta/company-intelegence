# Merclex Company Intelligence

A micro-app that resolves company identities, fetches news, and scores article relevancy using a multi-provider pipeline with deterministic confidence scoring and LLM-powered relevancy analysis.

## Current Status

- Verified on March 24, 2026: `pnpm build` passes.
- Verified on March 24, 2026: `pnpm test -- --run tests/unit server/routes/relevancy.test.ts` passes with `61` tests across `12` files.
- Verified on March 24, 2026: `pnpm test:e2e` passes with `3` Merclex browser tests.
- Active browser-test coverage under `e2e/merclex/` now covers the input smoke path, single-company resolve -> detail -> news, and CSV upload -> progress -> result actions.
- Archived auth/notes template Playwright files live under `legacy/playwright-template/` and are not part of the trial submission.

## Quick Start

```bash
# 1. Copy and fill in env vars
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Run database migrations (requires DATABASE_URL)
pnpm db:migrate

# 4. Start both frontend + backend
pnpm dev:all
```

If you want to run them separately:

```bash
pnpm dev          # frontend (Vite, port 5173)
pnpm server:dev   # backend (Hono, port 3000)
```

For a production-style local run:

```bash
pnpm build
pnpm start
```

In development, Vite proxies `/api` and `/trpc` requests to the Hono server on port `3000`.

## API Keys Setup

OpenAI is required. For company/news coverage, the app works best when you also provide at least one company data key and one news provider key.

### 1. OpenAI (required — relevancy scoring + AI fallback)

Sign up at https://platform.openai.com/signup

1. Go to **API Keys** → **Create new secret key**
2. Add billing at **Settings → Billing** (pay-as-you-go, no subscription needed)
3. Cost: `gpt-5.4-mini` is ~$0.15/1M input tokens — scoring 30 articles per company costs roughly $0.002

```env
OPENAI_API_KEY=sk-...
```

### 2. GNews (recommended news ingestion provider for the trial)

Sign up at https://gnews.io/

1. Generate an API key from the dashboard
2. Free tier is limited but works with the current request shape in this repo

```env
GNEWS_API_KEY=your_key_here
```

### 3. NewsAPI (optional secondary news provider)

Sign up at https://newsapi.org/register

1. Register for a free account — your key is shown immediately on the dashboard
2. The free tier can return `426 Upgrade required` for some query shapes, so treat it as optional fallback unless you have a paid plan

```env
NEWS_API_KEY=your_key_here
```

### 4. PeopleDataLabs (recommended company firmographic data)

Sign up at https://www.peopledatalabs.com/signup

1. Create an account and go to **API Keys** in the dashboard
2. Free tier: 1,000 credits/month (~1,000 company lookups). Paid: ~$0.04–$0.10/record after that

```env
PEOPLE_DATA_LABS_API_KEY=your_key_here
```

### 5. SEC EDGAR (corporate registry data)

No signup or API key required. SEC EDGAR is a US government public database — completely free with no rate limit concerns for reasonable usage. The app queries it automatically.

No `.env` entry needed.

### 6. OpenCorporates (optional registry supplement)

Sign up at https://opencorporates.com/

The current repo includes an adapter and provider registry entry for OpenCorporates. If you have a key, you can add it to improve registry coverage.

```env
OPENCORPORATES_API_KEY=your_key_here
```

### Final `.env`

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/merclex_intel

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_FALLBACK_MODEL=gpt-5.4

GNEWS_API_KEY=your_gnews_key
NEWS_API_KEY=your_newsapi_key

PEOPLE_DATA_LABS_API_KEY=your_pdl_key
OPENCORPORATES_API_KEY=your_opencorporates_key

NODE_ENV=development
PORT=3000
BATCH_CONCURRENCY=5
PROVIDER_TIMEOUT_MS=10000
NEWS_LOOKBACK_DAYS=30
LOG_LEVEL=info
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for relevancy scoring and AI fallback |
| `OPENAI_MODEL` | No | Default `gpt-5.4-mini` |
| `OPENAI_FALLBACK_MODEL` | No | Default `gpt-5.4`, used for hard resolution cases |
| `GNEWS_API_KEY` | Recommended | GNews key; the current best default for dev/manual fetches |
| `NEWS_API_KEY` | Optional | NewsAPI key; useful as a secondary provider if your plan supports the query shape |
| `PEOPLE_DATA_LABS_API_KEY` | Recommended | PDL firmographic enrichment |
| `OPENCORPORATES_API_KEY` | Optional | OpenCorporates registry supplement |
| `PORT` | No | Default `3000` |
| `BATCH_CONCURRENCY` | No | Default `5` — parallel rows in CSV batch |
| `PROVIDER_TIMEOUT_MS` | No | Default `10000` — per-provider request timeout |
| `NEWS_LOOKBACK_DAYS` | No | Default `30` — news lookback window |

## Architecture

### Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind v4 + React Router v7
- **Backend**: Node.js + Hono (HTTP) + tRPC (typed client-server contracts)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI Responses API with Structured Outputs (`gpt-5.4-mini`)
- **Deployment**: Railway (one web service + one Postgres service)

### Module Overview

```
server/
├── providers/company/   # CompanyProvider interface + PDL, SEC EDGAR, AI fallback adapters
├── providers/news/      # NewsProvider interface + NewsAPI, GNews adapters
├── services/
│   ├── company-resolution/  # normalizer, scorer, merger, orchestrator
│   ├── news-ingestion/      # deduplicator, ingestion-service
│   ├── relevancy/           # scoring-service (OpenAI structured output)
│   └── batch/               # csv-parser, batch-processor
├── trpc/routers/        # company, news, relevancy, batch tRPC procedures
└── routes/              # Hono REST handlers (thin wrappers over services)
```

### Schema Design

Nine PostgreSQL tables:

- `resolution_inputs` — raw and normalized user inputs, with status tracking
- `batch_uploads` / `batch_upload_items` — CSV upload state for progress polling
- `companies` — canonical company records with confidence score and match tier
- `company_identifiers` — extensible key-value store (EIN, LinkedIn URL, ticker, etc.)
- `company_source_records` — raw provider payloads with field-level confidence tracking
- `company_matches` — ranked candidates per resolution input with score breakdowns
- `news_articles` — deduplicated article store with URL hash and title fingerprint
- `company_articles` — join table linking companies to articles with search context
- `article_relevancy_scores` — LLM scores with model metadata, category, and explanation

**Why this schema**: The `company_source_records` table preserves full raw payloads from every provider, allowing the pipeline to re-derive canonical fields if provider data quality improves or precedence rules change. `company_matches` separates ranked suggestions from canonical company records, which is important because the same company can appear as a candidate for many inputs.

### Provider Abstraction

Every company data source implements one interface:

```typescript
interface CompanyProvider {
  name: string
  reliabilityFactor: number  // 0.6–1.0
  search(input: NormalizedInput): Promise<CandidateCompany[]>
}
```

Deterministic providers are composed through `server/providers/company/registry.ts`, so the resolution orchestrator stays focused on flow control and persistence instead of provider wiring.

To add a new provider: create one file in `server/providers/company/`, implement the interface, and register it in `server/providers/company/registry.ts`.

### Confidence Scoring

Scoring is fully deterministic before any AI involvement:

| Signal | Points |
|---|---|
| Domain exact match | 40 |
| Company name similarity (Jaccard) | 0–30 |
| Address / city / state alignment | 0–15 |
| Industry alignment | 0–10 |
| Country match | 0–5 |

Raw score (0–100) is multiplied by a provider reliability factor (registry=1.0, firmographic=0.9, scraping=0.7, AI fallback=0.6).

**Tiers**: ≥85 = Confident, 50–84 = Suggested, <50 = Not Found.

### Entity Resolution / Conflict Handling

Candidates from different providers are clustered by shared domain (exact match) or high name token overlap (Jaccard ≥ 0.8). Within a cluster, fields are merged using provider precedence:

- Legal name: registry > firmographic > scraping > AI fallback
- Domain: user-provided > firmographic > scraping > AI fallback
- Employee count / industry: freshest firmographic source wins
- Address: registry or provider with freshest timestamp wins

All raw payloads are preserved in `company_source_records` regardless of which value won, and each source record now stores field-level confidence/value metadata for canonical fields such as legal name, domain, industry, employee count, and HQ location.

Durable external identifiers exposed by providers are persisted in `company_identifiers`. Today that includes SEC `cik`/`ticker`, People Data Labs IDs, and OpenCorporates company numbers when available.

### Relevancy Scoring Prompts

Each article is scored with company context injected into the prompt:

```
Company: {name}, industry: {industry}, ~{employee_count} employees, {location}
Article: {title} — {snippet or full_text up to 1000 chars}
```

Output schema (strict Structured Output):
- `relevancyScore`: integer 0–100
- `category`: enum (financial_performance | litigation_legal | leadership_change | operational_risk | market_expansion | industry_sector)
- `explanation`: string, max 160 chars

Articles below 30 are stored but hidden in the default view. Scoring runs with concurrency 5 and retries transient failures up to 2 times with exponential backoff.

## Trade-offs and What I'd Do Differently

### v1 Trade-offs Made

- **In-process batch queue**: v1 runs CSV work in-process using `p-limit` with DB polling state. This is simple and sufficient for a demo but would not survive a server restart mid-batch in production. v2 would add a dedicated worker service and a durable queue (BullMQ or similar).

- **No domain-level company deduplication across requests**: Two resolution inputs for the same domain may produce two company rows. v2 should add a unique constraint on `domain` in `companies` and handle upserts in the orchestrator.

- **News provider fallback is sequential**: If NewsAPI fails, the system tries GNews. v2 could run both in parallel and merge results before deduplication.

- **Relevancy scores are one-shot per company/article pair**: If the prompt or model changes, old scores are not re-evaluated. v2 should add a `prompt_version` invalidation sweep.

### International Support (v2 changes)

- Address normalization needs country-specific parsing (postcode formats, regional divisions)
- SEC EDGAR jurisdiction filtering should be extended to support international registries in v2
- Legal suffix stripping needs an international list (GmbH, AG, S.A., B.V., etc.) — already partially implemented but not exhaustive
- PeopleDataLabs supports international company data out of the box, but country filtering and scoring weights assume US-first signals

## Testing

```bash
pnpm test -- --run tests/unit   # 56 unit tests
pnpm test:e2e                   # Merclex smoke test
```

Coverage priorities per spec:
- `tests/unit/scorer.test.ts` — confidence scoring algorithm, reliability factor application
- `tests/unit/merger.test.ts` — entity clustering, provider precedence in field merge
- `tests/unit/normalizer.test.ts` — legal suffix stripping, domain/country normalization
- `tests/unit/csv-parser.test.ts` — BOM handling, empty rows, case-insensitive columns, trim
- `tests/unit/deduplicator.test.ts` — URL dedup, title fingerprint, 72-hour event window
- `tests/unit/persistence-metadata.test.ts` — field-confidence and identifier extraction for persistence

Browser coverage is intentionally narrow right now: the active Playwright suite only checks the Merclex input entry points. The older auth/notes browser tests were archived because they were template scaffolding, not part of this trial.

## Provider Access Notes

| Provider | Access | Notes |
|---|---|---|
| SEC EDGAR | Free, no key needed | US government public database; no rate limit concerns for reasonable usage |
| PeopleDataLabs | Paid; free trial available | Set `PEOPLE_DATA_LABS_API_KEY`; provider skips gracefully if unset |
| OpenCorporates | Optional | `OPENCORPORATES_API_KEY` improves registry coverage; adapter skips gracefully if unset or rate limited |
| GNews | Free tier (limited) | `GNEWS_API_KEY` is the recommended news key for this repo’s current request shape |
| NewsAPI | Optional secondary provider | Free-tier plans can hit `426 Upgrade required`; the provider fails gracefully |
| OpenAI | Paid | `OPENAI_API_KEY` required for relevancy scoring and AI fallback |

If any provider is unavailable, the pipeline continues with remaining providers. A warning is logged with the specific reason (missing key, auth failure, rate limit). The orchestrator falls back to AI-assisted resolution only when all deterministic providers return no results.

## Deployment (Railway)

1. Create a Railway project
2. Add a PostgreSQL service — Railway exposes `DATABASE_URL` automatically
3. Add a Node web service pointing to this repo
4. Set build command: `pnpm install --frozen-lockfile && pnpm build`
5. Set start command: `pnpm start`
6. Add environment variables: `OPENAI_API_KEY`, plus any of `GNEWS_API_KEY`, `NEWS_API_KEY`, `PEOPLE_DATA_LABS_API_KEY`, `OPENCORPORATES_API_KEY` that you plan to use
7. After first deploy, run migrations: `railway run pnpm db:migrate`
8. Verify: `GET /api/health`
