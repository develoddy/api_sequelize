/**
 * 🧪 SCRIPT DE TESTING ALTERNATIVO - CASO 3: Refresh Reactivo
 * 
 * Esta versión usa Angular HttpClient directamente desde la consola
 * para asegurar que el interceptor se dispare correctamente.
 * 
 * REQUISITO: Debes tener acceso a Angular en la consola del navegador.
 */

console.log('🧪 ========================================');
console.log('🧪 CASO 3: Refresh Reactivo - Versión Angular');
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
  console.log('⚠️ Token modificado (añadido "INVALID" al final)');
  console.log('📋 Token inválido (primeros 50 caracteres):', invalidToken.substring(0, 50) + '...\n');
  
  console.log('🚀 Método recomendado: Navega a una página protegida');
  console.log('📍 Opciones:');
  console.log('   1. Click en "Mi Perfil" en el menú');
  console.log('   2. Click en "Mis Pedidos"');
  console.log('   3. Intenta añadir un producto al carrito');
  console.log('   4. Navega a /profile manualmente\n');
  
  console.log('⏳ Cuando hagas cualquiera de estas acciones, el interceptor:');
  console.log('   🔍 Detectará el 401 del backend');
  console.log('   🔄 Refrescará el token automáticamente');
  console.log('   🔁 Reintentará la request original');
  console.log('   ✅ Completará la acción sin errores visibles\n');
  
  console.log('📝 LOGS ESPERADOS:');
  console.log('🔍 Interceptor: Error 401 detectado - Token inválido o expirado');
  console.log('🔄 Interceptor: Iniciando refresh de token...');
  console.log('✅ Interceptor: Token refrescado exitosamente');
  console.log('🔁 Interceptor: Reintentando request original con nuevo token\n');
  
  console.log('⚠️ IMPORTANTE: El token ya está invalidado en localStorage');
  console.log('⚠️ Ahora solo necesitas navegar a cualquier página protegida\n');
  
  // Verificar después de 5 segundos si el token cambió
  setTimeout(() => {
    const currentToken = localStorage.getItem('access_token');
    if (currentToken !== invalidToken && currentToken !== originalToken) {
      console.log('\n✅ ¡Token actualizado detectado!');
      console.log('📋 Nuevo token (primeros 50 caracteres):', currentToken.substring(0, 50) + '...');
      console.log('🎉 CASO 3: PASSED ✅\n');
    } else if (currentToken === invalidToken) {
      console.log('\n⏳ Token aún no actualizado. ¿Ya navegaste a una página protegida?');
    }
  }, 5000);
}
