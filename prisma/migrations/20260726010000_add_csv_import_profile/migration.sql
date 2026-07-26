-- Mémorisation du mapping de colonnes CSV par format de banque déjà vu —
-- voir lib/csvImport.ts et prisma/schema.prisma (CsvImportProfile).
CREATE TABLE "CsvImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "bankLabel" TEXT,
    "delimiter" TEXT NOT NULL,
    "hasHeaderRow" BOOLEAN NOT NULL DEFAULT true,
    "dateIdx" INTEGER NOT NULL,
    "merchantIdx" INTEGER NOT NULL,
    "amountIdx" INTEGER NOT NULL,
    "debitIdx" INTEGER NOT NULL,
    "creditIdx" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CsvImportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CsvImportProfile_userId_headerSignature_key" ON "CsvImportProfile" ("userId", "headerSignature");
