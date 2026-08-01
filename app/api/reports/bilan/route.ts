import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  getUserSettings,
  getMonthlyAnalytics,
  getEmergencyFundBalance,
} from "@/lib/financials";
import { getEnrichedPortfolioAssets } from "@/lib/portfolio";
import { getHouseholdContext } from "@/lib/household";
import { getRatesToMad } from "@/lib/exchangeRates";
import { requireFeatureAccess } from "@/lib/features";
import { resolveBudgetCycleStart } from "@/lib/budgetCycle";

export const dynamic = "force-dynamic";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1B253B" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
};
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14 };
const MAD_FORMAT = '#,##0.00 "MAD"';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  row.height = 20;
}

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess("profile.export_excel", userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Utilisateur introuvable" },
        { status: 404 },
      );
    }

    const ctx = await getHouseholdContext(userId);
    const { referenceIncome } = await getUserSettings(ctx);

    const now = new Date();
    const firstDayOfMonth = await resolveBudgetCycleStart(ctx, now);

    const [
      categories,
      monthTransactions,
      allTransactions,
      savingsGoals,
      portfolio,
      emergencyFundBalance,
      monthlyAnalytics,
      accounts,
    ] = await Promise.all([
      prisma.category.findMany({
        where: { userId: ctx.budgetOwnerId },
        orderBy: { order: "asc" },
      }),
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds }, date: { gte: firstDayOfMonth } },
        include: { category: true, account: { select: { currency: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds } },
        include: { category: true, account: true },
        orderBy: { date: "desc" },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: { in: ctx.memberIds } },
        orderBy: { createdAt: "asc" },
      }),
      getEnrichedPortfolioAssets(ctx),
      getEmergencyFundBalance(ctx),
      getMonthlyAnalytics(ctx, 12),
      prisma.account.findMany({ where: { userId: { in: ctx.memberIds } }, orderBy: { name: "asc" } }),
    ]);

    // ---- Calculs résumé mensuel ----
    const fxRates = await getRatesToMad([
      ...monthTransactions.map((tx) => tx.account.currency),
      ...accounts.map((a) => a.currency),
    ]);

    let income = 0;
    let expenses = 0;
    let savingsMoved = 0;
    const spentByCategoryId = new Map<string, number>();

    for (const tx of monthTransactions) {
      // "transfer" (virement entre comptes du foyer) est neutre — ni revenu,
      // ni dépense, ni épargne, voir lib/transferEngine.ts.
      if (tx.category.type === "transfer") continue;
      const amount = tx.amount * (fxRates[tx.account.currency] ?? 1);
      if (tx.category.type === "income") {
        income += amount;
      } else if (tx.category.type === "savings") {
        savingsMoved += Math.abs(amount);
        spentByCategoryId.set(
          tx.categoryId,
          (spentByCategoryId.get(tx.categoryId) ?? 0) + Math.abs(amount),
        );
      } else {
        expenses += Math.abs(amount);
        spentByCategoryId.set(
          tx.categoryId,
          (spentByCategoryId.get(tx.categoryId) ?? 0) + Math.abs(amount),
        );
      }
    }

    const cashFlow = income - expenses - savingsMoved;
    const effectiveIncome = income > 0 ? income : referenceIncome;

    const totalChecking = accounts
      .filter((a) => a.type === "checking")
      .reduce((acc, a) => acc + a.balance * (fxRates[a.currency] ?? 1), 0);
    const totalGoalsSaved = savingsGoals.reduce(
      (acc, g) => acc + g.currentAmount,
      0,
    );
    const totalGoalsTarget = savingsGoals.reduce(
      (acc, g) => acc + g.targetAmount,
      0,
    );

    // ---- Workbook ----
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tanger Wealth OS";
    workbook.created = now;

    // ===== Feuille 1 : Résumé mensuel + budget =====
    const sheet1 = workbook.addWorksheet("Résumé & Budget");
    sheet1.columns = [
      { width: 32 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
    ];

    sheet1.mergeCells("A1:E1");
    sheet1.getCell("A1").value = `Bilan Financier — ${user.name || user.email}`;
    sheet1.getCell("A1").font = TITLE_FONT;
    sheet1.getCell("A2").value =
      `Généré le ${now.toLocaleDateString("fr-FR")} · Mois en cours : ${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
    sheet1.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

    sheet1.addRow([]);
    const kpiHeaderRow = sheet1.addRow(["Indicateur", "Valeur"]);
    styleHeaderRow(kpiHeaderRow);
    const kpiRows: [string, number][] = [
      ["Revenu du mois", effectiveIncome],
      ["Dépenses du mois", expenses],
      ["Épargne / Investissement déplacé", savingsMoved],
      ["Cash-flow net", cashFlow],
      [
        "Taux d'épargne (%)",
        effectiveIncome > 0
          ? Math.round((savingsMoved / effectiveIncome) * 1000) / 10
          : 0,
      ],
      ["Solde compte courant", totalChecking],
      ["Fonds d'urgence", emergencyFundBalance],
      ["Valeur du portefeuille", portfolio.globalLiveValue],
    ];
    for (const [label, value] of kpiRows) {
      const r = sheet1.addRow([label, value]);
      const isPct = label.includes("%");
      r.getCell(2).numFmt = isPct ? '0.0"%"' : MAD_FORMAT;
    }

    sheet1.addRow([]);
    const budgetTitleRow = sheet1.addRow([
      "Détail budgétaire par catégorie (mois en cours)",
    ]);
    budgetTitleRow.getCell(1).font = { bold: true, size: 12 };
    const budgetHeaderRow = sheet1.addRow([
      "Catégorie",
      "Type",
      "Allocation cible (%)",
      "Budget prévu",
      "Dépensé réel",
      "Restant",
      "Utilisé (%)",
    ]);
    sheet1.getColumn(6).width = 14;
    sheet1.getColumn(7).width = 14;
    styleHeaderRow(budgetHeaderRow);

    for (const cat of categories) {
      if (cat.type === "income") continue;
      const spent = spentByCategoryId.get(cat.id) ?? 0;
      const budget = (cat.budgetPct / 100) * referenceIncome;
      const remaining = budget - spent;
      const usedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const typeLabel = cat.type === "savings" ? "Épargne" : "Dépense";
      const row = sheet1.addRow([
        cat.name,
        typeLabel,
        cat.budgetPct,
        Math.round(budget * 100) / 100,
        Math.round(spent * 100) / 100,
        Math.round(remaining * 100) / 100,
        usedPct,
      ]);
      row.getCell(3).numFmt = '0.0"%"';
      row.getCell(4).numFmt = MAD_FORMAT;
      row.getCell(5).numFmt = MAD_FORMAT;
      row.getCell(6).numFmt = MAD_FORMAT;
      row.getCell(7).numFmt = '0"%"';
      if (usedPct > 100) {
        row.getCell(7).font = { color: { argb: "FFEF4444" }, bold: true };
      }
    }

    sheet1.addRow([]);
    const historyTitleRow = sheet1.addRow([
      "Historique mensuel (12 derniers mois)",
    ]);
    historyTitleRow.getCell(1).font = { bold: true, size: 12 };
    const historyHeaderRow = sheet1.addRow([
      "Mois",
      "Revenu",
      "Dépenses",
      "Épargne",
      "Taux d'épargne (%)",
    ]);
    styleHeaderRow(historyHeaderRow);
    for (const m of monthlyAnalytics) {
      const row = sheet1.addRow([
        m.label,
        m.income,
        m.expenses,
        m.savings,
        m.savingsRatePct,
      ]);
      row.getCell(2).numFmt = MAD_FORMAT;
      row.getCell(3).numFmt = MAD_FORMAT;
      row.getCell(4).numFmt = MAD_FORMAT;
      row.getCell(5).numFmt = '0.0"%"';
    }

    // ===== Feuille 2 : Historique complet des transactions =====
    const sheet2 = workbook.addWorksheet("Transactions");
    sheet2.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Marchand / Libellé", key: "merchant", width: 32 },
      { header: "Catégorie", key: "category", width: 24 },
      { header: "Sous-catégorie", key: "subCategory", width: 20 },
      { header: "Compte", key: "account", width: 18 },
      { header: "Moyen de paiement", key: "paymentMethod", width: 18 },
      { header: "Montant", key: "amount", width: 16 },
      { header: "Devise", key: "currency", width: 10 },
      { header: "Type", key: "type", width: 12 },
    ];
    styleHeaderRow(sheet2.getRow(1));

    for (const tx of allTransactions) {
      // Montant affiché dans la devise NATIVE du compte (pas converti) —
      // colonne "Devise" ajoutée pour lever toute ambiguïté sur un compte en
      // devise étrangère, voir lib/exchangeRates.ts pour la conversion MAD
      // utilisée uniquement dans les totaux agrégés ci-dessus.
      const row = sheet2.addRow({
        date: tx.date.toLocaleDateString("fr-FR"),
        merchant: tx.merchant,
        category: tx.category.name,
        subCategory: tx.subCategory ?? "",
        account: tx.account.name,
        paymentMethod: tx.paymentMethod ?? "",
        amount: tx.amount,
        currency: tx.account.currency,
        type:
          tx.category.type === "income"
            ? "Revenu"
            : tx.category.type === "savings"
              ? "Épargne"
              : "Dépense",
      });
      row.getCell("amount").numFmt = '#,##0.00';
      if (tx.amount < 0)
        row.getCell("amount").font = { color: { argb: "FFEF4444" } };
      else row.getCell("amount").font = { color: { argb: "FF10B981" } };
    }
    sheet2.autoFilter = { from: "A1", to: `I${allTransactions.length + 1}` };

    // ===== Feuille 3 : Patrimoine (Portfolio + Objectifs + Fonds d'urgence) =====
    const sheet3 = workbook.addWorksheet("Patrimoine");
    sheet3.columns = [
      { width: 30 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
    ];

    sheet3.mergeCells("A1:E1");
    sheet3.getCell("A1").value = "Patrimoine Global";
    sheet3.getCell("A1").font = TITLE_FONT;

    sheet3.addRow([]);
    const netWorthHeaderRow = sheet3.addRow(["Composante", "Valeur"]);
    styleHeaderRow(netWorthHeaderRow);
    const netWorthRows: [string, number][] = [
      ["Compte(s) courant(s)", totalChecking],
      ["Fonds d'urgence", emergencyFundBalance],
      ["Objectifs d'épargne (épargné)", totalGoalsSaved],
      [
        "Portefeuille d'investissement (valeur live)",
        portfolio.globalLiveValue,
      ],
    ];
    const totalNetWorth = netWorthRows.reduce((acc, [, v]) => acc + v, 0);
    for (const [label, value] of netWorthRows) {
      const r = sheet3.addRow([label, value]);
      r.getCell(2).numFmt = MAD_FORMAT;
    }
    const totalRow = sheet3.addRow(["Patrimoine net total", totalNetWorth]);
    totalRow.font = { bold: true };
    totalRow.getCell(2).numFmt = MAD_FORMAT;

    const targetRow = sheet3.addRow([
      "Objectifs d'épargne — cible totale (info)",
      totalGoalsTarget,
    ]);
    targetRow.font = { italic: true, color: { argb: "FF64748B" } };
    targetRow.getCell(2).numFmt = MAD_FORMAT;

    sheet3.addRow([]);
    const portfolioTitleRow = sheet3.addRow([
      "Portefeuille d'investissement — détail",
    ]);
    portfolioTitleRow.getCell(1).font = { bold: true, size: 12 };
    const portfolioHeaderRow = sheet3.addRow([
      "Actif",
      "Type",
      "Compte",
      "Parts",
      "Prix moyen d'achat",
      "Prix actuel",
      "Coût total",
      "Valeur actuelle",
      "Plus/moins-value",
      "Plus/moins-value (%)",
    ]);
    sheet3.getColumn(6).width = 16;
    sheet3.getColumn(7).width = 16;
    sheet3.getColumn(8).width = 16;
    sheet3.getColumn(9).width = 16;
    sheet3.getColumn(10).width = 16;
    styleHeaderRow(portfolioHeaderRow);

    for (const asset of portfolio.enrichedAssets) {
      const row = sheet3.addRow([
        asset.tickerSymbol,
        asset.assetType,
        asset.account.name,
        asset.sharesOwned,
        asset.averageBuyPrice,
        asset.livePrice,
        asset.costBasis,
        asset.liveValue,
        asset.profitAmount,
        Math.round(asset.profitPercentage * 10) / 10,
      ]);
      row.getCell(5).numFmt = MAD_FORMAT;
      row.getCell(6).numFmt = MAD_FORMAT;
      row.getCell(7).numFmt = MAD_FORMAT;
      row.getCell(8).numFmt = MAD_FORMAT;
      row.getCell(9).numFmt = MAD_FORMAT;
      row.getCell(10).numFmt = '0.0"%"';
      const profitCell = row.getCell(9);
      profitCell.font = {
        color: { argb: asset.profitAmount >= 0 ? "FF10B981" : "FFEF4444" },
      };
    }

    sheet3.addRow([]);
    const goalsTitleRow = sheet3.addRow(["Objectifs d'épargne"]);
    goalsTitleRow.getCell(1).font = { bold: true, size: 12 };
    const goalsHeaderRow = sheet3.addRow([
      "Objectif",
      "Épargné",
      "Cible",
      "Progression (%)",
      "Contribution mensuelle",
    ]);
    styleHeaderRow(goalsHeaderRow);
    for (const goal of savingsGoals) {
      const progressPct =
        goal.targetAmount > 0
          ? Math.round((goal.currentAmount / goal.targetAmount) * 1000) / 10
          : 0;
      const row = sheet3.addRow([
        `${goal.emoji ?? ""} ${goal.name}`.trim(),
        goal.currentAmount,
        goal.targetAmount,
        progressPct,
        goal.monthlyContribution,
      ]);
      row.getCell(2).numFmt = MAD_FORMAT;
      row.getCell(3).numFmt = MAD_FORMAT;
      row.getCell(4).numFmt = '0.0"%"';
      row.getCell(5).numFmt = MAD_FORMAT;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `bilan-financier-${now.toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === "FEATURE_DISABLED") {
      return NextResponse.json(
        { success: false, error: "Cette fonctionnalité est temporairement désactivée." },
        { status: 403 },
      );
    }
    console.error("Bilan Excel Generation Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
