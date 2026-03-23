import type { NewsProvider } from './types.js'
import { GNewsProvider } from './gnews.js'
import { MockNewsProvider } from './mock-news-provider.js'
import { NewsApiProvider } from './newsapi.js'
import { env } from '../../env.js'

const LIVE_NEWS_PROVIDERS: NewsProvider[] = [
  new NewsApiProvider(),
  new GNewsProvider(),
]

const MOCK_NEWS_PROVIDERS: NewsProvider[] = [
  new MockNewsProvider(),
]

export function getNewsProviders(): NewsProvider[] {
  return env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS
    ? MOCK_NEWS_PROVIDERS
    : LIVE_NEWS_PROVIDERS
}
