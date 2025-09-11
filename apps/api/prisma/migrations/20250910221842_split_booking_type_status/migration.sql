/*
  Warnings:

  - The `status` column on the `BookingRecord` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."BookingRecordType" AS ENUM ('NEW', 'TRANSFER_IN', 'TRANSFER_OUT', 'CANCELL');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('FUTURE', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."BookingRecord" ADD COLUMN     "type" "public"."BookingRecordType" NOT NULL DEFAULT 'NEW',
DROP COLUMN "status",
ADD COLUMN     "status" "public"."BookingStatus" NOT NULL DEFAULT 'FUTURE';

-- DropEnum
DROP TYPE "public"."BookingRecordStatus";
