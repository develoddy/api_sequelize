#!/bin/bash
# Script de diagnóstico y fix para IP tracking en producción
# Servidor: DigitalOcean Droplet con PM2 + Nginx
# Problema: Tracking events muestran ::1 en vez de IP real del usuario
# Ejecutar desde: /var/www/api_sequelize

echo "================================================"
echo "🔍 DIAGNÓSTICO IP TRACKING - NGINX CONFIG"
echo "================================================"
echo ""

# 1. Verificar logs de debug del backend
echo "📋 PASO 1: Revisando logs de debug (últimos 50 eventos IP)"
echo "------------------------------------------------"
pm2 logs api --lines 50 --nostream | grep "IP Debug" | tail -10

if [ $? -ne 0 ]; then
    echo "⚠️  No se encontraron logs de debug recientes"
    echo "   Esperando próximo evento de tracking..."
else
    echo "✅ Logs de debug encontrados arriba ☝️"
fi

echo ""
echo ""

# 2. Localizar configuración de nginx
echo "📋 PASO 2: Localizando configuración de nginx"
echo "------------------------------------------------"

NGINX_CONFIGS=(
    "/etc/nginx/sites-available/default"
    "/etc/nginx/sites-enabled/default"
    "/etc/nginx/nginx.conf"
    "/etc/nginx/sites-available/app.lujandev.com"
    "/etc/nginx/sites-enabled/app.lujandev.com"
    "/etc/nginx/conf.d/app.lujandev.com.conf"
)

FOUND_CONFIG=""

for config in "${NGINX_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo "✅ Encontrado: $config"
        FOUND_CONFIG="$config"
        # Solo mostrar el primero que tenga configuración de proxy
        if grep -q "proxy_pass" "$config"; then
            echo "   (contiene configuración de proxy)"
            break
        fi
    fi
done

if [ -z "$FOUND_CONFIG" ]; then
    echo "❌ No se encontró configuración de nginx"
    echo "   Buscar manualmente en /etc/nginx/"
    exit 1
fi

echo ""
echo ""

# 3. Mostrar configuración actual relevante
echo "📋 PASO 3: Configuración actual de nginx (bloque API)"
echo "------------------------------------------------"
echo "Archivo: $FOUND_CONFIG"
echo ""

grep -A 20 "location /api" "$FOUND_CONFIG" || grep -A 20 "proxy_pass" "$FOUND_CONFIG" | head -25

echo ""
echo ""

# 4. Verificar si tiene las headers necesarias
echo "📋 PASO 4: Verificando headers de proxy"
echo "------------------------------------------------"

if grep -q "X-Forwarded-For" "$FOUND_CONFIG"; then
    echo "✅ Header X-Forwarded-For ENCONTRADA"
    grep "X-Forwarded-For" "$FOUND_CONFIG"
else
    echo "❌ Header X-Forwarded-For NO ENCONTRADA"
fi

if grep -q "X-Real-IP" "$FOUND_CONFIG"; then
    echo "✅ Header X-Real-IP ENCONTRADA"
    grep "X-Real-IP" "$FOUND_CONFIG"
else
    echo "❌ Header X-Real-IP NO ENCONTRADA"
fi

echo ""
echo ""

# 5. Mostrar configuración correcta recomendada
echo "📋 PASO 5: Configuración CORRECTA recomendada"
echo "------------------------------------------------"
echo ""
cat << 'EOF'
# ✅ Agregar estas líneas dentro del bloque location /api { }

location /api/ {
    proxy_pass http://localhost:3000;  # O el puerto que uses
    
    # 🎯 HEADERS CRÍTICAS PARA IP TRACKING
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Headers adicionales recomendadas
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
}
EOF

echo ""
echo ""

# 6. Instrucciones para aplicar fix
echo "📋 PASO 6: Instrucciones para aplicar el fix"
echo "------------------------------------------------"
echo ""
echo "1️⃣  Editar configuración de nginx:"
echo "    sudo nano $FOUND_CONFIG"
echo ""
echo "2️⃣  Buscar el bloque 'location /api' y agregar las headers mostradas arriba"
echo ""
echo "3️⃣  Verificar sintaxis de nginx:"
echo "    sudo nginx -t"
echo ""
echo "4️⃣  Si sale OK, recargar nginx:"
echo "    sudo systemctl reload nginx"
echo ""
echo "5️⃣  Verificar que nginx está corriendo:"
echo "    sudo systemctl status nginx"
echo ""
echo "6️⃣  Probar desde móvil y revisar tracking events en DB"
echo ""
echo ""

# 7. Generar backup automático
echo "📋 PASO 7: Creando backup de configuración actual"
echo "------------------------------------------------"
BACKUP_FILE="${FOUND_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$FOUND_CONFIG" "$BACKUP_FILE"
echo "✅ Backup creado: $BACKUP_FILE"
echo ""
echo ""

# 8. Ofrecer aplicar fix automático (opcional)
echo "================================================"
echo "🔧 ¿APLICAR FIX AUTOMÁTICO?"
echo "================================================"
echo ""
echo "⚠️  ADVERTENCIA: Esto editará $FOUND_CONFIG"
echo ""
echo "Opciones:"
echo "  1) Ver configuración actual completa"
echo "  2) Aplicar fix automático (CUIDADO)"
echo "  3) Salir (aplicar manualmente)"
echo ""
read -p "Selecciona opción (1/2/3): " option

case $option in
    1)
        echo ""
        echo "📄 Configuración completa de nginx:"
        echo "------------------------------------------------"
        sudo cat "$FOUND_CONFIG"
        ;;
    2)
        echo ""
        echo "🔧 Aplicando fix automático..."
        echo "   (Esto requerirá confirmación adicional)"
        # Aquí iría el script de aplicación automática
        # Por seguridad, mejor hacerlo manual
        echo "❌ Fix automático deshabilitado por seguridad"
        echo "   Por favor aplica el fix manualmente siguiendo PASO 6"
        ;;
    3)
        echo ""
        echo "👋 Saliendo. Aplica el fix manualmente."
        ;;
    *)
        echo "Opción inválida"
        ;;
esac

echo ""
echo "================================================"
echo "✅ DIAGNÓSTICO COMPLETO"
echo "================================================"
echo ""
echo "📝 Resumen:"
echo "   - Configuración nginx: $FOUND_CONFIG"
echo "   - Backup creado: $BACKUP_FILE"
echo ""
echo "📞 Si necesitas ayuda, comparte la salida de este script"
echo ""
