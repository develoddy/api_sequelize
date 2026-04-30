/**
 * ============================================
 * BACKFILL: SNAPSHOTS EN SALE_DETAILS
 * ============================================
 * Objetivo: Poblar campos de snapshot en registros existentes
 * Ejecución: node scripts/backfill-sale-details-snapshots.js
 * ============================================
 */

import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Product } from '../src/models/Product.js';
import { Variedad } from '../src/models/Variedad.js';
import { sequelize } from '../src/database/database.js';

const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes('--dry-run');

async function backfillSaleDetailsSnapshots() {
  try {
    console.log('🚀 [BACKFILL] Iniciando backfill de snapshots...');
    console.log(`📊 [BACKFILL] Modo: ${DRY_RUN ? 'DRY RUN (no guardará cambios)' : 'PRODUCTION'}`);
    
    // 1️⃣ Encontrar sale_details sin snapshot
    const saleDetailsWithoutSnapshot = await SaleDetail.findAll({
      where: {
        product_name: null // o product_image: null
      },
      include: [
        {
          model: Product,
          as: 'product_reference',
          required: false // LEFT JOIN
        },
        {
          model: Variedad,
          as: 'variant_reference',
          required: false
        }
      ],
      limit: BATCH_SIZE
    });

    console.log(`📦 [BACKFILL] Encontrados ${saleDetailsWithoutSnapshot.length} registros sin snapshot`);

    if (saleDetailsWithoutSnapshot.length === 0) {
      console.log('✅ [BACKFILL] No hay registros para procesar');
      return;
    }

    // 2️⃣ Procesar cada registro
    let processed = 0;
    let errors = 0;

    for (const detail of saleDetailsWithoutSnapshot) {
      try {
        // Extraer snapshot de product (si existe)
        const product = detail.product_reference;
        const variant = detail.variant_reference;

        const snapshot = {
          product_name: product?.title || 'Unknown Product',
          product_image: product?.portada || '',
          variant_name: variant?.name || null,
          product_sku: product?.sku || null
        };

        console.log(`📝 [BACKFILL] Procesando SaleDetail ID ${detail.id}:`, snapshot);

        if (!DRY_RUN) {
          await detail.update(snapshot);
        }

        processed++;
      } catch (error) {
        console.error(`❌ [BACKFILL] Error procesando SaleDetail ID ${detail.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n============================================');
    console.log(`✅ [BACKFILL] Completado`);
    console.log(`   - Procesados: ${processed}`);
    console.log(`   - Errores: ${errors}`);
    console.log(`   - Modo: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
    console.log('============================================\n');

    // 3️⃣ Si quedan más, informar
    const remaining = await SaleDetail.count({
      where: { product_name: null }
    });

    if (remaining > 0) {
      console.log(`⚠️ [BACKFILL] Quedan ${remaining} registros por procesar`);
      console.log('   Ejecuta el script nuevamente para continuar');
    }

  } catch (error) {
    console.error('❌ [BACKFILL] Error fatal:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
backfillSaleDetailsSnapshots()
  .then(() => {
    console.log('🎉 [BACKFILL] Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 [BACKFILL] Script falló:', error);
    process.exit(1);
  });
