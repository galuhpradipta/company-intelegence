import { normalizeDomain } from '../company-resolution/normalizer.js'

interface NewsSearchQueryInput {
  companyName: string
  domain?: string | null
  tickers?: string[]
}

const MAX_TICKERS_IN_QUERY = 2

export function buildNewsSearchQuery({ companyName, domain, tickers = [] }: NewsSearchQueryInput): string {
  const baseName = normalizeSearchTerm(companyName)
  const clauses = [quoteTerm(baseName)]
  const seen = new Set([baseName.toLowerCase()])

  const normalizedDomain = domain
    ? normalizeDomain(domain)
    : undefined

  if (normalizedDomain && !seen.has(normalizedDomain)) {
    clauses.push(quoteTerm(normalizedDomain))
    seen.add(normalizedDomain)
  }

  for (const ticker of normalizeTickers(tickers)) {
    const normalizedTicker = ticker.toLowerCase()
    if (seen.has(normalizedTicker)) continue

    clauses.push(quoteTerm(ticker))
    seen.add(normalizedTicker)
  }

  return clauses.join(' OR ')
}

function normalizeTickers(tickers: string[]): string[] {
  const seen = new Set<string>()
  const uniqueTickers: string[] = []

  for (const ticker of tickers) {
    const normalized = normalizeSearchTerm(ticker).toUpperCase()
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    uniqueTickers.push(normalized)

    if (uniqueTickers.length >= MAX_TICKERS_IN_QUERY) {
      break
    }
  }

  return uniqueTickers
}

function quoteTerm(value: string): string {
  return `"${value}"`
}

function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/"/g, '')
}
