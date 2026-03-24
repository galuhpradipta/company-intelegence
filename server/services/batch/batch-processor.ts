import pLimit from 'p-limit'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { batchUploadItems, batchUploads } from '../../db/schema/index.js'
import { env } from '../../env.js'
import { resolveCompany } from '../company-resolution/index.js'
import { refreshCompanyNews } from '../news-ingestion/index.js'
import type { CsvRow } from './csv-parser.js'

const activeBatchRuns = new Map<string, Promise<void>>()

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

  await db.insert(batchUploadItems).values(
    rows.map((row, index) => ({
      batchUploadId: batch.id,
      rowNumber: index + 1,
      rawInput: row as unknown as Record<string, unknown>,
      status: 'pending' as const,
    })),
  )

  return batch.id
}

export function ensureBatchProcessing(batchId: string): Promise<void> {
  const activeRun = activeBatchRuns.get(batchId)
  if (activeRun) {
    return activeRun
  }

  const run = processBatch(batchId)
    .catch((err) => {
      console.error(`[Batch ${batchId}] Processing error:`, err)
      throw err
    })
    .finally(() => {
      activeBatchRuns.delete(batchId)
    })

  activeBatchRuns.set(batchId, run)
  return run
}

export async function processBatch(batchId: string): Promise<void> {
  try {
    await recoverInFlightItems(batchId)
    await syncBatchProgress(batchId)

    const pendingItems = await db.query.batchUploadItems.findMany({
      where: (table, { and, eq }) =>
        and(eq(table.batchUploadId, batchId), eq(table.status, 'pending')),
      orderBy: (table, { asc }) => [asc(table.rowNumber)],
    })

    if (pendingItems.length === 0) {
      await syncBatchProgress(batchId)
      return
    }

    await db
      .update(batchUploads)
      .set({
        status: 'processing',
        errorSummary: null,
        updatedAt: new Date(),
      })
      .where(eq(batchUploads.id, batchId))

    const limit = pLimit(env.BATCH_CONCURRENCY)
    await Promise.all(
      pendingItems.map((item) =>
        limit(() => processBatchItem(batchId, item))
      ),
    )

    await syncBatchProgress(batchId)
  } catch (err) {
    await db
      .update(batchUploads)
      .set({
        status: 'failed',
        errorSummary: { message: err instanceof Error ? err.message : String(err) },
        updatedAt: new Date(),
      })
      .where(eq(batchUploads.id, batchId))

    throw err
  }
}

async function processBatchItem(
  batchId: string,
  item: {
    id: string
    rawInput: unknown
  },
) {
  const startedAt = new Date()
  const row = coerceCsvRow(item.rawInput)

  await db
    .update(batchUploadItems)
    .set({
      status: 'processing',
      startedAt,
      completedAt: null,
      errorMessage: null,
      updatedAt: startedAt,
      attemptCount: sql`${batchUploadItems.attemptCount} + 1`,
    })
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
      'csv',
    )

    const topCandidate = result.candidates[0]

    if (topCandidate?.matchTier === 'confident') {
      refreshCompanyNews(topCandidate.companyId).catch((err) =>
        console.warn(`[Batch] News/scoring failed for ${topCandidate.companyId}:`, err),
      )
    }

    await db
      .update(batchUploadItems)
      .set({
        status: 'completed',
        resolutionInputId: result.resolutionInputId,
        resultCompanyId: topCandidate?.companyId ?? null,
        topScore: topCandidate?.confidenceScore ?? 0,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batchUploadItems.id, item.id))
  } catch (err) {
    await db
      .update(batchUploadItems)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batchUploadItems.id, item.id))
  } finally {
    await db
      .update(batchUploads)
      .set({
        processedRows: sql`${batchUploads.processedRows} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(batchUploads.id, batchId))
  }
}

async function recoverInFlightItems(batchId: string) {
  await db
    .update(batchUploadItems)
    .set({
      status: 'pending',
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(sql`${batchUploadItems.batchUploadId} = ${batchId} and ${batchUploadItems.status} = 'processing'`)
}

async function syncBatchProgress(batchId: string) {
  const items = await db.query.batchUploadItems.findMany({
    where: eq(batchUploadItems.batchUploadId, batchId),
    orderBy: (table, { asc }) => [asc(table.rowNumber)],
  })

  const processedRows = items.filter((item) => item.status === 'completed' || item.status === 'failed').length
  const hasActiveItems = items.some((item) => item.status === 'pending' || item.status === 'processing')
  const status = hasActiveItems
    ? 'processing'
    : processedRows === 0
      ? 'pending'
      : 'completed'

  await db
    .update(batchUploads)
    .set({
      processedRows,
      status,
      updatedAt: new Date(),
    })
    .where(eq(batchUploads.id, batchId))
}

function coerceCsvRow(rawInput: unknown): CsvRow {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new Error('Batch row input is missing or invalid')
  }

  const record = rawInput as Record<string, unknown>
  const companyName = toOptionalString(record.company_name)

  if (!companyName) {
    throw new Error('Batch row is missing company_name')
  }

  return {
    company_name: companyName,
    domain: toOptionalString(record.domain),
    address: toOptionalString(record.address),
    city: toOptionalString(record.city),
    state: toOptionalString(record.state),
    country: toOptionalString(record.country),
    industry: toOptionalString(record.industry),
  }
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined
}
