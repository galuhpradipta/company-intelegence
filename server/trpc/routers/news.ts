import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/client.js'
import { companyArticles, newsArticles, articleRelevancyScores } from '../../db/schema/index.js'
import { eq, and } from 'drizzle-orm'
import { fetchNewsForCompany } from '../../services/news-ingestion/index.js'

export const newsRouter = router({
  fetchForCompany: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return fetchNewsForCompany(input)
    }),

  listByCompany: publicProcedure
    .input(z.object({
      companyId: z.string().uuid(),
      showAll: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const links = await db.query.companyArticles.findMany({
        where: eq(companyArticles.companyId, input.companyId),
      })

      if (links.length === 0) return { companyId: input.companyId, articles: [] }

      const articleIds = links.map((l) => l.articleId)

      // Fetch articles and their scores
      const result = await Promise.all(
        articleIds.map(async (articleId) => {
          const article = await db.query.newsArticles.findFirst({
            where: eq(newsArticles.id, articleId),
          })
          if (!article) return null

          const score = await db.query.articleRelevancyScores.findFirst({
            where: and(
              eq(articleRelevancyScores.articleId, articleId),
              eq(articleRelevancyScores.companyId, input.companyId)
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

      // Filter low-scoring articles unless showAll=true
      if (!input.showAll) {
        articles = articles.filter(
          (a) => a.relevancyScore === null || a.relevancyScore >= 30
        )
      }

      // Sort by relevancyScore descending, unscored last
      articles.sort((a, b) => {
        if (a.relevancyScore === null && b.relevancyScore === null) return 0
        if (a.relevancyScore === null) return 1
        if (b.relevancyScore === null) return -1
        return b.relevancyScore - a.relevancyScore
      })

      return { companyId: input.companyId, articles }
    }),
})
