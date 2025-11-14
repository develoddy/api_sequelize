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
  getGelatiProductsService,
  getGelatoProductDetail,
  getGelatoPriceProduct,
} from '../../../services/proveedor/gelato/gelatoService.js';
import fs from 'fs';
import path from "path";

import  { 
  removeImageVersion  , 
  downloadImage       ,
  convertWhiteToTransparent,
  extractSKU          , 
  generateSlug        ,
  removeRepeatedColors,
  removeRepeatedGelatoColors,
  processGalleryImage,
  formatPrice,
  generateImageName,
} from "../printful/helper.js";

export const list = async( req, res ) => {
  try{
    const products = await getGelatiProductsService();
    res.status( 200 ).json({
        products: products,
    });
  } catch {
    console.error('Error al traer los productos de Gelato:', error);
    throw new Error('Error al traer los productos de Gelato');
  }
}

const processPrintfulProduct = async (product) => {
  try {
    const productDetail = await getGelatoProductDetail(product.id);
    const category = await getOrCreateCategory(product);
    const existingProduct = await getOrCreateProduct(productDetail, category);
    //await createOrUpdateVariantsAndGalleries(existingProduct.id, productDetail.sync_variants);
  } catch (error) {
    console.error('Error processing Gelato product:', error);
    throw new Error('Error processing Gelato product');
  }
};

const getOrCreateCategory = async (productDetail) => {
  const category = productDetail.category;
  let existingCategory = await Categorie.findOne({
    where: { title: category },
  });

  if (!existingCategory) {
    existingCategory = await createCategory(category);
  }
  return existingCategory;
};

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
    title: category,
    imagen: portada_name,
    state: 1,
  });
};

const getOrCreateProduct = async (product, productDetail, category) => {
  let existingProduct = await Product.findOne({
    where: { idProduct: product.id }
  });

  if (!existingProduct) {
    existingProduct = await createProduct(product, productDetail, category);
  } else {
    existingProduct = await updateProduct(existingProduct, product, productDetail, category);
  }

  return existingProduct;
};

const findValidValueMetadata = async (metadataArray) => {
  for (const item of metadataArray) {
    if (item.key === 'primaryPreviewProductVariantKey') {
      return item.value;
    }
  }
  return null;
};

const createProduct = async (productDetail, category) => {
  const productUid = await findValidValueMetadata(productDetail.metadata);
  const prices = await getGelatoPriceProduct( productUid );
  const formattedPrice = await formatPrice(prices[0].price);
  const uniqueColors = await removeRepeatedGelatoColors(productDetail.productVariantOptions);
  
  let portada_name = '';
  let tags = [];

  let data = {
    idProduct: productDetail.id,
    title: productDetail.title,
    categoryId: category.id,
    price_soles: formattedPrice,
    price_usd: formattedPrice,
    portada: '',
    resumen: productDetail.description,//'tu_resumen',
    description: 'tu_descripcion',
    sku: 'tu-sku',
    slug: await generateSlug(productDetail.title),
    state: 2,
    imagen: 'tu_imagen',
    type_inventario: 2,
    tags: JSON.stringify(uniqueColors),
  };

  if (productDetail.previewUrl) {
    const img_path = productDetail.previewUrl;
    const portada_name = await generateImageName(img_path); 
    data.portada = portada_name;
    const uploadDir = path.resolve('./src/uploads/product');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const imagePath = path.join(uploadDir, portada_name);
    await downloadImage(img_path, imagePath);
  }

  return await Product.create(data);
};



// --- PRINCIPAL
export const getGelatoProducts = async () => {
  try {
    const gelatoProducts = await getGelatiProductsService();
    if (gelatoProducts) {
      // await clearLocalDatabaseIfNoProviderProducts(gelatoProducts);
      for (const product of gelatoProducts) {
        await processPrintfulProduct(product);
      }
    }
  } catch (error) {
    console.error('Error al traer los productos de Gelato:', error);
    throw new Error('Error al traer los productos de Gelato');
  }
}