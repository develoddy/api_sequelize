'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Seeder para cargar códigos postales de múltiples países con normalización UTF-8 y validación
 * 
 * Características:
 * - Normalización NFC para preservar acentos (Málaga, Álava, Cádiz)
 * - Detección de caracteres corruptos (�, \uFFFD)
 * - Inserción en batches de 1000 registros
 * - Logs de progreso cada 10 batches
 * - Estadísticas detalladas por país
 * - Validación de campos requeridos
 * 
 * Archivos esperados:
 * - /api/data/postal-codes-ES.json (~52,000 registros)
 * - /api/data/postal-codes-FR.json (~40,000 registros)
 */

// Configuración
const BATCH_SIZE = 1000;
const LOG_INTERVAL = 10; // Log cada X batches

// Archivos de datos
const dataPath = path.join(__dirname, '..', 'data');
const jsonFiles = [
  { file: 'postal-codes-ES.json', country: 'ES', name: 'España' },
];

/**
 * Normaliza una cadena con NFC para preservar acentos
 */
function normalizeNFC(str) {
  if (!str) return '';
  return str.toString().normalize('NFC').trim();
}

/**
 * Detecta caracteres corruptos (� o Unicode replacement char)
 */
function hasCorruptedChars(str) {
  if (!str) return false;
  const normalized = str.toString();
  return normalized.includes('�') || normalized.includes('\uFFFD');
}

/**
 * Normaliza para búsquedas (sin acentos, minúsculas)
 */
function normalizeForSearch(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')       // quitar caracteres no alfanuméricos
    .trim();
}

/**
 * Valida que un registro tenga todos los campos requeridos
 */
function isValidRecord(item) {
  return item.postal_code && 
         item.province && 
         item.city && 
         item.country;
}

/**
 * Procesa un array de registros con validación, normalización y eliminación de duplicados
 */
function processRecords(data, country) {
  const stats = {
    total: data.length,
    valid: 0,
    invalid: 0,
    corrupted: 0,
    duplicates: 0,
    corruptedRecords: []
  };

  const validRecords = [];
  const seen = new Set(); // Para detectar duplicados: country|postal_code|city_normalized

  for (const item of data) {
    // Validar campos requeridos
    if (!isValidRecord(item)) {
      stats.invalid++;
      continue;
    }

    // Detectar caracteres corruptos
    if (hasCorruptedChars(item.province) || hasCorruptedChars(item.city)) {
      stats.corrupted++;
      stats.corruptedRecords.push({
        postal_code: item.postal_code,
        city: item.city,
        province: item.province
      });
      continue;
    }

    // Normalizar y crear registro válido
    const province = normalizeNFC(item.province);
    const city = normalizeNFC(item.city);
    const city_normalized = normalizeForSearch(city);
    
    // Verificar duplicados (mismo país + CP + ciudad normalizada)
    const uniqueKey = `${country}|${item.postal_code}|${city_normalized}`;
    if (seen.has(uniqueKey)) {
      stats.duplicates++;
      continue;
    }
    seen.add(uniqueKey);
    
    validRecords.push({
      postal_code: item.postal_code.toString().trim(),
      province: province,
      city: city,
      country: country,
      city_normalized: city_normalized,
      is_primary: item.is_primary !== undefined ? item.is_primary : true,
      created_at: new Date(),
      updated_at: new Date()
    });

    stats.valid++;
  }

  return { validRecords, stats };
}

/**
 * Inserta registros en batches con logs de progreso
 */
