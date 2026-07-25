import { findCatalogEntry, findClosestPlan } from "@/lib/subscriptionCatalog";

// Tolérance (MAD) en dessous de laquelle on considère que le montant reçu
// correspond au plan déjà enregistré — évite de renommer l'abonnement pour
// de simples arrondis/frais bancaires plutôt qu'un vrai changement de plan.
// Partagé entre /api/webhook/subscription-payment et
// /api/webhook/subscriptions-import pour que les deux détectent un
// changement de plan de la même façon.
export const PLAN_CHANGE_TOLERANCE_MAD = 1;

export interface DetectedPlanChange {
  previousName: string;
  newName: string;
  label: string;
  previousPrice: number;
  newPrice: number;
}

/**
 * Détecte un changement de plan/formule (ex: Netflix Standard -> Premium) à
 * partir d'un montant observé, pour un abonnement du catalogue
 * (lib/subscriptionCatalog.ts) ayant plusieurs formules possibles. Retourne
 * `null` si l'abonnement n'a pas de `provider` catalogue, n'a qu'une seule
 * formule, ou si le montant observé correspond déjà (à la tolérance près)
 * au prix enregistré.
 *
 * Le libellé du plan vit dans `Subscription.name` (convention déjà utilisée
 * par le formulaire manuel, ex: "Netflix (Premium)"), PAS dans
 * `subCategory` — ce dernier reste la catégorie large ("Streaming Vidéo")
 * suggérée par le catalogue, partagée par tous les plans d'un même service.
 */
export function detectPlanChange(
  subscription: { provider: string | null; price: number; name: string },
  observedAmount: number,
): DetectedPlanChange | null {
  if (!subscription.provider) return null;

  const catalogEntry = findCatalogEntry(subscription.provider);
  if (!catalogEntry || catalogEntry.plans.length <= 1) return null;

  const closestPlan = findClosestPlan(catalogEntry, observedAmount);
  const priceDrifted = Math.abs(closestPlan.price - subscription.price) > PLAN_CHANGE_TOLERANCE_MAD;
  const newName = `${catalogEntry.name} (${closestPlan.label})`;

  if (!priceDrifted || newName === subscription.name) return null;

  return {
    previousName: subscription.name,
    newName,
    label: closestPlan.label,
    previousPrice: subscription.price,
    newPrice: observedAmount,
  };
}
