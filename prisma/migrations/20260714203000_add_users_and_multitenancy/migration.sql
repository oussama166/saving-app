-- Migration manuelle (écrite à la main, pas générée par `prisma migrate dev`)
-- car les tables Account/Category/Transaction/MedicalRecord/UserSettings
-- contiennent déjà des données et la nouvelle colonne `userId` est
-- obligatoire sans valeur par défaut. On crée d'abord un utilisateur
-- "bootstrap" qui récupère toutes les données existantes, puis on
-- reconstruit chaque table avec la colonne userId remplie.

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Utilisateur bootstrap : reçoit toutes les données existantes.
-- Email : oussamaouardi80@gmail.com
-- Mot de passe temporaire : Tanger-isb547!9  (à changer après la première connexion)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
VALUES (
  'usr_06b5dc04643db98bb6436bd4',
  'oussamaouardi80@gmail.com',
  '$2a$10$wpnanA2DqVoRT1oNAV7lLOCjDBh/nYizVjy64Y.khaqjhH/JLPt4m',
  'Oussama',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=OFF;

-- RedefineTable: UserSettings (1 ligne existante)
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referenceIncome" REAL NOT NULL DEFAULT 10000,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "emergencyFundTargetMonths" REAL NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("id", "userId", "referenceIncome", "currency", "emergencyFundTargetMonths", "updatedAt")
SELECT "id", 'usr_06b5dc04643db98bb6436bd4', "referenceIncome", "currency", "emergencyFundTargetMonths", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- RedefineTable: Account (1 ligne existante)
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("id", "userId", "name", "type", "balance", "createdAt", "updatedAt")
SELECT "id", 'usr_06b5dc04643db98bb6436bd4', "name", "type", "balance", "createdAt", "updatedAt" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";

-- RedefineTable: Category (15 lignes existantes)
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "budgetPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("id", "userId", "name", "type", "order", "budgetPct", "createdAt", "updatedAt")
SELECT "id", 'usr_06b5dc04643db98bb6436bd4', "name", "type", "order", "budgetPct", "createdAt", "updatedAt" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";

-- RedefineTable: Transaction (5 lignes existantes)
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subCategory" TEXT,
    "paymentMethod" TEXT,
    "merchant" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("id", "userId", "accountId", "categoryId", "subCategory", "paymentMethod", "merchant", "amount", "date", "createdAt", "updatedAt")
SELECT "id", 'usr_06b5dc04643db98bb6436bd4', "accountId", "categoryId", "subCategory", "paymentMethod", "merchant", "amount", "date", "createdAt", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";

-- RedefineTable: MedicalRecord (1 ligne existante)
CREATE TABLE "new_MedicalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "provider" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reimbursementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicalRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MedicalRecord" ("id", "userId", "transactionId", "provider", "amount", "reimbursementStatus", "date", "createdAt")
SELECT "id", 'usr_06b5dc04643db98bb6436bd4', "transactionId", "provider", "amount", "reimbursementStatus", "date", "createdAt" FROM "MedicalRecord";
DROP TABLE "MedicalRecord";
ALTER TABLE "new_MedicalRecord" RENAME TO "MedicalRecord";
CREATE UNIQUE INDEX "MedicalRecord_transactionId_key" ON "MedicalRecord"("transactionId");

-- RedefineTable: SavingsGoal (0 ligne — recréation directe)
DROP TABLE "SavingsGoal";
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "monthlyContribution" REAL NOT NULL DEFAULT 0,
    "emoji" TEXT,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "autoAllocatePct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTable: PortfolioAsset (0 ligne — recréation directe)
DROP TABLE "PortfolioAsset";
CREATE TABLE "PortfolioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tickerSymbol" TEXT NOT NULL,
    "sharesOwned" REAL NOT NULL,
    "averageBuyPrice" REAL NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Action',
    "manualPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PortfolioAsset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTable: AiAdviceCache (0 ligne — recréation directe, unique compound userId+key)
DROP TABLE "AiAdviceCache";
CREATE TABLE "AiAdviceCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAdviceCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiAdviceCache_userId_key_key" ON "AiAdviceCache"("userId", "key");

PRAGMA foreign_keys=ON;
