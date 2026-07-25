-- Authentification à deux facteurs (TOTP) — voir prisma/schema.prisma
-- (User.twoFactorSecret/twoFactorEnabled/twoFactorRecoveryCodes) et
-- lib/twoFactor.ts pour le détail.
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT;
