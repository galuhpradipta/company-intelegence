ALTER TABLE "batch_upload_items" ADD COLUMN "raw_input" jsonb;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "batch_upload_items"
SET
  "raw_input" = '{}'::jsonb,
  "status" = CASE
    WHEN "status" IN ('pending', 'processing') THEN 'failed'
    ELSE "status"
  END,
  "error_message" = CASE
    WHEN "status" IN ('pending', 'processing')
      THEN COALESCE("error_message", 'Batch row data unavailable from pre-resumable upload')
    ELSE "error_message"
  END,
  "completed_at" = CASE
    WHEN "status" IN ('pending', 'processing') THEN COALESCE("completed_at", now())
    ELSE "completed_at"
  END,
  "updated_at" = now()
WHERE "raw_input" IS NULL;--> statement-breakpoint
ALTER TABLE "batch_upload_items" ALTER COLUMN "raw_input" SET NOT NULL;
