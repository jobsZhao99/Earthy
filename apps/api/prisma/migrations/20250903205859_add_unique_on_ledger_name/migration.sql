/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Ledger` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Ledger_name_key" ON "public"."Ledger"("name");
