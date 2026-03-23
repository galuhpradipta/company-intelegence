import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { resolveCompany } from '../services/company-resolution/index.js'
import { db } from '../db/client.js'
import { companies, companySourceRecords, companyIdentifiers, companyMatches } from '../db/schema/index.js'
import { eq } from 'drizzle-orm'

export const companyRoute = new Hono()

const resolveSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
})

// POST /api/company/resolve
companyRoute.post('/resolve', zValidator('json', resolveSchema), async (c) => {
  const input = c.req.valid('json')
  const result = await resolveCompany(input, 'single')
  return c.json(result)
})

// POST /api/company/confirm
companyRoute.post(
  '/confirm',
  zValidator('json', z.object({
    resolutionInputId: z.string().uuid(),
    companyId: z.string().uuid(),
  })),
  async (c) => {
    const { resolutionInputId, companyId } = c.req.valid('json')

    await db
      .update(companyMatches)
      .set({ selected: false })
      .where(eq(companyMatches.resolutionInputId, resolutionInputId))

    await db
      .update(companyMatches)
      .set({ selected: true })
      .where(eq(companyMatches.companyId, companyId))

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    })

    return c.json({ ok: true, companyId, matchTier: company?.matchTier ?? 'suggested' })
  }
)

// GET /api/company/:id
companyRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id),
  })
  if (!company) return c.json({ error: 'Company not found' }, 404)

  const sourceRecords = await db.query.companySourceRecords.findMany({
    where: eq(companySourceRecords.companyId, id),
  })
  const identifiers = await db.query.companyIdentifiers.findMany({
    where: eq(companyIdentifiers.companyId, id),
  })

  return c.json({ ...company, sourceRecords, identifiers })
})
