import { router } from './trpc.js'
import { companyRouter } from './routers/company.js'
import { batchRouter } from './routers/batch.js'

export const appRouter = router({
  company: companyRouter,
  batch: batchRouter,
})

export type AppRouter = typeof appRouter
