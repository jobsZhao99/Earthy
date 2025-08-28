-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccountCode" AS ENUM ('RENT', 'PARKING', 'BEDDING', 'CLEANING', 'OTHERS');

-- CreateEnum
CREATE TYPE "public"."Channel" AS ENUM ('AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'DIRECT', 'LEASING_CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
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
    "nightlyRate" DECIMAL(10,2) NOT NULL,
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
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guestTotal" DECIMAL(65,30),
    "payout" DECIMAL(65,30),
    "channel" "public"."Channel" NOT NULL DEFAULT 'AIRBNB',
    "tzSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalEntry" (
    "id" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "bookingId" TEXT,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "account" "public"."AccountCode" NOT NULL,
    "amountCents" DECIMAL(10,2) NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_roomId_idx" ON "public"."Booking"("roomId");

-- CreateIndex
CREATE INDEX "Booking_guestId_idx" ON "public"."Booking"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_periodMonth_key" ON "public"."JournalEntry"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_bookingId_account_periodMonth_key" ON "public"."JournalLine"("bookingId", "account", "periodMonth");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "public"."JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

