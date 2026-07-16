-- Ajout des champs location/latitude/longitude (capturés par le webhook
-- Apple Pay pour la catégorisation automatique par position — voir
-- lib/placeCategory.ts) et isRejected (transaction refusée car dépassant le
-- "Safe to Spend" au moment du paiement, déjà calculé côté webhook mais
-- jamais persisté jusqu'ici).
ALTER TABLE "Transaction" ADD COLUMN "location" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "latitude" REAL;
ALTER TABLE "Transaction" ADD COLUMN "longitude" REAL;
ALTER TABLE "Transaction" ADD COLUMN "isRejected" BOOLEAN NOT NULL DEFAULT false;
