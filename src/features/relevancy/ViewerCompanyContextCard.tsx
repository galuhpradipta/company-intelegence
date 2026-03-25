import { useEffect, useId, useRef, useState } from 'react'
import { Spinner } from '../../components/ui/Spinner.js'
import { trpc } from '../../lib/trpc.js'
import {
  VIEWER_COMPANY_ROLE_FUNCTION,
  clearStoredViewerCompanyProfile,
  createViewerCompanyProfileInput,
  loadStoredViewerCompanyProfile,
  saveViewerCompanyProfile,
  type ViewerCompanyProfile,
  type ViewerCompanyProfileInput,
} from './viewerCompanyProfileBrowser.js'

interface Props {
  mode?: 'input' | 'detail'
  onSaveProfile?: (profile: ViewerCompanyProfile) => Promise<void> | void
}

const FALLBACK_PROFILE = createViewerCompanyProfileInput({
  name: 'Merclex',
  domain: 'merclex.example',
  roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
  description: 'Merclex uses merclex.example and needs finance and AR visibility into customer health, payment timing, collections exposure, and cash-flow risk.',
})

let defaultViewerCompanyProfilePromise: Promise<ViewerCompanyProfileInput> | null = null

const inputClass = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-app-text bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus:border-transparent transition-colors placeholder:text-stone-400'

export function ViewerCompanyContextCard({ mode = 'input', onSaveProfile }: Props) {
  const [form, setForm] = useState<ViewerCompanyProfileInput>(FALLBACK_PROFILE)
  const [hasSavedLocally, setHasSavedLocally] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const defaultProfileRef = useRef<ViewerCompanyProfileInput>(FALLBACK_PROFILE)
  const fieldId = useId()

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const storedProfile = loadStoredViewerCompanyProfile()
      if (storedProfile) {
        if (!cancelled) {
          setForm(createViewerCompanyProfileInput(storedProfile))
          setHasSavedLocally(true)
          setLoadingProfile(false)
        }
        return
      }

      try {
        defaultViewerCompanyProfilePromise ??= trpc.relevancy.viewerCompanyProfile.query()
          .then((profile) => createViewerCompanyProfileInput(profile))
          .catch((err) => {
            defaultViewerCompanyProfilePromise = null
            throw err
          })

        const defaultProfile = await defaultViewerCompanyProfilePromise
        if (cancelled) return

        defaultProfileRef.current = defaultProfile
        setForm(defaultProfile)
      } catch (err) {
        if (cancelled) return
        console.warn('Failed to load default viewer company profile:', err)
        setErrorMessage('Using the fallback profile until the default company context is available.')
      } finally {
        if (!cancelled) {
          setLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  function setField(key: keyof ViewerCompanyProfileInput, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setStatusMessage(null)
    setErrorMessage(null)
  }

  async function handleGenerateDescription() {
    const name = form.name.trim()
    const domain = form.domain.trim()

    if (!name || !domain) {
      setErrorMessage('Enter company name and domain before generating the summary.')
      return
    }

    setGeneratingDescription(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const result = await trpc.relevancy.generateViewerCompanyDescription.mutate({
        name,
        domain,
        roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
      })

      setForm((current) => ({
        ...current,
        name,
        domain,
        roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
        description: result.description,
      }))
      setStatusMessage('Generated a company summary. Review it, then save it locally.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate the company summary.')
    } finally {
      setGeneratingDescription(false)
    }
  }

  async function handleSaveProfile() {
    const name = form.name.trim()
    const domain = form.domain.trim()

    if (!name || !domain) {
      setErrorMessage('Company name and domain are required before saving locally.')
      return
    }

    setSavingProfile(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      let description = form.description.trim()
      if (!description) {
        const generated = await trpc.relevancy.generateViewerCompanyDescription.mutate({
          name,
          domain,
          roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
        })
        description = generated.description
      }

      const savedProfile = saveViewerCompanyProfile({
        name,
        domain,
        roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
        description,
      })

      setForm(createViewerCompanyProfileInput(savedProfile))
      setHasSavedLocally(true)

      if (onSaveProfile) {
        setStatusMessage('Saved in this browser. Refreshing the current company now…')
        await onSaveProfile(savedProfile)
        setStatusMessage('Saved in this browser and applied to the current company.')
      } else {
        setStatusMessage('Saved in this browser. The next company detail view will use this profile.')
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save the company profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  function handleResetProfile() {
    clearStoredViewerCompanyProfile()
    setHasSavedLocally(false)
    setForm(defaultProfileRef.current)
    setStatusMessage('Reset this browser to the default company profile.')
    setErrorMessage(null)
  }

  const headerCopy = mode === 'detail'
    ? 'Update the browser-local company context here and the open company will refresh immediately with the new prompting profile.'
    : 'Save your company context in this browser so future company detail pages can personalize pulled-news explanations.'
  const badgeLabel = hasSavedLocally ? 'Saved in browser' : 'Default seed profile'
  const saveLabel = mode === 'detail' ? 'Save & Refresh News' : 'Save Locally'
  const canSave = !loadingProfile && !generatingDescription && !savingProfile

  return (
    <section
      aria-label="My Company Context"
      className="mb-6 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-stone-50 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            My Company Context
          </p>
          <h2 className="mt-1 font-display text-lg font-medium text-app-text tracking-tight">
            Personalized News Prompting
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600 max-w-3xl">
            {headerCopy}
          </p>
        </div>
        <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-xs font-semibold text-teal-700">
          {badgeLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-2xl border border-white/70 bg-white/85 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium text-stone-700 mb-1">
                Company Name
              </label>
              <input
                id={`${fieldId}-name`}
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Merclex"
                className={inputClass}
                disabled={loadingProfile || savingProfile}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-domain`} className="block text-sm font-medium text-stone-700 mb-1">
                Domain
              </label>
              <input
                id={`${fieldId}-domain`}
                type="text"
                value={form.domain}
                onChange={(e) => setField('domain', e.target.value)}
                placeholder="e.g. merclex.com"
                className={inputClass}
                disabled={loadingProfile || savingProfile}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${fieldId}-role`} className="block text-sm font-medium text-stone-700 mb-1">
              Role / Function
            </label>
            <input
              id={`${fieldId}-role`}
              type="text"
              value={form.roleFunction}
              readOnly
              className={`${inputClass} bg-stone-50 text-stone-500`}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-description`} className="block text-sm font-medium text-stone-700 mb-1">
              Company Summary
            </label>
            <textarea
              id={`${fieldId}-description`}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Generate or edit the summary used in news prompting."
              rows={4}
              className={`${inputClass} resize-none`}
              disabled={loadingProfile || savingProfile}
            />
            <p className="mt-1 text-xs text-stone-400">
              This summary is stored only in this browser for now.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateDescription()}
              disabled={loadingProfile || generatingDescription || savingProfile}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingDescription ? <Spinner size="sm" /> : null}
              {generatingDescription ? 'Generating…' : 'Generate with AI'}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-app-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-app-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? <Spinner size="sm" /> : null}
              {savingProfile ? 'Saving…' : saveLabel}
            </button>
            <button
              type="button"
              onClick={handleResetProfile}
              disabled={loadingProfile || generatingDescription || savingProfile}
              className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </div>

          {statusMessage && (
            <div role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
            What This Affects
          </div>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-600">
            <p>
              Saved values shape how pulled third-party news is explained for your company from a finance and AR perspective.
            </p>
            <p>
              The researched company match, numeric relevance score, and article ranking still come from the existing pipeline.
            </p>
            <p>
              Description edits help the prompt focus on payment timing, collections exposure, customer health, cash-flow impact, and operational risk.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
