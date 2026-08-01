import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Petit endpoint de diagnostic pour le badge dev (voir DevEnvBadge.tsx) —
// renvoie sur quelle base l'app tourne réellement, pour ne plus jamais se
// tromper entre wealthos-prod et wealthos-preprod en local (voir la session
// de debug qui a précédé ce fichier). Volontairement 404 en dehors de
// NODE_ENV=development, à la fois pour ne jamais exposer ces infos (même le
// nom de la base) en prod, et parce que le composant client vérifie déjà
// process.env.NODE_ENV avant même d'appeler cet endpoint — double filet.
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawUrl = process.env.TURSO_DATABASE_URL;

  let database: { label: string; kind: 'local' | 'preprod' | 'prod' | 'other'; host: string | null };

  if (!rawUrl) {
    database = { label: 'Fichier local', kind: 'local', host: './dev.db' };
  } else {
    const host = rawUrl.replace(/^libsql:\/\//, '');
    // Le nom de la base est le premier segment du host Turso
    // (ex: "wealthos-preprod-oussama166.aws-eu-west-1.turso.io" ->
    // "wealthos-preprod-oussama166"). "preprod" testé AVANT "prod" — sinon
    // "preprod" matcherait aussi le test générique "prod" (sous-chaîne).
    const dbName = host.split('.')[0];
    const kind = dbName.includes('preprod') ? 'preprod' : dbName.includes('prod') ? 'prod' : 'other';
    database = { label: dbName, kind, host };
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    database,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}
