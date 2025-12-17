#!/bin/bash
# ============================================
# Script de Limpieza de Git Tracking
# Remueve archivos generados del índice de git
# SIN borrar los archivos físicos
# ============================================

set -e  # Exit on error

echo "🧹 Iniciando limpieza de git tracking..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api

# ========== PASO 1: Verificación ==========
echo "📋 Archivos actualmente trackeados que deberían ignorarse:"
echo ""
git ls-files | grep -E "backups/.*\.(sql|gz)|logs/.*\.log" || echo "  ✅ No hay archivos de backups/logs en tracking"
echo ""

# ========== PASO 2: Confirmación ==========
echo "${YELLOW}⚠️  ADVERTENCIA:${NC}"
echo "  - Los archivos NO se borrarán del disco"
echo "  - Solo se removerán del tracking de git"
echo "  - backups/README.md se mantendrá (es documentación)"
echo ""
read -p "¿Continuar? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "${RED}❌ Operación cancelada${NC}"
    exit 1
fi

# ========== PASO 3: Limpieza ==========
echo ""
echo "🔧 Removiendo del tracking..."

# Remover backups .sql.gz (mantener README.md)
if git ls-files | grep -q "backups/mysql/.*\.sql\.gz"; then
    echo "  → Removiendo backups .sql.gz..."
    git ls-files | grep "backups/mysql/.*\.sql\.gz" | xargs git rm --cached
else
    echo "  ✅ No hay backups .sql.gz en tracking"
fi

# Remover logs
if git ls-files | grep -q "logs/.*\.log"; then
    echo "  → Removiendo logs..."
    git ls-files | grep "logs/.*\.log" | xargs git rm --cached
else
    echo "  ✅ No hay logs en tracking"
fi

# Remover otros .sql que no sean de db/
if git ls-files | grep -q "backups/.*\.sql$"; then
    echo "  → Removiendo otros .sql en backups..."
    git ls-files | grep "backups/.*\.sql$" | xargs git rm --cached
else
    echo "  ✅ No hay otros .sql en tracking"
fi

echo ""
echo "${GREEN}✅ Limpieza completada!${NC}"
echo ""

# ========== PASO 4: Status ==========
echo "📊 Estado actual de git:"
git status --short

echo ""
echo "📝 Próximos pasos:"
echo "  1. Revisar los cambios: git status"
echo "  2. Hacer commit: git add .gitignore && git commit -m 'chore: ignore generated files (backups, logs)'"
echo "  3. Push: git push origin main"
echo ""
