-- Ajoute le regroupement parent/enfant (sous-fonctionnalités, ex: les
-- cartes de la page Profil activables une par une) et un message custom par
-- fonctionnalité, affiché à la place du texte générique par défaut.
ALTER TABLE "Feature" ADD COLUMN "parentKey" TEXT;
ALTER TABLE "Feature" ADD COLUMN "customMessage" TEXT;
