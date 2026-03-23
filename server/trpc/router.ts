import { router } from './trpc.js'
import { companyRouter } from './routers/company.js'
import { batchRouter } from './routers/batch.js'
import { newsRouter } from './routers/news.js'
import { relevancyRouter } from './routers/relevancy.js'

export const appRouter = router({
  company: companyRouter,
  batch: batchRouter,
  news: newsRouter,
  relevancy: relevancyRouter,
})

export type AppRouter = typeof appRouter
