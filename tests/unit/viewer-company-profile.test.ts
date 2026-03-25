import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('OPENAI_MODEL', 'gpt-5.4-mini')

  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value)
  }
}

describe('viewer company profile helper', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns the static saved profile with a deterministic description in test mode', async () => {
    stubServerEnv({
      NODE_ENV: 'test',
      COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS: '1',
    })

    const {
      DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      buildDeterministicViewerCompanyDescription,
      getDefaultViewerCompanyProfile,
    } = await import('../../server/services/relevancy/viewer-company-profile.js')

    await expect(getDefaultViewerCompanyProfile()).resolves.toEqual({
      ...DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      description: buildDeterministicViewerCompanyDescription(DEFAULT_VIEWER_COMPANY_PROFILE_SEED),
    })
  })

  it('generates and caches the AI description when mock mode is disabled', async () => {
    stubServerEnv({
      NODE_ENV: 'development',
      COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS: '0',
    })

    const create = vi.fn().mockResolvedValue({
      output_text: 'Merclex supports finance teams with customer-risk and payment-timing visibility.',
    })

    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        responses = { create }
      },
    }))

    const {
      DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      getDefaultViewerCompanyProfile,
    } = await import('../../server/services/relevancy/viewer-company-profile.js')

    const first = await getDefaultViewerCompanyProfile()
    const second = await getDefaultViewerCompanyProfile()

    expect(create).toHaveBeenCalledTimes(1)
    expect(first).toEqual({
      ...DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      description: 'Merclex supports finance teams with customer-risk and payment-timing visibility.',
    })
    expect(second).toEqual(first)
  })

  it('falls back to the deterministic description when AI generation fails', async () => {
    stubServerEnv({
      NODE_ENV: 'development',
      COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS: '0',
    })

    const create = vi.fn().mockRejectedValue(new Error('generation failed'))
    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        responses = { create }
      },
    }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const {
      DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      buildDeterministicViewerCompanyDescription,
      getDefaultViewerCompanyProfile,
    } = await import('../../server/services/relevancy/viewer-company-profile.js')

    await expect(getDefaultViewerCompanyProfile()).resolves.toEqual({
      ...DEFAULT_VIEWER_COMPANY_PROFILE_SEED,
      description: buildDeterministicViewerCompanyDescription(DEFAULT_VIEWER_COMPANY_PROFILE_SEED),
    })
    expect(warnSpy).toHaveBeenCalled()
  })
})
