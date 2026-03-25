import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('OPENAI_MODEL', 'gpt-5.4-mini')
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS', '0')
}

function createScoringDbMock() {
  const persistedValues: Array<Record<string, unknown>> = []

  const companyLookup = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{
          id: 'company-1',
          displayName: 'Apple Inc.',
          legalName: 'Apple Inc.',
          industry: 'Technology',
          employeeCount: 161000,
          hqCity: 'Cupertino',
          hqCountry: 'US',
        }]),
      }),
    }),
  }

  const articlesLookup = {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              articleId: 'article-1',
              title: 'Apple expands supply chain',
              snippet: 'Apple announced another supply-chain expansion.',
              fullText: null,
              scoreStatus: null,
            },
          ]),
        }),
      }),
    }),
  }

  const select = vi.fn()
    .mockReturnValueOnce(companyLookup)
    .mockReturnValueOnce(articlesLookup)

  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn((payload: Record<string, unknown>) => {
    persistedValues.push(payload)
    return { onConflictDoUpdate }
  })
  const insert = vi.fn().mockReturnValue({ values })

  return {
    db: { select, insert },
    persistedValues,
    onConflictDoUpdate,
  }
}

describe('scoreArticlesForCompany persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    stubServerEnv()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('persists scored rows with promptVersion v3 and uses the provided viewer company profile', async () => {
    const dbMock = createScoringDbMock()
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        relevancyScore: 88,
        category: 'operational_risk',
        explanation: 'Your Finance Manager / AR Manager should watch customer payment timing.',
      }),
    })

    vi.doMock('../../server/db/client.js', () => dbMock)
    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        responses = { create }
      },
    }))

    const {
      PROMPT_VERSION,
      scoreArticlesForCompany,
    } = await import('../../server/services/relevancy/scoring-service.js')

    await expect(scoreArticlesForCompany('company-1', {
      name: 'Acme Finance',
      domain: 'acme.example',
      roleFunction: 'Finance Manager / AR Manager',
      description: 'Acme Finance is a company operating through acme.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, and collections pressure.',
    }, {
      forceRescore: true,
    })).resolves.toEqual([
      {
        articleId: 'article-1',
        relevancyScore: 88,
        category: 'operational_risk',
        explanation: 'Your Finance Manager / AR Manager should watch customer payment timing.',
      },
    ])

    expect(PROMPT_VERSION).toBe('v3')
    expect(String(create.mock.calls[0]?.[0]?.input)).toContain('Name: Acme Finance')
    expect(String(create.mock.calls[0]?.[0]?.input)).toContain('Description: Acme Finance is a company operating through acme.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, and collections pressure.')
    expect(dbMock.persistedValues).toEqual([
      expect.objectContaining({
        companyId: 'company-1',
        articleId: 'article-1',
        promptVersion: 'v3',
        status: 'scored',
      }),
    ])
  })

  it('persists failed rows with promptVersion v3 when scoring exhausts retries', async () => {
    vi.useFakeTimers()

    const dbMock = createScoringDbMock()
    const create = vi.fn().mockRejectedValue(new Error('openai down'))

    vi.doMock('../../server/db/client.js', () => dbMock)
    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        responses = { create }
      },
    }))
    vi.doMock('../../server/services/relevancy/viewer-company-profile.js', () => ({
      getDefaultViewerCompanyProfile: vi.fn().mockResolvedValue({
        name: 'Merclex',
        domain: 'merclex.example',
        roleFunction: 'Finance Manager / AR Manager',
        description: 'Merclex is a company operating through merclex.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, and collections pressure.',
      }),
    }))

    const { scoreArticlesForCompany } = await import('../../server/services/relevancy/scoring-service.js')

    const scoring = scoreArticlesForCompany('company-1')
    await vi.runAllTimersAsync()

    await expect(scoring).resolves.toEqual([])
    expect(create).toHaveBeenCalledTimes(3)
    expect(dbMock.persistedValues).toEqual([
      expect.objectContaining({
        companyId: 'company-1',
        articleId: 'article-1',
        promptVersion: 'v3',
        status: 'failed',
      }),
    ])
  })
})
