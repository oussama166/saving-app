-- Ajout d'un token de webhook dédié par utilisateur, pour authentifier les
-- appels externes (iOS Shortcut Apple Pay/Salaire) via un header
-- `Authorization: Bearer <token>` plutôt que le cookie de session navigateur.
ALTER TABLE "User" ADD COLUMN "webhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_webhookToken_key" ON "User"("webhookToken");
