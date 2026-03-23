import { db } from '../../db/client.js'
import { newsArticles, companyArticles, companies } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'
import { getNewsProviders } from '../../providers/news/registry.js'
import { deduplicateArticles, computeUrlHash, computeDedupeFingerprint } from './deduplicator.js'
import { env } from '../../env.js'

export async function fetchNewsForCompany(companyId: string): Promise<{ articlesIngested: number }> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  })
  if (!company) throw new Error(`Company ${companyId} not found`)

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - env.NEWS_LOOKBACK_DAYS)

  const searchQuery = company.displayName
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

  let ingested = 0

  for (const article of deduped) {
    const urlHash = computeUrlHash(article.url)
    const fingerprint = computeDedupeFingerprint(article.title)

    // Upsert the article
    const [inserted] = await db
      .insert(newsArticles)
      .values({
        canonicalUrl: article.url,
        urlHash,
        title: article.title,
        sourceName: article.sourceName,
        publishedAt: article.publishedAt,
        snippet: article.snippet,
        fullText: article.fullText,
        dedupeFingerprint: fingerprint,
        rawPayload: article.rawPayload,
      })
      .onConflictDoNothing()
      .returning({ id: newsArticles.id })

    let articleId: string
    if (!inserted) {
      // Article already exists, find it by urlHash
      const existing = await db.query.newsArticles.findFirst({
        where: eq(newsArticles.urlHash, urlHash),
      })
      if (!existing) continue
      articleId = existing.id
    } else {
      articleId = inserted.id
      ingested++
    }

    // Link to company (ignore if already linked)
    await db
      .insert(companyArticles)
      .values({
        companyId,
        articleId,
        searchQuery,
      })
      .onConflictDoNothing()
  }

  return { articlesIngested: ingested }
}
