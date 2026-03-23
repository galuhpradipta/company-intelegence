import { describe, it, expect } from 'vitest'
import { normalizeInput, normalizeDomain, normalizeCountry } from '../../server/services/company-resolution/normalizer.js'

describe('normalizeInput', () => {
  it('strips legal suffixes from company name', () => {
    const result = normalizeInput({ companyName: 'Acme Corp.' })
    expect(result.companyName).toBe('acme')
  })

  it('strips LLC suffix', () => {
    const result = normalizeInput({ companyName: 'Some Company LLC' })
    expect(result.companyName).toBe('some company')
  })

  it('lowercases and trims', () => {
    const result = normalizeInput({ companyName: '  APPLE INC  ' })
    expect(result.companyName).toBe('apple')
  })

  it('tokenizes name parts correctly', () => {
    const result = normalizeInput({ companyName: 'Open Door Technology' })
    expect(result.nameParts).toContain('open')
    expect(result.nameParts).toContain('door')
    expect(result.nameParts).toContain('technology')
  })

  it('defaults country to US', () => {
    const result = normalizeInput({ companyName: 'Acme' })
    expect(result.country).toBe('US')
  })

  it('normalizes domain', () => {
    const result = normalizeInput({ companyName: 'Acme', domain: 'https://www.acme.com/path' })
    expect(result.domain).toBe('acme.com')
  })

  it('tokenizes address fragments for matching', () => {
    const result = normalizeInput({ companyName: 'Acme', address: '1 Apple Park Way, Cupertino, CA' })
    expect(result.address).toBe('1 apple park way, cupertino, ca')
    expect(result.addressParts).toContain('apple')
    expect(result.addressParts).toContain('cupertino')
    expect(result.addressParts).toContain('ca')
  })
})

describe('normalizeDomain', () => {
  it('strips https and www', () => {
    expect(normalizeDomain('https://www.example.com')).toBe('example.com')
  })
  it('strips path', () => {
    expect(normalizeDomain('example.com/about')).toBe('example.com')
  })
  it('lowercases', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com')
  })
})

describe('normalizeCountry', () => {
  it('maps united states to US', () => {
    expect(normalizeCountry('United States')).toBe('US')
    expect(normalizeCountry('USA')).toBe('US')
    expect(normalizeCountry('us')).toBe('US')
  })
  it('maps united kingdom', () => {
    expect(normalizeCountry('United Kingdom')).toBe('GB')
    expect(normalizeCountry('UK')).toBe('GB')
  })
})
