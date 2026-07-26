-- Jour du mois (1-28) marquant le début du cycle budgétaire (par défaut, jour
-- de paie approximatif) — voir lib/budgetCycle.ts. Défaut à 1 : aucun
-- changement de comportement pour les comptes existants tant que l'utilisateur
-- ne configure pas son propre jour de paie dans Profil.
ALTER TABLE "UserSettings" ADD COLUMN "budgetCycleStartDay" INTEGER NOT NULL DEFAULT 1;
