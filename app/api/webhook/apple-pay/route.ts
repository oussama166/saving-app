import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRefresh } from "@/lib/sse";
import { requireSession } from "@/lib/auth";

// Note : webhook déclenché depuis l'app elle-même (session navigateur) pour
// l'instant. Une vraie intégration externe (Apple Pay, banque) aurait besoin
// d'un token dédié par utilisateur plutôt que du cookie de session.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { merchant, amount, date, location } = await req.json();
    const absAmount = Math.abs(amount);

    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.account.findFirst({
        where: { userId, name: "Main Checking" },
      });

      if (!account) {
        account = await tx.account.create({
          data: { userId, name: "Main Checking", type: "checking", balance: 0 },
        });
      }

      let category = await tx.category.findFirst({
        where: { userId, name: "Uncategorized" },
      });

      if (!category) {
        category = await tx.category.create({
          data: { userId, name: "Uncategorized", type: "expense" },
        });
      }

      const savingsGoals = await tx.savingsGoal.findMany({ where: { userId } });
      const totalSavingsLocked = savingsGoals.reduce(
        (acc, goal) => acc + goal.currentAmount,
        0,
      );
      const safeToSpend = account.balance - totalSavingsLocked;

      const isRejected = safeToSpend - absAmount < 0;

      const expenseAmount = absAmount * -1;
      const merchantName = isRejected
        ? `[REJECTED/OVER BUDGET] ${merchant}`
        : merchant;
      const locationUser = location || null;
      console.log(
        `Apple Pay Webhook: Merchant: ${merchantName}, Amount: ${expenseAmount}, Date: ${date}, Location: ${locationUser}, Safe to Spend: ${safeToSpend}, Rejected: ${isRejected}`,
      );

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: category.id,
          merchant: merchantName,
          amount: expenseAmount,
          date: new Date(date),
        },
      });

      if (!isRejected) {
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { decrement: absAmount } },
        });
      }

      return { transaction, isRejected };
    });

    if (result.isRejected) {
      notifyRefresh();
      return NextResponse.json(
        {
          error:
            "Transaction logged but rejected: Exceeds Safe to Spend limit.",
          transaction: result.transaction,
        },
        { status: 403 },
      );
    }

    notifyRefresh();
    return NextResponse.json({
      success: true,
      transaction: result.transaction,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error("Apple Pay Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
