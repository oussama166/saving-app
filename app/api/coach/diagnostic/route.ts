import { NextResponse } from "next/server";
import { streamCoachAdvice } from "@/lib/coachHandler";
import { diagnosticSchema } from "@/lib/coachSchemas";
import { requireSession } from "@/lib/auth";
import { getUserLocale } from "@/lib/getLocale";
import { aiLanguageInstruction, t } from "@/lib/i18n";
import type { BudgetMethodResult } from "@/lib/budgetMethods";
import { getBudgetMethodDef } from "@/lib/budgetMethods";

const CACHE_KEY = "diagnostic-coach";

interface BudgetDetail {
  categoryName: string;
  budgetedAmount: number;
  spentAmount: number;
  usedPct: number;
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const {
      budgetDetails,
      budgetMethodKey,
      budgetMethodResult,
      emergencyFundMonths,
      healthScore,
      force,
    } = (await req.json()) as {
      budgetDetails: BudgetDetail[];
      budgetMethodKey: string;
      budgetMethodResult: BudgetMethodResult | null;
      emergencyFundMonths: number;
      healthScore: number;
      force?: boolean;
    };

    if (!Array.isArray(budgetDetails)) {
      return NextResponse.json(
        { success: false, error: "Données de diagnostic invalides" },
        { status: 400 },
      );
    }

    const systemPrompt = `Tu es un coach financier basé à Casablanca, Maroc. Style: direct, chiffré, jamais générique. Tu analyses le mois en cours de l'utilisateur pour lui donner un diagnostic honnête. ${aiLanguageInstruction(locale)}`;

    const budgetLines = budgetDetails
      .filter((b) => b.budgetedAmount > 0)
      .map(
        (b) =>
          `- ${b.categoryName}: ${Math.round(b.spentAmount)} DH dépensés / ${Math.round(b.budgetedAmount)} DH prévus (${b.usedPct}% utilisé)`,
      )
      .join("\n");

    // La méthode budgétaire choisie par l'utilisateur (page Profil,
    // lib/budgetMethods.ts) n'est plus supposée être 50/30/20 par défaut —
    // on décrit dynamiquement les buckets réels de SA méthode ("ratio":
    // buckets calculés en %, sinon allocation/journal sans répartition en %).
    const methodDef = getBudgetMethodDef(budgetMethodKey);
    const methodLabel = t("fr", methodDef.labelKey, budgetMethodKey);
    const methodLine = budgetMethodResult
      ? `- Méthode suivie : ${methodLabel} — ${budgetMethodResult.buckets
          .map(
            (b) =>
              `${t("fr", b.labelKey, b.key)} ${b.actualPct}% (cible ${b.targetPct}%)`,
          )
          .join(", ")}`
      : `- Méthode suivie : ${methodLabel} (pas de répartition en % globale pour cette méthode — se référer au détail par catégorie ci-dessous)`;

    const userPrompt = `Situation du mois en cours :
${methodLine}
- Fonds d'urgence : ${emergencyFundMonths.toFixed(1)} mois de dépenses couverts
- Score de santé financière : ${healthScore}%

Détail par catégorie budgétaire :
${budgetLines || "Aucune dépense catégorisée ce mois-ci."}

Donne un profil dépensier, un point fort, un point faible et une recommandation, chacun chiffré et adapté précisément à ces données et à la méthode budgétaire suivie par l'utilisateur.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: {
        budgetDetails,
        budgetMethodKey,
        budgetMethodResult,
        emergencyFundMonths,
        healthScore,
      },
      schema: diagnosticSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }
    console.error("Diagnostic Coach Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
