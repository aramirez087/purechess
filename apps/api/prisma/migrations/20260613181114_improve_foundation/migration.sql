-- CreateEnum
CREATE TYPE "PuzzleAttemptSource" AS ENUM ('theme', 'daily', 'rush', 'review', 'mistake');

-- CreateEnum
CREATE TYPE "RepertoireColor" AS ENUM ('white', 'black');

-- CreateEnum
CREATE TYPE "EndgameCategory" AS ENUM ('basic_mate', 'king_pawn', 'rook', 'minor', 'queen', 'other');

-- CreateEnum
CREATE TYPE "EndgameObjective" AS ENUM ('win', 'draw');

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT[],
    "rating" INTEGER NOT NULL,
    "ratingDeviation" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "themes" TEXT[],
    "openingTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "msToSolve" INTEGER,
    "ratingBeforeUser" INTEGER,
    "ratingAfterUser" INTEGER,
    "source" "PuzzleAttemptSource" NOT NULL DEFAULT 'theme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleRating" (
    "userId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "deviation" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuzzleRating_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PuzzleReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuzzleReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "fen" TEXT NOT NULL,
    "playedUci" TEXT NOT NULL,
    "bestUci" TEXT NOT NULL,
    "bestLineUci" TEXT[],
    "cpLoss" INTEGER NOT NULL,
    "themeGuess" TEXT[],
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repertoire" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" "RepertoireColor" NOT NULL,
    "rootFen" TEXT NOT NULL,
    "treeJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repertoire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepertoireReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repertoireId" TEXT NOT NULL,
    "nodePath" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepertoireReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndgameDrill" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EndgameCategory" NOT NULL,
    "fen" TEXT NOT NULL,
    "objective" "EndgameObjective" NOT NULL,
    "targetDtm" INTEGER,
    "difficulty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndgameDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndgameAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "drillId" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "movesPlayed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndgameAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingStreak" (
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastTrainedOn" DATE,
    "dailyGoalPuzzles" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrainingDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "puzzlesSolved" INTEGER NOT NULL DEFAULT 0,
    "reviewsDone" INTEGER NOT NULL DEFAULT 0,
    "drillsDone" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Puzzle_rating_idx" ON "Puzzle"("rating");

-- CreateIndex
CREATE INDEX "Puzzle_themes_idx" ON "Puzzle" USING GIN ("themes");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_userId_idx" ON "PuzzleAttempt"("userId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_userId_puzzleId_idx" ON "PuzzleAttempt"("userId", "puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_userId_createdAt_idx" ON "PuzzleAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PuzzleReview_userId_dueAt_idx" ON "PuzzleReview"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleReview_userId_puzzleId_key" ON "PuzzleReview"("userId", "puzzleId");

-- CreateIndex
CREATE INDEX "GameMistake_userId_createdAt_idx" ON "GameMistake"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameMistake_gameId_ply_userId_key" ON "GameMistake"("gameId", "ply", "userId");

-- CreateIndex
CREATE INDEX "Repertoire_userId_idx" ON "Repertoire"("userId");

-- CreateIndex
CREATE INDEX "RepertoireReview_userId_dueAt_idx" ON "RepertoireReview"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "EndgameDrill_slug_key" ON "EndgameDrill"("slug");

-- CreateIndex
CREATE INDEX "EndgameAttempt_userId_drillId_idx" ON "EndgameAttempt"("userId", "drillId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDay_userId_day_key" ON "TrainingDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleRating" ADD CONSTRAINT "PuzzleRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleReview" ADD CONSTRAINT "PuzzleReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleReview" ADD CONSTRAINT "PuzzleReview_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMistake" ADD CONSTRAINT "GameMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repertoire" ADD CONSTRAINT "Repertoire_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepertoireReview" ADD CONSTRAINT "RepertoireReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepertoireReview" ADD CONSTRAINT "RepertoireReview_repertoireId_fkey" FOREIGN KEY ("repertoireId") REFERENCES "Repertoire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndgameAttempt" ADD CONSTRAINT "EndgameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndgameAttempt" ADD CONSTRAINT "EndgameAttempt_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "EndgameDrill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingStreak" ADD CONSTRAINT "TrainingStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDay" ADD CONSTRAINT "TrainingDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
