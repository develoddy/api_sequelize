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

# ===================== BANNER PRINCIPAL =====================
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
  echo -e "${RED}❌ Error al hacer push a GitHub. Se detiene la ejecución${NC}"
  exit 1
fi

# ===================== PASO 2 =====================
echo -e "\n${CYAN}2️⃣ PASO 2: Actualizar en el servidor remoto${NC}"
ssh -i ~/.ssh/id_rsa_do root@64.226.123.91 << EOF
  cd /var/www/api_sequelize
  git pull origin main
  pm2 restart api_sequelize
EOF

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ API actualizada y reiniciada en el servidor${NC}"
else
  echo -e "${RED}❌ Error al actualizar o reiniciar API en el servidor${NC}"
  exit 1
fi

# ================= FIN =================
echo -e "${MAGENTA}=========================================================${NC}"
echo -e "${MAGENTA}##                                                 ##${NC}"
echo -e "${MAGENTA}##    🎉🎉🎉 DEPLOY API COMPLETADO 🎉🎉🎉         ##${NC}"
echo -e "${MAGENTA}##       ✅ API actualizada y funcionando ✅      ##${NC}"
echo -e "${MAGENTA}##          🥳🚀🎊 FELICIDADES 🚀🎊🥳         ##${NC}"
echo -e "${MAGENTA}##                                                 ##${NC}"
echo -e "${MAGENTA}=========================================================${NC}\n"
