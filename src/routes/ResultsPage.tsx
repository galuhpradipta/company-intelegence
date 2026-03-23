import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc.js'
import { TierBadge } from '../components/ui/TierBadge.js'
import { StatusBadge } from '../components/ui/StatusBadge.js'
import { Spinner } from '../components/ui/Spinner.js'

type BatchData = Awaited<ReturnType<typeof trpc.batch.getStatus.query>>

const PROCESSING_STEPS = [
  'Resolving company identities…',
  'Matching against databases…',
  'Scoring confidence levels…',
  'Ranking candidates…',
]

export function ResultsPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const [data, setData] = useState<BatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmingRow, setConfirmingRow] = useState<number | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [stepVisible, setStepVisible] = useState(true)

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

  // Cycle through processing step labels with fade transition
  useEffect(() => {
    if (!data || (data.status !== 'processing' && data.status !== 'pending')) return
    const interval = setInterval(() => {
      setStepVisible(false)
      setTimeout(() => {
        setStepIndex((i) => (i + 1) % PROCESSING_STEPS.length)
        setStepVisible(true)
      }, 300)
    }, 2200)
    return () => clearInterval(interval)
  }, [data?.status])

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
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Spinner label="Loading batch status…" />
          <p className="text-slate-500 text-sm font-medium">Loading batch status…</p>
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-slate-500 text-sm">Batch not found.</div>

  const pct = data.totalRows > 0 ? Math.round((data.processedRows / data.totalRows) * 100) : 0
  const isActive = data.status === 'processing' || data.status === 'pending'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-app-text tracking-tight">Batch Results</h1>
          <p className="text-sm text-app-text-dim mt-0.5">
            {data.processedRows} of {data.totalRows} rows processed
            {isActive && (
              <span className="ml-1.5 text-blue-500">· updating every 2.5s</span>
            )}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Processing Banner */}
      {isActive && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 px-5 py-4 animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <Spinner size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="text-sm font-semibold text-blue-800">Processing in progress</span>
                <span className="text-sm font-bold text-blue-700 tabular-nums">{pct}%</span>
              </div>

              {/* Progress bar with shimmer */}
              <div
                className="w-full bg-blue-100 rounded-full h-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Processing progress"
              >
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-700 ease-out shimmer-bar"
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>

              {/* Cycling step message */}
              <div className="mt-2 h-4">
                <p
                  className="text-xs text-blue-600 transition-all duration-300"
                  style={{ opacity: stepVisible ? 1 : 0, transform: stepVisible ? 'translateY(0)' : 'translateY(3px)' }}
                >
                  {PROCESSING_STEPS[stepIndex]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Confident" count={data.counts.confident} color="green" icon="✓" />
        <SummaryCard label="Suggested" count={data.counts.suggested} color="yellow" icon="?" />
        <SummaryCard label="Not Found" count={data.counts.notFound + data.counts.failed} color="red" icon="✕" />
      </div>

      {/* Items */}
      <div className="space-y-3">
        {data.items.map((item, index) => (
          <ResultRow
            key={item.rowNumber}
            item={item}
            index={index}
            confirmingRow={confirmingRow}
            onConfirm={handleConfirm}
          />
        ))}
      </div>
    </div>
  )
}

