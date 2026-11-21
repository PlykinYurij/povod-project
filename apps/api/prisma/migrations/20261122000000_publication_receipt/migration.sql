CREATE TABLE "publication_receipts" (
    "request_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "actor_id" UUID,
    "key_hash" CHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "url" VARCHAR(262) NOT NULL,
    "request_version" INTEGER NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "publication_receipts_pkey" PRIMARY KEY ("request_id"),
    CONSTRAINT "publication_receipts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "publication_receipts_snapshot_id_publication_id_fkey" FOREIGN KEY ("snapshot_id", "publication_id") REFERENCES "publication_snapshots"("id", "publication_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "publication_receipts_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "publication_receipts_snapshot_id_publication_id_key" ON "publication_receipts"("snapshot_id", "publication_id");
CREATE INDEX "publication_receipts_actor_id_idx" ON "publication_receipts"("actor_id");
