import type { CompanyProvider, CandidateCompany, NormalizedInput } from './types.js'
import { env } from '../../env.js'

/**
 * SEC EDGAR company search provider.
 * Completely free, no API key required.
 * Uses the SEC's JSON datasets rather than the browse-edgar Atom output, which is
 * currently too inconsistent to parse reliably for company metadata.
 */
export class SecEdgarProvider implements CompanyProvider {
  name = 'sec_edgar'
  reliabilityFactor = 1.0

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    if (input.country && input.country !== 'US') {
      return []
    }

    try {
      const tickers = await getSecTickers()
      const matches = tickers
        .map((entry) => ({ entry, score: scoreTickerEntry(entry, input) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      const submissions = await Promise.all(
        matches.map(({ entry }) => fetchCompanySubmission(entry.cik_str))
      )

      return submissions.flatMap((submission, index) =>
        submission ? [toCandidate(submission, matches[index].entry)] : []
      )
    } catch (err) {
      console.warn('[SecEdgar] Request failed:', err)
      return []
    }
  }
}

interface SecTickerEntry {
  cik_str: number
  ticker: string
  title: string
}

interface SecSubmission {
  cik: string
  name: string
  sicDescription?: string
  filedAsOfDate?: string
  website?: string
  phone?: string
  tickers?: string[]
  filings?: {
    recent?: {
      filingDate?: string[]
    }
  }
  addresses?: {
    business?: {
      street1?: string | null
      street2?: string | null
      city?: string | null
      stateOrCountry?: string | null
      zipCode?: string | null
    }
  }
  formerNames?: Array<{ name?: string }>
}

const SEC_HEADERS = {
  'User-Agent': 'company-intelligence contact@example.com',
  Accept: 'application/json',
}

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'
const SEC_SUBMISSIONS_URL = (cik: string) => `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`
const TICKER_CACHE_TTL_MS = 1000 * 60 * 60 * 6

let tickerCache: SecTickerEntry[] | null = null
let tickerCacheExpiresAt = 0
let tickerCachePromise: Promise<SecTickerEntry[]> | null = null

async function getSecTickers(): Promise<SecTickerEntry[]> {
  const now = Date.now()
  if (tickerCache && tickerCacheExpiresAt > now) {
    return tickerCache
  }
  if (tickerCachePromise) {
    return tickerCachePromise
  }

  tickerCachePromise = fetch(SEC_TICKERS_URL, {
    signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
    headers: SEC_HEADERS,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`SEC ticker index error ${res.status}`)
      }
      const data = await res.json() as Record<string, SecTickerEntry>
      return Object.values(data)
    })
    .then((records) => {
      tickerCache = records
      tickerCacheExpiresAt = Date.now() + TICKER_CACHE_TTL_MS
      return records
    })
    .finally(() => {
      tickerCachePromise = null
    })

  return tickerCachePromise
}

async function fetchCompanySubmission(cik: number): Promise<SecSubmission | null> {
  const res = await fetch(SEC_SUBMISSIONS_URL(String(cik)), {
    signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
    headers: SEC_HEADERS,
  })
  if (!res.ok) {
    console.warn(`[SecEdgar] Submission lookup failed for CIK ${cik}: ${res.status}`)
    return null
  }
  return res.json() as Promise<SecSubmission>
}

const LEGAL_SUFFIXES = /\b(inc|llc|ltd|corp|co|plc|gmbh|ag|sa|sas|bv|nv|pty|limited|incorporated)\b\.?/gi

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[/.(),-]/g, ' ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(' ').filter((token) => token.length > 1)
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((token) => setB.has(token)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function scoreTickerEntry(entry: SecTickerEntry, input: NormalizedInput): number {
  const normalizedTitle = normalizeName(entry.title)
  if (!normalizedTitle) return 0

  if (normalizedTitle === input.companyName) {
    return 100
  }
  if (entry.ticker.toLowerCase() === input.companyName) {
    return 95
  }
  if (normalizedTitle.startsWith(`${input.companyName} `) || normalizedTitle.includes(` ${input.companyName} `)) {
    return 85
  }

  const score = Math.round(jaccardSimilarity(tokenize(entry.title), input.nameParts) * 70)
  return score >= 20 ? score : 0
}

function toCandidate(submission: SecSubmission, entry: SecTickerEntry): CandidateCompany {
  const identifiers = [
    {
      identifierType: 'cik',
      identifierValue: submission.cik,
      source: 'sec_edgar',
    },
    {
      identifierType: 'ticker',
      identifierValue: entry.ticker,
      source: 'sec_edgar',
    },
    ...(submission.tickers ?? []).map((ticker) => ({
      identifierType: 'ticker',
      identifierValue: ticker,
      source: 'sec_edgar',
    })),
  ]

  return {
    providerName: 'sec_edgar',
    providerRecordId: submission.cik,
    sourceUpdatedAt: submission.filedAsOfDate ?? submission.filings?.recent?.filingDate?.[0],
    displayName: submission.name ?? entry.title,
    legalName: submission.name ?? entry.title,
    domain: submission.website || undefined,
    industry: submission.sicDescription || undefined,
    hqAddress: joinAddressLines(
      submission.addresses?.business?.street1,
      submission.addresses?.business?.street2,
    ),
    hqCity: submission.addresses?.business?.city ?? undefined,
    hqState: submission.addresses?.business?.stateOrCountry ?? undefined,
    hqCountry: 'US',
    aliases: submission.formerNames?.map((item) => item.name).filter((value): value is string => Boolean(value)),
    identifiers,
    rawPayload: {
      cik: submission.cik,
      ticker: entry.ticker,
      tickers: submission.tickers,
      title: entry.title,
      filedAsOfDate: submission.filedAsOfDate,
      filings: submission.filings,
      sicDescription: submission.sicDescription,
      addresses: submission.addresses,
      formerNames: submission.formerNames,
    },
  }
}

function joinAddressLines(...values: Array<string | null | undefined>): string | undefined {
  const normalized = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim())

  return normalized.length > 0 ? normalized.join(', ') : undefined
}
