import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { listNewsByCompany, refreshCompanyNews } from '../../services/news-ingestion/index.js'

export const newsRouter = router({
  fetchForCompany: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return refreshCompanyNews(input)
    }),

  refreshForCompany: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return refreshCompanyNews(input)
    }),

  listByCompany: publicProcedure
    .input(z.object({
      companyId: z.string().uuid(),
      showAll: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      return listNewsByCompany(input.companyId, input.showAll)
    }),
})
