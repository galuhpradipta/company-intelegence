import { Hono } from 'hono'
import { db } from '../db/client.js'
import { sql } from 'drizzle-orm'

export const healthRoute = new Hono()

healthRoute.get('/live', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

healthRoute.get('/', async (c) => {
  try {
    await db.execute(sql`SELECT 1`)
    return c.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[health] database check failed', error)
    return c.json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() }, 503)
  }
})

healthRoute.get('/ready', async (c) => {
  try {
    await db.execute(sql`SELECT 1`)
    return c.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[health] database check failed', error)
    return c.json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() }, 503)
  }
})
