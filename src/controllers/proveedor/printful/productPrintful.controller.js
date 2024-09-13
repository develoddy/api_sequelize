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

import fs from 'fs';
import path from "path";

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
 * =================================================================
 * =          PROCESAMIENTO DEL PROVEEDOR PRINTFUL                 =
 * =================================================================
 */


/* ----- FUNCION PRINCIPAL ------
 * Obtiene todos los productos actuales de Printful
 * Limpia la base de datos local eliminando productos locales que ya no existen en Printful
 * Procesa cada producto de Printful utilizando la función processPrintfulProduct
 */
export const getPrintfulProducts = async () => {
  try {

    const printfulProducts = await getPrintfulProductsService();
    
    // CREA UN CONJUNTO DE IDS DE PRODUCTOS QUE EXISTEN EN PRINTFUL
    const printfulProductMap = new Map(
      printfulProducts.map(
        product => [ product.id, product ] 
      )
    );

    // SE OBTIENE LOS PRODUCTOS ACTUALES DE LA BBDD
    const currentProducts = await Product.findAll();

    if ( currentProducts.length > 0 ) {

      // RECORRE LOS PRODUCTOS ACTUALES DE LA BBDD Y ELIMINA LOS QUE NO ESTAN EN PRINTFUL
      
      for (const currentProduct of currentProducts) {

        const idProductDB =  String(currentProduct.idProduct);

        /* 
         * VERIFICA SI EL ID DEL PRODUCTO ACTUAL DE LA BBDD NO ESTÁ EN EL CONJUNTO DE IDS MAP
         * SI NO ESTÁ, SE PROCEDE A ELIMINARLO DE LA BBDD
         **/
        
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

    if ( existingProduct ) {
      await createOrUpdateVariantsAndGalleries( existingProduct.id, productDetail.sync_variants );
    } 
    //else {
    // clearLocalDatabaseIfNoProviderProducts
    //}
    
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
const getOrCreateProduct = async (product, productDetail, category) => {

  let existingProduct = await Product.findOne({

    where: { idProduct: product.id }
  });

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
};


/*
 * Crea un nuevo producto en la base de datos local.
 * Descarga y guarda la imagen del producto si está disponible.
 */
const createProduct = async (product, productDetail, category) => {

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
};

/*
 * Actualiza un producto existente en la base de datos local con la información más reciente.
 */
const updateProduct = async (existingProduct, product, productDetail, category) => {
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
};


/*
 * Crea o actualiza las variantes y galerías de un producto.
 * Maneja las variantes del producto (agrega nuevas y actualiza las existentes).
 * Maneja las galerías de imágenes asociadas a las variantes del producto.
 */
const createOrUpdateVariantsAndGalleries = async (productId, syncVariants) => {
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
        valor: variant.valor,
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
 * Itera sobre cada variedad encontrada y llama a deleteVarietyAndRelatedFiles(variety) para eliminar la variedad y todos los archivos (File) asociados a esa variedad.
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
