import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { notes } from "../schema.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { Env } from "../lib/env.ts";
import type { AuthVariables } from "../middleware/auth.ts";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const notesRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  .use("*", authMiddleware)

  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const rows = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt))
      .all();
    return c.json(rows);
  })

  .post("/", zValidator("json", createSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const { title, content = "" } = c.req.valid("json");

    const id = crypto.randomUUID();
    await db.insert(notes).values({ id, userId, title, content });

    const note = await db.select().from(notes).where(eq(notes.id, id)).get();
    return c.json(note, 201);
  })

  .get("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const note = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, c.req.param("id")), eq(notes.userId, userId)))
      .get();
    if (!note) return c.json({ error: "Not found" }, 404);
    return c.json(note);
  })

  .put("/:id", zValidator("json", updateSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const noteId = c.req.param("id");

    const existing = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .get();
    if (!existing) return c.json({ error: "Not found" }, 404);

    const updates = c.req.valid("json");
    await db
      .update(notes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notes.id, noteId));

    const updated = await db.select().from(notes).where(eq(notes.id, noteId)).get();
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const noteId = c.req.param("id");

    const existing = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .get();
    if (!existing) return c.json({ error: "Not found" }, 404);

    await db.delete(notes).where(eq(notes.id, noteId));
    return c.json({ ok: true });
  });
