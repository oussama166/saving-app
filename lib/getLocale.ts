import { prisma } from '@/lib/prisma';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';

/**
 * Langue persistée de l'utilisateur (UserSettings.language) — server-only
 * (importe Prisma). Utilisé par les pages/route serveur pour traduire le
 * contenu SSR et adapter les prompts IA à la langue choisie, séparément du
 * localStorage côté client (voir LanguageProvider) qui gère l'affichage
 * instantané sans aller-retour réseau.
 */
export async function getUserLocale(userId: string): Promise<Locale> {
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { language: true } });
  return isLocale(settings?.language) ? settings.language : DEFAULT_LOCALE;
}
