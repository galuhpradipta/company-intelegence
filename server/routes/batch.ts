import { Hono } from 'hono'
import { getBatchStatus } from '../services/batch/index.js'

export const batchRoute = new Hono()

// GET /api/batch/:id
batchRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  return c.json(await getBatchStatus(id))
})
