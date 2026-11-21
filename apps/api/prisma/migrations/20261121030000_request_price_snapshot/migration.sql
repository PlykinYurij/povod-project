BEGIN;
ALTER TABLE "service_requests"
  ADD COLUMN "price_snapshot_minor" INTEGER,
  ADD COLUMN "price_snapshot_currency" VARCHAR(3),
  ADD COLUMN "price_snapshot_version" INTEGER,
  ADD CONSTRAINT "service_requests_price_snapshot_complete" CHECK (
    ("price_snapshot_minor" IS NULL AND "price_snapshot_currency" IS NULL AND "price_snapshot_version" IS NULL)
    OR ("price_snapshot_minor" IS NOT NULL AND "price_snapshot_currency" IS NOT NULL AND "price_snapshot_version" IS NOT NULL
      AND "price_snapshot_minor" >= 0 AND "price_snapshot_currency" = 'RUB' AND "price_snapshot_version" > 0)
  );
COMMIT;
