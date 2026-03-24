import type { CandidateCompany, CandidateIdentifier } from '../../providers/company/types.js'

type FieldConfidenceValue = {
  value: string | number
  confidence: number
}

export type FieldConfidenceMap = Record<string, FieldConfidenceValue>

export function buildFieldConfidence(
  source: CandidateCompany,
  reliabilityFactor: number,
): FieldConfidenceMap {
  const fieldConfidence: FieldConfidenceMap = {}

  addField(fieldConfidence, 'displayName', source.displayName, reliabilityFactor)
  addField(fieldConfidence, 'legalName', source.legalName, reliabilityFactor)
  addField(fieldConfidence, 'domain', source.domain, reliabilityFactor)
  addField(fieldConfidence, 'industry', source.industry, reliabilityFactor)
  addField(fieldConfidence, 'employeeCount', source.employeeCount, reliabilityFactor)
  addField(fieldConfidence, 'hqAddress', source.hqAddress, reliabilityFactor)
  addField(fieldConfidence, 'hqCity', source.hqCity, reliabilityFactor)
  addField(fieldConfidence, 'hqState', source.hqState, reliabilityFactor)
  addField(fieldConfidence, 'hqCountry', source.hqCountry, reliabilityFactor)

  return fieldConfidence
}

export function extractIdentifiers(source: CandidateCompany): CandidateIdentifier[] {
  const identifiers = [...(source.identifiers ?? [])]

  if (source.providerName === 'people_data_labs' && source.providerRecordId) {
    identifiers.push({
      identifierType: 'people_data_labs_id',
      identifierValue: source.providerRecordId,
      source: source.providerName,
    })
  }

  if (source.providerName === 'opencorporates' && source.providerRecordId) {
    identifiers.push({
      identifierType: 'company_number',
      identifierValue: source.providerRecordId,
      source: source.providerName,
    })
  }

  if (source.providerName === 'sec_edgar') {
    const cik = toStringValue(source.rawPayload.cik) ?? source.providerRecordId
    const ticker = toStringValue(source.rawPayload.ticker)

    if (cik) {
      identifiers.push({
        identifierType: 'cik',
        identifierValue: cik,
        source: source.providerName,
      })
    }

    if (ticker) {
      identifiers.push({
        identifierType: 'ticker',
        identifierValue: ticker,
        source: source.providerName,
      })
    }

    const tickers = Array.isArray(source.rawPayload.tickers) ? source.rawPayload.tickers : []
    for (const value of tickers) {
      const normalized = toStringValue(value)
      if (!normalized) continue
      identifiers.push({
        identifierType: 'ticker',
        identifierValue: normalized,
        source: source.providerName,
      })
    }
  }

  const deduped = new Map<string, CandidateIdentifier>()
  for (const identifier of identifiers) {
    const value = identifier.identifierValue.trim()
    if (!value) continue
    const key = `${identifier.identifierType}:${value}:${identifier.source}`
    deduped.set(key, { ...identifier, identifierValue: value })
  }

  return [...deduped.values()]
}

function addField(
  fieldConfidence: FieldConfidenceMap,
  field: string,
  value: string | number | undefined,
  reliabilityFactor: number,
) {
  if (value === undefined || value === null || value === '') return

  fieldConfidence[field] = {
    value,
    confidence: reliabilityFactor,
  }
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number'
      ? String(value)
      : undefined
}
