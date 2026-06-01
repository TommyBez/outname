ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone_configured_at" timestamptz;

-- Existing accounts are treated as already configured so bootstrap does not
-- overwrite intentional UTC or re-sync on new browsers.
UPDATE "user"
SET "timezone_configured_at" = COALESCE("updatedAt", NOW())
WHERE "timezone_configured_at" IS NULL;
