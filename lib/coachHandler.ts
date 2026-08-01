import crypto from "node:crypto";
import { streamObject } from "ai";
import type { z } from "zod";
import { coachModel } from "@/lib/aiProvider";
import { getCachedAdvice, setCachedAdvice } from "@/lib/aiCache";
import type { Locale } from "@/lib/i18n";

// Helper partagé par les 5 routes Coach IA (diagnostic, tanger-advice,
// trends-insight, prevention-coverage, emergency-fund) — avant, chacune
// dupliquait la même logique (vérif cache -> generateObject -> écriture
// cache -> réponse JSON). Deux changements de comportement par rapport à
// l'ancienne version dupliquée :
// 1. Streaming : generateObject (bloquant, tout ou rien) est remplacé par
//    streamObject, consommé côté client par experimental_useObject — le
//    contenu s'affiche au fur et à mesure au lieu d'un blanc de plusieurs
//    secondes. Sur cache hit, on renvoie directement le JSON complet (déjà
//    instantané, pas besoin de "streamer" quelque chose qu'on a déjà en
//    entier).
// 2. Invalidation intelligente : la clé de cache inclut désormais un hash
//    des données financières d'entrée (`hashInput`). Si le mois change ou
//    qu'une grosse transaction fait bouger les chiffres passés en entrée, la
//    clé change automatiquement et le cache est invalidé sans logique
//    d'expiration dédiée à écrire — en plus du TTL fixe de 7 jours déjà en
//    place dans lib/aiCache.ts. Le bouton "regénérer" (`force: true`) ignore
//    le cache dans les deux sens (lecture ET écriture reste normale, la
//    nouvelle génération réécrit la même clé).
export function hashInput(input: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(input)).digest("hex").slice(0, 12);
}

interface StreamCoachAdviceOptions<Schema extends z.ZodTypeAny> {
  userId: string;
  locale: Locale;
  /** Identifiant stable de la section (ex: 'diagnostic-coach'), voir CACHE_KEY dans chaque route. */
  baseCacheKey: string;
  /** Données financières ayant servi à construire le prompt — hashées pour l'invalidation automatique du cache. */
  input: unknown;
  schema: Schema;
  system: string;
  prompt: string;
  /** true si l'utilisateur clique sur "Régénérer" — ignore un cache par ailleurs valide. */
  force?: boolean;
}

export async function streamCoachAdvice<Schema extends z.ZodTypeAny>({
  userId,
  locale,
  baseCacheKey,
  input,
  schema,
  system,
  prompt,
  force,
}: StreamCoachAdviceOptions<Schema>): Promise<Response> {
  const fullKey = `${baseCacheKey}:${locale}:${hashInput(input)}`;

  if (!force) {
    const cached = await getCachedAdvice<z.infer<Schema>>(userId, fullKey);
    if (cached) {
      return new Response(JSON.stringify(cached.content), {
        headers: {
          "Content-Type": "application/json",
          "X-Coach-Cached": "true",
          "X-Coach-Generated-At": cached.generatedAt.toISOString(),
        },
      });
    }
  }

  const generatedAt = new Date().toISOString();

  const result = streamObject({
    model: coachModel,
    schema,
    system,
    prompt,
    onFinish: async ({ object }) => {
      // object peut être undefined si la génération ne respecte pas le
      // schéma (rare, mais possible) — dans ce cas on ne met rien en cache,
      // le prochain chargement retentera un appel LLM plutôt que de servir
      // un contenu invalide.
      if (object) await setCachedAdvice(userId, fullKey, object);
    },
  });

  return result.toTextStreamResponse({
    headers: { "X-Coach-Cached": "false", "X-Coach-Generated-At": generatedAt },
  });
}
