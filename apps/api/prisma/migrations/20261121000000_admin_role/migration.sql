CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- Existing accounts remain ordinary users; no implicit administrator bootstrap.
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
