# Merclex PRD Review (Non-Technical)

This document is written as my plain-English walkthrough of the PRD for Richard and the interview team.

Status labels used in this review:

- `Yes` = this is clearly addressed
- `Mostly` = this is addressed, but there is still a meaningful gap
- `No` = this is not really addressed yet

## 1. Purpose and Context

Overall answer from me: `Mostly`

This section is largely addressed. The app demonstrates the main Merclex workflow from end to end and shows the kind of architecture thinking the trial is asking for. The part that remains partial is operational robustness for larger batch processing.

### What We’re Evaluating

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Schema design | Yes | The app stores company records, source records, identifiers, match results, news, and relevance scores in a clear structure. | The data model is separated into canonical companies, source records, identifiers, matches, news, and relevance scoring tables. This is visible in `server/db/schema/` and is used by the resolution flow in `server/services/company-resolution/orchestrator.ts`. | Nothing major for the purpose of this trial. |
| API architecture | Yes | The app uses a provider-based design, so adding a new source does not require rewriting the core pipeline. | The common provider contract is defined in `server/providers/company/types.ts`, providers are wired in `server/providers/company/registry.ts`, and the orchestrator consumes the registry rather than hard-coding one source. | Nothing major for this evaluation. |
| Data quality thinking | Mostly | The app handles missing information, conflicting signals, confidence levels, and source tracking in a thoughtful way. | The flow normalizes input, merges overlapping candidates, scores confidence, and records source-level provenance. That behavior is implemented across `server/services/company-resolution/normalizer.ts`, `merger.ts`, `scorer.ts`, and `orchestrator.ts`. | Older duplicate company records are not yet cleaned up automatically. |
| AI/LLM integration | Yes | The app uses AI for article relevance scoring in a structured and controlled way, and it supports safe mocked behavior in tests. | Article scoring is handled through structured output in `server/services/relevancy/scoring-service.ts`. The test-safe mocked mode is also built into the test setup and provider environment handling. | Nothing major for the trial outcome. |
| End-to-end delivery | Mostly | The product works from company input through resolution, news retrieval, and relevance scoring, and it is usable as a demo. | The working user flow runs across the input page, results page, and company detail page in `src/routes/`, and it is backed by green unit, browser, and Docker-backed integration tests. | Large CSV processing is still more demo-ready than fully production-durable. |

### Non-Technical Takeaway

My conclusion for this section is that the trial goal is largely met. The product works end to end and demonstrates the right architecture decisions. The main remaining gap is that bigger batch jobs are not yet as operationally durable as I would want in a more production-ready version.

### Short Flow Proof

The clearest proof for this section is the end-to-end flow itself:

1. A user enters a company or uploads a CSV in the UI under `src/routes/`
2. The backend resolves the company through multiple providers in `server/services/company-resolution/`
3. The app stores the canonical company, supporting identifiers, and source records in `server/db/schema/`
4. For confident matches, the app fetches news and stores article links through `server/services/news-ingestion/`
5. The app scores business relevance through `server/services/relevancy/`
6. The results are shown back in the GUI through the results and company detail pages

That flow is also covered by automated tests in `tests/unit/`, `e2e/company-intelligence/`, and `e2e/company-intelligence/integration/`.

## 2. Product Overview

Overall answer from me: `Mostly`

This section is mostly addressed. The app delivers the requested miniature enrichment pipeline from company input through resolution, news collection, and relevance scoring. The main partial area is the final presentation: the information is shown across the batch results page and the company detail page rather than in one single combined dashboard.

