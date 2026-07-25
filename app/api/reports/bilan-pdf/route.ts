import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getUserSettings, getEmergencyFundBalance } from "@/lib/financials";
import { getEnrichedPortfolioAssets } from "@/lib/portfolio";
import { computeZakatableWealth } from "@/lib/zakat";

// Runtime Node explicite : pdfkit utilise des API Node (Buffer, streams,
// fs pour ses fichiers de polices) incompatibles avec le runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAD = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`;

/**
 * Version PDF condensée du bilan (voir /api/reports/bilan pour l'export
 * Excel complet avec tout l'historique de transactions) — pensée pour être
 * imprimée ou partagée en une page : KPIs du mois, budget par catégorie,
 * patrimoine net. Pas de liste de transactions (c'est le rôle du .xlsx).
 */
export async function GET() {
  try {
    const { userId } = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
    }

    const { referenceIncome } = await getUserSettings(userId);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [categories, monthTransactions, savingsGoals, portfolio, emergencyFundBalance, accounts, zakat] =
      await Promise.all([
        prisma.category.findMany({ where: { userId }, orderBy: { order: "asc" } }),
        prisma.transaction.findMany({ where: { userId, date: { gte: firstDayOfMonth } }, include: { category: true } }),
        prisma.savingsGoal.findMany({ where: { userId } }),
        getEnrichedPortfolioAssets(userId),
        getEmergencyFundBalance(userId),
        prisma.account.findMany({ where: { userId } }),
        computeZakatableWealth(userId),
      ]);

    let income = 0;
    let expenses = 0;
    let savingsMoved = 0;
    const spentByCategoryId = new Map<string, number>();
    for (const tx of monthTransactions) {
      if (tx.category.type === "income") {
        income += tx.amount;
      } else if (tx.category.type === "savings") {
        savingsMoved += Math.abs(tx.amount);
        spentByCategoryId.set(tx.categoryId, (spentByCategoryId.get(tx.categoryId) ?? 0) + Math.abs(tx.amount));
      } else {
        expenses += Math.abs(tx.amount);
        spentByCategoryId.set(tx.categoryId, (spentByCategoryId.get(tx.categoryId) ?? 0) + Math.abs(tx.amount));
      }
    }
    const effectiveIncome = income > 0 ? income : referenceIncome;
    const cashFlow = income - expenses - savingsMoved;
    const totalChecking = accounts.filter((a) => a.type === "checking").reduce((acc, a) => acc + a.balance, 0);
    const totalGoalsSaved = savingsGoals.reduce((acc, g) => acc + g.currentAmount, 0);
    const netWorth = totalChecking + emergencyFundBalance + totalGoalsSaved + portfolio.globalLiveValue - zakat.totalDebts;

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const BLUE = "#2563eb";
    const INK = "#0f172a";
    const SUBTLE = "#64748b";
    const RED = "#ef4444";
    const GREEN = "#10b981";

    doc.fontSize(20).fillColor(INK).font("Helvetica-Bold").text("Bilan Financier", { continued: false });
    doc
      .fontSize(10)
      .fillColor(SUBTLE)
      .font("Helvetica")
      .text(`${user.name || user.email} — généré le ${now.toLocaleDateString("fr-FR")}`);
    doc.moveDown(1);

    doc
      .fontSize(13)
      .fillColor(BLUE)
      .font("Helvetica-Bold")
      .text(`Mois en cours : ${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`);
    doc.moveDown(0.5);

    const kpis: [string, string, string?][] = [
      ["Revenu du mois", MAD(effectiveIncome)],
      ["Dépenses du mois", MAD(expenses)],
      ["Épargne / investissement", MAD(savingsMoved)],
      ["Cash-flow net", MAD(cashFlow), cashFlow >= 0 ? GREEN : RED],
      ["Fonds d'urgence", MAD(emergencyFundBalance)],
      ["Valeur du portefeuille", MAD(portfolio.globalLiveValue)],
    ];
    doc.font("Helvetica").fontSize(11);
    for (const [label, value, color] of kpis) {
      doc
        .fillColor(INK)
        .text(label, { continued: true, width: 300 })
        .fillColor(color ?? INK)
        .text(`  ${value}`, { align: "right" });
    }
    doc.moveDown(1);

    doc.fontSize(13).fillColor(BLUE).font("Helvetica-Bold").text("Budget par catégorie");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(SUBTLE);
    const colX = [48, 220, 320, 400, 480];
    doc.text("Catégorie", colX[0], doc.y, { width: 170, continued: false });
    doc.text("Budget", colX[1], doc.y - 11, { width: 90 });
    doc.text("Dépensé", colX[2], doc.y - 11, { width: 70 });
    doc.text("Restant", colX[3], doc.y - 11, { width: 70 });
    doc.text("Utilisé", colX[4], doc.y - 11, { width: 60 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    for (const cat of categories) {
      if (cat.type === "income") continue;
      const spent = spentByCategoryId.get(cat.id) ?? 0;
      const budget = (cat.budgetPct / 100) * referenceIncome;
      const remaining = budget - spent;
      const usedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const rowY = doc.y;
      doc.fillColor(INK).text(cat.name, colX[0], rowY, { width: 170 });
      doc.fillColor(SUBTLE).text(MAD(budget), colX[1], rowY, { width: 90 });
      doc.fillColor(SUBTLE).text(MAD(spent), colX[2], rowY, { width: 70 });
      doc.fillColor(remaining >= 0 ? GREEN : RED).text(MAD(remaining), colX[3], rowY, { width: 70 });
      doc.fillColor(usedPct > 100 ? RED : SUBTLE).text(`${usedPct}%`, colX[4], rowY, { width: 60 });
      doc.moveDown(0.4);
      if (doc.y > 750) doc.addPage();
    }

    doc.moveDown(1);
    doc.fontSize(13).fillColor(BLUE).font("Helvetica-Bold").text("Patrimoine net");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    const netRows: [string, string, string?][] = [
      ["Compte(s) courant(s)", MAD(totalChecking)],
      ["Fonds d'urgence", MAD(emergencyFundBalance)],
      ["Objectifs d'épargne (épargné)", MAD(totalGoalsSaved)],
      ["Portefeuille d'investissement", MAD(portfolio.globalLiveValue)],
      ["Dettes actives", `− ${MAD(zakat.totalDebts)}`, RED],
    ];
    for (const [label, value, color] of netRows) {
      doc
        .fillColor(INK)
        .text(label, { continued: true, width: 300 })
        .fillColor(color ?? INK)
        .text(`  ${value}`, { align: "right" });
    }
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(INK)
      .text("Patrimoine net total", { continued: true, width: 300 })
      .fillColor(BLUE)
      .text(`  ${MAD(netWorth)}`, { align: "right" });

    doc.end();
    const buffer = await done;
    const fileName = `bilan-financier-${now.toISOString().slice(0, 10)}.pdf`;

    // NextResponse/Response n'acceptent pas directement un Buffer Node dans
    // les types DOM (BodyInit) — Uint8Array est un sur-type compatible et ne
    // copie pas les données (Buffer EST déjà un Uint8Array en mémoire).
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    console.error("Bilan PDF Generation Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
