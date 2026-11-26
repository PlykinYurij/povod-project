CREATE TABLE "publication_resume_receipts" (
    "publication_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "actor_id" UUID NOT NULL,
    "publication_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "publication_resume_receipts_pkey" PRIMARY KEY ("publication_id", "key_hash"),
    CONSTRAINT "publication_resume_receipts_publication_id_fkey" FOREIGN KEY ("publication_id")
        REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
