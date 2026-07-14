// Depuis le passage au multi-utilisateur, les catégories/sous-catégories par
// défaut ne sont plus seedées globalement : elles sont créées automatiquement
// pour chaque nouveau compte à l'inscription (voir seedDefaultsForUser() dans
// lib/seedDefaults.ts, appelée par app/api/auth/signup/route.ts).
//
// Ce script ne fait donc plus qu'un rappel — il n'y a rien à seeder tant
// qu'aucun compte n'existe. Utile pour `npx prisma db seed` en CI/local sans
// erreur, et comme pense-bête.
import { DEFAULT_CATEGORIES, PAYMENT_METHODS } from "../lib/seedDefaults";

async function main() {
  const total = DEFAULT_CATEGORIES.filter((c) => c.type !== "income").reduce(
    (acc, c) => acc + c.budgetPct,
    0,
  );
  if (total !== 100) {
    throw new Error(
      `Les budgetPct des catégories par défaut somment à ${total}%, pas 100%.`,
    );
  }

  console.log(
    "Rien à seeder globalement : les catégories par défaut sont créées automatiquement à l'inscription de chaque compte (seedDefaultsForUser).",
  );
  console.log(
    `  ${DEFAULT_CATEGORIES.length} catégories par défaut définies dans lib/seedDefaults.ts, budgetPct valide (100%).`,
  );
  console.log("  Méthodes de paiement de référence : " + PAYMENT_METHODS.join(", "));
  console.log("\nCrée un compte via /signup pour peupler tes propres données.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