### User Flow

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| 1. User enters a single company or uploads a CSV | Yes | The app supports both a single-company form and a CSV upload flow. | The entry screen supports both tabs in `src/routes/InputPage.tsx`, and CSV preview plus processing is handled by `server/routes/uploads.ts`. | Nothing major for this flow step. |
| 2. System resolves each input against external APIs and returns a confidence score | Yes | The app resolves companies through external sources and produces a numeric confidence score. | Resolution is handled through the company-resolution flow in `server/services/company-resolution/`, and the confidence result is shown in the UI on the results and company detail screens. | Nothing major for this flow step. |
| 3. Companies are bucketed into Confident, Suggested, and Not Found | Yes | The app clearly classifies results into the three requested outcome groups. | The tiering rules are defined in `server/services/company-resolution/scorer.ts`, and those tiers are visible in `src/routes/ResultsPage.tsx`, `src/routes/CompanyDetailPage.tsx`, and the single-company flow. | Nothing major for this flow step. |
| 4. For confident matches, the system automatically fetches recent news articles | Yes | Confident matches automatically trigger news retrieval. | The company detail flow auto-fetches news for confident matches in `src/routes/CompanyDetailPage.tsx`, and batch processing also triggers news fetches for confident matches in `server/services/batch/batch-processor.ts`. | Nothing major for this flow step. |
| 5. Each news article is scored for relevance using an LLM | Yes | The app scores article relevance using AI and stores the result. | Relevance scoring is implemented in `server/services/relevancy/scoring-service.ts`, and news refresh ties into that scoring flow through `server/services/news-ingestion/company-news.ts`. | Nothing major for this flow step. |
| 6. User sees a dashboard with company matches, news feed, and relevance rankings | Mostly | The user can see all of this information, but it is split across screens rather than shown in one single combined dashboard. | `src/routes/ResultsPage.tsx` shows match outcomes and rankings at the batch level, while `src/routes/CompanyDetailPage.tsx` shows the company profile, news list, and article relevance ordering. | The final experience is split across pages instead of being one unified dashboard view. |

### Non-Technical Takeaway

The main user journey requested in the PRD is working. A user can enter company data, get a scored result, trigger or view news collection, and see relevance-ranked articles. The main reason this section is marked `Mostly` instead of `Yes` is that the final information is split across views rather than being presented in one single all-in-one dashboard.

### Short Flow Proof

The clearest proof for this section is the working product flow:

1. The user starts on the input page and chooses either single-company entry or CSV upload
2. The backend resolves company identity and assigns a confidence tier
3. Confident results automatically continue into news collection
4. News articles are scored for business relevance
5. The user can review company-level results, batch-level results, and ranked news in the UI

This user journey is also exercised in the browser and integration tests under `e2e/company-intelligence/` and `e2e/company-intelligence/integration/`.

## 3. Feature Specifications

Overall answer from me: `Mostly`

Most of the feature specification is addressed well. The strongest parts are the company identity engine and the relevancy scoring flow. The main partial areas are large CSV durability and one news API detail where the implementation returns news ranked by relevance instead of by date.

## 3.1 Company Input Interface

Overall answer from me: `Mostly`

This section is mostly addressed. The single-company flow is in good shape, and the CSV flow is strong for demo and trial use. The one area I would still call partial is the requirement to comfortably handle larger CSV jobs without timeout in a more production-like way.

### Single Company Input

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Form with company fields | Yes | The form includes the requested company fields, including name, domain, address, city, state, country, and industry. | The single-company form is implemented in `src/features/company-input/SingleCompanyForm.tsx`. | Nothing major for this part. |
| “Resolve” button triggers identity pipeline | Yes | The form has a clear action to start company resolution. | The resolve action is wired from the form into the company resolution backend through the company router and service layer. | Nothing major for this part. |
| Loading or shimmer state while resolving | Yes | The user sees an active loading state while the company is being resolved. | The form shows a spinner and “Resolving…” state in `src/features/company-input/SingleCompanyForm.tsx`. | Nothing major for this part. |
| Inline results for matched company or suggestions | Yes | The flow shows an inline matched company card for strong matches and inline suggestions for manual confirmation when needed. | The single-company UI handles confident, suggested, and not-found states directly in `src/features/company-input/SingleCompanyForm.tsx`. | Nothing major for this part. |

### CSV Bulk Upload

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Accept CSV with template download | Yes | The app accepts CSV uploads and provides a template download link. | The CSV upload screen is implemented in `src/features/csv-upload/CsvUpload.tsx`. | Nothing major for this part. |
| Required and optional CSV columns | Yes | The CSV flow is built around the required `company_name` field and supports the optional fields listed in the PRD. | CSV validation and parsing are handled through the upload and batch parsing flow in `server/routes/uploads.ts` and the batch services. | Nothing major for this part. |
| Validate upload, show row count, missing fields, and preview first 5 rows | Yes | The app validates the CSV before processing and clearly shows counts, skipped rows, and a preview. | The preview and validation UI is in `src/features/csv-upload/CsvUpload.tsx`, and the preview endpoint is in `server/routes/uploads.ts`. | Nothing major for this part. |
| Process companies in parallel with progress indicator | Yes | The app processes CSV rows in parallel and shows progress back to the user. | Batch concurrency is driven by `BATCH_CONCURRENCY` in `server/env.ts`, batch execution runs through `server/services/batch/batch-processor.ts`, and progress is shown in `src/routes/ResultsPage.tsx`. | Nothing major for this part. |
| Handle at least 50 companies without timeout | Mostly | The current build now has a verified 50-row demo path, and it supports resumable progress. The reason I still mark this as `Mostly` is that the work still runs inside the main web process rather than a separate durable worker. | Batch execution and resume behavior are implemented in `server/services/batch/batch-processor.ts`, and the 50-row demo path is now covered by the Docker-backed integration suite using `manual-test-data/demo-50.csv`. | If this needed to operate at higher volume or with stronger operational guarantees, the next step would be moving batch work into a dedicated worker queue with retries and job visibility. |

