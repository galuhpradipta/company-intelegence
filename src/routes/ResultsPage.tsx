import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc.js'

export function ResultsPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof trpc.batch.getStatus.query>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmingRow, setConfirmingRow] = useState<number | null>(null)

  useEffect(() => {
    if (!batchId) return
    let stopped = false

    async function loadStatus(id: string) {
      const result = await trpc.batch.getStatus.query(id)
      setData(result)
      setLoading(false)
      return result
    }

    async function poll() {
      try {
        const result = await loadStatus(batchId!)
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

  async function handleConfirm(resolutionInputId: string, companyId: string, rowNumber: number) {
    setConfirmingRow(rowNumber)
    try {
      await trpc.company.confirmMatch.mutate({ resolutionInputId, companyId })
      if (batchId) {
        const result = await trpc.batch.getStatus.query(batchId)
        setData(result)
      }
    } finally {
      setConfirmingRow(null)
    }
  }

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

      <div className="space-y-4">
        {data.items.map((item) => (
          <div key={item.rowNumber} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-400">ROW {item.rowNumber}</span>
                  <StatusBadge status={item.status} small />
                  {item.matchTier && <TierBadge tier={item.matchTier} />}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {item.selectedCandidate?.displayName ?? item.submittedInput?.companyName ?? 'Pending row'}
                </h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.submittedInput?.domain && <MetaPill label={item.submittedInput.domain} />}
                  {item.submittedInput?.address && <MetaPill label={item.submittedInput.address} />}
                  {item.submittedInput?.city && <MetaPill label={item.submittedInput.city} />}
                  {item.submittedInput?.industry && <MetaPill label={item.submittedInput.industry} />}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {item.confidenceScore !== null ? `${Math.round(item.confidenceScore)}%` : '—'}
                </div>
                <div className="text-xs text-gray-400">confidence</div>
              </div>
            </div>

            {item.selectedCandidate && (
              <Link
                to={`/company/${item.selectedCandidate.companyId}`}
                className="block rounded-xl border border-gray-200 hover:border-blue-300 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{item.selectedCandidate.displayName}</div>
                    {item.selectedCandidate.domain && (
                      <div className="text-sm text-gray-500 mt-1">{item.selectedCandidate.domain}</div>
                    )}
                    {item.selectedCandidate.sourceProviders.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.selectedCandidate.sourceProviders.map((provider) => (
                          <span key={provider} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {provider.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-blue-600 font-medium">View company</span>
                </div>
              </Link>
            )}

            {item.matchTier === 'suggested' && item.suggestedCandidates.length > 0 && item.resolutionInputId && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Top 3 candidates</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {item.suggestedCandidates.map((candidate) => (
                    <div key={candidate.companyId} className="rounded-xl border border-gray-200 p-4 space-y-3">
                      <div>
                        <div className="font-medium text-gray-900">{candidate.displayName}</div>
                        {candidate.domain && (
                          <div className="text-xs text-gray-500 mt-1">{candidate.domain}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <TierBadge tier={candidate.matchTier} />
                        <span className="text-xs text-gray-400">{Math.round(candidate.confidenceScore)}%</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.sourceProviders.map((provider) => (
                          <span key={provider} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {provider.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => handleConfirm(item.resolutionInputId!, candidate.companyId, item.rowNumber)}
                        disabled={candidate.selected || confirmingRow === item.rowNumber}
                        className="w-full text-sm font-medium rounded-lg border border-blue-200 px-3 py-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {candidate.selected ? 'Selected' : confirmingRow === item.rowNumber ? 'Confirming…' : 'Confirm'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.matchTier === 'not_found' && (
              <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-red-700">No confident company match found.</div>
                  <div className="text-xs text-red-500 mt-1">
                    {item.errorMessage ?? 'Retry with different inputs or add more context.'}
                  </div>
                </div>
                <Link
                  to={toRetryHref(item.submittedInput)}
                  className="text-sm font-medium text-red-700 hover:underline"
                >
                  Retry with different inputs
                </Link>
              </div>
            )}
          </div>
        ))}
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

function MetaPill({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      {label}
    </span>
  )
}

function toRetryHref(submittedInput: Awaited<ReturnType<typeof trpc.batch.getStatus.query>>['items'][number]['submittedInput']) {
  const params = new URLSearchParams()
  params.set('tab', 'single')

  if (submittedInput?.companyName) params.set('companyName', submittedInput.companyName)
  if (submittedInput?.domain) params.set('domain', submittedInput.domain)
  if (submittedInput?.address) params.set('address', submittedInput.address)
  if (submittedInput?.city) params.set('city', submittedInput.city)
  if (submittedInput?.state) params.set('state', submittedInput.state)
  if (submittedInput?.country) params.set('country', submittedInput.country)
  if (submittedInput?.industry) params.set('industry', submittedInput.industry)

  return `/?${params.toString()}`
}
