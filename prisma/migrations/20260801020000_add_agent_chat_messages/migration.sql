-- Historique persistant du chat flottant (FinanceAgent) — voir
-- app/components/FinanceAgent.tsx, app/api/chat/route.ts et
-- app/api/chat/history/route.ts.
CREATE TABLE "AgentChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AgentChatMessage_userId_createdAt_idx" ON "AgentChatMessage"("userId", "createdAt");
