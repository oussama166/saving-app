-- Correctif ponctuel (pas une migration de schéma) : recatégorise à chaud
-- les transactions déjà importées via l'ancienne version du nettoyage CSV
-- (lib/bankStatementParser.ts), quand le libellé nettoyé est déjà correct
-- ("Virement BMCE Direct — Houssam", "Retrait GAB — ...", etc.) mais que la
-- catégorie est restée Uncategorized parce que la règle de catégorisation
-- correspondante a été ajoutée/corrigée après coup.
--
-- Sans effet sur les lignes qui n'ont PAS ce libellé nettoyé (ex: les
-- lignes brutes/corrompues importées par le tout premier bug de service
-- worker — celles-là doivent être supprimées à la main depuis
-- Historique & Audit, un script ne peut pas deviner un libellé illisible).
--
-- À exécuter avec : turso db shell <ton-nom-de-db> < scripts/fix-uncategorized-bank-transfers.sql
--
-- Identifiants entre guillemets doubles partout (convention Prisma — "Transaction"
-- est un mot réservé SQL sans les guillemets). Chaque UPDATE ne touche que les
-- transactions dont le libellé matche exactement le format généré par
-- lib/bankStatementParser.ts, et ne recatégorise que via la Category du MÊME
-- utilisateur que la transaction ("Transaction"."userId") — sûr même dans un
-- foyer partagé à plusieurs comptes.

-- 1. Virements BMCE Direct vers un tiers → Divers & Imprévus / Virement Bancaire
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Virement Bancaire'
WHERE "merchant" LIKE 'Virement BMCE Direct — %'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 2. Commissions sur virement vers confrère → Divers & Imprévus / Imprévus divers
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Imprévus divers'
WHERE "merchant" LIKE 'Commission virement — %'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 3. TVA sur commission de virement → Divers & Imprévus / Imprévus divers
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Imprévus divers'
WHERE "merchant" LIKE 'TVA commission virement — %'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 4. Retraits GAB (cash) → Divers & Imprévus / Imprévus divers
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Imprévus divers'
WHERE "merchant" LIKE 'Retrait GAB — %'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 5. Commissions sur retrait GAB → Divers & Imprévus / Imprévus divers
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Imprévus divers'
WHERE "merchant" LIKE 'Commission retrait GAB — %'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 6. Agios (intérêts débiteurs) → Divers & Imprévus / Imprévus divers
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus'),
  "subCategory" = 'Imprévus divers'
WHERE "merchant" = 'Agios (intérêts débiteurs)'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Divers & Imprévus');

-- 7. Factures télécom (Inwi/IAM/Orange/Wana) → Logement & Charges / Internet & Téléphone
UPDATE "Transaction"
SET
  "categoryId" = (SELECT c."id" FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Logement & Charges'),
  "subCategory" = 'Internet & Téléphone'
WHERE (
    "merchant" LIKE 'Facture — %Inwi%' OR "merchant" LIKE 'Facture — %IAM%'
    OR "merchant" LIKE 'Facture — %Orange%' OR "merchant" LIKE 'Facture — %Wana%'
  )
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = "Transaction"."userId" AND c."name" = 'Logement & Charges');
