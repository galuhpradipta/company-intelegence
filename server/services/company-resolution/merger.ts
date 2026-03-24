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
 * unless another source is meaningfully fresher.
 */
const PROVIDER_RANK: Record<string, number> = {
  opencorporates: 4,
  sec_edgar: 4,
  people_data_labs: 3,
  clearbit: 3,
  bright_data: 2,
  ai_fallback: 1,
}

const FRESHNESS_PRIORITY_WINDOW_MS = 1000 * 60 * 60 * 24 * 30

function rank(provider: string): number {
  return PROVIDER_RANK[provider] ?? 0
}

function mergeCandidates(sources: CandidateCompany[]): MergedCandidate {
  const sorted = [...sources].sort(compareSourcePriority)
  const best = sorted[0]

  const displayName = pickValue(sources, (source) => source.displayName) ?? best.displayName
  const legalName = pickValue(sources, (source) => source.legalName, { minProviderRank: 3 }) ?? best.legalName
  const domain = pickValue(sources, (source) => source.domain)
  const industry = pickValue(sources, (source) => source.industry, { minProviderRank: 3 }) ?? best.industry
  const employeeCount =
    pickValue(sources, (source) => source.employeeCount, { minProviderRank: 3 }) ?? best.employeeCount
  const hqAddress = pickValue(sources, (source) => source.hqAddress, { minProviderRank: 3 })
    ?? pickValue(sources, (source) => source.hqAddress)
  const hqCity = pickValue(sources, (source) => source.hqCity)
  const hqState = pickValue(sources, (source) => source.hqState)
  const hqCountry = pickValue(sources, (source) => source.hqCountry)

  return {
    displayName,
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

function pickValue<T extends string | number>(
  sources: CandidateCompany[],
  selector: (source: CandidateCompany) => T | undefined,
  options?: { minProviderRank?: number },
): T | undefined {
  const candidates = sources
    .map((source) => {
      const value = selector(source)
      return value === undefined || value === '' ? undefined : { source, value }
    })
    .filter((candidate): candidate is { source: CandidateCompany; value: T } => Boolean(candidate))

  if (candidates.length === 0) {
    return undefined
  }

  const preferred = options?.minProviderRank
    ? candidates.filter((candidate) => rank(candidate.source.providerName) >= options.minProviderRank!)
    : candidates

  const pool = preferred.length > 0 ? preferred : candidates
  pool.sort((a, b) => compareSourcePriority(a.source, b.source))
  return pool[0]?.value
}

function compareSourcePriority(a: CandidateCompany, b: CandidateCompany): number {
  const updatedA = parseSourceUpdatedAt(a)
  const updatedB = parseSourceUpdatedAt(b)

  if (
    updatedA !== undefined
    && updatedB !== undefined
    && Math.abs(updatedA - updatedB) >= FRESHNESS_PRIORITY_WINDOW_MS
  ) {
    return updatedB - updatedA
  }

  const rankDiff = rank(b.providerName) - rank(a.providerName)
  if (rankDiff !== 0) {
    return rankDiff
  }

  if (updatedA !== undefined || updatedB !== undefined) {
    return (updatedB ?? Number.NEGATIVE_INFINITY) - (updatedA ?? Number.NEGATIVE_INFINITY)
  }

  return 0
}

function parseSourceUpdatedAt(source: CandidateCompany): number | undefined {
  if (!source.sourceUpdatedAt) {
    return undefined
  }

  const parsed = Date.parse(source.sourceUpdatedAt)
  return Number.isNaN(parsed) ? undefined : parsed
}
