# Railway Deployment

This repo includes a root [`railway.json`](../railway.json) for a CLI-first Railway deploy:

- Builder: `RAILPACK`
- Start command: `node dist/server/index.js`
- Healthcheck path: `/api/health/live`
- Replicas: `1`
- Restart policy: `ON_FAILURE`

## Why this shape

- The app serves both the API and built frontend from one Node process.
- Railway injects `PORT`, and the server already reads it.
- The start command runs `node` directly instead of `pnpm start`, which matches Railway's current Node SIGTERM guidance.

## CLI-first setup

1. Install the Railway CLI:

   ```bash
   brew install railway
   ```

   Or:

   ```bash
   npm i -g @railway/cli
   ```

2. Log in:

   ```bash
   railway login
   ```

3. Initialize a Railway project from the repo root:

   ```bash
   railway init
   ```

4. Add PostgreSQL to the project:

   ```bash
   railway add -d postgres
   ```

   `railway add` without flags also works if you prefer the interactive picker.

5. Deploy the app service from this directory:

   ```bash
   railway up
   ```

   If the CLI asks you to choose or create a service target, create/select the web service for this repo.

## Variables

Set the app service variables after PostgreSQL exists:

```bash
railway variable set DATABASE_URL='${{Postgres.DATABASE_URL}}'
railway variable set OPENAI_API_KEY=sk-...
railway variable set GNEWS_API_KEY=...
railway variable set NEWS_API_KEY=...
railway variable set PEOPLE_DATA_LABS_API_KEY=...
railway variable set OPENCORPORATES_API_KEY=...
```

Replace `Postgres` if your Railway PostgreSQL service uses a different service name.

Notes:

- `OPENAI_API_KEY` is required.
- `GNEWS_API_KEY`, `NEWS_API_KEY`, `PEOPLE_DATA_LABS_API_KEY`, and `OPENCORPORATES_API_KEY` are optional.
- Do not set `PORT`; Railway injects it.
- Set `NODE_ENV=production` explicitly if you want the runtime mode pinned instead of relying on platform defaults.
- Run `railway run -s <web-service-name> pnpm db:migrate` after variables are set to apply the schema.

## Deploy and verify

Once variables are set:

```bash
railway up
railway run -s <web-service-name> pnpm db:migrate
```

Verify:

```bash
railway open
```

Then check:

- `GET /api/health/live`
- `GET /api/health/ready`
- single-company resolution
- news refresh when provider keys are configured
- CSV upload and batch status polling

## Day-2 CLI commands

```bash
railway logs
railway redeploy
railway run -s <web-service-name> pnpm db:migrate
railway run -s <web-service-name> node dist/server/index.js
railway connect
```

`railway run` is mainly useful locally when you want to execute commands with Railway-managed variables injected into your shell environment.

## Current operational limits

- Keep the service at `1` replica for now.
- CSV batch processing is started inside the web process and tracked partly in memory, so a deploy or restart can interrupt an in-flight batch.
- This trial deploy is fine for validation and demos, but not yet for durable multi-instance batch processing.
