-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "subCategory" TEXT;

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "referenceIncome" REAL NOT NULL DEFAULT 10000,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "emergencyFundTargetMonths" REAL NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT,
    "provider" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reimbursementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "budgetPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Category" ("createdAt", "id", "name", "type", "updatedAt") SELECT "createdAt", "id", "name", "type", "updatedAt" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE TABLE "new_PortfolioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "tickerSymbol" TEXT NOT NULL,
    "sharesOwned" REAL NOT NULL,
    "averageBuyPrice" REAL NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Action',
    "manualPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioAsset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PortfolioAsset" ("accountId", "averageBuyPrice", "createdAt", "id", "sharesOwned", "tickerSymbol", "updatedAt") SELECT "accountId", "averageBuyPrice", "createdAt", "id", "sharesOwned", "tickerSymbol", "updatedAt" FROM "PortfolioAsset";
DROP TABLE "PortfolioAsset";
ALTER TABLE "new_PortfolioAsset" RENAME TO "PortfolioAsset";
CREATE TABLE "new_SavingsGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "monthlyContribution" REAL NOT NULL DEFAULT 0,
    "emoji" TEXT,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "autoAllocatePct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SavingsGoal" ("autoAllocatePct", "createdAt", "currentAmount", "id", "name", "targetAmount", "updatedAt") SELECT "autoAllocatePct", "createdAt", "currentAmount", "id", "name", "targetAmount", "updatedAt" FROM "SavingsGoal";
DROP TABLE "SavingsGoal";
ALTER TABLE "new_SavingsGoal" RENAME TO "SavingsGoal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_transactionId_key" ON "MedicalRecord"("transactionId");
