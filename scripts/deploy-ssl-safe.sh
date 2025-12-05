#!/bin/bash

################################################################################
# SSL A+ Safe Deployment Script - Compatible con Certbot
# Descripción: Aplica SSL A+ de forma incremental sin romper servicios
# Autor: LujanDev Team
################################################################################

echo "🛡️  ===== SSL A+ SAFE DEPLOYMENT ====="
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
SAFE_CONFIGS_DIR="$SCRIPT_DIR/nginx-configs-safe"
DEPLOYMENT_LOG="/tmp/ssl-safe-deployment-$(date +%Y%m%d_%H%M%S).log"

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

# Función para hacer backup de seguridad
backup_current_config() {
    print_step "Creando backup de seguridad de configuración actual"
    
    local server="$1"
    local backup_dir="/etc/nginx/backups/safe-$(date +%Y%m%d_%H%M%S)"
    
    ssh "root@$server" "
    mkdir -p '$backup_dir'
    cp /etc/nginx/sites-available/api_sequelize '$backup_dir/' 2>/dev/null || true
    cp /etc/nginx/sites-available/admin_ecommerce_mean '$backup_dir/' 2>/dev/null || true
    cp /etc/nginx/sites-available/tienda_ecommerce_mean '$backup_dir/' 2>/dev/null || true
    " 2>>"$DEPLOYMENT_LOG"
    
    if [[ $? -eq 0 ]]; then
        print_success "Backup creado en $backup_dir"
        echo "$backup_dir" > /tmp/last_backup_dir
    else
        print_error "Error creando backup"
        return 1
    fi
}

# Función para verificar que los servicios funcionen
verify_service() {
    local domain="$1"
    local service_name="$2"
    
    log "INFO" "Verificando $service_name ($domain)"
    
    if curl -I "https://$domain" --connect-timeout 10 -s | grep -q "200 OK"; then
        print_success "$service_name - Funcionando correctamente"
        return 0
    else
        print_error "$service_name - Error o no accesible"
        return 1
    fi
}

# Función para aplicar configuración SSL A+ de forma segura
apply_safe_ssl_config() {
    print_step "Aplicando configuraciones SSL A+ (compatibles con Certbot)"
    
    local server="$1"
    
    log "INFO" "Aplicando configuraciones seguras en $server"
    
    # Verificar que tenemos las configuraciones
    if [[ ! -d "$SAFE_CONFIGS_DIR" ]]; then
        print_error "Directorio de configuraciones seguras no encontrado: $SAFE_CONFIGS_DIR"
        return 1
    fi
    
    # Aplicar configuración API primero (menos crítico)
    print_warning "Aplicando SSL A+ a API..."
    scp "$SAFE_CONFIGS_DIR/api_sequelize" "root@$server:/etc/nginx/sites-available/" 2>>"$DEPLOYMENT_LOG"
    
    # Verificar sintaxis
    if ssh "root@$server" "nginx -t" 2>>"$DEPLOYMENT_LOG"; then
        print_success "Sintaxis correcta - recargando API"
        ssh "root@$server" "systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
        
        # Verificar que funciona
        sleep 2
        if verify_service "api.lujandev.com" "API"; then
            print_success "API actualizada exitosamente"
        else
            print_error "API falló - revirtiendo"
            ssh "root@$server" "cp /etc/nginx/backups/$(cat /tmp/last_backup_dir | xargs basename)/api_sequelize /etc/nginx/sites-available/ && systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
            return 1
        fi
    else
        print_error "Error de sintaxis en API - no aplicando"
        return 1
    fi
    
    # Si API funciona, continuar con Admin
    print_warning "Aplicando SSL A+ a Admin..."
    scp "$SAFE_CONFIGS_DIR/admin_ecommerce_mean" "root@$server:/etc/nginx/sites-available/" 2>>"$DEPLOYMENT_LOG"
    
    if ssh "root@$server" "nginx -t" 2>>"$DEPLOYMENT_LOG"; then
        ssh "root@$server" "systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
        sleep 2
        if verify_service "admin.lujandev.com" "Admin"; then
            print_success "Admin actualizada exitosamente"
        else
            print_error "Admin falló - revirtiendo"
            ssh "root@$server" "cp /etc/nginx/backups/$(cat /tmp/last_backup_dir | xargs basename)/admin_ecommerce_mean /etc/nginx/sites-available/ && systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
            return 1
        fi
    else
        print_error "Error de sintaxis en Admin"
        return 1
    fi
    
    # Finalmente, Tienda
    print_warning "Aplicando SSL A+ a Tienda..."
    scp "$SAFE_CONFIGS_DIR/tienda_ecommerce_mean" "root@$server:/etc/nginx/sites-available/" 2>>"$DEPLOYMENT_LOG"
    
    if ssh "root@$server" "nginx -t" 2>>"$DEPLOYMENT_LOG"; then
        ssh "root@$server" "systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
        sleep 2
        if verify_service "tienda.lujandev.com" "Tienda"; then
            print_success "Tienda actualizada exitosamente"
        else
            print_error "Tienda falló - revirtiendo"
            ssh "root@$server" "cp /etc/nginx/backups/$(cat /tmp/last_backup_dir | xargs basename)/tienda_ecommerce_mean /etc/nginx/sites-available/ && systemctl reload nginx" 2>>"$DEPLOYMENT_LOG"
            return 1
        fi
    else
        print_error "Error de sintaxis en Tienda"
        return 1
    fi
    
    return 0
}

