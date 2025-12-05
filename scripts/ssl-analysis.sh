#!/bin/bash

################################################################################
# SSL A+ Grade Optimization Script - LujanDev E-commerce
# Descripción: Analiza y optimiza configuración SSL para obtener calificación A+
# Autor: LujanDev Team
################################################################################

echo "🔒 ===== ANÁLISIS Y OPTIMIZACIÓN SSL A+ ====="
echo "📅 Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dominios a verificar
DOMAINS=("api.lujandev.com" "admin.lujandev.com" "tienda.lujandev.com")

print_status() {
    local status="$1"
    local message="$2"
    local details="$3"
    
    case $status in
        "OK")
            echo -e "   ${GREEN}✓ $message${NC} ${details:+- $details}"
            ;;
        "WARN")
            echo -e "   ${YELLOW}⚠ $message${NC} ${details:+- $details}"
            ;;
        "FAIL")
            echo -e "   ${RED}✗ $message${NC} ${details:+- $details}"
            ;;
        "INFO")
            echo -e "   ${BLUE}ℹ $message${NC} ${details:+- $details}"
            ;;
    esac
}

# Función para verificar SSL de un dominio
check_ssl_grade() {
    local domain="$1"
    echo ""
    echo "🌐 Analizando: $domain"
    echo "   ────────────────────────"
    
    # 1. Verificar conectividad HTTPS
    if curl -I "https://$domain" --connect-timeout 5 -s > /dev/null 2>&1; then
        print_status "OK" "Conectividad HTTPS" "Dominio accesible"
    else
        print_status "FAIL" "Conectividad HTTPS" "No se puede acceder al dominio"
        return 1
    fi
    
    # 2. Obtener información del certificado
    local cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null)
    
    if [[ -n "$cert_info" ]]; then
        # Extraer fechas
        local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d'=' -f2-)
        local issuer=$(echo "$cert_info" | grep "issuer" | cut -d'=' -f2-)
        
        # Calcular días restantes
        local expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" "+%s" 2>/dev/null || echo "0")
        local current_epoch=$(date "+%s")
        local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [[ $days_left -gt 30 ]]; then
            print_status "OK" "Certificado válido" "$days_left días restantes"
        elif [[ $days_left -gt 7 ]]; then
            print_status "WARN" "Certificado válido" "$days_left días restantes (renovar pronto)"
        else
            print_status "FAIL" "Certificado válido" "$days_left días restantes (RENOVAR URGENTE)"
        fi
        
        # Verificar emisor
        if echo "$issuer" | grep -q "Let's Encrypt"; then
            print_status "OK" "Emisor del certificado" "Let's Encrypt (confiable)"
        else
            print_status "INFO" "Emisor del certificado" "$issuer"
        fi
    else
        print_status "FAIL" "Información del certificado" "No se pudo obtener"
        return 1
    fi
    
    # 3. Verificar protocolos TLS
    echo ""
    echo "   🔐 Verificando protocolos TLS..."
    
    # TLS 1.3 (requerido para A+)
    if echo | openssl s_client -tls1_3 -connect "$domain:443" 2>/dev/null | grep -q "Protocol.*TLSv1.3"; then
        print_status "OK" "TLS 1.3 soportado" "Requerido para A+"
    else
        print_status "WARN" "TLS 1.3 soportado" "No detectado - puede afectar calificación"
    fi
    
    # TLS 1.2 (mínimo aceptable)
    if echo | openssl s_client -tls1_2 -connect "$domain:443" 2>/dev/null | grep -q "Protocol.*TLSv1.2"; then
        print_status "OK" "TLS 1.2 soportado" "Mínimo aceptable"
    else
        print_status "FAIL" "TLS 1.2 soportado" "CRÍTICO - protocolo mínimo"
    fi
    
    # Verificar protocolos inseguros (deben estar desactivados)
    if echo | openssl s_client -ssl3 -connect "$domain:443" 2>/dev/null | grep -q "SSL-Session"; then
        print_status "FAIL" "SSL 3.0 desactivado" "CRÍTICO - protocolo inseguro activo"
    else
        print_status "OK" "SSL 3.0 desactivado" "Protocolo inseguro correctamente desactivado"
    fi
    
    # 4. Verificar cipher suites
    echo ""
    echo "   🔑 Verificando cipher suites..."
    
    local ciphers=$(echo | openssl s_client -connect "$domain:443" -cipher 'ALL' 2>/dev/null | grep "Cipher.*:")
    if echo "$ciphers" | grep -q "ECDHE"; then
        print_status "OK" "Perfect Forward Secrecy" "ECDHE detectado"
    else
        print_status "WARN" "Perfect Forward Secrecy" "ECDHE no detectado"
    fi
    
    # 5. Verificar headers de seguridad
    echo ""
    echo "   🛡️  Verificando headers de seguridad..."
    
    local headers=$(curl -I "https://$domain" -s --connect-timeout 5 2>/dev/null)
    
    # HSTS (HTTP Strict Transport Security)
    if echo "$headers" | grep -qi "strict-transport-security"; then
        local hsts_header=$(echo "$headers" | grep -i "strict-transport-security")
        if echo "$hsts_header" | grep -q "max-age=31536000"; then
            print_status "OK" "HSTS configurado" "max-age=1 año (recomendado)"
        else
            print_status "WARN" "HSTS configurado" "max-age menor a 1 año"
        fi
        
        if echo "$hsts_header" | grep -q "includeSubDomains"; then
            print_status "OK" "HSTS includeSubDomains" "Subdominios protegidos"
        else
            print_status "WARN" "HSTS includeSubDomains" "No incluye subdominios"
        fi
    else
        print_status "FAIL" "HSTS configurado" "Header no encontrado - CRÍTICO para A+"
    fi
    
    # X-Frame-Options
    if echo "$headers" | grep -qi "x-frame-options"; then
        print_status "OK" "X-Frame-Options" "Protección contra clickjacking"
    else
        print_status "WARN" "X-Frame-Options" "Header no encontrado"
    fi
    
    # X-Content-Type-Options
    if echo "$headers" | grep -qi "x-content-type-options.*nosniff"; then
        print_status "OK" "X-Content-Type-Options" "Protección MIME type sniffing"
    else
        print_status "WARN" "X-Content-Type-Options" "Header no encontrado"
    fi
    
    # Content-Security-Policy
    if echo "$headers" | grep -qi "content-security-policy"; then
        print_status "OK" "Content-Security-Policy" "CSP configurado"
    else
        print_status "WARN" "Content-Security-Policy" "CSP no encontrado"
    fi
}

