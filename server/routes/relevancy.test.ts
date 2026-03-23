import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../services/relevancy/index.js', () => ({
  scoreArticleBatchForProfile: vi.fn(),
  scoreArticleForProfile: vi.fn(),
}))

import { relevancyRoute } from './relevancy.ts'
import {
  scoreArticleBatchForProfile,
  scoreArticleForProfile,
} from '../services/relevancy/index.js'

const mockedScoreArticleBatchForProfile = vi.mocked(scoreArticleBatchForProfile)
const mockedScoreArticleForProfile = vi.mocked(scoreArticleForProfile)

function createApp() {
  return new Hono().route('/api/relevancy', relevancyRoute)
}

function jsonPost(body: unknown) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

describe('relevancyRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scores a single article and normalizes companyName into displayName', async () => {
    mockedScoreArticleForProfile.mockResolvedValue({
      relevancyScore: 82,
      category: 'market_expansion',
      explanation: 'Expansion story is tied directly to the company roadmap.',
    })

    const res = await createApp().request('/api/relevancy/score', jsonPost({
      company: {
        companyName: 'Apple Inc.',
        industry: 'Technology',
        hqCity: 'Cupertino',
        hqCountry: 'US',
      },
      article: {
        articleId: 'article-1',
        title: 'Apple expands manufacturing',
        snippet: 'Apple announced new expansion plans.',
      },
    }))

    expect(res.status).toBe(200)
    expect(mockedScoreArticleForProfile).toHaveBeenCalledWith(
      {
        displayName: 'Apple Inc.',
        legalName: undefined,
        industry: 'Technology',
        employeeCount: undefined,
        hqCity: 'Cupertino',
        hqCountry: 'US',
      },
      {
        articleId: 'article-1',
        title: 'Apple expands manufacturing',
        snippet: 'Apple announced new expansion plans.',
      },
    )
    expect(await res.json()).toEqual({
      relevancyScore: 82,
      category: 'market_expansion',
      explanation: 'Expansion story is tied directly to the company roadmap.',
    })
  })

  it('returns 502 when the scoring service cannot produce a result', async () => {
    mockedScoreArticleForProfile.mockResolvedValue(null)

    const res = await createApp().request('/api/relevancy/score', jsonPost({
      company: {
        displayName: 'Apple Inc.',
      },
      article: {
        title: 'Apple headline',
      },
    }))

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Failed to score article' })
  })

  it('rejects invalid company payloads before calling the service', async () => {
    const res = await createApp().request('/api/relevancy/score', jsonPost({
      company: {
        industry: 'Technology',
      },
      article: {
        title: 'Apple headline',
      },
    }))

    expect(res.status).toBe(400)
    expect(mockedScoreArticleForProfile).not.toHaveBeenCalled()
  })

  it('scores article batches and preserves article ids while surfacing null fallbacks', async () => {
    mockedScoreArticleBatchForProfile.mockResolvedValue([
      {
        relevancyScore: 91,
        category: 'financial_performance',
        explanation: 'Strong earnings tie the article directly to Apple.',
      },
      null,
    ])

    const res = await createApp().request('/api/relevancy/batch', jsonPost({
      company: {
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
      },
      articles: [
        {
          articleId: 'article-1',
          title: 'Apple beats expectations',
          snippet: 'Quarterly earnings beat analyst estimates.',
        },
        {
          title: 'Industry roundup',
          snippet: 'Sector-wide discussion with no direct mention.',
        },
      ],
    }))

    expect(res.status).toBe(200)
    expect(mockedScoreArticleBatchForProfile).toHaveBeenCalledWith(
      {
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        industry: undefined,
        employeeCount: undefined,
        hqCity: undefined,
        hqCountry: undefined,
      },
      [
        {
          articleId: 'article-1',
          title: 'Apple beats expectations',
          snippet: 'Quarterly earnings beat analyst estimates.',
        },
        {
          title: 'Industry roundup',
          snippet: 'Sector-wide discussion with no direct mention.',
        },
      ],
    )
    expect(await res.json()).toEqual({
      scores: [
        {
          articleId: 'article-1',
          relevancyScore: 91,
          category: 'financial_performance',
          explanation: 'Strong earnings tie the article directly to Apple.',
        },
        {
          articleId: null,
          relevancyScore: null,
          category: null,
          explanation: null,
        },
      ],
    })
  })
})
