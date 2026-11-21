ALTER TABLE "project_photos"
  ADD COLUMN "processing_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lease_until" TIMESTAMPTZ(3),
  ADD COLUMN "lease_token" UUID,
  ADD COLUMN "rendition_token" UUID,
  ADD COLUMN "render_width" INTEGER,
  ADD COLUMN "render_height" INTEGER,
  ADD CONSTRAINT "project_photos_worker_fields" CHECK (
    "processing_attempts" BETWEEN 0 AND 3
    AND ("lease_token" IS NULL OR ("status" = 'PROCESSING' AND "lease_until" IS NOT NULL))
    AND (
      ("status" <> 'READY' AND "rendition_token" IS NULL AND "render_width" IS NULL AND "render_height" IS NULL)
      OR ("status" = 'READY' AND "rendition_token" IS NOT NULL AND "render_width" IS NOT NULL
        AND "render_height" IS NOT NULL AND "render_width" BETWEEN 1 AND 1600
        AND "render_height" BETWEEN 1 AND 1600)
    )
  );
