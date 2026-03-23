import { describe, it, expect } from 'vitest'
import { deduplicateArticles, computeUrlHash, computeDedupeFingerprint } from '../../server/services/news-ingestion/deduplicator.js'
import type { NewsArticle } from '../../server/providers/news/types.js'

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title: 'Apple reports record earnings this quarter',
    url: 'https://example.com/article-1',
    sourceName: 'TechNews',
    publishedAt: new Date('2026-03-01'),
    rawPayload: {},
    ...overrides,
  }
}

describe('deduplicateArticles', () => {
  it('removes exact URL duplicates', () => {
    const articles = [
      makeArticle({ url: 'https://example.com/same' }),
      makeArticle({ url: 'https://example.com/same', sourceName: 'OtherSource' }),
    ]
    const result = deduplicateArticles(articles)
    expect(result).toHaveLength(1)
  })

  it('removes same-title articles within 72 hours', () => {
    const articles = [
      makeArticle({
        url: 'https://source1.com/article',
        publishedAt: new Date('2026-03-01T10:00:00Z'),
      }),
      makeArticle({
        url: 'https://source2.com/article',
        publishedAt: new Date('2026-03-02T10:00:00Z'), // 24h later — duplicate
      }),
    ]
    const result = deduplicateArticles(articles)
    expect(result).toHaveLength(1)
  })

  it('keeps same-title articles more than 72 hours apart', () => {
    const articles = [
      makeArticle({
        url: 'https://source1.com/a1',
        publishedAt: new Date('2026-03-01T00:00:00Z'),
      }),
      makeArticle({
        url: 'https://source2.com/a2',
        publishedAt: new Date('2026-03-05T00:00:00Z'), // 4 days later — separate events
      }),
    ]
    const result = deduplicateArticles(articles)
    expect(result).toHaveLength(2)
  })

  it('keeps articles with different titles', () => {
    const articles = [
      makeArticle({ title: 'Apple earnings beat estimates', url: 'https://a.com/1' }),
      makeArticle({ title: 'Apple announces new iPhone model', url: 'https://a.com/2' }),
    ]
    const result = deduplicateArticles(articles)
    expect(result).toHaveLength(2)
  })
})

describe('computeDedupeFingerprint', () => {
  it('produces same fingerprint for title with different punctuation', () => {
    const a = computeDedupeFingerprint("Apple's earnings beat estimates!")
    const b = computeDedupeFingerprint("apples earnings beat estimates")
    expect(a).toBe(b)
  })

  it('produces different fingerprints for different titles', () => {
    const a = computeDedupeFingerprint('Apple earnings')
    const b = computeDedupeFingerprint('Google earnings')
    expect(a).not.toBe(b)
  })
})

describe('computeUrlHash', () => {
  it('treats same URL as same hash', () => {
    expect(computeUrlHash('https://example.com/a')).toBe(computeUrlHash('https://example.com/a'))
  })
  it('is case-insensitive', () => {
    expect(computeUrlHash('HTTPS://EXAMPLE.COM/A')).toBe(computeUrlHash('https://example.com/a'))
  })
})
