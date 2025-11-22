#!/usr/bin/env node

/**
 * Script administrativo para enviar emails de lanzamiento
 * Uso: node launch-email-sender.js
 */

import dotenv from 'dotenv';
import readline from 'readline';
import { sendLaunchEmails } from '../src/services/prelaunchEmailService.js';

// Cargar variables de entorno
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
    log(`\n${'='.repeat(60)}`, 'bright');
    log(message, 'bright');
    log(`${'='.repeat(60)}`, 'bright');
}

async function main() {
    try {
        header('🚀 LANZAMIENTO DE EMAILS - LUJANDEV STORE');
        
        log('\n📋 Configuración del lanzamiento:', 'blue');
        
        // Configuración del lanzamiento
        const launchConfig = {
            coupon_discount: '15%',
            coupon_expiry_days: '7',
            launch_date: new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            featured_products: [
                {
                    name: 'Camiseta Premium',
                    price: '€24.95',
                    image: process.env.URL_BACKEND + '/api/products/uploads/product/camiseta-preview.jpg'
                },
                {
                    name: 'Taza Personalizada',
                    price: '€12.95',
                    image: process.env.URL_BACKEND + '/api/products/uploads/product/taza-preview.jpg'
                },
                {
                    name: 'Hoodie Exclusivo',
                    price: '€39.95',
                    image: process.env.URL_BACKEND + '/api/products/uploads/product/hoodie-preview.jpg'
                },
                {
                    name: 'Gorra Bordada',
                    price: '€19.95',
                    image: process.env.URL_BACKEND + '/api/products/uploads/product/gorra-preview.jpg'
                }
            ]
        };

        log(`   💰 Descuento: ${launchConfig.coupon_discount}`, 'green');
        log(`   ⏰ Válido por: ${launchConfig.coupon_expiry_days} días`, 'green');
        log(`   📅 Fecha de lanzamiento: ${launchConfig.launch_date}`, 'green');
        log(`   🛍️  Productos destacados: ${launchConfig.featured_products.length}`, 'green');

        log('\n¿Confirmas el envío de emails de lanzamiento? (y/N): ', 'yellow');
        
        // Esperar confirmación del usuario
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question('', resolve);
        });
        
        rl.close();

        if (!answer.toLowerCase().startsWith('y')) {
            log('\n❌ Envío cancelado por el usuario', 'red');
            process.exit(0);
        }

        header('🎯 INICIANDO CAMPAÑA DE LANZAMIENTO');
        
        log('📤 Enviando emails...', 'blue');
        const result = await sendLaunchEmails(launchConfig);

        if (result.success) {
            log('\n🎉 ¡CAMPAÑA COMPLETADA EXITOSAMENTE!', 'green');
            log(`   ✅ Emails enviados: ${result.sent}`, 'green');
            log(`   ❌ Errores: ${result.errors}`, result.errors > 0 ? 'yellow' : 'green');
            log(`   📊 Total suscriptores: ${result.total}`, 'blue');
            
            if (result.sent > 0) {
                log('\n📈 Estadísticas:', 'blue');
                log(`   📧 Tasa de envío: ${((result.sent / result.total) * 100).toFixed(1)}%`, 'blue');
                
                if (result.errors > 0) {
                    log(`   ⚠️  Algunos emails fallaron. Revisa los logs del servidor.`, 'yellow');
                }
            }
            
        } else {
            log('\n❌ ERROR EN LA CAMPAÑA', 'red');
            log(`   💥 Error: ${result.message}`, 'red');
            if (result.error) {
                log(`   🔍 Detalles: ${result.error}`, 'red');
            }
        }

        header('📊 RESUMEN FINAL');
        log(`Estado: ${result.success ? '✅ EXITOSO' : '❌ FALLÓ'}`, result.success ? 'green' : 'red');
        log(`Emails procesados: ${result.sent || 0} de ${result.total || 0}`, 'blue');
        
        if (result.success && result.sent > 0) {
            log('\n🎯 Próximos pasos:', 'blue');
            log('   1. Monitorear respuestas de clientes', 'blue');
            log('   2. Verificar métricas de conversión', 'blue');
            log('   3. Preparar soporte para posibles consultas', 'blue');
        }

    } catch (error) {
        log('\n💥 ERROR CRÍTICO:', 'red');
        log(`   ${error.message}`, 'red');
        if (error.stack) {
            log('\n🔍 Stack trace:', 'red');
            log(error.stack, 'red');
        }
        process.exit(1);
    }
}

// Ejecutar script
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

export { main as sendLaunchEmailsScript };