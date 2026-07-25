import { prisma } from './lib/prisma';
console.log("resolved TURSO_DATABASE_URL env var:", process.env.TURSO_DATABASE_URL);
console.log("prisma client constructed:", !!prisma);
