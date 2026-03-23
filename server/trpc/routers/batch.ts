import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { getBatchStatus } from '../../services/batch/index.js'

export const batchRouter = router({
  getStatus: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return getBatchStatus(input)
    }),
})
