// Catalogue de modèles d'objectifs d'épargne courants, pour accélérer la
// création d'un nouvel objectif (voir le sélecteur dans GoalsTable.tsx).
// Même esprit que lib/subscriptionCatalog.ts : une liste pré-remplie plutôt
// qu'un formulaire vide, l'utilisateur reste libre d'ajuster tout ensuite
// (nom, montant, bénéficiaire...) ou de partir de "Personnalisé".
export interface GoalTemplate {
  key: string;
  label: string;
  emoji: string;
  goalType: 'personnel' | 'famille' | 'urgence' | 'projet';
  suggestedNote?: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { key: 'urgence', label: "Fonds d'urgence", emoji: '🛟', goalType: 'urgence', suggestedNote: "3 à 6 mois de dépenses essentielles" },
  { key: 'scolarite', label: 'Frais de scolarité', emoji: '🎓', goalType: 'famille', suggestedNote: 'Rentrée scolaire / universitaire' },
  { key: 'mariage', label: 'Mariage', emoji: '💍', goalType: 'projet' },
  { key: 'voyage', label: 'Voyage', emoji: '✈️', goalType: 'personnel' },
  { key: 'immobilier', label: 'Achat immobilier (apport)', emoji: '🏠', goalType: 'projet' },
  { key: 'vehicule', label: 'Véhicule', emoji: '🚗', goalType: 'projet' },
  { key: 'retraite', label: 'Retraite', emoji: '🌅', goalType: 'personnel' },
  { key: 'sante', label: 'Santé / imprévu médical', emoji: '🏥', goalType: 'urgence' },
  { key: 'naissance', label: "Naissance d'un enfant", emoji: '👶', goalType: 'famille' },
  { key: 'business', label: 'Projet personnel / business', emoji: '💡', goalType: 'projet' },
];

export function findGoalTemplate(key: string | null | undefined): GoalTemplate | undefined {
  if (!key) return undefined;
  return GOAL_TEMPLATES.find((t) => t.key === key);
}
