# Repeat Search Behavior

This document describes the current implementation for searching the same company more than once.

## Short Answer

Searching the same company twice is **not** cache-first.

Each `POST /api/company/resolve` request calls the resolution pipeline again, which means the app runs the company providers again before deciding whether to reuse an existing company row in the database.

The local database is reused only after provider results come back and only when a candidate has a normalized domain that matches an existing `companies.domain` value.

## What Happens on Every Search

For each single-company search:

1. The API calls `resolveCompany(...)`.
2. The input is normalized and stored in `resolution_inputs`.
3. Deterministic providers run in parallel.
4. If deterministic providers return nothing, the AI fallback provider runs.
5. Candidates are clustered, scored, and the top results are persisted.

This means a repeated search still reaches the provider layer first.

## When the Database Is Reused

Database reuse currently happens at the company-row level, not at the request level.

If a scored candidate has a domain:

- The domain is normalized.
- The app looks up an existing row in `companies` by that normalized domain.
- If a row exists, that row is updated and reused.
- If no row exists, a new row is inserted.

If a scored candidate has no domain:

- The app does not try another reuse key.
- A new `companies` row is inserted.

## Current Matching Rule

The reuse rule is effectively:

`normalized candidate domain` -> `companies.domain`

There is no equivalent reuse in this flow today for:

- company name only
- SEC CIK
- People Data Labs ID
- OpenCorporates company number
- other identifiers

Those identifiers are persisted for a company after resolution, but they are not used as a pre-provider lookup or as an alternate cross-request reuse key in the current resolve path.

## Practical Scenarios

### Scenario 1: Same company searched twice, same normalized domain

Example:

- First search resolves to `apple.com`
- Second search resolves to `www.apple.com`

Result:

- Providers are called again.
- Domain normalization collapses the candidate to the same stored domain.
- The existing `companies` row is reused and updated.

### Scenario 2: Same company searched twice, no domain returned

Example:

- First search finds a candidate without a domain.
- Second search finds the same candidate, still without a domain.

Result:

- Providers are called again.
- No domain-based reuse is possible.
- A new `companies` row can be inserted again.

### Scenario 3: Same company searched twice, different domains or no stable match key

Example:

- First search resolves using one domain.
- Second search resolves using another domain, or returns incomplete data.

Result:

- Providers are called again.
- Reuse depends entirely on whether the final normalized domain matches an existing row.
- If it does not match, a new `companies` row can be created.

## Why This Matters

Current behavior gives some row-level reuse when the domain is stable, but it does not avoid repeat provider calls and it does not guarantee one canonical row per real-world company across searches.

That lines up with the main README limitation that there is currently no cross-request canonical deduplication.
