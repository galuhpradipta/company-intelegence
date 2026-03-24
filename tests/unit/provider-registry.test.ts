import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS', '0')
  vi.stubEnv('GNEWS_API_KEY', 'test-gnews-key')
}

describe('provider registries', () => {
  beforeEach(() => {
    vi.resetModules()
    stubBaseEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('excludes opencorporates from live company providers when the API key is missing', async () => {
    vi.stubEnv('OPENCORPORATES_API_KEY', '')

    const { getDeterministicCompanyProviders } = await import('../../server/providers/company/registry.js')

    expect(getDeterministicCompanyProviders().map((provider) => provider.name)).toEqual([
      'people_data_labs',
      'sec_edgar',
    ])
  })

  it('includes opencorporates in live company providers when the API key is present', async () => {
    vi.stubEnv('OPENCORPORATES_API_KEY', 'test-opencorporates-key')

    const { getDeterministicCompanyProviders } = await import('../../server/providers/company/registry.js')

    expect(getDeterministicCompanyProviders().map((provider) => provider.name)).toEqual([
      'people_data_labs',
      'sec_edgar',
      'opencorporates',
    ])
  })

  it('excludes newsapi from live news providers when the API key is missing', async () => {
    vi.stubEnv('NEWS_API_KEY', '')

    const { getNewsProviders } = await import('../../server/providers/news/registry.js')

    expect(getNewsProviders().map((provider) => provider.name)).toEqual([
      'gnews',
    ])
  })

  it('includes newsapi in live news providers when the API key is present', async () => {
    vi.stubEnv('NEWS_API_KEY', 'test-newsapi-key')

    const { getNewsProviders } = await import('../../server/providers/news/registry.js')

    expect(getNewsProviders().map((provider) => provider.name)).toEqual([
      'newsapi',
      'gnews',
    ])
  })
})
