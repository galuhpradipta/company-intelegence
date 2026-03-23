import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const resolutionInputs = pgTable('resolution_inputs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type').notNull(), // 'single' | 'csv'
  rawInput: jsonb('raw_input').notNull(),
  normalizedInput: jsonb('normalized_input').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
