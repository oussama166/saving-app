-- Historique des changements de plan/prix d'abonnement détectés
-- automatiquement par /api/webhook/subscription-payment (ex: Netflix
-- Standard 45 DH -> Premium 95 DH). Voir prisma/schema.prisma pour le
-- commentaire complet.
CREATE TABLE "SubscriptionPlanChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousName" TEXT NOT NULL,
    "newName" TEXT NOT NULL,
    "previousPrice" REAL NOT NULL,
    "newPrice" REAL NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlanChange_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionPlanChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SubscriptionPlanChange_subscriptionId_idx" ON "SubscriptionPlanChange" ("subscriptionId");
