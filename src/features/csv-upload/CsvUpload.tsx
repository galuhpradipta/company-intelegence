import { useState, useRef } from 'react'
import { previewCsv, uploadCsv, type CsvReviewResponse } from '../../lib/api.js'

interface Props {
  onBatchCreated: (batchId: string) => void
}

export function CsvUpload({ onBatchCreated }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<CsvReviewResponse | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setFile(f)
    setError(null)
    setReview(null)
    setValidating(true)
    try {
      setReview(await previewCsv(f))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV validation failed')
    } finally {
      setValidating(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleDropZoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  async function handleUpload() {
    if (!file) return
    setProcessing(true)
    setError(null)
    try {
      const result = await uploadCsv(file)
      onBatchCreated(result.batchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-5">
      <div
        role="button"
        tabIndex={0}
        aria-label={file ? `Selected file: ${file.name}. Press Enter to change file.` : 'Drop a CSV file here or press Enter to browse'}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleDropZoneKeyDown}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors ${
          dragOver ? 'border-teal-400 bg-teal-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
        />
        <svg className="w-10 h-10 text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {file ? (
          <div className="text-center">
            <p className="font-semibold text-stone-800 text-sm">{file.name}</p>
            <p className="text-xs text-stone-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-stone-600">Drop a CSV file here or <span className="text-app-accent font-semibold">browse</span></p>
            <p className="text-xs text-stone-500 mt-1">Required column: company_name</p>
          </div>
        )}
      </div>

      {validating && (
        <div role="status" aria-live="polite" className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700">
          Validating CSV and preparing preview…
        </div>
      )}

      <div className="flex items-center justify-between">
        <a
          href="/company-template.csv"
          download
          className="text-xs text-app-accent hover:text-app-accent-dim hover:underline transition-colors"
        >
          Download CSV template
        </a>
        {file && (
          <button
            onClick={handleUpload}
            disabled={processing || validating || !review || review.validRows === 0}
            className="bg-app-accent hover:bg-app-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {processing ? 'Starting…' : 'Start Processing'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {review && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Rows detected" value={review.totalRows} tone="neutral" />
          <MetricCard label="Ready to process" value={review.validRows} tone="green" />
          <MetricCard label="Rows skipped" value={review.invalidRows} tone="yellow" />
        </div>
      )}

      {review && review.parseErrors.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs font-semibold text-yellow-800 mb-1">{review.parseErrors.length} rows skipped:</p>
          {review.parseErrors.slice(0, 5).map((e) => (
            <p key={e.row} className="text-xs text-yellow-700">Row {e.row}: {e.message}</p>
          ))}
        </div>
      )}

      {review?.preview && review.preview.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">
            Preview first {review.preview.length} valid rows before processing:
          </p>
          <div className="overflow-x-auto border border-stone-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-stone-50">
                <tr>
                  {Object.keys(review.preview[0]).map((k) => (
                    <th key={k} className="px-3 py-2 text-left text-stone-600 font-semibold">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.preview.map((row, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2 text-stone-700">{v as string}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'green' | 'yellow' }) {
  const tones = {
    neutral: 'bg-stone-50 border-stone-200 text-stone-800',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 font-medium">{label}</div>
    </div>
  )
}
