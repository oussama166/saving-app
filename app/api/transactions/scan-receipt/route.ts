import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getBudgetOwnerUserId } from '@/lib/household';

// Taille max acceptée pour la photo (base64 décodé) — une photo de reçu
// n'a pas besoin d'être en haute résolution pour être lisible par le modèle,
// et ça évite un payload JSON énorme / un coût API inutile.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 Mo

const receiptSchema = z.object({
  merchant: z.string().describe('Nom du commerçant/enseigne tel qu\'il apparaît sur le reçu (ex: "Marjane", "Carrefour").'),
  amount: z.number().positive().describe('Montant TOTAL payé (TTC), en valeur absolue positive.'),
  date: z
    .string()
    .describe('Date de la transaction au format YYYY-MM-DD. Si illisible/absente, retourne la date du jour.'),
  categoryName: z
    .string()
    .nullable()
    .describe('Le nom de catégorie qui correspond le mieux, choisi EXACTEMENT parmi la liste fournie — ou null si aucune ne convient clairement.'),
  subCategory: z.string().nullable().describe('Type d\'achat précis, court (2-4 mots), optionnel.'),
  detectedCurrency: z
    .string()
    .nullable()
    .describe('Code devise ISO à 3 lettres si visible sur le reçu (ex: MAD, EUR, USD) — null si absent/illisible.'),
  lowConfidence: z
    .boolean()
    .describe('true si le reçu est flou, partiellement illisible, ou si tu as dû deviner un champ important.'),
});

// Scan d'un reçu photo → extraction structurée (marchand, montant, date,
// catégorie devinée) via Gemini multimodal (generateObject + image en
// entrée). Ne crée AUCUNE transaction ici — retourne juste les champs pour
// que l'utilisateur les relise/corrige avant de les soumettre à
// POST /api/transactions (flux "review before save" choisi volontairement :
// l'OCR sur un reçu, surtout froissé/mal éclairé, n'est pas fiable à 100%).
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { imageBase64, mediaType } = (await req.json()) as { imageBase64?: string; mediaType?: string };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: 'Image requise' }, { status: 400 });
    }
    if (!mediaType || !mediaType.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Type de fichier invalide (image attendue)' }, { status: 400 });
    }
    // Estimation rapide de la taille décodée sans décoder réellement (base64 : ~3/4 de la longueur).
    if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image trop volumineuse (max 8 Mo)' }, { status: 400 });
    }

    const budgetOwnerId = await getBudgetOwnerUserId(userId);
    const categories = await prisma.category.findMany({
      where: { userId: budgetOwnerId, type: { in: ['expense', 'savings'] } },
      orderBy: { order: 'asc' },
    });
    const categoryNames = categories.map((c) => c.name);

    const todayIso = new Date().toISOString().slice(0, 10);
    const systemPrompt = `Tu extrais les informations d'une photo de reçu/ticket de caisse marocain ou étranger. Sois précis sur le montant TOTAL (pas un sous-total ni la TVA seule). La date du jour est ${todayIso} si besoin de référence.`;

    const userPrompt = `Catégories disponibles (choisis EXACTEMENT un de ces noms pour "categoryName", ou null si aucune ne va) :\n${categoryNames.map((n) => `- ${n}`).join('\n')}`;

    const { object } = await generateObject({
      model: coachModel,
      system: systemPrompt,
      schema: receiptSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image', image: imageBase64, mediaType },
          ],
        },
      ],
    });

    // Résolution categoryName -> categoryId réel (le modèle ne connaît que
    // des noms, jamais des ids) — correspondance exacte d'abord, puis
    // insensible à la casse en repli. Aucune correspondance -> null (le
    // formulaire de review demandera à l'utilisateur de choisir).
    let matchedCategoryId: string | null = null;
    if (object.categoryName) {
      const exact = categories.find((c) => c.name === object.categoryName);
      const ci = exact ?? categories.find((c) => c.name.toLowerCase() === object.categoryName!.toLowerCase());
      matchedCategoryId = ci?.id ?? null;
    }

    return NextResponse.json({
      success: true,
      data: {
        merchant: object.merchant,
        amount: object.amount,
        date: object.date,
        categoryId: matchedCategoryId,
        categoryName: matchedCategoryId ? object.categoryName : null,
        subCategory: object.subCategory,
        detectedCurrency: object.detectedCurrency,
        lowConfidence: object.lowConfidence || !matchedCategoryId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Scan Receipt Error:', error);
    return NextResponse.json(
      { success: false, error: "Échec de la lecture du reçu — réessaie avec une photo plus nette." },
      { status: 500 },
    );
  }
}
