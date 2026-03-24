import type { NewsProvider } from './types.js'
import { GNewsProvider } from './gnews.js'
import { MockNewsProvider } from './mock-news-provider.js'
import { NewsApiProvider } from './newsapi.js'
import { env } from '../../env.js'

function createLiveNewsProviders(): NewsProvider[] {
  const providers: NewsProvider[] = [
    new GNewsProvider(),
  ]

  if (hasConfiguredValue(env.NEWS_API_KEY)) {
    providers.unshift(new NewsApiProvider())
  }

  return providers
}

const MOCK_NEWS_PROVIDERS: NewsProvider[] = [
  new MockNewsProvider(),
]

export function getNewsProviders(): NewsProvider[] {
  return env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS
    ? MOCK_NEWS_PROVIDERS
    : createLiveNewsProviders()
}

function hasConfiguredValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}
