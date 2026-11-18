CREATE TABLE "password_resets" (
  "email_key" CHAR(64) PRIMARY KEY,
  "id" UUID NOT NULL UNIQUE,
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "delivered_at" TIMESTAMPTZ(3),
  "used_at" TIMESTAMPTZ(3)
);
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets"("expires_at");
CREATE TABLE "reset_rate_limits" (
  "key" CHAR(64) PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  "expires_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "reset_rate_limits_expires_at_idx" ON "reset_rate_limits"("expires_at");
