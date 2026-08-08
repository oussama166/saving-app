// Hook global d'erreurs Next.js (stable depuis Next 15) — capte toute
// exception non gérée côté serveur (routes API, rendu de pages, server
// actions) SANS avoir à modifier chaque route une par une. Délègue à
// lib/errorMonitoring.ts (no-op propre si SENTRY_DSN absent). Les routes API
// gardent leurs propres `console.error` + réponse 500 explicite (comportement
// inchangé) — ce hook est un filet de sécurité en plus, pas un remplacement.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  const { captureError } = await import('@/lib/errorMonitoring');
  await captureError(error, {
    route: `${context.routeType} ${context.routePath} (${request.method} ${request.path})`,
  });
}
