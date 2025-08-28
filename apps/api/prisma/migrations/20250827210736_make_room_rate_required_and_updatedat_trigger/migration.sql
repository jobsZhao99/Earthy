/*
  Warnings:

  - Made the column `nightlyRate` on table `Room` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Room" ALTER COLUMN "nightlyRate" SET NOT NULL;
