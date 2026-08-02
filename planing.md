# Plan technique — Amener localhost:3000 au niveau de BudgetMaster (prod)

Basé sur l'inspection du code réel dans `/Users/mac/Devs/saving` (Next.js 16 App Router, TypeScript, Tailwind v4, Prisma + SQLite/better-sqlite3, Recharts, Vercel AI SDK/Gemini pour le `FinanceAgent`).

Le projet a déjà une bonne fondation technique (SSE temps réel, agent IA, moteur de trade, webhooks Apple Pay/Salaire) — ce que le site 1 n'a pas. Le travail restant est surtout : brancher les pages manquantes, enrichir le schéma Prisma, et remplacer les données statiques/mockées par des données réelles.

## Phase 0 — Schéma de données (bloque tout le reste)

Fichier : `prisma/schema.prisma`

1. **Catégories & sous-catégories.** Aujourd'hui `Category` n'a pas de sous-catégories structurées et une seule catégorie ("Uncategorized") existe en base. Ajouter :

   ```prisma
   model Category {
     id            String        @id @default(cuid())
     name          String
     type          String        // income, expense, savings
     order         Int           @default(0)
     budgetPct     Float         @default(0)   // % du revenu de référence (page Profil)
     subCategories SubCategory[]
     transactions  Transaction[]
     createdAt     DateTime      @default(now())
     updatedAt     DateTime      @updatedAt
   }

   model SubCategory {
     id         String   @id @default(cuid())
     name       String
     categoryId String
     category   Category @relation(fields: [categoryId], references: [id])
   }
   ```

   `Transaction.subCategory` reste un `String` libre (pas de FK) pour éviter une migration lourde — le formulaire de saisie proposera juste les `SubCategory.name` de la catégorie sélectionnée comme options.

