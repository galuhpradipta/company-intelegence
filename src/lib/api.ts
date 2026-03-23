export async function uploadCsv(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/company/resolve-batch', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error ?? 'Upload failed')
  }
  return res.json() as Promise<{
    batchId: string
    status: string
    totalRows: number
    processedRows: number
    parseErrors: Array<{ row: number; message: string }>
    preview: Array<Record<string, string>>
  }>
}
