import type { CompanyInput, NormalizedInput } from '../../providers/company/types.js'

const LEGAL_SUFFIXES = /\b(inc|llc|ltd|pt|cv|corp|co|plc|gmbh|ag|sa|sas|bv|nv|pty|limited|incorporated)\b\.?$/i

export function normalizeInput(input: CompanyInput): NormalizedInput {
  const companyName = input.companyName
    .toLowerCase()
    .trim()
    .replace(LEGAL_SUFFIXES, '')
    .trim()

  const domain = input.domain
    ? normalizeDomain(input.domain)
    : undefined

  const country = input.country
    ? normalizeCountry(input.country)
    : 'US'

  const state = input.state?.toLowerCase().trim()
  const city = input.city?.toLowerCase().trim()
  const industry = input.industry?.toLowerCase().trim()

  const nameParts = companyName
    .split(/[\s,&+]+/)
    .filter((p) => p.length > 1)

  return { companyName, domain, city, state, country, industry, nameParts }
}

export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
}

export function normalizeCountry(country: string): string {
  const map: Record<string, string> = {
    'united states': 'US',
    usa: 'US',
    'us': 'US',
    'united kingdom': 'GB',
    uk: 'GB',
    canada: 'CA',
    ca: 'CA',
    australia: 'AU',
    au: 'AU',
  }
  return map[country.toLowerCase().trim()] ?? country.toUpperCase().slice(0, 2)
}
