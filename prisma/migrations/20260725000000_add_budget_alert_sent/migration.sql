-- Trace des emails d'alerte budget déjà envoyés (voir lib/budgetAlerts.ts).
-- Une entrée par (catégorie, mois, palier) empêche de renvoyer le même email
-- à chaque transaction suivante une fois le palier déjà franchi et notifié.
CREATE TABLE "BudgetAlertSent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetAlertSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetAlertSent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BudgetAlertSent_categoryId_yearMonth_threshold_key" ON "BudgetAlertSent" ("categoryId", "yearMonth", "threshold");
CREATE INDEX "BudgetAlertSent_userId_idx" ON "BudgetAlertSent" ("userId");
