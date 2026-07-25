/**
 * Bootstrap du tout premier compte admin (voir lib/adminAuth.ts). Les admins
 * suivants peuvent être créés depuis le panel lui-même une fois connecté
 * (/admin/admins), mais il faut au moins un premier compte pour s'y
 * connecter — d'où ce script, à exécuter en local avec accès à ./dev.db.
 * Reste aussi utile pour réinitialiser le mot de passe d'un admin qui l'a
 * perdu, sans passer par le panel.
 *
 * Usage :
 *   npm run create-admin
 *   npm run create-admin -- --email=admin@example.com --name="Oussama"
 *
 * Le mot de passe est toujours demandé en interactif (jamais en argument
 * CLI, pour éviter qu'il finisse dans l'historique du shell).
 */
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { validatePasswordStrength } from '../lib/passwordPolicy';

function parseArgs() {
  const args: Record<string, string> = {};
  for (const raw of process.argv.slice(2)) {
    const match = raw.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}

// Lecture d'un mot de passe masqué (affiche "*" au lieu des caractères tapés)
// sans dépendance externe — manipule stdin en mode raw le temps de la saisie.
function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.resume();
    stdin.setRawMode?.(true);
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char: string) => {
      const code = char.charCodeAt(0);
      if (char === '\n' || char === '\r' || code === 4) {
        stdin.setRawMode?.(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (code === 3) {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      }
      if (code === 127 || code === 8) {
        // Backspace
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      value += char;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = parseArgs();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== Création / réinitialisation d\'un compte admin Wealth OS ===\n');

  // Diagnostic explicite de la base ciblée : la cause la plus fréquente d'un
  // admin "créé sur la mauvaise base" n'est pas un bug du script (il lit
  // bien process.env.TURSO_DATABASE_URL au démarrage, voir lib/prisma.ts) —
  // c'est que la variable n'est en réalité pas présente dans CE process (ex:
  // `export` fait dans un autre onglet de terminal, ou `npm run create-admin`
  // relancé sans le préfixe la fois d'après). Ce log rend l'erreur visible
  // immédiatement au lieu de la découvrir après coup dans la base.
  if (process.env.TURSO_DATABASE_URL) {
    console.log(`→ Base ciblée : Turso distant (${process.env.TURSO_DATABASE_URL})`);
    if (!process.env.TURSO_AUTH_TOKEN) {
      console.log('  ⚠ TURSO_AUTH_TOKEN absent — la connexion va probablement échouer.');
    }
  } else {
    console.log('→ Base ciblée : fichier local ./dev.db (TURSO_DATABASE_URL non défini dans ce terminal)');
  }
  console.log('');

  let email = args.email?.trim().toLowerCase();
  if (!email) {
    email = (await question(rl, 'Email admin : ')).toLowerCase();
  }
  if (!EMAIL_REGEX.test(email)) {
    console.error('Adresse email invalide.');
    rl.close();
    process.exit(1);
  }

  let name = args.name;
  if (name === undefined) {
    name = await question(rl, 'Nom (optionnel) : ');
  }

  rl.close(); // on repasse en lecture brute pour le mot de passe

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`\nUn compte admin existe déjà pour ${email} (créé le ${existing.createdAt.toLocaleDateString('fr-FR')}).`);
    const confirmRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await question(confirmRl, 'Réinitialiser son mot de passe ? (o/N) : ');
    confirmRl.close();
    if (answer.toLowerCase() !== 'o' && answer.toLowerCase() !== 'oui') {
      console.log('Annulé.');
      process.exit(0);
    }
  }

  let password = '';
  for (;;) {
    password = await questionHidden('Mot de passe (min. 12 car., maj/min/chiffre/spécial) : ');
    const error = validatePasswordStrength(password);
    if (error) {
      console.log(`✗ ${error}\n`);
      continue;
    }
    const confirm = await questionHidden('Confirmer le mot de passe : ');
    if (confirm !== password) {
      console.log('✗ Les deux mots de passe ne correspondent pas.\n');
      continue;
    }
    break;
  }

  const passwordHash = await bcrypt.hash(password, 12); // 12 rounds — compte à privilèges élevés, on accepte le coût CPU supplémentaire

  const admin = existing
    ? await prisma.admin.update({ where: { email }, data: { passwordHash, name: name || existing.name } })
    : await prisma.admin.create({ data: { email, passwordHash, name: name || null } });

  console.log(`\n✓ Compte admin ${existing ? 'mis à jour' : 'créé'} : ${admin.email} (id: ${admin.id})`);
  console.log('\nRappel : /admin nécessite ADMIN_AUTH_SECRET dans .env (distinct de AUTH_SECRET).');
}

main()
  .catch((error) => {
    console.error('Erreur :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
