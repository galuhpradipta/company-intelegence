CREATE TABLE "resolution_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"raw_input" jsonb NOT NULL,
	"normalized_input" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_upload_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_upload_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"resolution_input_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_company_id" uuid,
	"top_score" real,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"domain" text,
	"industry" text,
	"employee_count" integer,
	"hq_city" text,
	"hq_state" text,
	"hq_country" text DEFAULT 'US',
	"match_tier" text DEFAULT 'not_found' NOT NULL,
	"confidence_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"identifier_type" text NOT NULL,
	"identifier_value" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_record_id" text,
	"raw_payload" jsonb NOT NULL,
	"field_confidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resolution_input_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"score" real NOT NULL,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_url" text NOT NULL,
	"url_hash" text NOT NULL,
	"title" text NOT NULL,
	"source_name" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"snippet" text,
	"full_text" text,
	"dedupe_fingerprint" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "news_articles_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE TABLE "company_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"search_query" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_relevancy_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"model" text NOT NULL,
	"model_snapshot" text,
	"prompt_version" text DEFAULT 'v1' NOT NULL,
	"relevancy_score" integer,
	"category" text,
	"explanation" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"raw_response" jsonb,
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD CONSTRAINT "batch_upload_items_batch_upload_id_batch_uploads_id_fk" FOREIGN KEY ("batch_upload_id") REFERENCES "public"."batch_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD CONSTRAINT "batch_upload_items_resolution_input_id_resolution_inputs_id_fk" FOREIGN KEY ("resolution_input_id") REFERENCES "public"."resolution_inputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD CONSTRAINT "batch_upload_items_result_company_id_companies_id_fk" FOREIGN KEY ("result_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_identifiers" ADD CONSTRAINT "company_identifiers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_source_records" ADD CONSTRAINT "company_source_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_matches" ADD CONSTRAINT "company_matches_resolution_input_id_resolution_inputs_id_fk" FOREIGN KEY ("resolution_input_id") REFERENCES "public"."resolution_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_matches" ADD CONSTRAINT "company_matches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_articles" ADD CONSTRAINT "company_articles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_articles" ADD CONSTRAINT "company_articles_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_relevancy_scores" ADD CONSTRAINT "article_relevancy_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_relevancy_scores" ADD CONSTRAINT "article_relevancy_scores_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;