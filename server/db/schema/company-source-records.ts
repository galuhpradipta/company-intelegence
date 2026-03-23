import { pgTable, uuid, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'

export const companySourceRecords = pgTable('company_source_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'people_data_labs' | 'opencorporates' | 'clearbit' | 'ai_fallback'
  providerRecordId: text('provider_record_id'),
  rawPayload: jsonb('raw_payload').notNull(),
  fieldConfidence: jsonb('field_confidence').notNull().default({}),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('company_source_records_company_provider_record_unique').on(
    table.companyId,
    table.provider,
    table.providerRecordId,
  ),
  index('company_source_records_company_id_idx').on(table.companyId),
])
