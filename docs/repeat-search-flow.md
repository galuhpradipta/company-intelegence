# Repeat Search Flow

These diagrams show the current behavior when a user searches for a company, including what can happen on a repeated search.

## Request Flow

```mermaid
flowchart TD
    A["POST /api/company/resolve"] --> B["normalize input"]
    B --> C["insert resolution_inputs row"]
    C --> D["run deterministic providers in parallel"]
    D --> E{"any candidates returned?"}
    E -- "yes" --> G["cluster and merge candidates"]
    E -- "no" --> F["run AI fallback provider"]
    F --> G
    G --> H["score merged candidates"]
    H --> I["take top candidates"]
    I --> J{"candidate has normalized domain?"}
    J -- "yes" --> K{"companies.domain match exists?"}
    K -- "yes" --> L["reuse existing company row and update it"]
    K -- "no" --> M["insert new company row"]
    J -- "no" --> N["insert new company row"]
    L --> O["insert source records and identifiers if new"]
    M --> O
    N --> O
    O --> P["insert company_matches row for this resolution input"]
    P --> Q["mark resolution input completed"]
```

## Repeat Search Decision Path

```mermaid
flowchart TD
    A["User searches same company again"] --> B["providers are called again"]
    B --> C{"resolved candidate has domain?"}
    C -- "yes" --> D{"normalized domain matches existing companies.domain?"}
    D -- "yes" --> E["existing company row is reused"]
    D -- "no" --> F["new company row is inserted"]
    C -- "no" --> G["new company row is inserted"]
```

## Outcome Summary

```mermaid
flowchart LR
    A["Repeat search"] --> B["API/providers run again"]
    B --> C["same normalized domain"]
    B --> D["different or missing domain"]
    C --> E["reuse existing company row"]
    D --> F["insert another company row"]
```

## Notes

- Reuse is post-provider, not pre-provider.
- Reuse is domain-based, not name-based.
- Identifiers and source records help persistence and auditability, but they are not currently used as alternate request-time reuse keys.
