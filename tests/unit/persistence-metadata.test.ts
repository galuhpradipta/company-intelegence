import { describe, expect, it } from 'vitest'
import type { CandidateCompany } from '../../server/providers/company/types.js'
import {
  buildFieldConfidence,
  extractIdentifiers,
} from '../../server/services/company-resolution/persistence-metadata.js'

describe('buildFieldConfidence', () => {
  it('captures canonical fields present on a provider record', () => {
    const source: CandidateCompany = {
      providerName: 'people_data_labs',
      providerRecordId: 'pdl_apple',
      displayName: 'Apple Inc.',
      legalName: 'Apple Inc.',
      domain: 'apple.com',
      industry: 'technology',
      employeeCount: 161000,
      hqAddress: '1 Apple Park Way',
      hqCity: 'Cupertino',
      hqState: 'CA',
      hqCountry: 'US',
      rawPayload: {},
    }

    expect(buildFieldConfidence(source, 0.9)).toEqual({
      displayName: { value: 'Apple Inc.', confidence: 0.9 },
      legalName: { value: 'Apple Inc.', confidence: 0.9 },
      domain: { value: 'apple.com', confidence: 0.9 },
      industry: { value: 'technology', confidence: 0.9 },
      employeeCount: { value: 161000, confidence: 0.9 },
      hqAddress: { value: '1 Apple Park Way', confidence: 0.9 },
      hqCity: { value: 'Cupertino', confidence: 0.9 },
      hqState: { value: 'CA', confidence: 0.9 },
      hqCountry: { value: 'US', confidence: 0.9 },
    })
  })
})

describe('extractIdentifiers', () => {
  it('extracts SEC identifiers and deduplicates repeated tickers', () => {
    const source: CandidateCompany = {
      providerName: 'sec_edgar',
      providerRecordId: '0000320193',
      displayName: 'Apple Inc.',
      identifiers: [
        { identifierType: 'cik', identifierValue: '0000320193', source: 'sec_edgar' },
        { identifierType: 'ticker', identifierValue: 'AAPL', source: 'sec_edgar' },
      ],
      rawPayload: {
        cik: '0000320193',
        ticker: 'AAPL',
        tickers: ['AAPL'],
      },
    }

    expect(extractIdentifiers(source)).toEqual([
      { identifierType: 'cik', identifierValue: '0000320193', source: 'sec_edgar' },
      { identifierType: 'ticker', identifierValue: 'AAPL', source: 'sec_edgar' },
    ])
  })

  it('adds provider-native IDs for firmographic providers', () => {
    const source: CandidateCompany = {
      providerName: 'people_data_labs',
      providerRecordId: 'pdl_apple',
      displayName: 'Apple Inc.',
      rawPayload: {},
    }

    expect(extractIdentifiers(source)).toEqual([
      {
        identifierType: 'people_data_labs_id',
        identifierValue: 'pdl_apple',
        source: 'people_data_labs',
      },
    ])
  })
})
