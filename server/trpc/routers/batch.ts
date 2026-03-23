import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/client.js'
import { batchUploads, batchUploadItems } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'

export const batchRouter = router({
  getStatus: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const batch = await db.query.batchUploads.findFirst({
        where: eq(batchUploads.id, input),
      })
      if (!batch) throw new Error('Batch not found')

      const items = await db.query.batchUploadItems.findMany({
        where: eq(batchUploadItems.batchUploadId, input),
        limit: 50,
      })

      const counts = {
        confident: items.filter((i) => i.topScore !== null && i.topScore >= 85).length,
        suggested: items.filter((i) => i.topScore !== null && i.topScore >= 50 && i.topScore < 85).length,
        notFound: items.filter((i) => i.topScore !== null && i.topScore < 50).length,
        failed: items.filter((i) => i.status === 'failed').length,
      }

      return {
        batchId: batch.id,
        status: batch.status,
        totalRows: batch.totalRows,
        processedRows: batch.processedRows,
        counts,
        items: items.map((item) => ({
          rowNumber: item.rowNumber,
          status: item.status,
          companyId: item.resultCompanyId,
          confidenceScore: item.topScore,
          matchTier: item.topScore !== null
            ? item.topScore >= 85 ? 'confident'
            : item.topScore >= 50 ? 'suggested'
            : 'not_found'
            : null,
          errorMessage: item.errorMessage,
        })),
      }
    }),
})
