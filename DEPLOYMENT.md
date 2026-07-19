# Déployer Wealth OS (Vercel + Turso)

Guide pour mettre l'app en ligne gratuitement : Vercel héberge le code Next.js, Turso héberge la base SQLite (le disque de Vercel est éphémère, un fichier `dev.db` classique ne survivrait pas aux déploiements).

## 0. Avant de commencer — nettoyage du dépôt git

Le fichier `dev.db` (base de données locale, avec de **vraies données financières**) est actuellement suivi par git, ce qui n'est pas voulu. Le `.gitignore` a été corrigé, mais il faut retirer le fichier du suivi et commit :

```bash
git rm --cached dev.db "dev.db-journal.bak" "prisma/dev.db"
git add .gitignore .env.example DEPLOYMENT.md
git commit -m "Retire dev.db du suivi git, prépare le déploiement (Turso + Vercel)"
git push
```

**Important** : si ce dépôt a déjà été poussé sur GitHub, `dev.db` reste visible dans l'historique des anciens commits même après ce nettoyage (un `git rm` n'efface pas l'historique). Deux options :

- Si le dépôt est **privé** et que tu es seul(e) à y avoir accès, c'est un risque faible — tu peux laisser l'historique tel quel.
- Si tu veux vraiment l'effacer de l'historique, il faut réécrire l'historique (`git filter-repo` ou BFG Repo-Cleaner) puis force-push — dis-le-moi si tu veux qu'on le fasse, c'est une opération plus délicate.

Bonne nouvelle : `.env` (les vraies clés API) n'a jamais été suivi par git, donc aucune clé n'est compromise.

## 1. Créer la base Turso

```bash
# Installer le CLI Turso
curl -sSfL https://get.tur.so/install.sh | bash

# Se connecter (ouvre le navigateur)
turso auth login

# Créer la base
turso db create wealthos-prod

# Récupérer l'URL et un token d'accès
turso db show wealthos-prod --url
turso db tokens create wealthos-prod
```

Note quelque part l'URL (`libsql://...`) et le token — ce sont `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`.

## 2. Appliquer les migrations sur Turso

Prisma Migrate n'est pas supporté directement contre Turso : on applique le SQL des migrations directement, comme en local. Un script est fourni :

```bash
chmod +x scripts/apply-turso-migrations.sh
./scripts/apply-turso-migrations.sh wealthos-prod
```

Ça applique les 13 migrations dans l'ordre (schéma complet : utilisateurs, comptes, transactions, objectifs, abonnements, admin...). Vérifie que ça s'est bien passé :

```bash
turso db shell wealthos-prod "SELECT name FROM sqlite_master WHERE type='table';"
```

Pour toute **future** modification de schéma, le workflow reste : écrire le `migration.sql` à la main (comme fait jusqu'ici), l'appliquer en local (script Python existant) **et** sur Turso (`turso db shell wealthos-prod < prisma/migrations/<nom>/migration.sql`).

## 3. Installer les nouvelles dépendances en local

Le projet est passé de `better-sqlite3` à `@libsql/client` (compatible Turso ET fichier local, contrairement à better-sqlite3 qui ne marche pas sur Vercel) :

```bash
npm install
npx prisma generate
```

## 4. Créer le premier compte admin sur la base de prod

Le script `scripts/create-admin.ts` se connecte à la base pointée par `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` s'ils sont définis, sinon au fichier local. Pour créer ton admin directement sur Turso :

```bash
TURSO_DATABASE_URL="libsql://wealthos-prod-xxx.turso.io" \
TURSO_AUTH_TOKEN="ton-token" \
npm run create-admin
```

## 5. Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com), connecte-toi avec GitHub, clique "Add New → Project" et importe `oussama166/saving-app`.
2. Vercel détecte Next.js automatiquement — laisse les réglages par défaut (`npm run build` inclut déjà `prisma generate`).
3. Avant de déployer, ajoute les variables d'environnement (Project Settings → Environment Variables), pour **Production** et **Preview** :

| Variable                       | Valeur                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`           | l'URL récupérée à l'étape 1                                                        |
| `TURSO_AUTH_TOKEN`             | le token récupéré à l'étape 1                                                      |
| `AUTH_SECRET`                  | génère avec `openssl rand -base64 32` (distinct de ADMIN_AUTH_SECRET)              |
| `ADMIN_AUTH_SECRET`            | génère avec `openssl rand -base64 32` (distinct de AUTH_SECRET)                    |
| `RESEND_API_KEY`               | ta clé Resend existante                                                            |
| `EMAIL_FROM`                   | optionnel, sinon `onboarding@resend.dev`                                           |
| `NEXT_PUBLIC_SITE_URL`         | mets l'URL Vercel une fois connue (`https://ton-projet.vercel.app`), puis redeploy |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ta clé existante                                                                   |
| `OPENROUTER_API_KEY`           | ta clé existante                                                                   |
| `GEOAPIFY_API_KEY`             | ta clé existante                                                                   |
| `BACKUP_SECRET`                | ta valeur existante                                                                |
| `BACKUP_ARCHIVE_MONTHS`        | `3`                                                                                |
| `GOOGLE_SHEETS_CLIENT_EMAIL`   | ta valeur existante                                                                |
| `GOOGLE_SHEETS_PRIVATE_KEY`    | ta valeur existante (garde les `\n` échappés)                                      |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ta valeur existante                                                                |

**Ne réutilise pas les mêmes valeurs `AUTH_SECRET`/`ADMIN_AUTH_SECRET` que celles de ton `.env` local** si celui-ci a jamais été partagé — génère des valeurs fraîches pour la prod.

4. Clique "Deploy". Le premier build prend 1-2 minutes.

## 6. Après le premier déploiement

- Mets à jour `NEXT_PUBLIC_SITE_URL` avec l'URL réelle (`https://ton-projet.vercel.app` ou ton domaine perso si tu en connectes un dans Vercel → Domains), puis redeploy (Vercel → Deployments → ⋯ → Redeploy) pour que les liens dans les emails soient corrects.
- Teste : inscription, connexion, `/admin/login` avec le compte admin créé à l'étape 4.
- Si tu utilises le Shortcut iOS (webhook Apple Pay), remplace l'URL ngrok par l'URL de prod dans le Shortcut.

## 7. Cron externe pour l'archivage (`/api/backup/archive`)

Cette route attend un header `x-backup-secret` et n'est pas protégée par la session — pensée pour être appelée par un cron externe (pas de cron serveur fiable sur le plan gratuit Vercel). Exemple avec [cron-job.org](https://cron-job.org) (gratuit) :

- URL : `https://ton-projet.vercel.app/api/backup/archive`
- Méthode : `POST`
- Header : `x-backup-secret: <ta valeur BACKUP_SECRET>`
- Fréquence : par exemple 1×/mois

## Limites du plan gratuit à garder en tête

- **Vercel Hobby** : usage non-commercial, fonctions serverless avec timeout (10s par défaut, gérable pour cette app), pas de cron interne fiable garanti (d'où le cron externe ci-dessus).
- **Turso free** : 5 Go de stockage, 500M lectures/mois, 10M écritures/mois — largement suffisant pour un usage personnel/entre amis.
- **Resend free** : 3000 emails/mois.

Aucune limite bloquante pour l'usage prévu (toi + tes amis).
