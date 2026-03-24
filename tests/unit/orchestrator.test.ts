import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  companies,
  companyIdentifiers,
  companyMatches,
  companySourceRecords,
  resolutionInputs,
} from '../../server/db/schema/index.js'
import type { CandidateCompany, CompanyProvider } from '../../server/providers/company/types.js'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS', '1')
}

function existingCompany(id: string) {
  return {
    id,
    legalName: 'Nexus Health Systems LLC',
    industry: 'Health Technology',
    employeeCount: 320,
    hqAddress: '400 Congress Avenue',
    hqCity: 'Austin',
    hqState: 'TX',
    hqCountry: 'US',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  }
}

function createSelectMock(options: {
  identifierRows?: Array<Array<{ companyId: string }>>
  sourceRows?: Array<Array<{ companyId: string }>>
  companyRows?: Array<Array<ReturnType<typeof existingCompany>>>
}) {
  const identifierRows = [...(options.identifierRows ?? [])]
  const sourceRows = [...(options.sourceRows ?? [])]
  const companyRows = [...(options.companyRows ?? [])]
  const companyIdentifiersTable = getTableName(companyIdentifiers)
  const companySourceRecordsTable = getTableName(companySourceRecords)
  const companiesTable = getTableName(companies)

  return vi.fn(() => ({
    from: vi.fn((table) => {
      const tableName = getTableName(table)

      if (tableName === companyIdentifiersTable) {
        return {
          where: vi.fn().mockResolvedValue(identifierRows.shift() ?? []),
        }
      }

      if (tableName === companySourceRecordsTable) {
        return {
          where: vi.fn().mockResolvedValue(sourceRows.shift() ?? []),
        }
      }

      if (tableName === companiesTable) {
        return {
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(companyRows.shift() ?? []),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table in select mock: ${String(table)}`)
    }),
  }))
}

function createProviderRegistry(
  deterministicProviders: CompanyProvider[],
  fallbackProvider: CompanyProvider,
) {
  const byName = new Map(
    [...deterministicProviders, fallbackProvider].map((provider) => [provider.name, provider]),
  )

  return {
    getDeterministicCompanyProviders: () => deterministicProviders,
    getFallbackCompanyProvider: () => fallbackProvider,
    getCompanyProviderByName: (name: string) => byName.get(name),
  }
}

function createResolveDb(select = vi.fn()) {
  const insertedCompanies: Array<Record<string, unknown>> = []
  const updatedCompanies: Array<Record<string, unknown>> = []
  const matchValues: Array<Record<string, unknown>> = []
  let resolutionInputCount = 0
  const resolutionInputsTable = getTableName(resolutionInputs)
  const companiesTable = getTableName(companies)
  const companySourceRecordsTable = getTableName(companySourceRecords)
  const companyIdentifiersTable = getTableName(companyIdentifiers)
  const companyMatchesTable = getTableName(companyMatches)

  const insert = vi.fn((table) => {
    const tableName = getTableName(table)

    if (tableName === resolutionInputsTable) {
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: `input-${++resolutionInputCount}` },
          ]),
        }),
      }
    }

    if (tableName === companiesTable) {
      return {
        values: vi.fn((values) => {
          insertedCompanies.push(values)
          return {
            returning: vi.fn().mockResolvedValue([
              { id: `company-${insertedCompanies.length}` },
            ]),
          }
        }),
      }
    }

    if (tableName === companySourceRecordsTable || tableName === companyIdentifiersTable) {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }
    }

    if (tableName === companyMatchesTable) {
      return {
        values: vi.fn((values) => {
          matchValues.push(values)
          return Promise.resolve(undefined)
        }),
      }
    }

    throw new Error(`Unexpected table in insert mock: ${String(table)}`)
  })

  const update = vi.fn((table) => {
    const tableName = getTableName(table)

    if (tableName === companiesTable || tableName === resolutionInputsTable) {
      return {
        set: vi.fn((values) => {
          if (tableName === companiesTable) {
            updatedCompanies.push(values)
          }

          return {
            where: vi.fn().mockResolvedValue(undefined),
          }
        }),
      }
    }

    throw new Error(`Unexpected table in update mock: ${String(table)}`)
  })

  return {
    db: {
      insert,
      update,
      select,
    },
    insertedCompanies,
    updatedCompanies,
    matchValues,
  }
}

describe('resolveCompany', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('marks below-50 matches as not_found and does not auto-select them', async () => {
    const aiFallbackCandidate: CandidateCompany = {
      providerName: 'ai_fallback',
      displayName: 'Delta Robotics Advisors',
      legalName: 'Delta Robotics Advisors',
      hqCountry: 'US',
      rawPayload: { source: 'fixture-ai' },
    }

    const fallbackProvider = {
      name: 'ai_fallback',
      reliabilityFactor: 0.6,
      search: vi.fn().mockResolvedValue([aiFallbackCandidate]),
    } satisfies CompanyProvider

    const dbMock = createResolveDb()

    vi.doMock('../../server/db/client.js', () => dbMock)
    vi.doMock('../../server/providers/company/registry.js', () =>
      createProviderRegistry([], fallbackProvider),
    )

    const { resolveCompany } = await import('../../server/services/company-resolution/orchestrator.js')
    const result = await resolveCompany({
      companyName: 'Delta Robotics Advisors',
    })

    expect(result.topTier).toBe('not_found')
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.matchTier).toBe('not_found')
    expect(dbMock.matchValues[0]).toMatchObject({
      rank: 1,
      selected: false,
    })
  })

  it('reuses the same canonical company across repeated resolutions when identifiers match', async () => {
    const secCandidate: CandidateCompany = {
      providerName: 'sec_edgar',
      providerRecordId: '0001987654',
      displayName: 'Nexus Health Systems',
      legalName: 'Nexus Health Systems',
      industry: 'Health Technology',
      hqAddress: '400 Congress Avenue',
      hqCity: 'Austin',
      hqState: 'TX',
      hqCountry: 'US',
      identifiers: [
        { identifierType: 'cik', identifierValue: '0001987654', source: 'sec_edgar' },
        { identifierType: 'ticker', identifierValue: 'NXHS', source: 'sec_edgar' },
      ],
      rawPayload: {
        cik: '0001987654',
        ticker: 'NXHS',
      },
    }

    const secProvider = {
      name: 'sec_edgar',
      reliabilityFactor: 1,
      search: vi.fn().mockResolvedValue([secCandidate]),
    } satisfies CompanyProvider

    const fallbackProvider = {
      name: 'ai_fallback',
      reliabilityFactor: 0.6,
      search: vi.fn().mockResolvedValue([]),
    } satisfies CompanyProvider

    const select = createSelectMock({
      identifierRows: [
        [],
        [{ companyId: 'company-1' }],
      ],
      sourceRows: [[]],
      companyRows: [[existingCompany('company-1')]],
    })
    const dbMock = createResolveDb(select)

    vi.doMock('../../server/db/client.js', () => dbMock)
    vi.doMock('../../server/providers/company/registry.js', () =>
      createProviderRegistry([secProvider], fallbackProvider),
    )

    const { resolveCompany } = await import('../../server/services/company-resolution/orchestrator.js')

    const first = await resolveCompany({
      companyName: 'Nexus Health Systems',
      city: 'Austin',
      state: 'TX',
      industry: 'Health',
    })

    const second = await resolveCompany({
      companyName: 'Nexus Health Systems',
      city: 'Austin',
      industry: 'Health',
    })

    expect(first.topTier).toBe('suggested')
    expect(second.topTier).toBe('suggested')
    expect(first.candidates[0]?.companyId).toBe('company-1')
    expect(second.candidates[0]?.companyId).toBe('company-1')
    expect(dbMock.insertedCompanies).toHaveLength(1)
    expect(dbMock.updatedCompanies).toHaveLength(1)
  })
})

describe('findExistingCanonicalCompany', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers the oldest canonical company matched by stable identifier', async () => {
    const select = createSelectMock({
      identifierRows: [[
        { companyId: 'company-2' },
        { companyId: 'company-1' },
      ]],
      companyRows: [[existingCompany('company-1')]],
    })

    vi.doMock('../../server/db/client.js', () => ({
      db: { select },
    }))

    const { findExistingCanonicalCompany } = await import('../../server/services/company-resolution/orchestrator.js')

    const result = await findExistingCanonicalCompany({
      normalizedDomain: null,
      identifiers: [
        { identifierType: 'ticker', identifierValue: 'NXHS', source: 'sec_edgar' },
      ],
      sources: [],
    })

    expect(result?.id).toBe('company-1')
  })

  it('falls back to provider record matches when no stable identifier already exists', async () => {
    const select = createSelectMock({
      identifierRows: [[]],
      sourceRows: [[{ companyId: 'company-3' }]],
      companyRows: [[existingCompany('company-3')]],
    })

    vi.doMock('../../server/db/client.js', () => ({
      db: { select },
    }))

    const { findExistingCanonicalCompany } = await import('../../server/services/company-resolution/orchestrator.js')

    const result = await findExistingCanonicalCompany({
      normalizedDomain: null,
      identifiers: [],
      sources: [{
        providerName: 'opencorporates',
        providerRecordId: 'oc_nexus_health_001',
        displayName: 'Nexus Health Systems',
        rawPayload: {},
      }],
    })

    expect(result?.id).toBe('company-3')
  })

  it('falls back to normalized domain matching when identifier and source lookups miss', async () => {
    const select = createSelectMock({
      companyRows: [[existingCompany('company-4')]],
    })

    vi.doMock('../../server/db/client.js', () => ({
      db: { select },
    }))

    const { findExistingCanonicalCompany } = await import('../../server/services/company-resolution/orchestrator.js')

    const result = await findExistingCanonicalCompany({
      normalizedDomain: 'nexushealth.com',
      identifiers: [],
      sources: [],
    })

    expect(result?.id).toBe('company-4')
  })
})
