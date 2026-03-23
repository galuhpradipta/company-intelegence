import { pgTable, uuid, text, integer, real, timestamp } from 'drizzle-orm/pg-core'
import { batchUploads } from './batch-uploads.js'
import { resolutionInputs } from './resolution-inputs.js'
import { companies } from './companies.js'

export const batchUploadItems = pgTable('batch_upload_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchUploadId: uuid('batch_upload_id').notNull().references(() => batchUploads.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  resolutionInputId: uuid('resolution_input_id').references(() => resolutionInputs.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  resultCompanyId: uuid('result_company_id').references(() => companies.id),
  topScore: real('top_score'),
  errorMessage: text('error_message'),
})
