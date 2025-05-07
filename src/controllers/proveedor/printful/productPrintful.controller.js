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


let idMapping = { products: {}, variedades: {} };

export const list = async( req, res ) => {
  try{
    const products = await getPrintfulProductsService();
    res.status( 200 ).json({
        products: products,
    });
  } catch {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
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
  } catch {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
  }
}

/*
 * ==================================================================================================
 * =                                                                                                =
 * =                                  PROCESAMIENTO DEL PROVEEDOR PRINTFUL                          =
 * =                                                                                                =
 * ================================================================================================= */

/* ----- FUNCION PRINCIPAL ------
 * Obtiene todos los productos actuales de Printful
 * Limpia la base de datos local eliminando productos locales que ya no existen en Printful
 * Procesa cada producto de Printful utilizando la función processPrintfulProduct
 */
/*export const getPrintfulProducts = async () => {
  try {

    const printfulProducts = await getPrintfulProductsService();

    // CREA UN CONJUNTO DE IDS DE PRODUCTOS QUE EXISTEN EN PRINTFUL
    const printfulProductMap = new Map( printfulProducts.map( product => [ product.id, product ]));

    // SE OBTIENE LOS PRODUCTOS ACTUALES DE LA BBDD
    const currentProducts = await Product.findAll();

    if ( currentProducts.length > 0 ) {

      // RECORRE LOS PRODUCTOS ACTUALES DE LA BBDD Y ELIMINA LOS QUE NO ESTAN EN PRINTFUL

      for (const currentProduct of currentProducts) {
        const idProductDB =  String(currentProduct.idProduct);

        // VERIFICA SI EL ID DEL PRODUCTO ACTUAL DE LA BBDD NO ESTÁ EN EL CONJUNTO DE IDS MAP
        // SI NO ESTÁ, SE PROCEDE A ELIMINARLO DE LA BBDD
        if ( !printfulProductMap.has( parseInt( idProductDB ) ) ) {
          await deleteProductAndRelatedComponents( currentProduct ); // ELIMINAR EL PRODUCTO Y SUS COMPONENTES RELACIONADOS
        } else {

          // SI EL PRODUCTO ACTUAL DE LA BBDD SI ESTÁ EN PRINTFUL, PUEDES HACER MÁS COSAS CON EL OBJETO COMPLETO SI ES NECESARIO
          const printfulProduct = printfulProductMap.get(parseInt(idProductDB));

          if ( printfulProduct.is_ignored == true ) {
             await deleteProductAndRelatedComponents(currentProduct);
          } else {
            //console.log("API 112 Producto actual tiene el is_inore a FALSE de DB ", JSON.stringify(printfulProduct, null, 2));
          }
        }
      }
    }

    for ( const product of printfulProducts ) {
      await processPrintfulProduct( product );
    }


  } catch ( error ) {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
  }
};*/



export const getPrintfulProducts = async () => {

  try {

    const printfulProducts = await getPrintfulProductsService();

    // Creamos un arreglo de IDs de productos de Printful
    const printfulProductIds = printfulProducts.map(product => product.id);

    // Obtener los productos locales que no están en Printful
    const productsToDelete = await Product.findAll({
      where: { idProduct: { [Op.notIn]: printfulProductIds } }
    });

    // Eliminar productos con sus relaciones
    for (const product of productsToDelete) {
      await deleteProductAndRelatedComponents(product);
    }

    // Recorremos cada producto obtenido de Printful
    for (const product of printfulProducts) {
      //console.log("------- printfulProducts: ", JSON.stringify(product, null, 2));
      // Buscamos el producto en la base de datos local
      const existingProduct = await Product.findOne({ where: { idProduct: product.id } });

      if (!existingProduct) {
        // Si no existe, es un producto nuevo: se procesa y se crea
        await processPrintfulProduct(product);
        
      } else if ( existingProduct.title !== product.name                  || 
                  existingProduct.state !== productCompareState(product)  || 
                  existingProduct.price_soles !== productDetailSyncPrice(product) ) {
        console.log("--> entro por el elseif");
        // Si ya existe, podemos comparar campos críticos para ver si hubo cambios.
        // Por ejemplo, si Printful provee un campo "updated" o "modified", lo compararíamos.
        // Aquí mostramos una comparación simple con el título y el precio (puedes ampliarla según tus necesidades)
        console.log(`----> Actualizando producto ${product.id} por cambios detectados`, JSON.stringify(product, null, 2), );
        // console.log(`Actualizando producto ${product.id} por cambios detectados`);
        // Si detectamos diferencias, procesamos el producto para actualizarlo
        await processPrintfulProduct(product);
      } else {
          console.log(`Producto ${product.id} sin cambios, se omite la actualización.`);
      }
    }
  } catch ( error ) {
    console.log("Error al sincronizar productos de Printful", error);
    throw new Error('Error al sincronizar productos de Printful');
  }
};

