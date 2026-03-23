import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthRoute } from './routes/health.js'

export const app = new Hono()

app.use('*', cors())
app.use('*', logger())

app.route('/api/health', healthRoute)

export default app
