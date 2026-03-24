import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('fetchWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries on 429 and honors Retry-After seconds', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        articles: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { fetchWithBackoff } = await import('../../server/providers/news/request-with-backoff.js')

    const request = fetchWithBackoff('NewsAPI', 'https://example.com', 1000)
    await vi.advanceTimersByTimeAsync(1000)

    const response = await request
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalledWith(
      '[NewsAPI] Temporary provider limit (429). Retrying in 1000ms (attempt 1/2).',
    )
  })

  it('caps retries after repeated 429 responses', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response('slow down', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchWithBackoff } = await import('../../server/providers/news/request-with-backoff.js')
    const request = fetchWithBackoff('GNews', 'https://example.com', 1000)

    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(500)

    const response = await request
    expect(response.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('NewsApiProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    vi.stubEnv('NEWS_API_KEY', 'test-newsapi-key')
    vi.stubEnv('PROVIDER_TIMEOUT_MS', '1000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the request query intact while using the shared retrying fetch helper', async () => {
    const fetchWithBackoff = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        articles: [
          {
            title: 'Apple expands supply chain',
            url: 'https://example.com/apple-expands',
            source: { name: 'Example News' },
            publishedAt: '2026-03-24T00:00:00.000Z',
            description: 'Example snippet',
            content: 'Example content',
          },
        ],
      }),
    } satisfies Partial<Response>)

    vi.doMock('../../server/providers/news/request-with-backoff.js', () => ({
      fetchWithBackoff,
    }))

    const { NewsApiProvider } = await import('../../server/providers/news/newsapi.js')
    const provider = new NewsApiProvider()
    const query = '"Apple Inc." OR "apple.com" OR "AAPL"'

    const articles = await provider.fetchNews(query, new Date('2026-03-01'), new Date('2026-03-24'))

    expect(fetchWithBackoff).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetchWithBackoff.mock.calls[0]?.[1]))
    expect(url.searchParams.get('q')).toBe(query)
    expect(url.searchParams.get('apiKey')).toBe('test-newsapi-key')
    expect(articles).toEqual([
      expect.objectContaining({
        title: 'Apple expands supply chain',
        url: 'https://example.com/apple-expands',
        sourceName: 'Example News',
      }),
    ])
  })
})
