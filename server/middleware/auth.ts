import type { Context, MiddlewareHandler, Next } from "hono";
import { verifyJwt } from "../lib/auth.ts";
import type { Env } from "../lib/env.ts";

export type AuthVariables = {
  userId: string;
  email: string;
};

export const authMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> = async (c: Context, next: Next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authorization.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "Invalid token" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("email", payload.email);
  await next();
};
