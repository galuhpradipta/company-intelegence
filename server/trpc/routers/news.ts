import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { listNewsByCompany, refreshCompanyNews } from '../../services/news-ingestion/index.js'
import { viewerCompanyProfileSchema } from '../../services/relevancy/viewer-company-profile.js'

const refreshNewsInputSchema = z.object({
  companyId: z.string().uuid(),
  viewerCompanyProfile: viewerCompanyProfileSchema.optional(),
})

export const newsRouter = router({
  fetchForCompany: publicProcedure
    .input(refreshNewsInputSchema)
    .mutation(async ({ input }) => {
      return refreshCompanyNews(input.companyId, input.viewerCompanyProfile)
    }),

  refreshForCompany: publicProcedure
    .input(refreshNewsInputSchema)
    .mutation(async ({ input }) => {
      return refreshCompanyNews(input.companyId, input.viewerCompanyProfile)
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
