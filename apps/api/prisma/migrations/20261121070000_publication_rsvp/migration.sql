CREATE TYPE "RsvpFormSchema" AS ENUM ('garden_v1');
CREATE TYPE "RsvpAttendance" AS ENUM ('yes', 'no');

CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "publications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "publications_slug_format" CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
    CONSTRAINT "publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "publications_project_id_key" ON "publications"("project_id");
CREATE UNIQUE INDEX "publications_slug_key" ON "publications"("slug");

CREATE TABLE "publication_snapshots" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "project_revision" INTEGER NOT NULL CHECK ("project_revision" > 0),
    "content" JSONB NOT NULL,
    "form_schema" "RsvpFormSchema" NOT NULL,
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publication_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "publication_snapshots_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "publication_snapshots_id_publication_id_key" ON "publication_snapshots"("id", "publication_id");
CREATE UNIQUE INDEX "publication_snapshots_current_key" ON "publication_snapshots"("publication_id") WHERE "superseded_at" IS NULL;

CREATE TABLE "rsvp_responses" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL CHECK (char_length("name") > 0),
    "attendance" "RsvpAttendance" NOT NULL,
    "companions" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rsvp_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rsvp_responses_companions" CHECK ("companions" BETWEEN 0 AND 2 AND ("attendance" = 'yes' OR "companions" = 0)),
    CONSTRAINT "rsvp_responses_form_version_id_publication_id_fkey" FOREIGN KEY ("form_version_id", "publication_id") REFERENCES "publication_snapshots"("id", "publication_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "rsvp_responses_publication_id_key_hash_key" ON "rsvp_responses"("publication_id", "key_hash");
CREATE INDEX "rsvp_responses_form_version_id_publication_id_idx" ON "rsvp_responses"("form_version_id", "publication_id");

CREATE TABLE "rsvp_rate_limits" (
    "publication_id" UUID NOT NULL,
    "client_key" CHAR(64) NOT NULL,
    "count" INTEGER NOT NULL CHECK ("count" > 0),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "rsvp_rate_limits_pkey" PRIMARY KEY ("publication_id", "client_key"),
    CONSTRAINT "rsvp_rate_limits_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "rsvp_rate_limits_expires_at_idx" ON "rsvp_rate_limits"("expires_at");
