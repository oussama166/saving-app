import { z } from 'zod';

// Schémas Zod partagés entre les routes Coach IA (serveur, streamObject) et
// les composants client (experimental_useObject) — un seul endroit à changer
// si un champ évolue, et surtout une garantie que le client parse exactement
// ce que le serveur a promis de streamer.

export const diagnosticSchema = z.object({
  profilLabel: z.string().describe('2 à 4 mots : nom du profil dépensier du mois (ex: "Épargnant Discipliné").'),
  profilDesc: z.string().describe('1 phrase courte expliquant ce profil, avec les chiffres clés (%).'),
  pointFort: z
    .string()
    .describe('1 phrase : la catégorie ou le comportement le mieux maîtrisé ce mois-ci, chiffré. Si rien ne se démarque, le dire.'),
  pointFaible: z
    .string()
    .describe('1 phrase : la catégorie ou le comportement le plus problématique ce mois-ci, chiffré. Si rien ne pose problème, le dire.'),
  recommandation: z
    .string()
    .describe('1 à 2 phrases : action concrète et chiffrée à prendre ce mois-ci, adaptée à la situation.'),
});
export type DiagnosticAdvice = z.infer<typeof diagnosticSchema>;

export const tangerAdviceSchema = z.object({
  banques: z
    .string()
    .describe(
      "2-3 phrases courtes: recommandations de banques/comptes marocains adaptés au revenu et à l'épargne de l'utilisateur (CIH, Attijariwafa, Bank Of Africa...).",
    ),
  investissementMaroc: z
    .string()
    .describe(
      '2-3 phrases courtes: pistes concrètes pour investir au Maroc (Bourse de Casablanca, OPCVM, Bons du Trésor) adaptées au capital déjà investi.',
    ),
  investissementInternational: z
    .string()
    .describe(
      "2-3 phrases courtes: pistes pour diversifier à l'international (ETF mondiaux, dotation Office des Changes) adaptées à la capacité d'épargne actuelle.",
    ),
  erreursFatales: z
    .string()
    .describe('2-3 phrases courtes: mises en garde prioritaires et personnalisées selon la situation financière donnée.'),
});
export type TangerAdvice = z.infer<typeof tangerAdviceSchema>;

export const trendsInsightSchema = z.object({
  synthese: z
    .string()
    .describe("1-2 phrases: tendance générale des dépenses et de l'épargne sur la période observée."),
  pointAttention: z
    .string()
    .describe("1 phrase: le point le plus préoccupant (catégorie qui dérape, mois en dérapage, baisse du taux d'épargne...)."),
  recommandation: z
    .string()
    .describe('1 phrase: action concrète et chiffrée à prendre ce mois-ci pour corriger ou consolider la tendance.'),
});
export type TrendsInsightAdvice = z.infer<typeof trendsInsightSchema>;

export const preventionCoverageSchema = z.object({
  bilanAnnuel: z
    .string()
    .describe("2 phrases courtes: conseil de bilan de santé préventif, adapté au budget santé actuel de l'utilisateur."),
  couvertureCnss: z
    .string()
    .describe('2 phrases courtes: conseil sur la couverture CNSS/AMO, tenant compte des dossiers de remboursement en attente.'),
  mutuelle: z
    .string()
    .describe("2 phrases courtes: conseil sur une mutuelle complémentaire, adapté au poids réel des dépenses santé sur le revenu."),
  pharmacieGeneriques: z
    .string()
    .describe('2 phrases courtes: conseil pratique pour réduire la facture pharmacie/médicaments.'),
});
export type PreventionCoverageAdvice = z.infer<typeof preventionCoverageSchema>;

export const emergencyFundSchema = z.object({
  objectif: z
    .string()
    .describe('Une phrase courte et directe: diagnostic de la situation actuelle (manque, correct, ou excédentaire).'),
  methode: z
    .string()
    .describe('Une phrase courte et concrète: action chiffrée à prendre ce mois-ci (virement, réallocation...).'),
  recommandations: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe('2 à 3 placements ou banques marocaines courts (5-10 mots chacun), adaptés au montant en jeu.'),
});
export type EmergencyFundAdvice = z.infer<typeof emergencyFundSchema>;
