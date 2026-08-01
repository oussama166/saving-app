import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import type { AgentChatMessage } from "@prisma/client";

// Historique persistant du chat flottant (FinanceAgent) — voir
// app/components/FinanceAgent.tsx (hydrate useChat({ messages }) au montage)
// et app/api/chat/route.ts (écriture des messages). Sans cette route, la
// conversation était perdue à chaque rechargement de page.
const HISTORY_LIMIT = 50;

export async function GET() {
  try {
    const { userId } = await requireSession();

    const rows = await prisma.agentChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });

    // Renvoyés du plus ancien au plus récent, au format UIMessage attendu par
    // useChat({ messages }) côté client.
    const messages = rows
      .reverse()
      .map((row: AgentChatMessage) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        parts: JSON.parse(row.parts),
      }));

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    console.error("Chat History Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
