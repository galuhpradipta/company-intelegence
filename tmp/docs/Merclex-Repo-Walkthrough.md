# Merclex Repo Walkthrough

This is the lightweight repo walkthrough I would use in the interview.

## Main Repo Structure

- `src/routes/`
  This is the page-level UI. It shows the main screens such as input, results, and company detail.

- `src/features/`
  This is the feature UI layer. It contains the main user interactions like single-company input, CSV upload, and news-related behavior.

- `src/lib/`
  This is the frontend integration layer. It contains the API and tRPC client helpers used by the UI.

- `server/routes/`
  This is the REST API layer. These files are thin request handlers.

- `server/trpc/routers/`
  This is the typed API layer used by the frontend.

- `server/providers/`
  This is the provider abstraction layer. It contains company-data providers and news providers.

- `server/services/company-resolution/`
  This is the company identity engine. It handles input normalization, scoring, merging, canonical reuse, and persistence flow.

- `server/services/news-ingestion/`
  This is the news ingestion layer. It fetches, deduplicates, stores, and returns company news.

- `server/services/relevancy/`
  This is the article scoring layer. It handles relevancy scoring and related AI logic.

- `server/services/batch/`
  This is the CSV and batch-processing layer. It handles parsing, batch execution, resumable progress, and status building.

- `server/db/schema/`
  This is the database model layer. It contains the main Postgres schema for companies, identifiers, source records, matches, news, and batch state.

- `server/testing/`
  This contains mock fixtures used for safe local testing and demo mode.

- `tests/unit/`
  This is the main unit-test coverage for scoring, merge logic, CSV parsing, provider behavior, and batch logic.

- `e2e/company-intelligence/`
  This is the browser test layer. It covers the user-facing flows.

- `e2e/company-intelligence/integration/`
  This is the real-stack integration layer. It runs the real frontend, backend, and database together.

- `manual-test-data/`
  This contains CSV files for manual demo and validation flows.

- `scripts/`
  This contains helper scripts, including the integration E2E runner.

- `tmp/docs/`
  This is where I keep interview-support material such as demo notes, PRD review notes, and walkthrough documents.

## Simple Interview Explanation

What I would say:

“On the frontend, `src/routes` and `src/features` contain the app screens and user interactions. On the backend, `server/routes` and `server/trpc/routers` expose the API, while the real product logic lives under `server/services`. The provider adapters are under `server/providers`, the database schema is under `server/db/schema`, and the test coverage is split between `tests/unit`, browser E2E, and full integration E2E.”

## Local Infra Explanation

What I would say:

“Infra for this exercise is local. The frontend runs through Vite, the backend runs as a Hono server, and Postgres is provided through `DATABASE_URL`. For the strongest local proof, the integration E2E flow can also spin up a temporary Docker Postgres instance.” 
