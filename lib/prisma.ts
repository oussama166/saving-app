import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// libSQL plutôt que better-sqlite3 : un seul code path qui marche à la fois
// en local (fichier SQLite classique, comme avant) ET en production sur
// Turso (SQLite hébergé, compatible avec ce même schéma/ces mêmes
// migrations — voir DEPLOYMENT.md). better-sqlite3 exige une compilation
// native qui ne fonctionne pas sur les runtimes serverless de Vercel et n'a
// de toute façon pas de mode "hébergé" ; libSQL couvre les deux cas avec le
// même client.
//
// TURSO_DATABASE_URL absent (dev local) → on retombe sur le fichier
// dev.db, exactement comme avant. TURSO_AUTH_TOKEN n'est utilisé/nécessaire
// que pour une URL distante (libsql://...), ignoré pour un fichier local.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? 'file:./dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
