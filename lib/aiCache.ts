import { prisma } from '@/lib/prisma';

// TTL par défaut pour tout le cache Coach IA / Stratégie & Conseils — limite
// la consommation de tokens à un appel LLM par section par semaine et par
// utilisateur (clé composite userId+key, voir schema.prisma AiAdviceCache).
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCachedAdvice<T = unknown>(userId: string, key: string, ttlMs = DEFAULT_TTL_MS) {
  const cached = await prisma.aiAdviceCache.findUnique({ where: { userId_key: { userId, key } } });
  const isFresh = cached && Date.now() - cached.generatedAt.getTime() < ttlMs;
  if (!isFresh) return null;
  return { content: JSON.parse(cached.content) as T, generatedAt: cached.generatedAt };
}

export async function setCachedAdvice(userId: string, key: string, content: unknown) {
  const generatedAt = new Date();
  await prisma.aiAdviceCache.upsert({
    where: { userId_key: { userId, key } },
    update: { content: JSON.stringify(content), generatedAt },
    create: { userId, key, content: JSON.stringify(content), generatedAt },
  });
  return generatedAt;
}
