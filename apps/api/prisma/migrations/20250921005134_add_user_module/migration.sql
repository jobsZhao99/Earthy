-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LedgerUser" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "LedgerUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerUser_ledgerId_userId_key" ON "public"."LedgerUser"("ledgerId", "userId");

-- AddForeignKey
ALTER TABLE "public"."LedgerUser" ADD CONSTRAINT "LedgerUser_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "public"."Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LedgerUser" ADD CONSTRAINT "LedgerUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
