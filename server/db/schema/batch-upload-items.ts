import { pgTable, uuid, text, integer, real, index, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { batchUploads } from './batch-uploads.js'
import { resolutionInputs } from './resolution-inputs.js'
import { companies } from './companies.js'

export const batchUploadItems = pgTable('batch_upload_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchUploadId: uuid('batch_upload_id').notNull().references(() => batchUploads.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  rawInput: jsonb('raw_input').notNull(),
  resolutionInputId: uuid('resolution_input_id').references(() => resolutionInputs.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  resultCompanyId: uuid('result_company_id').references(() => companies.id),
  topScore: real('top_score'),
  attemptCount: integer('attempt_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('batch_upload_items_batch_row_unique').on(table.batchUploadId, table.rowNumber),
  index('batch_upload_items_batch_id_idx').on(table.batchUploadId),
])
