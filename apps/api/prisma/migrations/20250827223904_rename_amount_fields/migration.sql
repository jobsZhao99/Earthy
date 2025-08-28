-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "guestTotalCents" DECIMAL(65,30),
ADD COLUMN     "payoutCents" DECIMAL(65,30),
ADD COLUMN     "tzSnapshot" TEXT;

-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';
