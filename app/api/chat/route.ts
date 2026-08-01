import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { coachModel } from "@/lib/aiProvider";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getHouseholdContext } from "@/lib/household";
import { requireFeatureAccess } from "@/lib/features";
import { getRatesToMad } from "@/lib/exchangeRates";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await requireSession();
  await requireFeatureAccess("coach", userId);
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const ctx = await getHouseholdContext(userId);

  // 1. Gather the user's complete financial state from the database. Avant,
  // seul le compte nommé EXACTEMENT "Main Checking" était pris en compte —
  // les foyers avec plusieurs comptes (courant + épargne + autres devises)
  // avaient un agent qui ignorait la majorité de leur argent réel.
  const [accounts, savingsGoals, portfolioAssets, recentTransactions] = await Promise.all([
    prisma.account.findMany({ where: { userId: { in: ctx.memberIds } } }),
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

  // 2. Convertit chaque solde de compte en MAD avant de sommer — un compte
  // en EUR ou USD faussait "safeToSpend" en étant additionné tel quel.
  const rates = await getRatesToMad(accounts.map((a) => a.currency));
  const totalBalanceMad = accounts.reduce((acc, a) => acc + a.balance * (rates[a.currency] ?? 1), 0);
  const totalSavingsLocked = savingsGoals.reduce((acc, goal) => acc + goal.currentAmount, 0);
  const safeToSpend = totalBalanceMad - totalSavingsLocked;

  // 3. Format data for the prompt
  const accountsList = accounts
    .map((a) => `- ${a.name}: ${a.balance.toFixed(2)} ${a.currency}${a.currency !== "MAD" ? ` (≈ ${(a.balance * (rates[a.currency] ?? 1)).toFixed(2)} MAD)` : ""}`)
    .join("\n");

  const savingsGoalsList = savingsGoals
    .map((g) => `- ${g.name}: ${g.currentAmount} / ${g.targetAmount} (Alloc: ${g.autoAllocatePct}%)`)
    .join("\n");

  const portfolioList = portfolioAssets
    .map((p) => `- ${p.tickerSymbol}: ${p.sharesOwned} shares @ avg ${p.averageBuyPrice} (${p.account.name})`)
    .join("\n");

  const transactionList = recentTransactions
    .map((t) => `- ${t.date.toISOString().split("T")[0]} | ${t.merchant}: ${t.amount} MAD (${t.category.name})`)
    .join("\n");

  // 4. Construct the detailed system prompt
  const systemPrompt = `You are an elite, brutally honest wealth management strategist and financial advisor. Your goal is to maximize the user's net worth and enforce strict budget discipline.

USER'S LIVE FINANCIAL STATE (all figures in MAD — Moroccan Dirham):
- TOTAL BALANCE (all accounts combined): ${totalBalanceMad.toFixed(2)} MAD
- SAFE TO SPEND: ${safeToSpend.toFixed(2)} MAD (Calculated: Total balance - Locked savings)
- TOTAL SAVINGS LOCKED: ${totalSavingsLocked.toFixed(2)} MAD

ACCOUNTS:
${accountsList || "No accounts found."}

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

  // 5. Persiste le message utilisateur (le dernier de la liste envoyée par
  // useChat, qui renvoie systématiquement l'historique complet) — avant, la
  // conversation entière était perdue à chaque rechargement de page.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await prisma.agentChatMessage.create({
      data: { userId, role: "user", parts: JSON.stringify(lastMessage.parts) },
    });
  }

  // 6. Call the AI with the dynamic context
  const result = streamText({
    model: coachModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    onFinish: async ({ text }) => {
      if (text) {
        await prisma.agentChatMessage.create({
          data: { userId, role: "assistant", parts: JSON.stringify([{ type: "text", text }]) },
        });
      }
    },
  });

  // 7. Return the streamed response
  return result.toUIMessageStreamResponse();
}
