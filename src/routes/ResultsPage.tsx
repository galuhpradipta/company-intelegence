import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc.js'

export function ResultsPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof trpc.batch.getStatus.query>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!batchId) return
    let stopped = false

    async function poll() {
      try {
        const result = await trpc.batch.getStatus.query(batchId!)
        setData(result)
        setLoading(false)
        if (result.status === 'completed' || result.status === 'failed') {
          stopped = true
        }
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }

    poll()
    const interval = setInterval(() => {
      if (!stopped) poll()
      else clearInterval(interval)
    }, 2500)
    return () => clearInterval(interval)
  }, [batchId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading batch status…</p>
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-gray-500 text-sm">Batch not found.</div>

  const pct = data.totalRows > 0 ? Math.round((data.processedRows / data.totalRows) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Batch Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.processedRows} / {data.totalRows} processed
            {data.status !== 'completed' && ' — polling every 2.5s'}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Progress bar */}
      {data.status !== 'completed' && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Confident" count={data.counts.confident} color="green" />
        <SummaryCard label="Suggested" count={data.counts.suggested} color="yellow" />
        <SummaryCard label="Not Found" count={data.counts.notFound + data.counts.failed} color="red" />
      </div>

      {/* Item list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Row</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((item) => (
              <tr key={item.rowNumber} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{item.rowNumber}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} small />
                </td>
                <td className="px-4 py-3">
                  {item.matchTier && <TierBadge tier={item.matchTier} />}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item.confidenceScore !== null ? `${Math.round(item.confidenceScore)}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  {item.companyId ? (
                    <Link
                      to={`/company/${item.companyId}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View
                    </Link>
                  ) : item.errorMessage ? (
                    <span className="text-xs text-red-500">{item.errorMessage.slice(0, 40)}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: 'green' | 'yellow' | 'red' }) {
  const styles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={`border rounded-xl p-4 ${styles[color]}`}>
      <div className="text-3xl font-bold">{count}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    confident: 'bg-green-100 text-green-700',
    suggested: 'bg-yellow-100 text-yellow-700',
    not_found: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = { confident: 'Confident', suggested: 'Suggested', not_found: 'Not Found' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[tier] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[tier] ?? tier}
    </span>
  )
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  const cls = `${small ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'} rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`
  return <span className={cls}>{status}</span>
}
