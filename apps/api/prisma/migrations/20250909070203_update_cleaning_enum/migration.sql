/*
  Warnings:

  - The values [CLEANING] on the enum `CleaningStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."CleaningStatus_new" AS ENUM ('DIRTY', 'OCCUPIED', 'CLEAN');
ALTER TABLE "public"."Room" ALTER COLUMN "cleaningStatus" DROP DEFAULT;
ALTER TABLE "public"."Room" ALTER COLUMN "cleaningStatus" TYPE "public"."CleaningStatus_new" USING ("cleaningStatus"::text::"public"."CleaningStatus_new");
ALTER TYPE "public"."CleaningStatus" RENAME TO "CleaningStatus_old";
ALTER TYPE "public"."CleaningStatus_new" RENAME TO "CleaningStatus";
DROP TYPE "public"."CleaningStatus_old";
ALTER TABLE "public"."Room" ALTER COLUMN "cleaningStatus" SET DEFAULT 'DIRTY';
COMMIT;
