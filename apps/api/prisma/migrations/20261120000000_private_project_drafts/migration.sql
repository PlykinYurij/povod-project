CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "title" VARCHAR(24) NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
    "creation_key_hash" CHAR(64) NOT NULL,
    "creation_payload_hash" CHAR(64) NOT NULL,
    "first_published_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "projects_owner_id_creation_key_hash_key" ON "projects"("owner_id", "creation_key_hash");
CREATE INDEX "projects_owner_id_deleted_at_first_published_at_idx" ON "projects"("owner_id", "deleted_at", "first_published_at");
