-- Ajout de la préférence de langue (fr/ar/en/es) — colonne avec valeur par
-- défaut sur une table déjà peuplée, pas besoin de reconstruction de table
-- SQLite ici (contrairement à la migration multi-tenant précédente).
ALTER TABLE "UserSettings" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fr';
