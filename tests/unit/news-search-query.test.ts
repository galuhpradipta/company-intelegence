import { describe, expect, it } from 'vitest'
import { buildNewsSearchQuery } from '../../server/services/news-ingestion/search-query.js'

describe('buildNewsSearchQuery', () => {
  it('keeps exact company-name matching when no extra signals exist', () => {
    expect(buildNewsSearchQuery({
      companyName: 'Apple Inc.',
    })).toBe('"Apple Inc."')
  })

  it('adds a normalized domain and unique tickers to disambiguate ambiguous names', () => {
    expect(buildNewsSearchQuery({
      companyName: 'Acme Holdings',
      domain: 'https://www.acme.com/about',
      tickers: ['ACME', 'ACME', 'ACME.B'],
    })).toBe('"Acme Holdings" OR "acme.com" OR "ACME" OR "ACME.B"')
  })

  it('strips embedded quotes before building the provider query', () => {
    expect(buildNewsSearchQuery({
      companyName: 'The "Trade" Desk',
      tickers: ['"TTD"'],
    })).toBe('"The Trade Desk" OR "TTD"')
  })
})
