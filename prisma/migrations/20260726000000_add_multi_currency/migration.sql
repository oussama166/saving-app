-- Multi-devise (comptes en devise étrangère) — voir prisma/schema.prisma et
-- lib/exchangeRates.ts pour le détail. Ajoute une seule colonne à Account
-- (défaut "MAD", donc aucun compte existant n'est affecté) + une nouvelle
-- table de cache des taux de change.
ALTER TABLE "Account" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MAD';

CREATE TABLE "ExchangeRateCache" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rateToMad" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
