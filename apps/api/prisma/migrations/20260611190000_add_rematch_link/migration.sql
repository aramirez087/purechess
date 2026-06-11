-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "rematchGameId" TEXT,
ADD COLUMN     "rematchOfferedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_rematchGameId_key" ON "Game"("rematchGameId");
