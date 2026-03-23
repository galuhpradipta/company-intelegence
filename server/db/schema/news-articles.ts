import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const newsArticles = pgTable('news_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalUrl: text('canonical_url').notNull(),
  urlHash: text('url_hash').notNull().unique(),
  title: text('title').notNull(),
  sourceName: text('source_name').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  snippet: text('snippet'),
  fullText: text('full_text'),
  dedupeFingerprint: text('dedupe_fingerprint').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
})
