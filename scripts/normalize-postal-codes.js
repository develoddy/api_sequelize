#!/usr/bin/env node
'use strict';

/**
 * Script para normalizar archivos JSON de códigos postales
 * - Aplica normalización NFC para preservar acentos
 * - Detecta y reporta caracteres corruptos
 * - Genera archivo normalizado y reporte de errores
 * 
 * Uso:
 *   node normalize-postal-codes.js postal-codes-ES.json
 *   node normalize-postal-codes.js postal-codes-*.json
 */

const fs = require('fs');
const path = require('path');

function normalizeNFC(str) {
  if (!str) return '';
  return str.toString().normalize('NFC').trim();
}

function hasCorruptedChars(str) {
  if (!str) return false;
  return str.includes('�') || str.includes('\uFFFD');
}

function normalizeFile(inputPath) {
  console.log(`\n📄 Procesando: ${path.basename(inputPath)}`);
  
  const content = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(content);
  
  const stats = { total: data.length, normalized: 0, corrupted: 0 };
  const corruptedRecords = [];
  const normalizedData = [];
  
  for (const item of data) {
    if (hasCorruptedChars(item.province) || hasCorruptedChars(item.city)) {
      stats.corrupted++;
      corruptedRecords.push(item);
    }
    
    normalizedData.push({
      ...item,
      province: normalizeNFC(item.province),
      city: normalizeNFC(item.city)
    });
    stats.normalized++;
  }
  
  const outputPath = inputPath.replace('.json', '-normalized.json');
  fs.writeFileSync(outputPath, JSON.stringify(normalizedData, null, 2), 'utf8');
  
  console.log(`✅ Normalizados: ${stats.normalized}/${stats.total}`);
  console.log(`⚠️  Corruptos: ${stats.corrupted}`);
  console.log(`💾 Guardado en: ${outputPath}`);
  
  if (corruptedRecords.length > 0) {
    const reportPath = inputPath.replace('.json', '-corrupted.json');
    fs.writeFileSync(reportPath, JSON.stringify(corruptedRecords, null, 2), 'utf8');
    console.log(`📋 Reporte: ${reportPath}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Uso: node normalize-postal-codes.js <archivo.json>');
  process.exit(1);
}

args.forEach(normalizeFile);
