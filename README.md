# WealthOS (Wealth OS)

Application personnelle de gestion de patrimoine — comptes multi-devises, budget, portefeuille (actions/crypto/OPCVM), objectifs d'épargne, dettes, santé, zakat, abonnements récurrents, et un Coach IA basé. Pensée à l'origine pour un usage personnel/foyer, avec un vrai système multi-utilisateurs (foyer partagé à 2), un panel admin, et une architecture prête pour un déploiement gratuit (Vercel + Turso).

Langue de l'interface : français, anglais, espagnol, arabe (`fr`/`en`/`es`/`ar`, LTR pour les 4).

## Sommaire

- [Stack technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage local](#démarrage-local)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données & migrations](#base-de-données--migrations)
- [Déploiement (prod / preprod)](#déploiement-prod--preprod)
- [Scripts](#scripts)
- [Structure du dépôt](#structure-du-dépôt)
- [Concepts clés de l'architecture](#concepts-clés-de-larchitecture)
- [Tâches planifiées](#tâches-planifiées)
- [Sécurité](#sécurité)

## Stack technique

| Domaine         | Choix                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack), React 19                                                                                              |
| Langage         | TypeScript                                                                                                                                |
| Base de données | SQLite — fichier local (`dev.db`) en dev, [Turso](https://turso.tech) (libSQL hébergé) en prod/preprod                                    |
| ORM             | Prisma 7 + `@prisma/adapter-libsql` (un seul code path local/hébergé)                                                                     |
| Style           | Tailwind CSS 4, thème clair/sombre piloté par une classe `.dark`, design tokens sémantiques (`bg-surface`, `text-body`, `border-line`...) |
| IA              | Vercel AI SDK (`ai`, `@ai-sdk/react`) + Google Gemini (`@ai-sdk/google`)                                                                  |
| Auth            | Sessions cookie signées (JWT via `jose`), mots de passe `bcryptjs`, 2FA TOTP (`otplib`)                                                   |
| Email           | [Resend](https://resend.com)                                                                                                              |
| Autres          | `recharts` (graphiques), `exceljs`/`pdfkit` (exports), `yahoo-finance2` (cours bourse/crypto), `googleapis` (export Google Sheets)        |

## Fonctionnalités

**Finances du quotidien**

- Saisie manuelle, import CSV (mapping de colonnes par banque), scan de reçu par OCR, historique filtrable/éditable.
- Comptes multi-devises avec conversion automatique en MAD (taux mis en cache, `lib/exchangeRates.ts`).
- Virements entre comptes, y compris récurrents (règles automatiques + cron).
- 8 méthodologies de budget au choix (50/30/20, 70/20/10, base zéro, enveloppes, se payer en premier, règle des 60 %, Kakeibo, personnalisé) — voir `lib/budgetMethods.ts`.
- Cycle budgétaire calé sur le jour de paie plutôt que le 1ᵉʳ du mois (optionnel).

**Patrimoine**

- Portefeuille (actions, crypto, OPCVM) avec cours en direct (`yahoo-finance2`) et calcul de plus/moins-value, conversion multi-devises.
- Objectifs d'épargne avec contributions et allocation automatique.
- Suivi de dettes/prêts et de leurs remboursements.
- Zakat (calcul sur le patrimoine).

**Santé & abonnements**

- Budget santé, remboursements CNSS/mutuelle, dossiers médicaux.
- Abonnements récurrents (détection, historique de changement de plan, stats admin).

**Coach IA**

- Diagnostic mensuel personnalisé (basé sur la méthode budgétaire réellement choisie par l'utilisateur), conseils Tanger (banques/bourse marocaine), analyse de tendances, prévention santé, stratégie fonds d'urgence — réponses **streamées** (`streamObject`), mises en cache 7 jours avec invalidation automatique si les données changent, bouton "régénérer" manuel.
- Règles d'or et benchmarks Maroc : contenu de référence fixe, explicitement distingué du contenu généré par IA.
- Chat flottant (agent financier) : voit tous les comptes du foyer, répond en MAD, historique persistant en base, disponible sur toutes les pages authentifiées.

**Foyer partagé**

- Jusqu'à 2 comptes liés (couple/famille) : visibilité élargie sur les données financières, un seul jeu de catégories/budget pour le foyer (`lib/household.ts`).

**Sécurité & comptes**

- 2FA (TOTP + codes de récupération), politique de mot de passe, vérification d'email, réinitialisation de mot de passe.
- Panel admin séparé (auth distincte) : utilisateurs, abonnements, feature flags, journal d'audit.
- Feature flags par section (et par sous-section) activables/désactivables globalement ou par utilisateur (`lib/features.ts`, `/admin/features`).

**Intégrations & automatisations**

- Webhooks entrants (Apple Pay via Shortcut iOS, salaire, paiement d'abonnement, import/synchro d'abonnements), chacun protégé par un token dédié.
- Digest hebdomadaire par email, archivage planifié, export Google Sheets, export PDF de bilan.
- Bandeau de développement (dev only) affichant la base de données réellement connectée (local/preprod/prod) — évite de confondre les environnements.

## Démarrage local

Prérequis : Node.js 20+, npm.

```bash
git clone <url-du-dépôt>
cd saving
npm install
cp .env.example .env
# remplis au moins AUTH_SECRET, ADMIN_AUTH_SECRET, RESEND_API_KEY,
# GOOGLE_GENERATIVE_AI_API_KEY (voir la section suivante)
npx prisma generate
npm run dev
```

Sans `TURSO_DATABASE_URL` dans `.env`, l'app utilise automatiquement un fichier SQLite local `dev.db` (créé au premier lancement/migration) — aucune base distante nécessaire pour développer.

Créer le premier compte admin (accès `/admin/login`) :

```bash
npm run create-admin
```

## Variables d'environnement

Voir `.env.example` pour le détail commenté. Résumé :

| Variable                                                                                    | Obligatoire          | Rôle                                                                      |
| ------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`                                                   | Non en local         | Base Turso distante (prod/preprod) — absent = fichier `dev.db` local      |
| `AUTH_SECRET`                                                                               | Oui                  | Signature des sessions utilisateur (JWT)                                  |
| `ADMIN_AUTH_SECRET`                                                                         | Oui                  | Signature des sessions admin — **distinct** de `AUTH_SECRET`              |
| `RESEND_API_KEY`                                                                            | Oui                  | Envoi d'emails transactionnels                                            |
| `EMAIL_FROM`                                                                                | Non                  | Expéditeur des emails (défaut : `onboarding@resend.dev`)                  |
| `NEXT_PUBLIC_SITE_URL`                                                                      | Oui                  | URL publique de l'app (liens dans les emails)                             |
| `GOOGLE_GENERATIVE_AI_API_KEY`                                                              | Oui pour le Coach IA | Clé Gemini (modèle utilisé par `lib/aiProvider.ts`)                       |
| `OPENROUTER_API_KEY`                                                                        | Non                  | Présent dans l'env mais non branché actuellement (voir note ci-dessous)   |
| `GEOAPIFY_API_KEY`                                                                          | Non                  | Suggestion de catégorie par géolocalisation                               |
| `CRON_SECRET`                                                                               | Non                  | Cron quotidien natif Vercel (`/api/cron/daily`, voir `vercel.json`)       |
| `BACKUP_SECRET` / `BACKUP_ARCHIVE_MONTHS`                                                   | Non                  | Archivage planifié (déclenchement manuel ou cron externe)                |
| `WEEKLY_DIGEST_SECRET`                                                                      | Non                  | Digest hebdomadaire par email (redéclenchement manuel ponctuel)          |
| `RECURRING_TRANSFERS_SECRET`                                                                | Non                  | Exécution des virements récurrents (redéclenchement manuel ponctuel)     |
| `SUBSCRIPTION_REMINDERS_SECRET`                                                             | Non                  | Rappel email 2-5j avant prélèvement d'abonnement (redéclenchement manuel ponctuel) |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` / `GOOGLE_SHEETS_SPREADSHEET_ID` | Non                  | Export Google Sheets                                                      |
| `SENTRY_DSN`                                                                                | Non                  | Monitoring d'erreurs (`lib/errorMonitoring.ts`) — sans clé, erreurs seulement en console |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | Non                  | Notifications push (`lib/webPush.ts`) — sans clés, bouton caché dans Profil |

> Note : `lib/aiProvider.ts` utilise uniquement Gemini (`coachModel`) pour toutes les fonctionnalités IA (Coach IA + chat flottant). `OPENROUTER_API_KEY` figure dans `.env.example` mais n'est pas câblée dans le code actuel.

## Base de données & migrations

Le schéma vit dans `prisma/schema.prisma`, les migrations dans `prisma/migrations/*/migration.sql` (SQL écrit à la main, pas de `prisma migrate dev` généré automatiquement — Turso ne supporte pas le workflow Prisma Migrate standard).

**En local** : `npx prisma migrate deploy` (ou laisser Next.js régénérer le client via `npm run dev`/`npm run build`, qui inclut `prisma generate`).

**Sur Turso** (preprod ou prod) : via `scripts/run-migrations.ts` (voir [`DEPLOYMENT.md`](./DEPLOYMENT.md) pour le détail), qui applique le SQL brut ET suit dans une table `_AppSchemaMigrations` ce qui a déjà été appliqué (idempotent, ré-exécutable sans risque) :

```bash
# Voir ce qui reste à appliquer, sans rien exécuter
npm run migrate:check

# Applique toutes les migrations pas encore marquées comme faites
npm run migrate
```

Workflow pour toute évolution de schéma : modifier `prisma/schema.prisma`, écrire à la main le `migration.sql` correspondant (nom `AAAAMMJJHHMMSS_description`), l'appliquer en local, puis sur chaque base Turso concernée (preprod avant tout, prod avant/au déploiement) via `npm run migrate`.

## Déploiement (prod / preprod)

Le guide complet est dans [`DEPLOYMENT.md`](./DEPLOYMENT.md) (création de la base Turso, variables Vercel, cron externes, limites du plan gratuit). Résumé de l'architecture :

- **Prod** : Vercel (build = `prisma generate && next build`) + base Turso `wealthos-prod`. Les variables d'environnement Vercel sont gérées indépendamment du `.env` local.
- **Preprod** : base Turso séparée (ex. `wealthos-preprod`) utilisée en pointant `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` du `.env` local dessus — permet de développer/tester contre une base distante réaliste sans jamais toucher aux données de prod.
- **Local** : sans ces deux variables, fichier `dev.db` isolé, aucun risque de toucher une base distante par erreur. Le bandeau de développement (coin haut-droit, dev only) affiche en permanence quelle base est réellement connectée.

## Scripts

| Commande                                   | Effet                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run dev`                              | Serveur de dev (port 3000)                                                                      |
| `npm run dev1`                             | Serveur de dev sur le port 3001 (deuxième instance, ex. pour tester en parallèle)               |
| `npm run build`                            | `prisma generate` + build de production                                                         |
| `npm run start`                            | Lance le build de production                                                                    |
| `npm run lint`                             | ESLint                                                                                          |
| `npm run create-admin`                     | Crée un compte admin (base pointée par `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, sinon `dev.db`) |
| `npm run migrate`                          | Applique les migrations en attente (locale ou Turso selon l'env) et les marque comme faites     |
| `npm run migrate:check`                    | Liste les migrations en attente sans rien exécuter                                              |
| `npm run test-push -- <email>`             | Envoie une notification push de test à un utilisateur (debug)                                   |
| `npm run test-sheets`                      | Vérifie la connexion Google Sheets (compte de service, accès au spreadsheet)                    |

## Structure du dépôt

```
app/
  api/                  Routes API (Next.js Route Handlers), une par domaine métier
    admin/              Endpoints du panel admin (auth séparée)
    auth/                Inscription, connexion, 2FA, reset password, vérif email
    chat/                Chat flottant + historique persistant
    coach/               5 routes Coach IA (diagnostic, conseils Tanger, tendances, santé, fonds d'urgence)
    cron/                Endpoints déclenchés par un cron externe (digest, virements récurrents, rappels abonnements)
    webhook/             Entrées externes (Apple Pay, salaire, abonnements)
    ...
  admin/                 Pages du panel admin
  components/            Composants partagés (cartes, formulaires, nav, providers...)
  hooks/                 Hooks React partagés (ex. useCoachAdvice)
  <page>/page.tsx         Une page par domaine (dashboard = app/page.tsx, saisie, portfolio, objectifs, analyse, sante, zakat, abonnements, dettes, profil, coach)
lib/                      Logique métier et utilitaires côté serveur (pas de composants React)
prisma/
  schema.prisma           Schéma de données complet
  migrations/              Migrations SQL, une par évolution de schéma
scripts/                  Scripts opérationnels (admin, migrations Turso)
DEPLOYMENT.md              Guide de déploiement détaillé (Vercel + Turso)
```

## Concepts clés de l'architecture

**Scoping foyer (`lib/household.ts`)** — Deux notions distinctes utilisées dans presque tout le code serveur :

- `memberIds` : élargit la _lecture_ (et les cibles de modification/suppression) à tous les membres du foyer pour tout ce qui reste attribué à qui l'a créé (comptes, transactions, objectifs, abonnements, dettes...).
- `budgetOwnerId` : propriétaire canonique du budget (`Category`, `UserSettings`) — un seul jeu de catégories/pourcentages pour tout le foyer plutôt que deux configurations concurrentes.

Sans foyer (cas par défaut), les deux valeurs retombent sur l'utilisateur lui-même.

**Convention de signe des transactions** — `Transaction.amount` est toujours signé (négatif = dépense, positif = revenu/épargne), et ce signe est **systématiquement dérivé côté serveur** de `category.type`, jamais fait confiance à une valeur envoyée par le client. `category.type` peut valoir `income` / `expense` / `savings` / `transfer` — le type `transfer` (virements entre comptes) est exclu de tous les agrégats revenus/dépenses pour ne pas les fausser.

**Feature flags (`lib/features.ts`)** — Chaque page/section a une clé stable dans `FEATURE_REGISTRY`, activable/désactivable globalement (ou par utilisateur via `FeatureAccessGrant`) depuis `/admin/features`. Les entrées avec `parentKey` sont des sous-fonctionnalités (un bloc précis dans une page qui reste par ailleurs accessible) plutôt que des pages entières.

**Cycle budgétaire hybride (`lib/budgetCycle.ts`)** — Par défaut calé sur le mois calendaire ; si `UserSettings.budgetCycleStartDay` est configuré, cherche la vraie transaction de salaire dans une fenêtre de tolérance de 7 jours autour du jour de paie plutôt que d'imposer une date fixe.

**Multi-devises (`lib/exchangeRates.ts`)** — Chaque compte a sa devise ; toute agrégation multi-comptes convertit d'abord en MAD via des taux mis en cache (`ExchangeRateCache`). Les appels réseau de conversion ne se font jamais à l'intérieur d'une transaction Prisma interactive.

**Coach IA (`lib/coachHandler.ts`, `lib/coachSchemas.ts`)** — Helper partagé par les 5 routes `/api/coach/*` : vérifie un cache (`AiAdviceCache`, TTL 7 jours, clé incluant un hash des données d'entrée pour une invalidation automatique), sinon appelle `streamObject` (Gemini) et streame la réponse au client via `experimental_useObject` (`@ai-sdk/react`).

**Base de données (`lib/prisma.ts`)** — Un seul adaptateur (`@prisma/adapter-libsql`) pour les deux environnements : fichier local si `TURSO_DATABASE_URL` est absent, base Turso distante sinon. Pas de branche de code séparée entre dev et prod.

**i18n (`lib/i18n.ts`)** — Dictionnaires plats par clé (`t(locale, key, fallback?)` côté serveur, `useLanguage()` côté client), 4 locales tenues à parité stricte (même nombre de clés). Mise en page LTR pour les 4, y compris l'arabe.

## Tâches planifiées

**Cron principal (`vercel.json`, natif Vercel)** — `GET /api/cron/daily`, déclenché automatiquement par Vercel tous les jours à 8h UTC (voir `vercel.json`). Regroupe en une seule route les 3 tâches quotidiennes/hebdo (rappels d'abonnements + virements récurrents tous les jours, digest hebdomadaire uniquement le lundi) : le plan Hobby de Vercel limite à 2 cron jobs par projet, donc tout tient dans un seul. Authentifié via `Authorization: Bearer <CRON_SECRET>`, ajouté automatiquement par Vercel — et Vercel contourne nativement sa propre Deployment Protection pour ses appels cron, donc aucun service externe ni bypass token nécessaire.

**Routes individuelles (redéclenchement manuel ponctuel)** — restent utilisables séparément (ex. pour rejouer une tâche précise sans attendre le prochain passage du cron quotidien), chacune protégée par son propre header secret :

| Route                                   | Header                         |
| --------------------------------------- | ------------------------------- |
| `POST /api/cron/weekly-digest`          | `x-cron-secret`                |
| `POST /api/cron/recurring-transfers`    | `x-recurring-transfers-secret` |
| `POST /api/cron/subscription-reminders` | `x-cron-secret`                |

**Archivage (`POST /api/backup/archive`)** — volontairement **hors** du cron automatique (opération destructrice : supprime des transactions de la base après archivage Google Sheets). Déclenchement manuel via `x-backup-secret`, ou via un cron externe (ex. [cron-job.org](https://cron-job.org)) mensuel si tu veux l'automatiser en connaissance de cause.

## Sécurité

- Auth utilisateur et auth admin totalement séparées : tables, secrets de session (`AUTH_SECRET` vs `ADMIN_AUTH_SECRET`), cookies et routes distinctes — un email identique côté `User` et côté `Admin` n'entraîne aucun conflit.
- 2FA TOTP optionnel avec codes de récupération hashés (jamais stockés en clair après leur affichage unique).
- Chaque webhook entrant (Apple Pay, salaire, abonnements) est protégé par un token dédié, distinct du cookie de session.
- `dev.db` (données financières réelles en local) est exclu du suivi git — voir `.gitignore`.
