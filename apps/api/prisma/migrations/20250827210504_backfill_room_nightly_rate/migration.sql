-- This is an empty migration.

-- backfill nightlyRate for existing rows
UPDATE "Room" SET "nightlyRate" = 45.00 WHERE "nightlyRate" IS NULL;