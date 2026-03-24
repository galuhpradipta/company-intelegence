import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('PEOPLE_DATA_LABS_API_KEY', 'test-pdl-key')
  vi.stubEnv('PROVIDER_TIMEOUT_MS', '1000')
}

describe('PeopleDataLabsProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('calls the enrichment endpoint and maps the response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pdl_apple',
        name: 'Apple Inc.',
        legal_name: 'Apple Inc.',
        updated_at: '2026-03-20T00:00:00.000Z',
        website: 'apple.com',
        industry: 'consumer electronics',
        employee_count: 161000,
        location: {
          street_address: '1 Apple Park Way',
          locality: 'Cupertino',
          region: 'CA',
          country: 'US',
        },
      }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { PeopleDataLabsProvider } = await import('../../server/providers/company/people-data-labs.js')
    const provider = new PeopleDataLabsProvider()

    const results = await provider.search({
      companyName: 'apple',
      domain: 'apple.com',
      city: 'cupertino',
      state: 'california',
      country: 'US',
      industry: 'technology',
      nameParts: ['apple'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v5/company/enrich?')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('website=apple.com')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        'X-Api-Key': 'test-pdl-key',
        Accept: 'application/json',
      },
    })
    expect(results).toEqual([
      expect.objectContaining({
        providerName: 'people_data_labs',
        providerRecordId: 'pdl_apple',
        sourceUpdatedAt: '2026-03-20T00:00:00.000Z',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        industry: 'consumer electronics',
        employeeCount: 161000,
        hqAddress: '1 Apple Park Way',
        hqCity: 'Cupertino',
        hqState: 'CA',
        hqCountry: 'US',
      }),
    ])
  })

  it('returns no results on 404', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response))

    const { PeopleDataLabsProvider } = await import('../../server/providers/company/people-data-labs.js')
    const provider = new PeopleDataLabsProvider()

    const results = await provider.search({
      companyName: 'unknown',
      country: 'US',
      nameParts: ['unknown'],
    })

    expect(results).toEqual([])
  })
})
