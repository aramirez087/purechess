-- AddColumn: engine state snapshot for vs-computer games
ALTER TABLE "Game" ADD COLUMN "engineState"      JSONB;
ALTER TABLE "Game" ADD COLUMN "lastComputerMove" TEXT;

-- Make Move.userId nullable (computer moves have no user)
ALTER TABLE "Move" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Move" ADD COLUMN "isComputer" BOOLEAN NOT NULL DEFAULT FALSE;
