import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { confirmMatchSelection, resolveCompany } from '../../services/company-resolution/index.js'
import { db } from '../../db/client.js'
import { companies, companySourceRecords, companyIdentifiers } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'

const companyInputSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
})

export const companyRouter = router({
  resolve: publicProcedure
    .input(companyInputSchema)
    .mutation(async ({ input }) => {
      return resolveCompany(input, 'single')
    }),

  confirmMatch: publicProcedure
    .input(z.object({
      resolutionInputId: z.string().uuid(),
      companyId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      return confirmMatchSelection(input)
    }),

  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, input),
      })
      if (!company) throw new Error('Company not found')

      const sourceRecords = await db.query.companySourceRecords.findMany({
        where: eq(companySourceRecords.companyId, input),
      })

      const identifiers = await db.query.companyIdentifiers.findMany({
        where: eq(companyIdentifiers.companyId, input),
      })

      return { ...company, sourceRecords, identifiers }
    }),
})
