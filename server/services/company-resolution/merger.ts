import type { CandidateCompany } from '../../providers/company/types.js'

export interface MergedCandidate {
  displayName: string
  legalName?: string
  domain?: string
  industry?: string
  employeeCount?: number
  hqAddress?: string
  hqCity?: string
  hqState?: string
  hqCountry?: string
  sources: CandidateCompany[]
  providerNames: string[]
}

/**
 * Cluster candidates that likely refer to the same company.
 * Two candidates are merged if they share exact domain OR a high name overlap.
 */
export function clusterCandidates(candidates: CandidateCompany[]): MergedCandidate[] {
  const clusters: CandidateCompany[][] = []

  for (const candidate of candidates) {
    const existing = clusters.find((cluster) =>
      cluster.some((c) => isSameEntity(c, candidate))
    )
    if (existing) {
      existing.push(candidate)
    } else {
      clusters.push([candidate])
    }
  }

  return clusters.map(mergeCandidates)
}

function isSameEntity(a: CandidateCompany, b: CandidateCompany): boolean {
  if (a.domain && b.domain) {
    const normA = a.domain.toLowerCase().replace(/^www\./, '')
    const normB = b.domain.toLowerCase().replace(/^www\./, '')
    if (normA === normB) return true
  }

  const nameA = stripName(a.legalName ?? a.displayName)
  const nameB = stripName(b.legalName ?? b.displayName)
  const tokensA = new Set(tokenize(nameA))
  const tokensB = new Set(tokenize(nameB))
  const intersection = [...tokensA].filter((x) => tokensB.has(x)).length
  const union = new Set([...tokensA, ...tokensB]).size
  const jaccard = union === 0 ? 0 : intersection / union
  return jaccard >= 0.8
}

const LEGAL = /\b(inc|llc|ltd|pt|cv|corp|co|plc|gmbh|limited)\b\.?/gi
function stripName(n: string) {
  return n.toLowerCase().replace(LEGAL, '').trim()
}
function tokenize(s: string): string[] {
  return s.split(/[\s,&+]+/).filter((p) => p.length > 1)
}

/**
 * Field-level merge with provenance precedence:
 * registry > firmographic > scraping > ai_fallback
 */
const PROVIDER_RANK: Record<string, number> = {
  opencorporates: 4,
  people_data_labs: 3,
  clearbit: 3,
  bright_data: 2,
  ai_fallback: 1,
}

function rank(provider: string): number {
  return PROVIDER_RANK[provider] ?? 0
}

function mergeCandidates(sources: CandidateCompany[]): MergedCandidate {
  const sorted = [...sources].sort((a, b) => rank(b.providerName) - rank(a.providerName))
  const best = sorted[0]

  const legalName =
    sources.find((s) => rank(s.providerName) >= 3 && s.legalName)?.legalName
    ?? best.legalName

  const domain =
    sources.find((s) => s.domain)?.domain

  const industry =
    sources.find((s) => rank(s.providerName) >= 3 && s.industry)?.industry
    ?? best.industry

  const employeeCount =
    sources.find((s) => rank(s.providerName) >= 3 && s.employeeCount)?.employeeCount
    ?? best.employeeCount

  const hqAddress =
    sources.find((s) => rank(s.providerName) >= 3 && s.hqAddress)?.hqAddress
    ?? sources.find((s) => s.hqAddress)?.hqAddress

  const hqCity = sources.find((s) => s.hqCity)?.hqCity
  const hqState = sources.find((s) => s.hqState)?.hqState
  const hqCountry = sources.find((s) => s.hqCountry)?.hqCountry

  return {
    displayName: best.displayName,
    legalName,
    domain,
    industry,
    employeeCount,
    hqAddress,
    hqCity,
    hqState,
    hqCountry,
    sources,
    providerNames: [...new Set(sources.map((s) => s.providerName))],
  }
}
