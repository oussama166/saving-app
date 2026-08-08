-- Historique du patrimoine net (voir lib/netWorthHistory.ts, dashboard) —
-- une ligne par (userId, jour), capturée à chaque chargement du dashboard.
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "checkingBalanceMad" REAL NOT NULL,
    "savingsLockedMad" REAL NOT NULL,
    "portfolioValueMad" REAL NOT NULL,
    "debtsMad" REAL NOT NULL,
    "netWorthMad" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetWorthSnapshot_userId_date_key" ON "NetWorthSnapshot"("userId", "date");
CREATE INDEX "NetWorthSnapshot_userId_idx" ON "NetWorthSnapshot"("userId");