const productCompareState = (product) => {
  return product.is_ignored ? 1 : 2;
};


// Función auxiliar para extraer el precio de sincronización (ejemplo)
const productDetailSyncPrice = (product) => {
  // Suponiendo que el precio se toma del primer sync_variant
  // (puedes ajustarlo según la estructura de datos)
  return product.sync_variants && product.sync_variants[0] ? product.sync_variants[0].retail_price : null;
};



/*
 * Esta función procesa un producto de Printful.
 * Obtiene detalles del producto desde Printful usando su ID.
 * Obtiene o crea una categoría para el producto.
 * Obtiene o crea el producto en la base de datos local.
 * Crea o actualiza variantes y galerías del producto.
 */
const processPrintfulProduct = async (product) => {
  try {
    
    const productDetail = await getPrintfulProductDetail(product.id);
    const category = await getOrCreateCategory( productDetail );
    const existingProduct = await getOrCreateProduct( product, productDetail, category );
    console.log("------- existingProduct: ", JSON.stringify(existingProduct, null, 2));

    if ( existingProduct ) {
      await createOrUpdateVariants( existingProduct.id, productDetail.sync_variants );
    }

  } catch ( error ) {
    console.error('Error processing Printful product:', error);
    throw new Error('Error processing Printful product');
  }
};

/*
 * Obtiene la categoría asociada a un producto de Printful.
 * Verifica si la categoría ya existe en la base de datos local.
 * Si no existe, la crea.
 * Devuelve la categoría existente o recién creada.
 */
const getOrCreateCategory = async (productDetail) => {
  const categoryResponse = await getPrintfulCategory(productDetail.sync_variants[0].main_category_id);
  const category = categoryResponse.category;

  let existingCategory = await Categorie.findOne({
    where: { title: category.title }
  });

  if ( !existingCategory ) {
    existingCategory = await createCategory(category);
  }

  return existingCategory;
};

/*
 * Crea una nueva categoría en la base de datos local.
 * Descarga y guarda la imagen de la categoría si está disponible.
 */
const createCategory = async (category) => {
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
    state: 1,
  });
};

/*
 * Busca un producto en la base de datos local por su ID.
 * Si no existe, crea un nuevo producto.
 * Si existe, actualiza la información del producto.
 */
/**const getOrCreateProduct = async (product, productDetail, category) => {
  let existingProduct = await Product.findOne({where: { idProduct: product.id }});
  let oldProductId = existingProduct ? existingProduct.id : null;
  if ( !existingProduct ) {
    existingProduct = await createProduct( product, productDetail, category );
  }
  else {
    existingProduct = await updateProduct( existingProduct, product, productDetail, category );
  }
  // SIEMPRE SE DEBE ACTUALIZAR LAS VARIANTES Y GALERIAS SI EL PRODYCTO YA EXISGTE
  await createOrUpdateVariantsAndGalleries( existingProduct.id, productDetail.sync_variants );
  return existingProduct;
};**/
// Obtiene o crea un producto solo si es necesario
const getOrCreateProduct = async (product, productDetail, category) => {
  let existingProduct = await Product.findOne({ where: { idProduct: product.id } });

  if (!existingProduct) {
    return await createProduct(product, productDetail, category);
  }

  return await updateProductIfNeeded(existingProduct, product, productDetail, category);
};

