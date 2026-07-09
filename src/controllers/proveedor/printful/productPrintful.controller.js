import axios from "axios";
import { Op } from 'sequelize';
import { Product } from "../../../models/Product.js";
import { Categorie } from "../../../models/Categorie.js";
import { sequelize } from '../../../database/database.js';
import { Galeria } from "../../../models/Galeria.js";
import { Variedad } from "../../../models/Variedad.js";
import { ProductVariants } from "../../../models/ProductVariants.js";
import { SaleDetail } from "../../../models/SaleDetail.js";
import { File } from "../../../models/File.js";
import { Option } from "../../../models/Option.js";
import { Cart } from "../../../models/Cart.js";
import { Wishlist } from "../../../models/Wishlist.js";
import fs from 'fs';
import path from "path";
import {
  getPrintfulProductsService,
  getPrintfulProductDetail,
  getPrintfulCatalogProductDetail,
  getPrintfulCategory,
  createPrintfulOrderService,
} from '../../../services/proveedor/printful/printfulService.js';

import  {
  removeImageVersion  ,
  downloadImage       ,
  convertWhiteToTransparent,
  extractSKU          ,
  generateSlug        ,
  removeRepeatedColors,
  processGalleryImage,
} from "./helper.js";

// controllers/productPrintful.controller.js
import { generarDescripcionPorCategoria } from '../../helpers/productDescription.helper.js';


let idMapping = { products: {}, variedades: {} };

export const list = async( req, res ) => {
  try{
    // Si se solicita con ?source=db, devolver productos de la base de datos
    if (req.query.source === 'db') {
      const dbProducts = await Product.findAll({
        where: {
          idProduct: {
            [Op.ne]: null // Productos que tienen idProduct (sincronizados con Printful)
          }
        },
        include: [
          {
            model: Variedad,
            as: 'variedades',
            where: {
              variant_id: {
                [Op.ne]: null
              }
            },
            required: false,
            attributes: ['id', 'variant_id', 'name', 'valor', 'sku', 'retail_price']
          }
        ],
        attributes: ['id', 'title', 'idProduct', 'portada']
      });

      return res.status(200).json({
        products: dbProducts
      });
    }

    // Por defecto, devolver productos desde Printful API
    const products = await getPrintfulProductsService();
    res.status( 200 ).json({
        products: products,
    });
  } catch (error) {
    console.error('Error al traer los productos de Printful:', error);
    res.status(500).json({
      message: 'Error al traer los productos de Printful',
      error: error.message
    });
  }
}

export const show = async( req, res ) => {
  try{
    let product_id = req.params.id;
    const product = await getPrintfulProductDetail(product_id);

    // Modificar el JSON para establecer visible a true en cada archivo
    product.sync_variants.forEach(variant => {
      variant.files.forEach(file => {
        file.visible = true;
      });
    });

    res.status( 200 ).json({
        product: product,
    });
  } catch (error) {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
  }
}

/*
 * ==================================================================================================
 * =                                  PROCESAMIENTO DEL PROVEEDOR PRINTFUL                          =
 * =================================================================================================*/


