/**
 * Applique les migrations SQL écrites à la main (prisma/migrations/<dossier>/migration.sql)
 * contre la base ciblée par TURSO_DATABASE_URL (ou ./dev.db en local si absent),
 * en gardant un registre de ce qui a déjà été appliqué — remplace le
 * `turso db shell <db> < fichier` manuel, qui n'a aucune mémoire de ce qui a
 * déjà tourné et oblige à se souvenir soi-même de la liste.
 *
 * Prisma ne peut pas faire ça pour nous : Turso/libSQL n'est pas supporté par
 * `prisma migrate dev/deploy` (voir DEPLOYMENT.md), d'où ces migrations
 * hand-written et ce petit runner maison. Le registre est une table simple
 * (_AppSchemaMigrations) créée dans la base elle-même au premier lancement —
 * équivalent artisanal de `_prisma_migrations`.
 *
 * Usage :
 *   npm run migrate              → applique les migrations manquantes
 *   npm run migrate:check        → liste seulement ce qui manque, n'exécute rien
 *   npm run migrate -- --baseline → marque TOUT ce qui est actuellement en
 *                                    attente comme déjà appliqué, SANS rien
 *                                    exécuter (à faire une seule fois sur une
 *                                    base existante — prod/preprod ont déjà
 *                                    ces tables via `turso db shell` manuel
 *                                    avant que ce script existe). Ensuite,
 *                                    seules les VRAIES nouvelles migrations
 *                                    seront exécutées par `npm run migrate`.
 *
 *   npm run migrate -- --baseline --except-last=N → même chose, mais laisse
 *                                    les N migrations les PLUS RÉCENTES
 *                                    (triées par timestamp) réellement en
 *                                    attente au lieu de les marquer faites.
 *                                    Cas d'usage : la base a déjà toutes les
 *                                    tables d'avant ce script (via `turso db
 *                                    shell` manuel), sauf les N derniers
 *                                    modèles ajoutés APRÈS ce bootstrap —
 *                                    baseline le vieux, applique le nouveau
 *                                    pour de vrai en un seul run enchaîné.
 *
 * Idempotent et sûr à relancer : une migration déjà enregistrée dans
 * _AppSchemaMigrations est toujours sautée, jamais rejouée.
 */
// Doit être le tout premier import (voir même remarque dans create-admin.ts)
// — sans ça, TURSO_DATABASE_URL n'est jamais lu depuis .env et ce script
// applique silencieusement les migrations sur dev.db local au lieu de
// Turso, même si .env pointe bien vers Turso.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const TRACKING_TABLE = '_AppSchemaMigrations';

function listMigrationFolders(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(); // le préfixe timestamp garantit l'ordre chronologique
}

/**
 * Découpage naïf par `;` — suffisant ici : ces fichiers sont des
 * CREATE TABLE/INDEX simples écrits à la main, sans triggers ni chaînes
 * contenant elles-mêmes des points-virgules (voir les fichiers existants
 * pour le style attendu si tu en ajoutes un nouveau). Chaque instruction est
 * précédée d'une ligne de commentaire (`-- CreateTable`...) : on retire ces
 * lignes de commentaire EN TÊTE de chaque fragment (sqlite les accepte très
 * bien, mais un fragment qui ne garderait que le commentaire une fois vidé
 * de son SQL doit être exclu, pas le fragment entier — piège vérifié par un
 * test manuel : un filtre `startsWith('--')` sur le fragment complet
 * rejetait TOUTES les instructions, puisqu'elles commencent toutes par un
 * commentaire).
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((raw) => {
      const lines = raw.split('\n');
      while (lines.length > 0 && lines[0].trim().startsWith('--')) lines.shift();
      return lines.join('\n').trim();
    })
    .filter((s) => s.length > 0);
}

async function ensureTrackingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" TEXT NOT NULL
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "${TRACKING_TABLE}"`);
  return new Set(rows.map((r) => r.name));
}

function parseExceptLast(): number {
  const arg = process.argv.find((a) => a.startsWith('--except-last='));
  if (!arg) return 0;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const baseline = process.argv.includes('--baseline');
  const exceptLast = parseExceptLast();

  if (process.env.TURSO_DATABASE_URL) {
    console.log(`→ Base ciblée : Turso distant (${process.env.TURSO_DATABASE_URL})`);
    if (!process.env.TURSO_AUTH_TOKEN) {
      console.log('  ⚠ TURSO_AUTH_TOKEN absent — la connexion va probablement échouer.');
    }
  } else {
    console.log('→ Base ciblée : fichier local ./dev.db (TURSO_DATABASE_URL non défini dans ce terminal)');
  }
  console.log('');

  await ensureTrackingTable();
  const applied = await getAppliedMigrations();
  const allFolders = listMigrationFolders();
  const pending = allFolders.filter((name) => !applied.has(name));

  console.log(`${allFolders.length} migration(s) au total, ${applied.size} déjà appliquée(s), ${pending.length} en attente.\n`);

  if (pending.length === 0) {
    console.log('✓ Rien à faire — la base est à jour.');
    return;
  }

  // Avec --baseline --except-last=N, seules les N dernières (les plus
  // récentes) sont réellement exécutées ; le reste est juste marqué fait.
  const toBaseline = baseline && exceptLast > 0 ? pending.slice(0, Math.max(0, pending.length - exceptLast)) : baseline ? pending : [];
  const toApply = baseline ? pending.slice(pending.length - exceptLast) : pending;

  for (const name of toBaseline) console.log(`  • ${name} (à marquer comme déjà appliquée)`);
  for (const name of toApply) {
    console.log(checkOnly ? `  • ${name} (en attente)` : `→ ${baseline ? 'Sera réellement appliquée' : 'Application'} : ${name}`);
  }

  if (checkOnly) {
    console.log('\n(--check : rien exécuté. Relance `npm run migrate` pour appliquer.)');
    return;
  }

  if (toBaseline.length > 0) {
    console.log('\n--baseline : aucune requête SQL exécutée pour ces migrations, uniquement enregistrement dans le registre.\n');
    for (const name of toBaseline) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${TRACKING_TABLE}" ("name", "appliedAt") VALUES ('${name}', '${new Date().toISOString()}')`,
      );
      console.log(`  ✓ ${name} (baseline)`);
    }
  }

  if (baseline && toApply.length === 0) {
    console.log('\n✓ Registre initialisé. `npm run migrate` n\'appliquera désormais que les VRAIES nouvelles migrations.');
    return;
  }

  console.log('');
  for (const name of toApply) {
    const sqlPath = path.join(MIGRATIONS_DIR, name, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = splitStatements(sql);

    try {
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${TRACKING_TABLE}" ("name", "appliedAt") VALUES ('${name}', '${new Date().toISOString()}')`,
      );
      console.log(`  ✓ ${name}`);
    } catch (error) {
      console.error(`  ✗ ${name} a échoué — arrêt (les migrations suivantes ne sont pas jouées) :`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('\n✓ Toutes les migrations en attente ont été appliquées.');
}

main()
  .catch((error) => {
    console.error('Erreur :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