# Función para verificación final
verify_ssl_headers() {
    print_step "Verificando headers SSL A+ en todos los dominios"
    
    local domains=("api.lujandev.com" "admin.lujandev.com" "tienda.lujandev.com")
    local all_good=true
    
    for domain in "${domains[@]}"; do
        log "INFO" "Verificando headers SSL en $domain"
        
        local headers=$(curl -I "https://$domain" --connect-timeout 10 -s 2>/dev/null)
        
        if echo "$headers" | grep -q "strict-transport-security"; then
            print_success "$domain - HSTS configurado"
        else
            print_warning "$domain - HSTS no detectado"
            all_good=false
        fi
        
        if echo "$headers" | grep -q "x-frame-options"; then
            print_success "$domain - X-Frame-Options configurado"
        else
            print_warning "$domain - X-Frame-Options faltante"
            all_good=false
        fi
    done
    
    if [[ "$all_good" == "true" ]]; then
        print_success "Todos los headers SSL A+ configurados correctamente"
    else
        print_warning "Algunos headers necesitan verificación manual"
    fi
}

# Función principal
main() {
    if [[ $# -lt 1 ]]; then
        echo "Uso: $0 <servidor>"
        echo "Ejemplo: $0 64.226.123.91"
        exit 1
    fi
    
    local server="$1"
    
    log "INFO" "Iniciando deployment SSL A+ seguro para servidor: $server"
    
    # Verificar conectividad
    if ! ssh -o ConnectTimeout=10 "root@$server" "echo 'SSH OK'" >/dev/null 2>&1; then
        print_error "No se puede conectar al servidor via SSH: $server"
        exit 1
    fi
    
    print_success "Conectividad SSH verificada con $server"
    
    # Verificar que servicios estén funcionando ANTES
    print_step "Verificando estado inicial de servicios"
    if ! verify_service "api.lujandev.com" "API" || 
       ! verify_service "admin.lujandev.com" "Admin" || 
       ! verify_service "tienda.lujandev.com" "Tienda"; then
        print_error "Algunos servicios no están funcionando - abortar deployment"
        exit 1
    fi
    
    print_success "Todos los servicios funcionando correctamente"
    
    # Ejecutar deployment seguro
    if ! backup_current_config "$server"; then
        print_error "Fallo al crear backup"
        exit 1
    fi
    
    if ! apply_safe_ssl_config "$server"; then
        print_error "Fallo en deployment SSL A+"
        exit 1
    fi
    
    verify_ssl_headers
    
    echo ""
    echo "🎉 ===== DEPLOYMENT SEGURO COMPLETADO ====="
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Verificar SSL Labs A+ en:"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=api.lujandev.com"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=admin.lujandev.com"
    echo "      https://www.ssllabs.com/ssltest/analyze.html?d=tienda.lujandev.com"
    echo ""
    echo "📄 Log completo: $DEPLOYMENT_LOG"
    
    log "INFO" "Deployment seguro completado exitosamente"
}

# Ejecutar función principal
main "$@"