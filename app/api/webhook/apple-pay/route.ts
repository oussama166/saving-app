import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRefresh } from "@/lib/sse";

export async function POST(req: Request) {
  try {
    const { merchant, amount, date, location } = await req.json();
    const absAmount = Math.abs(amount);

    // Use a transaction to ensure consistent reads and atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create "Main Checking" account
      let account = await tx.account.findFirst({
        where: { name: "Main Checking" },
      });

      if (!account) {
        account = await tx.account.create({
          data: { name: "Main Checking", type: "checking", balance: 0 },
        });
      }

      // 2. Find or create "Uncategorized" category
      let category = await tx.category.findFirst({
        where: { name: "Uncategorized" },
      });

      if (!category) {
        category = await tx.category.create({
          data: { name: "Uncategorized", type: "expense" },
        });
      }

      // 3. Calculate "Safe to Spend"
      // Safe to Spend = Checking Balance - Sum of all Savings Goals
      const savingsGoals = await tx.savingsGoal.findMany();
      const totalSavingsLocked = savingsGoals.reduce(
        (acc, goal) => acc + goal.currentAmount,
        0,
      );
      const safeToSpend = account.balance - totalSavingsLocked;

      // Rule: cannot spend if it drops safeToSpend below 0
      const isRejected = safeToSpend - absAmount < 0;

      const expenseAmount = absAmount * -1;
      const merchantName = isRejected
        ? `[REJECTED/OVER BUDGET] ${merchant}`
        : merchant;
      const locationUser = location || null;
      console.log(
        `Apple Pay Webhook: Merchant: ${merchantName}, Amount: ${expenseAmount}, Date: ${date}, Location: ${locationUser}, Safe to Spend: ${safeToSpend}, Rejected: ${isRejected}`,
      );

      // 4. Create Transaction record (always logged)
      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          categoryId: category.id,
          merchant: merchantName,
          amount: expenseAmount,
          date: new Date(date),
        },
      });

      // 5. Update account balance only if NOT rejected
      if (!isRejected) {
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { decrement: absAmount } },
        });
      }

      return { transaction, isRejected };
    });

    if (result.isRejected) {
      // Still notify refresh as a transaction was logged (rejected)
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
    console.error("Apple Pay Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
