-- Trace des rappels d'abonnement déjà envoyés (voir lib/subscriptions.ts,
-- app/api/cron/subscription-reminders/route.ts). Une entrée par
-- (abonnement, mois de prélèvement à venir) empêche de renvoyer le même
-- rappel à chaque exécution du cron une fois qu'il a déjà été notifié pour
-- ce mois-ci.
CREATE TABLE "SubscriptionReminderSent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionReminderSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionReminderSent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubscriptionReminderSent_subscriptionId_yearMonth_key" ON "SubscriptionReminderSent" ("subscriptionId", "yearMonth");
CREATE INDEX "SubscriptionReminderSent_userId_idx" ON "SubscriptionReminderSent" ("userId");
