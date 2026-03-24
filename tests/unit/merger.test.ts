import { describe, it, expect } from 'vitest'
import { clusterCandidates } from '../../server/services/company-resolution/merger.js'
import type { CandidateCompany } from '../../server/providers/company/types.js'

describe('clusterCandidates', () => {
  it('merges two candidates with the same domain into one cluster', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'people_data_labs',
        displayName: 'Apple Inc',
        domain: 'apple.com',
        industry: 'technology',
        employeeCount: 150000,
        hqCountry: 'US',
        rawPayload: {},
      },
      {
        providerName: 'opencorporates',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        hqCountry: 'US',
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged).toHaveLength(1)
    expect(merged[0].providerNames).toContain('people_data_labs')
    expect(merged[0].providerNames).toContain('opencorporates')
  })

  it('prefers legal name from registry provider', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'people_data_labs',
        displayName: 'Apple',
        domain: 'apple.com',
        rawPayload: {},
      },
      {
        providerName: 'opencorporates',
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged[0].legalName).toBe('Apple Inc.')
  })

  it('prefers employee count from firmographic provider over AI fallback', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'ai_fallback',
        displayName: 'Stripe',
        domain: 'stripe.com',
        employeeCount: 1000,
        rawPayload: {},
      },
      {
        providerName: 'people_data_labs',
        displayName: 'Stripe, Inc.',
        domain: 'stripe.com',
        employeeCount: 8000,
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged[0].employeeCount).toBe(8000) // firmographic wins
  })

  it('prefers a structured address from a higher-rank provider', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'ai_fallback',
        displayName: 'Stripe',
        domain: 'stripe.com',
        hqAddress: 'Unknown address',
        rawPayload: {},
      },
      {
        providerName: 'opencorporates',
        displayName: 'Stripe, Inc.',
        domain: 'stripe.com',
        hqAddress: '354 Oyster Point Blvd',
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged[0].hqAddress).toBe('354 Oyster Point Blvd')
  })

  it('keeps separate clusters for distinct companies', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'people_data_labs',
        displayName: 'Apple Inc',
        domain: 'apple.com',
        rawPayload: {},
      },
      {
        providerName: 'people_data_labs',
        displayName: 'Google LLC',
        domain: 'google.com',
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged).toHaveLength(2)
  })

  it('merges by high name similarity when no domain available', () => {
    const candidates: CandidateCompany[] = [
      {
        providerName: 'people_data_labs',
        displayName: 'Stripe Payments Inc',
        rawPayload: {},
      },
      {
        providerName: 'opencorporates',
        displayName: 'Stripe Payments Inc',
        legalName: 'Stripe Payments Inc.',
        rawPayload: {},
      },
    ]

    const merged = clusterCandidates(candidates)
    expect(merged).toHaveLength(1)
  })
})