/*
 * Crea un nuevo producto en la base de datos local.
 * Descarga y guarda la imagen del producto si está disponible.
 */
/*const createProduct = async (product, productDetail, category) => {

  let portada_name = '';
  let tags = [];

  let data = {
    idProduct: product.id,
    title: product.name,
    categoryId: category.id,
    price_soles: productDetail.sync_variants[0].retail_price,
    price_usd: productDetail.sync_variants[0].retail_price,
    portada: '',
    resumen: 'tu_resumen',
    description: 'tu_descripcion',
    sku: await extractSKU(productDetail.sync_variants[0].sku),
    slug: await generateSlug(product.name),
    state: product.is_ignored == true ? 1 : 2, //2,
    imagen: 'tu_imagen',
    type_inventario: 2,
    tags: JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(variant => variant.color).filter(Boolean))),
  };

  if ( product.thumbnail_url ) {
    var img_path = product.thumbnail_url;
    var name = img_path.split('/');
    portada_name = name[5];
    data.portada = portada_name;

    const uploadDir = path.resolve('./src/uploads/product');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const imagePath = path.join(uploadDir, portada_name);
    await downloadImage(img_path, imagePath);
    //await convertWhiteToTransparent(imagePath);
  }
  return await Product.create(data);
};****/
// Crea un producto si no existe
const createProduct = async (product, productDetail, category) => {
  const portada_name = await handleProductImage(product.thumbnail_url);

  return await Product.create({
    idProduct: product.id,
    title: product.name,
    categoryId: category.id,
    price_soles: productDetail.sync_variants[0].retail_price,
    price_usd: productDetail.sync_variants[0].retail_price,
    portada: portada_name,
    resumen: "tu_resumen",
    description: "tu_descripcion",
    sku: await extractSKU(productDetail.sync_variants[0].sku),
    slug: await generateSlug(product.name),
    state: product.is_ignored ? 1 : 2,
    imagen: "tu_imagen",
    type_inventario: 2,
    tags: JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(variant => variant.color).filter(Boolean))),
  });
};

/*
 * Actualiza un producto existente en la base de datos local con la información más reciente.
 */
