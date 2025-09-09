-- CreateEnum
CREATE TYPE "public"."CleaningStatus" AS ENUM ('DIRTY', 'CLEANING', 'CLEAN');

-- CreateEnum
CREATE TYPE "public"."LeasingStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OFF_MARKET');

-- AlterTable
ALTER TABLE "public"."Room" ADD COLUMN     "cleaningStatus" "public"."CleaningStatus" NOT NULL DEFAULT 'DIRTY',
ADD COLUMN     "leasingStatus" "public"."LeasingStatus" NOT NULL DEFAULT 'AVAILABLE';
