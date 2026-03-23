import crypto from 'crypto'
import type { NewsArticle } from '../../providers/news/types.js'

export function computeUrlHash(url: string): string {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex').slice(0, 32)
}

export function computeDedupeFingerprint(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seenUrls = new Set<string>()
  const seenFingerprints = new Map<string, Date>()
  const result: NewsArticle[] = []

  for (const article of articles) {
    const urlHash = computeUrlHash(article.url)
    if (seenUrls.has(urlHash)) continue
    seenUrls.add(urlHash)

    const fp = computeDedupeFingerprint(article.title)
    const existing = seenFingerprints.get(fp)
    if (existing) {
      const diffMs = Math.abs(article.publishedAt.getTime() - existing.getTime())
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours <= 72) continue // same event within 72-hour window
    }
    seenFingerprints.set(fp, article.publishedAt)

    result.push(article)
  }

  return result
}
