import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('fetchNewsForCompany', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('builds the news query from company name, domain, and ticker identifiers', async () => {
    const fetchNews = vi.fn().mockResolvedValue([])

    const companyLookup = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'company-1',
            displayName: 'Acme Holdings',
            domain: 'https://www.acme.com',
          }]),
        }),
      }),
    }

    const identifierLookup = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { identifierValue: 'ACME' },
          { identifierValue: 'ACME' },
          { identifierValue: 'ACME.B' },
        ]),
      }),
    }

    const select = vi.fn()
      .mockReturnValueOnce(companyLookup)
      .mockReturnValueOnce(identifierLookup)

    vi.doMock('../../server/db/client.js', () => ({
      db: {
        select,
      },
    }))
    vi.doMock('../../server/providers/news/registry.js', () => ({
      getNewsProviders: () => [{ name: 'test-news', fetchNews }],
    }))
    vi.doMock('../../server/env.js', () => ({
      env: {
        NEWS_LOOKBACK_DAYS: 30,
      },
    }))

    const { fetchNewsForCompany } = await import('../../server/services/news-ingestion/ingestion-service.js')

    await expect(fetchNewsForCompany('company-1')).resolves.toEqual({ articlesIngested: 0 })
    expect(fetchNews).toHaveBeenCalledWith(
      '"Acme Holdings" OR "acme.com" OR "ACME" OR "ACME.B"',
      expect.any(Date),
      expect.any(Date),
    )
    expect(select).toHaveBeenCalledTimes(2)
  })
})
