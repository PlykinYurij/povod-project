-- Existing users are not silently declared verified. Their policy is Q-22.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMPTZ(3);
