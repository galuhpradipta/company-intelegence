import type { NewsArticle, NewsProvider } from './types.js'
import { getMockNewsArticles } from '../../testing/mock-fixtures.js'

export class MockNewsProvider implements NewsProvider {
  name = 'mock_news'

  async fetchNews(query: string, fromDate: Date, toDate: Date): Promise<NewsArticle[]> {
    return getMockNewsArticles(query, fromDate, toDate)
  }
}
