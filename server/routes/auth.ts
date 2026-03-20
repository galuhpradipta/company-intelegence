import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../schema.ts";
import { hashPassword, verifyPassword, signJwt } from "../lib/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { Env } from "../lib/env.ts";
import type { AuthVariables } from "../middleware/auth.ts";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  .post("/register", zValidator("json", registerSchema), async (c) => {
    const { email, password, displayName } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const existing = await db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({ id, email, passwordHash, displayName });

    const token = await signJwt({ sub: id, email }, c.env.JWT_SECRET);
    return c.json({ token, user: { id, email, displayName } }, 201);
  })

  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await signJwt({ sub: user.id, email }, c.env.JWT_SECRET);
    return c.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  })

  .get("/me", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, c.get("userId"))).get();
    if (!user) return c.json({ error: "Not found" }, 404);
    return c.json({ id: user.id, email: user.email, displayName: user.displayName });
  })

  .put(
    "/me",
    authMiddleware,
    zValidator("json", z.object({ displayName: z.string().min(1).max(50) })),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { displayName } = c.req.valid("json");
      const userId = c.get("userId");

      await db.update(users).set({ displayName }).where(eq(users.id, userId));
      return c.json({ displayName });
    },
  );
