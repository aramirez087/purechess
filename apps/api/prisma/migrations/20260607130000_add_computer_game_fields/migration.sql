-- AlterTable
ALTER TABLE "Game" ADD COLUMN "computerColor" TEXT;
ALTER TABLE "Game" ADD COLUMN "computerLevel" INTEGER;
ALTER TABLE "Game" ADD COLUMN "isVsComputer" BOOLEAN NOT NULL DEFAULT false;
