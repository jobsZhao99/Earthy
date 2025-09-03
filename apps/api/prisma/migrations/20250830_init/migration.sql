-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BookingRecordStatus" AS ENUM ('NEW', 'TRANSFER', 'CANCELL');

-- CreateEnum
CREATE TYPE "public"."AccountCode" AS ENUM ('RENT', 'PARKING', 'BEDDING', 'CLEANING', 'OTHERS');

-- CreateEnum
CREATE TYPE "public"."Channel" AS ENUM ('AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'DIRECT', 'LEASING_CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Ledger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "ledgerId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "roomId" TEXT NOT NULL,
    "status" "public"."BookingRecordStatus" NOT NULL DEFAULT 'NEW',
    "guestId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guestTotalCents" INTEGER,
    "payoutCents" INTEGER,
    "channel" "public"."Channel" NOT NULL DEFAULT 'AIRBNB',
    "confirmationCode" TEXT,
    "contractUrl" TEXT,
    "tzSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRecord_pkey" PRIMARY KEY ("id")
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
    "bookingId" TEXT NOT NULL,
    "account" "public"."AccountCode" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_ledgerId_idx" ON "public"."Property"("ledgerId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_ledgerId_name_key" ON "public"."Property"("ledgerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_label_key" ON "public"."Room"("propertyId", "label");

-- CreateIndex
CREATE INDEX "BookingRecord_roomId_guestId_idx" ON "public"."BookingRecord"("roomId", "guestId");

-- CreateIndex
CREATE INDEX "JournalEntry_periodMonth_idx" ON "public"."JournalEntry"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_periodMonth_ledgerId_key" ON "public"."JournalEntry"("periodMonth", "ledgerId");

-- CreateIndex
CREATE INDEX "JournalLine_account_journalId_idx" ON "public"."JournalLine"("account", "journalId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_bookingId_account_journalId_key" ON "public"."JournalLine"("bookingId", "account", "journalId");

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "public"."Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingRecord" ADD CONSTRAINT "BookingRecord_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingRecord" ADD CONSTRAINT "BookingRecord_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalEntry" ADD CONSTRAINT "JournalEntry_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "public"."Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "public"."JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."BookingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