async function insertInBatches(queryInterface, records, countryName) {
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  let insertedCount = 0;

  console.log(`\n🔄 Insertando ${records.length} registros de ${countryName} en ${totalBatches} batches...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    await queryInterface.bulkInsert('postal_codes', batch, {});
    insertedCount += batch.length;

    // Log de progreso cada LOG_INTERVAL batches
    if (batchNumber % LOG_INTERVAL === 0 || batchNumber === totalBatches) {
      const percentage = ((insertedCount / records.length) * 100).toFixed(1);
      console.log(`   ✓ Batch ${batchNumber}/${totalBatches} completado (${insertedCount}/${records.length} - ${percentage}%)`);
    }
  }

  console.log(`✅ ${countryName}: ${insertedCount} registros insertados correctamente`);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('\n========================================');
    console.log('📦 CARGA DE CÓDIGOS POSTALES - MULTI-PAÍS');
    console.log('========================================');

    const globalStats = {
      totalProcessed: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalCorrupted: 0,
      allCorruptedRecords: []
    };

    for (const fileConfig of jsonFiles) {
      const { file, country, name } = fileConfig;
      const filePath = path.join(dataPath, file);

      console.log(`\n🌍 Procesando ${name} (${country})...`);

      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: No se encontró el archivo ${file}`);
        console.error(`   Ruta esperada: ${filePath}`);
        console.log(`   💡 Coloca el archivo JSON en la carpeta /api/data/`);
        continue;
      }

      try {
        // Leer y parsear JSON
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        if (!Array.isArray(data)) {
          console.error(`❌ Error: ${file} no contiene un array válido`);
          continue;
        }

        console.log(`   �� Archivo leído: ${data.length} registros encontrados`);

        // Procesar registros con validación y normalización
        const { validRecords, stats } = processRecords(data, country);

        // Actualizar estadísticas globales
        globalStats.totalProcessed += stats.total;
        globalStats.totalValid += stats.valid;
        globalStats.totalInvalid += stats.invalid;
        globalStats.totalCorrupted += stats.corrupted;
        globalStats.allCorruptedRecords.push(...stats.corruptedRecords);

        // Mostrar estadísticas del procesamiento
        console.log(`   ✓ Registros válidos: ${stats.valid}`);
        if (stats.invalid > 0) {
          console.log(`   ⚠️  Registros inválidos (campos faltantes): ${stats.invalid}`);
        }
        if (stats.duplicates > 0) {
          console.log(`   🔄 Duplicados omitidos: ${stats.duplicates}`);
        }
        if (stats.corrupted > 0) {
          console.log(`   ⚠️  Registros con caracteres corruptos (�): ${stats.corrupted}`);
          console.log(`      Primeros 5 corruptos:`, stats.corruptedRecords.slice(0, 5));
        }

        // Insertar registros válidos en batches
        if (validRecords.length > 0) {
          await insertInBatches(queryInterface, validRecords, name);
        } else {
          console.log(`   ⚠️  No hay registros válidos para insertar`);
        }

      } catch (error) {
        console.error(`❌ Error procesando ${name}:`, error.message);
        continue;
      }
    }

    // Resumen final
    console.log('\n========================================');
    console.log('📊 RESUMEN FINAL');
    console.log('========================================');
    console.log(`Total procesado:     ${globalStats.totalProcessed.toLocaleString()}`);
    console.log(`✅ Válidos insertados: ${globalStats.totalValid.toLocaleString()}`);
    if (globalStats.totalInvalid > 0) {
      console.log(`⚠️  Inválidos:          ${globalStats.totalInvalid.toLocaleString()}`);
    }
    if (globalStats.totalCorrupted > 0) {
      console.log(`⚠️  Corruptos:          ${globalStats.totalCorrupted.toLocaleString()}`);
    }

    const successRate = ((globalStats.totalValid / globalStats.totalProcessed) * 100).toFixed(2);
    console.log(`Tasa de éxito:       ${successRate}%`);

    // Guardar reporte de registros corruptos
    if (globalStats.allCorruptedRecords.length > 0) {
      const reportPath = path.join(dataPath, 'corrupted-records-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify(globalStats.allCorruptedRecords, null, 2),
        'utf8'
      );
      console.log(`\n📄 Reporte de corruptos guardado en: ${reportPath}`);
    }

    console.log('\n✅ Seeder completado');
    console.log('========================================\n');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('\n🗑️  Eliminando códigos postales de múltiples países...');
    
    const countries = jsonFiles.map(f => f.country);
    
    await queryInterface.bulkDelete('postal_codes', {
      country: {
        [Sequelize.Op.in]: countries
      }
    }, {});
    console.log(`✅ Códigos postales eliminados para: ${countries.join(', ')}\n`);
  }
};
