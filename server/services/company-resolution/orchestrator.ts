import pLimit from 'p-limit'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  resolutionInputs,
  companies,
  companyIdentifiers,
  companySourceRecords,
  companyMatches,
} from '../../db/schema/index.js'
import type { CompanyInput } from '../../providers/company/types.js'
import {
  getCompanyProviderByName,
  getDeterministicCompanyProviders,
  getFallbackCompanyProvider,
} from '../../providers/company/registry.js'
import { normalizeDomain, normalizeInput } from './normalizer.js'
import { scoreCandidate, toMatchTier } from './scorer.js'
import { clusterCandidates } from './merger.js'
import { buildFieldConfidence, extractIdentifiers } from './persistence-metadata.js'

export interface ResolvedCandidate {
  companyId: string
  displayName: string
  legalName?: string
  domain?: string
  industry?: string
  confidenceScore: number
  matchTier: 'confident' | 'suggested' | 'not_found'
  sourceProviders: string[]
  scoreBreakdown: Record<string, unknown>
}

export interface ResolveResult {
  resolutionInputId: string
  topTier: 'confident' | 'suggested' | 'not_found'
  candidates: ResolvedCandidate[]
}

export async function resolveCompany(
  input: CompanyInput,
  sourceType: 'single' | 'csv' = 'single'
): Promise<ResolveResult> {
  const normalized = normalizeInput(input)
  const providers = getDeterministicCompanyProviders()
  const fallbackProvider = getFallbackCompanyProvider()

  // Persist the resolution input
  const [inputRecord] = await db
    .insert(resolutionInputs)
    .values({
      sourceType,
      rawInput: input as unknown as Record<string, unknown>,
      normalizedInput: normalized as unknown as Record<string, unknown>,
      status: 'processing',
    })
    .returning({ id: resolutionInputs.id })

  // Run providers in parallel with concurrency limit
  const limit = pLimit(3)
  const providerResults = await Promise.all(
    providers.map((provider) =>
      limit(() =>
        provider.search(normalized).catch((err) => {
          console.warn(`[${provider.name}] Search failed:`, err)
          return []
        })
      )
    )
  )

  let allCandidates = providerResults.flat()

  // Use AI fallback if no results from deterministic providers
  if (allCandidates.length === 0) {
    console.log('[Orchestrator] No deterministic results, trying AI fallback')
    allCandidates = await fallbackProvider.search(normalized).catch(() => [])
  }

  // Cluster and merge candidates
  const merged = clusterCandidates(allCandidates)

  // Score each merged candidate
  const scored = merged.map((candidate) => {
    // Use the best (highest) reliability factor from contributing sources
    const maxReliability = Math.max(
      ...candidate.sources.map((s) => {
        const provider = getCompanyProviderByName(s.providerName)
        return provider?.reliabilityFactor ?? 0.6
      })
    )

    const breakdown = scoreCandidate(
      {
        providerName: candidate.providerNames[0],
        displayName: candidate.displayName,
        legalName: candidate.legalName,
        domain: candidate.domain,
        industry: candidate.industry,
        hqCity: candidate.hqCity,
        hqState: candidate.hqState,
        hqCountry: candidate.hqCountry,
        rawPayload: {},
      },
      normalized,
      maxReliability
    )

    return { candidate, breakdown }
  })

  // Sort by finalScore descending, take top 5
  scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore)
  const top = scored.slice(0, 5)

  // Persist companies and source records
  const resolvedCandidates: ResolvedCandidate[] = []

  for (let i = 0; i < top.length; i++) {
    const { candidate, breakdown } = top[i]
    const tier = toMatchTier(breakdown.finalScore)
    const normalizedDomain = candidate.domain ? normalizeDomain(candidate.domain) : null
    const companyValues = {
      displayName: candidate.displayName,
      legalName: candidate.legalName,
      domain: normalizedDomain,
      industry: candidate.industry,
      employeeCount: candidate.employeeCount,
      hqCity: candidate.hqCity,
      hqState: candidate.hqState,
      hqCountry: candidate.hqCountry ?? 'US',
      matchTier: tier,
      confidenceScore: breakdown.finalScore,
    }

    let companyId: string

    if (normalizedDomain) {
      const [existingCompany] = await db
        .select({
          id: companies.id,
          legalName: companies.legalName,
          industry: companies.industry,
          employeeCount: companies.employeeCount,
          hqCity: companies.hqCity,
          hqState: companies.hqState,
          hqCountry: companies.hqCountry,
        })
        .from(companies)
        .where(eq(companies.domain, normalizedDomain))
        .orderBy(asc(companies.createdAt))
        .limit(1)

      if (existingCompany) {
        await db
          .update(companies)
          .set({
            displayName: candidate.displayName,
            legalName: candidate.legalName ?? existingCompany.legalName,
            domain: normalizedDomain,
            industry: candidate.industry ?? existingCompany.industry,
            employeeCount: candidate.employeeCount ?? existingCompany.employeeCount,
            hqCity: candidate.hqCity ?? existingCompany.hqCity,
            hqState: candidate.hqState ?? existingCompany.hqState,
            hqCountry: candidate.hqCountry ?? existingCompany.hqCountry ?? 'US',
            matchTier: tier,
            confidenceScore: breakdown.finalScore,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, existingCompany.id))

        companyId = existingCompany.id
      } else {
        const [company] = await db
          .insert(companies)
          .values(companyValues)
          .returning({ id: companies.id })

        companyId = company.id
      }
    } else {
      const [company] = await db
        .insert(companies)
        .values(companyValues)
        .returning({ id: companies.id })

      companyId = company.id
    }

    // Persist source records
    if (candidate.sources.length > 0) {
      await db
        .insert(companySourceRecords)
        .values(candidate.sources.map((source) => {
          const provider = getCompanyProviderByName(source.providerName)

          return {
            companyId,
            provider: source.providerName,
            providerRecordId: source.providerRecordId,
            rawPayload: source.rawPayload,
            fieldConfidence: buildFieldConfidence(source, provider?.reliabilityFactor ?? 0.6),
          }
        }))
        .onConflictDoNothing({
          target: [
            companySourceRecords.companyId,
            companySourceRecords.provider,
            companySourceRecords.providerRecordId,
          ],
        })
    }

    const identifiersToInsert = candidate.sources
      .flatMap(extractIdentifiers)
      .filter((identifier, index, identifiers) =>
        identifiers.findIndex((candidateIdentifier) =>
          candidateIdentifier.identifierType === identifier.identifierType
          && candidateIdentifier.identifierValue === identifier.identifierValue
          && candidateIdentifier.source === identifier.source
        ) === index,
      )

    if (identifiersToInsert.length > 0) {
      await db
        .insert(companyIdentifiers)
        .values(
          identifiersToInsert.map((identifier) => ({
            companyId,
            identifierType: identifier.identifierType,
            identifierValue: identifier.identifierValue,
            source: identifier.source,
          })),
        )
        .onConflictDoNothing({
          target: [
            companyIdentifiers.companyId,
            companyIdentifiers.identifierType,
            companyIdentifiers.identifierValue,
            companyIdentifiers.source,
          ],
        })
    }

    // Persist company match record
    await db.insert(companyMatches).values({
      resolutionInputId: inputRecord.id,
      companyId,
      rank: i + 1,
      score: breakdown.finalScore,
      scoreBreakdown: breakdown as unknown as Record<string, unknown>,
      selected: i === 0, // auto-select top match
    })

    resolvedCandidates.push({
      companyId,
      displayName: candidate.displayName,
      legalName: candidate.legalName,
      domain: candidate.domain,
      industry: candidate.industry,
      confidenceScore: breakdown.finalScore,
      matchTier: tier,
      sourceProviders: candidate.providerNames,
      scoreBreakdown: breakdown as unknown as Record<string, unknown>,
    })
  }

  // Mark input as completed
  await db
    .update(resolutionInputs)
    .set({ status: 'completed' })
    .where(eq(resolutionInputs.id, inputRecord.id))

  const topTier = resolvedCandidates[0]?.matchTier ?? 'not_found'

  return {
    resolutionInputId: inputRecord.id,
    topTier,
    candidates: resolvedCandidates,
  }
}
