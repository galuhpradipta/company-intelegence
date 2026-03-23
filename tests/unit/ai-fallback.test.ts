import { beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('OPENAI_FALLBACK_MODEL', 'gpt-5.4')
}

describe('AiFallbackProvider helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  it('marks every candidate property as required for strict structured outputs', async () => {
    const { aiFallbackResponseSchema } = await import('../../server/providers/company/ai-fallback.js')
    const candidateItem = aiFallbackResponseSchema.properties.candidates.items

    expect(candidateItem.required).toEqual(Object.keys(candidateItem.properties))
  })

  it('normalizes empty strings to undefined', async () => {
    const { normalizeOptionalText } = await import('../../server/providers/company/ai-fallback.js')

    expect(normalizeOptionalText('')).toBeUndefined()
    expect(normalizeOptionalText('   ')).toBeUndefined()
    expect(normalizeOptionalText('apple.com')).toBe('apple.com')
  })
})