2. **Paramètres utilisateur** (revenu de référence, devise, cible fonds d'urgence — nécessaire pour Dashboard + Profil) :

   ```prisma
   model UserSettings {
     id                        String   @id @default("singleton")
     referenceIncome           Float    @default(10000)
     currency                  String   @default("MAD")
     emergencyFundTargetMonths Float    @default(3)
     updatedAt                 DateTime @updatedAt
   }
   ```

3. **PortfolioAsset** : ajouter le type d'actif et un prix manuel (les tickers marocains — actions MASI, OPCVM, or au gramme — ne sont pas sur Yahoo Finance) :

   ```prisma
   model PortfolioAsset {
     ...
     assetType    String  @default("Action") // Action, ETF, Crypto, OPCVM, Or
     manualPrice  Float?  // utilisé si pas de cotation live disponible
   }
   ```

4. **SavingsGoal** (déjà présent, sert de base à Objectifs) : ajouter `monthlyContribution Float @default(0)` et `emoji String?` pour matcher l'affichage du site 1 (🛡️, ✈️, 🚗…).

5. **MedicalRecord** (nouveau, pour la page Santé) :

   ```prisma
   model MedicalRecord {
     id                  String    @id @default(cuid())
     transactionId       String?   @unique
     transaction         Transaction? @relation(fields: [transactionId], references: [id])
     provider            String
     amount               Float
     reimbursementStatus String    @default("PENDING") // PENDING, SUBMITTED, REIMBURSED
     date                 DateTime
     createdAt            DateTime @default(now())
   }
   ```

6. **Migration + seed** : créer `prisma/seed.ts` avec :
   - Les 13 catégories du site 1 et leurs `budgetPct` (Logement 30%, Alimentation 12%, Transport 6%, Santé 4%, Éducation 4%, Loisirs 6%, Shopping 3%, Tech 2%, Famille 3%, Épargne Sécurité 5%, Épargne Projets 5%, Investissements 12%, Divers 8%).
   - Les sous-catégories connues (ex. Logement & Charges → Loyer, Eau & Électricité, Gaz, Internet & Téléphone, Syndic/Charges, Entretien Logement — et au minimum 2-3 sous-catégories par catégorie pour les autres, à affiner avec l'utilisateur).
   - La ligne `UserSettings` singleton (revenu 10 000 DH par défaut).
   - Ajouter **Chèque, CIH Pay/Mobile, PayPal** à la liste des méthodes de paiement (actuellement codée en dur dans `TransactionForm.tsx` avec Apple Pay/BMCE DIRECT) — fusionner les deux listes plutôt que remplacer, puisque des transactions réelles utilisent déjà Apple Pay.

   Respecter la règle du `AGENTS.md` du projet : ne pas ajouter de champs au schéma sans confirmation — valider ce diff avec toi avant de lancer `prisma migrate dev`.

## Phase 1 — Corriger les bugs existants du Dashboard / Saisie

- <input type="checkbox">`app/page.tsx` : le solde global est formaté en **EUR** (`Intl.NumberFormat('fr-FR', {currency:'EUR'})`) alors que tout le reste de l'app est en DH/MAD. Uniformiser en MAD partout (idem dans `app/api/chat/route.ts` où le prompt IA mentionne encore "EUR").</input>
- <input type="checkbox">`app/api/dashboard/route.ts` :</input>
  - Remplacer les objets codés en dur `BUDGET_TARGETS` et `CATEGORY_GROUPS` (qui ne connaissent que Housing/Food/Transport/Entertainment/Shopping/Uncategorized) par un calcul basé sur `Category.budgetPct * UserSettings.referenceIncome`, une fois les 13 catégories seedées.
  - `portfolioValue: 12500` est un mock en dur → calculer depuis `PortfolioAsset` (réutiliser la logique de `app/api/portfolio/live/route.ts`).
  - `emergencyFundMonths` utilise `avgMonthlyExpenses = 2000` en dur → calculer une moyenne glissante sur les dépenses réelles des 3 derniers mois.
- <input type="checkbox">`app/components/EmergencyFundCard.tsx` : le texte "couvre environ 3.5 mois" est un texte statique, pas une valeur calculée → le passer en prop dynamique.</input>
- <input type="checkbox">`app/components/AssetAllocation.tsx` : le camembert "Répartition du Patrimoine" utilise un tableau `DATA` codé en dur (30/20/10/40%) → calculer la vraie répartition à partir des comptes/actifs réels.</input>
- <input type="checkbox">`app/portfolio/page.tsx` : `DUMMY_ACCOUNTS` est une liste statique → remplacer par une requête réelle sur `Account`.</input>

## Phase 2 — Saisie & Histo (compléter l'existant)

- `app/components/TransactionForm.tsx` : rendre le champ "Sous-catégorie" dépendant de la catégorie sélectionnée (dropdown au lieu de texte libre), alimenté par `SubCategory` via une nouvelle route `GET /api/categories` (catégories + sous-catégories).
- Ajouter la route `DELETE /api/transactions/[id]` (avec décrément du solde du compte associé, comme le fait déjà la création).
- `app/components/HistoryTable.tsx` : ajouter un bouton "Supprimer" par ligne (présent sur le site 1, absent ici), avec confirmation.
- Nettoyer manuellement les transactions de test visibles en base ("Test1", "Data tests", "Tacos Magic") — à faire à la main pour éviter de supprimer de vraies données par erreur.

## Phase 3 — Page Profil (nouvelle, `/app/profil`)

Nécessaire en premier car le Dashboard et Saisie dépendent conceptuellement des allocations définies ici.

- `GET/PUT /api/settings` : lire/écrire `UserSettings.referenceIncome` et les `Category.budgetPct` (avec contrôle "somme = 100%" côté API et UI, comme le site 1).
- Composant `AllocationEditor` : sliders + inputs numériques par catégorie, total en temps réel.
- Composant `BudgetOptimizer` ("Optimisateur de budget réel") : requête agrégée des dépenses réelles par catégorie sur une période (mois courant / historique global), comparaison cible vs réel, détection des dépassements récurrents / sous-dépenses, bouton "Adapter" qui recopie les % réels dans `Category.budgetPct`.

## Phase 4 — Portfolio & Épargne complet + lien menu

- `app/components/TopNav.tsx` : remplacer `href: '#'` par `href: '/portfolio'` (la page existe déjà mais n'est pas reliée).
- Refondre `app/portfolio/page.tsx` en 2 sous-onglets comme le site 1 :
  - **Fonds d'Urgence** : brancher `EmergencyFundCard` sur `UserSettings.emergencyFundTargetMonths` + solde réel du compte "Épargne Sécurité", ajouter le bloc stratégie/placements recommandés (contenu statique, simple à porter).
  - **Portfolio** : tableau des actifs réels (nom, type, quantité, prix d'achat, prix actuel, valeur, rendement, actions modifier/supprimer) branché sur `GET /api/portfolio/live` (déjà existant, à étendre pour utiliser `manualPrice` en fallback quand `yahoo-finance2` ne trouve pas de cotation — cas des OPCVM et actions MASI).
  - Nouvelle route `POST /api/portfolio/asset` : upsert simple (nom, type, quantité, prix achat, prix actuel) — plus proche du formulaire "Ajouter ou mettre à jour un actif" du site 1 que le moteur `trade` existant (`app/api/portfolio/trade/route.ts`), qui reste utile pour un futur flux Achat/Vente mais n'est pas ce que l'UI actuelle du site 1 propose.
  - Supprimer/remplacer la section "Comptes Connectés" (données 100% mockées) par les vrais `Account` de la base, ou la garder en la branchant sur les soldes réels.

## Phase 5 — Page Objectifs (nouvelle, `/app/objectifs`)

- Routes `GET/POST/PUT/DELETE /api/goals` sur le modèle `SavingsGoal` (déjà en base, jamais exposé côté UI).
- Composant `GoalsTable` : cible, épargné, contribution/mois, % progression, mois restants (calculé), statut coloré (🟢/🟠/🔴 selon seuils de progression).
- Réutiliser `app/components/InterestSimulator.tsx` en l'enrichissant avec les "scénarios de référence" du site 1 (Conservateur/Modéré/Optimiste/Agressif à différents horizons) — soit en paramétrant le composant existant, soit en dupliquant en `CompoundInterestScenarios`.
- Bloc statique "Conseils financiers" (banques/épargne, investissement Maroc/international, erreurs fatales) — contenu texte, pas de backend nécessaire.

## Phase 6 — Page Analyse & Trends (nouvelle, `/app/analyse`)

- Nouvelle route `GET /api/analytics/monthly` : agrège `Transaction` par mois sur les 6 derniers mois (revenu total, dépensé, épargne/invest, % épargné, top catégorie, variation vs mois précédent). Calculable à la volée depuis `Transaction`, pas besoin d'un modèle de snapshot dédié pour l'instant.
- Composant `MonthlyHistoryTable` + graphique Recharts comparatif dépenses vs épargne.
- Composant `FinancialRatios` : ratio charges fixes, ratio épargne/investissement, reste à vivre — réutilisables depuis les mêmes calculs que `app/api/dashboard/route.ts` (factoriser dans `lib/financials.ts`).

## Phase 7 — Page Santé (nouvelle, `/app/sante`)

- Routes `GET/POST /api/health` sur le nouveau modèle `MedicalRecord` (peut aussi se lier automatiquement à une `Transaction` de catégorie "Santé & Médical").
- Carte "Budget Santé Mensuel" : restant, prévu (`Category.budgetPct` de "Santé & Médical" × revenu de référence), dépensé, budget annuel estimé, poids sur revenu.
- Bloc statique "Prévention & Couverture".
- `MedicalRecordsTable` : historique des soins avec bouton "Dossier CNSS" qui met à jour `reimbursementStatus`.

## Phase 8 — Page Coach IA (nouvelle, `/app/coach`)

Page cliente avec 4 onglets internes (état local, comme le site 1) :

- **Diagnostic** : réutilise les métriques déjà calculées par `/api/dashboard` (profil dépensier, point fort/faible détecté par règles simples — ex. si `Loisirs.usedPct > 80%` → point faible), plus une carte "Recommandation du mois". Peut évoluer plus tard vers un vrai appel au `FinanceAgent` existant (`app/api/chat/route.ts`) pour générer la recommandation dynamiquement au lieu de règles statiques.
- **Règles d'Or** : contenu statique (règle du loyer, voiture, smartphone, restaurant, crédit conso, règle 3-6-12), calculs simples basés sur `UserSettings.referenceIncome`.
- **Simulations** : réutilise `InterestSimulator`.
- **Benchmarks Maroc** : contenu statique (banques, courtiers, prix immobilier).

## Phase 9 — Vérification & QA

- Cohérence devise DH partout (Dashboard header, chat IA, Portfolio).
- Test de bout en bout : créer une transaction dans chaque catégorie → vérifier que Dashboard, Saisie, Analyse, Profil et Santé reflètent les mêmes chiffres.
- Vérifier que le lien "Portfolio & Épargne" du menu fonctionne et que les 5 nouvelles routes (`/objectifs`, `/analyse`, `/sante`, `/coach`, `/profil`) ne renvoient plus de 404.
- Repasser le document `etat_des_lieux_budgetmaster.md` comme checklist finale, point par point.

## Ordre d'exécution recommandé

1. Phase 0 (schéma + seed) — bloquant.
2. Phase 1 (corriger les bugs existants) + Phase 2 (Saisie complète).
3. Phase 3 (Profil).
4. Phase 4 (Portfolio + lien menu).
5. Phase 5 (Objectifs).
6. Phase 6 (Analyse & Trends).
7. Phase 7 (Santé).
8. Phase 8 (Coach IA).
9. Phase 9 (QA finale).

Chaque phase est livrable et testable indépendamment — possible de s'arrêter après n'importe laquelle sans casser l'existant.
