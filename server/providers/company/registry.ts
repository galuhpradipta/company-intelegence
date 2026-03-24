import type { CompanyProvider } from './types.js'
import { AiFallbackProvider } from './ai-fallback.js'
import { FixtureCompanyProvider } from './mock-company-provider.js'
import { OpenCorporatesProvider } from './opencorporates.js'
import { PeopleDataLabsProvider } from './people-data-labs.js'
import { SecEdgarProvider } from './sec-edgar.js'
import { env } from '../../env.js'

function createLiveDeterministicProviders(): CompanyProvider[] {
  const providers: CompanyProvider[] = [
    new PeopleDataLabsProvider(),
    new SecEdgarProvider(),
  ]

  if (hasConfiguredValue(env.OPENCORPORATES_API_KEY)) {
    providers.push(new OpenCorporatesProvider())
  }

  return providers
}

const LIVE_FALLBACK_PROVIDER = new AiFallbackProvider()

const MOCK_DETERMINISTIC_PROVIDERS: CompanyProvider[] = [
  new FixtureCompanyProvider('people_data_labs', 0.9),
  new FixtureCompanyProvider('sec_edgar', 1.0),
  new FixtureCompanyProvider('opencorporates', 1.0),
]

const MOCK_FALLBACK_PROVIDER = new FixtureCompanyProvider('ai_fallback', 0.6)

export function getDeterministicCompanyProviders(): CompanyProvider[] {
  return env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS
    ? MOCK_DETERMINISTIC_PROVIDERS
    : createLiveDeterministicProviders()
}

export function getFallbackCompanyProvider(): CompanyProvider {
  return env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS
    ? MOCK_FALLBACK_PROVIDER
    : LIVE_FALLBACK_PROVIDER
}

export function getCompanyProviderByName(name: string): CompanyProvider | undefined {
  return [
    ...getDeterministicCompanyProviders(),
    getFallbackCompanyProvider(),
  ].find((provider) => provider.name === name)
}

function hasConfiguredValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}
