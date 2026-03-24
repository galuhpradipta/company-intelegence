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
