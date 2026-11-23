CREATE TABLE "rsvp_deleted_keys" (
    "response_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    CONSTRAINT "rsvp_deleted_keys_pkey" PRIMARY KEY ("response_id"),
    CONSTRAINT "rsvp_deleted_keys_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "rsvp_deleted_keys_publication_id_key_hash_key" ON "rsvp_deleted_keys"("publication_id", "key_hash");
