import { Hono } from 'hono'
import { db } from '../db/client.js'
import { companyArticles, newsArticles, articleRelevancyScores } from '../db/schema/index.js'
import { eq, and } from 'drizzle-orm'
import { fetchNewsForCompany } from '../services/news-ingestion/index.js'
import { scoreArticlesForCompany } from '../services/relevancy/index.js'

export const newsRoute = new Hono()

// POST /api/news/fetch/:companyId
newsRoute.post('/fetch/:companyId', async (c) => {
  const companyId = c.req.param('companyId')
  const result = await fetchNewsForCompany(companyId)

  // Trigger scoring in background
  scoreArticlesForCompany(companyId).catch((err) =>
    console.warn(`[News] Scoring failed for ${companyId}:`, err)
  )

  return c.json(result)
})

// GET /api/news/:companyId
newsRoute.get('/:companyId', async (c) => {
  const companyId = c.req.param('companyId')
  const showAll = c.req.query('showAll') === 'true'

  const links = await db.query.companyArticles.findMany({
    where: eq(companyArticles.companyId, companyId),
  })

  if (links.length === 0) {
    return c.json({ companyId, articles: [] })
  }

  const result = await Promise.all(
    links.map(async (link) => {
      const article = await db.query.newsArticles.findFirst({
        where: eq(newsArticles.id, link.articleId),
      })
      if (!article) return null

      const score = await db.query.articleRelevancyScores.findFirst({
        where: and(
          eq(articleRelevancyScores.articleId, link.articleId),
          eq(articleRelevancyScores.companyId, companyId)
        ),
      })

      return {
        articleId: article.id,
        title: article.title,
        source: article.sourceName,
        publishedAt: article.publishedAt,
        url: article.canonicalUrl,
        snippet: article.snippet,
        relevancyScore: score?.relevancyScore ?? null,
        category: score?.category ?? null,
        explanation: score?.explanation ?? null,
      }
    })
  )

  let articles = result.filter(Boolean) as NonNullable<typeof result[number]>[]

  if (!showAll) {
    articles = articles.filter((a) => a.relevancyScore === null || a.relevancyScore >= 30)
  }

  articles.sort((a, b) => {
    if (a.relevancyScore === null && b.relevancyScore === null) return 0
    if (a.relevancyScore === null) return 1
    if (b.relevancyScore === null) return -1
    return b.relevancyScore - a.relevancyScore
  })

  return c.json({ companyId, articles })
})
