/**
 * Système i18n minimal (pas de dépendance externe) : dictionnaires plats par
 * clé pointée (ex: "nav.dashboard"), utilisables aussi bien côté serveur
 * (composants serveur, routes API — via getUserLocale()) que côté client
 * (via LanguageProvider / useLanguage()).
 *
 * Le layout reste LTR pour les 4 langues, y compris l'arabe (choix
 * explicite : texte traduit, mise en page inchangée).
 */

export type Locale = "fr" | "ar" | "en" | "es";

export const LOCALES: Locale[] = ["fr", "ar", "en", "es"];

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
  es: "Español",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
  es: "ES",
};

export const DEFAULT_LOCALE: Locale = "fr";

type Dict = Record<string, string>;

const fr: Dict = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.saisie": "Saisie & Histo",
  "nav.portfolio": "Portfolio & Épargne",
  "nav.objectifs": "Objectifs",
  "nav.analyse": "Analyse & Trends",
  "nav.sante": "Santé",
  "nav.coach": "Coach IA",
  "nav.profil": "Profil",
  "nav.logout": "Déconnexion",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",

  // Commun
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.export": "Exporter CSV",
  "common.exporting": "Export...",
  "common.search": "Rechercher",
  "common.reset": "Réinitialiser",
  "common.loading": "Chargement...",
  "common.noData": "Aucune donnée trouvée.",
  "common.previous": "Précédent",
  "common.next": "Suivant",
  "common.date": "Date",
  "common.amount": "Montant",
  "common.category": "Catégorie",
  "common.subcategory": "Sous-Catégorie",
  "common.method": "Méthode",
  "common.description": "Description",
  "common.account": "Compte",
  "common.action": "Action",
  "common.total": "Total",
  "common.net": "Net",
  "common.all": "Tous",
  "common.allCategories": "Toutes catégories",
  "common.page": "Page",
  "common.of": "sur",
  "common.income": "Revenu",
  "common.expense": "Dépense",
  "common.savings": "Épargne/Invest.",
  "common.records": "enregistrement(s)",
  "common.confirm": "Confirmer",

  // Auth
  "auth.loginTitle": "Wealth OS",
  "auth.loginSubtitle": "Connecte-toi pour accéder à ton espace.",
  "auth.email": "Email",
  "auth.password": "Mot de passe",
  "auth.confirmPassword": "Confirmer le mot de passe",
  "auth.name": "Nom",
  "auth.loginButton": "Se connecter",
  "auth.signupButton": "Créer mon compte",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.hasAccount": "Déjà un compte ?",
  "auth.createAccount": "Créer un compte",
  "auth.signupSubtitle":
    "Crée ton compte — catégories et budget 50/30/20 prêts à l'emploi dès l'inscription.",
  "auth.loginLink": "Se connecter",
  "auth.nameOptional": "Nom (optionnel)",
  "auth.passwordMinChars": "8 caractères minimum",
  "auth.errorLoginFailed": "Connexion impossible",
  "auth.errorSignupFailed": "Inscription impossible",
  "auth.errorNetwork": "Erreur réseau, réessaie.",
  "auth.errorPasswordMismatch": "Les mots de passe ne correspondent pas.",
  "auth.errorPasswordTooShort":
    "Le mot de passe doit contenir au moins 8 caractères.",

  // Dashboard
  "dashboard.title": "Personal Wealth OS",
  "dashboard.welcome": "Bon retour. Votre score de santé financière est de",
  "dashboard.globalSafeBalance": "Solde Global Disponible",
  "dashboard.smartAlerts": "Alertes Intelligentes",
  "dashboard.budgetExceeded":
    "Critique : budget dépassé dans certaines catégories.",
  "dashboard.systemNominal": "Système nominal : dépenses dans les limites.",
  "dashboard.portfolioAdvice":
    "Conseil : rééquilibrage du portefeuille recommandé.",
  "dashboard.wealthTools": "Outils de Projection Patrimoniale",

  // Historique & Audit
  "historique.newEntry": "Nouvel Enregistrement",
  "historique.title": "Historique Complet",
  "historique.searchPlaceholder": "Rechercher un marchand, une note...",
  "historique.type": "Type",
  "historique.envelope": "Enveloppe Master",
  "historique.paymentMethod": "Méthode de Paiement",
  "historique.notes": "Notes / Référence",
  "historique.submit": "Valider Flux",
  "historique.noTransactions": "Aucune transaction trouvée.",
  "historique.deleteConfirm": "Supprimer la transaction",

  // Formulaire de saisie
  "form.amount": "Montant (DH)",
  "form.notesPlaceholder": "Description de la transaction...",
  "form.noCategoryOfType": "Aucune catégorie de ce type",
  "form.noSubcategory": "Aucune sous-catégorie",
  "form.selectPlaceholder": "Sélectionner...",
  "form.typeExpense": "Dépense (-)",
  "form.typeIncome": "Revenu (+)",
  "form.typeSavings": "Épargne / Invest.",

  // Méthodes de paiement (valeurs stockées en français, seul le libellé est traduit)
  "payment.bankCard": "Carte Bancaire",
  "payment.bankTransfer": "Virement Bancaire",
  "payment.cash": "Espèces",
  "payment.check": "Chèque",
  "payment.cihPay": "CIH Pay/Mobile",
  "payment.paypal": "PayPal",
  "payment.applePay": "Apple Pay",
  "payment.bmceDirect": "BMCE DIRECT",

  "saisie.dbTitle": "Base de données transactions",
  "saisie.dbSubtitle": "Flux financier & Archivage",
  "saisie.historyAudit": "Historique & Audit",

  // Coach IA — libellés partagés
  "coach.analyzing": "Analyse IA...",
  "coach.aiCoach": "Coach IA",
  "coach.generatedOn": "Analyse générée le",
  "coach.weeklyRefresh": "actualisée une fois par semaine.",
  "coach.fallbackNotice":
    "Coach IA indisponible pour le moment — analyse de repli basée sur des règles simples.",

  // Coach IA — Conseils Financiers (Tanger)
  "coach.tanger.title": "Conseils Financiers",
  "coach.tanger.banques": "Banques & Épargne",
  "coach.tanger.investMaroc": "Investissement au Maroc",
  "coach.tanger.investIntl": "Investissement International",
  "coach.tanger.erreurs": "Erreurs Fatales",
  "coach.tanger.staticBanques":
    "Privilégiez les banques sans frais comme CIH Bank (Code30) ou Attijariwafa (L'bankalik) pour séparer l'argent de vos dépenses courantes de l'épargne. Le Plan Épargne Logement (PEL) est intéressant pour acheter un appartement à Tanger avec un taux préférentiel fiscalement.",
  "coach.tanger.staticInvestMaroc":
    "Bourse de Casablanca (MASI) via votre banque ou application de courtage. Privilégiez les grandes capitalisations (IAM, Attijariwafa, LafargeHolcim) qui versent des dividendes réguliers. Les OPCVM sont une option managée mais surveillez les frais d'entrée !",
  "coach.tanger.staticInvestIntl":
    "Diversifiez votre risque ! Selon la législation de l'Office des Changes, utilisez votre dotation e-commerce ou touristique pour investir périodiquement (DCA) sur des ETF mondiaux via des courtiers.",
  "coach.tanger.staticErreurs":
    "Ne prenez JAMAIS un crédit consommation (taux > 12%) pour investir en bourse ou en crypto ! N'investissez pas l'argent du mois ou votre fonds d'urgence. Le marché est fait pour l'argent dont vous n'aurez pas besoin pendant 5 ans minimum.",

  // Coach IA — Prévention & Couverture
  "coach.prevention.title": "Prévention & Couverture",
  "coach.prevention.bilan": "Bilan de Santé Annuel",
  "coach.prevention.cnss": "Couverture CNSS / AMO",
  "coach.prevention.mutuelle": "Mutuelle Complémentaire",
  "coach.prevention.pharmacie": "Pharmacie & Génériques",
  "coach.prevention.staticBilan":
    "Un bilan complet (analyses de sang, tension, glycémie) une fois par an permet de détecter tôt la majorité des problèmes chroniques. Beaucoup de laboratoires à Tanger proposent des forfaits bilan à prix réduit.",
  "coach.prevention.staticCnss":
    "Vérifiez que votre déclaration CNSS est à jour : l'AMO rembourse une partie des consultations, analyses et médicaments sur ordonnance. Gardez toujours vos factures et ordonnances pour constituer le dossier de remboursement.",
  "coach.prevention.staticMutuelle":
    "Si votre reste à charge après CNSS est élevé (dentaire, optique, hospitalisation), une mutuelle privée complémentaire peut réduire fortement la facture. Comparez les plafonds annuels avant de souscrire.",
  "coach.prevention.staticPharmacie":
    "Demandez systématiquement l'équivalent générique à votre pharmacien : le prix est souvent 30 à 50% inférieur au médicament de marque, pour la même molécule.",

  // Coach IA — Stratégie & Conseils (Fonds d'Urgence)
  "coach.emergency.title": "Stratégie & Conseils",
  "coach.emergency.diagnostic": "Diagnostic :",
  "coach.emergency.method": "La Méthode :",
  "coach.emergency.recommendations": "Recommandations :",
  "coach.emergency.objectiveLabel": "L'Objectif :",
  "coach.emergency.staticObjectiveText":
    "Constituer une réserve liquide capable de couvrir entre 3 et 6 mois de vos dépenses vitales en cas d'imprévu (perte d'emploi, accident, etc.).",
  "coach.emergency.staticMethodText":
    "Virez automatiquement 500 DH/mois minimum vers ce compte dès réception de votre salaire.",
  "coach.emergency.placementsTitle": "Placements Recommandés au Maroc :",
  "coach.emergency.placement1": "Livret Épargne CIH (liquide, 0 frais)",
  "coach.emergency.placement2": "Compte sur Carnet Attijariwafa",
  "coach.emergency.placement3":
    "Bons du Trésor à court terme (si capital > 10k DH)",

  // Coach IA — Analyse des Tendances
  "coach.trends.title": "Analyse IA des Tendances",
  "coach.trends.tendance": "Tendance :",
  "coach.trends.pointAttention": "Point d'Attention :",
  "coach.trends.recommandation": "Recommandation :",
  "coach.trends.staticSyntheseTemplate":
    "Vos dépenses sont passées de {{firstLabel}} ({{firstExpenses}} DH) à {{lastLabel}} ({{lastExpenses}} DH), avec un taux d'épargne moyen de {{avgRate}}% sur la période.",
  "coach.trends.noHistory":
    "Pas encore assez d'historique pour dégager une tendance fiable — continuez à enregistrer vos transactions.",
  "coach.trends.pointAttentionTemplate":
    '"{{category}}" est la catégorie qui a le plus progressé sur la période (+{{trendPct}}%, {{total}} DH cumulés).',
  "coach.trends.noStandoutCategory":
    "Aucune catégorie ne se démarque nettement à la hausse sur la période observée.",
  "coach.trends.recommandationBelowTarget":
    "Votre taux d'épargne du dernier mois ({{rate}}%) est sous la cible de 20% — revoyez en priorité la catégorie qui a le plus progressé ce mois-ci.",
  "coach.trends.recommandationOnTarget":
    "Votre taux d'épargne récent est dans la cible : maintenez ce rythme et surveillez les catégories qui progressent le plus vite.",

  // Coach IA — Diagnostic (onglet Coach)
  "coach.diagnostic.profil": "Profil Dépensier",
  "coach.diagnostic.pointFort": "Point Fort",
  "coach.diagnostic.pointFaible": "Point Faible",
  "coach.diagnostic.recommandationMonth": "Recommandation du Mois",
  "coach.diagnostic.scoreLabel": "Score Santé :",
  "coach.diagnostic.profileEpargnant": "Épargnant Discipliné",
  "coach.diagnostic.profileEpargnantDesc":
    "Vous épargnez/investissez {{pct}}% de vos revenus ce mois-ci, au niveau ou au-dessus de la règle des 20%.",
  "coach.diagnostic.profileLoisirs": "Dépensier Loisirs",
  "coach.diagnostic.profileLoisirsDesc":
    'Vos dépenses "Envies" représentent {{pct}}% de vos revenus, bien au-dessus des 30% recommandés.',
  "coach.diagnostic.profileCharges": "Charges Serrées",
  "coach.diagnostic.profileChargesDesc":
    'Vos charges essentielles ("Besoins") pèsent {{pct}}% de vos revenus, au-dessus des 50% recommandés — peu de marge de manœuvre.',
  "coach.diagnostic.profileEquilibre": "Équilibré",
  "coach.diagnostic.profileEquilibreDesc":
    "Votre répartition Besoins/Envies/Épargne ({{needs}}% / {{wants}}% / {{savings}}%) reste proche de la règle 50/30/20.",
  "coach.diagnostic.pointFortTemplate":
    "{{category}} : seulement {{pct}}% du budget utilisé ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFort":
    "Pas de catégorie nettement sous-consommée ce mois-ci.",
  "coach.diagnostic.pointFaibleTemplate":
    "{{category}} : déjà {{pct}}% du budget utilisé ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFaible":
    "Aucune catégorie au-dessus de 80% du budget. 👍",
  "coach.diagnostic.recoPriority":
    'Priorité : "{{category}}" a déjà consommé {{pct}}% de son budget ({{spent}} / {{budget}}). Ralentissez sur cette catégorie jusqu\'à la fin du mois.',
  "coach.diagnostic.recoEmergencyLow":
    "Aucune catégorie en dépassement ce mois-ci. Concentrez l'effort sur le fonds d'urgence : il ne couvre que {{months}} mois de dépenses (cible : 3 mois minimum).",
  "coach.diagnostic.recoStrong":
    "Aucune catégorie en dépassement et fonds d'urgence solide ({{months}} mois). Continuez sur cette lancée et envisagez d'augmenter vos versements d'investissement.",
  "coach.diagnostic.aiFallbackNotice":
    "Coach IA indisponible pour le moment — diagnostic de repli basé sur des règles simples (seuils sur vos catégories budgétaires).",
  // Santé
  "health.title": "Santé",
  "health.title.sub": "Suivez votre budget santé et vos remboursements CNSS.",
  "health.body.title": "Budget Santé Mensuel",
  "health.body.of_income": "du revenu",
  "health.body.foreseen": "Prévu",
  "health.body.remaining": "Restant ce mois",
  "health.body.annual_est": "Budget Annuel Est.",
  "health.body.weight_on_income": "Poids sur Revenu",
  "health.body.budget_used": "du budget utilisé",
  "health.card2.title": "Suivi Remboursements",
  "health.card2.sub_waiting": "En Attente",
  "health.card2.sub_cnss": "Soumis à la CNSS",
  "health.card2.sub_reimbursed": "Remboursé",
  "health.card3.title": "Tendance Dépenses Santé",
  "health.card3.sub_avg1": "Moy. ",
  "health.card3.sub_avg2": "/mois",
  "health.card5.title": "Historique des Soins",
  "health.card5.table.date": "Date",
  "health.card5.table.provider": "Prestataire",
  "health.card5.table.amount": "Montant",
  "health.card5.table.transaction": "Transaction Liée",
  "health.card5.table.cnssFile": "Dossier CNSS",
  "health.card5.table.transaction.linked": "✓ Liée",
  "health.card5.table.status": "Statut",
  "health.card5.table.status.pending": "En Attente",
  "health.card5.table.status.pending.next": "Soumettre à la CNSS",
  "health.card5.table.status.submited": "Soumis CNSS",
  "health.card5.table.status.submited.next": "Marquer remboursé",
  "health.card5.table.status.reimbursed": "Remboursé",
  "health.card5.table.status.rejected": "Rejeté",
  "health.card5.table.status.filecnss.close": "Dossier clos",
  "health.card6.title": "Enregistrer un Soin",
  "health.card6.form.provider": "Prestataire",
  "health.card6.form.amount": "Montant du soin",
  "health.card6.form.date": "Date du soin",
  "health.card6.form.transaction": "Créer la transaction liée",
  "health.card6.form.submit": "Ajouter",
};

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.saisie": "Entries & History",
  "nav.portfolio": "Portfolio & Savings",
  "nav.objectifs": "Goals",
  "nav.analyse": "Analytics & Trends",
  "nav.sante": "Health",
  "nav.coach": "AI Coach",
  "nav.profil": "Profile",
  "nav.logout": "Log out",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.export": "Export CSV",
  "common.exporting": "Exporting...",
  "common.search": "Search",
  "common.reset": "Reset",
  "common.loading": "Loading...",
  "common.noData": "No data found.",
  "common.previous": "Previous",
  "common.next": "Next",
  "common.date": "Date",
  "common.amount": "Amount",
  "common.category": "Category",
  "common.subcategory": "Subcategory",
  "common.method": "Method",
  "common.description": "Description",
  "common.account": "Account",
  "common.action": "Action",
  "common.total": "Total",
  "common.net": "Net",
  "common.all": "All",
  "common.allCategories": "All categories",
  "common.page": "Page",
  "common.of": "of",
  "common.income": "Income",
  "common.expense": "Expense",
  "common.savings": "Savings/Invest.",
  "common.records": "record(s)",
  "common.confirm": "Confirm",

  "auth.loginTitle": "Wealth OS",
  "auth.loginSubtitle": "Sign in to access your space.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.confirmPassword": "Confirm password",
  "auth.name": "Name",
  "auth.loginButton": "Sign in",
  "auth.signupButton": "Create my account",
  "auth.noAccount": "Don't have an account yet?",
  "auth.hasAccount": "Already have an account?",
  "auth.createAccount": "Create an account",
  "auth.signupSubtitle":
    "Create your account — categories and a 50/30/20 budget ready to go from day one.",
  "auth.loginLink": "Sign in",
  "auth.nameOptional": "Name (optional)",
  "auth.passwordMinChars": "At least 8 characters",
  "auth.errorLoginFailed": "Could not sign in",
  "auth.errorSignupFailed": "Could not sign up",
  "auth.errorNetwork": "Network error, try again.",
  "auth.errorPasswordMismatch": "Passwords do not match.",
  "auth.errorPasswordTooShort": "Password must be at least 8 characters.",

  "dashboard.title": "Personal Wealth OS",
  "dashboard.welcome": "Welcome back. Your financial health score is",
  "dashboard.globalSafeBalance": "Global Safe Balance",
  "dashboard.smartAlerts": "Smart Alerts",
  "dashboard.budgetExceeded": "Critical: budget exceeded in some categories.",
  "dashboard.systemNominal": "System nominal: spending within targets.",
  "dashboard.portfolioAdvice": "Advice: portfolio rebalancing recommended.",
  "dashboard.wealthTools": "Wealth Projection Tools",

  "historique.newEntry": "New Entry",
  "historique.title": "Full History",
  "historique.searchPlaceholder": "Search a merchant, a note...",
  "historique.type": "Type",
  "historique.envelope": "Master Envelope",
  "historique.paymentMethod": "Payment Method",
  "historique.notes": "Notes / Reference",
  "historique.submit": "Submit Entry",
  "historique.noTransactions": "No transactions found.",
  "historique.deleteConfirm": "Delete transaction",

  "form.amount": "Amount (DH)",
  "form.notesPlaceholder": "Transaction description...",
  "form.noCategoryOfType": "No category of this type",
  "form.noSubcategory": "No subcategory",
  "form.selectPlaceholder": "Select...",
  "form.typeExpense": "Expense (-)",
  "form.typeIncome": "Income (+)",
  "form.typeSavings": "Savings / Invest.",

  "payment.bankCard": "Bank Card",
  "payment.bankTransfer": "Bank Transfer",
  "payment.cash": "Cash",
  "payment.check": "Check",
  "payment.cihPay": "CIH Pay/Mobile",
  "payment.paypal": "PayPal",
  "payment.applePay": "Apple Pay",
  "payment.bmceDirect": "BMCE DIRECT",

  "saisie.dbTitle": "Transactions Database",
  "saisie.dbSubtitle": "Financial Flow & Archiving",
  "saisie.historyAudit": "History & Audit",

  "coach.analyzing": "AI analyzing...",
  "coach.aiCoach": "AI Coach",
  "coach.generatedOn": "Analysis generated on",
  "coach.weeklyRefresh": "refreshed once a week.",
  "coach.fallbackNotice":
    "AI Coach unavailable right now — fallback analysis based on simple rules.",

  "coach.tanger.title": "Financial Advice",
  "coach.tanger.banques": "Banking & Savings",
  "coach.tanger.investMaroc": "Investing in Morocco",
  "coach.tanger.investIntl": "International Investing",
  "coach.tanger.erreurs": "Fatal Mistakes",
  "coach.tanger.staticBanques":
    "Favor fee-free banks like CIH Bank (Code30) or Attijariwafa (L'bankalik) to keep your everyday spending money separate from savings. A Housing Savings Plan (PEL) is worth considering for buying an apartment in Tangier, with a tax-preferred rate.",
  "coach.tanger.staticInvestMaroc":
    "Casablanca Stock Exchange (MASI) via your bank or a brokerage app. Favor large caps (IAM, Attijariwafa, LafargeHolcim) that pay regular dividends. Mutual funds (OPCVM) are a managed option, but watch the entry fees!",
  "coach.tanger.staticInvestIntl":
    "Diversify your risk! Under Foreign Exchange Office rules, use your e-commerce or travel allowance to invest periodically (DCA) in global ETFs through brokers.",
  "coach.tanger.staticErreurs":
    "NEVER take out a consumer loan (rate > 12%) to invest in stocks or crypto! Don't invest this month's money or your emergency fund. The market is for money you won't need for at least 5 years.",

  "coach.prevention.title": "Prevention & Coverage",
  "coach.prevention.bilan": "Annual Health Checkup",
  "coach.prevention.cnss": "CNSS / AMO Coverage",
  "coach.prevention.mutuelle": "Supplementary Insurance",
  "coach.prevention.pharmacie": "Pharmacy & Generics",
  "coach.prevention.staticBilan":
    "A full checkup (blood work, blood pressure, blood sugar) once a year catches most chronic issues early. Many labs in Tangier offer discounted checkup packages.",
  "coach.prevention.staticCnss":
    "Make sure your CNSS filing is up to date: AMO reimburses part of consultations, tests, and prescribed medication. Always keep your invoices and prescriptions to build the reimbursement file.",
  "coach.prevention.staticMutuelle":
    "If your out-of-pocket cost after CNSS is high (dental, vision, hospitalization), a private supplementary plan can significantly cut the bill. Compare annual caps before subscribing.",
  "coach.prevention.staticPharmacie":
    "Always ask your pharmacist for the generic equivalent: the price is often 30-50% lower than the brand-name drug, for the same molecule.",

  "coach.emergency.title": "Strategy & Advice",
  "coach.emergency.diagnostic": "Diagnosis:",
  "coach.emergency.method": "The Method:",
  "coach.emergency.recommendations": "Recommendations:",
  "coach.emergency.objectiveLabel": "The Goal:",
  "coach.emergency.staticObjectiveText":
    "Build a liquid reserve able to cover 3 to 6 months of your essential expenses in case of the unexpected (job loss, accident, etc.).",
  "coach.emergency.staticMethodText":
    "Automatically transfer at least 500 DH/month to this account as soon as your salary arrives.",
  "coach.emergency.placementsTitle": "Recommended Options in Morocco:",
  "coach.emergency.placement1": "CIH Savings Account (liquid, no fees)",
  "coach.emergency.placement2": "Attijariwafa Passbook Account",
  "coach.emergency.placement3":
    "Short-term Treasury Bills (if capital > 10k DH)",

  "coach.trends.title": "AI Trend Analysis",
  "coach.trends.tendance": "Trend:",
  "coach.trends.pointAttention": "Point of Attention:",
  "coach.trends.recommandation": "Recommendation:",
  "coach.trends.staticSyntheseTemplate":
    "Your expenses went from {{firstLabel}} ({{firstExpenses}} DH) to {{lastLabel}} ({{lastExpenses}} DH), with an average savings rate of {{avgRate}}% over the period.",
  "coach.trends.noHistory":
    "Not enough history yet to draw a reliable trend — keep logging your transactions.",
  "coach.trends.pointAttentionTemplate":
    '"{{category}}" is the category that grew the most over the period (+{{trendPct}}%, {{total}} DH total).',
  "coach.trends.noStandoutCategory":
    "No category stands out with a clear upward trend over the observed period.",
  "coach.trends.recommandationBelowTarget":
    "Last month's savings rate ({{rate}}%) is below the 20% target — review the category that grew the most this month as a priority.",
  "coach.trends.recommandationOnTarget":
    "Your recent savings rate is on target: keep up the pace and watch the fastest-growing categories.",

  "coach.diagnostic.profil": "Spending Profile",
  "coach.diagnostic.pointFort": "Strength",
  "coach.diagnostic.pointFaible": "Weakness",
  "coach.diagnostic.recommandationMonth": "This Month's Recommendation",
  "coach.diagnostic.scoreLabel": "Health Score:",
  "coach.diagnostic.profileEpargnant": "Disciplined Saver",
  "coach.diagnostic.profileEpargnantDesc":
    "You're saving/investing {{pct}}% of your income this month, at or above the 20% rule.",
  "coach.diagnostic.profileLoisirs": "Leisure Spender",
  "coach.diagnostic.profileLoisirsDesc":
    'Your "Wants" spending is {{pct}}% of your income, well above the recommended 30%.',
  "coach.diagnostic.profileCharges": "Tight Budget",
  "coach.diagnostic.profileChargesDesc":
    'Your essential ("Needs") expenses take up {{pct}}% of your income, above the recommended 50% — little room to maneuver.',
  "coach.diagnostic.profileEquilibre": "Balanced",
  "coach.diagnostic.profileEquilibreDesc":
    "Your Needs/Wants/Savings split ({{needs}}% / {{wants}}% / {{savings}}%) stays close to the 50/30/20 rule.",
  "coach.diagnostic.pointFortTemplate":
    "{{category}}: only {{pct}}% of budget used ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFort":
    "No category is notably under-spent this month.",
  "coach.diagnostic.pointFaibleTemplate":
    "{{category}}: already {{pct}}% of budget used ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFaible":
    "No category is above 80% of its budget. 👍",
  "coach.diagnostic.recoPriority":
    'Priority: "{{category}}" has already used {{pct}}% of its budget ({{spent}} / {{budget}}). Slow down on this category for the rest of the month.',
  "coach.diagnostic.recoEmergencyLow":
    "No category is over budget this month. Focus on the emergency fund: it only covers {{months}} months of expenses (target: 3 months minimum).",
  "coach.diagnostic.recoStrong":
    "No category is over budget and the emergency fund is solid ({{months}} months). Keep it up and consider increasing your investment contributions.",
  "coach.diagnostic.aiFallbackNotice":
    "AI Coach unavailable right now — fallback diagnosis based on simple rules (thresholds on your budget categories).",

  // Health
  "health.title": "Health",
  "health.title.sub":
    "Track your health budget and your CNSS reimbursement records.",
  "health.body.title": "Monthly Health Budget",
  "health.body.of_income": "of income",
  "health.body.foreseen": "Foreseen",
  "health.body.remaining": "Remaining this month",
  "health.body.annual_est": "Estimated Annual Budget",
  "health.body.weight_on_income": "Weight on Income",
  "health.body.budget_used": "of budget used",
  "health.card2.title": "Reimbursement Tracking",
  "health.card2.sub_waiting": "Waiting",
  "health.card2.sub_cnss": "Submitted to CNSS",
  "health.card2.sub_reimbursed": "Reimbursed",
  "health.card3.title": "Health Expenses Trend",
  "health.card3.sub_avg1": "Avg. ",
  "health.card3.sub_avg2": "/month",
  "health.card5.title": "Care History",
  "health.card5.table.date": "Date",
  "health.card5.table.provider": "Provider",
  "health.card5.table.amount": "Amount",
  "health.card5.table.transaction": "Linked Transaction",
  "health.card5.table.cnssFile": "CNSS File",
  "health.card5.table.transaction.linked": "✓ Linked",
  "health.card5.table.status": "Status",
  "health.card5.table.status.pending": "Pending",
  "health.card5.table.status.pending.next": "Submit to CNSS",
  "health.card5.table.status.submited": "Submitted to CNSS",
  "health.card5.table.status.submited.next": "Mark as reimbursed",
  "health.card5.table.status.reimbursed": "Reimbursed",
  "health.card5.table.status.rejected": "Rejected",
  "health.card5.table.status.filecnss.close": "File closed",
  "health.card6.title": "Log a Care",
  "health.card6.form.provider": "Provider",
  "health.card6.form.amount": "Care Amount",
  "health.card6.form.date": "Care Date",
  "health.card6.form.transaction": "Create linked transaction",
  "health.card6.form.submit": "Add",
};

