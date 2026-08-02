-- Historique du score de conformité aux "Règles d'Or" (voir
-- lib/goldenRules.ts, app/coach) — une ligne par (userId, jour), capturée à
-- chaque visite de la page Coach IA plutôt que via un cron.
CREATE TABLE "GoldenRuleSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "rulesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoldenRuleSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoldenRuleSnapshot_userId_date_key" ON "GoldenRuleSnapshot"("userId", "date");
CREATE INDEX "GoldenRuleSnapshot_userId_idx" ON "GoldenRuleSnapshot"("userId");
