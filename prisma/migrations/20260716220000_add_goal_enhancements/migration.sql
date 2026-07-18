-- Objectifs d'épargne enrichis (type, bénéficiaire, échéance, épargne
-- automatique) + historique des versements (GoalContribution).
-- accountId/categoryId ajoutés nullable (SQLite exige un DEFAULT pour NOT
-- NULL sur ALTER TABLE ADD COLUMN) — la table SavingsGoal est vide au
-- moment de cette migration, donc aucune ligne existante à backfill ;
-- Prisma/l'API garantissent ces champs pour toute nouvelle écriture.
ALTER TABLE "SavingsGoal" ADD COLUMN "accountId" TEXT REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD COLUMN "categoryId" TEXT REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD COLUMN "goalType" TEXT NOT NULL DEFAULT 'personnel';
ALTER TABLE "SavingsGoal" ADD COLUMN "beneficiary" TEXT;
ALTER TABLE "SavingsGoal" ADD COLUMN "note" TEXT;
ALTER TABLE "SavingsGoal" ADD COLUMN "targetDate" DATETIME;
ALTER TABLE "SavingsGoal" ADD COLUMN "autoContribute" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SavingsGoal" ADD COLUMN "contributionDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SavingsGoal" ADD COLUMN "lastContributedYearMonth" TEXT;

-- CreateIndex
CREATE INDEX "SavingsGoal_accountId_idx" ON "SavingsGoal"("accountId");

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoalContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoalContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoalContribution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalContribution_transactionId_key" ON "GoalContribution"("transactionId");
CREATE INDEX "GoalContribution_goalId_idx" ON "GoalContribution"("goalId");
CREATE INDEX "GoalContribution_userId_idx" ON "GoalContribution"("userId");
