import { db } from '../../db/client.js'
import { companyArticles, companyIdentifiers, companies, newsArticles } from '../../db/schema/index.js'
import { and, eq, inArray } from 'drizzle-orm'
import { getNewsProviders } from '../../providers/news/registry.js'
import { deduplicateArticles, computeUrlHash, computeDedupeFingerprint } from './deduplicator.js'
import { env } from '../../env.js'
import { buildNewsSearchQuery } from './search-query.js'

export async function fetchNewsForCompany(companyId: string): Promise<{ articlesIngested: number }> {
  const [company] = await db
    .select({
      id: companies.id,
      displayName: companies.displayName,
      domain: companies.domain,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!company) throw new Error(`Company ${companyId} not found`)

  const identifierRows = await db
    .select({
      identifierValue: companyIdentifiers.identifierValue,
    })
    .from(companyIdentifiers)
    .where(and(
      eq(companyIdentifiers.companyId, companyId),
      eq(companyIdentifiers.identifierType, 'ticker'),
    ))

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - env.NEWS_LOOKBACK_DAYS)

  const searchQuery = buildNewsSearchQuery({
    companyName: company.displayName,
    domain: company.domain,
    tickers: identifierRows.map((row) => row.identifierValue),
  })
  const newsProviders = getNewsProviders()

  // Collect from all available providers
  const allArticles = (
    await Promise.all(
      newsProviders.map((p) =>
        p.fetchNews(searchQuery, fromDate, toDate).catch((err) => {
          console.warn(`[${p.name}] fetchNews failed:`, err)
          return []
        })
      )
    )
  ).flat()

  const deduped = deduplicateArticles(allArticles)
  if (deduped.length === 0) {
    return { articlesIngested: 0 }
  }

  const preparedArticles = deduped.map((article) => ({
    article,
    urlHash: computeUrlHash(article.url),
    fingerprint: computeDedupeFingerprint(article.title),
  }))

  const existingArticles = await db
    .select({
      id: newsArticles.id,
      urlHash: newsArticles.urlHash,
    })
    .from(newsArticles)
    .where(inArray(newsArticles.urlHash, preparedArticles.map((item) => item.urlHash)))

  const articleIdByUrlHash = new Map(existingArticles.map((row) => [row.urlHash, row.id]))

  const missingArticles = preparedArticles.filter((item) => !articleIdByUrlHash.has(item.urlHash))

  if (missingArticles.length > 0) {
    const insertedArticles = await db
      .insert(newsArticles)
      .values(
        missingArticles.map(({ article, urlHash, fingerprint }) => ({
          canonicalUrl: article.url,
          urlHash,
          title: article.title,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          snippet: article.snippet,
          fullText: article.fullText,
          dedupeFingerprint: fingerprint,
          rawPayload: article.rawPayload,
        })),
      )
      .returning({
        id: newsArticles.id,
        urlHash: newsArticles.urlHash,
      })

    for (const inserted of insertedArticles) {
      articleIdByUrlHash.set(inserted.urlHash, inserted.id)
    }
  }

  const companyArticleValues = preparedArticles.flatMap(({ urlHash }) => {
    const articleId = articleIdByUrlHash.get(urlHash)
    if (!articleId) return []

    return [{
      companyId,
      articleId,
      searchQuery,
    }]
  })

  if (companyArticleValues.length > 0) {
    await db
      .insert(companyArticles)
      .values(companyArticleValues)
      .onConflictDoNothing({
        target: [companyArticles.companyId, companyArticles.articleId],
      })
  }

  return { articlesIngested: missingArticles.length }
}