# Función para generar configuración Nginx optimizada
generate_nginx_ssl_config() {
    echo ""
    echo "📝 ===== CONFIGURACIÓN NGINX OPTIMIZADA PARA SSL A+ ====="
    echo ""
    
    cat << 'EOF'
# Configuración SSL optimizada para A+ en SSL Labs
# Agregar a cada server block en Nginx

# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security Headers (CRÍTICOS para A+)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.lujandev.com; frame-ancestors 'none';" always;

# Disable server tokens
server_tokens off;

# SSL Diffie-Hellman parameters (generar con: openssl dhparam -out /etc/ssl/certs/dhparam.pem 4096)
ssl_dhparam /etc/ssl/certs/dhparam.pem;
EOF

    echo ""
    echo "💡 Comandos para aplicar:"
    echo "   1. Generar parámetros DH: sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 4096"
    echo "   2. Agregar configuración a cada server block en /etc/nginx/sites-available/"
    echo "   3. Verificar configuración: sudo nginx -t"
    echo "   4. Recargar Nginx: sudo systemctl reload nginx"
}

# Función principal
main() {
    echo "🎯 Objetivo: Alcanzar calificación SSL A+ en SSL Labs"
    echo ""
    
    # Verificar cada dominio
    for domain in "${DOMAINS[@]}"; do
        check_ssl_grade "$domain"
    done
    
    # Generar configuración optimizada
    generate_nginx_ssl_config
    
    echo ""
    echo "📊 ===== RESUMEN Y RECOMENDACIONES ====="
    echo ""
    echo "🔗 Para verificar calificación SSL Labs:"
    for domain in "${DOMAINS[@]}"; do
        echo "   https://www.ssllabs.com/ssltest/analyze.html?d=$domain"
    done
    
    echo ""
    echo "⚡ Pasos críticos para A+:"
    echo "   1. ✅ Certificados Let's Encrypt válidos"
    echo "   2. ⚠️  Configurar HSTS con max-age=31536000"
    echo "   3. ⚠️  Habilitar TLS 1.3"
    echo "   4. ⚠️  Configurar security headers completos"
    echo "   5. ⚠️  Generar parámetros DH 4096 bits"
    echo "   6. ⚠️  Habilitar OCSP Stapling"
    echo ""
    echo "🚀 Una vez aplicada la configuración, esperar 2-3 minutos y re-testear en SSL Labs"
}

# Ejecutar análisis
main "$@"