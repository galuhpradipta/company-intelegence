import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc.js'

type CompanyData = Awaited<ReturnType<typeof trpc.company.getById.query>>
type NewsData = Awaited<ReturnType<typeof trpc.news.listByCompany.query>>

export function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [newsData, setNewsData] = useState<NewsData | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingNews, setFetchingNews] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      await trpc.relevancy.scoreForCompany.mutate(id)
      await loadNews(id, showAll)
    } catch (err) {
      console.warn('News fetch failed:', err)
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
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error ?? 'Company not found'}</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm">← Back to search</Link>
      </div>
    )
  }

  const articles = newsData?.articles ?? []
  const uniqueProviders = [...new Set(company.sourceRecords.map((s) => s.provider))]

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to search</Link>

      {/* Company profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{company.displayName}</h1>
              <TierBadge tier={company.matchTier} />
            </div>
            {company.legalName && company.legalName !== company.displayName && (
              <p className="text-sm text-gray-500">Legal name: {company.legalName}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{Math.round(company.confidenceScore)}%</div>
            <div className="text-xs text-gray-400">confidence</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {company.domain && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Domain</div>
              <a href={`https://${company.domain}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                {company.domain}
              </a>
            </div>
          )}
          {company.industry && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Industry</div>
              <div className="text-gray-700">{company.industry}</div>
            </div>
          )}
          {company.employeeCount && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Employees</div>
              <div className="text-gray-700">{company.employeeCount.toLocaleString()}</div>
            </div>
          )}
          {(company.hqCity || company.hqCountry) && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">HQ</div>
              <div className="text-gray-700">
                {[company.hqCity, company.hqState, company.hqCountry].filter(Boolean).join(', ')}
              </div>
            </div>
          )}
        </div>

        {uniqueProviders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Data sources</div>
            <div className="flex gap-2 flex-wrap">
              {uniqueProviders.map((p) => (
                <span key={p} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {p.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* News section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            News
            {fetchingNews && (
              <span className="ml-2 text-sm text-gray-400 font-normal">fetching & scoring…</span>
            )}
          </h2>
          {articles.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded"
              />
              Show all (including low-relevance)
            </label>
          )}
        </div>

        {articles.length === 0 && !fetchingNews && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">No news articles found.</p>
            {company.matchTier !== 'confident' && (
              <p className="text-xs text-gray-300 mt-1">News is fetched automatically for confident matches.</p>
            )}
            <button
              onClick={() => triggerNewsFetch(companyId!)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Fetch news manually
            </button>
          </div>
        )}

        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleCard key={article.articleId} article={article} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ArticleCard({ article }: { article: NonNullable<NewsData>['articles'][number] }) {
  const score = article.relevancyScore

  const scoreColor =
    score === null ? 'bg-gray-100 text-gray-500' :
    score >= 70 ? 'bg-green-100 text-green-700' :
    score >= 40 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-600'

  const categoryLabel: Record<string, string> = {
    financial_performance: 'Financial',
    litigation_legal: 'Legal',
    leadership_change: 'Leadership',
    operational_risk: 'Operational',
    market_expansion: 'Market',
    industry_sector: 'Industry',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 hover:text-blue-600 text-sm leading-snug line-clamp-2"
          >
            {article.title}
          </a>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-400">{article.source}</span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-400">
              {new Date(article.publishedAt).toLocaleDateString()}
            </span>
            {article.category && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  {categoryLabel[article.category] ?? article.category}
                </span>
              </>
            )}
          </div>
          {article.snippet && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{article.snippet}</p>
          )}
          {article.explanation && (
            <p className="text-xs text-gray-400 mt-1 italic">{article.explanation}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${scoreColor}`}>
            {score !== null ? score : '?'}
          </div>
        </div>
      </div>
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
