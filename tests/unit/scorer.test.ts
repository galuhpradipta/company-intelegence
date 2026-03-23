import { describe, it, expect } from 'vitest'
import { scoreCandidate, toMatchTier } from '../../server/services/company-resolution/scorer.js'
import type { CandidateCompany, NormalizedInput } from '../../server/providers/company/types.js'

const baseInput: NormalizedInput = {
  companyName: 'apple',
  domain: 'apple.com',
  address: '1 apple park way cupertino ca',
  city: 'cupertino',
  state: 'ca',
  country: 'US',
  industry: 'technology',
  nameParts: ['apple'],
  addressParts: ['apple', 'park', 'way', 'cupertino', 'ca'],
}

const baseCandidate: CandidateCompany = {
  providerName: 'people_data_labs',
  displayName: 'Apple Inc.',
  domain: 'apple.com',
  industry: 'technology',
  hqCity: 'Cupertino',
  hqState: 'CA',
  hqCountry: 'US',
  rawPayload: {},
}

describe('scoreCandidate', () => {
  it('gives max score for perfect match with registry reliability', () => {
    const breakdown = scoreCandidate(baseCandidate, baseInput, 1.0)
    // domain=40 + name=30 (jaccard apple/apple=1) + address=15 + industry=10 + country=5 = 100
    expect(breakdown.finalScore).toBe(100)
    expect(breakdown.domainExact).toBe(40)
    expect(breakdown.nameSimilarity).toBe(30)
    expect(breakdown.countryMatch).toBe(5)
  })

  it('applies reliability factor correctly', () => {
    const r1 = scoreCandidate(baseCandidate, baseInput, 1.0)
    const r06 = scoreCandidate(baseCandidate, baseInput, 0.6)
    expect(r06.finalScore).toBeLessThan(r1.finalScore)
    expect(r06.finalScore).toBe(Math.min(100, Math.round(r1.rawTotal * 0.6)))
  })

  it('scores 0 for domain when no input domain', () => {
    const input = { ...baseInput, domain: undefined }
    const breakdown = scoreCandidate(baseCandidate, input, 1.0)
    expect(breakdown.domainExact).toBe(0)
  })

  it('scores 0 for domain on mismatch', () => {
    const candidate = { ...baseCandidate, domain: 'microsoft.com' }
    const breakdown = scoreCandidate(candidate, baseInput, 1.0)
    expect(breakdown.domainExact).toBe(0)
  })

  it('scores partial name similarity', () => {
    const candidate = { ...baseCandidate, domain: undefined, displayName: 'Apple Banana Corp' }
    const input = { ...baseInput, domain: undefined, nameParts: ['apple'] }
    const breakdown = scoreCandidate(candidate, input, 1.0)
    // jaccard: 1 intersection out of 3 unique tokens
    expect(breakdown.nameSimilarity).toBeGreaterThan(0)
    expect(breakdown.nameSimilarity).toBeLessThan(30)
  })

  it('scores 0 industry if no match', () => {
    const candidate = { ...baseCandidate, industry: 'manufacturing' }
    const breakdown = scoreCandidate(candidate, baseInput, 1.0)
    expect(breakdown.industryAlignment).toBe(0)
  })

  it('normalizes country names before comparing', () => {
    const candidate = { ...baseCandidate, hqCountry: 'United States' }
    const breakdown = scoreCandidate(candidate, baseInput, 1.0)
    expect(breakdown.countryMatch).toBe(5)
  })

  it('uses address token overlap when city and state are absent', () => {
    const input = {
      ...baseInput,
      city: undefined,
      state: undefined,
      address: '1 infinite loop cupertino ca',
      addressParts: ['infinite', 'loop', 'cupertino', 'ca'],
    }
    const breakdown = scoreCandidate(baseCandidate, input, 1.0)
    expect(breakdown.addressAlignment).toBeGreaterThan(0)
  })

  it('treats public-benefit suffixes as legal suffixes for exact name matches', () => {
    const candidate = { ...baseCandidate, displayName: 'Anthropic PBC' }
    const input = {
      ...baseInput,
      companyName: 'anthropic',
      domain: undefined,
      industry: 'ai',
      nameParts: ['anthropic'],
    }

    const breakdown = scoreCandidate(candidate, input, 0.9)
    expect(breakdown.nameSimilarity).toBe(30)
  })

  it('accepts minor city typos during address scoring', () => {
    const candidate = { ...baseCandidate, hqCity: 'San Francisco' }
    const input = {
      ...baseInput,
      city: 'san fransisco',
      state: 'ca',
      address: '1 market st',
      addressParts: ['market', 'st'],
    }

    const breakdown = scoreCandidate(candidate, input, 1.0)
    expect(breakdown.addressAlignment).toBeGreaterThanOrEqual(12)
  })

  it('promotes an exact domain and normalized-name match to confident even with small location typos', () => {
    const candidate = {
      ...baseCandidate,
      displayName: 'Anthropic PBC',
      domain: 'anthropic.com',
      industry: 'AI',
      hqCity: 'San Francisco',
      hqState: 'CA',
      hqCountry: 'US',
    }
    const input = {
      ...baseInput,
      companyName: 'anthropic',
      domain: 'anthropic.com',
      city: 'san fransisco',
      state: 'ca',
      industry: 'ai',
      address: '1 apple park way',
      addressParts: ['apple', 'park', 'way'],
      nameParts: ['anthropic'],
    }

    const breakdown = scoreCandidate(candidate, input, 0.9)
    expect(breakdown.finalScore).toBeGreaterThanOrEqual(85)
    expect(toMatchTier(breakdown.finalScore)).toBe('confident')
  })
})

describe('toMatchTier', () => {
  it('returns confident for scores >= 85', () => {
    expect(toMatchTier(85)).toBe('confident')
    expect(toMatchTier(100)).toBe('confident')
    expect(toMatchTier(90)).toBe('confident')
  })

  it('returns suggested for scores 50-84', () => {
    expect(toMatchTier(50)).toBe('suggested')
    expect(toMatchTier(75)).toBe('suggested')
    expect(toMatchTier(84)).toBe('suggested')
  })

  it('returns not_found for scores < 50', () => {
    expect(toMatchTier(0)).toBe('not_found')
    expect(toMatchTier(49)).toBe('not_found')
    expect(toMatchTier(25)).toBe('not_found')
  })
})
