import pLimit from 'p-limit'
import { db } from '../../db/client.js'
import { batchUploads, batchUploadItems } from '../../db/schema/index.js'
import { eq, sql } from 'drizzle-orm'
import type { CsvRow } from './csv-parser.js'
import { resolveCompany } from '../company-resolution/index.js'
import { refreshCompanyNews } from '../news-ingestion/index.js'
import { env } from '../../env.js'

export async function createBatch(filename: string, rows: CsvRow[]): Promise<string> {
  const [batch] = await db
    .insert(batchUploads)
    .values({
      filename,
      totalRows: rows.length,
      processedRows: 0,
      status: 'pending',
    })
    .returning({ id: batchUploads.id })

  // Create pending items
  await db.insert(batchUploadItems).values(
    rows.map((_, i) => ({
      batchUploadId: batch.id,
      rowNumber: i + 1,
      status: 'pending' as const,
    }))
  )

  return batch.id
}

export async function processBatch(batchId: string, rows: CsvRow[]): Promise<void> {
  // Mark batch as processing
  await db
    .update(batchUploads)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(batchUploads.id, batchId))

  const limit = pLimit(env.BATCH_CONCURRENCY)

  await Promise.all(
    rows.map((row, i) =>
      limit(async () => {
        const rowNumber = i + 1
        const [item] = await db.query.batchUploadItems.findMany({
          where: (t, { and, eq }) =>
            and(eq(t.batchUploadId, batchId), eq(t.rowNumber, rowNumber)),
          limit: 1,
        })

        if (!item) return

        // Mark item as processing
        await db
          .update(batchUploadItems)
          .set({ status: 'processing' })
          .where(eq(batchUploadItems.id, item.id))

        try {
          const result = await resolveCompany(
            {
              companyName: row.company_name,
              domain: row.domain,
              address: row.address,
              city: row.city,
              state: row.state,
              country: row.country,
              industry: row.industry,
            },
            'csv'
          )

          const topCandidate = result.candidates[0]

          // For confident matches, trigger news + scoring in background
          if (topCandidate?.matchTier === 'confident') {
            refreshCompanyNews(topCandidate.companyId).catch((err) =>
              console.warn(`[Batch] News/scoring failed for ${topCandidate.companyId}:`, err)
            )
          }

          await db
            .update(batchUploadItems)
            .set({
              status: 'completed',
              resolutionInputId: result.resolutionInputId,
              resultCompanyId: topCandidate?.companyId ?? null,
              topScore: topCandidate?.confidenceScore ?? 0,
            })
            .where(eq(batchUploadItems.id, item.id))
        } catch (err) {
          await db
            .update(batchUploadItems)
            .set({
              status: 'failed',
              errorMessage: err instanceof Error ? err.message : String(err),
            })
            .where(eq(batchUploadItems.id, item.id))
        }

        // Increment processed count
        await db
          .update(batchUploads)
          .set({
            processedRows: sql`${batchUploads.processedRows} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(batchUploads.id, batchId))
      })
    )
  )

  // Finalize batch
  await db
    .update(batchUploads)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(batchUploads.id, batchId))
}
