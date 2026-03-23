import { pgTable, uuid, text, integer, real, timestamp, index } from 'drizzle-orm/pg-core'

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  legalName: text('legal_name'),
  domain: text('domain'),
  industry: text('industry'),
  employeeCount: integer('employee_count'),
  hqCity: text('hq_city'),
  hqState: text('hq_state'),
  hqCountry: text('hq_country').default('US'),
  matchTier: text('match_tier').notNull().default('not_found'), // 'confident' | 'suggested' | 'not_found'
  confidenceScore: real('confidence_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('companies_domain_idx').on(table.domain),
])
