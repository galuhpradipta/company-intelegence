import { pgTable, uuid, text, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'

export const companyIdentifiers = pgTable('company_identifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  identifierType: text('identifier_type').notNull(), // 'ein' | 'linkedin_url' | 'twitter' | 'ticker' | etc.
  identifierValue: text('identifier_value').notNull(),
  source: text('source').notNull(),
}, (table) => [
  uniqueIndex('company_identifiers_company_type_value_source_unique').on(
    table.companyId,
    table.identifierType,
    table.identifierValue,
    table.source,
  ),
  index('company_identifiers_company_id_idx').on(table.companyId),
])
