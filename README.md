# Merclex Company Intelligence

A micro-app that resolves company identities, fetches news, and scores article relevancy using a multi-provider pipeline with deterministic confidence scoring and LLM-powered relevancy analysis.

## Quick Start

```bash
# 1. Copy and fill in env vars
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Run database migrations (requires DATABASE_URL)
pnpm db:migrate

# 4. Start development server
pnpm dev          # frontend (Vite, port 5173)
pnpm server:dev   # backend (Hono, port 3000)
```

Or run both together:

```bash
pnpm dev:all      # runs frontend + backend concurrently
```

In production, the Vite build is served by the Hono server on a single port.

## API Keys Setup

One provider is recommended per category. Get these four keys before running the app.

### 1. OpenAI (required — relevancy scoring + AI fallback)

Sign up at https://platform.openai.com/signup

1. Go to **API Keys** → **Create new secret key**
2. Add billing at **Settings → Billing** (pay-as-you-go, no subscription needed)
3. Cost: `gpt-5.4-mini` is ~$0.15/1M input tokens — scoring 30 articles per company costs roughly $0.002

```env
OPENAI_API_KEY=sk-...
```

### 2. NewsAPI (news ingestion)

Sign up at https://newsapi.org/register

1. Register for a free account — your key is shown immediately on the dashboard
2. Free tier: 100 requests/day, last 30 days of articles (sufficient for demo)

```env
NEWS_API_KEY=your_key_here
```

### 3. PeopleDataLabs (company firmographic data)

Sign up at https://www.peopledatalabs.com/signup

1. Create an account and go to **API Keys** in the dashboard
2. Free tier: 1,000 credits/month (~1,000 company lookups). Paid: ~$0.04–$0.10/record after that

```env
PEOPLE_DATA_LABS_API_KEY=your_key_here
```

### 4. SEC EDGAR (corporate registry data)

No signup or API key required. SEC EDGAR is a US government public database — completely free with no rate limit concerns for reasonable usage. The app queries it automatically.

No `.env` entry needed.

### Final `.env`

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/merclex_intel

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_FALLBACK_MODEL=gpt-5.4

NEWS_API_KEY=your_newsapi_key

PEOPLE_DATA_LABS_API_KEY=your_pdl_key

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
| `NEWS_API_KEY` | Yes | NewsAPI.org key |
| `PEOPLE_DATA_LABS_API_KEY` | Recommended | PDL firmographic enrichment |
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

To add a new provider: create one file in `server/providers/company/`, implement the interface, add it to the `PROVIDERS` array in `server/services/company-resolution/orchestrator.ts`. No other changes needed.

### Confidence Scoring

Scoring is fully deterministic before any AI involvement:

| Signal | Points |
|---|---|
| Domain exact match | 40 |
| Company name similarity (Jaccard) | 0–30 |
| City + state alignment | 0–15 |
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

All raw payloads are preserved in `company_source_records` regardless of which value won.

**AI fallback safety rule**: The AI fallback provider cannot produce a `confident` tier match unless at least one hard signal exists (exact domain match, or legal-name + country alignment). This prevents the model from inventing matches for weak inputs.

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
vp test run tests/unit   # 42 unit tests (scorer, merger, normalizer, CSV parser, deduplicator)
```

Coverage priorities per spec:
- `tests/unit/scorer.test.ts` — confidence scoring algorithm, reliability factor application
- `tests/unit/merger.test.ts` — entity clustering, provider precedence in field merge
- `tests/unit/normalizer.test.ts` — legal suffix stripping, domain/country normalization
- `tests/unit/csv-parser.test.ts` — BOM handling, empty rows, case-insensitive columns, trim
- `tests/unit/deduplicator.test.ts` — URL dedup, title fingerprint, 72-hour event window

## Provider Access Notes

| Provider | Access | Notes |
|---|---|---|
| SEC EDGAR | Free, no key needed | US government public database; no rate limit concerns for reasonable usage |
| PeopleDataLabs | Paid; free trial available | Set `PEOPLE_DATA_LABS_API_KEY`; provider skips gracefully if unset |
| NewsAPI | Free tier for dev | `NEWS_API_KEY` required; upgrade blocked 426 errors are handled gracefully |
| GNews | Free tier (10 req/day) | `GNEWS_API_KEY` required; falls back if unset |
| OpenAI | Paid | `OPENAI_API_KEY` required for relevancy scoring and AI fallback |

If any provider is unavailable, the pipeline continues with remaining providers. A warning is logged with the specific reason (missing key, auth failure, rate limit). The orchestrator falls back to AI-assisted resolution only when all deterministic providers return no results.

## Deployment (Railway)

1. Create a Railway project
2. Add a PostgreSQL service — Railway exposes `DATABASE_URL` automatically
3. Add a Node web service pointing to this repo
4. Set build command: `pnpm install --frozen-lockfile && pnpm build`
5. Set start command: `pnpm start`
6. Add environment variables: `OPENAI_API_KEY`, `NEWS_API_KEY` or `GNEWS_API_KEY`
7. After first deploy, run migrations: `railway run pnpm db:migrate`
8. Verify: `GET /api/health`
