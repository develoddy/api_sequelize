#!/bin/bash

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[1;35m'
NC='\033[0m' # No Color

divider="========================================================="

# ===================== BANNER =====================
echo -e "${MAGENTA}$divider${NC}"
echo -e "${MAGENTA}##                                                 ##${NC}"
echo -e "${MAGENTA}##       🚀🚀🚀 DEPLOY API 🚀🚀🚀                ##${NC}"
echo -e "${MAGENTA}##                                                 ##${NC}"
echo -e "${MAGENTA}$divider${NC}"
echo -e "${YELLOW}🚀 Iniciando proceso de Deploy de API${NC}"
echo -e "${BLUE}$divider${NC}"

# ===================== PASO 1 =====================
echo -e "\n${CYAN}1️⃣ PASO 1: Guardar cambios en el repo local de API${NC}"
git add .
git commit -m "💾 Pre-Deploy API $(date '+%Y-%m-%d %H:%M:%S')" >/dev/null 2>&1
git push origin main
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Cambios guardados y enviados a GitHub correctamente${NC}"
else
  echo -e "${RED}❌ Error al guardar/enviar cambios a GitHub${NC}"
  exit 1
fi

# ===================== PASO 2 =====================
echo -e "\n${CYAN}2️⃣ PASO 2: Actualizar en el servidor remoto${NC}"
ssh -i ~/.ssh/id_rsa_do root@64.226.123.91 << 'EOF'
  cd /var/www/api_sequelize
  
  # Guardar cambios locales del servidor si existen
  if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  Detectados cambios sin commitear en servidor, guardando..."
    git add .
    git commit -m "💾 Auto-save server changes $(date '+%Y-%m-%d %H:%M:%S')" || true
  fi
  
  # Pull con rebase
  git pull --rebase origin main
  
  # Si hay conflictos, mantener cambios remotos
  if [ $? -ne 0 ]; then
    echo "⚠️  Conflictos detectados, resolviendo automáticamente..."
    git rebase --abort || true
    git reset --hard origin/main
  fi
EOF

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Servidor remoto actualizado correctamente${NC}"
else
  echo -e "${RED}❌ Error al actualizar API en el servidor${NC}"
  exit 1
fi

# ===================== PASO 3 =====================
echo -e "\n${CYAN}3️⃣ PASO 3: Reiniciar PM2 y validar${NC}"
ssh -i ~/.ssh/id_rsa_do root@64.226.123.91 << 'EOF'
  cd /var/www/api_sequelize
  
  # Dar permisos a scripts
  chmod +x scripts/*.sh
  
  # Reiniciar PM2
  pm2 restart api_sequelize
  
  # Esperar 3 segundos
  sleep 3
  
  # Verificar estado
  pm2 list | grep api_sequelize
EOF

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ PM2 reiniciado correctamente${NC}"
else
  echo -e "${YELLOW}⚠️  PM2 podría tener problemas, verifica manualmente${NC}"
fi

# ===================== PASO 4 =====================
echo -e "\n${CYAN}4️⃣ PASO 4: Validar endpoints${NC}"
echo -e "${YELLOW}Esperando que el servidor esté listo...${NC}"
sleep 5

# Verificar health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.lujandev.com/api/health)
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ /api/health - OK (200)${NC}"
else
  echo -e "${RED}❌ /api/health - Error ($HEALTH_STATUS)${NC}"
fi

# Verificar dashboard
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.lujandev.com/dashboard.html)
if [ "$DASHBOARD_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ /dashboard.html - OK (200)${NC}"
else
  echo -e "${YELLOW}⚠️  /dashboard.html - ($DASHBOARD_STATUS)${NC}"
fi

# Verificar métricas
METRICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.lujandev.com/metrics/latest.json)
if [ "$METRICS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ /metrics/latest.json - OK (200)${NC}"
else
  echo -e "${YELLOW}⚠️  /metrics/latest.json - ($METRICS_STATUS)${NC}"
fi

# ================= FIN =================
echo -e "\n${MAGENTA}$divider${NC}"
echo -e "${MAGENTA}##    🎉🎉🎉 DEPLOY API COMPLETADO 🎉🎉🎉         ##${NC}"
echo -e "${MAGENTA}##       ✅ API actualizada y en producción ✅     ##${NC}"
echo -e "${MAGENTA}$divider${NC}"

echo -e "\n${CYAN}📊 URLs Disponibles:${NC}"
echo -e "   ${BLUE}https://api.lujandev.com/api/health${NC}"
echo -e "   ${BLUE}https://api.lujandev.com/dashboard.html${NC}"
echo -e "   ${BLUE}https://api.lujandev.com/metrics/latest.json${NC}"

echo -e "\n${CYAN}🔍 Comandos útiles:${NC}"
echo -e "   ${YELLOW}Ver logs:${NC} ssh root@64.226.123.91 'pm2 logs api_sequelize'"
echo -e "   ${YELLOW}Estado PM2:${NC} ssh root@64.226.123.91 'pm2 list'"
echo -e "   ${YELLOW}Health check:${NC} ssh root@64.226.123.91 'cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh'"
echo ""
