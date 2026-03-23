import { Hono } from 'hono'
import { listNewsByCompany, refreshCompanyNews } from '../services/news-ingestion/index.js'

export const newsRoute = new Hono()

// POST /api/news/fetch/:companyId
newsRoute.post('/fetch/:companyId', async (c) => {
  const companyId = c.req.param('companyId')
  return c.json(await refreshCompanyNews(companyId))
})

// GET /api/news/:companyId
newsRoute.get('/:companyId', async (c) => {
  const companyId = c.req.param('companyId')
  const showAll = c.req.query('showAll') === 'true'
  return c.json(await listNewsByCompany(companyId, showAll))
})