function ResultRow({
  item,
  index,
  confirmingRow,
  onConfirm,
}: {
  item: BatchData['items'][number]
  index: number
  confirmingRow: number | null
  onConfirm: (resolutionInputId: string, companyId: string, rowNumber: number) => void
}) {
  const tierBorderColor = {
    confident: 'border-l-emerald-400',
    suggested: 'border-l-amber-400',
    not_found: 'border-l-red-400',
  }

  const borderAccent = item.matchTier
    ? (tierBorderColor[item.matchTier as keyof typeof tierBorderColor] ?? 'border-l-slate-200')
    : item.status === 'processing'
    ? 'border-l-blue-400'
    : 'border-l-slate-200'

  const staggerClass = index < 6 ? `stagger-${Math.min(index + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}` : ''

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderAccent} shadow-sm p-5 space-y-4 hover:shadow-md transition-all duration-200 animate-fade-up ${staggerClass}`}
    >
      {/* Row header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 tracking-wider">ROW {item.rowNumber}</span>
            <StatusBadge status={item.status} small />
            {item.matchTier && <TierBadge tier={item.matchTier} />}
          </div>
          <h2 className="text-base font-semibold text-app-text leading-snug">
            {item.selectedCandidate?.displayName ?? item.submittedInput?.companyName ?? (
              <span className="text-slate-400 italic">Pending…</span>
            )}
          </h2>
          {item.submittedInput && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.submittedInput.domain && <MetaPill label={item.submittedInput.domain} />}
              {item.submittedInput.address && <MetaPill label={item.submittedInput.address} />}
              {item.submittedInput.city && <MetaPill label={item.submittedInput.city} />}
              {item.submittedInput.industry && <MetaPill label={item.submittedInput.industry} />}
            </div>
          )}
        </div>

        {/* Confidence score */}
        <div className="shrink-0 text-right">
          {item.confidenceScore !== null ? (
            <>
              <div className={`text-2xl font-bold tabular-nums ${
                item.confidenceScore >= 80 ? 'text-emerald-600' :
                item.confidenceScore >= 55 ? 'text-amber-600' :
                'text-red-500'
              }`}>
                {Math.round(item.confidenceScore)}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5">confidence</div>
              {/* Mini score bar */}
              <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    item.confidenceScore >= 80 ? 'bg-emerald-400' :
                    item.confidenceScore >= 55 ? 'bg-amber-400' :
                    'bg-red-400'
                  }`}
                  style={{ width: `${item.confidenceScore}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-slate-300 text-2xl font-bold">—</div>
          )}
        </div>
      </div>

      {/* Processing skeleton */}
      {item.status === 'processing' && !item.selectedCandidate && (
        <div className="space-y-2 py-1">
          <div className="h-3 bg-slate-100 rounded-full w-3/4 shimmer-bar" />
          <div className="h-3 bg-slate-100 rounded-full w-1/2 shimmer-bar" />
        </div>
      )}

      {/* Pending skeleton */}
      {item.status === 'pending' && !item.selectedCandidate && (
        <div className="space-y-2 py-1">
          <div className="h-3 bg-slate-100 rounded-full w-2/3 shimmer-bar" />
          <div className="h-3 bg-slate-100 rounded-full w-2/5 shimmer-bar" />
        </div>
      )}

      {/* Selected candidate card */}
      {item.selectedCandidate && (
        <Link
          to={`/company/${item.selectedCandidate.companyId}`}
          aria-label={`View company: ${item.selectedCandidate.displayName}`}
          className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-sm p-4 transition-all group"
        >
          <div className="min-w-0">
            <div className="font-semibold text-app-text text-sm group-hover:text-app-accent transition-colors">
              {item.selectedCandidate.displayName}
            </div>
            {item.selectedCandidate.domain && (
              <div className="text-xs text-slate-500 mt-0.5">{item.selectedCandidate.domain}</div>
            )}
            {item.selectedCandidate.sourceProviders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {item.selectedCandidate.sourceProviders.map((provider) => (
                  <span key={provider} className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {provider.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-app-accent font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            View →
          </span>
        </Link>
      )}

      {/* Suggested candidates */}
      {item.matchTier === 'suggested' && item.suggestedCandidates.length > 0 && item.resolutionInputId && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Top candidates</p>
          <div className="grid gap-2.5 md:grid-cols-3">
            {item.suggestedCandidates.map((candidate) => (
              <div
                key={candidate.companyId}
                className={`rounded-lg border p-3.5 space-y-2.5 transition-all ${
                  candidate.selected
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold text-app-text text-sm">{candidate.displayName}</div>
                  {candidate.domain && (
                    <div className="text-xs text-slate-500 mt-0.5">{candidate.domain}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <TierBadge tier={candidate.matchTier} />
                  <span className={`text-xs font-bold tabular-nums ${
                    candidate.confidenceScore >= 80 ? 'text-emerald-600' :
                    candidate.confidenceScore >= 55 ? 'text-amber-600' :
                    'text-red-500'
                  }`}>
                    {Math.round(candidate.confidenceScore)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.sourceProviders.map((provider) => (
                    <span key={provider} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {provider.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => onConfirm(item.resolutionInputId!, candidate.companyId, item.rowNumber)}
                  disabled={candidate.selected || confirmingRow === item.rowNumber}
                  aria-label={`Confirm ${candidate.displayName}`}
                  className="w-full text-xs font-semibold rounded-lg border px-3 py-1.5 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    border-blue-200 text-app-accent hover:bg-blue-50 active:bg-blue-100"
                >
                  {candidate.selected ? '✓ Selected' : confirmingRow === item.rowNumber ? 'Confirming…' : 'Confirm match'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not found */}
      {item.matchTier === 'not_found' && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 gap-4">
          <div>
            <div className="text-xs font-bold text-red-700 uppercase tracking-wider">No match found</div>
            <div className="text-xs text-red-600 mt-0.5">
              {item.errorMessage ?? 'Retry with different inputs or add more context.'}
            </div>
          </div>
          <Link
            to={toRetryHref(item.submittedInput)}
            className="text-xs font-bold text-red-700 hover:underline shrink-0"
          >
            Retry →
          </Link>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, count, color, icon }: { label: string; count: number; color: 'green' | 'yellow' | 'red'; icon: string }) {
  const styles = {
    green:  { card: 'bg-emerald-50 border-emerald-200', num: 'text-emerald-700', sub: 'text-emerald-600', icon: 'bg-emerald-100 text-emerald-600' },
    yellow: { card: 'bg-amber-50 border-amber-200',     num: 'text-amber-700',   sub: 'text-amber-600',   icon: 'bg-amber-100 text-amber-600' },
    red:    { card: 'bg-red-50 border-red-200',          num: 'text-red-700',     sub: 'text-red-600',     icon: 'bg-red-100 text-red-600' },
  }
  const s = styles[color]
  return (
    <div className={`border rounded-xl p-4 ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-3xl font-bold tabular-nums ${s.num}`}>{count}</div>
          <div className={`text-xs font-medium mt-1 ${s.sub}`}>{label}</div>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${s.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function MetaPill({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      {label}
    </span>
  )
}

function toRetryHref(submittedInput: BatchData['items'][number]['submittedInput']) {
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
