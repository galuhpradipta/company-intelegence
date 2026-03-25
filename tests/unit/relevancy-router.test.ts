import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

describe('relevancyRouter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns the default viewer company profile and exposes AI description generation', async () => {
    const getDefaultViewerCompanyProfile = vi.fn().mockResolvedValue({
      name: 'Merclex',
      domain: 'merclex.example',
      roleFunction: 'Finance Manager / AR Manager',
      description: 'Merclex tracks collections exposure and customer payment timing.',
    })
    const generateViewerCompanyDescription = vi.fn().mockResolvedValue(
      'Merclex monitors customer health and payment timing for finance teams.',
    )

    vi.doMock('../../server/services/relevancy/index.js', () => ({
      scoreArticlesForCompany: vi.fn(),
    }))
    vi.doMock('../../server/services/relevancy/viewer-company-profile.js', () => ({
      getDefaultViewerCompanyProfile,
      generateViewerCompanyDescription,
      viewerCompanyProfileSeedSchema: z.object({
        name: z.string().min(1),
        domain: z.string().min(1),
        roleFunction: z.string().min(1),
        description: z.string().optional(),
      }),
    }))

    const { relevancyRouter } = await import('../../server/trpc/routers/relevancy.js')
    const caller = relevancyRouter.createCaller({})

    await expect(caller.viewerCompanyProfile()).resolves.toEqual({
      name: 'Merclex',
      domain: 'merclex.example',
      roleFunction: 'Finance Manager / AR Manager',
      description: 'Merclex tracks collections exposure and customer payment timing.',
    })

    await expect(caller.generateViewerCompanyDescription({
      name: 'Acme Finance',
      domain: 'acme.example',
      roleFunction: 'Finance Manager / AR Manager',
    })).resolves.toEqual({
      description: 'Merclex monitors customer health and payment timing for finance teams.',
    })

    expect(generateViewerCompanyDescription).toHaveBeenCalledWith({
      name: 'Acme Finance',
      domain: 'acme.example',
      roleFunction: 'Finance Manager / AR Manager',
    })
  })
})
