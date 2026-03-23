import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { trpcServer } from '@hono/trpc-server'
import { healthRoute } from './routes/health.js'
import { appRouter } from './trpc/router.js'
import { createContext } from './trpc/context.js'

export const app = new Hono()

app.use('*', cors())
app.use('*', logger())

app.route('/api/health', healthRoute)

// tRPC handler
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext,
}))

export default app
export type { AppRouter } from './trpc/router.js'
