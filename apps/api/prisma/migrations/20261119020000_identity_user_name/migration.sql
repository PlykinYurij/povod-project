-- Preserve names already saved before the public field was renamed in code review.
ALTER TABLE "users" RENAME COLUMN "display_name" TO "user_name";
ALTER TABLE "pending_registrations" RENAME COLUMN "display_name" TO "user_name";
