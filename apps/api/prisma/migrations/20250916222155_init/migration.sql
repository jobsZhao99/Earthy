-- CreateEnum
CREATE TYPE "public"."BookingRecordType" AS ENUM ('NEW', 'UPDATE', 'CANCEL', 'EXTEND', 'SHORTEN', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AccountCode" AS ENUM ('RENT', 'PARKING', 'BEDDING', 'CLEANING', 'OTHERS');

-- CreateEnum
CREATE TYPE "public"."RoomStatus" AS ENUM ('OCCUPIED', 'CHECKED_OUT_DIRTY', 'CLEANING_SCHEDULED', 'CLEANED', 'ON_HOLD', 'MAINTENANCE', 'OFF_MARKET', 'LONG_TERM');

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ledger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Channel" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "ledgerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nightlyRateCents" INTEGER,
    "roomStatus" "public"."RoomStatus" NOT NULL DEFAULT 'CHECKED_OUT_DIRTY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tag" TEXT DEFAULT '',

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingRecord" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "public"."BookingRecordType" NOT NULL DEFAULT 'NEW',
    "guestDeltaCents" INTEGER,
    "payoutDeltaCents" INTEGER,
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,

    CONSTRAINT "BookingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "guestId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guestTotalCents" INTEGER,
    "payoutCents" INTEGER,
    "channelId" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalEntry" (
    "id" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "bookingRecordId" TEXT NOT NULL,
    "account" "public"."AccountCode" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "public"."Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_name_key" ON "public"."Ledger"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_label_key" ON "public"."Channel"("label");

-- CreateIndex
CREATE INDEX "Property_ledgerId_idx" ON "public"."Property"("ledgerId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_ledgerId_name_key" ON "public"."Property"("ledgerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_label_key" ON "public"."Room"("propertyId", "label");

-- CreateIndex
CREATE INDEX "Booking_externalRef_channelId_idx" ON "public"."Booking"("externalRef", "channelId");

-- CreateIndex
CREATE INDEX "Booking_roomId_guestId_idx" ON "public"."Booking"("roomId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_externalRef_channelId_roomId_key" ON "public"."Booking"("externalRef", "channelId", "roomId");

-- CreateIndex
CREATE INDEX "JournalEntry_periodMonth_idx" ON "public"."JournalEntry"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_periodMonth_ledgerId_key" ON "public"."JournalEntry"("periodMonth", "ledgerId");

-- CreateIndex
CREATE INDEX "JournalLine_account_journalId_idx" ON "public"."JournalLine"("account", "journalId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_bookingRecordId_account_journalId_key" ON "public"."JournalLine"("bookingRecordId", "account", "journalId");

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "public"."Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingRecord" ADD CONSTRAINT "BookingRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalEntry" ADD CONSTRAINT "JournalEntry_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "public"."Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "public"."JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_bookingRecordId_fkey" FOREIGN KEY ("bookingRecordId") REFERENCES "public"."BookingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
