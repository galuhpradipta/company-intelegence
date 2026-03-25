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
  description: 'Merclex is a company operating through merclex.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, collections pressure, cash-flow sensitivity, operational dependency, and legal/regulatory risk.',
})

let defaultViewerCompanyProfilePromise: Promise<ViewerCompanyProfileInput> | null = null

const inputClass = 'w-full rounded-xl border border-app-border bg-app-surface px-3.5 py-2.5 text-sm text-app-text transition-[border-color,box-shadow,background-color] placeholder:text-app-text-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus:border-transparent disabled:cursor-not-allowed disabled:bg-app-bg disabled:text-app-text-dim'
const secondaryButtonClass = 'inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3.5 py-2.5 text-sm font-semibold text-app-accent transition-colors hover:bg-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60'
const primaryButtonClass = 'inline-flex items-center gap-2 rounded-xl bg-app-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-app-accent-dim disabled:cursor-not-allowed disabled:opacity-60'
const tertiaryButtonClass = 'rounded-xl border border-app-border bg-app-surface px-3.5 py-2.5 text-sm font-semibold text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60'

export function ViewerCompanyContextCard({ mode = 'input', onSaveProfile }: Props) {
  const [form, setForm] = useState<ViewerCompanyProfileInput>(FALLBACK_PROFILE)
  const [isExpanded, setIsExpanded] = useState(mode === 'detail')
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
    ? 'Update the saved browser profile here. Saving immediately refreshes the open company with your current finance and AR context.'
    : 'Save your company context in this browser so company detail pages can explain pulled news from your finance and AR perspective.'
  const badgeLabel = hasSavedLocally ? 'Saved in browser' : 'Default seed profile'
  const saveLabel = mode === 'detail' ? 'Save & Refresh News' : 'Save Locally'
  const canSave = !loadingProfile && !generatingDescription && !savingProfile
  const actionSummary = mode === 'detail'
    ? 'Refresh rewrites the explanation for the open company using this browser profile.'
    : 'This profile is ready the next time you open a company detail page.'
  const summaryCompanyName = form.name.trim() || 'Set your company context'
  const summaryDomain = form.domain.trim() || 'No domain saved yet'
  const accordionId = `${fieldId}-panel`

  return (
    <section
      aria-label="My Company Context"
      className="relative mb-6 overflow-hidden rounded-[28px] border border-app-border bg-app-surface p-5 shadow-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-app-accent-soft via-app-surface to-app-bg"
      />

      <div className="relative">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={accordionId}
          onClick={() => setIsExpanded((current) => !current)}
          className="group flex w-full items-start justify-between gap-4 rounded-[24px] border border-app-border-subtle bg-app-bg/75 px-4 py-4 text-left transition-colors hover:border-app-border hover:bg-app-surface-hover"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-accent">
                Personalized News Prompting
              </p>
              <span className="rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-accent">
                {badgeLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <h2 className="font-display text-[1.45rem] leading-none font-medium text-app-text tracking-tight">
                  My Company Context
                </h2>
                <p className="mt-1 text-sm text-app-text-muted">
                  {headerCopy}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_auto]">
              <SummaryTile label="Company" value={summaryCompanyName} subtle={summaryDomain} />
              <SummaryTile label="Role" value={VIEWER_COMPANY_ROLE_FUNCTION} subtle="Used to personalize explanation tone" />
              <SummaryTile
                label="Stored"
                value={hasSavedLocally ? 'Browser-local' : 'Default seed'}
                subtle={isExpanded ? 'Hide editor' : 'Open editor'}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 pt-1">
            <span className="hidden rounded-full border border-app-border-subtle bg-app-surface px-3 py-1 text-xs font-medium text-app-text-muted sm:inline-flex">
              {isExpanded ? 'Collapse' : 'Configure'}
            </span>
            <span
              aria-hidden="true"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-accent transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </button>

        {isExpanded && (
          <div id={accordionId} className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile
                label="Stored"
                title={hasSavedLocally ? 'Local browser profile' : 'Default seed profile'}
                body="Nothing here syncs across devices yet. This browser is the only source of truth in the POC."
              />
              <InfoTile
                label="Prompt focus"
                title="Finance and AR context"
                body="The summary steers payment timing, collections exposure, cash-flow impact, and operational risk analysis."
              />
              <InfoTile
                label="What stays global"
                title="Matching and ranking"
                body="Company matching, numeric relevance, and ordering still come from the existing shared scoring pipeline."
              />
            </div>

            <div className="mt-4 rounded-[24px] border border-app-border-subtle bg-app-bg/70 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${fieldId}-name`} className="mb-1.5 block text-sm font-medium text-app-text">
                    Company Name <span aria-hidden="true" className="text-app-red">*</span>
                  </label>
                  <input
                    id={`${fieldId}-name`}
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Merclex"
                    className={inputClass}
                    disabled={loadingProfile || savingProfile}
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-domain`} className="mb-1.5 block text-sm font-medium text-app-text">
                    Domain <span aria-hidden="true" className="text-app-red">*</span>
                  </label>
                  <input
                    id={`${fieldId}-domain`}
                    type="text"
                    value={form.domain}
                    onChange={(e) => setField('domain', e.target.value)}
                    placeholder="e.g. merclex.com"
                    className={inputClass}
                    disabled={loadingProfile || savingProfile}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor={`${fieldId}-role`} className="mb-1.5 block text-sm font-medium text-app-text">
                  Role / Function
                </label>
                <input
                  id={`${fieldId}-role`}
                  type="text"
                  value={form.roleFunction}
                  readOnly
                  className={`${inputClass} bg-app-bg text-app-text-dim`}
                />
              </div>

              <div className="mt-3">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <label htmlFor={`${fieldId}-description`} className="block text-sm font-medium text-app-text">
                    Company Summary
                  </label>
                  <p className="text-xs text-app-text-dim">
                    Stored only in this browser for now.
                  </p>
                </div>
                <textarea
                  id={`${fieldId}-description`}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Generate or edit the summary used in news prompting."
                  rows={4}
                  className={`${inputClass} mt-1.5 resize-none`}
                  disabled={loadingProfile || savingProfile}
                />
                <p className="mt-2 text-xs leading-relaxed text-app-text-dim">
                  Keep this short and practical. Focus on customers, payment behavior, collections risk, cash flow, and any operational constraints the prompt should care about.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleGenerateDescription()}
                  disabled={loadingProfile || generatingDescription || savingProfile}
                  className={secondaryButtonClass}
                >
                  {generatingDescription ? <Spinner size="sm" /> : null}
                  {generatingDescription ? 'Generating…' : 'Generate with AI'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  disabled={!canSave}
                  className={primaryButtonClass}
                >
                  {savingProfile ? <Spinner size="sm" /> : null}
                  {savingProfile ? 'Saving…' : saveLabel}
                </button>
                <button
                  type="button"
                  onClick={handleResetProfile}
                  disabled={loadingProfile || generatingDescription || savingProfile}
                  className={tertiaryButtonClass}
                >
                  Reset
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-app-text-dim">
                {actionSummary}
              </p>

              {statusMessage && (
                <div role="status" className="mt-4 rounded-xl border border-app-accent-light bg-app-accent-soft px-3.5 py-3 text-sm text-app-accent">
                  {statusMessage}
                </div>
              )}
              {errorMessage && (
                <div role="alert" className="mt-4 rounded-xl border border-app-red bg-app-red-soft px-3.5 py-3 text-sm text-app-red">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SummaryTile({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle: string
}) {
  return (
    <div className="rounded-2xl border border-app-border-subtle bg-app-surface px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-dim">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-app-text">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-app-text-dim">
        {subtle}
      </div>
    </div>
  )
}

function InfoTile({
  label,
  title,
  body,
}: {
  label: string
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-app-border-subtle bg-app-bg/75 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-dim">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-app-text">
        {title}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
        {body}
      </p>
    </div>
  )
}
