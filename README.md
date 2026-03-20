# viteplus-cf-template

A full-stack starter template: **React 19 + Vite + Hono + Cloudflare Pages/D1/R2**.

Includes a minimal Notes CRUD demo that demonstrates every pattern — auth, data loading, forms, toasts, confirmation dialogs — so you can delete it and replace it with your own domain.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7 (data router + lazy routes) |
| Styling | Tailwind CSS v4, Base UI |
| State | Zustand v5 (persisted auth store) |
| Icons | Phosphor Icons |
| Build | Vite (vite-plus), TypeScript 5.9 |
| Backend | Hono on Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Storage | Cloudflare R2 |
| Auth | JWT (jose) + PBKDF2 password hashing |
| Validation | Zod |
| Testing | Vitest (unit), Playwright (E2E) |
| Package manager | pnpm 10 |

---

## Quick start

```bash
# 1. Clone and install
git clone <your-repo> my-app
cd my-app
pnpm install

# 2. Copy env file and set your JWT secret
cp .dev.vars.example .dev.vars
# Edit .dev.vars: JWT_SECRET=<random string>

# 3. Create a D1 database
pnpm db:create
# Copy the database_id from the output into wrangler.json

# 4. Run migrations locally
pnpm db:migrate:local

# 5. Build and start the local Cloudflare dev server
pnpm build && pnpm cf:dev

# App is running at http://localhost:8788
```

---

## Available scripts

| Script | Description |
|---|---|
| `pnpm dev` | Vite dev server (no Workers runtime) |
| `pnpm build` | TypeScript check + Vite build |
| `pnpm cf:dev` | Local Cloudflare Pages dev (full stack) |
| `pnpm cf:deploy` | Deploy to Cloudflare Pages |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm test:e2e:visual` | Run Playwright with visible browser + slow-mo |
| `pnpm lint` | ESLint |
| `pnpm db:create` | Create a new D1 database |
| `pnpm db:generate` | Generate Drizzle migrations from schema |
| `pnpm db:migrate` | Apply migrations to remote D1 |
| `pnpm db:migrate:local` | Apply migrations to local D1 |

---

## Project structure

```
├── functions/api/[[route]].ts   # Hono app entry — Cloudflare Pages Functions
├── server/
│   ├── schema.ts                # Drizzle table definitions + inferred types
│   ├── lib/
│   │   ├── auth.ts              # PBKDF2 + JWT (portable, no Node deps)
│   │   └── env.ts               # Cloudflare bindings type
│   ├── middleware/auth.ts       # Bearer JWT middleware for Hono
│   └── routes/
│       ├── auth.ts              # POST /register, /login, GET/PUT /me
│       └── notes.ts             # CRUD /notes (demo — replace with your domain)
├── src/
│   ├── router.ts                # React Router config with loaders
│   ├── main.tsx                 # App entry — ErrorBoundary + Suspense
│   ├── components/              # Layout, Header, BottomNav, Toast, ConfirmDialog
│   ├── features/
│   │   ├── auth/                # LoginPage, RegisterPage
│   │   └── notes/               # NoteDetailPage, NoteFormPage (demo)
│   ├── routes/
│   │   ├── HomePage.tsx         # Notes list dashboard (demo)
│   │   └── NotFoundPage.tsx
│   └── shared/
│       ├── config.ts            # APP_NAME, STORAGE_PREFIX
│       ├── hooks/               # useApi, useAuth, useOnline, usePageTitle
│       ├── store/               # authStore (persisted), toastStore
│       └── utils/apiFetch.ts    # Loader-friendly fetch (redirects on 401)
├── drizzle/migrations/          # SQL migration files
├── e2e/                         # Playwright tests
└── public/                      # Static assets, PWA manifest
```

---

## Adding a new feature

### 1. Add a server route

```ts
// server/routes/widgets.ts
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";

export const widgetsRoutes = new Hono()
  .use("*", authMiddleware)
  .get("/", async (c) => { /* ... */ })
  .post("/", async (c) => { /* ... */ });
```

Mount it in `functions/api/[[route]].ts`:
```ts
app.route("/widgets", widgetsRoutes);
```

### 2. Add a schema table

```ts
// server/schema.ts
export const widgets = sqliteTable("widgets", { ... });
```

Then generate and apply:
```bash
pnpm db:generate
pnpm db:migrate:local
```

### 3. Add a client route

```ts
// src/router.ts — inside the auth-required Layout group:
{
  path: "widgets",
  loader: () => loadOr(() => apiFetch("/widgets"), []),
  lazy: async () => {
    const { default: Component } = await import("./features/widgets/WidgetsPage.tsx");
    return { Component };
  },
},
```

### 4. Add to the nav

```ts
// src/components/BottomNav.tsx
{ to: "/widgets", icon: Cube, label: "Widgets" },
```

---

## Customization

### App name

Edit `src/shared/config.ts`:
```ts
export const APP_NAME = "My App";
export const STORAGE_PREFIX = "myapp";  // localStorage key prefix
```

### Design tokens

Edit `src/index.css` — the `@theme` block:
```css
@theme {
  --color-app-accent: #your-brand-color;
  --color-app-bg: #your-bg-color;
  /* ... */
}
```

All components use `text-app-accent`, `bg-app-surface`, etc. — Tailwind picks them up automatically.

---

## Deployment to Cloudflare Pages

```bash
# 1. Create production D1 database (if not already done)
pnpm db:create

# 2. Apply migrations to production
pnpm db:migrate

# 3. Set JWT_SECRET in Cloudflare Pages dashboard
#    Settings → Environment variables → JWT_SECRET

# 4. Deploy
pnpm cf:deploy
```

---

## About vite-plus

This template uses [vite-plus](https://github.com/voidzero-dev/vite-plus), a drop-in Vite wrapper that adds:
- Staged linting (`eslint --fix` on changed files before commit)
- Vitest integration via `pnpm test`

To eject back to plain Vite: replace `"vite-plus"` imports with `"vite"` in `vite.config.ts` and `package.json`, and update the `pnpm overrides` block.
