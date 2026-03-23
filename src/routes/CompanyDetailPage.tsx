import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc.js'
import { TierBadge } from '../components/ui/TierBadge.js'
import { Spinner } from '../components/ui/Spinner.js'

type CompanyData = Awaited<ReturnType<typeof trpc.company.getById.query>>
type NewsData = Awaited<ReturnType<typeof trpc.news.listByCompany.query>>

const NEWS_STEPS = [
  'Fetching recent articles…',
  'Analyzing relevance…',
  'Scoring content…',
  'Ranking results…',
]

export function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [newsData, setNewsData] = useState<NewsData | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingNews, setFetchingNews] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newsStepIndex, setNewsStepIndex] = useState(0)
  const [newsStepVisible, setNewsStepVisible] = useState(true)

  // Cycle through news fetching step labels
  useEffect(() => {
    if (!fetchingNews) return
    const interval = setInterval(() => {
      setNewsStepVisible(false)
      setTimeout(() => {
        setNewsStepIndex((i) => (i + 1) % NEWS_STEPS.length)
        setNewsStepVisible(true)
      }, 300)
    }, 2000)
    return () => clearInterval(interval)
  }, [fetchingNews])

  async function loadNews(id: string, all: boolean) {
    try {
      const n = await trpc.news.listByCompany.query({ companyId: id, showAll: all })
      setNewsData(n)
    } catch (err) {
      console.warn('Failed to load news:', err)
    }
  }

  async function triggerNewsFetch(id: string) {
    setFetchingNews(true)
    try {
      await trpc.news.fetchForCompany.mutate(id)
    } catch (err) {
      console.warn('News fetch failed:', err)
      return
    }
    try {
      await trpc.relevancy.scoreForCompany.mutate(id)
    } catch (err) {
      console.warn('Relevancy scoring failed:', err)
    }
    try {
      await loadNews(id, showAll)
    } catch (err) {
      console.warn('News reload failed:', err)
    } finally {
      setFetchingNews(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    async function loadCompany(id: string) {
      setLoading(true)
      try {
        const c = await trpc.company.getById.query(id)
        setCompany(c)
        if (c.matchTier === 'confident') {
          triggerNewsFetch(id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    loadCompany(companyId)
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId) return
    loadNews(companyId, showAll)
  }, [companyId, showAll])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Spinner label="Loading company details…" />
          <p className="text-slate-500 text-sm font-medium">Loading company details…</p>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4 text-sm">{error ?? 'Company not found'}</p>
        <Link to="/" className="text-app-accent hover:underline text-sm">← Back to search</Link>
      </div>
    )
  }

  const articles = newsData?.articles ?? []
  const uniqueProviders = [...new Set(company.sourceRecords.map((s) => s.provider))]
  const confidenceColor =
    company.confidenceScore >= 80 ? 'text-emerald-600' :
    company.confidenceScore >= 55 ? 'text-amber-600' :
    'text-red-500'

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1.5 font-medium">
        ← Back to results
      </Link>

      {/* Company profile card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
        {/* Tier accent bar */}
        <div className={`h-1 w-full ${
          company.matchTier === 'confident' ? 'bg-emerald-400' :
          company.matchTier === 'suggested' ? 'bg-amber-400' :
          'bg-slate-300'
        }`} />

        <div className="p-6">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h1 className="font-display text-xl font-bold text-app-text tracking-tight">{company.displayName}</h1>
                <TierBadge tier={company.matchTier} />
              </div>
              {company.legalName && company.legalName !== company.displayName && (
                <p className="text-sm text-slate-500">Legal: {company.legalName}</p>
              )}
            </div>

            {/* Confidence score */}
            <div className="text-right shrink-0">
              <div className={`text-3xl font-bold tabular-nums ${confidenceColor}`}>
                {Math.round(company.confidenceScore)}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5">confidence</div>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    company.confidenceScore >= 80 ? 'bg-emerald-400' :
                    company.confidenceScore >= 55 ? 'bg-amber-400' :
                    'bg-red-400'
                  }`}
                  style={{ width: `${company.confidenceScore}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {company.domain && (
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Domain</div>
                <a href={`https://${company.domain}`} target="_blank" rel="noopener" className="text-app-accent hover:underline font-medium text-sm">
                  {company.domain}
                </a>
              </div>
            )}
            {company.industry && (
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Industry</div>
                <div className="text-slate-700 font-medium text-sm">{company.industry}</div>
              </div>
            )}
            {company.employeeCount && (
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Employees</div>
                <div className="text-slate-700 font-medium text-sm">{company.employeeCount.toLocaleString()}</div>
              </div>
            )}
            {(company.hqCity || company.hqCountry) && (
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">HQ</div>
                <div className="text-slate-700 font-medium text-sm">
                  {[company.hqCity, company.hqState, company.hqCountry].filter(Boolean).join(', ')}
                </div>
              </div>
            )}
          </div>

          {uniqueProviders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Data sources</div>
              <div className="flex gap-2 flex-wrap">
                {uniqueProviders.map((p) => (
                  <span key={p} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                    {p.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* News section */}
      <div className="animate-fade-up stagger-2">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-app-text tracking-tight">News</h2>
            {articles.length > 0 && !fetchingNews && (
              <p className="text-xs text-slate-400 mt-0.5">{articles.length} article{articles.length !== 1 ? 's' : ''} found</p>
            )}
          </div>
          {articles.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-500 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded accent-app-accent"
              />
              Show low-relevance
            </label>
          )}
        </div>

        {/* News fetching progress banner */}
        {fetchingNews && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 mb-4 animate-fade-up">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <Spinner size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-blue-800 mb-1">Fetching &amp; scoring news</div>
                <div className="h-4">
                  <p
                    className="text-xs text-blue-600 transition-all duration-300"
                    style={{ opacity: newsStepVisible ? 1 : 0, transform: newsStepVisible ? 'translateY(0)' : 'translateY(3px)' }}
                  >
                    {NEWS_STEPS[newsStepIndex]}
                  </p>
                </div>
                {/* Indeterminate progress bar */}
                <div className="mt-2 w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-blue-500 rounded-full shimmer-bar" style={{ width: '40%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {articles.length === 0 && !fetchingNews && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="text-slate-300 text-3xl mb-3">📰</div>
            <p className="text-slate-500 text-sm font-medium">No news articles found.</p>
            {company.matchTier !== 'confident' && (
              <p className="text-xs text-slate-400 mt-1">News is fetched automatically for confident matches.</p>
            )}
            <button
              onClick={() => triggerNewsFetch(companyId!)}
              className="mt-4 text-sm font-semibold text-app-accent hover:underline transition-colors"
            >
              Fetch news manually →
            </button>
          </div>
        )}

        <div className="space-y-3">
          {articles.map((article, index) => (
            <ArticleCard
              key={article.articleId}
              article={article}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ArticleCard({
  article,
  index,
}: {
  article: NonNullable<NewsData>['articles'][number]
  index: number
}) {
  const score = article.relevancyScore

  const scoreConfig =
    score === null ? { bg: 'bg-slate-100', text: 'text-slate-500', bar: 'bg-slate-300', label: '?' } :
    score >= 70 ?  { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400', label: String(score) } :
    score >= 40 ?  { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-400',   label: String(score) } :
                   { bg: 'bg-red-50',     text: 'text-red-600',     bar: 'bg-red-400',     label: String(score) }

  const categoryLabel: Record<string, string> = {
    financial_performance: 'Financial',
    litigation_legal: 'Legal',
    leadership_change: 'Leadership',
    operational_risk: 'Operational',
    market_expansion: 'Market',
    industry_sector: 'Industry',
  }

  const categoryColor: Record<string, string> = {
    financial_performance: 'bg-blue-50 text-blue-700 border-blue-200',
    litigation_legal: 'bg-red-50 text-red-700 border-red-200',
    leadership_change: 'bg-purple-50 text-purple-700 border-purple-200',
    operational_risk: 'bg-orange-50 text-orange-700 border-orange-200',
    market_expansion: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    industry_sector: 'bg-slate-50 text-slate-700 border-slate-200',
  }

  const staggerClass = index < 6 ? `stagger-${Math.min(index + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}` : ''

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 hover:shadow-md transition-all animate-fade-up ${staggerClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-app-text hover:text-app-accent text-sm leading-snug line-clamp-2 transition-colors"
          >
            {article.title}
          </a>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">{article.source}</span>
            <span className="text-slate-300 text-xs" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400">
              {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {article.category && (
              <>
                <span className="text-slate-300 text-xs" aria-hidden="true">·</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium border ${categoryColor[article.category] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {categoryLabel[article.category] ?? article.category}
                </span>
              </>
            )}
          </div>
          {article.snippet && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{article.snippet}</p>
          )}
          {article.explanation && (
            <p className="text-xs text-slate-400 mt-1 italic">{article.explanation}</p>
          )}
        </div>

        {/* Relevancy score badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div
            className={`text-sm font-bold px-2.5 py-1 rounded-lg min-w-[2.5rem] text-center ${scoreConfig.bg} ${scoreConfig.text}`}
            aria-label={`Relevancy score: ${score ?? 'unscored'}`}
          >
            {scoreConfig.label}
          </div>
          {score !== null && (
            <div className="w-8 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreConfig.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
