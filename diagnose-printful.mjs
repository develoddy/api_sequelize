#!/usr/bin/env node

// ================================================================
// 🔍 DIAGNÓSTICO DE TOKEN PRINTFUL
// ================================================================

import './src/config/env.js';
import axios from 'axios';

console.log('\n════════════════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO DE AUTENTICACIÓN PRINTFUL');
console.log('════════════════════════════════════════════════════════\n');

// 1. Verificar que el token se cargó desde .env
console.log('1️⃣ VERIFICANDO VARIABLES DE ENTORNO:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('   PRINTFUL_API_TOKEN:', process.env.PRINTFUL_API_TOKEN ? '✅ Cargado' : '❌ NO CARGADO');
if (process.env.PRINTFUL_API_TOKEN) {
    console.log('   Token (primeros 20 chars):', process.env.PRINTFUL_API_TOKEN.substring(0, 20) + '...');
    console.log('   Token (longitud):', process.env.PRINTFUL_API_TOKEN.length, 'caracteres');
}
console.log('');

// 2. Probar autenticación con Printful
console.log('2️⃣ PROBANDO AUTENTICACIÓN CON PRINTFUL API:');
console.log('   Endpoint: GET /stores');

const printfulApi = axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`
    }
});

try {
    const response = await printfulApi.get('/stores');
    console.log('   ✅ AUTENTICACIÓN EXITOSA');
    console.log('   Status:', response.status);
    console.log('   Store ID:', response.data?.result?.[0]?.id || 'N/A');
    console.log('   Store Name:', response.data?.result?.[0]?.name || 'N/A');
    console.log('\n✅ TOKEN VÁLIDO - El problema NO es de autenticación');
} catch (error) {
    if (error.response?.status === 401) {
        console.log('   ❌ ERROR 401 - TOKEN INVÁLIDO O EXPIRADO');
        console.log('   Mensaje:', error.response?.data?.error?.message || 'No message');
        console.log('\n🔴 PROBLEMA IDENTIFICADO: El token de Printful NO es válido');
        console.log('\n📋 SOLUCIÓN:');
        console.log('   1. Ve a Printful Dashboard: https://www.printful.com/dashboard/store');
        console.log('   2. Settings → API');
        console.log('   3. Genera un NUEVO token');
        console.log('   4. Actualiza .env.development y .env.production con el nuevo token');
        console.log('   5. Reinicia el servidor: pm2 restart ecosystem.config.cjs');
    } else {
        console.log('   ❌ ERROR:', error.message);
        console.log('   Status:', error.response?.status || 'N/A');
    }
}

console.log('\n════════════════════════════════════════════════════════\n');
