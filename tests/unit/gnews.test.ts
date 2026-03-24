import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('GNEWS_API_KEY', 'test-gnews-key')
  vi.stubEnv('PROVIDER_TIMEOUT_MS', '1000')
}

describe('GNewsProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('passes advanced query syntax through without wrapping it again', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        articles: [
          {
            title: 'Apple announces something',
            url: 'https://example.com/apple',
            source: { name: 'Example News' },
            publishedAt: '2026-03-24T00:00:00.000Z',
            description: 'Example snippet',
            content: 'Example content',
          },
        ],
      }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { GNewsProvider } = await import('../../server/providers/news/gnews.js')
    const provider = new GNewsProvider()

    const fromDate = new Date('2026-03-01T00:00:00.000Z')
    const toDate = new Date('2026-03-24T00:00:00.000Z')
    const query = '"Apple Inc." OR "apple.com" OR "AAPL"'
    const articles = await provider.fetchNews(query, fromDate, toDate)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    const searchParams = url.searchParams
    expect(searchParams.get('apikey')).toBe('test-gnews-key')
    expect(searchParams.get('max')).toBe('10')
    expect(searchParams.get('sortby')).toBe('relevance')
    expect(searchParams.get('q')).toBe(query)
    expect(url.toString()).not.toContain('token=')
    expect(articles).toEqual([
      expect.objectContaining({
        title: 'Apple announces something',
        url: 'https://example.com/apple',
        sourceName: 'Example News',
      }),
    ])
  })
})
