import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('buildBatchStatusPayload', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds selected candidates, trims suggestions to top 3, and computes aggregate counts', async () => {
    const { buildBatchStatusPayload } = await import('../../server/services/batch/status.js')
    const result = buildBatchStatusPayload({
      batch: {
        id: 'batch-1',
        status: 'completed',
        totalRows: 4,
        processedRows: 4,
      },
      items: [
        {
          rowNumber: 1,
          rawInput: {
            company_name: 'Acme Corp',
            domain: 'acme.com',
          },
          status: 'completed',
          resolutionInputId: 'input-1',
          resultCompanyId: 'company-1',
          errorMessage: null,
        },
        {
          rowNumber: 2,
          rawInput: {
            company_name: 'Beta Labs',
            address: '10 Market Street',
            city: 'San Francisco',
          },
          status: 'completed',
          resolutionInputId: 'input-2',
          resultCompanyId: null,
          errorMessage: null,
        },
        {
          rowNumber: 3,
          rawInput: {
            company_name: 'Gamma Systems',
            industry: 'Robotics',
          },
          status: 'completed',
          resolutionInputId: 'input-3',
          resultCompanyId: null,
          errorMessage: null,
        },
        {
          rowNumber: 4,
          rawInput: {
            company_name: 'Delta Robotics',
          },
          status: 'failed',
          resolutionInputId: null,
          resultCompanyId: null,
          errorMessage: 'provider timeout',
        },
      ],
      inputRecords: [
        {
          id: 'input-1',
          rawInput: {
            companyName: 'Acme Corp',
            domain: 'acme.com',
          },
        },
        {
          id: 'input-2',
          rawInput: {
            companyName: 'Beta Labs',
            address: '10 Market Street',
            city: 'San Francisco',
          },
        },
        {
          id: 'input-3',
          rawInput: {
            companyName: 'Gamma Systems',
            industry: 'Robotics',
          },
        },
      ],
      matchRecords: [
        {
          resolutionInputId: 'input-1',
          companyId: 'company-1',
          rank: 1,
          score: 94,
          selected: true,
        },
        {
          resolutionInputId: 'input-2',
          companyId: 'company-2',
          rank: 1,
          score: 81,
          selected: false,
        },
        {
          resolutionInputId: 'input-2',
          companyId: 'company-3',
          rank: 2,
          score: 77,
          selected: false,
        },
        {
          resolutionInputId: 'input-2',
          companyId: 'company-4',
          rank: 3,
          score: 73,
          selected: true,
        },
        {
          resolutionInputId: 'input-2',
          companyId: 'company-5',
          rank: 4,
          score: 70,
          selected: false,
        },
        {
          resolutionInputId: 'input-3',
          companyId: 'company-6',
          rank: 1,
          score: 42,
          selected: false,
        },
      ],
      companyRecords: [
        { id: 'company-1', displayName: 'Acme Corporation', domain: 'acme.com' },
        { id: 'company-2', displayName: 'Beta Labs Inc.', domain: 'betalabs.com' },
        { id: 'company-3', displayName: 'Beta Labs Holdings', domain: 'beta-holdings.com' },
        { id: 'company-4', displayName: 'Beta Labs LLC', domain: 'betalabs.co' },
        { id: 'company-5', displayName: 'Beta Labs Group', domain: 'betalabsgroup.com' },
        { id: 'company-6', displayName: 'Gamma Systems Research', domain: null },
      ],
      sourceRecords: [
        { companyId: 'company-1', provider: 'people_data_labs' },
        { companyId: 'company-1', provider: 'sec_edgar' },
        { companyId: 'company-4', provider: 'people_data_labs' },
        { companyId: 'company-4', provider: 'people_data_labs' },
        { companyId: 'company-4', provider: 'opencorporates' },
        { companyId: 'company-6', provider: 'ai_fallback' },
      ],
    })

    expect(result.counts).toEqual({
      confident: 1,
      suggested: 1,
      notFound: 1,
      failed: 1,
    })

    expect(result.items[0]).toMatchObject({
      rowNumber: 1,
      matchTier: 'confident',
      confidenceScore: 94,
      selectedCandidate: {
        companyId: 'company-1',
        displayName: 'Acme Corporation',
        sourceProviders: ['people_data_labs', 'sec_edgar'],
        selected: true,
      },
    })

    expect(result.items[1]?.matchTier).toBe('suggested')
    expect(result.items[1]?.suggestedCandidates).toHaveLength(3)
    expect(result.items[1]?.selectedCandidate).toMatchObject({
      companyId: 'company-4',
      displayName: 'Beta Labs LLC',
      confidenceScore: 73,
      sourceProviders: ['people_data_labs', 'opencorporates'],
      selected: true,
    })
    expect(result.items[1]?.suggestedCandidates.map((candidate) => candidate.companyId)).toEqual([
      'company-2',
      'company-3',
      'company-4',
    ])

    expect(result.items[2]).toMatchObject({
      rowNumber: 3,
      companyId: null,
      matchTier: 'not_found',
      confidenceScore: 0,
      submittedInput: {
        companyName: 'Gamma Systems',
        industry: 'Robotics',
      },
      selectedCandidate: null,
      suggestedCandidates: [],
    })

    expect(result.items[3]).toMatchObject({
      rowNumber: 4,
      status: 'failed',
      matchTier: null,
      errorMessage: 'provider timeout',
      submittedInput: {
        companyName: 'Delta Robotics',
      },
    })
  })
})
