import type { CompanyProvider } from './types.js'
import { AiFallbackProvider } from './ai-fallback.js'
import { OpenCorporatesProvider } from './opencorporates.js'
import { PeopleDataLabsProvider } from './people-data-labs.js'
import { SecEdgarProvider } from './sec-edgar.js'

const DETERMINISTIC_PROVIDERS: CompanyProvider[] = [
  new PeopleDataLabsProvider(),
  new SecEdgarProvider(),
  new OpenCorporatesProvider(),
]

const FALLBACK_PROVIDER = new AiFallbackProvider()

export function getDeterministicCompanyProviders(): CompanyProvider[] {
  return DETERMINISTIC_PROVIDERS
}

export function getFallbackCompanyProvider(): CompanyProvider {
  return FALLBACK_PROVIDER
}

export function getCompanyProviderByName(name: string): CompanyProvider | undefined {
  return [...DETERMINISTIC_PROVIDERS, FALLBACK_PROVIDER].find((provider) => provider.name === name)
}
