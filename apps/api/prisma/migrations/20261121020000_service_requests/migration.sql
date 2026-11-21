BEGIN;
CREATE TYPE "ServiceRequestKind" AS ENUM ('ASSISTANCE', 'PUBLICATION');
CREATE TYPE "ContactChannel" AS ENUM ('TELEGRAM', 'MAX', 'VK');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "service_requests" (
  "id" UUID PRIMARY KEY,
  "kind" "ServiceRequestKind" NOT NULL DEFAULT 'ASSISTANCE',
  "project_id" UUID REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customer_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "contact_name" VARCHAR(80) NOT NULL,
  "phone" VARCHAR(16) NOT NULL CHECK ("phone" ~ '^\+[1-9][0-9]{6,14}$'),
  "contact_channel" "ContactChannel" NOT NULL,
  "contact_value" VARCHAR(200) NOT NULL,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW',
  "request_version" INTEGER NOT NULL DEFAULT 1 CHECK ("request_version" > 0),
  "submitted_revision" INTEGER CHECK ("submitted_revision" > 0),
  "creation_key_hash" CHAR(64) NOT NULL,
  "creation_payload_hash" CHAR(64) NOT NULL,
  "consent_at" TIMESTAMPTZ(3) NOT NULL,
  "consent_version" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "service_requests_publication_basis" CHECK ("kind" <> 'PUBLICATION' OR ("project_id" IS NOT NULL AND "submitted_revision" IS NOT NULL))
);
CREATE UNIQUE INDEX "service_requests_creation_key_hash_key" ON "service_requests"("creation_key_hash");
CREATE UNIQUE INDEX "service_requests_one_open_per_project" ON "service_requests"("project_id") WHERE "status" IN ('NEW', 'IN_PROGRESS');
CREATE INDEX "service_requests_status_created_at_id_idx" ON "service_requests"("status", "created_at", "id");
CREATE INDEX "service_requests_customer_user_id_created_at_idx" ON "service_requests"("customer_user_id", "created_at");

CREATE TABLE "service_request_rate_limits" (
  "key" CHAR(64) PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  "expires_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "service_request_rate_limits_expires_at_idx" ON "service_request_rate_limits"("expires_at");
COMMIT;