export const getPrintfulProducts = async (options = {}) => {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const emitProgress = (payload) => {
    if (onProgress) {
      onProgress({
        timestamp: new Date().toISOString(),
        ...payload
      });
    }
  };

  // Estadísticas de sincronización
  const stats = {
    total: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    errors: []
  };

  let transaction;
  
  try {
    console.log('📥 [STEP 1] Obteniendo productos de Printful...');
    emitProgress({ type: 'phase', phase: 'fetching', message: '📥 Obteniendo productos desde Printful...' });
    
    // 1️⃣ OBTENER PRODUCTOS DE PRINTFUL
    const printfulProducts = await getPrintfulProductsService();
    
    // Validar que obtuvimos productos
    if (!printfulProducts || printfulProducts.length === 0) {
      console.warn('⚠️ No se obtuvieron productos de Printful');
      emitProgress({ type: 'phase', phase: 'empty', message: '⚠️ Printful devolvió 0 productos' });
      return stats;
    }
    
    stats.total = printfulProducts.length;
    console.log(`✅ [STEP 1] Obtenidos ${stats.total} productos de Printful`);
    emitProgress({ type: 'phase', phase: 'fetched', total: stats.total, message: `✅ Productos obtenidos: ${stats.total}` });

    // 2️⃣ INICIAR TRANSACCIÓN
    console.log('💾 [STEP 2] Iniciando transacción SQL...');
    emitProgress({ type: 'phase', phase: 'transaction_start', message: '💾 Iniciando transacción de base de datos...' });
    transaction = await sequelize.transaction();

    // 3️⃣ IDENTIFICAR PRODUCTOS OBSOLETOS
    console.log('🔍 [STEP 3] Identificando productos obsoletos en DB...');
    emitProgress({ type: 'phase', phase: 'detecting_obsolete', message: '🔍 Buscando productos obsoletos...' });
    const printfulProductIds = printfulProducts.map(product => product.id);
    
    // Productos que:
    // 1. Tienen idProduct (vienen de Printful)
    // 2. Su idProduct NO está en la lista actual de Printful
    // 3. Por lo tanto, ya no existen en Printful y deben eliminarse
    const productsToDelete = await Product.findAll({
      where: { 
        idProduct: {
          [Op.notIn]: printfulProductIds,  // No está en la lista actual de Printful
          [Op.ne]: null                     // Y tiene idProduct (es de Printful)
        }
      },
      transaction
    });

    console.log(`🗑️ [STEP 3] Productos obsoletos encontrados: ${productsToDelete.length}`);
    emitProgress({ type: 'phase', phase: 'obsolete_detected', obsolete: productsToDelete.length, message: `🗑️ Productos obsoletos: ${productsToDelete.length}` });
    if (productsToDelete.length > 0) {
      console.log(`   Productos a eliminar:`, productsToDelete.map(p => `${p.title} (ID Printful: ${p.idProduct})`));
    }

    // 4️⃣ ELIMINAR PRODUCTOS OBSOLETOS
    if (productsToDelete.length > 0) {
      console.log('🧹 [STEP 4] Eliminando productos obsoletos...');
      emitProgress({ type: 'phase', phase: 'deleting_obsolete', message: '🧹 Eliminando productos obsoletos...' });
      
      for (const product of productsToDelete) {
        try {
          console.log(`  🗑️ Eliminando: ${product.title} (ID: ${product.id})`);
          await deleteProductAndRelatedComponents(product, transaction);
          stats.deleted++;
          emitProgress({
            type: 'delete',
            deleted: stats.deleted,
            obsoleteTotal: productsToDelete.length,
            productId: product.idProduct,
            productName: product.title,
            message: `🗑️ Eliminado obsoleto: ${product.title}`
          });
        } catch (error) {
          console.error(`  ❌ Error eliminando producto ${product.id}:`, error.message);
          stats.errors.push({
            type: 'DELETE',
            productId: product.id,
            productName: product.title,
            message: error.message
          });
        }
      }
      
      console.log(`✅ [STEP 4] Eliminados: ${stats.deleted} productos`);
    } else {
      console.log('✅ [STEP 4] No hay productos para eliminar');
    }

    // 5️⃣ PROCESAR PRODUCTOS DE PRINTFUL (CREATE/UPDATE)
    console.log(`🔄 [STEP 5] Procesando ${printfulProducts.length} productos de Printful...`);
    console.log(`   Estos productos se crearán (si son nuevos) o se actualizarán (si ya existen)`);
    emitProgress({ type: 'phase', phase: 'processing_products', total: printfulProducts.length, message: `🔄 Procesando ${printfulProducts.length} productos...` });
    
    for (let i = 0; i < printfulProducts.length; i++) {
      const product = printfulProducts[i];
      
      try {
        // Rate limiting: esperar 300ms cada 10 productos
        if (i > 0 && i % 10 === 0) {
          console.log(`  ⏸️ Pausa de rate limiting (${i}/${printfulProducts.length})`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const existingProduct = await Product.findOne({ 
          where: { idProduct: product.id },
          transaction
        });

        if (!existingProduct) {
          // CREAR NUEVO PRODUCTO (no existe en DB)
          console.log(`  ➕ [${i + 1}/${printfulProducts.length}] CREAR NUEVO: "${product.name}" (Printful ID: ${product.id})`);
          await processPrintfulProduct(product, transaction);
          stats.created++;
          emitProgress({
            type: 'product',
            action: 'created',
            processed: i + 1,
            total: printfulProducts.length,
            productId: product.id,
            productName: product.name,
            message: `➕ ${i + 1}/${printfulProducts.length} creado: ${product.name}`
          });
          
        } else {
          // PRODUCTO EXISTE - VERIFICAR SI HAY CAMBIOS
          console.log(`  🔍 [${i + 1}/${printfulProducts.length}] Verificando cambios: "${product.name}" (DB ID: ${existingProduct.id}, Printful ID: ${product.id})`);
          const hasChanges = await checkProductChanges(existingProduct, product);
          
          if (hasChanges) {
            console.log(`  🔄 [${i + 1}/${printfulProducts.length}] ACTUALIZAR: "${product.name}" (cambios detectados - ver detalles arriba)`);
            await processPrintfulProduct(product, transaction);
            stats.updated++;
            emitProgress({
              type: 'product',
              action: 'updated',
              processed: i + 1,
              total: printfulProducts.length,
              productId: product.id,
              productName: product.name,
              message: `🔄 ${i + 1}/${printfulProducts.length} actualizado: ${product.name}`
            });
          } else {
            console.log(`  ✅ [${i + 1}/${printfulProducts.length}] SIN CAMBIOS: "${product.name}" (producto idéntico - SKIP)`);
            stats.skipped++;
            emitProgress({
              type: 'product',
              action: 'skipped',
              processed: i + 1,
              total: printfulProducts.length,
              productId: product.id,
              productName: product.name,
              message: `✅ ${i + 1}/${printfulProducts.length} sin cambios: ${product.name}`
            });
          }
        }
        
      } catch (error) {
        console.error(`  ❌ Error procesando producto ${product.id}:`, error.message);
        stats.errors.push({
          type: 'PROCESS',
          productId: product.id,
          productName: product.name,
          message: error.message
        });
      }
    }

    console.log(`✅ [STEP 5] Procesamiento completado`);
    console.log(`   • Creados: ${stats.created}`);
    console.log(`   • Actualizados: ${stats.updated}`);
    console.log(`   • Sin cambios: ${stats.skipped}`);

    // 6️⃣ COMMIT TRANSACCIÓN
    console.log('💾 [STEP 6] Realizando commit de transacción...');
    emitProgress({ type: 'phase', phase: 'commit', message: '💾 Guardando cambios en base de datos...' });
    await transaction.commit();
    console.log('✅ [STEP 6] Transacción completada exitosamente');
    
    // 7️⃣ VALIDAR INTEGRIDAD
    console.log('🔍 [STEP 7] Validando integridad de base de datos...');
    emitProgress({ type: 'phase', phase: 'integrity_check', message: '🔍 Validando integridad de base de datos...' });
    await validateDatabaseIntegrity();
    console.log('✅ [STEP 7] Validación completada');

    // 8️⃣ RETORNAR ESTADÍSTICAS
    console.log('📊 [RESUMEN FINAL]');
    console.log(`   Total procesados: ${stats.total}`);
    console.log(`   ✅ Creados: ${stats.created}`);
    console.log(`   🔄 Actualizados: ${stats.updated}`);
    console.log(`   🗑️ Eliminados: ${stats.deleted}`);
    console.log(`   ⏭️ Sin cambios: ${stats.skipped}`);
    console.log(`   ❌ Errores: ${stats.errors.length}`);
    emitProgress({ type: 'summary', stats, message: '📊 Resumen de sincronización generado' });

    return stats;

  } catch (error) {
    // 9️⃣ ROLLBACK EN CASO DE ERROR
    if (transaction) {
      try {
        await transaction.rollback();
        console.error('🔙 Rollback realizado debido a error crítico');
      } catch (rollbackError) {
        console.error('❌ Error durante rollback:', rollbackError);
      }
    }
    
    console.error('❌ Error crítico en sincronización:', error);
    emitProgress({ type: 'error', message: `❌ Error crítico: ${error.message}` });
    throw new Error(`Error en sincronización Printful: ${error.message}`);
  }
};

const productCompareState = (product) => {
  return product.is_ignored ? 1 : 2;
};


// Función auxiliar para extraer el precio de sincronización (ejemplo)
const productDetailSyncPrice = (product) => {
  return product.sync_variants && product.sync_variants[0] ? product.sync_variants[0].retail_price : null;
};


/**
 * Verifica si un producto tiene cambios que requieren actualización
 * Compara: título, estado, precio, tags
 */
const checkProductChanges = async (existingProduct, printfulProduct) => {
  try {
    console.log(`    🔎 Iniciando comparación detallada...`);
    
    // 1. Comparar título
    console.log(`    📝 Título: "${existingProduct.title}" vs "${printfulProduct.name}"`);
    if (existingProduct.title !== printfulProduct.name) {
      console.log(`    🔄 ⚠️ CAMBIO DETECTADO: título diferente`);
      return true;
    }
    
    // 2. Comparar estado (ignored)
    const newState = productCompareState(printfulProduct);
    console.log(`    🏷️ Estado: ${existingProduct.state} vs ${newState}`);
    if (existingProduct.state !== newState) {
      console.log(`    🔄 ⚠️ CAMBIO DETECTADO: estado diferente`);
      return true;
    }
    
    // 3. Obtener detalles del producto para comparar precio y tags
    const productDetail = await getPrintfulProductDetail(printfulProduct.id);
    
    // 4. Comparar precio (convertir a número para evitar problemas de tipo)
    const newPrice = parseFloat(productDetail.sync_variants[0]?.retail_price || 0);
    const existingPrice = parseFloat(existingProduct.price_soles || 0);
    console.log(`    💰 Precio: ${existingPrice} (${typeof existingPrice}) vs ${newPrice} (${typeof newPrice})`);
    if (existingPrice !== newPrice) {
      console.log(`    🔄 ⚠️ CAMBIO DETECTADO: precio diferente`);
      return true;
    }
    
    // 5. Comparar tags (colores) - ORDENADOS para evitar falsos positivos
    const newColorsArray = await removeRepeatedColors(
      productDetail.sync_variants.map(v => v.color).filter(Boolean)
    );
    const newTags = JSON.stringify(newColorsArray.sort()); // Ordenar para comparación consistente
    
    // Ordenar tags existentes también
    let existingTagsArray = [];
    try {
      existingTagsArray = JSON.parse(existingProduct.tags || '[]');
      if (Array.isArray(existingTagsArray)) {
        existingTagsArray.sort();
      }
    } catch (e) {
      console.log(`    ⚠️ Error parseando tags existentes, usando array vacío`);
      existingTagsArray = [];
    }
    const existingTags = JSON.stringify(existingTagsArray);
    
    console.log(`    🏷️ Tags: ${existingTags} vs ${newTags}`);
    if (existingTags !== newTags) {
      console.log(`    🔄 ⚠️ CAMBIO DETECTADO: tags diferentes`);
      return true;
    }
    
    // 6. Comparar cantidad de variantes
    const existingVariantsCount = await Variedad.count({
      where: { productId: existingProduct.id }
    });
    
    console.log(`    🔢 Variantes: ${existingVariantsCount} vs ${productDetail.sync_variants.length}`);
    if (existingVariantsCount !== productDetail.sync_variants.length) {
      console.log(`    🔄 ⚠️ CAMBIO DETECTADO: cantidad de variantes diferente`);
      return true;
    }
    
    // No hay cambios detectados
    console.log(`    ✅ NO HAY CAMBIOS - Producto idéntico`);
    return false;
    
  } catch (error) {
    console.error(`    ❌ ERROR en checkProductChanges:`, error.message);
    console.error(`    ⚠️ Stack:`, error.stack);
    // En caso de error, retornar false y hacer skip (mejor perder una actualización que forzar una innecesaria)
    console.log(`    ⏭️ Por seguridad, marcando como SIN CAMBIOS debido al error`);
    return false;
  }
};


/**
 * Valida la integridad de la base de datos después de la sincronización
 * Detecta: productos sin variantes, variantes sin archivos, categorías huérfanas
 */
const validateDatabaseIntegrity = async () => {
  const issues = [];
  
  try {
    // 1️⃣ Verificar productos sin variantes
    const productsWithoutVariants = await sequelize.query(`
      SELECT p.id, p.title, p.idProduct
      FROM products p
      LEFT JOIN variedades v ON v.productId = p.id
      WHERE v.id IS NULL
      AND p.idProduct IS NOT NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (productsWithoutVariants.length > 0) {
      console.warn(`⚠️ ${productsWithoutVariants.length} productos sin variantes detectados`);
      issues.push({
        type: 'PRODUCTS_WITHOUT_VARIANTS',
        count: productsWithoutVariants.length,
        products: productsWithoutVariants.map(p => ({ id: p.id, title: p.title }))
      });
    }

    // 2️⃣ Verificar variantes sin archivos
    const variedadesWithoutFiles = await sequelize.query(`
      SELECT v.id, v.sku, v.productId
      FROM variedades v
      LEFT JOIN files f ON f.varietyId = v.id
      WHERE f.id IS NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (variedadesWithoutFiles.length > 0) {
      console.warn(`⚠️ ${variedadesWithoutFiles.length} variedades sin archivos detectadas`);
      issues.push({
        type: 'VARIANTS_WITHOUT_FILES',
        count: variedadesWithoutFiles.length
      });
    }

    // 3️⃣ Verificar y limpiar categorías huérfanas
    const orphanCategories = await sequelize.query(`
      SELECT c.id, c.title
      FROM categories c
      LEFT JOIN products p ON p.categoryId = c.id
      WHERE p.id IS NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (orphanCategories.length > 0) {
      console.warn(`⚠️ ${orphanCategories.length} categorías sin productos detectadas`);
      console.log(`🧹 Eliminando categorías huérfanas...`);
      
      for (const cat of orphanCategories) {
        try {
          await Categorie.destroy({ where: { id: cat.id } });
          console.log(`  ✅ Categoría eliminada: ${cat.title}`);
        } catch (error) {
          console.error(`  ❌ Error eliminando categoría ${cat.id}:`, error.message);
        }
      }
      
      issues.push({
        type: 'ORPHAN_CATEGORIES_CLEANED',
        count: orphanCategories.length
      });
    }

    // 4️⃣ Verificar productos duplicados (mismo idProduct)
    const duplicateProducts = await sequelize.query(`
      SELECT idProduct, COUNT(*) as count
      FROM products
      WHERE idProduct IS NOT NULL
      GROUP BY idProduct
      HAVING COUNT(*) > 1
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (duplicateProducts.length > 0) {
      console.error(`❌ ${duplicateProducts.length} productos duplicados detectados!`);
      issues.push({
        type: 'DUPLICATE_PRODUCTS',
        count: duplicateProducts.length,
        duplicates: duplicateProducts
      });
    }

    // Resumen de validación
    if (issues.length === 0) {
      console.log('✅ No se detectaron problemas de integridad');
    } else {
      console.log(`⚠️ Se detectaron ${issues.length} tipos de problemas de integridad`);
    }

    return issues;
    
  } catch (error) {
    console.error('❌ Error en validación de integridad:', error);
    return [];
  }
};


/*
 * Esta función procesa un producto de Printful.
 * Obtiene detalles del producto desde Printful usando su ID.
 * Obtiene o crea una categoría para el producto.
 * Obtiene o crea el producto en la base de datos local.
 * Crea o actualiza variantes y galerías del producto.
 */
const processPrintfulProduct = async (product, transaction) => {
  try {
    const productDetail = await getPrintfulProductDetail(product.id);
    const category = await getOrCreateCategory(productDetail, transaction);
    const existingProduct = await getOrCreateProduct(product, productDetail, category, transaction);

    if (existingProduct) {
      await createOrUpdateVariants(existingProduct.id, productDetail.sync_variants, transaction);
    }

  } catch (error) {
    console.error(`Error processing Printful product ${product.id}:`, error);
    throw new Error(`Error processing Printful product: ${error.message}`);
  }
};

/*
 * Obtiene la categoría asociada a un producto de Printful.
 * Verifica si la categoría ya existe en la base de datos local.
 * Si no existe, la crea.
 * Devuelve la categoría existente o recién creada.
 */
const getOrCreateCategory = async (productDetail, transaction) => {
  const categoryResponse = await getPrintfulCategory(productDetail.sync_variants[0].main_category_id);
  const category = categoryResponse.category;

  let existingCategory = await Categorie.findOne({
    where: { title: category.title },
    transaction
  });

  if (!existingCategory) {
    existingCategory = await createCategory(category, transaction);
  }

  return existingCategory;
};

/*
 * Crea una nueva categoría en la base de datos local.
 * Descarga y guarda la imagen de la categoría si está disponible.
 */
const createCategory = async (category, transaction) => {
  let portada_name = '';

  if (category.image_url) {
    var img_path = category.image_url;
    var name = img_path.split('/');
    portada_name = await removeImageVersion(name[name.length - 1]) + '.png';
    const uploadDir = path.resolve('./src/uploads/categorie');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const imagePath = path.join(uploadDir, portada_name);
    await downloadImage(img_path, imagePath);
  }

  return await Categorie.create({
    title: category.title,
    imagen: portada_name,
    state: 1, // 1 = ACTIVE for categories (different from products)
  }, { transaction });
};


// Obtiene o crea un producto solo si es necesario
const getOrCreateProduct = async (product, productDetail, category, transaction) => {
  let existingProduct = await Product.findOne({ 
    where: { idProduct: product.id },
    transaction
  });

  if (!existingProduct) {
    return await createProduct(product, productDetail, category, transaction);
  }

  return await updateProductIfNeeded(existingProduct, product, productDetail, category, transaction);
};


// Crea un producto si no existe
const createProduct = async (product, productDetail, category, transaction) => {
  const portada_name = await handleProductImage(product.thumbnail_url);

  // Tomamos el variant_id de la primera variante
  const productId = productDetail.sync_variants[0].product.product_id;

  // Llamada extra al catálogo para obtener la descripción
  const catalogResponse = await getPrintfulCatalogProductDetail(productId);

  // Traduce aquí con tu función de traducción (Google, DeepL, etc)
  const description_en = catalogResponse.product?.description || "Descripción no disponible";

  // --- 🔥 DESCRIPCIÓN AUTOMÁTICA PERSONALIZADA ---
  const description_es = generarDescripcionPorCategoria(category.title, 'es');

  return await Product.create({
    idProduct: product.id,
    title: product.name,
    categoryId: category.id,
    price_soles: productDetail.sync_variants[0].retail_price,
    price_usd: productDetail.sync_variants[0].retail_price,
    portada: portada_name,
    resumen: "tu_resumen",
    description_en,
    description_es,
    sku: await extractSKU(productDetail.sync_variants[0].sku),
    slug: await generateSlug(product.name),
    state: product.is_ignored ? 1 : 2,
    printful_ignored: product.is_ignored,
    imagen: "tu_imagen",
    type_inventario: 2,
    tags: JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(variant => variant.color).filter(Boolean))),
  }, { transaction });
};


/**
 * Genera una descripción en español automática con estilo “LujanDev”.
 * Detecta el tipo de prenda por nombre y devuelve texto creativo.
 */
// function generarDescripcionPorCategoria(title) {
//   if (!title) return "Diseño exclusivo LujanDev: donde el código se viste con elegancia.";

//   const categoria = title.toLowerCase().trim();

//   if (categoria.includes("shirt")) {
//     return "Camiseta premium para devs con estilo. Su tejido suave y su corte moderno la hacen perfecta para acompañarte en cada línea de código. Parte de la colección LujanDev.";
//   }

//   if (categoria.includes("hoodie")) {
//     return "Sudadera tech de alto confort con diseño LujanDev. Ideal para mantenerte cómodo en largas sesiones de código o para salir con estilo al mundo real.";
//   }

//   if (categoria.includes("mug")) {
//     return "Taza LujanDev, perfecta para programadores que necesitan combustible en forma de café. Diseño minimalista y duradero, ideal para tu setup.";
//   }

//   if (categoria.includes("hat") || categoria.includes("cap")) {
//     return "Gorra tipo ‘dad hat’ con estilo urbano y ADN tech. Un accesorio icónico para devs que llevan el código hasta en la cabeza.";
//   }

//   return "Diseño exclusivo LujanDev: donde el código se viste con elegancia. Pensado para programadores que valoran el estilo tanto como la lógica.";
// }

// Actualiza un producto solo si hay cambios
const updateProductIfNeeded = async (existingProduct, product, productDetail, category, transaction) => {
  let updates = {};

  if (existingProduct.title !== product.name) updates.title = product.name;
  if (existingProduct.state !== (product.is_ignored ? 1 : 2)) updates.state = product.is_ignored ? 1 : 2;
  if (existingProduct.categoryId !== category.id) updates.categoryId = category.id;

  // Comparar precio con conversión a float para evitar problemas de tipo
  const newPrice = parseFloat(productDetail.sync_variants[0].retail_price);
  const existingPrice = parseFloat(existingProduct.price_soles);
  if (existingPrice !== newPrice) {
    updates.price_soles = newPrice;
    updates.price_usd = newPrice;
  }

  const newSKU = await extractSKU(productDetail.sync_variants[0].sku);
  if (existingProduct.sku !== newSKU) updates.sku = newSKU;

  // Normalizar tags (ordenar para comparación consistente)
  const newColorsArray = await removeRepeatedColors(
    productDetail.sync_variants.map(v => v.color).filter(Boolean)
  );
  const newTags = JSON.stringify(newColorsArray.sort());
  
  let existingTagsArray = [];
  try {
    existingTagsArray = JSON.parse(existingProduct.tags || '[]');
    if (Array.isArray(existingTagsArray)) {
      existingTagsArray.sort();
    }
  } catch (e) {
    existingTagsArray = [];
  }
  const existingTags = JSON.stringify(existingTagsArray);
  
  if (existingTags !== newTags) updates.tags = newTags;

  const portada_name = await handleProductImage(product.thumbnail_url, existingProduct.portada);
  if (portada_name && existingProduct.portada !== portada_name) updates.portada = portada_name;

  if (Object.keys(updates).length > 0) {
    console.log(`      📝 Actualizando campos: ${Object.keys(updates).join(', ')}`);
    await existingProduct.update(updates, { transaction });
  }

  return existingProduct;
};

/**
 ***/
// Maneja la descarga de imágenes, evitando descargas innecesarias
const handleProductImage = async (imageUrl, existingImageName = null) => {
  if (!imageUrl) return existingImageName;

  const nameParts = imageUrl.split("/");
  const newImageName = nameParts[nameParts.length - 1];

  if (existingImageName === newImageName) {
    return existingImageName; // No descargar si es la misma imagen
  }

  const uploadDir = path.resolve("./src/uploads/product");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const imagePath = path.join(uploadDir, newImageName);
  await downloadImage(imageUrl, imagePath);

  return newImageName;
};


/**
  Mejoras aplicadas:
  Evita la creación de variantes nuevas: Solo actualiza las existentes si se encuentran en syncVariants.
  Usa Map para búsqueda rápida: Reduce el tiempo de búsqueda de variantes existentes.
  Elimina variantes obsoletas: Solo si no están en syncVariants.
  Optimiza la actualización de opciones: En lugar de recrearlas innecesariamente.
  Mejora la gestión de galerías: Evita inserciones redundantes.
 ***/
const createOrUpdateVariants = async (productId, syncVariants, transaction) => {
  const existingVariants = await Variedad.findAll({ 
    where: { productId },
    transaction
  });
  const existingGalleries = await Galeria.findAll({ 
    where: { productId },
    transaction
  });
  const variantMap = new Map(existingVariants.map(v => [v.sku, v]));
  const newGalleryImages = new Set();

  for (const variant of syncVariants) {
    const existingVariant = variantMap.get(variant.sku);

    if (existingVariant) {
      const variantUpdates = {};
      ["valor", "color", "external_id", "sync_product_id", "name", "synced", "variant_id", "main_category_id", "warehouse_product_id", "warehouse_product_variant_id", "retail_price", "currency"].forEach(field => {
        if (existingVariant[field] !== variant[field]) variantUpdates[field] = variant[field];
      });
      
      if (Object.keys(variantUpdates).length > 0) {
        await existingVariant.update(variantUpdates, { transaction });
      }
    } else {
      // CREAR NUEVA VARIANTE
      const newVariant = await Variedad.create({
        valor: variant.size,
        stock: 10,
        color: variant.color || 'no hay color',
        productId,
        external_id: variant.external_id,
        sync_product_id: variant.sync_product_id,
        name: variant.name,
        synced: variant.synced,
        variant_id: variant.variant_id,
        main_category_id: variant.main_category_id,
        warehouse_product_id: variant.warehouse_product_id,
        warehouse_product_variant_id: variant.warehouse_product_variant_id,
        retail_price: variant.retail_price,
        sku: variant.sku,
        currency: variant.currency,
      }, { transaction });

      // CREAR PRODUCTO VARIANTE
      await ProductVariants.create({
        variant_id: newVariant.variant_id,
        product_id: newVariant.productId,
        image: variant.product?.image,
        name: newVariant.name,
        varietyId: newVariant.id
      }, { transaction });

      // CREAR ARCHIVOS ASOCIADOS A LA VARIANTE
      for ( const file of variant.files ) {
        try {
            await File.create({
              idFile          : file.id,
              type            : file.type,
              hash            : file.hash || '',
              url             : file.url,
              filename        : file.filename,
              mime_type       : file.mime_type,
              size            : file.size,
              width           : file.width,
              height          : file.height,
              dpi             : file.dpi,
              status          : file.status,
              created         : file.created,
              thumbnail_url   : file.thumbnail_url,
              preview_url     : file.preview_url,
              visible         : file.visible,
              is_temporary    : file.is_temporary,
              message         : file.message,
              varietyId       : newVariant.id,
              optionVarietyId : newVariant.variant_id,
            }, { transaction });
        } catch ( error ) {
          console.error('Error creating file record:', error, file);
        }
      }

      // CREAR OPCIONES PARA LA NUEVA VARIANTE
      for ( const option of variant.options ) {
        await Option.create({
          idOption  : option.id     ,
          value     : option.value  ,
          varietyId : newVariant.id ,
        }, { transaction });
      }
    }

    // PROCESAR IMÁGENES DE GALERÍA
    for (const file of variant.files) {
      if (file.type === 'preview' && file.preview_url) {
        const galleryName = await processGalleryImage(file.preview_url);
        newGalleryImages.add(galleryName);

        if (!existingGalleries.some(g => g.imagen === galleryName)) {
          await Galeria.create({ 
            imagen: galleryName, 
            color: variant.color || 'no hay color', 
            productId 
          }, { transaction });
        }
      }
    }
  }

  // ELIMINAR VARIANTES QUE YA NO EXISTEN
  for (const existingVariant of existingVariants) {
    if (!syncVariants.some(v => v.sku === existingVariant.sku)) {
      // Eliminar opciones asociadas antes de eliminar la variedad
      await Option.destroy({ where: { varietyId: existingVariant.id }, transaction });
      await ProductVariants.destroy({ where: { varietyId: existingVariant.id }, transaction });
      await File.destroy({ where: { varietyId: existingVariant.id }, transaction });
      await existingVariant.destroy({ transaction });
    }
  }

  // ELIMINAR GALERÍAS QUE YA NO ESTÁN ASOCIADAS
  for (const existingGallery of existingGalleries) {
    if (!newGalleryImages.has(existingGallery.imagen)) {
      await existingGallery.destroy({ transaction });
    }
  }

};

/*
 * Limpia la base de datos local eliminando productos que no están presentes en Printful.
 * Elimina las variantes y galerías asociadas a esos productos.
 * Elimina los ficheros Files si ya no está asociada a ningún producto.
 * Elimina los optioms  si ya no está asociada a ningún producto.
 * Elimina la categoría si ya no está asociada a ningún producto.
 */
const clearLocalDatabaseIfNoProviderProducts = async (printfulProducts) => {
  try {
    const currentProducts = await Product.findAll();

    // CREAR UN CONJUNTO DE IDS DE PRODUCTOS QUE EXISTEN EN PRINTFUL
    const printfulProductIds = new Set( printfulProducts.map(product => product.id) );

    // RECORRER LOS PRODUCTOS ACTUALES DE LA BBDD Y ALIMINA LOS QUE NO ESTÁN EN PRINTFUL
    for ( const currentProduct of currentProducts ) {

      if ( !printfulProductIds.has(currentProduct.idProduct) ) {

        await deleteProductAndRelatedComponents(currentProduct); // ELIMINA EL PRODUCTO Y SUS COMPONENTES RELACIONDOS
      }
    }

  } catch (error) {
    console.error('Error al limpiar la base de datos:', error);
    throw new Error('Error al limpiar la base de datos');
  }

};

/*
 * Busca todas las variedades (Variedad) asociadas al producto (product.id).
 * Itera sobre cada variedad encontrada y llama a deleteVarietyAndRelatedFiles(variety) para eliminar la variedad y todos 
 * los archivos (File) asociados a esa variedad.
 * También llama a deleteOptionsForVariant(variety.id) para eliminar todas las opciones (Option) asociadas a esa variedad.
*/
const deleteProductAndRelatedComponents = async (product, transaction) => {
  try {
    // Buscar la categoría asociada (si existe)
    const category = await Categorie.findOne({ 
      where: { id: product.categoryId },
      transaction
    });

    // 🛒 Eliminar productos del carrito asociados
    await Cart.destroy({ where: { productId: product.id }, transaction });

   // 🧩 Buscar y eliminar las variedades asociadas
    const varieties = await Variedad.findAll({
      where: { productId: product.id },
      transaction
    });

    for ( const variety of varieties ) {
      await deleteVarietyAndRelatedFiles(variety, transaction);
      await deleteOptionsForVariant(variety, transaction);
      await SaleDetail.destroy({ where: { productId: product.id, variedadId: variety.id }, transaction });
      await ProductVariants.destroy({ where: { varietyId: variety.id }, transaction });
    }

    // 💖 Eliminar los favoritos asociado
    const wishlists = await Wishlist.findAll({ where: { productId: product.id }, transaction });
    if (wishlists) {
      for (const wishlist of wishlists) {
        await wishlist.destroy({ transaction });
      }
    }

    // 🖼️ Eliminar las galerías asociadas
    const galleries = await Galeria.findAll({ where: { productId: product.id }, transaction });
    for ( const gallery of galleries ) {
      await gallery.destroy({ transaction });
    }

    // 🧹 Eliminar finalmente el producto
    await Product.destroy({ where: { idProduct: product.idProduct }, transaction });

    // 🗂️ Verificar si la categoría sigue siendo usada
    if (category) {
      const productsInCategory = await Product.findAll({
        where: { categoryId: category.id },
        transaction
      });

      if (productsInCategory.length === 0) {
        await category.destroy({ transaction });
        console.log(`  🗂️ Categoría "${category.title}" eliminada (sin productos asociados)`);
      }
    }

  } catch (error) {
    console.error(`❌ Error eliminando producto ${product.id}:`, error);
  }
};

/*
 * Busca todos los archivos (File) que están asociados a la variedad (variety.id)
 */
const deleteVarietyAndRelatedFiles = async (variety, transaction) => {
  try {
    // Primero eliminar ProductVariants asociados
    await ProductVariants.destroy({
      where: { varietyId: variety.id },
      transaction
    });

    // Luego eliminar Files asociados
    const files = await File.findAll({ where: { varietyId: variety.id }, transaction });
    for (const file of files) {
      await file.destroy({ transaction });
    }

    // Finalmente eliminar la variedad
    await variety.destroy({ transaction });

  } catch (error) {
    console.error(`Error eliminando variedad ${variety.id}:`, error);
    throw new Error(`Error eliminando variedad ${variety.id}`);
  }
};

/*
 * Este método elimina todas las opciones (Option) asociadas a una variante específica
 */
const deleteOptionsForVariant = async (variety, transaction) => {
  try {
    const options = await Option.findAll({
      where: {
        varietyId: variety.id
      },
      transaction
    });

    for ( const option of options ) {
      await option.destroy({ transaction });
    }

    // ELIMINAR LA VARIEDAD FINALMENTE
    // ❌ NO eliminar la variedad aquí
    // await variety.destroy();

  } catch ( error ) {
    console.error(`Error deleting options for variant ${variety.id}:`, error);
    throw new Error(`Error deleting options for variant ${variety.id}`);
  }
};

/*
 * Crea una orden en Printful con los datos proporcionados.
 * No está implementado en el código proporcionado, solo contiene un esqueleto para manejar errores.
 */
export const createPrintfulOrder = async( orderData ) => {

  try {
    let data = await createPrintfulOrderService( orderData );
    return data;
  } catch ( error ) {
    console.error('DEBUG createPrintfulOrder: No response received:', error.request);
    return "error_order"
  }
};

/**
 * ==================================================================================================
 * =                                  DASHBOARD STATS ENDPOINT                                     =
 * ==================================================================================================
 */

export const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Calculating dashboard statistics...');

    // Get all Printful products (type_inventario = 2)
    const productsRaw = await Product.findAll({
      where: { type_inventario: 2 },
      attributes: ['id', 'title', 'slug', 'sku', 'price_usd', 'price_soles', 'portada', 'state', 'categoryId', 'stock', 'updatedAt'],
      include: [
        { 
          model: Categorie,
          attributes: ['id', 'title'],
          required: false
        },
        { 
          model: Variedad,
          attributes: ['id', 'valor'],
          required: false
        },
        { 
          model: Galeria,
          attributes: ['id', 'imagen'],
          limit: 1,
          order: [['id', 'ASC']],
          required: false
        }
      ]
    });

    // Convert to plain objects to access associations properly
    const products = productsRaw.map(p => p.get({ plain: true }));

    // Initialize stats
    const stats = {
      totalProducts: products.length,
      totalVariants: 0,
      totalCategories: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      totalInventoryValue: 0,
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      categoriesDistribution: [],
      lastSync: null,
      alerts: [],
      topExpensive: [],
      topCheap: []
    };

    // Calculate basic stats
    const prices = [];
    const categoriesMap = new Map();
    let totalPrice = 0;

    products.forEach(product => {
      // Count variants
      const variedades = product.variedades || [];
      stats.totalVariants += variedades.length;

      // Active/Inactive count
      // state = 2 means ACTIVE, state = 1 means INACTIVE
      if (product.state === 2) {
        stats.activeProducts++;
      } else {
        stats.inactiveProducts++;
      }

      // Price calculations
      const price = parseFloat(product.price_usd) || 0;
      if (price > 0) {
        prices.push(price);
        totalPrice += price;
        stats.totalInventoryValue += price * (variedades.length || 1);
      }

      // Category distribution
      if (product.category && product.category.title) {
        const categoryName = product.category.title;
        categoriesMap.set(categoryName, (categoriesMap.get(categoryName) || 0) + 1);
      } else {
        // Count products without category
        categoriesMap.set('Sin Categoría', (categoriesMap.get('Sin Categoría') || 0) + 1);
      }

      // Last sync
      if (product.updatedAt) {
        const productDate = new Date(product.updatedAt);
        if (!stats.lastSync || productDate > new Date(stats.lastSync)) {
          stats.lastSync = product.updatedAt;
        }
      }
    });

    // Calculate price stats
    if (prices.length > 0) {
      stats.averagePrice = totalPrice / prices.length;
      stats.priceRange.min = Math.min(...prices);
      stats.priceRange.max = Math.max(...prices);
    }

    // Categories distribution
    stats.totalCategories = categoriesMap.size;
    stats.categoriesDistribution = Array.from(categoriesMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 categories

    // Generate alerts
    const alerts = [];

    // Alert: Products without variants
    const noVariantsCount = products.filter(p => !p.variedades || p.variedades.length === 0).length;
    if (noVariantsCount > 0) {
      alerts.push({
        type: 'no-variants',
        message: 'Productos sin variantes configuradas',
        count: noVariantsCount
      });
    }

    // Alert: Products without category
    const noCategoryCount = products.filter(p => !p.category || !p.category.title).length;
    if (noCategoryCount > 0) {
      alerts.push({
        type: 'no-category',
        message: 'Productos sin categoría asignada',
        count: noCategoryCount
      });
    }

    // Alert: Inactive products
    if (stats.inactiveProducts > 0) {
      alerts.push({
        type: 'low-stock',
        message: 'Productos inactivos en catálogo',
        count: stats.inactiveProducts
      });
    }

    // Alert: Products with very high price (outliers)
    const highPriceThreshold = stats.averagePrice * 2;
    const highPriceCount = products.filter(p => parseFloat(p.price_usd) > highPriceThreshold).length;
    if (highPriceCount > 0) {
      alerts.push({
        type: 'high-price',
        message: 'Productos con precio superior al promedio',
        count: highPriceCount
      });
    }

    stats.alerts = alerts;

    // Top expensive products (top 5)
    stats.topExpensive = products
      .filter(p => p.price_usd > 0)
      .sort((a, b) => parseFloat(b.price_usd) - parseFloat(a.price_usd))
      .slice(0, 5)
      .map(p => {
        // Get first image from gallery or use portada field and construct full URL
        let imagen = null;
        if (p.galerias && p.galerias.length > 0 && p.galerias[0].imagen) {
          imagen = `${process.env.URL_BACKEND}/api/products/uploads/product/${p.galerias[0].imagen}`;
        } else if (p.portada) {
          imagen = `${process.env.URL_BACKEND}/api/products/uploads/product/${p.portada}`;
        }
        return {
          id: p.id,
          title: p.title,
          price_soles: parseFloat(p.price_soles),
          imagen: imagen
        };
      });

    // Top cheap products (top 5)
    stats.topCheap = products
      .filter(p => p.price_usd > 0)
      .sort((a, b) => parseFloat(a.price_usd) - parseFloat(b.price_usd))
      .slice(0, 5)
      .map(p => {
        // Get first image from gallery or use portada field and construct full URL
        let imagen = null;
        if (p.galerias && p.galerias.length > 0 && p.galerias[0].imagen) {
          imagen = `${process.env.URL_BACKEND}/api/products/uploads/product/${p.galerias[0].imagen}`;
        } else if (p.portada) {
          imagen = `${process.env.URL_BACKEND}/api/products/uploads/product/${p.portada}`;
        }
        return {
          id: p.id,
          title: p.title,
          price_usd: parseFloat(p.price_usd),
          imagen: imagen
        };
      });

    console.log('✅ Dashboard stats calculated successfully');

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error calculating dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular estadísticas del dashboard',
      error: error.message
    });
  }
};
