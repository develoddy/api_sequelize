const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.development' });

// Configuración
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_EMAILS = [
  'test1@example.com',
  'test2@example.com', 
  'invalid-email',
  'test1@example.com' // Duplicado para probar validación
];

// Colores para console
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

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`🔍 ${message}`, 'blue');
}

function header(message) {
  log(`\n${'='.repeat(50)}`, 'bright');
  log(`${message}`, 'bright');
  log(`${'='.repeat(50)}`, 'bright');
}

class PrelaunchTester {
  constructor() {
    this.dbConnection = null;
    this.testResults = {
      database: false,
      api: false,
      validation: false,
      duplicates: false,
      analytics: false
    };
  }

  async init() {
    try {
      this.dbConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ecommercedb'
      });
      success('Conexión a base de datos establecida');
    } catch (err) {
      error(`Error conectando a BD: ${err.message}`);
      throw err;
    }
  }

  async testDatabaseStructure() {
    header('PRUEBA 1: ESTRUCTURA DE BASE DE DATOS');
    
    try {
      // Verificar que la tabla existe
      const [tables] = await this.dbConnection.execute(
        "SHOW TABLES LIKE 'prelaunch_subscribers'"
      );
      
      if (tables.length === 0) {
        error('Tabla prelaunch_subscribers no existe');
        return false;
      }
      success('Tabla prelaunch_subscribers existe');

      // Verificar columnas
      const [columns] = await this.dbConnection.execute(
        "DESCRIBE prelaunch_subscribers"
      );
      
      const expectedColumns = [
        'id', 'email', 'session_id', 'source', 'ip_address', 
        'user_agent', 'referrer', 'utm_source', 'utm_medium', 
        'utm_campaign', 'status', 'email_verified', 'verification_token',
        'notified_launch', 'coupon_sent', 'createdAt', 'updatedAt'
      ];
      
      const actualColumns = columns.map(col => col.Field);
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missingColumns.length > 0) {
        error(`Columnas faltantes: ${missingColumns.join(', ')}`);
        return false;
      }
      success('Todas las columnas existen');

      // Verificar índices
      const [indexes] = await this.dbConnection.execute(
        "SHOW INDEX FROM prelaunch_subscribers"
      );
      
      const indexNames = indexes.map(idx => idx.Key_name);
      const expectedIndexes = ['PRIMARY', 'email', 'idx_prelaunch_status', 'idx_prelaunch_source'];
      
      const hasAllIndexes = expectedIndexes.every(idx => indexNames.includes(idx));
      if (!hasAllIndexes) {
        warning('Algunos índices pueden estar faltando');
        info(`Índices encontrados: ${indexNames.join(', ')}`);
      } else {
        success('Índices principales verificados');
      }

      this.testResults.database = true;
      return true;

    } catch (err) {
      error(`Error verificando estructura: ${err.message}`);
      return false;
    }
  }

  async testAPIEndpoints() {
    header('PRUEBA 2: ENDPOINTS DE API');
    
    try {
      // Limpiar registros de prueba anteriores
      await this.dbConnection.execute(
        "DELETE FROM prelaunch_subscribers WHERE email LIKE 'test%@example.com'"
      );

      // Probar endpoint de suscripción
      info('Probando POST /prelaunch/subscribe...');
      
      const response = await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, {
        email: 'test1@example.com',
        source: 'main_form',
        session_id: 'test-session-123'
      });

      if (response.status === 200 || response.status === 201) {
        success('Endpoint de suscripción funciona');
      } else {
        error(`Respuesta inesperada: ${response.status}`);
        return false;
      }

      // Verificar que se guardó en BD
      const [rows] = await this.dbConnection.execute(
        "SELECT * FROM prelaunch_subscribers WHERE email = 'test1@example.com'"
      );

      if (rows.length === 1) {
        success('Email guardado correctamente en BD');
        info(`Datos: ${JSON.stringify(rows[0], null, 2)}`);
      } else {
        error('Email no se guardó en BD');
        return false;
      }

      // Probar endpoint de estadísticas
      try {
        info('Probando GET /prelaunch/stats...');
        const statsResponse = await axios.get(`${API_BASE_URL}/prelaunch/stats`);
        
        if (statsResponse.data && typeof statsResponse.data.total === 'number') {
          success('Endpoint de estadísticas funciona');
          info(`Stats: ${JSON.stringify(statsResponse.data, null, 2)}`);
        } else {
          warning('Endpoint de estadísticas responde pero formato inesperado');
        }
      } catch (err) {
        warning(`Stats endpoint no disponible: ${err.message}`);
      }

      this.testResults.api = true;
      return true;

    } catch (err) {
      error(`Error probando API: ${err.message}`);
      if (err.response) {
        error(`Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`);
      }
      return false;
    }
  }

  async testValidation() {
    header('PRUEBA 3: VALIDACIÓN DE EMAILS');
    
    try {
      // Probar email inválido
      info('Probando email inválido...');
      
      try {
        await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, {
          email: 'invalid-email',
          source: 'main_form'
        });
        error('API aceptó email inválido (esto es un problema)');
        return false;
      } catch (err) {
        if (err.response && err.response.status === 400) {
          success('API rechazó email inválido correctamente');
        } else {
          error(`Error inesperado con email inválido: ${err.message}`);
          return false;
        }
      }

      // Probar email vacío
      info('Probando email vacío...');
      
      try {
        await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, {
          email: '',
          source: 'main_form'
        });
        error('API aceptó email vacío (esto es un problema)');
        return false;
      } catch (err) {
        if (err.response && err.response.status === 400) {
          success('API rechazó email vacío correctamente');
        } else {
          error(`Error inesperado con email vacío: ${err.message}`);
          return false;
        }
      }

      this.testResults.validation = true;
      return true;

    } catch (err) {
      error(`Error probando validación: ${err.message}`);
      return false;
    }
  }

  async testDuplicates() {
    header('PRUEBA 4: MANEJO DE DUPLICADOS');
    
    try {
      // Intentar insertar el mismo email dos veces
      info('Insertando email por primera vez...');
      
      await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, {
        email: 'duplicate@example.com',
        source: 'main_form'
      });
      success('Primera inserción exitosa');

      info('Intentando insertar el mismo email...');
      
      try {
        const response = await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, {
          email: 'duplicate@example.com',
          source: 'cta_final'
        });
        
        // Debería manejar duplicados elegantemente
        if (response.status === 200 || response.status === 409) {
          success('Duplicado manejado correctamente');
        } else {
          warning(`Respuesta inesperada para duplicado: ${response.status}`);
        }
      } catch (err) {
        if (err.response && err.response.status === 409) {
          success('Duplicado rechazado correctamente (409)');
        } else {
          error(`Error inesperado con duplicado: ${err.message}`);
          return false;
        }
      }

      // Verificar que solo hay un registro
      const [rows] = await this.dbConnection.execute(
        "SELECT COUNT(*) as count FROM prelaunch_subscribers WHERE email = 'duplicate@example.com'"
      );

      if (rows[0].count === 1) {
        success('Solo un registro en BD (correcto)');
      } else {
        error(`Se encontraron ${rows[0].count} registros (debería ser 1)`);
        return false;
      }

      this.testResults.duplicates = true;
      return true;

    } catch (err) {
      error(`Error probando duplicados: ${err.message}`);
      return false;
    }
  }

  async testAnalytics() {
    header('PRUEBA 5: CAPTURA DE ANALYTICS');
    
    try {
      // Insertar con datos de analytics
      info('Insertando con datos de analytics...');
      
      const analyticsData = {
        email: 'analytics@example.com',
        source: 'main_form',
        session_id: 'analytics-session-456',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'prelaunch'
      };

      await axios.post(`${API_BASE_URL}/prelaunch/subscribe`, analyticsData);

      // Verificar que los datos de analytics se guardaron
      const [rows] = await this.dbConnection.execute(
        "SELECT utm_source, utm_medium, utm_campaign, session_id FROM prelaunch_subscribers WHERE email = 'analytics@example.com'"
      );

      if (rows.length === 1) {
        const record = rows[0];
        if (record.utm_source === 'google' && 
            record.utm_medium === 'cpc' && 
            record.utm_campaign === 'prelaunch' &&
            record.session_id === 'analytics-session-456') {
          success('Datos de analytics guardados correctamente');
          this.testResults.analytics = true;
          return true;
        } else {
          error('Datos de analytics no coinciden');
          info(`Esperado: google/cpc/prelaunch, Encontrado: ${record.utm_source}/${record.utm_medium}/${record.utm_campaign}`);
          return false;
        }
      } else {
        error('Registro con analytics no encontrado');
        return false;
      }

    } catch (err) {
      error(`Error probando analytics: ${err.message}`);
      return false;
    }
  }

  async cleanup() {
    try {
      // Limpiar datos de prueba
      await this.dbConnection.execute(
        "DELETE FROM prelaunch_subscribers WHERE email LIKE '%@example.com'"
      );
      success('Datos de prueba limpiados');
      
      await this.dbConnection.end();
      success('Conexión cerrada');
    } catch (err) {
      warning(`Error en limpieza: ${err.message}`);
    }
  }

  printSummary() {
    header('RESUMEN DE PRUEBAS');
    
    const results = Object.entries(this.testResults);
    const passed = results.filter(([_, result]) => result).length;
    const total = results.length;

    results.forEach(([test, result]) => {
      const icon = result ? '✅' : '❌';
      const color = result ? 'green' : 'red';
      log(`${icon} ${test.toUpperCase()}: ${result ? 'PASSED' : 'FAILED'}`, color);
    });

    console.log('');
    if (passed === total) {
      log(`🎉 TODAS LAS PRUEBAS PASARON (${passed}/${total})`, 'green');
      log('🚀 Sistema listo para producción', 'green');
    } else {
      log(`❌ ${total - passed} pruebas fallaron de ${total}`, 'red');
      log('🔧 Revisar errores antes de producción', 'red');
    }
  }

  async runAllTests() {
    try {
      await this.init();

      await this.testDatabaseStructure();
      await this.testAPIEndpoints();
      await this.testValidation();
      await this.testDuplicates();
      await this.testAnalytics();

    } catch (err) {
      error(`Error general: ${err.message}`);
    } finally {
      await this.cleanup();
      this.printSummary();
    }
  }
}

// Función principal
async function main() {
  header('🧪 PRUEBAS COMPLETAS DEL SISTEMA PRELAUNCH');
  
  info('Asegúrate de que:');
  info('1. El servidor backend esté corriendo (puerto 3000)');
  info('2. La base de datos esté accesible');
  info('3. Las variables de entorno estén configuradas');
  console.log('');
  
  const tester = new PrelaunchTester();
  await tester.runAllTests();
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(err => {
    error(`Error fatal: ${err.message}`);
    process.exit(1);
  });
}

module.exports = PrelaunchTester;