import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getHouseholdContext } from "@/lib/household";
import { requireFeatureAccess } from "@/lib/features";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await requireSession();
  await requireFeatureAccess("coach", userId);
  const { messages } = await req.json();
  const ctx = await getHouseholdContext(userId);

  // 1. Gather the user's complete financial state from the database
  const [checkingAccount, savingsGoals, portfolioAssets, recentTransactions] =
    await Promise.all([
      prisma.account.findFirst({
        where: { userId: { in: ctx.memberIds }, name: "Main Checking" },
      }),
      prisma.savingsGoal.findMany({ where: { userId: { in: ctx.memberIds } } }),
      prisma.portfolioAsset.findMany({
        where: { userId: { in: ctx.memberIds } },
        include: {
          account: { select: { name: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds } },
        take: 10,
        orderBy: { date: "desc" },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      }),
    ]);

  // 2. Calculate key metrics
  const checkingBalance = checkingAccount?.balance || 0;
  const totalSavingsLocked = savingsGoals.reduce(
    (acc, goal) => acc + goal.currentAmount,
    0,
  );
  const safeToSpend = checkingBalance - totalSavingsLocked;

  // 3. Format data for the prompt
  const savingsGoalsList = savingsGoals
    .map(
      (g) =>
        `- ${g.name}: ${g.currentAmount} / ${g.targetAmount} (Alloc: ${g.autoAllocatePct}%)`,
    )
    .join("n");

  const portfolioList = portfolioAssets
    .map(
      (p) =>
        `- ${p.tickerSymbol}: ${p.sharesOwned} shares @ avg ${p.averageBuyPrice} (${p.account.name})`,
    )
    .join("n");

  const transactionList = recentTransactions
    .map(
      (t) =>
        `- ${t.date.toISOString().split("T")[0]} | ${t.merchant}: ${t.amount} (${t.category.name})`,
    )
    .join("n");

  // 4. Construct the detailed system prompt
  const systemPrompt = `You are an elite, brutally honest wealth management strategist and financial advisor. Your goal is to maximize the user's net worth and enforce strict budget discipline.

USER'S LIVE FINANCIAL STATE:
- MAIN CHECKING BALANCE: ${checkingBalance.toFixed(2)} EUR
- SAFE TO SPEND: ${safeToSpend.toFixed(2)} EUR (Calculated: Checking - Locked Savings)
- TOTAL SAVINGS LOCKED: ${totalSavingsLocked.toFixed(2)} EUR

ACTIVE SAVINGS GOALS:
${savingsGoalsList || "No active goals."}

INVESTMENT PORTFOLIO:
${portfolioList || "No assets found."}

RECENT TRANSACTIONS (LAST 10):
${transactionList || "No recent transactions."}

GUIDELINES:
1. Be direct. If the user is overspending, tell them.
2. If "Safe to Spend" is low or negative, prioritize debt reduction and stopping all non-essential expenses.
3. Use the live data provided above to back your advice with real numbers.
4. Give specific advice based on the recent transactions and savings progress.
5. If the user asks about their balance or spending, refer to the "Safe to Spend" metric as the true source of truth.
6. Your tone is professional, sophisticated, and slightly authoritative.

Always provide mathematically sound financial logic.`;

  // 5. Call the AI with the dynamic context
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  // 6. Return the streamed response
  return result.toUIMessageStreamResponse();
}
