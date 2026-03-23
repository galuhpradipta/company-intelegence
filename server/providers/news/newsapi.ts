import type { NewsProvider, NewsArticle } from './types.js'
import { env } from '../../env.js'

export class NewsApiProvider implements NewsProvider {
  name = 'newsapi'

  async fetchNews(query: string, fromDate: Date, toDate: Date): Promise<NewsArticle[]> {
    const apiKey = env.NEWS_API_KEY
    if (!apiKey) {
      console.warn('[NewsAPI] NEWS_API_KEY not set, skipping provider')
      return []
    }

    const params = new URLSearchParams({
      q: query,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      language: 'en',
      sortBy: 'relevancy',
      pageSize: '30',
      apiKey,
    })

    const url = `https://newsapi.org/v2/everything?${params}`

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      })

      if (res.status === 401) {
        console.warn('[NewsAPI] Authentication failed. Check NEWS_API_KEY.')
        return []
      }
      if (res.status === 426) {
        console.warn('[NewsAPI] Upgrade required — free tier does not support all query params. Consider upgrading or using GNews.')
        return []
      }
      if (!res.ok) {
        const body = await res.text()
        console.warn(`[NewsAPI] Error ${res.status}:`, body)
        return []
      }

      const data = await res.json() as {
        status: string
        articles?: Array<{
          title: string
          url: string
          source: { name: string }
          publishedAt: string
          description?: string
          content?: string
        }>
      }

      if (data.status !== 'ok' || !Array.isArray(data.articles)) return []

      return data.articles
        .filter((a) => a.title && a.url && !a.title.includes('[Removed]'))
        .map((a) => ({
          title: a.title,
          url: a.url,
          sourceName: a.source.name,
          publishedAt: new Date(a.publishedAt),
          snippet: a.description ?? undefined,
          fullText: a.content ?? undefined,
          rawPayload: a as Record<string, unknown>,
        }))
    } catch (err) {
      console.warn('[NewsAPI] Request failed:', err)
      return []
    }
  }
}
