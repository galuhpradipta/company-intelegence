import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
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
  const app = new Hono<{ Bindings: Env }>().route("/api/auth", authRoutes);
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

function jsonPost(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("POST /api/auth/register", () => {
  it("valid payload → 201 + token + user", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request("/api/auth/register", jsonPost(VALID_USER), env);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { token: string; user: { id: string; email: string; displayName: string } };
    expect(typeof data.token).toBe("string");
    expect(data.token.split(".")).toHaveLength(3);
    expect(data.user.email).toBe(VALID_USER.email);
    expect(data.user.displayName).toBe(VALID_USER.displayName);
    expect(data.user.id).toBeDefined();
  });

  it("missing fields → 400", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request(
      "/api/auth/register",
      jsonPost({ email: "test@example.com" }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("duplicate email → 409", async () => {
    const { app, env } = createTestEnv();
    await app.request("/api/auth/register", jsonPost(VALID_USER), env);
    const res = await app.request("/api/auth/register", jsonPost(VALID_USER), env);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("valid credentials → 200 + token", async () => {
    const { app, env } = createTestEnv();
    await app.request("/api/auth/register", jsonPost(VALID_USER), env);

    const res = await app.request(
      "/api/auth/login",
      jsonPost({ email: VALID_USER.email, password: VALID_USER.password }),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token: string; user: { email: string } };
    expect(typeof data.token).toBe("string");
    expect(data.user.email).toBe(VALID_USER.email);
  });

  it("wrong password → 401", async () => {
    const { app, env } = createTestEnv();
    await app.request("/api/auth/register", jsonPost(VALID_USER), env);

    const res = await app.request(
      "/api/auth/login",
      jsonPost({ email: VALID_USER.email, password: "wrong-password" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("non-existent email → 401", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request(
      "/api/auth/login",
      jsonPost({ email: "nobody@example.com", password: "password123" }),
      env,
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("valid token → 200 + user info", async () => {
    const { app, env } = createTestEnv();
    const regRes = await app.request("/api/auth/register", jsonPost(VALID_USER), env);
    const { token } = (await regRes.json()) as { token: string };

    const res = await app.request(
      "/api/auth/me",
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { email: string; displayName: string };
    expect(data.email).toBe(VALID_USER.email);
    expect(data.displayName).toBe(VALID_USER.displayName);
  });

  it("no token → 401", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(401);
  });

  it("invalid token → 401", async () => {
    const { app, env } = createTestEnv();
    const res = await app.request(
      "/api/auth/me",
      { headers: { Authorization: "Bearer invalid.token.here" } },
      env,
    );
    expect(res.status).toBe(401);
  });
});
