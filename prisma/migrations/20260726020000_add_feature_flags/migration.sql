-- Système d'activation/désactivation par section (voir lib/features.ts et
-- app/admin/features) : un interrupteur global par fonctionnalité + des
-- exceptions d'accès accordées à des utilisateurs précis.
CREATE TABLE "Feature" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "FeatureAccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "featureKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureAccessGrant_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "Feature" ("key") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeatureAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FeatureAccessGrant_featureKey_userId_key" ON "FeatureAccessGrant" ("featureKey", "userId");
