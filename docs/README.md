# Docs

This folder breaks out behavior that is easy to miss in the main project README.

Documents:

- [Repeat Search Behavior](./repeat-search-behavior.md) explains what happens when the same company is searched more than once.
- [Repeat Search Flow](./repeat-search-flow.md) shows the decision paths as Mermaid diagrams.
- [Railway Deployment](./railway-deployment.md) documents the CLI-first Railway setup and the current single-replica constraint.

Source of truth for these notes:

- `server/routes/company.ts`
- `server/services/company-resolution/orchestrator.ts`
- `server/db/schema/companies.ts`
