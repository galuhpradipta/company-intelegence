import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

function jsonPost(body: unknown) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

async function createApp() {
  const { relevancyRoute } = await import('./relevancy.ts')
  return new Hono().route('/api/relevancy', relevancyRoute)
}

describe('relevancyRoute integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    vi.stubEnv('COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS', '1')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('scores a clearly relevant article high and a weakly related article low through the real service path', async () => {
    const app = await createApp()

    const res = await app.request('/api/relevancy/batch', jsonPost({
      company: {
        displayName: 'Apple Inc.',
        industry: 'Technology',
        employeeCount: 161000,
        hqCity: 'Cupertino',
        hqCountry: 'US',
      },
      articles: [
        {
          articleId: 'article-relevant',
          title: 'Apple expands supply chain',
          snippet: 'Apple announced another supply-chain expansion.',
        },
        {
          articleId: 'article-weak',
          title: 'Supplier filing rumor',
          snippet: 'A rumor mentions suppliers without material Apple impact.',
        },
      ],
    }))

    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({
      scores: [
        {
          articleId: 'article-relevant',
          relevancyScore: 92,
          category: 'market_expansion',
          explanation: 'Your Finance Manager / AR Manager should watch customer growth and payment timing.',
        },
        {
          articleId: 'article-weak',
          relevancyScore: 18,
          category: 'industry_sector',
          explanation: 'Your Finance Manager / AR Manager has limited immediate collections risk from this rumor.',
        },
      ],
    })

    expect(body.scores[0].relevancyScore).toBeGreaterThanOrEqual(85)
    expect(body.scores[1].relevancyScore).toBeLessThan(30)
  })
})
