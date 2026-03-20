import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Env = {
  // Cloudflare D1 database — bind in wrangler.json as "DB"
  DB: D1Database;
  // Cloudflare R2 bucket — bind in wrangler.json as "ASSETS"
  ASSETS: R2Bucket;
  // JWT signing secret — set in .dev.vars (local) or Cloudflare Pages secrets (prod)
  JWT_SECRET: string;
};
