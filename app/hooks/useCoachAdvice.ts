"use client";

import { useCallback, useEffect, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import type { z } from "zod";

// Hook partagé par les 5 sections Coach IA (CoachDiagnosticTab, TrendsInsight,
// EmergencyFundStrategy, PreventionCoverage, TangerFinancialAdvice) — avant,
// chacune dupliquait le même useEffect(fetch + setState loading/failed/
// generatedAt). Basé sur experimental_useObject (voir @ai-sdk/react), qui
// consomme le flux JSON progressif renvoyé par lib/coachHandler.ts côté
// serveur : `object` se remplit champ par champ pendant la génération au lieu
// d'un blanc de plusieurs secondes suivi d'un affichage d'un coup.
//
// Sur un cache hit, le serveur renvoie directement le JSON complet (pas de
// streaming nécessaire, déjà instantané) — experimental_useObject gère les
// deux cas de façon transparente. Les métadonnées `cached`/`generatedAt` sont
// transmises en en-têtes HTTP (X-Coach-Cached / X-Coach-Generated-At) plutôt
// que dans le corps JSON, car ce dernier doit être uniquement l'objet
// conforme au schéma pour que experimental_useObject puisse le parser.
export function useCoachAdvice<Schema extends z.ZodTypeAny>(api: string, schema: Schema, input: unknown) {
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  // L'input peut être un objet recréé à chaque rendu côté appelant (ex:
  // littéral `{ ... }` dans le JSX) — capturé une seule fois via un
  // initialiseur paresseux de useState (jamais réassigné ensuite) pour ne
  // déclencher la requête qu'au montage, sans muter de ref pendant le rendu
  // (voir la règle eslint react-hooks/refs).
  const [snapshotInput] = useState(input);

  const captureHeaders: typeof fetch = useCallback(async (url, init) => {
    const res = await fetch(url, init);
    setCached(res.headers.get("X-Coach-Cached") === "true");
    setGeneratedAt(res.headers.get("X-Coach-Generated-At"));
    return res;
  }, []);

  const { object, submit, isLoading, error } = useObject({
    api,
    schema,
    fetch: captureHeaders,
  });

  useEffect(() => {
    submit(snapshotInput as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = useCallback(() => {
    submit({ ...(snapshotInput as Record<string, unknown>), force: true } as never);
  }, [submit, snapshotInput]);

  return {
    advice: object,
    loading: isLoading && !object,
    regenerating: isLoading && Boolean(object),
    failed: Boolean(error),
    generatedAt,
    cached,
    regenerate,
  };
}
