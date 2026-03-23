import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { parseCsv } from '../services/batch/index.js'
import { createBatch, processBatch } from '../services/batch/index.js'

export const uploadsRoute = new Hono()

// POST /api/company/resolve-batch — CSV upload
uploadsRoute.post('/preview-batch', async (c) => {
  const { parseResult } = await parseCsvUpload(c)

  return c.json({
    totalRows: parseResult.totalRows,
    validRows: parseResult.rows.length,
    invalidRows: parseResult.errors.length,
    parseErrors: parseResult.errors,
    preview: parseResult.preview,
  })
})

uploadsRoute.post('/resolve-batch', async (c) => {
  const { filename, parseResult } = await parseCsvUpload(c)

  if (parseResult.rows.length === 0) {
    return c.json({
      error: 'CSV contains no valid rows',
      parseErrors: parseResult.errors,
    }, 400)
  }

  const batchId = await createBatch(filename, parseResult.rows)

  // Start processing in background (in-process, non-blocking)
  processBatch(batchId, parseResult.rows).catch((err) =>
    console.error(`[Batch ${batchId}] Processing error:`, err)
  )

  return c.json({
    batchId,
    status: 'processing',
    totalRows: parseResult.totalRows,
    validRows: parseResult.rows.length,
    invalidRows: parseResult.errors.length,
    processedRows: 0,
    parseErrors: parseResult.errors,
    preview: parseResult.preview,
  })
})

async function parseCsvUpload(c: Context) {
  const body = await c.req.parseBody()
  const file = body.file

  if (!file || typeof file === 'string') {
    throw new HTTPException(400, {
      message: 'No file uploaded. Send multipart/form-data with field "file".',
    })
  }

  try {
    return {
      filename: file.name ?? 'upload.csv',
      parseResult: parseCsv(Buffer.from(await file.arrayBuffer())),
    }
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : 'Failed to parse CSV',
    })
  }
}
