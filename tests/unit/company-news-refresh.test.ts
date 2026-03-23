import { describe, expect, it } from 'vitest'
import {
  COMPANY_NEWS_AUTO_REFRESH_AFTER_MS,
  shouldAutoRefreshCompanyNews,
} from '../../src/features/news/refreshPolicy.js'

describe('shouldAutoRefreshCompanyNews', () => {
  const now = Date.UTC(2026, 2, 24, 10, 0, 0)

  it('refreshes when no articles have been ingested yet', () => {
    expect(shouldAutoRefreshCompanyNews({
      totalArticles: 0,
      lastIngestedAt: null,
      hasUnscoredArticles: false,
    }, now)).toBe(true)
  })

  it('refreshes when articles are still unscored', () => {
    expect(shouldAutoRefreshCompanyNews({
      totalArticles: 3,
      lastIngestedAt: new Date(now).toISOString(),
      hasUnscoredArticles: true,
    }, now)).toBe(true)
  })

  it('does not refresh when articles are fresh and already scored', () => {
    expect(shouldAutoRefreshCompanyNews({
      totalArticles: 3,
      lastIngestedAt: new Date(now - (COMPANY_NEWS_AUTO_REFRESH_AFTER_MS / 2)).toISOString(),
      hasUnscoredArticles: false,
    }, now)).toBe(false)
  })

  it('refreshes when the last ingestion is stale', () => {
    expect(shouldAutoRefreshCompanyNews({
      totalArticles: 3,
      lastIngestedAt: new Date(now - COMPANY_NEWS_AUTO_REFRESH_AFTER_MS - 1).toISOString(),
      hasUnscoredArticles: false,
    }, now)).toBe(true)
  })
})
