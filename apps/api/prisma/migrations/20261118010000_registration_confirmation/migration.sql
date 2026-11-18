CREATE TABLE "pending_registrations" (
  "email" VARCHAR(254) PRIMARY KEY,
  "id" UUID NOT NULL UNIQUE,
  "nonce" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "delete_at" TIMESTAMPTZ(3) NOT NULL,
  "delivered_at" TIMESTAMPTZ(3)
);
CREATE INDEX "pending_registrations_delete_at_idx" ON "pending_registrations"("delete_at");
