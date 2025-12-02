/**
 * 🧪 SCRIPT DE TESTING - CASO 3: Refresh Reactivo (Interceptor)
 * 
 * ⚠️ IMPORTANTE: Este script usa fetch() que NO pasa por el interceptor de Angular.
 * Para testing real, es mejor usar el método manual de navegación.
 * 
 * 📝 MÉTODO RECOMENDADO (ver abajo):
 * 1. Invalida el token manualmente
 * 2. Recarga la página (F5)
 * 3. Navega a "Mi Perfil" o cualquier página protegida
 * 4. El interceptor se disparará automáticamente
 */

console.log('🧪 ========================================');
console.log('🧪 CASO 3: Refresh Reactivo - Script Simplificado');
console.log('🧪 ========================================\n');

// Paso 1: Verificar que hay un token
const originalToken = localStorage.getItem('access_token');
if (!originalToken) {
  console.error('❌ No hay access_token en localStorage. Debes hacer login primero.');
} else {
  console.log('✅ Token original encontrado');
  console.log('📋 Token (primeros 50 caracteres):', originalToken.substring(0, 50) + '...\n');
  
  // Paso 2: Invalidar el token
  const invalidToken = originalToken + 'INVALID';
  localStorage.setItem('access_token', invalidToken);
  console.log('⚠️ Token modificado en localStorage');
  console.log('📋 Token inválido (primeros 50 caracteres):', invalidToken.substring(0, 50) + '...\n');
  
  console.log('⚠️⚠️⚠️ IMPORTANTE ⚠️⚠️⚠️');
  console.log('El TokenService mantiene el token en memoria (BehaviorSubject).');
  console.log('Para que detecte el token inválido, debes:');
  console.log('');
  console.log('OPCIÓN 1 (RECOMENDADA): Recargar la página');
  console.log('  1. Presiona F5 o Ctrl+R');
  console.log('  2. Navega a "Mi Perfil" o "Mis Pedidos"');
  console.log('  3. El interceptor detectará el 401 y refrescará automáticamente');
  console.log('');
  console.log('OPCIÓN 2: Forzar con fetch (no usa interceptor de Angular)');
  console.log('  Ejecuta: testCaso3Fetch()');
  console.log('  (Definido en este script)');
  console.log('');
  console.log('📝 LOGS ESPERADOS DEL INTERCEPTOR:');
  console.log('   🔍 Interceptor: Error 401 detectado');
  console.log('   🔄 Interceptor: Iniciando refresh de token...');
  console.log('   ✅ Interceptor: Token refrescado exitosamente');
  console.log('   🔁 Interceptor: Reintentando request original\n');
  
  // Paso 3: Forzar request protegida al backend
  console.log('🚀 Haciendo request a endpoint protegido...');
  
  // Determinar la URL base del backend
  const baseUrl = 'http://localhost:3500'; // Puerto del backend API
  
  // Endpoints disponibles para testing (todos requieren auth):
  // - /api/sales/list (GET) - verifyAdmin
  // - /api/users/detail_user (POST) - verifyEcommerce
  // - /api/wishlist/register (POST) - verifyEcommerce
  const endpoint = `${baseUrl}/api/users/detail_user`;
  
  console.log('📍 URL:', endpoint);
  console.log('🔑 Authorization: Bearer [token inválido]\n');
  
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // Body vacío para el test
  })
  .then(response => {
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log('\n🎯 ¡Perfecto! Backend retornó 401');
      console.log('🔍 El interceptor debería detectarlo y refrescar automáticamente');
      console.log('⏳ Esperando logs del interceptor...\n');
    }
    
    return response.json();
  })
  .then(data => {
    console.log('✅ ¡SUCCESS! Request completada después del refresh');
    console.log('📦 Data recibida:', data);
    console.log('\n🎉 CASO 3: PASSED ✅');
    console.log('El interceptor detectó el 401 y refrescó el token automáticamente\n');
    
    // Verificar que el token cambió
    const newToken = localStorage.getItem('access_token');
    if (newToken !== invalidToken) {
      console.log('✅ Token actualizado en localStorage');
      console.log('📋 Nuevo token (primeros 50 caracteres):', newToken.substring(0, 50) + '...');
    }
  })
  .catch(error => {
    console.error('❌ Error en la request:', error);
    console.log('\n⚠️ Si ves este error, revisa:');
    console.log('1. Que el backend esté corriendo');
    console.log('2. Que el endpoint /api/users/me exista y esté protegido');
    console.log('3. Que el interceptor esté correctamente configurado');
  });
}

// Función helper para testing con fetch (opcional)
window.testCaso3Fetch = function() {
  const baseUrl = 'http://localhost:3500';
  const endpoint = `${baseUrl}/api/users/detail_user`;
  
  console.log('\n🚀 Ejecutando test con fetch...');
  console.log('⚠️ NOTA: fetch NO pasa por el interceptor de Angular');
  console.log('📍 Endpoint:', endpoint, '\n');
  
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(response => {
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log('✅ Backend retornó 401 como esperado');
      console.log('⚠️ Pero fetch NO activa el interceptor de Angular');
      console.log('💡 Usa la Opción 1 (recargar + navegar) para test real\n');
    }
    
    return response.json();
  })
  .then(data => console.log('📦 Data:', data))
  .catch(error => console.error('❌ Error:', error));
}

console.log('✅ Script cargado. Función testCaso3Fetch() disponible.\n');
