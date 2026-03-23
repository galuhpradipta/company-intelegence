import { useState } from 'react'
import { trpc } from '../../lib/trpc.js'

interface Props {
  onResolved: (companyId: string) => void
}

export function SingleCompanyForm({ onResolved }: Props) {
  const [form, setForm] = useState({
    companyName: '',
    domain: '',
    city: '',
    state: '',
    country: 'US',
    industry: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Array<{
    companyId: string
    displayName: string
    domain?: string
    confidenceScore: number
    matchTier: string
    sourceProviders: string[]
  }> | null>(null)
  const [resolutionInputId, setResolutionInputId] = useState<string | null>(null)

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setCandidates(null)
    setError(null)
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault()
    if (!form.companyName.trim()) return
    setLoading(true)
    setError(null)
    setCandidates(null)
    try {
      const result = await trpc.company.resolve.mutate({
        companyName: form.companyName,
        domain: form.domain || undefined,
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
        onResolved(result.candidates[0].companyId)
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
      await trpc.company.confirmMatch.mutate({ resolutionInputId, companyId })
      onResolved(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <form onSubmit={handleResolve} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="e.g. Apple Inc."
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => set('domain', e.target.value)}
              placeholder="e.g. apple.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="e.g. Technology"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="New York"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              placeholder="NY"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="US"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !form.companyName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Resolving…
            </span>
          ) : 'Resolve Company'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Suggested matches — confirm the correct company:
          </h3>
          <div className="space-y-2">
            {candidates.map((c) => (
              <div key={c.companyId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.displayName}</div>
                  {c.domain && <div className="text-xs text-gray-400">{c.domain}</div>}
                  <div className="flex gap-2 mt-1">
                    <TierBadge tier={c.matchTier} />
                    <span className="text-xs text-gray-400">{c.confidenceScore}% confidence</span>
                    <span className="text-xs text-gray-400">via {c.sourceProviders.join(', ')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleConfirm(c.companyId)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
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

function TierBadge({ tier }: { tier: string }) {
  const styles = {
    confident: 'bg-green-100 text-green-700',
    suggested: 'bg-yellow-100 text-yellow-700',
    not_found: 'bg-red-100 text-red-700',
  }
  const labels = { confident: 'Confident', suggested: 'Suggested', not_found: 'Not Found' }
  const cls = styles[tier as keyof typeof styles] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {labels[tier as keyof typeof labels] ?? tier}
    </span>
  )
}
