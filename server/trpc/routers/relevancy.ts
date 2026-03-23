import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { scoreArticlesForCompany } from '../../services/relevancy/index.js'

export const relevancyRouter = router({
  scoreForCompany: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return scoreArticlesForCompany(input)
    }),
})
