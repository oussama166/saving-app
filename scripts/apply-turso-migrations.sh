#!/usr/bin/env bash
# Applique toutes les migrations Prisma (prisma/migrations/*/migration.sql)
# dans l'ordre sur une base Turso, via `turso db shell`. Prisma Migrate
# n'est pas supporté directement contre Turso (voir DEPLOYMENT.md) — c'est
# le workflow officiel recommandé par Turso : appliquer le SQL brut.
#
# Usage :
#   ./scripts/apply-turso-migrations.sh <nom-de-la-base-turso>
#
# Idempotent seulement si tu ne l'as jamais lancé sur cette base : relancer
# sur une base qui a déjà les migrations échouera sur les CREATE TABLE / ADD
# COLUMN déjà présents (comportement attendu — évite d'appliquer deux fois
# par erreur). Pour une nouvelle base vide, lance-le une seule fois.

set -euo pipefail

DB_NAME="${1:-}"
if [ -z "$DB_NAME" ]; then
  echo "Usage: $0 <nom-de-la-base-turso>" >&2
  exit 1
fi

if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI introuvable. Installe-le : curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/../prisma/migrations"

for dir in $(ls "$MIGRATIONS_DIR" | sort); do
  file="$MIGRATIONS_DIR/$dir/migration.sql"
  if [ -f "$file" ]; then
    echo "→ Applique $dir..."
    turso db shell "$DB_NAME" < "$file"
  fi
done

echo "✓ Toutes les migrations ont été appliquées sur '$DB_NAME'."
