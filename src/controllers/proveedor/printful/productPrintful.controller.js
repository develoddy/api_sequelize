import axios from "axios";
import { Op } from 'sequelize';
import { Product } from "../../../models/Product.js";
import { Categorie } from "../../../models/Categorie.js";
import { sequelize } from '../../../database/database.js';
import { Galeria } from "../../../models/Galeria.js";
import { Variedad } from "../../../models/Variedad.js";
import { 
  getPrintfulProductsService, 
  getPrintfulProductDetail,
  getPrintfulCategory,
} from '../../../services/proveedor/printful/printfulService.js'; // Importa la función de Printful

import  { 
  removeImageVersion  , 
  downloadImage       , 
  extractSKU          , 
  generateSlug        , 
} from "./helper.js";

import fs from 'fs';
import path from "path";
  
export const getPrintfulProducts = async() => {
  try{
      // Get all producto printfull
      const printfulProducts = await getPrintfulProductsService();
      
      if ( printfulProducts ) {
        for ( const product of printfulProducts ) {
          let tags = [ ];

          // Get all details products
          const productDetail = await getPrintfulProductDetail(product.id);
          /**
           *  =================================
           *  =          CATEGORIE            =
           *  =================================
           * */
          const categoryResponse = await getPrintfulCategory(productDetail.sync_variants[0].main_category_id);
          const category = categoryResponse.category;
          let existingCategory = await Categorie.findOne({
              where: { title: category.title }
          });

          // SI LA CATEGORÍA NO EXISTE, CREARLA
          if ( !existingCategory ) {
            if (category.image_url) {
                  var img_path = category.image_url;
                  var name = img_path.split('/');
                  var portada_name = await removeImageVersion(name[name.length - 1])+'.png';
                  const uploadDir = path.resolve('./src/uploads/categorie');
                  if (!fs.existsSync(uploadDir)) {
                      fs.mkdirSync(uploadDir, { recursive: true });
                  }
                  const imagePath = path.join( uploadDir, portada_name );
                  await downloadImage(img_path, imagePath);
            }
            existingCategory = await Categorie.create({
                title: category.title,
                imagen: portada_name,
                state: 1, 
            });
          }
          
          /**
           *  =================================
           *  =          PRODCUT              =
           *  =================================
           * */
          const existingProduct = await Product.findOne({
            where: { title: product.name }
          });

          // SI EL PRODUCTO NO EXISTE, ENTONCES CREARLO
          if ( !existingProduct ) {

            let data = {
              title: "tu_title",
              categoryId: existingCategory.id,
              price_soles: "tu_retail_price",
              price_usd: "tu_retail_price",
              portada: "tu_portada",
              resumen: "tu_resumen",
              description: "tu_descripcion",
              sku: "tu_sku",
              slug: "tu_slug",
              state: 2,
              imagen: "tu_imagen",
              type_inventario: 2,
              tags: [],
            };

             // TITLE
            data.title = product.name;

            // SKU
            const sku = await extractSKU(productDetail.sync_variants[0].sku);
            data.sku = sku;

            // RETAIL PRICE
            const retail_price = productDetail.sync_variants[0].retail_price;
            data.price_soles = retail_price;
            data.price_usd = retail_price;

            // SLUG
            const slug = await generateSlug(product.name);
            data.slug = slug;

            // TAGS
            tags.push(productDetail.sync_variants[0].color);
            let tagsString = JSON.stringify(tags);
            data.tags = tagsString;

            if ( product.thumbnail_url ) {              
              var img_path = product.thumbnail_url;
              var name = img_path.split('/');
              var portada_name = name[5];
              data.portada = portada_name;

              const uploadDir = path.resolve('./src/uploads/product');
              if ( !fs.existsSync( uploadDir ) ) { 
                  fs.mkdirSync( uploadDir, {  recursive: true, } );
              }
              const imagePath = path.join( uploadDir, portada_name );
              await downloadImage( img_path, imagePath );
            }

            // Create product
            const newProduct = await Product.create(data);

            // Recorre las variantes
            if( productDetail.sync_variants.length > 0 ) {
              for (const item of productDetail.sync_variants ) {
                console.log(item);
                if (item.product.image) {
                  const galleryImagePath = item.product.image;
                  const galleryName = galleryImagePath.split('/').pop();
                  const galleryUploadDir = path.resolve('./src/uploads/product');

                  // Verifica si el directorio existe, en caso contrario hay que crearlo
                  if (!fs.existsSync(galleryUploadDir)) {
                      fs.mkdirSync(galleryUploadDir, { recursive: true });
                  }

                  const galleryImageFilePath = path.join(galleryUploadDir, galleryName);
                  await downloadImage(galleryImagePath, galleryImageFilePath);

                  // Crear la galería en la base de datos
                  await Galeria.create({
                      imagen: galleryName,
                      productId: newProduct.id
                  });
                }

                // Crear la variedades en la base de datos
                if(item.size) {
                  await Variedad.create({
                    valor: item.size,
                    stock: 0,
                    productId: newProduct.id
                  });
                }
              }
            }
          }
        }
      }
  } catch (error) {
        console.error('Error al traer los productos de Printful:', error);
        throw new Error('Error al traer los productos de Printful');
    }
}