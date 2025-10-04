-- AlterTable
ALTER TABLE "public"."BookingRecord" ADD COLUMN     "createdByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."BookingRecord" ADD CONSTRAINT "BookingRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
