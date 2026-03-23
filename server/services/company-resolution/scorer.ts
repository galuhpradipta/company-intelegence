import type { CandidateCompany, NormalizedInput } from '../../providers/company/types.js'
import { normalizeCountry } from './normalizer.js'

export interface ScoreBreakdown {
  domainExact: number
  nameSimilarity: number
  addressAlignment: number
  industryAlignment: number
  countryMatch: number
  rawTotal: number
  reliabilityFactor: number
  finalScore: number
}

export function scoreCandidate(
  candidate: CandidateCompany,
  input: NormalizedInput,
  reliabilityFactor: number
): ScoreBreakdown {
  const domainExact = scoreDomain(candidate.domain, input.domain)
  const nameSimilarity = scoreName(candidate.displayName ?? candidate.legalName ?? '', input)
  const addressAlignment = scoreAddress(candidate, input)
  const industryAlignment = scoreIndustry(candidate.industry, input.industry)
  const countryMatch = scoreCountry(candidate.hqCountry, input.country)

  const rawTotal = domainExact + nameSimilarity + addressAlignment + industryAlignment + countryMatch
  const finalScore = Math.min(100, Math.round(rawTotal * reliabilityFactor))

  return {
    domainExact,
    nameSimilarity,
    addressAlignment,
    industryAlignment,
    countryMatch,
    rawTotal,
    reliabilityFactor,
    finalScore,
  }
}

function scoreDomain(candidateDomain?: string, inputDomain?: string): number {
  if (!inputDomain || !candidateDomain) return 0
  const norm = (d: string) =>
    d.toLowerCase().replace(/^www\./, '').split('/')[0]
  return norm(candidateDomain) === norm(inputDomain) ? 40 : 0
}

const LEGAL_SUFFIXES = /\b(inc|llc|ltd|pt|cv|corp|co|plc|gmbh|ag|sa|sas|bv|nv|pty|limited|incorporated)\b\.?$/gi

function stripLegal(name: string): string {
  return name.toLowerCase().replace(LEGAL_SUFFIXES, '').trim()
}

function tokenize(s: string): string[] {
  return s.split(/[\s,&+]+/).filter((p) => p.length > 1)
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function scoreName(candidateName: string, input: NormalizedInput): number {
  const stripped = stripLegal(candidateName)
  const candTokens = tokenize(stripped)
  const jaccard = jaccardSimilarity(candTokens, input.nameParts)
  // perfect match = 30 points
  return Math.round(jaccard * 30)
}

function scoreAddress(candidate: CandidateCompany, input: NormalizedInput): number {
  const addressParts = input.addressParts ?? []
  const hasStructuredLocation = Boolean(input.city || input.state)
  const hasAddressSignal = addressParts.length > 0

  if (!hasStructuredLocation && !hasAddressSignal) return 0

  const cityMatch =
    input.city && candidate.hqCity?.toLowerCase().includes(input.city) ? 8 : 0
  const stateMatch =
    input.state && candidate.hqState?.toLowerCase().includes(input.state) ? 4 : 0

  const candidateLocationParts = [
    candidate.hqCity,
    candidate.hqState,
    candidate.hqCountry ? normalizeCountry(candidate.hqCountry).toLowerCase() : undefined,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.toLowerCase().split(/[^a-z0-9]+/))
    .filter((part) => part.length > 1)

  const overlapCount = addressParts.filter((part) => candidateLocationParts.includes(part)).length
  const addressTokenMatch = Math.min(10, overlapCount * 4)

  return Math.min(15, cityMatch + stateMatch + addressTokenMatch)
}

function scoreIndustry(candidateIndustry?: string, inputIndustry?: string): number {
  if (!inputIndustry || !candidateIndustry) return 0
  return candidateIndustry.toLowerCase().includes(inputIndustry.toLowerCase()) ? 10 : 0
}

function scoreCountry(candidateCountry?: string, inputCountry?: string): number {
  if (!inputCountry || !candidateCountry) return 5 // default US-first assumption
  return normalizeCountry(candidateCountry) === normalizeCountry(inputCountry) ? 5 : 0
}

export function toMatchTier(score: number): 'confident' | 'suggested' | 'not_found' {
  if (score >= 85) return 'confident'
  if (score >= 50) return 'suggested'
  return 'not_found'
}
