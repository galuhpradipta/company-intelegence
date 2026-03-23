import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'
import { newsArticles } from './news-articles.js'

export const articleRelevancyScores = pgTable('article_relevancy_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  modelSnapshot: text('model_snapshot'),
  promptVersion: text('prompt_version').notNull().default('v1'),
  relevancyScore: integer('relevancy_score'), // 0-100
  category: text('category'), // enum values
  explanation: text('explanation'), // max 160 chars
  status: text('status').notNull().default('pending'), // 'pending' | 'scored' | 'failed'
  rawResponse: jsonb('raw_response'),
  scoredAt: timestamp('scored_at', { withTimezone: true }),
})
