export interface CsvReviewResponse {
  totalRows: number
  validRows: number
  invalidRows: number
  parseErrors: Array<{ row: number; message: string }>
  preview: Array<Record<string, string>>
}

async function postCsv(file: File, path: '/api/company/preview-batch' | '/api/company/resolve-batch') {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(path, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error ?? 'Upload failed')
  }

  return res.json()
}

export async function previewCsv(file: File) {
  return postCsv(file, '/api/company/preview-batch') as Promise<CsvReviewResponse>
}

export async function uploadCsv(file: File) {
  return postCsv(file, '/api/company/resolve-batch') as Promise<{
    batchId: string
    status: string
    totalRows: number
    validRows: number
    invalidRows: number
    processedRows: number
    parseErrors: Array<{ row: number; message: string }>
    preview: Array<Record<string, string>>
  }>
}
