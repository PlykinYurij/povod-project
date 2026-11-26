ALTER TABLE "publications"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "paused_at" TIMESTAMPTZ(3),
    ADD CONSTRAINT "publications_version_positive" CHECK ("version" > 0),
    ADD CONSTRAINT "publications_valid_pause" CHECK (
        "paused_at" IS NULL OR (NOT "visible" AND "paused_at" < "expires_at")
    );

CREATE TABLE "publication_unpublish_receipts" (
    "publication_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "publication_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paused_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_id" UUID NOT NULL,
    "mode" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(240) NOT NULL,
    CONSTRAINT "publication_unpublish_receipts_pkey" PRIMARY KEY ("publication_id", "key_hash"),
    CONSTRAINT "publication_unpublish_receipts_publication_id_fkey" FOREIGN KEY ("publication_id")
        REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
