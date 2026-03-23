import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'

export const companySourceRecords = pgTable('company_source_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'people_data_labs' | 'opencorporates' | 'clearbit' | 'ai_fallback'
  providerRecordId: text('provider_record_id'),
  rawPayload: jsonb('raw_payload').notNull(),
  fieldConfidence: jsonb('field_confidence').notNull().default({}),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})