### Endpoints

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| `POST /api/company/resolve` | Yes | The single-company resolution endpoint exists. | The REST endpoint is implemented in `server/routes/company.ts`. | Nothing major for this part. |
| `POST /api/company/resolve-batch` | Yes | The batch resolution endpoint exists. | The batch upload endpoint is implemented in `server/routes/uploads.ts`. | Nothing major for this part. |
| `POST /api/company/confirm` | Yes | The app supports manual confirmation of a suggested match. | The confirm endpoint is implemented in `server/routes/company.ts`. | Nothing major for this part. |
| `GET /api/company/:id` | Yes | The app returns a resolved company profile with supporting details. | The company profile endpoint is implemented in `server/routes/company.ts`. | Nothing major for this part. |

### Non-Technical Takeaway

The company input experience is working well and is already good enough to demonstrate the trial end to end. I can now point to a verified 50-row demo path. The only reason this section is not marked `Yes` is that larger CSV handling is still better described as strong demo behavior than fully hardened production behavior.

## 3.2 Company Identity Engine (Core)

Overall answer from me: `Yes`

This is one of the strongest parts of the implementation. The identity engine is structured in a way that is extensible, layered, and easy to reason about, which is exactly what this trial section is trying to evaluate.

### Architecture Requirements

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Provider abstraction pattern | Yes | Each company source follows the same pattern, which makes the system easier to extend. | The shared contract is defined in `server/providers/company/types.ts`, the sources are assembled in `server/providers/company/registry.ts`, and the orchestrator consumes that registry. | Nothing major for this part. |
| Confidence scoring | Yes | The app calculates confidence from multiple business signals such as name, domain, address, and industry alignment. | The scoring rules are implemented in `server/services/company-resolution/scorer.ts`. | Nothing major for this part. |
| Entity resolution and conflict handling | Yes | The app merges overlapping company results into one canonical record, keeps track of where fields came from, and uses source quality and freshness to resolve conflicts. | This behavior is implemented across `server/services/company-resolution/merger.ts`, `persistence-metadata.ts`, and `orchestrator.ts`. | Historical duplicate cleanup would still be a future improvement, but the main requirement is addressed. |
| Tiered output | Yes | The app clearly separates confident, suggested, and not-found outcomes and behaves differently for each one. | Tier behavior is enforced through the scorer, the resolution flow, the input experience, and the batch results flow. | Nothing major for this part. |

### Data Sources

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Integrate at least 2 sources | Yes | The app integrates more than the minimum requirement. | The current provider registry includes People Data Labs, SEC EDGAR, OpenCorporates, and an AI fallback path in `server/providers/company/registry.ts`. | Nothing major for this part. |
| Mocking acceptable when live access is limited | Yes | The app supports mocked provider behavior for testing and safe local evaluation. | Mock provider behavior is built into the provider registry and environment handling. | Nothing major for this part. |

### Schema Design

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Canonical company model and supporting source records | Yes | The data design follows the spirit of the PRD very closely. | The schema under `server/db/schema/` includes companies, source records, identifiers, resolution inputs, and ranked matches. | Nothing major for this part. |

### Non-Technical Takeaway

This is the clearest “Yes” section in the PRD. The identity engine is structured like a real product subsystem rather than a one-off demo script, which is exactly what this part of the assignment is meant to test.

## 3.3 News Ingestion Pipeline

Overall answer from me: `Mostly`

This section is mostly addressed. The app fetches, stores, deduplicates, and scores recent company news, and it does this automatically for confident matches. The main mismatch is that the API returns news ranked by relevance instead of strictly sorted by date.

