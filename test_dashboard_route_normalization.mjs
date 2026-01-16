#!/usr/bin/env node
/**
 * Test: Normalización de dashboard_route
 * 
 * Verifica que la función normalizeSaasConfig() maneje correctamente
 * todos los casos posibles de entrada desde el admin panel.
 */

// Simular la función (copiar del backend)
function normalizeSaasConfig(saasConfig) {
  if (!saasConfig) return saasConfig;
  
  const config = typeof saasConfig === 'string' ? JSON.parse(saasConfig) : { ...saasConfig };
  
  if (config.dashboard_route !== undefined) {
    const original = config.dashboard_route;
    
    // Si está vacío o solo tiene espacios, convertir a null
    if (!original || original.trim() === '') {
      config.dashboard_route = null;
    } else {
      // Eliminar slashes iniciales y finales
      let route = original.replace(/^\/+/, '').replace(/\/+$/, '');
      
      // Normalizar múltiples slashes consecutivos a uno solo
      route = route.replace(/\/+/g, '/');
      
      // 🚨 FIX: Eliminar /dashboard al final si existe (ruta errónea común)
      route = route.replace(/\/dashboard$/, '');
      
      // Eliminar slashes finales otra vez después de eliminar /dashboard
      route = route.replace(/\/+$/, '');
      
      // Si quedó vacío, retornar null
      config.dashboard_route = route || null;
      
      if (original !== config.dashboard_route) {
        console.log(`📝 dashboard_route normalizado: "${original}" → "${config.dashboard_route}"`);
      }
    }
  }
  
  return config;
}

// Test cases
const testCases = [
  {
    name: '✅ Formato correcto desde admin panel',
    input: { dashboard_route: 'mailflow', pricing: [] },
    expected: 'mailflow'
  },
  {
    name: '🔧 Con slash inicial (editado manualmente en DB)',
    input: { dashboard_route: '/mailflow', pricing: [] },
    expected: 'mailflow'
  },
  {
    name: '🔧 Con /dashboard al final (editado manualmente)',
    input: { dashboard_route: '/mailflow/dashboard', pricing: [] },
    expected: 'mailflow'
  },
  {
    name: '🔧 Con múltiples slashes',
    input: { dashboard_route: '///mailflow//dashboard//', pricing: [] },
    expected: 'mailflow'
  },
  {
    name: '✅ Sin dashboard_route (opcional)',
    input: { pricing: [] },
    expected: undefined
  },
  {
    name: '✅ dashboard_route vacío',
    input: { dashboard_route: '', pricing: [] },
    expected: null
  },
  {
    name: '🔧 Solo slashes',
    input: { dashboard_route: '///', pricing: [] },
    expected: null
  },
  {
    name: '✅ Con guiones (newsletter-campaigns)',
    input: { dashboard_route: 'newsletter-campaigns', pricing: [] },
    expected: 'newsletter-campaigns'
  },
  {
    name: '🔧 newsletter-campaigns con /dashboard',
    input: { dashboard_route: 'newsletter-campaigns/dashboard', pricing: [] },
    expected: 'newsletter-campaigns'
  }
];

console.log('🧪 Ejecutando tests de normalización...\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = normalizeSaasConfig(testCase.input);
  const actual = result?.dashboard_route;
  const success = actual === testCase.expected;
  
  if (success) {
    console.log(`\n✅ Test ${index + 1}: ${testCase.name}`);
    passed++;
  } else {
    console.log(`\n❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got: "${actual}"`);
    failed++;
  }
  
  console.log(`   Input: "${testCase.input.dashboard_route || 'undefined'}"`);
  console.log(`   Output: "${actual || 'null/undefined'}"`);
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Resultados:`);
console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
console.log(`   ❌ Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n🎉 Todos los tests pasaron correctamente\n');
  process.exit(0);
} else {
  console.log('\n⚠️ Algunos tests fallaron, revisar implementación\n');
  process.exit(1);
}
