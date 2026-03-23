import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { companies } from './companies.js'
import { newsArticles } from './news-articles.js'

export const companyArticles = pgTable('company_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  searchQuery: text('search_query').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('company_articles_company_article_unique').on(table.companyId, table.articleId),
  index('company_articles_company_id_idx').on(table.companyId),
])