### Requirements

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Fetch from at least one news API | Yes | The app supports multiple news providers, which is more than the minimum requirement. | News providers are registered in `server/providers/news/registry.ts`. | Nothing major for this part. |
| Search using company name and optionally domain or ticker | Yes | The app builds the news search using company name plus stronger signals such as domain and ticker when available. | This behavior is implemented in `server/services/news-ingestion/ingestion-service.ts` and the related query builder. | Nothing major for this part. |
| Store title, source, date, URL, snippet, and full text when available | Yes | The app stores the key article fields requested by the PRD. | Article ingestion and storage are handled in `server/services/news-ingestion/ingestion-service.ts`. | Nothing major for this part. |
| Deduplicate same-event coverage | Yes | The app removes duplicate or near-duplicate coverage across outlets. | Deduplication is built into the news ingestion flow through the dedupe helpers used by `ingestion-service.ts`. | Nothing major for this part. |
| Handle rate limits gracefully | Yes | The app includes retry and backoff handling rather than failing immediately. | News-provider retry behavior was added into the provider layer and is exercised by the ingestion flow. | Nothing major for the trial scope. |
| Fetch most recent 30 days of news | Yes | The app fetches recent news across the 30-day window requested in the PRD. | The lookback period is driven by `NEWS_LOOKBACK_DAYS` in `server/env.ts` and used in `server/services/news-ingestion/ingestion-service.ts`. | Nothing major for this part. |

### Endpoints

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| `POST /api/news/fetch/:companyId` | Yes | The app supports manually triggering news collection for a resolved company. | The endpoint exists in `server/routes/news.ts`. | Nothing major for this part. |
| `GET /api/news/:companyId` returns stored articles sorted by date, with scores if available | Mostly | The endpoint returns stored articles and includes relevance data, but the ordering is by relevance rather than by date. | The route exists in `server/routes/news.ts`, and the sorting behavior is defined in `server/services/news-ingestion/company-news.ts`. | The ordering does not exactly match the PRD wording for this endpoint. |

### Non-Technical Takeaway

The news pipeline is working and useful. The only real reason this section is `Mostly` instead of `Yes` is that the current product chooses to rank news by relevance, which matches the later GUI requirement well, but does not exactly match the PRD sentence that says the API should sort by date.

## 3.4 Company Relevancy Scoring Engine

Overall answer from me: `Yes`

This section is addressed well. The app does not just collect articles; it scores them in context and turns them into something closer to business intelligence, which is the main purpose of this part of the PRD.

### Scoring Requirements

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| LLM-powered scoring with structured output | Yes | The app uses AI to return a score, category, and one-line explanation in a structured format. | This is implemented in `server/services/relevancy/scoring-service.ts` and exposed through `server/routes/relevancy.ts`. | Nothing major for this part. |
| Context-aware scoring | Yes | The scoring prompt includes the company’s details so relevance is judged in business context, not in isolation. | The scoring prompt in `server/services/relevancy/scoring-service.ts` includes company name, industry, size, and location. | Nothing major for this part. |
| Batch processing with graceful failure handling | Yes | The app can score multiple articles concurrently and retry failures instead of blocking everything. | Batch scoring, concurrency, and retries are implemented in `server/services/relevancy/scoring-service.ts`. | Nothing major for this part. |
| Filtering threshold below 30 hidden by default, but still accessible | Yes | Low-scoring articles are hidden by default but can still be shown. | The filter behavior is implemented in `server/services/news-ingestion/company-news.ts`, and the UI toggle is shown in `src/routes/CompanyDetailPage.tsx`. | Nothing major for this part. |

### Relevancy Categories

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Relevancy categories are defined and used | Yes | The app uses clear article categories that match the PRD intent. | The supported categories are defined in `server/services/relevancy/scoring-service.ts`. | Nothing major for this part. |

### Endpoints

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| `POST /api/relevancy/score` | Yes | The single-article scoring endpoint exists. | It is implemented in `server/routes/relevancy.ts`. | Nothing major for this part. |
| `POST /api/relevancy/batch` | Yes | The batch scoring endpoint exists. | It is implemented in `server/routes/relevancy.ts`. | Nothing major for this part. |

### Non-Technical Takeaway

This section is in strong shape. The app does not stop at collecting raw news articles; it adds structured relevance scoring, categories, and explanations, which is the part that makes the output more useful for actual business review.

## 4. GUI Requirements

Overall answer from me: `Yes`

This section is addressed well. The interface is functional, clear, and demonstrates the full pipeline from input through resolution, batch review, and news review. It is not trying to be a polished design exercise, but it does what the PRD asked for and supports the demo effectively.

## 4.1 Input View

Overall answer from me: `Yes`