const es: Dict = {
  "nav.dashboard": "Panel",
  "nav.saisie": "Registro e Historial",
  "nav.portfolio": "Cartera y Ahorros",
  "nav.objectifs": "Objetivos",
  "nav.analyse": "Análisis y Tendencias",
  "nav.sante": "Salud",
  "nav.coach": "Coach IA",
  "nav.profil": "Perfil",
  "nav.logout": "Cerrar sesión",
  "nav.openMenu": "Abrir menú",
  "nav.closeMenu": "Cerrar menú",

  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.export": "Exportar CSV",
  "common.exporting": "Exportando...",
  "common.search": "Buscar",
  "common.reset": "Restablecer",
  "common.loading": "Cargando...",
  "common.noData": "No se encontraron datos.",
  "common.previous": "Anterior",
  "common.next": "Siguiente",
  "common.date": "Fecha",
  "common.amount": "Importe",
  "common.category": "Categoría",
  "common.subcategory": "Subcategoría",
  "common.method": "Método",
  "common.description": "Descripción",
  "common.account": "Cuenta",
  "common.action": "Acción",
  "common.total": "Total",
  "common.net": "Neto",
  "common.all": "Todos",
  "common.allCategories": "Todas las categorías",
  "common.page": "Página",
  "common.of": "de",
  "common.income": "Ingreso",
  "common.expense": "Gasto",
  "common.savings": "Ahorro/Inversión",
  "common.records": "registro(s)",
  "common.confirm": "Confirmar",

  "auth.loginTitle": "Wealth OS",
  "auth.loginSubtitle": "Inicia sesión para acceder a tu espacio.",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.confirmPassword": "Confirmar contraseña",
  "auth.name": "Nombre",
  "auth.loginButton": "Iniciar sesión",
  "auth.signupButton": "Crear mi cuenta",
  "auth.noAccount": "¿Aún no tienes cuenta?",
  "auth.hasAccount": "¿Ya tienes cuenta?",
  "auth.createAccount": "Crear una cuenta",
  "auth.signupSubtitle":
    "Crea tu cuenta — categorías y presupuesto 50/30/20 listos desde el registro.",
  "auth.loginLink": "Iniciar sesión",
  "auth.nameOptional": "Nombre (opcional)",
  "auth.passwordMinChars": "Mínimo 8 caracteres",
  "auth.errorLoginFailed": "No se pudo iniciar sesión",
  "auth.errorSignupFailed": "No se pudo registrar",
  "auth.errorNetwork": "Error de red, inténtalo de nuevo.",
  "auth.errorPasswordMismatch": "Las contraseñas no coinciden.",
  "auth.errorPasswordTooShort":
    "La contraseña debe tener al menos 8 caracteres.",

  "dashboard.title": "Personal Wealth OS",
  "dashboard.welcome":
    "Bienvenido de nuevo. Tu puntuación de salud financiera es de",
  "dashboard.globalSafeBalance": "Saldo Global Disponible",
  "dashboard.smartAlerts": "Alertas Inteligentes",
  "dashboard.budgetExceeded":
    "Crítico: presupuesto excedido en algunas categorías.",
  "dashboard.systemNominal": "Sistema nominal: gastos dentro de los límites.",
  "dashboard.portfolioAdvice":
    "Consejo: se recomienda reequilibrar la cartera.",
  "dashboard.wealthTools": "Herramientas de Proyección Patrimonial",

  "historique.newEntry": "Nuevo Registro",
  "historique.title": "Historial Completo",
  "historique.searchPlaceholder": "Buscar un comercio, una nota...",
  "historique.type": "Tipo",
  "historique.envelope": "Categoría Principal",
  "historique.paymentMethod": "Método de Pago",
  "historique.notes": "Notas / Referencia",
  "historique.submit": "Validar Movimiento",
  "historique.noTransactions": "No se encontraron transacciones.",
  "historique.deleteConfirm": "Eliminar transacción",

  "form.amount": "Importe (DH)",
  "form.notesPlaceholder": "Descripción de la transacción...",
  "form.noCategoryOfType": "Sin categoría de este tipo",
  "form.noSubcategory": "Sin subcategoría",
  "form.selectPlaceholder": "Seleccionar...",
  "form.typeExpense": "Gasto (-)",
  "form.typeIncome": "Ingreso (+)",
  "form.typeSavings": "Ahorro / Inversión",

  "payment.bankCard": "Tarjeta Bancaria",
  "payment.bankTransfer": "Transferencia Bancaria",
  "payment.cash": "Efectivo",
  "payment.check": "Cheque",
  "payment.cihPay": "CIH Pay/Mobile",
  "payment.paypal": "PayPal",
  "payment.applePay": "Apple Pay",
  "payment.bmceDirect": "BMCE DIRECT",

  "saisie.dbTitle": "Base de Datos de Transacciones",
  "saisie.dbSubtitle": "Flujo Financiero y Archivo",
  "saisie.historyAudit": "Historial y Auditoría",

  "coach.analyzing": "Analizando con IA...",
  "coach.aiCoach": "Coach IA",
  "coach.generatedOn": "Análisis generado el",
  "coach.weeklyRefresh": "actualizado una vez por semana.",
  "coach.fallbackNotice":
    "Coach IA no disponible por el momento — análisis alternativo basado en reglas simples.",

  "coach.tanger.title": "Consejos Financieros",
  "coach.tanger.banques": "Bancos y Ahorro",
  "coach.tanger.investMaroc": "Inversión en Marruecos",
  "coach.tanger.investIntl": "Inversión Internacional",
  "coach.tanger.erreurs": "Errores Fatales",
  "coach.tanger.staticBanques":
    "Prefiere bancos sin comisiones como CIH Bank (Code30) o Attijariwafa (L'bankalik) para separar el dinero de tus gastos corrientes del ahorro. El Plan de Ahorro Vivienda (PEL) es interesante para comprar un piso en Tánger con una tasa fiscalmente preferente.",
  "coach.tanger.staticInvestMaroc":
    "Bolsa de Casablanca (MASI) a través de tu banco o una app de corretaje. Prefiere las grandes capitalizaciones (IAM, Attijariwafa, LafargeHolcim) que pagan dividendos regulares. Los fondos de inversión (OPCVM) son una opción gestionada, ¡pero vigila las comisiones de entrada!",
  "coach.tanger.staticInvestIntl":
    "¡Diversifica tu riesgo! Según la normativa de la Oficina de Cambios, usa tu dotación de comercio electrónico o turística para invertir periódicamente (DCA) en ETF globales a través de brókers.",
  "coach.tanger.staticErreurs":
    "¡NUNCA pidas un crédito al consumo (tasa > 12%) para invertir en bolsa o cripto! No inviertas el dinero del mes ni tu fondo de emergencia. El mercado es para el dinero que no necesitarás durante al menos 5 años.",

  "coach.prevention.title": "Prevención y Cobertura",
  "coach.prevention.bilan": "Chequeo de Salud Anual",
  "coach.prevention.cnss": "Cobertura CNSS / AMO",
  "coach.prevention.mutuelle": "Seguro Complementario",
  "coach.prevention.pharmacie": "Farmacia y Genéricos",
  "coach.prevention.staticBilan":
    "Un chequeo completo (análisis de sangre, tensión, glucemia) una vez al año permite detectar a tiempo la mayoría de los problemas crónicos. Muchos laboratorios en Tánger ofrecen paquetes de chequeo a precio reducido.",
  "coach.prevention.staticCnss":
    "Verifica que tu declaración CNSS esté al día: el AMO reembolsa parte de las consultas, análisis y medicamentos recetados. Guarda siempre tus facturas y recetas para armar el expediente de reembolso.",
  "coach.prevention.staticMutuelle":
    "Si tu gasto a cargo después del CNSS es alto (dental, óptica, hospitalización), un seguro privado complementario puede reducir mucho la factura. Compara los topes anuales antes de contratar.",
  "coach.prevention.staticPharmacie":
    "Pide siempre a tu farmacéutico el equivalente genérico: el precio suele ser un 30-50% menor que el medicamento de marca, para la misma molécula.",

  "coach.emergency.title": "Estrategia y Consejos",
  "coach.emergency.diagnostic": "Diagnóstico:",
  "coach.emergency.method": "El Método:",
  "coach.emergency.recommendations": "Recomendaciones:",
  "coach.emergency.objectiveLabel": "El Objetivo:",
  "coach.emergency.staticObjectiveText":
    "Constituir una reserva líquida capaz de cubrir entre 3 y 6 meses de tus gastos vitales en caso de imprevisto (pérdida de empleo, accidente, etc.).",
  "coach.emergency.staticMethodText":
    "Transfiere automáticamente al menos 500 DH/mes a esta cuenta en cuanto recibas tu salario.",
  "coach.emergency.placementsTitle": "Opciones Recomendadas en Marruecos:",
  "coach.emergency.placement1":
    "Libreta de Ahorro CIH (líquida, sin comisiones)",
  "coach.emergency.placement2": "Cuenta de Ahorro Attijariwafa",
  "coach.emergency.placement3":
    "Letras del Tesoro a corto plazo (si el capital > 10k DH)",

  "coach.trends.title": "Análisis de Tendencias con IA",
  "coach.trends.tendance": "Tendencia:",
  "coach.trends.pointAttention": "Punto de Atención:",
  "coach.trends.recommandation": "Recomendación:",
  "coach.trends.staticSyntheseTemplate":
    "Tus gastos pasaron de {{firstLabel}} ({{firstExpenses}} DH) a {{lastLabel}} ({{lastExpenses}} DH), con una tasa de ahorro media del {{avgRate}}% en el período.",
  "coach.trends.noHistory":
    "Aún no hay suficiente historial para determinar una tendencia fiable — sigue registrando tus transacciones.",
  "coach.trends.pointAttentionTemplate":
    '"{{category}}" es la categoría que más creció en el período (+{{trendPct}}%, {{total}} DH acumulados).',
  "coach.trends.noStandoutCategory":
    "Ninguna categoría destaca claramente al alza en el período observado.",
  "coach.trends.recommandationBelowTarget":
    "Tu tasa de ahorro del último mes ({{rate}}%) está por debajo del objetivo del 20% — revisa primero la categoría que más creció este mes.",
  "coach.trends.recommandationOnTarget":
    "Tu tasa de ahorro reciente está en el objetivo: mantén el ritmo y vigila las categorías que crecen más rápido.",

  "coach.diagnostic.profil": "Perfil de Gasto",
  "coach.diagnostic.pointFort": "Punto Fuerte",
  "coach.diagnostic.pointFaible": "Punto Débil",
  "coach.diagnostic.recommandationMonth": "Recomendación del Mes",
  "coach.diagnostic.scoreLabel": "Puntuación de Salud:",
  "coach.diagnostic.profileEpargnant": "Ahorrador Disciplinado",
  "coach.diagnostic.profileEpargnantDesc":
    "Ahorras/inviertes el {{pct}}% de tus ingresos este mes, al nivel o por encima de la regla del 20%.",
  "coach.diagnostic.profileLoisirs": "Gastador en Ocio",
  "coach.diagnostic.profileLoisirsDesc":
    'Tus gastos "Deseos" representan el {{pct}}% de tus ingresos, muy por encima del 30% recomendado.',
  "coach.diagnostic.profileCharges": "Cargas Ajustadas",
  "coach.diagnostic.profileChargesDesc":
    'Tus gastos esenciales ("Necesidades") pesan el {{pct}}% de tus ingresos, por encima del 50% recomendado — poco margen de maniobra.',
  "coach.diagnostic.profileEquilibre": "Equilibrado",
  "coach.diagnostic.profileEquilibreDesc":
    "Tu reparto Necesidades/Deseos/Ahorro ({{needs}}% / {{wants}}% / {{savings}}%) se mantiene cercano a la regla 50/30/20.",
  "coach.diagnostic.pointFortTemplate":
    "{{category}}: solo el {{pct}}% del presupuesto utilizado ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFort":
    "Ninguna categoría claramente infrautilizada este mes.",
  "coach.diagnostic.pointFaibleTemplate":
    "{{category}}: ya el {{pct}}% del presupuesto utilizado ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFaible":
    "Ninguna categoría supera el 80% del presupuesto. 👍",
  "coach.diagnostic.recoPriority":
    'Prioridad: "{{category}}" ya consumió el {{pct}}% de su presupuesto ({{spent}} / {{budget}}). Reduce el gasto en esta categoría hasta fin de mes.',
  "coach.diagnostic.recoEmergencyLow":
    "Ninguna categoría excedida este mes. Concentra el esfuerzo en el fondo de emergencia: solo cubre {{months}} meses de gastos (objetivo: 3 meses mínimo).",
  "coach.diagnostic.recoStrong":
    "Ninguna categoría excedida y fondo de emergencia sólido ({{months}} meses). Sigue así y considera aumentar tus aportes de inversión.",
  "coach.diagnostic.aiFallbackNotice":
    "Coach IA no disponible por el momento — diagnóstico alternativo basado en reglas simples (umbrales en tus categorías de presupuesto).",

  // Salud
  "health.title": "Salud",
  "health.title.sub":
    "Controla tu presupuesto de salud y tus reembolsos del CNSS.",
  "health.body.title": "Presupuesto de Salud Mensual",
  "health.body.of_income": "de los ingresos",
  "health.body.foreseen": "Previsto",
  "health.body.remaining": "Restante este mes",
  "health.body.annual_est": "Presupuesto Anual Estimado",
  "health.body.weight_on_income": "Peso sobre los Ingresos",
  "health.body.budget_used": "del presupuesto utilizado",
  "health.card2.title": "Seguimiento de Reembolsos",
  "health.card2.sub_waiting": "En Espera",
  "health.card2.sub_cnss": "Presentado al CNSS",
  "health.card2.sub_reimbursed": "Reembolsado",
  "health.card3.title": "Tendencia de Gastos en Salud",
  "health.card3.sub_avg1": "Prom. ",
  "health.card3.sub_avg2": "/mes",
  "health.card5.title": "Historial de Atención",
  "health.card5.table.date": "Fecha",
  "health.card5.table.provider": "Proveedor",
  "health.card5.table.amount": "Importe",
  "health.card5.table.transaction": "Transacción Vinculada",
  "health.card5.table.cnssFile": "Archivo CNSS",
  "health.card5.table.transaction.linked": "✓ Vinculada",
  "health.card5.table.status": "Estado",
  "health.card5.table.status.pending": "Pendiente",
  "health.card5.table.status.pending.next": "Presentar al CNSS",
  "health.card5.table.status.submited": "Presentado al CNSS",
  "health.card5.table.status.submited.next": "Marcar como reembolsado",
  "health.card5.table.status.reimbursed": "Reembolsado",
  "health.card5.table.status.rejected": "Rechazado",
  "health.card5.table.status.filecnss.close": "Archivo cerrado",
  "health.card6.title": "Registrar Atención",
  "health.card6.form.provider": "Proveedor",
  "health.card6.form.amount": "Importe de la Atención",
  "health.card6.form.date": "Fecha de la Atención",
  "health.card6.form.transaction": "Crear transacción vinculada",
  "health.card6.form.submit": "Agregar",
};

