import type { CandidateCompany, NormalizedInput } from '../providers/company/types.js'
import type { NewsArticle } from '../providers/news/types.js'

type RelevancyCategory =
  | 'financial_performance'
  | 'litigation_legal'
  | 'leadership_change'
  | 'operational_risk'
  | 'market_expansion'
  | 'industry_sector'

interface MockArticleScore {
  relevancyScore: number
  category: RelevancyCategory
  explanation: string
}

interface MockCompanyScenario {
  aliases: string[]
  candidates: CandidateCompany[]
}

interface MockNewsScenario {
  aliases: string[]
  articles: NewsArticle[]
}

const COMPANY_SCENARIOS: MockCompanyScenario[] = [
  {
    aliases: ['apple', 'apple inc', 'apple inc.', 'apple.com'],
    candidates: [
      {
        providerName: 'people_data_labs',
        providerRecordId: 'pdl_apple',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        industry: 'Technology',
        employeeCount: 161000,
        hqAddress: '1 Apple Park Way',
        hqCity: 'Cupertino',
        hqState: 'CA',
        hqCountry: 'US',
        identifiers: [
          {
            identifierType: 'people_data_labs_id',
            identifierValue: 'pdl_apple',
            source: 'people_data_labs',
          },
        ],
        rawPayload: {
          id: 'pdl_apple',
          website: 'apple.com',
        },
      },
      {
        providerName: 'sec_edgar',
        providerRecordId: '0000320193',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        industry: 'Technology',
        hqAddress: '1 Apple Park Way',
        hqCity: 'Cupertino',
        hqState: 'CA',
        hqCountry: 'US',
        identifiers: [
          { identifierType: 'cik', identifierValue: '0000320193', source: 'sec_edgar' },
          { identifierType: 'ticker', identifierValue: 'AAPL', source: 'sec_edgar' },
        ],
        rawPayload: {
          cik: '0000320193',
          ticker: 'AAPL',
        },
      },
    ],
  },
  {
    aliases: ['acme corp', 'acme corporation', 'acme.com'],
    candidates: [
      {
        providerName: 'people_data_labs',
        providerRecordId: 'pdl_acme',
        displayName: 'Acme Corp',
        legalName: 'Acme Corporation',
        domain: 'acme.com',
        industry: 'Software',
        employeeCount: 2000,
        hqAddress: '500 Pine Street',
        hqCity: 'Seattle',
        hqState: 'WA',
        hqCountry: 'US',
        identifiers: [
          {
            identifierType: 'people_data_labs_id',
            identifierValue: 'pdl_acme',
            source: 'people_data_labs',
          },
        ],
        rawPayload: {
          id: 'pdl_acme',
          website: 'acme.com',
        },
      },
    ],
  },
  {
    aliases: ['beta labs', 'beta labs inc', 'betalabs.com'],
    candidates: [
      {
        providerName: 'people_data_labs',
        providerRecordId: 'pdl_beta',
        displayName: 'Beta Labs Inc.',
        legalName: 'Beta Labs Inc.',
        domain: 'betalabs.com',
        industry: 'AI',
        employeeCount: 120,
        hqAddress: '200 Mission Street',
        hqCity: 'San Francisco',
        hqState: 'CA',
        hqCountry: 'US',
        identifiers: [
          {
            identifierType: 'people_data_labs_id',
            identifierValue: 'pdl_beta',
            source: 'people_data_labs',
          },
        ],
        rawPayload: {
          id: 'pdl_beta',
          website: 'betalabs.com',
        },
      },
    ],
  },
]

const NEWS_SCENARIOS: MockNewsScenario[] = [
  {
    aliases: ['apple', 'apple inc', 'apple inc.'],
    articles: [
      {
        title: 'Apple expands supply chain',
        url: 'https://example.com/apple-expands-supply-chain',
        sourceName: 'Example News',
        publishedAt: new Date('2026-03-24T00:00:00.000Z'),
        snippet: 'Apple announced another supply-chain expansion.',
        fullText: 'Apple announced another supply-chain expansion tied to services and device operations.',
        rawPayload: { source: 'fixture' },
      },
      {
        title: 'Supplier filing rumor',
        url: 'https://example.com/apple-supplier-rumor',
        sourceName: 'Trade Journal',
        publishedAt: new Date('2026-03-23T00:00:00.000Z'),
        snippet: 'A rumor mentions suppliers without material Apple impact.',
        fullText: 'A rumor mentions suppliers without direct evidence of a material Apple impact.',
        rawPayload: { source: 'fixture' },
      },
    ],
  },
]

export function getMockCompanyCandidates(input: NormalizedInput, providerName: string): CandidateCompany[] {
  const scenario = COMPANY_SCENARIOS.find((candidateScenario) => matchesAliases(candidateScenario.aliases, input))

  if (!scenario) return []

  return scenario.candidates
    .filter((candidate) => candidate.providerName === providerName)
    .map(cloneCandidate)
}

export function getMockNewsArticles(query: string, fromDate: Date, toDate: Date): NewsArticle[] {
  const normalizedQuery = normalizeValue(query)
  const scenario = NEWS_SCENARIOS.find((newsScenario) =>
    newsScenario.aliases.some((alias) => normalizedQuery.includes(alias)),
  )

  if (!scenario) return []

  return scenario.articles
    .filter((article) => article.publishedAt >= fromDate && article.publishedAt <= toDate)
    .map(cloneArticle)
}

export function getMockArticleScore(article: { articleId?: string; title: string }): MockArticleScore {
  const normalizedTitle = normalizeValue(article.title)

  if (normalizedTitle.includes('apple expands supply chain')) {
    return {
      relevancyScore: 92,
      category: 'market_expansion',
      explanation: 'Expansion is directly tied to Apple operations and growth plans.',
    }
  }

  if (normalizedTitle.includes('supplier filing rumor')) {
    return {
      relevancyScore: 18,
      category: 'industry_sector',
      explanation: 'The article is only an indirect rumor with weak company impact.',
    }
  }

  return {
    relevancyScore: 56,
    category: 'industry_sector',
    explanation: 'The article is relevant enough for demo coverage but not a core company event.',
  }
}

function matchesAliases(aliases: string[], input: NormalizedInput) {
  const searchable = [
    input.companyName,
    input.domain,
  ]
    .filter(Boolean)
    .map((value) => normalizeValue(value!))

  return aliases.some((alias) =>
    searchable.some((value) => value.includes(alias) || alias.includes(value)),
  )
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function cloneCandidate(candidate: CandidateCompany): CandidateCompany {
  return {
    ...candidate,
    identifiers: candidate.identifiers?.map((identifier) => ({ ...identifier })),
    rawPayload: structuredClone(candidate.rawPayload),
  }
}

function cloneArticle(article: NewsArticle): NewsArticle {
  return {
    ...article,
    publishedAt: new Date(article.publishedAt),
    rawPayload: structuredClone(article.rawPayload),
  }
}
