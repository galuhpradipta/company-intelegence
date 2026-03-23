import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { articleRelevancyScores, companyArticles, newsArticles } from '../../db/schema/index.js'
import { scoreArticlesForCompany } from '../relevancy/index.js'
import { fetchNewsForCompany } from './ingestion-service.js'

export interface CompanyNewsArticle {
  articleId: string
  title: string
  source: string
  publishedAt: Date
  url: string
  snippet: string | null
  relevancyScore: number | null
  category: string | null
  explanation: string | null
}

export interface CompanyNewsMeta {
  totalArticles: number
  lastIngestedAt: string | null
  hasUnscoredArticles: boolean
}

export interface CompanyNewsResponse {
  companyId: string
  meta: CompanyNewsMeta
  articles: CompanyNewsArticle[]
}

interface CompanyNewsRow extends CompanyNewsArticle {
  ingestedAt: Date
  scoreStatus: string | null
}

export async function listNewsByCompany(companyId: string, showAll = false): Promise<CompanyNewsResponse> {
  const rows = await db
    .select({
      articleId: newsArticles.id,
      title: newsArticles.title,
      source: newsArticles.sourceName,
      publishedAt: newsArticles.publishedAt,
      url: newsArticles.canonicalUrl,
      snippet: newsArticles.snippet,
      relevancyScore: articleRelevancyScores.relevancyScore,
      category: articleRelevancyScores.category,
      explanation: articleRelevancyScores.explanation,
      ingestedAt: companyArticles.ingestedAt,
      scoreStatus: articleRelevancyScores.status,
    })
    .from(companyArticles)
    .innerJoin(newsArticles, eq(companyArticles.articleId, newsArticles.id))
    .leftJoin(
      articleRelevancyScores,
      and(
        eq(articleRelevancyScores.companyId, companyId),
        eq(articleRelevancyScores.articleId, companyArticles.articleId),
      ),
    )
    .where(eq(companyArticles.companyId, companyId))

  if (rows.length === 0) {
    return {
      companyId,
      meta: {
        totalArticles: 0,
        lastIngestedAt: null,
        hasUnscoredArticles: false,
      },
      articles: [],
    }
  }

  const articleById = new Map<string, CompanyNewsRow>()

  for (const row of rows) {
    const existing = articleById.get(row.articleId)

    if (!existing) {
      articleById.set(row.articleId, row)
      continue
    }

    if (row.ingestedAt > existing.ingestedAt) {
      existing.ingestedAt = row.ingestedAt
    }

    const existingRank = getScoreStatusRank(existing.scoreStatus)
    const nextRank = getScoreStatusRank(row.scoreStatus)
    const shouldReplaceScore =
      nextRank > existingRank
      || (nextRank === existingRank && (row.relevancyScore ?? -1) > (existing.relevancyScore ?? -1))

    if (shouldReplaceScore) {
      existing.relevancyScore = row.relevancyScore
      existing.category = row.category
      existing.explanation = row.explanation
      existing.scoreStatus = row.scoreStatus
    }
  }

  const aggregatedRows = [...articleById.values()]
  const lastIngestedAt = aggregatedRows.reduce<Date | null>(
    (latest, row) => (!latest || row.ingestedAt > latest ? row.ingestedAt : latest),
    null,
  )

  let articles = aggregatedRows.map((row) => ({
    articleId: row.articleId,
    title: row.title,
    source: row.source,
    publishedAt: row.publishedAt,
    url: row.url,
    snippet: row.snippet,
    relevancyScore: row.relevancyScore,
    category: row.category,
    explanation: row.explanation,
  }))

  if (!showAll) {
    articles = articles.filter((article) => article.relevancyScore === null || article.relevancyScore >= 30)
  }

  articles.sort((a, b) => {
    if (a.relevancyScore === null && b.relevancyScore === null) return 0
    if (a.relevancyScore === null) return 1
    if (b.relevancyScore === null) return -1
    return b.relevancyScore - a.relevancyScore
  })

  return {
    companyId,
    meta: {
      totalArticles: aggregatedRows.length,
      lastIngestedAt: lastIngestedAt?.toISOString() ?? null,
      hasUnscoredArticles: aggregatedRows.some((row) => row.scoreStatus !== 'scored'),
    },
    articles,
  }
}

export async function refreshCompanyNews(companyId: string): Promise<{
  articlesIngested: number
  articlesScored: number
}> {
  const { articlesIngested } = await fetchNewsForCompany(companyId)
  const scoredArticles = await scoreArticlesForCompany(companyId)

  return {
    articlesIngested,
    articlesScored: scoredArticles.length,
  }
}

function getScoreStatusRank(status: string | null): number {
  if (status === 'scored') return 2
  if (status === 'failed') return 1
  return 0
}
