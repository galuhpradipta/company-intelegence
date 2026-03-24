import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  batchUploadItems,
  batchUploads,
  companies,
  companyMatches,
  companySourceRecords,
  resolutionInputs,
} from '../../db/schema/index.js'
import { toMatchTier } from '../company-resolution/index.js'
import { ensureBatchProcessing } from './batch-processor.js'

interface SubmittedInput {
  companyName: string
  domain?: string
  address?: string
  city?: string
  state?: string
  country?: string
  industry?: string
}

interface BatchCandidateSummary {
  companyId: string
  displayName: string
  domain?: string
  confidenceScore: number
  matchTier: 'confident' | 'suggested' | 'not_found'
  sourceProviders: string[]
  selected: boolean
}

export interface BatchStatusItem {
  rowNumber: number
  status: string
  resolutionInputId: string | null
  companyId: string | null
  confidenceScore: number | null
  matchTier: 'confident' | 'suggested' | 'not_found' | null
  errorMessage: string | null
  submittedInput: SubmittedInput | null
  selectedCandidate: BatchCandidateSummary | null
  suggestedCandidates: BatchCandidateSummary[]
}

interface BatchStatusBuildRecord {
  batch: {
    id: string
    status: string
    totalRows: number
    processedRows: number
  }
  items: Array<{
    rowNumber: number
    rawInput: unknown
    status: string
    resolutionInputId: string | null
    resultCompanyId: string | null
    errorMessage: string | null
  }>
  inputRecords: Array<{
    id: string
    rawInput: unknown
  }>
  matchRecords: Array<{
    resolutionInputId: string
    companyId: string
    rank: number
    score: number
    selected: boolean
  }>
  companyRecords: Array<{
    id: string
    displayName: string
    domain: string | null
  }>
  sourceRecords: Array<{
    companyId: string
    provider: string
  }>
}

export async function getBatchStatus(batchId: string) {
  const batch = await db.query.batchUploads.findFirst({
    where: eq(batchUploads.id, batchId),
  })

  if (!batch) {
    throw new Error('Batch not found')
  }

  if ((batch.status !== 'completed' && batch.status !== 'failed') || batch.processedRows < batch.totalRows) {
    void ensureBatchProcessing(batchId)
  }

  const items = await db.query.batchUploadItems.findMany({
    where: eq(batchUploadItems.batchUploadId, batchId),
    orderBy: (table, { asc }) => [asc(table.rowNumber)],
  })

  const resolutionInputIds = items
    .map((item) => item.resolutionInputId)
    .filter((value): value is string => Boolean(value))

  const inputRecords = resolutionInputIds.length > 0
    ? await db
      .select()
      .from(resolutionInputs)
      .where(inArray(resolutionInputs.id, resolutionInputIds))
    : []

  const matchRecords = resolutionInputIds.length > 0
    ? await db
      .select()
      .from(companyMatches)
      .where(inArray(companyMatches.resolutionInputId, resolutionInputIds))
      .orderBy(asc(companyMatches.rank))
    : []

  const companyIds = [...new Set(matchRecords.map((match) => match.companyId))]

  const companyRecords = companyIds.length > 0
    ? await db
      .select()
      .from(companies)
      .where(inArray(companies.id, companyIds))
    : []

  const sourceRecords = companyIds.length > 0
    ? await db
      .select()
      .from(companySourceRecords)
      .where(inArray(companySourceRecords.companyId, companyIds))
    : []

  return buildBatchStatusPayload({
    batch: {
      id: batch.id,
      status: batch.status,
      totalRows: batch.totalRows,
      processedRows: batch.processedRows,
    },
    items: items.map((item) => ({
      rowNumber: item.rowNumber,
      rawInput: item.rawInput,
      status: item.status,
      resolutionInputId: item.resolutionInputId ?? null,
      resultCompanyId: item.resultCompanyId ?? null,
      errorMessage: item.errorMessage ?? null,
    })),
    inputRecords: inputRecords.map((record) => ({
      id: record.id,
      rawInput: record.rawInput,
    })),
    matchRecords: matchRecords.map((match) => ({
      resolutionInputId: match.resolutionInputId,
      companyId: match.companyId,
      rank: match.rank,
      score: match.score,
      selected: match.selected,
    })),
    companyRecords: companyRecords.map((company) => ({
      id: company.id,
      displayName: company.displayName,
      domain: company.domain,
    })),
    sourceRecords: sourceRecords.map((record) => ({
      companyId: record.companyId,
      provider: record.provider,
    })),
  })
}

