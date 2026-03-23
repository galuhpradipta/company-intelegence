WITH duplicate_batch_items AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY batch_upload_id, row_number
        ORDER BY id DESC
      ) AS row_num
    FROM batch_upload_items
  ) ranked
  WHERE row_num > 1
)
DELETE FROM batch_upload_items
WHERE id IN (SELECT id FROM duplicate_batch_items);

WITH duplicate_company_identifiers AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, identifier_type, identifier_value, source
        ORDER BY id DESC
      ) AS row_num
    FROM company_identifiers
  ) ranked
  WHERE row_num > 1
)
DELETE FROM company_identifiers
WHERE id IN (SELECT id FROM duplicate_company_identifiers);

WITH duplicate_company_source_records AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, provider, provider_record_id
        ORDER BY fetched_at DESC, id DESC
      ) AS row_num
    FROM company_source_records
  ) ranked
  WHERE row_num > 1
)
DELETE FROM company_source_records
WHERE id IN (SELECT id FROM duplicate_company_source_records);

WITH duplicate_company_matches AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY resolution_input_id, company_id
        ORDER BY rank ASC, id ASC
      ) AS row_num
    FROM company_matches
  ) ranked
  WHERE row_num > 1
)
DELETE FROM company_matches
WHERE id IN (SELECT id FROM duplicate_company_matches);

WITH duplicate_company_articles AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, article_id
        ORDER BY ingested_at DESC, id DESC
      ) AS row_num
    FROM company_articles
  ) ranked
  WHERE row_num > 1
)
DELETE FROM company_articles
WHERE id IN (SELECT id FROM duplicate_company_articles);

WITH duplicate_article_scores AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, article_id
        ORDER BY scored_at DESC NULLS LAST, id DESC
      ) AS row_num
    FROM article_relevancy_scores
  ) ranked
  WHERE row_num > 1
)
DELETE FROM article_relevancy_scores
WHERE id IN (SELECT id FROM duplicate_article_scores);

CREATE INDEX IF NOT EXISTS "companies_domain_idx" ON "companies" ("domain");

CREATE UNIQUE INDEX IF NOT EXISTS "batch_upload_items_batch_row_unique"
  ON "batch_upload_items" ("batch_upload_id", "row_number");
CREATE INDEX IF NOT EXISTS "batch_upload_items_batch_id_idx"
  ON "batch_upload_items" ("batch_upload_id");

CREATE UNIQUE INDEX IF NOT EXISTS "company_identifiers_company_type_value_source_unique"
  ON "company_identifiers" ("company_id", "identifier_type", "identifier_value", "source");
CREATE INDEX IF NOT EXISTS "company_identifiers_company_id_idx"
  ON "company_identifiers" ("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "company_source_records_company_provider_record_unique"
  ON "company_source_records" ("company_id", "provider", "provider_record_id");
CREATE INDEX IF NOT EXISTS "company_source_records_company_id_idx"
  ON "company_source_records" ("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "company_matches_resolution_company_unique"
  ON "company_matches" ("resolution_input_id", "company_id");
CREATE INDEX IF NOT EXISTS "company_matches_resolution_input_id_idx"
  ON "company_matches" ("resolution_input_id");

CREATE UNIQUE INDEX IF NOT EXISTS "company_articles_company_article_unique"
  ON "company_articles" ("company_id", "article_id");
CREATE INDEX IF NOT EXISTS "company_articles_company_id_idx"
  ON "company_articles" ("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "article_relevancy_scores_company_article_unique"
  ON "article_relevancy_scores" ("company_id", "article_id");
CREATE INDEX IF NOT EXISTS "article_relevancy_scores_company_id_idx"
  ON "article_relevancy_scores" ("company_id");
