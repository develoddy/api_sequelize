/**
 * 🧪 CASO 3: Refresh Reactivo - MÉTODO DEFINITIVO
 * 
 * Este es el procedimiento correcto para probar el interceptor.
 */

console.log('🧪 ========================================');
console.log('🧪 CASO 3: Refresh Reactivo - MÉTODO CORRECTO');
console.log('🧪 ========================================\n');

const originalToken = localStorage.getItem('access_token');

if (!originalToken) {
  console.error('❌ No hay access_token. Debes hacer login primero.');
} else {
  
  // PASO 1: Invalidar token
  const invalidToken = originalToken + 'INVALID';
  localStorage.setItem('access_token', invalidToken);
  
  console.log('✅ PASO 1: Token invalidado en localStorage');
  console.log('📋 Token (primeros 50 caracteres):', invalidToken.substring(0, 50) + '...\n');
  
  // PASO 2: Instrucciones
  console.log('📝 PASO 2: RECARGA LA PÁGINA (F5 o Ctrl+R)');
  console.log('   Esto hace que TokenService lea el token inválido de localStorage\n');
  
  console.log('📝 PASO 3: Navega a una página protegida:');
  console.log('   - Click en "Mi Perfil" en el menú');
  console.log('   - O navega a /profile manualmente');
  console.log('   - O click en "Mis Pedidos"\n');
  
  console.log('🎯 QUÉ ESPERAR:');
  console.log('   1. Angular hace request con token inválido');
  console.log('   2. Backend retorna 401');
  console.log('   3. Interceptor detecta el 401 automáticamente');
  console.log('   4. Logs del interceptor aparecen en consola:');
  console.log('      🔍 Interceptor: Error 401 detectado');
  console.log('      🔄 Interceptor: Iniciando refresh de token...');
  console.log('      ✅ Interceptor: Token refrescado exitosamente');
  console.log('      🔁 Interceptor: Reintentando request original');
  console.log('   5. La página se carga correctamente');
  console.log('   6. Token actualizado en localStorage\n');
  
  console.log('✅ VALIDACIONES:');
  console.log('   - NO ves errores en la UI');
  console.log('   - NO fuiste redirigido a /login');
  console.log('   - La página se cargó exitosamente');
  console.log('   - access_token en localStorage cambió\n');
  
  console.log('⚠️ IMPORTANTE: Ahora recarga la página (F5) para continuar');
  console.log('⚠️ Después de recargar, navega a "Mi Perfil"\n');
}
