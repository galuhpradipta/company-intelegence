# Merclex Demo Script

This is the demo script I would use with Richard and the interview team.

## Demo Goal

Show that the app works end to end for:

- a confident company match
- a suggested match that needs manual confirmation
- a not-found case
- a CSV batch flow, including a 50-row proof path

## Demo Setup

Run the app in mock mode so the demo is stable and does not spend third-party credits:

```bash
pnpm demo:app
```

Open `http://localhost:5173`.

## What I Should Actually Run

### Recommended approach: use one mode for the whole demo

If I want the safest interview flow, I should use this for both the single-company demo and the 50-row CSV demo:

```bash
pnpm demo:app
```

Why:

- same command for every demo path
- no third-party credit burn
- no rate-limit risk
- the single-company examples and the 50-row CSV fixture are already aligned to the mocked provider setup

This is the approach I should default to.

### If I really want to show a live single-company example first

I can do that, but I should treat it as a separate mode:

1. Run `pnpm dev:all` with my real `.env`
2. Demo only the live single-company path
3. Stop that server
4. Restart in mock mode:

```bash
pnpm demo:app
```

5. Demo the suggested, not-found, and 50-row CSV flows in mock mode

My recommendation is still: do **not** switch modes during the interview unless I have a strong reason. One stable mock-mode demo is easier to control.

## Demo Flow

### 1. Confident match

Use:

- Company name: `Apple Inc.`
- Domain: `apple.com`

What I would say:

“Here I’m showing the strong-match path. The app resolves the company, takes me into the company detail page, and shows the profile plus relevance-ranked news.”

What to point at:

- company profile card
- data sources used
- scored news articles
- low-relevance toggle

### 2. Suggested match

Use:

- Company name: `Beta Labs`
- Address: `200 Mission Street`
- City: `San Francisco`
- State: `CA`
- Industry: `AI`

What I would say:

“Here the system is not fully certain, so instead of auto-selecting a company, it shows the best candidate and lets the user confirm it manually.”

What to point at:

- suggested match UI
- confirm button
- detail page after confirmation

### 3. Not found

Use:

- Company name: `Delta Robotics Advisors`

What I would say:

“Here the system intentionally stays in a not-found state rather than pretending it has a reliable answer. That is important because low-confidence matches should not be presented as confirmable suggestions.”

What to point at:

- retry guidance
- no confirm buttons

### 4. CSV batch flow

Use:

- file: `manual-test-data/demo-50.csv`

What I would say:

“Here I’m showing the batch path. The app validates the file first, previews rows, processes the batch, and then breaks the outcomes into confident, suggested, and not-found results.”

What to point at:

- preview first 5 valid rows
- processing progress
- summary counts
- candidate confirmation and retry actions

## What The 50-Row Batch Proves

What I would say:

“For demo scope, I wanted to prove that the app can handle a 50-row CSV path, not just a tiny sample. This is now backed by a Docker-based integration test that runs the real frontend, real backend, and real Postgres flow in mock mode.”

Proof points:

- fixture: `manual-test-data/demo-50.csv`
- integration test: `e2e/company-intelligence/integration/csv-batch.integration.spec.ts`
- verification command: `pnpm test:e2e:integration:docker`
- visual verification command: `pnpm test:e2e:integration:docker:demo`

### If I want to show the automated visual flow more slowly

Use:

```bash
pnpm test:e2e:integration:docker:demo
```

If I want it even slower:

```bash
PLAYWRIGHT_SLOW_MO_MS=1200 pnpm test:e2e:integration:docker:demo
```

## If Asked About The Remaining Gap

What I would say:

“Today’s build proves the 50-row demo path and supports resumable batch progress, but the batch work still runs inside the web process. If Merclex wanted stronger operational guarantees for larger or more frequent batches, my next step would be moving batch resolution, news fetch, and relevancy scoring into a durable worker queue with retries and better job visibility. That would improve reliability without changing the user-facing flow.”

## Short Close

What I would say:

“So the current app is demo-ready, PRD-aligned, and intentionally honest about where the next level of hardening would go if this moved beyond the paid-trial scope.”