/***const updateProduct = async (existingProduct, product, productDetail, category) => {
  existingProduct.title       = product.name;
  existingProduct.state       = product.is_ignored == true ? 1 : 2;
  existingProduct.categoryId  = category.id;
  existingProduct.price_soles = productDetail.sync_variants[0].retail_price;
  existingProduct.price_usd   = productDetail.sync_variants[0].retail_price;
  existingProduct.sku         = await extractSKU(productDetail.sync_variants[0].sku);
  existingProduct.slug        = await generateSlug(product.name);
  existingProduct.tags        = JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(variant => variant.color).filter(Boolean)));

  if ( product.thumbnail_url ) {
    var img_path            = product.thumbnail_url;
    var name                = img_path.split('/');
    var portada_name        = name[ 5 ];
    existingProduct.portada = portada_name;

    const uploadDir = path.resolve('./src/uploads/product');
    if ( !fs.existsSync(uploadDir) ) {
      fs.mkdirSync(
        uploadDir, { recursive: true }
      );
    }

    const imagePath = path.join( uploadDir, portada_name );
    await downloadImage(img_path, imagePath);
  }

  await existingProduct.save();

  return existingProduct;
};****** */
// Actualiza un producto solo si hay cambios
const updateProductIfNeeded = async (existingProduct, product, productDetail, category) => {
  let updates = {};

  if (existingProduct.title !== product.name) updates.title = product.name;
  if (existingProduct.state !== (product.is_ignored ? 1 : 2)) updates.state = product.is_ignored ? 1 : 2;
  if (existingProduct.categoryId !== category.id) updates.categoryId = category.id;

  const newPrice = productDetail.sync_variants[0].retail_price;
  if (existingProduct.price_soles !== newPrice) {
    updates.price_soles = newPrice;
    updates.price_usd = newPrice;
  }

  const newSKU = await extractSKU(productDetail.sync_variants[0].sku);
  if (existingProduct.sku !== newSKU) updates.sku = newSKU;

  const newTags = JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(v => v.color).filter(Boolean)));
  if (existingProduct.tags !== newTags) updates.tags = newTags;

  const portada_name = await handleProductImage(product.thumbnail_url, existingProduct.portada);
  if (portada_name && existingProduct.portada !== portada_name) updates.portada = portada_name;

  if (Object.keys(updates).length > 0) {
    console.log(`Actualizando producto ${existingProduct.id} con cambios:`, updates);
    await existingProduct.update(updates);
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

/*
 * Crea o actualiza las variantes y galerías de un producto.
 * Maneja las variantes del producto (agrega nuevas y actualiza las existentes).
 * Maneja las galerías de imágenes asociadas a las variantes del producto.
 */

/**const createOrUpdateVariantsAndGalleries = async (productId, syncVariants) => {
  // OBTENER VARIANTES
  const existingVariants = await Variedad.findAll({ where: { productId } });
  const existingGalleries = await Galeria.findAll({ where: { productId } });

  const newVariants = syncVariants.map(variant => ({
    valor                        : variant.size,
    color                        : variant.color,
    external_id                  : variant.external_id,
    sync_product_id              : variant.sync_product_id,
    name                         : variant.name,
    synced                       : variant.synced,
    variant_id                   : variant.variant_id,
    main_category_id             : variant.main_category_id,
    warehouse_product_id         : variant.warehouse_product_id,
    warehouse_product_variant_id : variant.warehouse_product_variant_id,
    retail_price                 : variant.retail_price,
    sku                          : variant.sku,
    currency                     : variant.currency,
    productId                    ,
    product                      : { image: variant.product.image },
    files                        : variant.files,
    options                      : variant.options,
  }));

  const newVariantValues = newVariants.map( variant => variant.valor );
  const existingVariantValues = existingVariants.map( variant => variant.valor );


  // ACTUALIZAR VARIANTES EXISTENTES
  for ( const variant of existingVariants ) {
    // VERIFICA SI VARIANT.VALOR NO ESTÁ INCLUIDO EN  newVariantValues
    if ( !newVariantValues.includes(variant.valor) ) {
      await variant.destroy();
    }
  }

  // AÑADIR NUEVAS VARIANTES Y ACTUALIZAR LAS EXISTENTES
  for ( const variant of newVariants ) {

    const existingVariant = existingVariants.find(
      v => v.sku === variant.sku
    );

    let oldVariedadId = existingVariant ? existingVariant.id : null;

    if ( !existingVariant ) {

      // CREAR VARIEDADES
      let newVariant = await Variedad.create({
        valor                          : variant.valor,
        stock                          : 10,
        color                          : variant.color || 'no hay color',
        productId                      : variant.productId,
        external_id                    : variant.external_id,
        sync_product_id                : variant.sync_product_id,
        name                           : variant.name,
        synced                         : variant.synced,
        variant_id                     : variant.variant_id,
        main_category_id               : variant.main_category_id,
        warehouse_product_id           : variant.warehouse_product_id,
        warehouse_product_variant_id   : variant.warehouse_product_variant_id,
        retail_price                   : variant.retail_price,
        sku                            : variant.sku,
        currency                       : variant.currency,
      });

      if ( oldVariedadId && oldVariedadId !== existingVariant.id ) {
        idMapping.variedades[oldVariedadId] = existingVariant.id;
      }


      // CREAR PRODUCRO
      await ProductVariants.create({
          variant_id  : newVariant.variant_id,
          product_id  : newVariant.productId,
          image       : variant.product.image,
          name        : newVariant.name,
          varietyId   : newVariant.id
      });


      // CREAR FILES O ARCHIVOS
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
            });
        } catch ( error ) {
          console.error('Error creating file record:', error, file);
        }
      }


      // DESTRUYE Y CREA LAS OPTIONES DE CADA VARIEDA DEL PRODUCTO
      await Option.destroy({
        where: {
          varietyId: newVariant.id
        }
      });

      for ( const option of variant.options ) {
        await Option.create({
          idOption  : option.id     ,
          value     : option.value  ,
          varietyId : newVariant.id ,
        });
      }

    } else {

      // ELIMINAR LAS OPCIONES EXISRTENTES PARA LA VARIANTE EXISTENTE
      await Option.destroy({
        where: {
          varietyId: existingVariant.id
        }
      });

      for (const option of variant.options) {
        await Option.create({
          idOption  : option.id          ,
          value     : option.value       ,
          varietyId : existingVariant.id ,
        });
      }

    }
  }

  // PROCESAR Y ACTUALIZAR LAS GALERIAS
  const newGalleryImages = new Set(); // CONJUNTO PARAA ALMACENAR NUEVAS IMAGENES DE GALERIAS

  for ( const variant of newVariants ) {
    for ( const file of variant.files ) {
      if ( file.type === 'preview' && file.preview_url ) {

        const galleryImageUrl = file.preview_url;
        let galleryName       = await processGalleryImage(galleryImageUrl);

        newGalleryImages.add(galleryName);

        const existingGallery = existingGalleries.find(
          gallery => gallery.imagen === galleryName
        );

        if ( !existingGallery ) {
          await Galeria.create({
            imagen    : galleryName                     ,
            color     : variant.color || 'no hay color' ,
            productId                                   ,
          });
        }
      }
    }

  }


  // ELIMINAR GALERIAS QUE YA NO ESTÁN ASOCIADAS A NINGUNA VARIANTE
  for ( const existingGallery of existingGalleries ) {
    if ( !newGalleryImages.has( existingGallery.imagen ) ) { // VERIFICAR SI LA IMAGEN NO ESTÁ EN EL CONJUNTO DE NUEVAS IMAGENES
      await existingGallery.destroy();
    }
  }
};**** */

/**
  Mejoras aplicadas:
  Evita la creación de variantes nuevas: Solo actualiza las existentes si se encuentran en syncVariants.
  Usa Map para búsqueda rápida: Reduce el tiempo de búsqueda de variantes existentes.
  Elimina variantes obsoletas: Solo si no están en syncVariants.
  Optimiza la actualización de opciones: En lugar de recrearlas innecesariamente.
  Mejora la gestión de galerías: Evita inserciones redundantes.
 ***/
const createOrUpdateVariants = async (productId, syncVariants) => {
  const existingVariants = await Variedad.findAll({ where: { productId } });
  const existingGalleries = await Galeria.findAll({ where: { productId } });
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
        await existingVariant.update(variantUpdates);
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
      });

      // CREAR PRODUCTO VARIANTE
      await ProductVariants.create({
        variant_id: newVariant.variant_id,
        product_id: newVariant.productId,
        image: variant.product?.image,
        name: newVariant.name,
        varietyId: newVariant.id
      });

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
            });
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
        });
      }
    }

    // PROCESAR IMÁGENES DE GALERÍA
    for (const file of variant.files) {
      if (file.type === 'preview' && file.preview_url) {
        const galleryName = await processGalleryImage(file.preview_url);
        newGalleryImages.add(galleryName);

        if (!existingGalleries.some(g => g.imagen === galleryName)) {
          await Galeria.create({ imagen: galleryName, color: variant.color || 'no hay color', productId });
        }
      }
    }
  }

  // ELIMINAR VARIANTES QUE YA NO EXISTEN
  for (const existingVariant of existingVariants) {
    if (!syncVariants.some(v => v.sku === existingVariant.sku)) {
      await existingVariant.destroy();
    }
  }

  // ELIMINAR GALERÍAS QUE YA NO ESTÁN ASOCIADAS
  for (const existingGallery of existingGalleries) {
    if (!newGalleryImages.has(existingGallery.imagen)) {
      await existingGallery.destroy();
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
const deleteProductAndRelatedComponents = async (product) => {

  // BUSCAR LA CATEGORIA ASOCIADA
  const category = await Categorie.findOne({
    where: {
      id: product.categoryId
    }
  });

  await Cart.destroy({
    where: {
      productId: product.id
    }
  });

  // ENCONTRAR Y ELIMINAR LAS VARIEDADES ASOCIADAS
  const varieties = await Variedad.findAll({
    where: {
      productId: product.id
    }
  });

  for ( const variety of varieties ) {
    await deleteVarietyAndRelatedFiles( variety );
    await deleteOptionsForVariant( variety );
    await SaleDetail.destroy({ where: { productId: product.id, variedadId: variety.id } });
    await ProductVariants.destroy({ where: { varietyId: variety.id } });
  }

  // ENCONTRAR Y ELIMINAR LOS FAVORITOS ASOCIADOS
  const wishlists = await Wishlist.findAll({
    where: {
      productId: product.id
    }
  });

  if (wishlists) {
    for ( const wishlist of wishlists ) {
      await wishlist.destroy();
    }
  }

  // ENCONTRAR Y ELIMINAR LAS GALERIAS ASOCIADAS
  const galleries = await Galeria.findAll({
    where: {
      productId: product.id
    }
  });

  for ( const gallery of galleries ) {
    await gallery.destroy();
  }

  // ELIMINAR EL PRODUCTO FINALMENTE
  const count = await Product.destroy({
    where: {
      idProduct: product.idProduct
    }
  });

  // VERIFICAR SI LA CATEGORIA SIGUE SIENDO UTLIZADA POR ALGUN OTRO PRODUCTO
  const productsInCategory = await Product.findAll({
    where: {
      categoryId: category.id
    }
  });

  // SI NINGUN OTRO PRODUCTO USA ESTA CATEGORIA, ELIMINAR LA CATEGORIA
  if ( productsInCategory.length === 0 ) {
    await category.destroy();
  }
};

/*
 * Busca todos los archivos (File) que están asociados a la variedad (variety.id)
 */
const deleteVarietyAndRelatedFiles = async (variety) => {

  // ENCONTRAR Y ELIMINAR LOS ARCHIVOS ASOCIADOS A LA VARIEDAD
  const files = await File.findAll({
    where: {
      varietyId: variety.id
    }
  });

  for ( const file of files ) {
    await file.destroy();
  }

};

/*
 * Este método elimina todas las opciones (Option) asociadas a una variante específica
 */
const deleteOptionsForVariant = async (variety) => {
  try {
    const options = await Option.findAll({
      where: {
        varietyId: variety.id
      }
    });

    for ( const option of options ) {
      await option.destroy();
    }

    // ELIMINAR LA VARIEDAD FINALMENTE
    await variety.destroy();

  } catch ( error ) {
    console.error(`Error deleting options for variant ${variantId}:`, error);
    throw new Error(`Error deleting options for variant ${variantId}`);
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
    /*res.status(200).json({
      message: "Muy bien! La orden se generó correctamente",
    });*/
  } catch ( error ) {
    console.error('DEBUG createPrintfulOrder: No response received:', error.request);
    return "error_order"
  }
};
