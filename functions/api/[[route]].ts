import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/cloudflare-pages";
import { authRoutes } from "../../server/routes/auth.ts";
import { notesRoutes } from "../../server/routes/notes.ts";
import type { Env } from "../../server/lib/env.ts";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.route("/auth", authRoutes);
app.route("/notes", notesRoutes);

app.get("/health", (c) => c.json({ ok: true }));

export const onRequest = handle(app);
