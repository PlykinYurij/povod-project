-- Existing users and pending registrations remain valid without an invented name.
ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(80);
ALTER TABLE "pending_registrations" ADD COLUMN "display_name" VARCHAR(80);
