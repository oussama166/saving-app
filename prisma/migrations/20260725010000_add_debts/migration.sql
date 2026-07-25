-- Suivi des dettes/prêts (crédit conso, prêt immobilier, dette perso) et de
-- leur historique de remboursement. Voir prisma/schema.prisma pour le
-- commentaire complet (modèles Debt / DebtPayment).
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'autre',
    "lender" TEXT,
    "principal" REAL NOT NULL,
    "currentBalance" REAL NOT NULL,
    "interestRate" REAL NOT NULL DEFAULT 0,
    "monthlyPayment" REAL NOT NULL DEFAULT 0,
    "dueDay" INTEGER,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Debt_userId_idx" ON "Debt" ("userId");

CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DebtPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DebtPayment_transactionId_key" ON "DebtPayment" ("transactionId");
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment" ("debtId");
CREATE INDEX "DebtPayment_userId_idx" ON "DebtPayment" ("userId");
