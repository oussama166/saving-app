import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { google } from "@ai-sdk/google";

// Bascule le modèle utilisé par les routes Coach IA / Stratégie & Conseils.
// "openrouter" : pour les tests (nécessite OPENROUTER_API_KEY dans .env).
// "google"     : Gemini, le provider par défaut du reste de l'app (FinanceAgent).
const PROVIDER = process.env.AI_PROVIDER ?? "openrouter";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": "Wealth OS",
  },
});

export const coachModel = google("gemini-2.5-flash");

PROVIDER === "google"
  ? google("gemini-2.5-flash")
  : openrouter.chat("openai/gpt-4o");
