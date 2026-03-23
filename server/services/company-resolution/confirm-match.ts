import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { batchUploadItems, companies, companyMatches } from '../../db/schema/index.js'
import { toMatchTier } from './scorer.js'

interface ConfirmMatchInput {
  resolutionInputId: string
  companyId: string
}

export async function confirmMatchSelection(input: ConfirmMatchInput) {
  await db
    .update(companyMatches)
    .set({ selected: false })
    .where(eq(companyMatches.resolutionInputId, input.resolutionInputId))

  await db
    .update(companyMatches)
    .set({ selected: true })
    .where(and(
      eq(companyMatches.resolutionInputId, input.resolutionInputId),
      eq(companyMatches.companyId, input.companyId),
    ))

  const selectedMatch = await db.query.companyMatches.findFirst({
    where: and(
      eq(companyMatches.resolutionInputId, input.resolutionInputId),
      eq(companyMatches.companyId, input.companyId),
    ),
  })

  if (selectedMatch) {
    await db
      .update(batchUploadItems)
      .set({
        resultCompanyId: input.companyId,
        topScore: selectedMatch.score,
        status: 'completed',
        errorMessage: null,
      })
      .where(eq(batchUploadItems.resolutionInputId, input.resolutionInputId))
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, input.companyId),
  })

  return {
    ok: true,
    companyId: input.companyId,
    matchTier: selectedMatch ? toMatchTier(selectedMatch.score) : (company?.matchTier ?? 'suggested'),
  }
}
