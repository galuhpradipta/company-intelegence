import { useEffect, useRef, useState } from 'react'
import { trpc } from '../../lib/trpc.js'
import { TierBadge } from '../../components/ui/TierBadge.js'
import { Spinner } from '../../components/ui/Spinner.js'

interface Props {
  onResolved: (companyId: string) => void
  initialValues?: Partial<FormState>
}

interface FormState {
  companyName: string
  domain: string
  address: string
  city: string
  state: string
  country: string
  industry: string
}

interface ResolutionCandidate {
  companyId: string
  displayName: string
  domain?: string
  confidenceScore: number
  matchTier: string
  sourceProviders: string[]
}

const EMPTY_FORM: FormState = {
  companyName: '',
  domain: '',
  address: '',
  city: '',
  state: '',
  country: 'US',
  industry: '',
}

const AUTO_OPEN_DELAY_MS = 1500

function createInitialForm(initialValues?: Partial<FormState>): FormState {
  return {
    ...EMPTY_FORM,
    ...initialValues,
    country: initialValues?.country || 'US',
  }
}

const inputClass = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-app-text bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus:border-transparent transition-colors placeholder:text-stone-400'

export function SingleCompanyForm({ onResolved, initialValues }: Props) {
  const [form, setForm] = useState<FormState>(() => createInitialForm(initialValues))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<ResolutionCandidate[] | null>(null)
  const [matchedCandidate, setMatchedCandidate] = useState<ResolutionCandidate | null>(null)
  const [resolutionInputId, setResolutionInputId] = useState<string | null>(null)
  const autoOpenTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    clearAutoOpenTimer()
  }, [])

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    clearAutoOpenTimer()
    setMatchedCandidate(null)
    setCandidates(null)
    setError(null)
  }

  function clearAutoOpenTimer() {
    if (autoOpenTimerRef.current !== null) {
      window.clearTimeout(autoOpenTimerRef.current)
      autoOpenTimerRef.current = null
    }
  }

  function showMatchedCandidate(candidate: ResolutionCandidate) {
    clearAutoOpenTimer()
    setMatchedCandidate(candidate)
    autoOpenTimerRef.current = window.setTimeout(() => {
      autoOpenTimerRef.current = null
      onResolved(candidate.companyId)
    }, AUTO_OPEN_DELAY_MS)
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault()
    if (!form.companyName.trim()) return
    setLoading(true)
    clearAutoOpenTimer()
    setError(null)
    setMatchedCandidate(null)
    setCandidates(null)
    try {
      const result = await trpc.company.resolve.mutate({
        companyName: form.companyName,
        domain: form.domain || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        industry: form.industry || undefined,
      })
      setResolutionInputId(result.resolutionInputId)
      if (result.candidates.length === 0) {
        setError('No matches found. Try providing more context.')
        return
      }
      if (result.topTier === 'confident') {
        showMatchedCandidate(result.candidates[0])
        return
      }
      setCandidates(result.candidates.slice(0, 3))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(companyId: string) {
    if (!resolutionInputId) return
    try {
      clearAutoOpenTimer()
      await trpc.company.confirmMatch.mutate({ resolutionInputId, companyId })
      onResolved(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    }
  }

  function handleViewMatchedCompany() {
    if (!matchedCandidate) return
    clearAutoOpenTimer()
    onResolved(matchedCandidate.companyId)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
      <form onSubmit={handleResolve} className="space-y-4">
        <div>
          <label htmlFor="field-companyName" className="block text-sm font-medium text-stone-700 mb-1">
            Company Name <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="field-companyName"
            type="text"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="e.g. Apple Inc."
            required
            aria-required="true"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-domain" className="block text-sm font-medium text-stone-700 mb-1">Domain</label>
            <input
              id="field-domain"
              type="text"
              value={form.domain}
              onChange={(e) => set('domain', e.target.value)}
              placeholder="e.g. apple.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="field-industry" className="block text-sm font-medium text-stone-700 mb-1">Industry</label>
            <input
              id="field-industry"
              type="text"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="e.g. Technology"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="field-address" className="block text-sm font-medium text-stone-700 mb-1">Address</label>
          <input
            id="field-address"
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="1 Apple Park Way"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="field-city" className="block text-sm font-medium text-stone-700 mb-1">City</label>
            <input
              id="field-city"
              type="text"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="New York"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="field-state" className="block text-sm font-medium text-stone-700 mb-1">State</label>
            <input
              id="field-state"
              type="text"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              placeholder="NY"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="field-country" className="block text-sm font-medium text-stone-700 mb-1">Country</label>
            <input
              id="field-country"
              type="text"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="US"
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !form.companyName.trim()}
          className="w-full bg-app-accent hover:bg-app-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" label="Resolving company…" />
              Resolving…
            </span>
          ) : 'Resolve Company'}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {matchedCandidate && (
        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/70 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                Confident Match Found
              </p>
              <div className="mt-1 font-medium text-app-text text-base">{matchedCandidate.displayName}</div>
              {matchedCandidate.domain && (
                <div className="text-sm text-stone-500 mt-0.5">{matchedCandidate.domain}</div>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                <TierBadge tier={matchedCandidate.matchTier} />
                <span className="text-xs text-stone-500">{matchedCandidate.confidenceScore}% confidence</span>
                <span className="text-xs text-stone-500">via {matchedCandidate.sourceProviders.join(', ')}</span>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                Company detail opens automatically in a moment, or you can continue now.
              </p>
            </div>
            <button
              type="button"
              onClick={handleViewMatchedCompany}
              className="shrink-0 rounded-lg bg-app-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-app-accent-dim"
            >
              View Company Details
            </button>
          </div>
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">
            Suggested matches — confirm the correct company:
          </h3>
          <div className="space-y-2">
            {candidates.map((c) => (
              <div key={c.companyId} className="flex items-center justify-between p-3 border border-stone-200 rounded-lg hover:border-teal-300 transition-colors">
                <div>
                  <div className="font-medium text-app-text text-sm">{c.displayName}</div>
                  {c.domain && <div className="text-xs text-stone-500 mt-0.5">{c.domain}</div>}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <TierBadge tier={c.matchTier} />
                    <span className="text-xs text-stone-500">{c.confidenceScore}% confidence</span>
                    <span className="text-xs text-stone-500">via {c.sourceProviders.join(', ')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleConfirm(c.companyId)}
                  aria-label={`Confirm ${c.displayName}`}
                  className="text-sm text-app-accent hover:text-app-accent-dim font-semibold px-3 py-1.5 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors shrink-0 ml-3"
                >
                  Confirm
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
