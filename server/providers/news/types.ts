export interface NewsArticle {
  title: string
  url: string
  sourceName: string
  publishedAt: Date
  snippet?: string
  fullText?: string
  rawPayload: Record<string, unknown>
}

export interface NewsProvider {
  name: string
  fetchNews(query: string, fromDate: Date, toDate: Date): Promise<NewsArticle[]>
}
