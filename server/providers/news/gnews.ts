import type { NewsProvider, NewsArticle } from './types.js'
import { env } from '../../env.js'

export class GNewsProvider implements NewsProvider {
  name = 'gnews'

  async fetchNews(query: string, fromDate: Date, toDate: Date): Promise<NewsArticle[]> {
    const apiKey = env.GNEWS_API_KEY
    if (!apiKey) {
      console.warn('[GNews] GNEWS_API_KEY not set, skipping provider')
      return []
    }

    const params = new URLSearchParams({
      q: `"${query}"`,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      lang: 'en',
      max: '30',
      token: apiKey,
    })

    const url = `https://gnews.io/api/v4/search?${params}`

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      })

      if (res.status === 401 || res.status === 403) {
        console.warn('[GNews] Auth failed. Check GNEWS_API_KEY.')
        return []
      }
      if (!res.ok) {
        const body = await res.text()
        console.warn(`[GNews] Error ${res.status}:`, body)
        return []
      }

      const data = await res.json() as {
        articles?: Array<{
          title: string
          url: string
          source: { name: string }
          publishedAt: string
          description?: string
          content?: string
        }>
      }

      if (!Array.isArray(data.articles)) return []

      return data.articles.map((a) => ({
        title: a.title,
        url: a.url,
        sourceName: a.source.name,
        publishedAt: new Date(a.publishedAt),
        snippet: a.description ?? undefined,
        fullText: a.content ?? undefined,
        rawPayload: a as Record<string, unknown>,
      }))
    } catch (err) {
      console.warn('[GNews] Request failed:', err)
      return []
    }
  }
}
