#!/bin/bash

################################################################################
# SSL A+ Deployment Script - LujanDev E-commerce
# Descripción: Aplica configuraciones SSL A+ a los servidores Nginx
# Autor: LujanDev Team
################################################################################

echo "🚀 ===== DEPLOYMENT SSL A+ CONFIGURATION ====="
echo "📅 Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONFIGS_DIR="$SCRIPT_DIR/nginx-configs"
DEPLOYMENT_LOG="/tmp/ssl-deployment-$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$1] $2" | tee -a "$DEPLOYMENT_LOG"
}

print_step() {
    echo ""
    echo -e "${BLUE}🔧 $1${NC}"
    echo "   ──────────────────────────"
}

print_success() {
    echo -e "   ${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "   ${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "   ${RED}✗ $1${NC}"
}

# Función para subir archivos al servidor
upload_configs() {
    print_step "Subiendo configuraciones Nginx optimizadas"
    
    local server="$1"
    
    if [[ -z "$server" ]]; then
        print_error "Servidor no especificado. Uso: $0 <servidor>"
        exit 1
    fi
    
    # Verificar que existan los archivos de configuración
    if [[ ! -d "$NGINX_CONFIGS_DIR" ]]; then
        print_error "Directorio de configuraciones no encontrado: $NGINX_CONFIGS_DIR"
        exit 1
    fi
    
    log "INFO" "Subiendo configuraciones a $server"
    
    # Subir configuraciones
    for config in api.lujandev.com admin.lujandev.com tienda.lujandev.com; do
        if [[ -f "$NGINX_CONFIGS_DIR/$config" ]]; then
            log "INFO" "Subiendo configuración: $config"
            if scp "$NGINX_CONFIGS_DIR/$config" "root@$server:/etc/nginx/sites-available/" 2>>"$DEPLOYMENT_LOG"; then
                print_success "Configuración $config subida correctamente"
            else
                print_error "Error al subir $config"
                return 1
            fi
        else
            print_warning "Archivo no encontrado: $config"
        fi
    done
    
    print_success "Todas las configuraciones subidas"
}

# Función para generar parámetros Diffie-Hellman en el servidor
generate_dhparams() {
    print_step "Generando parámetros Diffie-Hellman (esto puede tomar varios minutos)"
    
    local server="$1"
    
    log "INFO" "Verificando parámetros DH en $server"
    
    # Verificar si ya existen
    if ssh "root@$server" "test -f /etc/ssl/certs/dhparam.pem" 2>>"$DEPLOYMENT_LOG"; then
        print_warning "Parámetros DH ya existen, saltando generación"
    else
        log "INFO" "Generando parámetros DH de 4096 bits (esto puede tomar 10-20 minutos)"
        print_warning "Generando parámetros DH de 4096 bits (puede tomar 10-20 minutos)..."
        
        if ssh "root@$server" "openssl dhparam -out /etc/ssl/certs/dhparam.pem 4096" 2>>"$DEPLOYMENT_LOG"; then
            print_success "Parámetros DH generados correctamente"
        else
            print_error "Error al generar parámetros DH"
            return 1
        fi
    fi
}

# Función para aplicar configuraciones en el servidor
apply_configs() {
    print_step "Aplicando configuraciones Nginx"
    
    local server="$1"
    
    log "INFO" "Aplicando configuraciones en $server"
    
    # Crear backup de configuraciones actuales
    ssh "root@$server" "mkdir -p /etc/nginx/backups/$(date +%Y%m%d_%H%M%S)" 2>>"$DEPLOYMENT_LOG"
    ssh "root@$server" "cp /etc/nginx/sites-available/* /etc/nginx/backups/$(date +%Y%m%d_%H%M%S)/" 2>>"$DEPLOYMENT_LOG"
    print_success "Backup de configuraciones creado"
    
    # Verificar sintaxis de Nginx
    log "INFO" "Verificando sintaxis de Nginx"
    if ssh "root@$server" "nginx -t" 2>>"$DEPLOYMENT_LOG"; then
        print_success "Sintaxis de Nginx correcta"
    else
        print_error "Error en sintaxis de Nginx - revisar configuraciones"
        return 1
    fi
    
    # Recargar Nginx
    log "INFO" "Recargando Nginx"
    if ssh "root@$server" "systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"; then
        print_success "Nginx recargado correctamente"
    else
        print_error "Error al recargar Nginx"
        return 1
    fi
    
    # Verificar que los servicios estén corriendo
    log "INFO" "Verificando estado de servicios"
    if ssh "root@$server" "systemctl is-active nginx" | grep -q "active"; then
        print_success "Nginx está activo"
    else
        print_error "Nginx no está activo"
        return 1
    fi
}

# Función para verificar SSL después del deployment
verify_ssl() {
    print_step "Verificando configuración SSL"
    
    local domains=("api.lujandev.com" "admin.lujandev.com" "tienda.lujandev.com")
    
    sleep 5  # Esperar a que los cambios se propaguen
    
    for domain in "${domains[@]}"; do
        log "INFO" "Verificando $domain"
        
        # Verificar conectividad HTTPS
        if curl -I "https://$domain" --connect-timeout 10 -s > /dev/null 2>&1; then
            print_success "$domain - Conectividad HTTPS OK"
        else
            print_error "$domain - Error de conectividad HTTPS"
            continue
        fi
        
        # Verificar headers HSTS
        if curl -I "https://$domain" -s --connect-timeout 10 2>/dev/null | grep -qi "strict-transport-security"; then
            print_success "$domain - Header HSTS configurado"
        else
            print_warning "$domain - Header HSTS no detectado"
        fi
        
        # Verificar TLS 1.3
        if echo | openssl s_client -tls1_3 -connect "$domain:443" 2>/dev/null | grep -q "Protocol.*TLSv1.3"; then
            print_success "$domain - TLS 1.3 soportado"
        else
            print_warning "$domain - TLS 1.3 no detectado"
        fi
    done
}

# Función principal
main() {
    if [[ $# -lt 1 ]]; then
        echo "Uso: $0 <servidor> [--skip-dhparam]"
        echo "Ejemplo: $0 your-server-ip"
        echo "         $0 your-server-ip --skip-dhparam"
        exit 1
    fi
    
    local server="$1"
    local skip_dhparam="$2"
    
    log "INFO" "Iniciando deployment SSL A+ para servidor: $server"
    
    # Verificar conectividad SSH
    if ! ssh -o ConnectTimeout=10 "root@$server" "echo 'SSH OK'" >/dev/null 2>&1; then
        print_error "No se puede conectar al servidor via SSH: $server"
        exit 1
    fi
    
    print_success "Conectividad SSH verificada con $server"
    
    # Ejecutar pasos del deployment
    if ! upload_configs "$server"; then
        print_error "Fallo al subir configuraciones"
        exit 1
    fi
    
    if [[ "$skip_dhparam" != "--skip-dhparam" ]]; then
        if ! generate_dhparams "$server"; then
            print_error "Fallo al generar parámetros DH"
            exit 1
        fi
    else
        print_warning "Saltando generación de parámetros DH (--skip-dhparam)"
    fi
    
    if ! apply_configs "$server"; then
        print_error "Fallo al aplicar configuraciones"
        exit 1
    fi
    
    verify_ssl
    
    echo ""
    echo "🎉 ===== DEPLOYMENT COMPLETADO ====="
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Esperar 2-3 minutos para propagación"
    echo "   2. Probar SSL Labs test:"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=api.lujandev.com"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=admin.lujandev.com"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=tienda.lujandev.com"
    echo ""
    echo "📄 Log completo: $DEPLOYMENT_LOG"
    
    log "INFO" "Deployment completado exitosamente"
}

# Ejecutar función principal
main "$@"