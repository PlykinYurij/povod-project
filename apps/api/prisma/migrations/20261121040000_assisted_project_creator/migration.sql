ALTER TABLE "projects"
  ALTER COLUMN "owner_id" DROP NOT NULL,
  ADD COLUMN "created_by_user_id" UUID;

UPDATE "projects" SET "created_by_user_id" = "owner_id";

CREATE INDEX "projects_created_by_user_id_idx" ON "projects"("created_by_user_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
