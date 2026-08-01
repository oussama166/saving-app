import { google } from "@ai-sdk/google";

// Modèle unique utilisé par toutes les fonctionnalités IA de l'app (Coach IA
// + chat flottant FinanceAgent, voir app/api/chat/route.ts) — un seul point
// de configuration pour changer de modèle plus tard. Un ancien switch
// OPENROUTER_API_KEY/AI_PROVIDER existait ici mais n'était jamais réellement
// branché (le ternaire n'était ni assigné ni exporté) : coachModel était donc
// toujours Gemini quelle que soit la valeur de AI_PROVIDER. Supprimé plutôt
// que réparé, faute d'usage réel du provider OpenRouter dans l'app.
export const coachModel = google("gemini-2.5-flash");
