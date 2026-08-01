-- Système de méthodologies budgétaires flexibles (50/30/20, 70/20/10, base
-- zéro, enveloppes, se payer en premier, règle des 60%, Kakeibo, custom) —
-- voir lib/budgetMethods.ts.

-- Groupe utilisé par les méthodes en ratio, remplace NEEDS_CATEGORIES codé
-- en dur dans lib/financials.ts.
ALTER TABLE "Category" ADD COLUMN "budgetGroup" TEXT;

-- Backfill : les 5 catégories historiquement considérées comme "Besoins"
-- (voir l'ancien NEEDS_CATEGORIES) passent explicitement à "essential" pour
-- que le comportement existant (règle 50/30/20 déjà en prod) ne change pas
-- pour les utilisateurs actuels tant qu'ils n'ont pas reclassé eux-mêmes
-- leurs catégories.
UPDATE "Category" SET "budgetGroup" = 'essential'
  WHERE "name" IN ('Logement & Charges', 'Alimentation & Restauration', 'Transport & Mobilité', 'Santé & Médical', 'Éducation & Développement')
  AND "type" = 'expense';

-- Méthodologie sélectionnée par l'utilisateur (page Profil). "503020"
-- reproduit le comportement historique (seule méthode qui existait jusqu'ici).
ALTER TABLE "UserSettings" ADD COLUMN "budgetMethod" TEXT NOT NULL DEFAULT '503020';

-- Journal Kakeibo — une entrée par mois et par propriétaire budget.
CREATE TABLE "KakeiboEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "reflection1" TEXT,
    "reflection2" TEXT,
    "reflection3" TEXT,
    "reflection4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KakeiboEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KakeiboEntry_userId_monthKey_key" ON "KakeiboEntry"("userId", "monthKey");