The input view matches the PRD closely. A user can switch between single-company entry and CSV upload, fill in the requested data, preview uploads, and see clear validation or failure states before processing.

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Tab or toggle: “Single Company” vs. “CSV Upload” | Yes | The user can clearly choose between the two input modes from the same starting page. | The switch between the two modes is implemented on the input screen in `src/routes/InputPage.tsx`. | Nothing major for this part. |
| Single company form with all fields, “Resolve” button | Yes | The single-company path includes the expected company fields and a clear action to start resolution. | The form fields and resolve action are implemented in `src/features/company-input/SingleCompanyForm.tsx`. | Nothing major for this part. |
| CSV upload with drag-and-drop zone, template download link, preview table | Yes | The CSV path supports drag-and-drop, provides a template, and shows a preview before processing. | The upload area, template link, and preview table are implemented in `src/features/csv-upload/CsvUpload.tsx`. | Nothing major for this part. |
| Clear error states for validation failures | Yes | The user gets understandable feedback when the form or CSV upload has a problem. | Error and validation states are shown in both `src/features/company-input/SingleCompanyForm.tsx` and `src/features/csv-upload/CsvUpload.tsx`. | Nothing major for this part. |

### Non-Technical Takeaway

The input experience is easy to follow and already works well for demo use. A user can start with one company or many companies, and the app makes it clear what to do next in both cases.

## 4.2 Results Dashboard

Overall answer from me: `Yes`

The results dashboard covers the main review workflow well. It gives a fast summary of batch outcomes, shows which companies were matched confidently, surfaces suggested candidates for manual review, and gives a retry path for the ones that were not found.

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Three-column summary bar: Confident, Suggested, Not Found | Yes | The app shows the three requested outcome groups with counts so the user can understand the batch at a glance. | The summary bar is rendered in `src/routes/ResultsPage.tsx`. | Nothing major for this part. |
| Clickable company cards with name, domain, confidence score, tier badge, source providers used | Yes | The result cards give the main information a user needs to judge the match and open the company detail view. | The result cards and company detail links are implemented in `src/routes/ResultsPage.tsx`. | Nothing major for this part. |
| For suggested matches: show top 3 candidates with “Confirm” button | Yes | Suggested matches are presented as a short ranked list with a clear confirm action. | The top-candidate review flow is implemented in `src/routes/ResultsPage.tsx`, and confirmation is wired through the company confirmation flow. | Nothing major for this part. |
| For not found: show “Retry with different inputs” option | Yes | The user gets a clear path to retry instead of being left at a dead end. | The retry action is shown for not-found rows in `src/routes/ResultsPage.tsx`, and the same idea is also reflected in the single-company input flow. | Nothing major for this part. |

### Non-Technical Takeaway

The dashboard does the job the PRD expects. It quickly separates easy wins from cases that need manual review, which is the core purpose of this screen.

## 4.3 Company Detail + News View

Overall answer from me: `Yes`

The company detail and news view is one of the clearest parts of the app. Once a company is opened, the user can see both the company profile and the relevance-ranked news in one place, which makes the result feel complete and easy to explain in a demo.

| Point | Status | Plain-English answer | Proof | Anything still missing |
|---|---|---|---|---|
| Company profile card: name, domain, industry, employee count, address, data sources | Yes | The company detail page includes the profile information the PRD asks for. | The profile card is implemented in `src/routes/CompanyDetailPage.tsx`. | Nothing major for this part. |
| News feed below, sorted by relevancy score (highest first) | Yes | The news list is intentionally ranked by business relevance so the most useful articles appear first. | The UI is rendered in `src/routes/CompanyDetailPage.tsx`, and the ranking is provided by the backend news query flow. | Nothing major for this part. |
| Each news card shows title, source, date, relevancy score, category, explanation, and original article link | Yes | The article cards include the full set of fields needed to understand why an article matters and to open the original source. | The news-card layout is implemented in `src/routes/CompanyDetailPage.tsx`. | Nothing major for this part. |
| “Show all” toggle for articles below the 30-point threshold | Yes | The user can reveal lower-scoring articles when needed instead of losing access to them. | The filter and toggle behavior is implemented across `server/services/news-ingestion/company-news.ts` and `src/routes/CompanyDetailPage.tsx`. | Nothing major for this part. |
| Empty state for companies with no news | Yes | The app handles the no-news case cleanly and does not leave the page blank. | The empty-news state is implemented in `src/routes/CompanyDetailPage.tsx`. | Nothing major for this part. |

### Non-Technical Takeaway

This part of the UI is demo-ready. It shows the company profile, explains why articles were ranked the way they were, and gives a clear path to the source material, which makes the output feel credible to a reviewer.
