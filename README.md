# Company Intelligence

A micro-app that resolves company identities, fetches news, and scores article relevancy using a multi-provider pipeline with deterministic confidence scoring and LLM-powered relevancy analysis.

## If You're Jumping In

- Want to run the app locally: start with [Quick Start](#quick-start)
- Want sample data for the CSV flow: use [Sample Data](#sample-data)
- Want to understand the request pipeline: read [End-to-End Flow](#end-to-end-flow)
- Want the best entry points into the code: jump to [Where to Start in Code](#where-to-start-in-code)
- Want provider quotas and free-tier constraints: see [Provider Access Notes](#provider-access-notes)

## What This App Does

- Resolves a single company input or a CSV batch against multiple company-data providers
- Clusters overlapping candidates into one canonical company record with a deterministic confidence score
- Fetches recent news for confident matches
- Scores each article for business relevance using structured LLM output
- Surfaces results in a lightweight UI with match tiers, candidate confirmation, and ranked news

## Quick Start

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | `>=22` |
| pnpm | repo uses `pnpm@10.32.1` |
| PostgreSQL | required for app and integration flows |
| OpenAI API key | required for relevancy scoring and AI fallback |

### Fastest local boot

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev:all
```

Then open:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

In development, Vite proxies `/api` and `/trpc` requests to the Hono server on port `3000`.

If you want to run the servers separately:

```bash
pnpm dev          # frontend
pnpm server:dev   # backend
```

For a production-style local run:

```bash
pnpm build
pnpm start
```

### Two-minute demo path

1. Start the app with `pnpm dev:all`.
2. Open `http://localhost:5173`.
3. Go to `CSV Upload`.
4. Upload `manual-test-data/companies.csv`.
5. Open one confident result to inspect the company profile and ranked news.

## Common Commands

| Command | Purpose |
|---|---|
| `pnpm dev:all` | Start frontend and backend together |
| `pnpm dev` | Start frontend only |
| `pnpm server:dev` | Start backend only |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm build` | Build frontend and backend |
| `pnpm start` | Run the production build locally |
| `pnpm test -- --run tests/unit` | Run core unit tests |
| `pnpm test:e2e` | Run browser-mocked Playwright tests |
| `pnpm test:e2e:integration` | Run full integration E2E with a real database |
| `pnpm test:e2e:integration:docker` | Run full integration E2E with Docker-managed Postgres |

## Environment Setup

### Minimum env to boot the app

| Variable | Required | Why |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | Relevancy scoring and AI fallback |

### Recommended provider keys

| Provider | Required | Env var | Why you would add it |
|---|---|---|---|
| OpenAI | Yes | `OPENAI_API_KEY` | Required for article relevancy scoring and fallback resolution |
| GNews | Recommended | `GNEWS_API_KEY` | Best default news provider for local/manual testing |
| People Data Labs | Recommended | `PEOPLE_DATA_LABS_API_KEY` | Stronger firmographic enrichment and domain-based matching |
| NewsAPI | Optional | `NEWS_API_KEY` | Secondary news provider fallback |
| OpenCorporates | Optional | `OPENCORPORATES_API_KEY` | Better legal-entity and registry coverage |
| SEC EDGAR | No key | none | Public registry source used automatically |

### Example `.env`

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/company_intelligence
E2E_DATABASE_URL=postgresql://postgres:password@localhost:5432/company_intelligence_e2e
E2E_USE_DOCKER=0

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
COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS=0
```

### Full env reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `E2E_DATABASE_URL` | Optional | Separate database used by `pnpm test:e2e:integration` when you want a fixed isolated integration DB |
| `E2E_DATABASE_ADMIN_URL` | Optional | Admin connection used to create/drop E2E databases when `DATABASE_URL` lacks the needed privilege |
| `E2E_USE_DOCKER` | Optional | Default `false` — when set, `pnpm test:e2e:integration` uses a temporary Docker Postgres container |
| `E2E_DOCKER_IMAGE` | Optional | Default `postgres:16-alpine` |
| `E2E_DOCKER_DB_NAME` | Optional | Default `company_intelligence_e2e` |
| `E2E_DOCKER_USER` | Optional | Default `postgres` |
| `E2E_DOCKER_PASSWORD` | Optional | Default `postgres` |
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
| `COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS` | No | Default `false` — enables the server-side fixture providers used by the integration E2E runner |

## Sample Data

Use the fixtures under `manual-test-data/` for manual CSV upload testing:

- `manual-test-data/companies.csv` — valid rows using real company names and official domains
- `manual-test-data/companies-invalid.csv` — same shape, but with one row missing `company_name`

Supported CSV columns:

```text
company_name,domain,address,city,state,country,industry
```

Only `company_name` is required.

## Testing and Test Modes

### Unit tests

```bash
pnpm test -- --run tests/unit
```

### Fast browser-mocked UI tests

These run the real frontend but mock API responses at the browser layer.

```bash
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:ui
```

### Full integration UI tests

These run the real frontend, real backend, and a real PostgreSQL database. External providers are mocked inside the backend so the UI still exercises the full Company Intelligence stack without live third-party API calls.

```bash
pnpm test:e2e:integration
pnpm test:e2e:integration:headed
pnpm test:e2e:integration:ui
```

How the integration runner works:

- If your PostgreSQL role can create databases, the runner creates a fresh temporary database, migrates it, runs Playwright, and drops it afterward.
- If your role cannot create databases, set `E2E_DATABASE_URL` to a separate pre-provisioned test database. The runner will reset that database, run migrations, and execute the suite against it.
- If database creation requires a different admin connection, set `E2E_DATABASE_ADMIN_URL`.

### Full integration UI tests with Docker-managed Postgres

These do not depend on your local PostgreSQL role at all. The runner starts a temporary Docker Postgres container, waits for readiness, migrates it, runs Playwright, then tears the container down.

```bash
pnpm test:e2e:integration:docker
pnpm test:e2e:integration:docker:headed
pnpm test:e2e:integration:docker:ui
```

Docker mode uses:

- `E2E_DOCKER_IMAGE` default `postgres:16-alpine`
- `E2E_DOCKER_DB_NAME` default `company_intelligence_e2e`
- `E2E_DOCKER_USER` default `postgres`
- `E2E_DOCKER_PASSWORD` default `postgres`
- a running local Docker daemon
- dedicated test ports: frontend `4173`, backend `3300`

If you want Docker to be the default integration mode:

```env
E2E_USE_DOCKER=1
```

## Verification Snapshot

- Verified on March 24, 2026: `pnpm build` passes.
- Verified on March 24, 2026: `pnpm test -- --run tests/unit server/routes/relevancy.test.ts` passes with `61` tests across `12` files.
- Verified on March 24, 2026: `pnpm test:e2e` passes with `3` Company Intelligence browser tests.
- Active browser-test coverage under `e2e/company-intelligence/` covers the input smoke path, single-company resolve -> detail -> news, and CSV upload -> progress -> result actions.
- A full integration Playwright path is available via `pnpm test:e2e:integration` and `pnpm test:e2e:integration:docker`.
- Archived auth/notes template Playwright files live under `legacy/playwright-template/` and are not part of the trial submission.

## Architecture

This section is the brief architecture note requested by the original paid-trial PRD in `tmp/Merclex-Paid-Trial-PRD.docx.md`. It covers the schema choice, provider abstraction, conflict handling, relevancy prompt structure, and the main v1 trade-offs.

### PRD Coverage

| PRD area | Current implementation in this repo | Status |
|---|---|---|
| Company input interface | Single-company form, CSV upload, downloadable template, preview of first 5 rows, required `company_name` validation, and batch progress polling | Implemented |
| Company identity engine | Provider abstraction, multi-source candidate fan-out, deterministic scoring, canonical record persistence, source-record tracking, and `confident` / `suggested` / `not_found` tiers | Implemented |
| News ingestion | Recent-news fetch for confident matches, deduplication by URL and event fingerprint, persisted article store, and company-article linking | Implemented |
| Relevancy scoring | OpenAI structured output, category + explanation, batch scoring, retries, and default filtering of low-score articles | Implemented |
| GUI requirements | Input tabs, summary bar, candidate confirmation flow, company detail card, ranked news list, and low-relevance toggle | Implemented |
| Scale and operations | Works for demo and local evaluation flows, but queue durability and large-batch operability are still v1-level | Partial |

### End-to-End Flow

```mermaid
flowchart TD
    U["User"] --> UI["React UI<br/>Input, Results, Detail pages"]
    UI --> API["Hono REST + tRPC API"]
    API --> NORM["Validate and normalize input"]

    NORM --> DET["Deterministic company providers<br/>People Data Labs<br/>SEC EDGAR<br/>OpenCorporates"]
    NORM -.-> AIF["AI fallback provider<br/>used only when deterministic providers return no candidates<br/>OpenAI Responses API<br/>model: gpt-5.4"]

    DET --> MERGE["Cluster and merge overlapping candidates"]
    AIF --> MERGE
    MERGE --> SCORE["Deterministic confidence scoring<br/>local scoring logic<br/>no LLM involved"]
    SCORE --> TIER{"Match tier"}

    TIER -->|"Confident / Suggested / Not Found"| DB["PostgreSQL<br/>companies, matches, source records,<br/>identifiers, batch state"]
    DB --> RESULTS["Results dashboard<br/>summary counts, candidates,<br/>confirm actions, batch polling"]

    TIER -->|"Confident only"| NEWS["News providers<br/>GNews / NewsAPI"]
    NEWS --> DEDUPE["Deduplicate by URL and event fingerprint"]
    DEDUPE --> REL["Relevancy scoring<br/>OpenAI Responses API<br/>model: gpt-5.4-mini"]
    REL --> DB
    DB --> DETAIL["Company detail view<br/>profile, ranked news,<br/>low-relevance toggle"]
```

### API Surface

| Endpoint | Purpose |
|---|---|
| `POST /api/company/resolve` | Resolve a single company input into ranked candidate matches |
| `POST /api/company/preview-batch` | Parse and validate an uploaded CSV before processing |
| `POST /api/company/resolve-batch` | Create and start a CSV batch resolution job |
| `POST /api/company/confirm` | Confirm a suggested candidate as the selected company |
| `GET /api/company/:id` | Return the persisted canonical company profile plus source records and identifiers |
| `GET /api/batch/:id` | Return batch progress, counts, and row-level statuses |
| `POST /api/news/fetch/:companyId` | Fetch recent news for a resolved company |
| `GET /api/news/:companyId` | Return stored company news ranked by relevancy, optionally including low-relevance items |
| `POST /api/relevancy/score` | Score one article against one company context |
| `POST /api/relevancy/batch` | Score a batch of articles against one company context |

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

### Where to Start in Code

If you need to trace the app quickly, start here:

- App shell and route wiring: `src/routes/InputPage.tsx`, `src/routes/ResultsPage.tsx`, `src/routes/CompanyDetailPage.tsx`
- Frontend API calls: `src/lib/api.ts` and `src/lib/trpc.ts`
- HTTP entry point: `server/app.ts`
- Single-company resolution flow: `server/services/company-resolution/orchestrator.ts`
- CSV parsing and batch execution: `server/services/batch/csv-parser.ts` and `server/services/batch/batch-processor.ts`
- News ingestion: `server/services/news-ingestion/`
- Relevancy scoring: `server/services/relevancy/`
- Database schema: `server/db/schema/`
- Provider registration: `server/providers/company/registry.ts` and `server/providers/news/`

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

This step runs in local application code and does not call OpenAI. In this repo, OpenAI is used for AI fallback resolution and article relevancy scoring, not for the base confidence calculation.

| Signal | Points | Notes |
|---|---|---|
| Domain exact match | 40 | Exact after normalizing protocol, `www.`, and any path |
| Company name similarity | 0-30 | Exact normalized name match gets 30; otherwise token Jaccard is used after stripping common legal suffixes such as `Inc`, `LLC`, and `PBC` |
| Address / location alignment | 0-15 | City contributes 8 with minor typo tolerance, state contributes 4, and token overlap against city/state/country contributes up to 10, capped at 15 total |
| Industry alignment | 0-10 | Case-insensitive substring match |
| Country match | 0-5 | Exact normalized country match; defaults to 5 when either side is missing as a US-first fallback |

Raw score (0-100) is multiplied by a provider reliability factor. Current factors in this repo are `sec_edgar=1.0`, `opencorporates=1.0`, `people_data_labs=0.9`, and `ai_fallback=0.6`.

In code, the final score is:

```ts
finalScore = Math.min(100, Math.round(rawTotal * reliabilityFactor))
```

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

## Current Limitations and Improvement Path

These are the main places where the current v1 implementation is intentionally lighter than the idealized production system described in the PRD.

| Current limitation | Why it matters | How to improve it |
|---|---|---|
| In-process batch queue | CSV jobs run inside the web process, so a deploy or crash can interrupt a batch and make 50+ row reliability dependent on one server instance | Move batch resolution, news fetch, and relevancy scoring into a durable worker queue with retries, dead-letter handling, and SSE or WebSocket progress updates |
| Provider-specific rate limiting is basic | Different providers have very different quotas, and SEC EDGAR in particular has a hard fair-access threshold that should not be crossed during bursts | Add per-provider token buckets, adaptive backoff, quota-aware scheduling, and caching so free-tier and public-data adapters are protected independently |
| Historical duplicate companies are not backfilled | New resolutions now reuse canonical companies by identifiers, provider record IDs, and domain, but older duplicate rows created before that logic still need cleanup | Add a one-time merge/backfill task plus stricter uniqueness constraints so historical duplicates are consolidated |
| Static provider weighting | Provider reliability is currently a fixed multiplier, which is good for v1 but does not fully capture field freshness, source authority, or stale data drift | Add freshness decay, source-specific authority rules by field, and a visible audit trail showing why one source won over another |
| News and scoring workflows are loosely tracked | News fetch and article scoring happen in the background, but there is no first-class job model for resume, retry, or operator visibility | Introduce job tables for enrichment stages, structured failure reasons, resumable workflows, and an admin/debug view for stuck jobs |
| Browser and load coverage are still narrow | Core flows are covered, but there is limited confidence around large CSV runs, provider outage matrices, and regression-heavy UI states | Add load tests for 50+ row batches, provider contract tests, and deeper Playwright coverage for confirm/retry/error/detail flows |
| International resolution is still US-first | Address parsing, registry coverage, and legal suffix handling are better for US companies than for broader international entities | Add country-aware normalizers, expand registry adapters beyond SEC/OpenCorporates, and broaden legal-entity normalization rules |

## Coverage Notes

```bash
pnpm test -- --run tests/unit   # unit tests for core pipeline components
pnpm test:e2e                   # Company Intelligence smoke test
```

Coverage priorities per spec:
- `tests/unit/scorer.test.ts` — confidence scoring algorithm, reliability factor application
- `tests/unit/merger.test.ts` — entity clustering, provider precedence in field merge
- `tests/unit/normalizer.test.ts` — legal suffix stripping, domain/country normalization
- `tests/unit/csv-parser.test.ts` — BOM handling, empty rows, case-insensitive columns, trim
- `tests/unit/deduplicator.test.ts` — URL dedup, title fingerprint, 72-hour event window
- `tests/unit/persistence-metadata.test.ts` — field-confidence and identifier extraction for persistence

Browser coverage is broader than the initial trial baseline now: the active Playwright suite covers the single-company confident/suggested/not-found branches, low-relevance news visibility, CSV validation/progress, and the real-stack Docker-backed integration flows. The older auth/notes browser tests were archived because they were template scaffolding, not part of this trial.

## Provider Access Notes

| Provider | Access | Notes |
|---|---|---|
| SEC EDGAR | Free, no key needed | US government public database with fair-access throttling; see rate-limit notes below |
| PeopleDataLabs | Paid; free trial available | Set `PEOPLE_DATA_LABS_API_KEY`; provider skips gracefully if unset |
| OpenCorporates | Optional | `OPENCORPORATES_API_KEY` improves registry coverage; adapter skips gracefully if unset or rate limited |
| GNews | Free tier (limited) | `GNEWS_API_KEY` is the recommended news key for this repo’s current request shape; see daily limits below |
| NewsAPI | Optional secondary provider | Free-tier plans can hit quota and plan constraints; the provider fails gracefully |
| OpenAI | Paid | `OPENAI_API_KEY` required for relevancy scoring and AI fallback |

If any provider is unavailable, the pipeline continues with remaining providers. A warning is logged with the specific reason (missing key, auth failure, rate limit). The orchestrator falls back to AI-assisted resolution only when all deterministic providers return no results.

### Rate Limit Notes

Checked against provider docs on March 24, 2026:

| Provider | Current documented limit / free-plan constraint | What it means for this app |
|---|---|---|
| SEC EDGAR | Fair-access guidance is `10 requests/second` maximum. The SEC also expects a descriptive `User-Agent`, and can temporarily limit IPs that exceed the threshold. | This is the most important hard throttle in the current stack. Any production version should enforce a provider-specific EDGAR rate limiter instead of relying only on coarse app-level concurrency. |
| GNews | Free plan: `100 requests/day`, `1 request/second`, up to `10` articles per request, `12-hour` delay, and `30 days` of history. After the daily cap, GNews returns `403`; burst overruns return `429`. | Fine for local demos and light manual testing, but easy to exhaust during repeated batch runs or broad regression testing. |
| NewsAPI | Developer plan: `100 requests/day`, `24-hour` article delay, and search limited to roughly the last month. Quota/rate overruns return `429`, and exhausted daily quota can surface as `apiKeyExhausted`. | Good fallback coverage for dev, but not dependable enough for high-volume enrichment without an upgraded plan. |
| OpenCorporates | Official API docs say default usage is `50 requests/day` and `200 requests/month`, though limits vary by account type and plan. | Useful as a registry supplement, but the default quota is too small for heavy batch resolution unless you upgrade or cache aggressively. |
| People Data Labs | PDL documents rate limits as per-key and per-endpoint. For free plans, the plan table currently shows `100/month` for Company Enrichment and `100/month` for Company Search, while the exact live rate window should be read from dashboard/response headers. | Capacity is credit-driven more than request-driven. The app should inspect returned rate-limit headers and back off by endpoint instead of assuming one global quota model. |

## Deployment (Railway)

1. Create a Railway project
2. Add a PostgreSQL service — Railway exposes `DATABASE_URL` automatically
3. Add a Node web service pointing to this repo
4. Set build command: `pnpm install --frozen-lockfile && pnpm build`
5. Set start command: `pnpm start`
6. Add environment variables: `OPENAI_API_KEY`, plus any of `GNEWS_API_KEY`, `NEWS_API_KEY`, `PEOPLE_DATA_LABS_API_KEY`, `OPENCORPORATES_API_KEY` that you plan to use
7. After first deploy, run migrations: `railway run pnpm db:migrate`
8. Verify: `GET /api/health`
