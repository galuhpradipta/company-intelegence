import { Hono } from 'hono'
import { parseCsv } from '../services/batch/index.js'
import { createBatch, processBatch } from '../services/batch/index.js'

export const uploadsRoute = new Hono()

// POST /api/company/resolve-batch — CSV upload
uploadsRoute.post('/resolve-batch', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded. Send multipart/form-data with field "file".' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let parseResult
  try {
    parseResult = parseCsv(buffer)
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Failed to parse CSV',
    }, 400)
  }

  if (parseResult.rows.length === 0) {
    return c.json({
      error: 'CSV contains no valid rows',
      parseErrors: parseResult.errors,
    }, 400)
  }

  const filename = file.name ?? 'upload.csv'
  const batchId = await createBatch(filename, parseResult.rows)

  // Start processing in background (in-process, non-blocking)
  processBatch(batchId, parseResult.rows).catch((err) =>
    console.error(`[Batch ${batchId}] Processing error:`, err)
  )

  return c.json({
    batchId,
    status: 'processing',
    totalRows: parseResult.rows.length,
    processedRows: 0,
    parseErrors: parseResult.errors,
    preview: parseResult.preview,
  })
})
