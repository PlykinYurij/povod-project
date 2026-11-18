CREATE TABLE "sessions" (
  "token_hash" CHAR(64) PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "sessions_time_order" CHECK ("created_at" <= "last_seen_at" AND "created_at" < "expires_at")
);
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE TABLE "login_attempts" (
  "key" CHAR(64) PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" BETWEEN 1 AND 5),
  "expires_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "login_attempts_expires_at_idx" ON "login_attempts"("expires_at");
