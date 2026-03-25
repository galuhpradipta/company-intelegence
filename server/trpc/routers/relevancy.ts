import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { scoreArticlesForCompany } from '../../services/relevancy/index.js'
import {
  generateViewerCompanyDescription,
  getDefaultViewerCompanyProfile,
  viewerCompanyProfileSeedSchema,
} from '../../services/relevancy/viewer-company-profile.js'

export const relevancyRouter = router({
  viewerCompanyProfile: publicProcedure
    .query(async () => {
      return getDefaultViewerCompanyProfile()
    }),

  generateViewerCompanyDescription: publicProcedure
    .input(viewerCompanyProfileSeedSchema.omit({ description: true }))
    .mutation(async ({ input }) => {
      return {
        description: await generateViewerCompanyDescription(input),
      }
    }),

  scoreForCompany: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return scoreArticlesForCompany(input)
    }),
})