const ar: Dict = {
  "nav.dashboard": "لوحة التحكم",
  "nav.saisie": "الإدخال والسجل",
  "nav.portfolio": "المحفظة والادخار",
  "nav.objectifs": "الأهداف",
  "nav.analyse": "التحليلات والاتجاهات",
  "nav.sante": "الصحة",
  "nav.coach": "المدرب الذكي",
  "nav.profil": "الملف الشخصي",
  "nav.logout": "تسجيل الخروج",
  "nav.openMenu": "فتح القائمة",
  "nav.closeMenu": "إغلاق القائمة",

  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.export": "تصدير CSV",
  "common.exporting": "جارٍ التصدير...",
  "common.search": "بحث",
  "common.reset": "إعادة تعيين",
  "common.loading": "جارٍ التحميل...",
  "common.noData": "لا توجد بيانات.",
  "common.previous": "السابق",
  "common.next": "التالي",
  "common.date": "التاريخ",
  "common.amount": "المبلغ",
  "common.category": "الفئة",
  "common.subcategory": "الفئة الفرعية",
  "common.method": "طريقة الدفع",
  "common.description": "الوصف",
  "common.account": "الحساب",
  "common.action": "إجراء",
  "common.total": "الإجمالي",
  "common.net": "الصافي",
  "common.all": "الكل",
  "common.allCategories": "كل الفئات",
  "common.page": "صفحة",
  "common.of": "من",
  "common.income": "دخل",
  "common.expense": "مصروف",
  "common.savings": "ادخار/استثمار",
  "common.records": "سجل",
  "common.confirm": "تأكيد",

  "auth.loginTitle": "Wealth OS",
  "auth.loginSubtitle": "سجّل الدخول للوصول إلى مساحتك.",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.confirmPassword": "تأكيد كلمة المرور",
  "auth.name": "الاسم",
  "auth.loginButton": "تسجيل الدخول",
  "auth.signupButton": "إنشاء حسابي",
  "auth.noAccount": "ليس لديك حساب بعد؟",
  "auth.hasAccount": "لديك حساب بالفعل؟",
  "auth.createAccount": "إنشاء حساب",
  "auth.signupSubtitle":
    "أنشئ حسابك — فئات وميزانية 50/30/20 جاهزة فور التسجيل.",
  "auth.loginLink": "تسجيل الدخول",
  "auth.nameOptional": "الاسم (اختياري)",
  "auth.passwordMinChars": "8 أحرف على الأقل",
  "auth.errorLoginFailed": "تعذّر تسجيل الدخول",
  "auth.errorSignupFailed": "تعذّر إنشاء الحساب",
  "auth.errorNetwork": "خطأ في الشبكة، حاول مرة أخرى.",
  "auth.errorPasswordMismatch": "كلمتا المرور غير متطابقتين.",
  "auth.errorPasswordTooShort": "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",

  "dashboard.title": "Personal Wealth OS",
  "dashboard.welcome": "مرحبًا بعودتك. درجة صحتك المالية هي",
  "dashboard.globalSafeBalance": "الرصيد الآمن الإجمالي",
  "dashboard.smartAlerts": "تنبيهات ذكية",
  "dashboard.budgetExceeded": "تحذير: تم تجاوز الميزانية في بعض الفئات.",
  "dashboard.systemNominal": "الوضع طبيعي: الإنفاق ضمن الحدود المحددة.",
  "dashboard.portfolioAdvice": "نصيحة: يُنصح بإعادة توازن المحفظة.",
  "dashboard.wealthTools": "أدوات توقّع الثروة",

  "historique.newEntry": "إدخال جديد",
  "historique.title": "السجل الكامل",
  "historique.searchPlaceholder": "ابحث عن تاجر أو ملاحظة...",
  "historique.type": "النوع",
  "historique.envelope": "الفئة الرئيسية",
  "historique.paymentMethod": "طريقة الدفع",
  "historique.notes": "ملاحظات / مرجع",
  "historique.submit": "تأكيد العملية",
  "historique.noTransactions": "لم يتم العثور على معاملات.",
  "historique.deleteConfirm": "حذف المعاملة",

  "form.amount": "المبلغ (درهم)",
  "form.notesPlaceholder": "وصف المعاملة...",
  "form.noCategoryOfType": "لا توجد فئة من هذا النوع",
  "form.noSubcategory": "لا توجد فئة فرعية",
  "form.selectPlaceholder": "اختر...",
  "form.typeExpense": "مصروف (-)",
  "form.typeIncome": "دخل (+)",
  "form.typeSavings": "ادخار / استثمار",

  "payment.bankCard": "بطاقة بنكية",
  "payment.bankTransfer": "تحويل بنكي",
  "payment.cash": "نقدًا",
  "payment.check": "شيك",
  "payment.cihPay": "CIH Pay/Mobile",
  "payment.paypal": "PayPal",
  "payment.applePay": "Apple Pay",
  "payment.bmceDirect": "BMCE DIRECT",

  "saisie.dbTitle": "قاعدة بيانات المعاملات",
  "saisie.dbSubtitle": "التدفق المالي والأرشفة",
  "saisie.historyAudit": "السجل والتدقيق",

  "coach.analyzing": "جارٍ التحليل بالذكاء الاصطناعي...",
  "coach.aiCoach": "المدرب الذكي",
  "coach.generatedOn": "تم إنشاء التحليل في",
  "coach.weeklyRefresh": "يُحدَّث مرة واحدة أسبوعيًا.",
  "coach.fallbackNotice":
    "المدرب الذكي غير متاح حاليًا — تحليل احتياطي مبني على قواعد بسيطة.",

  "coach.tanger.title": "نصائح مالية",
  "coach.tanger.banques": "البنوك والادخار",
  "coach.tanger.investMaroc": "الاستثمار في المغرب",
  "coach.tanger.investIntl": "الاستثمار الدولي",
  "coach.tanger.erreurs": "أخطاء قاتلة",
  "coach.tanger.staticBanques":
    "فضّل البنوك بدون رسوم مثل CIH Bank (Code30) أو Attijariwafa (L'bankalik) للفصل بين أموال مصاريفك اليومية وادخارك. خطة ادخار السكن (PEL) مثيرة للاهتمام لشراء شقة في طنجة بمعدل تفضيلي ضريبيًا.",
  "coach.tanger.staticInvestMaroc":
    "بورصة الدار البيضاء (MASI) عبر بنكك أو تطبيق وساطة. فضّل الشركات ذات القيمة السوقية الكبيرة (اتصالات المغرب، التجاري وفا بنك، لافارج هولسيم) التي توزع أرباحًا منتظمة. صناديق الاستثمار المشترك (OPCVM) خيار مُدار لكن راقب رسوم الدخول!",
  "coach.tanger.staticInvestIntl":
    "نوّع مخاطرك! وفقًا لتشريعات مكتب الصرف، استخدم مخصصك للتجارة الإلكترونية أو السياحة للاستثمار الدوري (DCA) في صناديق ETF عالمية عبر وسطاء.",
  "coach.tanger.staticErreurs":
    "لا تأخذ أبدًا قرض استهلاكي (معدل > 12%) للاستثمار في البورصة أو العملات الرقمية! لا تستثمر مال الشهر أو صندوق الطوارئ. السوق مخصص للمال الذي لن تحتاجه لمدة 5 سنوات على الأقل.",

  "coach.prevention.title": "الوقاية والتغطية",
  "coach.prevention.bilan": "الفحص الصحي السنوي",
  "coach.prevention.cnss": "تغطية CNSS / AMO",
  "coach.prevention.mutuelle": "التأمين التكميلي",
  "coach.prevention.pharmacie": "الصيدلية والأدوية الجنيسة",
  "coach.prevention.staticBilan":
    "فحص شامل (تحاليل الدم، الضغط، السكر) مرة واحدة سنويًا يسمح باكتشاف معظم المشاكل المزمنة مبكرًا. تقدم العديد من المختبرات في طنجة باقات فحص بأسعار مخفضة.",
  "coach.prevention.staticCnss":
    "تأكد من أن تصريحك لدى CNSS محدّث: يُسدد AMO جزءًا من الاستشارات والتحاليل والأدوية الموصوفة. احتفظ دائمًا بفواتيرك ووصفاتك الطبية لتكوين ملف الاسترداد.",
  "coach.prevention.staticMutuelle":
    "إذا كان المبلغ المتبقي عليك بعد CNSS مرتفعًا (أسنان، بصريات، استشفاء)، يمكن لتأمين خاص تكميلي أن يخفض الفاتورة بشكل كبير. قارن السقوف السنوية قبل الاشتراك.",
  "coach.prevention.staticPharmacie":
    "اطلب دائمًا من الصيدلي المكافئ الجنيس: السعر غالبًا أقل بنسبة 30 إلى 50% من الدواء الأصلي، لنفس المادة الفعالة.",

  "coach.emergency.title": "الاستراتيجية والنصائح",
  "coach.emergency.diagnostic": "التشخيص:",
  "coach.emergency.method": "الطريقة:",
  "coach.emergency.recommendations": "التوصيات:",
  "coach.emergency.objectiveLabel": "الهدف:",
  "coach.emergency.staticObjectiveText":
    "تكوين احتياطي سائل قادر على تغطية 3 إلى 6 أشهر من مصاريفك الأساسية في حال حدوث طارئ (فقدان العمل، حادث، إلخ).",
  "coach.emergency.staticMethodText":
    "حوّل تلقائيًا 500 درهم شهريًا على الأقل إلى هذا الحساب فور استلام راتبك.",
  "coach.emergency.placementsTitle": "خيارات موصى بها في المغرب:",
  "coach.emergency.placement1": "دفتر ادخار CIH (سائل، بدون رسوم)",
  "coach.emergency.placement2": "حساب ادخار Attijariwafa",
  "coach.emergency.placement3":
    "سندات الخزينة قصيرة الأجل (إذا كان رأس المال > 10 آلاف درهم)",

  "coach.trends.title": "تحليل الاتجاهات بالذكاء الاصطناعي",
  "coach.trends.tendance": "الاتجاه:",
  "coach.trends.pointAttention": "نقطة الانتباه:",
  "coach.trends.recommandation": "التوصية:",
  "coach.trends.staticSyntheseTemplate":
    "انتقلت مصاريفك من {{firstLabel}} ({{firstExpenses}} درهم) إلى {{lastLabel}} ({{lastExpenses}} درهم)، بمعدل ادخار متوسط قدره {{avgRate}}% خلال الفترة.",
  "coach.trends.noHistory":
    "لا يوجد سجل كافٍ بعد لاستخلاص اتجاه موثوق — واصل تسجيل معاملاتك.",
  "coach.trends.pointAttentionTemplate":
    '"{{category}}" هي الفئة التي ارتفعت أكثر خلال الفترة (+{{trendPct}}%، بإجمالي {{total}} درهم).',
  "coach.trends.noStandoutCategory":
    "لا توجد فئة تبرز بوضوح بالارتفاع خلال الفترة المرصودة.",
  "coach.trends.recommandationBelowTarget":
    "معدل ادخارك للشهر الماضي ({{rate}}%) أقل من هدف 20% — راجع أولاً الفئة التي ارتفعت أكثر هذا الشهر.",
  "coach.trends.recommandationOnTarget":
    "معدل ادخارك الأخير ضمن الهدف: حافظ على هذه الوتيرة وراقب الفئات الأسرع ارتفاعًا.",

  "coach.diagnostic.profil": "الملف الشخصي للإنفاق",
  "coach.diagnostic.pointFort": "نقطة القوة",
  "coach.diagnostic.pointFaible": "نقطة الضعف",
  "coach.diagnostic.recommandationMonth": "توصية الشهر",
  "coach.diagnostic.scoreLabel": "درجة الصحة المالية:",
  "coach.diagnostic.profileEpargnant": "مدخر منضبط",
  "coach.diagnostic.profileEpargnantDesc":
    "تدخر/تستثمر {{pct}}% من دخلك هذا الشهر، عند مستوى قاعدة الـ20% أو أعلى منها.",
  "coach.diagnostic.profileLoisirs": "منفق على الترفيه",
  "coach.diagnostic.profileLoisirsDesc":
    'تمثل مصاريف "الرغبات" {{pct}}% من دخلك، وهو أعلى بكثير من نسبة 30% الموصى بها.',
  "coach.diagnostic.profileCharges": "أعباء ضيقة",
  "coach.diagnostic.profileChargesDesc":
    'تشكل نفقاتك الأساسية ("الاحتياجات") {{pct}}% من دخلك، وهو أعلى من نسبة 50% الموصى بها — هامش مناورة ضئيل.',
  "coach.diagnostic.profileEquilibre": "متوازن",
  "coach.diagnostic.profileEquilibreDesc":
    "يبقى توزيعك بين الاحتياجات/الرغبات/الادخار ({{needs}}% / {{wants}}% / {{savings}}%) قريبًا من قاعدة 50/30/20.",
  "coach.diagnostic.pointFortTemplate":
    "{{category}}: فقط {{pct}}% من الميزانية مستخدمة ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFort":
    "لا توجد فئة منخفضة الاستهلاك بشكل ملحوظ هذا الشهر.",
  "coach.diagnostic.pointFaibleTemplate":
    "{{category}}: بالفعل {{pct}}% من الميزانية مستخدمة ({{spent}} / {{budget}}).",
  "coach.diagnostic.noPointFaible": "لا توجد فئة تتجاوز 80% من ميزانيتها. 👍",
  "coach.diagnostic.recoPriority":
    'أولوية: "{{category}}" استهلكت بالفعل {{pct}}% من ميزانيتها ({{spent}} / {{budget}}). خفّف الإنفاق على هذه الفئة حتى نهاية الشهر.',
  "coach.diagnostic.recoEmergencyLow":
    "لا توجد فئة تجاوزت ميزانيتها هذا الشهر. ركّز الجهد على صندوق الطوارئ: فهو لا يغطي سوى {{months}} أشهر من المصاريف (الهدف: 3 أشهر على الأقل).",
  "coach.diagnostic.recoStrong":
    "لا توجد فئة تجاوزت ميزانيتها وصندوق الطوارئ متين ({{months}} أشهر). واصل على هذا النهج وفكّر في زيادة مساهماتك الاستثمارية.",
  "coach.diagnostic.aiFallbackNotice":
    "المدرب الذكي غير متاح حاليًا — تشخيص احتياطي مبني على قواعد بسيطة (عتبات على فئات ميزانيتك).",

  // الصحة
  "health.title": "الصحة",
  "health.title.sub": "تابع ميزانيتك الصحية وملفات استرداد CNSS.",
  "health.body.title": "الميزانية الصحية الشهرية",
  "health.body.of_income": "من الدخل",
  "health.body.foreseen": "المتوقع",
  "health.body.remaining": "المتبقي هذا الشهر",
  "health.body.annual_est": "الميزانية السنوية المقدرة",
  "health.body.weight_on_income": "الوزن على الدخل",
  "health.body.budget_used": "من الميزانية المستخدمة",
  "health.card2.title": "متابعة الاسترداد",
  "health.card2.sub_waiting": "قيد الانتظار",
  "health.card2.sub_cnss": "مقدّم إلى CNSS",
  "health.card2.sub_reimbursed": "تم الاسترداد",
  "health.card3.title": "اتجاه مصاريف الصحة",
  "health.card3.sub_avg1": "متوسط ",
  "health.card3.sub_avg2": "/شهر",
  "health.card5.title": "تاريخ الرعاية الصحية",
  "health.card5.table.date": "التاريخ",
  "health.card5.table.provider": "المزوّد",
  "health.card5.table.amount": "المبلغ",
  "health.card5.table.transaction": "المعاملة المرتبطة",
  "health.card5.table.cnssFile": "ملف CNSS",
  "health.card5.table.transaction.linked": "✓ مرتبطة",
  "health.card5.table.status": "الحالة",
  "health.card5.table.status.pending": "قيد الانتظار",
  "health.card5.table.status.pending.next": "قدّم إلى CNSS",
  "health.card5.table.status.submited": "مقدّم إلى CNSS",
  "health.card5.table.status.submited.next": "علّم كمسترد",
  "health.card5.table.status.reimbursed": "تم الاسترداد",
  "health.card5.table.status.rejected": "مرفوض",
  "health.card5.table.status.filecnss.close": "تم إغلاق الملف",
  "health.card6.title": "تسجيل الرعاية الصحية",
  "health.card6.form.provider": "المزوّد",
  "health.card6.form.amount": "مبلغ الرعاية الصحية",
  "health.card6.form.date": "تاريخ الرعاية الصحية",
  "health.card6.form.transaction": "إنشاء معاملة مرتبطة",
  "health.card6.form.submit": "إضافة",
};

const dictionaries: Record<Locale, Dict> = { fr, en, es, ar };

/** Recherche pure d'une clé — utilisable côté serveur ET côté client. */
export function t(locale: Locale, key: string, fallback?: string): string {
  return (
    dictionaries[locale]?.[key] ??
    dictionaries[DEFAULT_LOCALE][key] ??
    fallback ??
    key
  );
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

/** Instruction de langue à ajouter aux system prompts des routes Coach IA. */
const AI_LANGUAGE_INSTRUCTIONS: Record<Locale, string> = {
  fr: "Réponds exclusivement en français.",
  en: "Respond exclusively in English.",
  es: "Responde exclusivamente en español.",
  ar: "أجب حصراً باللغة العربية الفصحى.",
};

export function aiLanguageInstruction(locale: Locale): string {
  return (
    AI_LANGUAGE_INSTRUCTIONS[locale] ?? AI_LANGUAGE_INSTRUCTIONS[DEFAULT_LOCALE]
  );
}

/** Substitue les jetons {{clé}} d'un gabarit traduit par des valeurs dynamiques. */
export function tParams(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}
