import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

describe('newsRouter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('accepts a browser-driven viewer company profile when refreshing news', async () => {
    const refreshCompanyNews = vi.fn().mockResolvedValue({
      articlesIngested: 2,
      articlesScored: 2,
    })

    vi.doMock('../../server/services/news-ingestion/index.js', () => ({
      listNewsByCompany: vi.fn(),
      refreshCompanyNews,
    }))
    vi.doMock('../../server/services/relevancy/viewer-company-profile.js', () => ({
      viewerCompanyProfileSchema: z.object({
        name: z.string().min(1),
        domain: z.string().min(1),
        roleFunction: z.string().min(1),
        description: z.string().min(1),
      }),
    }))

    const { newsRouter } = await import('../../server/trpc/routers/news.js')
    const caller = newsRouter.createCaller({})

    await expect(caller.refreshForCompany({
      companyId: '11111111-1111-4111-8111-111111111111',
      viewerCompanyProfile: {
        name: 'Acme Finance',
        domain: 'acme.example',
        roleFunction: 'Finance Manager / AR Manager',
        description: 'Acme watches payment timing and customer concentration.',
      },
    })).resolves.toEqual({
      articlesIngested: 2,
      articlesScored: 2,
    })

    expect(refreshCompanyNews).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        name: 'Acme Finance',
        domain: 'acme.example',
        roleFunction: 'Finance Manager / AR Manager',
        description: 'Acme watches payment timing and customer concentration.',
      },
    )
  })
})
