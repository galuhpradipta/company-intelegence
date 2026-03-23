export interface CompanyInput {
  companyName: string
  domain?: string
  address?: string
  city?: string
  state?: string
  country?: string
  industry?: string
}

export interface NormalizedInput {
  companyName: string
  domain?: string
  address?: string
  city?: string
  state?: string
  country?: string
  industry?: string
  nameParts: string[]
  addressParts?: string[]
}

export interface CandidateIdentifier {
  identifierType: string
  identifierValue: string
  source: string
}

export interface CandidateCompany {
  providerName: string
  providerRecordId?: string
  legalName?: string
  displayName: string
  domain?: string
  industry?: string
  employeeCount?: number
  hqCity?: string
  hqState?: string
  hqCountry?: string
  aliases?: string[]
  identifiers?: CandidateIdentifier[]
  rawPayload: Record<string, unknown>
}

export interface CompanyProvider {
  name: string
  reliabilityFactor: number // 0.6-1.0 per spec
  search(input: NormalizedInput): Promise<CandidateCompany[]>
}
