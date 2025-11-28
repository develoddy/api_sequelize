/**
 * Script para crear la tabla retry_queue
 * 
 * Ejecutar con: node src/scripts/createRetryQueueTable.js
 * 
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 */

import { sequelize } from '../database/database.js';
import RetryQueue from '../models/RetryQueue.js';
import '../models/Associations.js'; // Cargar asociaciones

async function createRetryQueueTable() {
  try {
    console.log('🔄 [SCRIPT] Creando tabla retry_queue...');

    // Autenticar conexión
    await sequelize.authenticate();
    console.log('✅ [SCRIPT] Conexión a DB establecida');

    // Sync solo del modelo RetryQueue
    await RetryQueue.sync({ alter: true });
    
    console.log('✅ [SCRIPT] Tabla retry_queue creada/actualizada exitosamente');
    console.log('\n📋 [SCRIPT] Estructura de la tabla:');
    console.log('   - id (PK)');
    console.log('   - saleId (FK → sales)');
    console.log('   - attemptCount');
    console.log('   - maxAttempts');
    console.log('   - nextRetryAt');
    console.log('   - status (ENUM: pending, processing, resolved, failed, cancelled)');
    console.log('   - errorType (ENUM: temporal, recoverable, critical, unknown)');
    console.log('   - errorCode');
    console.log('   - errorMessage');
    console.log('   - errorData (JSON)');
    console.log('   - lastError');
    console.log('   - retryHistory (JSON)');
    console.log('   - resolvedAt');
    console.log('   - cancelledAt');
    console.log('   - cancelledBy');
    console.log('   - cancelReason');
    console.log('   - priority');
    console.log('   - metadata (JSON)');
    console.log('   - createdAt');
    console.log('   - updatedAt');
    console.log('\n🎉 [SCRIPT] ¡Tabla lista para usar!');

    process.exit(0);

  } catch (error) {
    console.error('❌ [SCRIPT] Error creando tabla:', error);
    process.exit(1);
  }
}

createRetryQueueTable();
