CREATE TYPE "ProjectPhotoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "project_photos" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "status" "ProjectPhotoStatus" NOT NULL DEFAULT 'UPLOADING',
  "upload_key_hash" CHAR(64) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "mime" VARCHAR(16) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "project_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_photos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "project_photos_image_limits" CHECK (
    "byte_size" BETWEEN 1 AND 15728640
    AND "width" > 0 AND "height" > 0 AND "width"::bigint * "height" <= 40000000
    AND "mime" IN ('image/jpeg', 'image/png', 'image/webp')
  )
);

CREATE UNIQUE INDEX "project_photos_project_id_upload_key_hash_key" ON "project_photos"("project_id", "upload_key_hash");
CREATE INDEX "project_photos_status_created_at_idx" ON "project_photos"("status", "created_at");
