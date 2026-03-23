import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { trpcServer } from '@hono/trpc-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { healthRoute } from './routes/health.js'
import { companyRoute } from './routes/company.js'
import { uploadsRoute } from './routes/uploads.js'
import { newsRoute } from './routes/news.js'
import { batchRoute } from './routes/batch.js'
import { appRouter } from './trpc/router.js'
import { createContext } from './trpc/context.js'

export const app = new Hono()

app.use('*', cors())
app.use('*', logger())

// Health
app.route('/api/health', healthRoute)

// REST API routes
app.route('/api/company', companyRoute)
app.route('/api/company', uploadsRoute)
app.route('/api/news', newsRoute)
app.route('/api/batch', batchRoute)

// tRPC
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext,
}))

// Serve static frontend (Vite build output)
app.use('/*', serveStatic({ root: './dist' }))
app.get('/*', serveStatic({ path: './dist/index.html' }))

export default app
export type { AppRouter } from './trpc/router.js'
