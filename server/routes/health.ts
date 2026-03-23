import { Hono } from 'hono'
import { db } from '../db/client.js'
import { sql } from 'drizzle-orm'

export const healthRoute = new Hono()

healthRoute.get('/', async (c) => {
  try {
    await db.execute(sql`SELECT 1`)
    return c.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch (err) {
    return c.json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() }, 503)
  }
})
