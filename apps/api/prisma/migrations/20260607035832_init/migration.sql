-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('white_wins', 'black_wins', 'draw');

-- CreateEnum
CREATE TYPE "GameResultReason" AS ENUM ('checkmate', 'resignation', 'timeout', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_move_rule', 'draw_agreement', 'abandonment');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('pending', 'active', 'completed', 'aborted', 'invite_pending');

-- CreateEnum
CREATE TYPE "TimeControlCategory" AS ENUM ('bullet', 'blitz', 'rapid');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewed', 'dismissed');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple');

-- CreateEnum
CREATE TYPE "FairPlaySignalType" AS ENUM ('low_variance_move_time', 'suspicious_accuracy', 'abnormal_streak', 'multi_account_ip', 'multi_account_fingerprint');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" CITEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "TimeControlCategory" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1500,
    "ratingDeviation" INTEGER NOT NULL DEFAULT 350,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "TimeControlCategory" NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "ratingDelta" INTEGER NOT NULL,
    "gameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "whiteUserId" TEXT NOT NULL,
    "blackUserId" TEXT NOT NULL,
    "timeControlSeconds" INTEGER NOT NULL,
    "incrementSeconds" INTEGER NOT NULL DEFAULT 0,
    "category" "TimeControlCategory" NOT NULL,
    "isRated" BOOLEAN NOT NULL DEFAULT true,
    "result" "GameResult",
    "resultReason" "GameResultReason",
    "status" "GameStatus" NOT NULL DEFAULT 'pending',
    "startingFen" TEXT,
    "finalFen" TEXT,
    "pgn" TEXT,
    "whiteRatingBefore" INTEGER,
    "blackRatingBefore" INTEGER,
    "whiteRatingAfter" INTEGER,
    "blackRatingAfter" INTEGER,
    "inviteToken" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "ply" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "san" TEXT NOT NULL,
    "uci" TEXT NOT NULL,
    "fenAfterMove" TEXT NOT NULL,
    "clockAfterMoveMs" INTEGER NOT NULL,
    "moveTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "gameId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairPlaySignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "signalType" "FairPlaySignalType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairPlaySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_category_key" ON "Rating"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Game_inviteToken_key" ON "Game"("inviteToken");

-- CreateIndex
CREATE INDEX "Game_whiteUserId_createdAt_idx" ON "Game"("whiteUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Game_blackUserId_createdAt_idx" ON "Game"("blackUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Game_status_createdAt_idx" ON "Game"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Game_category_createdAt_idx" ON "Game"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Move_gameId_ply_key" ON "Move"("gameId", "ply");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_whiteUserId_fkey" FOREIGN KEY ("whiteUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_blackUserId_fkey" FOREIGN KEY ("blackUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairPlaySignal" ADD CONSTRAINT "FairPlaySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairPlaySignal" ADD CONSTRAINT "FairPlaySignal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
