import { pgTable, uuid, integer, real, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { resolutionInputs } from './resolution-inputs.js'
import { companies } from './companies.js'

export const companyMatches = pgTable('company_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  resolutionInputId: uuid('resolution_input_id').notNull().references(() => resolutionInputs.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull().default(1),
  score: real('score').notNull(),
  scoreBreakdown: jsonb('score_breakdown').notNull().default({}),
  selected: boolean('selected').notNull().default(false),
}, (table) => [
  uniqueIndex('company_matches_resolution_company_unique').on(table.resolutionInputId, table.companyId),
  index('company_matches_resolution_input_id_idx').on(table.resolutionInputId),
])
