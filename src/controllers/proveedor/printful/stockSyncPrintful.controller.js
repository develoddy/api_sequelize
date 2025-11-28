import { Product } from "../../../models/Product.js";
import { Variedad } from "../../../models/Variedad.js";
import { Op } from 'sequelize';
import { 
  getPrintfulProductsService,
  getPrintfulProductDetail 
} from "../../../services/proveedor/printful/printfulService.js";

/**
 * 🔄 Sincronización completa de stock
 * Actualiza precios, stock y detecta productos discontinuados
 */
export const syncStock = async (req, res) => {
  try {
    console.log('🔄 [STOCK SYNC] Iniciando sincronización completa...');
    
    const stats = {
      total: 0,
      updated: 0,
      discontinued: 0,
      priceChanges: 0,
      errors: []
    };

    // 1️⃣ Obtener productos de Printful
    const printfulProducts = await getPrintfulProductsService();
    stats.total = printfulProducts.length;
    console.log(`📦 [STOCK SYNC] Obtenidos ${stats.total} productos de Printful`);

    // 2️⃣ Obtener productos de la DB con idProduct
    const dbProducts = await Product.findAll({
      where: {
        idProduct: { [Op.ne]: null }
      },
      include: [{
        model: Variedad,
        as: 'variedades'
      }]
    });

    console.log(`💾 [STOCK SYNC] ${dbProducts.length} productos en DB con Printful`);

    // 3️⃣ Crear mapa de productos de Printful para búsqueda rápida
    const printfulMap = new Map();
    printfulProducts.forEach(p => printfulMap.set(p.id, p));

    // 4️⃣ Detectar productos discontinuados
    for (const dbProduct of dbProducts) {
      const printfulId = parseInt(dbProduct.idProduct);
      
      if (!printfulMap.has(printfulId)) {
        // Producto ya no existe en Printful
        await Product.update(
          { 
            state: 0, // Marcar como inactivo
            printful_ignored: true 
          },
          { where: { id: dbProduct.id } }
        );
        stats.discontinued++;
        console.log(`⚠️ [DISCONTINUED] ${dbProduct.title} (ID: ${printfulId})`);
      }
    }

    // 5️⃣ Actualizar precios y stock de productos activos
    for (const dbProduct of dbProducts) {
      const printfulId = parseInt(dbProduct.idProduct);
      
      if (printfulMap.has(printfulId)) {
        try {
          // Obtener detalle completo del producto
          const printfulDetail = await getPrintfulProductDetail(printfulId);
          
          if (!printfulDetail || !printfulDetail.sync_variants) {
            continue;
          }

          // Actualizar variantes
          for (const variant of dbProduct.variedades) {
            const printfulVariant = printfulDetail.sync_variants.find(
              pv => pv.variant_id === variant.variant_id
            );

            if (printfulVariant) {
              const oldPrice = parseFloat(variant.retail_price);
              const newPrice = parseFloat(printfulVariant.retail_price);

              // Detectar cambio de precio
              if (Math.abs(oldPrice - newPrice) > 0.01) {
                stats.priceChanges++;
                console.log(`💰 [PRICE CHANGE] ${dbProduct.title} - ${variant.name}: ${oldPrice} → ${newPrice} ${variant.currency}`);
              }

              // Actualizar variante
              await Variedad.update({
                retail_price: printfulVariant.retail_price,
                currency: printfulVariant.currency,
                sku: printfulVariant.sku,
                name: printfulVariant.name
              }, {
                where: { id: variant.id }
              });
            }
          }

          stats.updated++;

          // Rate limiting: esperar 200ms entre productos
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`❌ Error updating ${dbProduct.title}:`, error.message);
          stats.errors.push({
            product: dbProduct.title,
            error: error.message
          });
        }
      }
    }

    console.log('✅ [STOCK SYNC] Sincronización completada');
    console.log(`📊 Stats: ${stats.updated} actualizados, ${stats.discontinued} discontinuados, ${stats.priceChanges} cambios de precio`);

    return res.status(200).json({
      success: true,
      message: 'Sincronización completada',
      stats
    });

  } catch (error) {
    console.error('❌ [STOCK SYNC] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en sincronización de stock',
      error: error.message
    });
  }
};

/**
 * 📋 Listar productos discontinuados
 */
export const getDiscontinuedProducts = async (req, res) => {
  try {
    console.log('🔍 [DISCONTINUED] Buscando productos discontinuados...');

    const discontinuedProducts = await Product.findAll({
      where: {
        idProduct: { [Op.ne]: null },
        state: 0,
        printful_ignored: true
      },
      attributes: ['id', 'title', 'idProduct', 'portada', 'updatedAt'],
      order: [['updatedAt', 'DESC']]
    });

    console.log(`⚠️ [DISCONTINUED] Encontrados ${discontinuedProducts.length} productos`);

    return res.status(200).json({
      success: true,
      count: discontinuedProducts.length,
      products: discontinuedProducts
    });

  } catch (error) {
    console.error('❌ Error fetching discontinued products:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener productos discontinuados',
      error: error.message
    });
  }
};

