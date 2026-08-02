-- Historique du score de discipline budgétaire (voir lib/budgetDiscipline.ts,
-- app/calendrier) — une ligne par (userId, jour), capturée à chaque
-- chargement de la page Calendrier plutôt que via un cron.
CREATE TABLE "DailyBudgetSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "safeDailySpendMad" REAL NOT NULL,
    "spentMad" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyBudgetSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DailyBudgetSnapshot_userId_date_key" ON "DailyBudgetSnapshot"("userId", "date");
CREATE INDEX "DailyBudgetSnapshot_userId_idx" ON "DailyBudgetSnapshot"("userId");
