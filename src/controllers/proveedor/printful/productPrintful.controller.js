import axios from "axios";
import { Op } from 'sequelize';
import { Product } from "../../../models/Product.js";
import { Categorie } from "../../../models/Categorie.js";
import { sequelize } from '../../../database/database.js';
import { Galeria } from "../../../models/Galeria.js";
import { Variedad } from "../../../models/Variedad.js";
import { ProductVariants } from "../../../models/ProductVariants.js";
import { File } from "../../../models/File.js";
import { Option } from "../../../models/Option.js";

import { 
  getPrintfulProductsService, 
  getPrintfulProductDetail,
  getPrintfulCategory,
  createPrintfulOrderService,
} from '../../../services/proveedor/printful/printfulService.js'; // Importa la función de Printful

import  { 
  removeImageVersion  , 
  downloadImage       , 
  extractSKU          , 
  generateSlug        ,
  removeRepeatedColors,
  processGalleryImage,
} from "./helper.js";

import fs from 'fs';
import path from "path";

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
    res.status( 200 ).json({
        product: product,
    });
  } catch {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
  }
}

/*
 *
 * Obtiene todos los productos del provedor Printful y los guarda en la base de datos
 * 
 */
export const getPrintfulProducts = async () => {
  try {
    // Consigue todos los productos de Printful

    const printfulProducts = await getPrintfulProductsService();

    if ( printfulProducts ) {

      await clearLocalDatabaseIfNoProviderProducts(printfulProducts);
      
      // Continua con el código existente para actualizar y crear productos
      for ( const product of printfulProducts ) {
        let tags = [];

        // Obtener todos los detalles del producto
        const productDetail = await getPrintfulProductDetail( product.id );

        // Extraer archivos de los detalles del producto
        const files = productDetail.sync_variants.flatMap(variant => variant.files || []);

        const optionsData = productDetail.sync_variants.flatMap(variant => variant.options|| []);

        // Cateogiras
        const categoryResponse = await getPrintfulCategory( productDetail.sync_variants[ 0 ].main_category_id );

        const category = categoryResponse.category;
        let existingCategory = await Categorie.findOne({
          where: { title: category.title }
        });


        // Si la categoría no existe, créala
        if ( !existingCategory ) {
          if ( category.image_url ) {
            var img_path = category.image_url;
            var name = img_path.split('/');
            var portada_name = await removeImageVersion(name[name.length - 1]) + '.png';
            const uploadDir = path.resolve('./src/uploads/categorie');
            if ( !fs.existsSync( uploadDir ) ) {
              fs.mkdirSync(
                uploadDir, { recursive: true },
              );
            }
            const imagePath = path.join( uploadDir, portada_name );
            await downloadImage( img_path, imagePath );
          }
          existingCategory = await Categorie.create({
            title: category.title,
            imagen: portada_name,
            state: 1,
          });
        }

        // PRODUCT
        let existingProduct = await Product.findOne({
          where: { title: product.name }
        });

        let newProduct;
        if ( !existingProduct ) {
          let data = {
            id: product.id,
            title: product.name,
            categoryId: existingCategory.id,
            price_soles: productDetail.sync_variants[0].retail_price,
            price_usd: productDetail.sync_variants[0].retail_price,
            portada: "",
            resumen: "tu_resumen",
            description: "tu_descripcion",
            sku: await extractSKU(productDetail.sync_variants[0].sku),
            slug: await generateSlug(product.name),
            state: 2,
            imagen: "tu_imagen",
            type_inventario: 2,
            tags: JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map( variant => variant.color ).filter(Boolean))),
          };

          if ( product.thumbnail_url ) {
            var img_path = product.thumbnail_url;
            var name = img_path.split('/');
            var portada_name = name[5];
            data.portada = portada_name;

            const uploadDir = path.resolve('./src/uploads/product');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const imagePath = path.join(uploadDir, portada_name);
            await downloadImage(img_path, imagePath);
          }

          // Crea el producto en ddbb
          newProduct = await Product.create(data);

          // Crear variantes y galerías para el nuevo producto
          await createOrUpdateVariantsAndGalleries(
            newProduct.id, 
            productDetail.sync_variants,
            files,
            optionsData,
          );
        } else {
          newProduct = existingProduct;

          // Actualizar los detalles del producto si es necesario
          existingProduct.title = product.name;
          existingProduct.categoryId = existingCategory.id;
          existingProduct.price_soles = productDetail.sync_variants[0].retail_price;
          existingProduct.price_usd = productDetail.sync_variants[0].retail_price;
          existingProduct.sku = await extractSKU(productDetail.sync_variants[0].sku);
          existingProduct.slug = await generateSlug(product.name);
          existingProduct.tags = JSON.stringify(await removeRepeatedColors(productDetail.sync_variants.map(variant => variant.color).filter(Boolean)));

          if ( product.thumbnail_url ) {
            var img_path = product.thumbnail_url;
            var name = img_path.split('/');
            var portada_name = name[5];
            existingProduct.portada = portada_name;

            const uploadDir = path.resolve('./src/uploads/product');
            if ( !fs.existsSync(uploadDir) ) {
              fs.mkdirSync(
                uploadDir, { recursive: true }
              );
            }
            const imagePath = path.join(uploadDir, portada_name);
            await downloadImage(img_path, imagePath);
          }

          await existingProduct.save();

          // Actualizar variantes y galerías para el producto existente
          await createOrUpdateVariantsAndGalleries(
            newProduct.id, 
            productDetail.sync_variants,
            files,
            optionsData,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error al traer los productos de Printful:', error);
    throw new Error('Error al traer los productos de Printful');
  }
};

/*
 * CREATE ORDER
 *
 **/
export const createPrintfulOrder = async( orderData ) => {
  await createPrintfulOrderService( orderData );

  try {

  } catch ( error) {

  }
};

/*
 *
 * Elimina todos los productos de la base de datos si no hay productos en el proveedor,
 * 
 */
const clearLocalDatabaseIfNoProviderProducts = async (printfulProducts) => {
  try {
    // Get all current products from the database
    const currentProducts = await Product.findAll();
    const printfulProductIds = new Set( printfulProducts.map( product => product.id ) );

    // Borrar categorias liagado al product ya esta!
    // Borrar variedades  liagado al product no esta!
    // borrar galerias liagado al product no esta!
    for (const currentProduct of currentProducts) {
      if (!printfulProductIds.has(currentProduct.id)) {
        // Find associated category
        const category = await Categorie.findOne({ where: { id: currentProduct.categoryId } });

        // Find and delete associated varieties
        const varieties = await Variedad.findAll({ where: { productId: currentProduct.id } });
        for (const variety of varieties) {
          await variety.destroy();
        }

         // Find and delete associated galleries
        const galleries = await Galeria.findAll({ where: { productId: currentProduct.id } });
        for (const gallery of galleries) {
          await gallery.destroy();
        }

        // Destroy the product
        await currentProduct.destroy();

        // Check if the category is still used by any other product
        const productsInCategory = await Product.findAll({ where: { categoryId: category.id } });

        // If no other products use this category, destroy the category
        if (productsInCategory.length === 0) {
          await category.destroy();
        }
      }
    }
  } catch (error) {
    console.error('Error al limpiar la base de datos:', error);
    throw new Error('Error al limpiar la base de datos');
  }
};


/*
 *
 * Crear o actualizar las variantes del producto
 * 
 */
const createOrUpdateVariantsAndGalleries = async (productId, syncVariants, files, optionsData) => {

  // Get existing variants and galleries
  const existingVariants = await Variedad.findAll({ where: { productId } });
  const existingGalleries = await Galeria.findAll({ where: { productId } });

  const newVariants = syncVariants.map(variant => ({
    valor: variant.size,
    color: variant.color,
    
    //new
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
    //new

    productId,
    product: { image: variant.product.image } // For gallery
  }));

  

  const newVariantValues = newVariants.map(variant => variant.valor);
  const existingVariantValues = existingVariants.map(variant => variant.valor);


  // Update existing variants
  for (const variant of existingVariants) {
    // Verifica si variant.valor no está incluido en newVariantValues.
    if (!newVariantValues.includes(variant.valor)) {
      // Eliminar la variante si no está en newVariantValues
      await variant.destroy(); // Remove variant if it no longer exists in Printful
    }
  }

  // Add new variants and update existing ones
  for (const variant of newVariants) {

    const existingVariant = existingVariants.find(v => v.valor === variant.valor);
    if (!existingVariant) {

      // Create new variant
      const newVariant = await Variedad.create({
        valor: variant.valor,
        stock: 0,
        productId: variant.productId,

        // New properties
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

      // Create new ProductVariant
      await ProductVariants.create({
          variant_id: newVariant.variant_id,
          product_id: newVariant.productId,
          image: variant.product.image,
          name: newVariant.name,
          varietyId: newVariant.id // Ensure the foreign key is set correctly
      });



      // Register files
      for (const file of files) {

        if (!file.hash) {
          console.error('File hash is missing:', file);
          continue;
        }
        try {
          await File.create({
              type: file.type,
              hash: file.hash,
              url: file.url,
              filename: file.filename,
              mime_type: file.mime_type,
              size: file.size,
              width: file.width,
              height: file.height,
              dpi: file.dpi,
              status: file.status,
              created: file.created,
              thumbnail_url: file.thumbnail_url,
              preview_url: file.preview_url,
              visible: file.visible,
              is_temporary: file.is_temporary,
              message: file.message,
              varietyId: newVariant.id // Ensure the foreign key is set correctly
          });
        } catch (error) {
          console.error('Error creating file record:', error, file);
        }
      }

      // Crear opciones para la nueva variante
      // Create options for the new variant
      for (const option of optionsData) {
        await Option.create({
          idOption: option.id,
          value: option.value,
          varietyId: newVariant.id, // Ensure the foreign key is set correctly
        });
      }

    } else {
      existingVariant.valor = variant.valor;
      //existingVariant.stock = 0;
      existingVariant.productId = variant.productId;
      await existingVariant.save();
    }
  }

  // Process and update galleries
  const newGalleryImages = new Set();  // Conjunto para almacenar nuevas imágenes de galería
  for (const variant of newVariants) {
    if (variant.product.image) {
      const galleryImagePath = variant.product.image;
      
      const galleryName = await processGalleryImage(galleryImagePath);
      newGalleryImages.add(galleryName);

      const existingGallery = existingGalleries.find(gallery => gallery.imagen === galleryName);
      if (!existingGallery) {
        await Galeria.create({
          imagen: galleryName,
          color: variant.color,
          productId
        });

      } else {
        const galleryImagePath = variant.product.image;
        const galleryName = await processGalleryImage(galleryImagePath);
        existingGallery.imagen = galleryName;
        existingGallery.color = variant.color;
        existingGallery.productId = variant.productId;

        await existingGallery.save();
      }
    }
  }

  // Remove galleries that are no longer associated with any variant
  for (const existingGallery of existingGalleries) {
    if (!newGalleryImages.has(existingGallery.imagen)) { // Verificar si la imagen no está en el conjunto de nuevas imágenes
      await existingGallery.destroy();
    }
  }
};