export function buildBatchStatusPayload(records: BatchStatusBuildRecord) {
  const inputById = new Map(records.inputRecords.map((record) => [record.id, record]))
  const companyById = new Map(records.companyRecords.map((company) => [company.id, company]))
  const matchesByResolutionInputId = new Map<string, typeof records.matchRecords>()
  const sourceProvidersByCompanyId = new Map<string, string[]>()

  for (const match of records.matchRecords) {
    const existing = matchesByResolutionInputId.get(match.resolutionInputId) ?? []
    existing.push(match)
    matchesByResolutionInputId.set(match.resolutionInputId, existing)
  }

  for (const record of records.sourceRecords) {
    const providers = sourceProvidersByCompanyId.get(record.companyId) ?? []
    if (!providers.includes(record.provider)) {
      providers.push(record.provider)
    }
    sourceProvidersByCompanyId.set(record.companyId, providers)
  }

  const detailedItems: BatchStatusItem[] = records.items.map((item) => {
    const inputRecord = item.resolutionInputId ? inputById.get(item.resolutionInputId) : undefined
    const submittedInput = toSubmittedInput(inputRecord?.rawInput ?? item.rawInput)
    const matches = item.resolutionInputId
      ? matchesByResolutionInputId.get(item.resolutionInputId) ?? []
      : []

    const allCandidates = matches.flatMap((match) => {
      const company = companyById.get(match.companyId)
      if (!company) return []

      return [{
        companyId: company.id,
        displayName: company.displayName,
        domain: company.domain ?? undefined,
        confidenceScore: Math.round(match.score),
        matchTier: toMatchTier(match.score),
        sourceProviders: sourceProvidersByCompanyId.get(company.id) ?? [],
        selected: match.selected,
      }]
    })
    const visibleTopTier = allCandidates[0]?.matchTier ?? null
    const shouldHideCandidates = visibleTopTier === 'not_found'
    const suggestedCandidates = shouldHideCandidates
      ? []
      : allCandidates.slice(0, 3)
    const selectedCandidate = shouldHideCandidates
      ? null
      : suggestedCandidates.find((candidate) => candidate.selected)
        ?? suggestedCandidates[0]
        ?? null

    const matchTier = selectedCandidate
      ? selectedCandidate.matchTier
      : visibleTopTier === 'not_found'
        ? 'not_found'
        : item.status === 'completed'
        ? 'not_found'
        : null

    return {
      rowNumber: item.rowNumber,
      status: item.status,
      resolutionInputId: item.resolutionInputId,
      companyId: matchTier === 'not_found'
        ? null
        : selectedCandidate?.companyId ?? item.resultCompanyId,
      confidenceScore: selectedCandidate?.confidenceScore ?? (matchTier === 'not_found' ? 0 : null),
      matchTier,
      errorMessage: item.errorMessage,
      submittedInput,
      selectedCandidate,
      suggestedCandidates,
    }
  })

  const counts = {
    confident: detailedItems.filter((item) => item.matchTier === 'confident').length,
    suggested: detailedItems.filter((item) => item.matchTier === 'suggested').length,
    notFound: detailedItems.filter((item) => item.matchTier === 'not_found').length,
    failed: detailedItems.filter((item) => item.status === 'failed').length,
  }

  return {
    batchId: records.batch.id,
    status: records.batch.status,
    totalRows: records.batch.totalRows,
    processedRows: records.batch.processedRows,
    counts,
    items: detailedItems,
  }
}

function toSubmittedInput(rawInput: unknown): SubmittedInput | null {
  if (!rawInput || typeof rawInput !== 'object') return null

  const record = rawInput as Record<string, unknown>
  const companyName = toOptionalString(record.companyName) ?? toOptionalString(record.company_name) ?? null

  if (!companyName) return null

  return {
    companyName,
    domain: toOptionalString(record.domain),
    address: toOptionalString(record.address),
    city: toOptionalString(record.city),
    state: toOptionalString(record.state),
    country: toOptionalString(record.country),
    industry: toOptionalString(record.industry),
  }
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
