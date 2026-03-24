import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('PROVIDER_TIMEOUT_MS', '1000')
}

describe('SecEdgarProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('matches against SEC JSON datasets and returns enriched company data', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cik: '0000320193',
          name: 'Apple Inc.',
          sicDescription: 'Electronic Computers',
          addresses: {
            business: {
              street1: '1 Apple Park Way',
              city: 'CUPERTINO',
              stateOrCountry: 'CA',
            },
          },
          formerNames: [{ name: 'APPLE COMPUTER INC' }],
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { SecEdgarProvider } = await import('../../server/providers/company/sec-edgar.js')
    const provider = new SecEdgarProvider()

    const results = await provider.search({
      companyName: 'apple',
      country: 'US',
      nameParts: ['apple'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('company_tickers.json')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('CIK0000320193.json')
    expect(results).toEqual([
      expect.objectContaining({
        providerName: 'sec_edgar',
        providerRecordId: '0000320193',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        industry: 'Electronic Computers',
        hqAddress: '1 Apple Park Way',
        hqCity: 'CUPERTINO',
        hqState: 'CA',
        hqCountry: 'US',
        aliases: ['APPLE COMPUTER INC'],
      }),
    ])
  })

  it('skips non-US requests', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const { SecEdgarProvider } = await import('../../server/providers/company/sec-edgar.js')
    const provider = new SecEdgarProvider()

    const results = await provider.search({
      companyName: 'apple',
      country: 'GB',
      nameParts: ['apple'],
    })

    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
