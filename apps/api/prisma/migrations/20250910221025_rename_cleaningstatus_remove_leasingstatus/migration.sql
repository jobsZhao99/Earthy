/*
  Warnings:

  - The values [TRANSFER] on the enum `BookingRecordStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `leasingStatus` on the `Room` table. All the data in the column will be lost.
  - The `cleaningStatus` column on the `Room` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."RoomStatus" AS ENUM ('CLEANED', 'CLEANING_SCHEDULED', 'OCCUPIED', 'CHECKED_OUT_DIRTY', 'ON_HOLD', 'MAINTENANCE', 'OFF_MARKET', 'RESERVED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."BookingRecordStatus_new" AS ENUM ('NEW', 'TRANSFER_IN', 'TRANSFER_OUT', 'CANCELL');
ALTER TABLE "public"."BookingRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."BookingRecord" ALTER COLUMN "status" TYPE "public"."BookingRecordStatus_new" USING ("status"::text::"public"."BookingRecordStatus_new");
ALTER TYPE "public"."BookingRecordStatus" RENAME TO "BookingRecordStatus_old";
ALTER TYPE "public"."BookingRecordStatus_new" RENAME TO "BookingRecordStatus";
DROP TYPE "public"."BookingRecordStatus_old";
ALTER TABLE "public"."BookingRecord" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "leasingStatus",
DROP COLUMN "cleaningStatus",
ADD COLUMN     "cleaningStatus" "public"."RoomStatus" NOT NULL DEFAULT 'CHECKED_OUT_DIRTY';

-- DropEnum
DROP TYPE "public"."CleaningStatus";

-- DropEnum
DROP TYPE "public"."LeasingStatus";