/**
 * 💰 Detectar cambios de precio
 * Compara precios actuales de Printful vs DB
 */
export const getPriceChanges = async (req, res) => {
  try {
    console.log('💰 [PRICE CHANGES] Detectando cambios de precio...');

    const priceChanges = [];

    // Obtener productos activos de la DB
    const dbProducts = await Product.findAll({
      where: {
        idProduct: { [Op.ne]: null },
        state: 1
      },
      include: [{
        model: Variedad,
        as: 'variedades',
        where: {
          variant_id: { [Op.ne]: null }
        }
      }],
      limit: 20 // Limitar para no saturar API de Printful
    });

    console.log(`📦 [PRICE CHANGES] Verificando ${dbProducts.length} productos...`);

    for (const dbProduct of dbProducts) {
      try {
        const printfulId = parseInt(dbProduct.idProduct);
        const printfulDetail = await getPrintfulProductDetail(printfulId);

        if (!printfulDetail || !printfulDetail.sync_variants) {
          continue;
        }

        for (const variant of dbProduct.variedades) {
          const printfulVariant = printfulDetail.sync_variants.find(
            pv => pv.variant_id === variant.variant_id
          );

          if (printfulVariant) {
            const oldPrice = parseFloat(variant.retail_price);
            const newPrice = parseFloat(printfulVariant.retail_price);
            const difference = newPrice - oldPrice;

            // Si hay diferencia de precio
            if (Math.abs(difference) > 0.01) {
              priceChanges.push({
                productId: dbProduct.id,
                productTitle: dbProduct.title,
                variantId: variant.id,
                variantName: variant.name,
                oldPrice,
                newPrice,
                difference,
                percentageChange: ((difference / oldPrice) * 100).toFixed(2),
                currency: variant.currency,
                changeType: difference > 0 ? 'increase' : 'decrease'
              });
            }
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`❌ Error checking ${dbProduct.title}:`, error.message);
      }
    }

    console.log(`💰 [PRICE CHANGES] Encontrados ${priceChanges.length} cambios de precio`);

    return res.status(200).json({
      success: true,
      count: priceChanges.length,
      changes: priceChanges
    });

  } catch (error) {
    console.error('❌ Error detecting price changes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al detectar cambios de precio',
      error: error.message
    });
  }
};

/**
 * 🔄 Actualizar producto específico
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 [UPDATE PRODUCT] Actualizando producto ${id}...`);

    const dbProduct = await Product.findOne({
      where: { id },
      include: [{
        model: Variedad,
        as: 'variedades'
      }]
    });

    if (!dbProduct || !dbProduct.idProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado o no está sincronizado con Printful'
      });
    }

    const printfulId = parseInt(dbProduct.idProduct);
    const printfulDetail = await getPrintfulProductDetail(printfulId);

    if (!printfulDetail) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado en Printful (posiblemente discontinuado)'
      });
    }

    // Actualizar variantes
    let updatedVariants = 0;
    for (const variant of dbProduct.variedades) {
      const printfulVariant = printfulDetail.sync_variants.find(
        pv => pv.variant_id === variant.variant_id
      );

      if (printfulVariant) {
        await Variedad.update({
          retail_price: printfulVariant.retail_price,
          currency: printfulVariant.currency,
          sku: printfulVariant.sku,
          name: printfulVariant.name
        }, {
          where: { id: variant.id }
        });
        updatedVariants++;
      }
    }

    console.log(`✅ [UPDATE PRODUCT] ${dbProduct.title} actualizado (${updatedVariants} variantes)`);

    return res.status(200).json({
      success: true,
      message: 'Producto actualizado correctamente',
      updatedVariants
    });

  } catch (error) {
    console.error('❌ Error updating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar producto',
      error: error.message
    });
  }
};

/**
 * 📊 Obtener estadísticas de stock
 */
export const getStockStats = async (req, res) => {
  try {
    console.log('📊 [STOCK STATS] Calculando estadísticas...');

    // Total productos sincronizados
    const totalSynced = await Product.count({
      where: { idProduct: { [Op.ne]: null } }
    });

    // Productos activos
    const active = await Product.count({
      where: { 
        idProduct: { [Op.ne]: null },
        state: 1 
      }
    });

    // Productos discontinuados
    const discontinued = await Product.count({
      where: { 
        idProduct: { [Op.ne]: null },
        state: 0,
        printful_ignored: true
      }
    });

    // Productos sin stock (puedes agregar lógica según tu modelo)
    const outOfStock = await Product.count({
      where: { 
        idProduct: { [Op.ne]: null },
        stock: 0
      }
    });

    const stats = {
      totalSynced,
      active,
      discontinued,
      outOfStock,
      lastSync: new Date().toISOString()
    };

    console.log('✅ [STOCK STATS] Estadísticas calculadas:', stats);

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching stock stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};
