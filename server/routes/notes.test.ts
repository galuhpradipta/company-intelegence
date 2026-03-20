import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { notesRoutes } from "./notes.ts";
import { authRoutes } from "./auth.ts";
import type { Env } from "../lib/env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  resolve(__dirname, "../../drizzle/migrations/0001_initial.sql"),
  "utf-8",
);

const TEST_JWT_SECRET = "test-jwt-secret-for-integration-tests";

function createD1Mock(db: Database.Database) {
  const makeStmt = (query: string, params: unknown[] = []) => ({
    bind(...p: unknown[]) {
      return makeStmt(query, p);
    },
    async all() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (db.prepare(query) as any).all(...params);
      return { results, success: true, meta: {} };
    },
    async raw() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (db.prepare(query) as any).all(...params) as Record<string, unknown>[];
      return results.map((row) => Object.values(row));
    },
    async first() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (db.prepare(query) as any).get(...params);
      return result ?? null;
    },
    async run() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (db.prepare(query) as any).run(...params);
      return {
        success: true,
        meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes },
      };
    },
  });

  return {
    prepare: (query: string) => makeStmt(query),
    exec: async (query: string) => {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
    batch: async (stmts: ReturnType<typeof makeStmt>[]) =>
      Promise.all(stmts.map((s) => s.run())),
    dump: async () => new ArrayBuffer(0),
  };
}

function createTestEnv() {
  const sqlite = new Database(":memory:");
  sqlite.exec(MIGRATION_SQL);
  const mockDB = createD1Mock(sqlite);
  const app = new Hono<{ Bindings: Env }>()
    .route("/api/auth", authRoutes)
    .route("/api/notes", notesRoutes);
  const env = {
    DB: mockDB,
    JWT_SECRET: TEST_JWT_SECRET,
    ASSETS: {},
  } as unknown as Env;
  return { app, env };
}

const VALID_USER = {
  email: "user@example.com",
  password: "password123",
  displayName: "Test User",
};

function jsonReq(method: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined };
}

async function registerAndLogin(app: Hono<{ Bindings: Env }>, env: Env) {
  const res = await app.request(
    "/api/auth/register",
    jsonReq("POST", VALID_USER),
    env,
  );
  const data = (await res.json()) as { token: string };
  return data.token;
}

describe("GET /api/notes", () => {
  it("returns empty list for new user", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const res = await app.request("/api/notes", jsonReq("GET", undefined, token), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("requires auth", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request("/api/notes", {}, env);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/notes", () => {
  it("creates a note and returns it", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const res = await app.request(
      "/api/notes",
      jsonReq("POST", { title: "Hello", content: "World" }, token),
      env,
    );
    expect(res.status).toBe(201);
    const note = (await res.json()) as { id: string; title: string; content: string };
    expect(note.title).toBe("Hello");
    expect(note.content).toBe("World");
    expect(note.id).toBeDefined();
  });

  it("rejects missing title", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const res = await app.request(
      "/api/notes",
      jsonReq("POST", { content: "No title" }, token),
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/notes/:id", () => {
  it("returns the note", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const created = (await (
      await app.request("/api/notes", jsonReq("POST", { title: "My Note" }, token), env)
    ).json()) as { id: string };

    const res = await app.request(`/api/notes/${created.id}`, jsonReq("GET", undefined, token), env);
    expect(res.status).toBe(200);
    const note = (await res.json()) as { title: string };
    expect(note.title).toBe("My Note");
  });

  it("returns 404 for unknown id", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const res = await app.request("/api/notes/nonexistent", jsonReq("GET", undefined, token), env);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/notes/:id", () => {
  it("updates the note", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const created = (await (
      await app.request("/api/notes", jsonReq("POST", { title: "Old" }, token), env)
    ).json()) as { id: string };

    const res = await app.request(
      `/api/notes/${created.id}`,
      jsonReq("PUT", { title: "New" }, token),
      env,
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { title: string };
    expect(updated.title).toBe("New");
  });
});

describe("DELETE /api/notes/:id", () => {
  it("deletes the note", async () => {
    const { app, env } = createTestEnv();
    const token = await registerAndLogin(app, env);
    const created = (await (
      await app.request("/api/notes", jsonReq("POST", { title: "To Delete" }, token), env)
    ).json()) as { id: string };

    const del = await app.request(
      `/api/notes/${created.id}`,
      jsonReq("DELETE", undefined, token),
      env,
    );
    expect(del.status).toBe(200);

    const get = await app.request(`/api/notes/${created.id}`, jsonReq("GET", undefined, token), env);
    expect(get.status).toBe(404);
  });
});
