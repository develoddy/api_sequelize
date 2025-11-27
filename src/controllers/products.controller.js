import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
import resources from "../resources/index.js";
import { Product } from "../models/Product.js";
import { Categorie } from "../models/Categorie.js";
import { Variedad } from "../models/Variedad.js";
import { Galeria } from "../models/Galeria.js";
import { File } from "../models/File.js";
import { Option } from "../models/Option.js";
import { Cart } from "../models/Cart.js";
import { Wishlist } from "../models/Wishlist.js";
import { SaleDetail } from "../models/SaleDetail.js";
import { ProductVariants } from "../models/ProductVariants.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { Discount } from "../models/Discount.js";
import { DiscountProduct } from "../models/DiscountProduct.js";
import { DiscountCategorie } from "../models/DiscountCategorie.js";
import fs from 'fs';
import path from "path";
import { getPrintfulProducts } from './proveedor/printful/productPrintful.controller.js';
import { getGelatoProducts } from './proveedor/gelato/productGelato.controller.js';


/* ----------------------------- START PROVEDORES ---------------------------- */
export const syncPrintfulProducts = async (req, res) => {
    try {
        console.log('🔄 [SYNC] Iniciando sincronización con Printful...');
        const startTime = Date.now();
        
        // Ejecutar sincronización y obtener estadísticas
        const result = await getPrintfulProducts();
        
        const duration = Date.now() - startTime;
        console.log(`✅ [SYNC] Sincronización completada en ${duration}ms`);
        console.log('📊 [SYNC] Estadísticas:', result);
        
        // Validar que result tenga datos
        if (!result) {
            throw new Error('No se obtuvieron resultados de la sincronización');
        }
        
        // Responder con estadísticas detalladas
        res.status(200).json({
            sync: true,
            productsProcessed: result.total || 0,
            created: result.created || 0,
            updated: result.updated || 0,
            deleted: result.deleted || 0,
            skipped: result.skipped || 0,
            errors: result.errors || [],
            duration: `${(duration / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [SYNC] Error crítico en sincronización:', error);
        
        res.status(500).send({
            sync: false,
            message: "Error al sincronizar productos de Printful",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

export const syncGelatoProducts = async (req, res) => {
    try {
        await getGelatoProducts();
        res.status( 200 ).json({
            sync: true,
        });
    } catch (error) {
        res.status( 500 ).send({
            message: "debbug: ProductController syncGelatoProducts - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
/* --------------------------------------------------------------------------- */


/* ----------------------------- ENDPOINTS ----------------------------------- */
export const register = async(req, res) => {
    try {
        let data = req.body;

        const valid_Product = await Product.findOne({ where: { title: data.title }} );

        if( valid_Product ) {
            res.status(200).send({
                code: 403,
                message: "El producto ya existe"
            });
            return;
        }

        data.slug = data.title.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');

        if (req.files && req.files.length > 0) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                data.portada = portada_name;
            }
        }

        data.categoryId = data.categorie;

        let product = await Product.create( data );

        res.status(200).json({
            message: "¡Success! El Producto se ha registrado correctamente"
        });

    } catch (error) {
        res.status(500).send({
            message: "Debugg: ProducController - Ocurrio un problema en Register"
        });
    }
}

export const update = async(req, res) => {
    try {
        let data = req.body;

        data.categoryId = data.categorie;

        let valid_Product = await Product.findOne({
            where: {
                title: data.title,
                id: { [ Op.ne ]: data._id }
            }
        });

        if( valid_Product ) {
            res.status(200).send({
                code: 403,
                message: "¡Ups! El producto ya existe"
            });
            return;
        }


        // Utilizando Sequelize para buscar los carritos del usuario
        let carts = await Cart.findAll({
            where: {
                productId: data._id,
            },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });


        // Filtrar y eliminar productos que ya no existen o que están ignorados
        for (let cart of carts) {
            // Verifica si el producto ha sido eliminado o está en estado ignorado
            if (cart.product.state == 1) {
                // Eliminar el item del carrito
                await Cart.destroy({ where: { id: cart.id } });
            }
        }

        data.slug = data.title.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');

        if ( req.files && req.files.length > 0 ) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                data.portada = portada_name;
            }
        }

        await Product.update(data, { where: { id: data._id } });

        res.status(200).json({
            message: "¡Success! El Registro se ha modificado correctamente"
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Debugg: ProducController - Ocurrio un problema en Update"
        });
    }
}

export const list = async (req, res) => {
  try {
    const filter = [];
    let products = [];

    // 🔍 Filtro por búsqueda (nombre o SKU)
    if (req.query.search) {
      filter.push({
        [Op.or]: [
          {
            title: { [Op.like]: `%${req.query.search}%` }
          },
          {
            sku: { [Op.like]: `%${req.query.search}%` }
          }
        ]
      });
    }

    // 🔎 Filtro por categoría
    if (req.query.categorie) {
      filter.push({
        categoryId: req.query.categorie
      });
    }

    // 🧩 Consulta final
    products = await Product.findAll({
      where: filter.length ? { [Op.and]: filter } : {},
      include: [Categorie]
    });

    products = products.map(product => resources.Product.product_list(product));

    res.status(200).json({ 
        products,
        total: products.length
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "debug: ProductController list - OCURRIÓ UN PROBLEMA"
    });
  }
};

// export const list = async ( req, res ) => {
//     try {
//         var filter  = [];
//         var products = null;

//         if ( req.query.search ) {
//             filter.push({
//                 title: {
//                     [Op.like]: `%${req.query.search}%` 
//                 }
//             });
//         }
//         if ( req.query.categorie ) {
//             filter.push({
//                 categoryId: req.query.categorie // Asumiendo que la relación se llama categorieId en el modelo de Producto
//             });
//         }

//         if( filter.length > 0 ) {

//             products = await Product.findAll({
//                 where: {
//                     [Op.and]: filter // Utilizamos Op.and para la lógica $and
//                 },
//                 include: [Categorie] // Utilizamos include para realizar la operación de populate
//             });

//             products = products.map( product => {
//                 return resources.Product.product_list( product );
//             });
//         } else {
//             // BUSCAR LAS CATEGORIAS
//             products = await Product.findAll({
//                 include: {
//                     model: Categorie,
//                 }
//             });

//             products = products.map( product => {
//                 return resources.Product.product_list( product );
//             });
//         }

//         res.status( 200 ).json({
//             products: products,
//         });

//     } catch ( error ) {
//         res.status( 500 ).send({
//             message: "debbug: ProductController list - OCURRIÓ UN PROBLEMA"
//         });
//         console.log(error);
//     }
// }

export const remove = async(req, res) => {
    try {
        let _id = req.query._id;

        // ENCUENTRA EL PRODUCTO MEDIANTE EL ID
        const product = await Product.findByPk(_id);
        if ( !product ) {
            return res.status(404).json({
                message: "PRODUCTO NO ENCONTRADP"
            });
        }

        await Galeria.destroy({ where: { productId: _id } });

        await Wishlist.destroy({ where: { productId: _id } });

        await Cart.destroy({ where: { productId: _id } });

        // OBTENER TODAS LAS VARIEDADES DEL PRODUCTO
        const variedades = await Variedad.findAll({ where: { productId: _id } });

        // ELIMINA LOS ARCHIVOS ASOCIADOS A CADA VARIEDAD
        for (const variedad of variedades) {

            // ELIMINA LAS VARIANTES DEL PRODUCTO
            await ProductVariants.destroy({ where: { varietyId: variedad.id } });

            // ELIMINA LOS DETALLE DE LA ORDEN ASOCIADO A CADA VARIEDAD
            await SaleDetail.destroy({ where: { productId: _id, variedadId: variedad.id } });

            // ELIMINA LAS OPCIONES ASOCIADAS A CADA VARIEDAD
            await Option.destroy({ where: { varietyId: variedad.id } });

            // ELIMNA LOS ARCHIVOS ASOCIADOS A CADA VARIEDAD
            await File.destroy({ where: { varietyId: variedad.id } });
        }

        // ELIMINA POR COMPLETO LAS VARIEDADES
        await Variedad.destroy({ where: { productId: _id } });

        // GUARDA EL ID DE CATEGORIA DEL PRODUCTO ANTES DE ELIMINARLO
        const categoryId = product.categoryId;

        // ELIMINA EL PRODUCTO POR COMPLETO
        await Product.destroy({ where: { id: _id } });

        // VERIFICA SI LA CATEGORIA NO ESTÁ ASOCIADA A OTROS PRODUCTOS ANTES DE ELIMINARLA
        const categoryInUse = await Product.findOne({ where: { categoryId: categoryId } });
        if (!categoryInUse) {
            await Categorie.destroy({ where: { id: categoryId } });
        }

        res.status(200).json({
            message: "EL PRODUCTO, VARIEDADES, OPCIONES, ARCHIVOS Y CATEGORIA SE HAN BORRADO CORRECTAMENTE"
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const getImage = async(req, res) => {
    try {

        const img = req.params['img'];

        const imgPath = path.resolve('./src/uploads/product', img);
        const defaultPath = path.resolve('./src/uploads', 'default.png');

        fs.stat(imgPath, function(err) {
            if (!err) {
                res.status(200).sendFile(imgPath);
            } else {
                res.status(200).sendFile(defaultPath);
            }
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController getImage - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const register_imagen = async(req, res) => {
    try {
        const galerias = [];
        if (req.files && req.files.length > 0) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var imagen_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo

                const galeria = await Galeria.create({
                    imagen: imagen_name,
                    color: req.body.color,
                    productId: req.body._id,
                });

                galerias.push(galeria);

                // Asociar las galerías al producto
                const product = await Product.findByPk( req.body._id );
                if ( !product ) {
                    return res.status(404).json({ message: 'Producto no encontrado' });
                }

                await product.addGalerias(galerias);

                res.status(200).json({
                    message: "La imagen se subió perfectamente",
                    imagen: {
                        //imagen: imagen_name,
                        imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+imagen_name,
                        _id: galeria.id
                    }
                });
            }
        }

    } catch (error) {
        console.error('Error al registrar las imágenes:', error);
        res.status(500).json({ message: 'Error del servidor al registrar las imágenes' });
    }
}

export const remove_imagen = async(req, res) => {
    try {
        const productId = req.body._id;
        const galeriaId = req.body.__id;

        await Galeria.destroy({ where: { id: galeriaId } });

        res.status(200).json({
            message: "La imagen se eliminó perfectamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController remove_imagen - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const show = async(req, res) => {
    try {
        var product_id = req.params.id;

        const product = await Product.findOne({
            where: {
                id: product_id,
            },
            include: [
                {
                    model: Galeria
                },
                {
                    model: Categorie
                },
            ]
        });

        if (!product) {
            return res.status(404).json({ message: "¡Ups! Producto no encontrado" });
        }

        // Encuentra las variedades asociadas al producto
        const variedades = await Variedad.findAll({
            where: { productId: product_id }
        });

        res.status(200).json({
            product: resources.Product.product_list(product, variedades)
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController show - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

// Nuevo endpoint para uso en panel admin: devuelve producto con la misma estructura
// que show_landing_product (variedades, reviews, descuentos, etc.) pero protegido
// para no modificar la implementación existente en home.controller.js
export const show_admin_product = async (req, res) => {
    try {
        const product_id = req.params.id;

        // Buscar producto por PK incluyendo galerías y categoría
        const product = await Product.findOne({
            where: { id: product_id },
            include: [
                { model: Galeria },
                { model: Categorie }
            ]
        });

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        console.log("[DEBUG Admin] Cargando producto:", product.id);

        // Obtener variedades exactamente como en home.controller
        const variedades = await Variedad.findAll({ where: { productId: product.id } });
        console.log("[DEBUG Admin] Variedades cargadas:", variedades.length);

        // Obtener reviews junto con usuarios
        const reviews = await Review.findAll({ where: { productId: product.id }, include: [{ model: User }] });
        const avg_review = reviews.length > 0 ? Math.ceil(reviews.reduce((sum, item) => sum + item.cantidad, 0) / reviews.length) : 0;
        const count_review = reviews.length;

        // Obtener descuento de campaña actual (mismo comportamiento que frontend)
        const TIME_NOW = Date.now();
        let CampaingDiscount = await Discount.findOne({
            where: {
                type_campaign: 1,
                start_date_num: { [Op.lte]: TIME_NOW },
                end_date_num: { [Op.gte]: TIME_NOW },
            },
            include: [
                { model: DiscountProduct },
                { model: DiscountCategorie }
            ]
        });

        let DISCOUNT_EXIST = null;
        if (CampaingDiscount) {
            if (CampaingDiscount.type_segment === 1) {
                const products_a = CampaingDiscount.discounts_products.map(item => item.productId);
                if (products_a.includes(product.id)) {
                    DISCOUNT_EXIST = CampaingDiscount;
                }
            } else {
                const categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId);
                if (categories_a.includes(product.categoryId)) {
                    DISCOUNT_EXIST = CampaingDiscount;
                }
            }
        }

        // Productos relacionados: misma categoría, excluir el mismo producto
        let relatedProducts = await Product.findAll({
            where: {
                categoryId: product.categoryId,
                state: 2,
                id: { [Op.ne]: product.id }
            }
        });

        let objectRelateProducts = [];
        for (const relatedProduct of relatedProducts) {
            let relatedVariedades = await Variedad.findAll({ where: { productId: relatedProduct.id } });
            let relatedReviews = await Review.findAll({ where: { productId: relatedProduct.id } });
            let relatedAvgReview = relatedReviews.length > 0 ? Math.ceil(relatedReviews.reduce((sum, item) => sum + item.cantidad, 0) / relatedReviews.length) : 0;
            let relatedCountReview = relatedReviews.length;

            let relatedDiscount = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1) {
                    let products_a = CampaingDiscount.discounts_products.map(item => item.productId);
                    if (products_a.includes(relatedProduct.id)) {
                        relatedDiscount = CampaingDiscount;
                    }
                } else {
                    let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId);
                    if (categories_a.includes(relatedProduct.categoryId)) {
                        relatedDiscount = CampaingDiscount;
                    }
                }
            }

            objectRelateProducts.push(resources.Product.product_list(relatedProduct, relatedVariedades, relatedAvgReview, relatedCountReview, relatedDiscount));
        }

        // Productos de interés (distintos a la categoría del producto)
        let interestWhere = { state: 2 };
        if (product) interestWhere.categoryId = { [Op.ne]: product.categoryId };

        const productsOfInterest = await Product.findAll({ where: interestWhere, limit: 8 });
        let objectInterestProducts = [];
        for (const interestProduct of productsOfInterest) {
            const interestVariedades = await Variedad.findAll({ where: { productId: interestProduct.id } });
            const interestReviews = await Review.findAll({ where: { productId: interestProduct.id } });
            const interestAvgReview = interestReviews.length > 0 ? Math.ceil(interestReviews.reduce((sum, item) => sum + item.cantidad, 0) / interestReviews.length) : 0;
            const interestCountReview = interestReviews.length;

            let interestDiscount = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1 && CampaingDiscount.discounts_products.map(p => p.productId).includes(interestProduct.id)) {
                    interestDiscount = CampaingDiscount;
                } else if (CampaingDiscount.type_segment !== 1 && CampaingDiscount.discounts_categories.map(c => c.categoryId).includes(interestProduct.categoryId)) {
                    interestDiscount = CampaingDiscount;
                }
            }

            objectInterestProducts.push(resources.Product.product_list(interestProduct, interestVariedades, interestAvgReview, interestCountReview, interestDiscount));
        }

        // Flash sales (SALE_FLASH)
        const SALE_FLASH_EXIST = await Discount.findOne({
            where: {
                type_campaign: 2,
                start_date_num: { [Op.lte]: TIME_NOW },
                end_date_num: { [Op.gte]: TIME_NOW },
            },
            include: [
                { model: DiscountProduct },
                { model: DiscountCategorie }
            ]
        });

        let saleFlash = null;
        if (SALE_FLASH_EXIST) {
            if (SALE_FLASH_EXIST.type_segment === 1) {
                let products_a = SALE_FLASH_EXIST.discounts_products.map(item => item.productId);
                if (products_a.includes(product.id)) {
                    saleFlash = SALE_FLASH_EXIST;
                }
            } else {
                let categories_a = SALE_FLASH_EXIST.discounts_categories.map(item => item.categoryId);
                if (categories_a.includes(product.categoryId)) {
                    saleFlash = SALE_FLASH_EXIST;
                }
            }
        }

        const finalProduct = resources.Product.product_list(product, variedades, avg_review, count_review, DISCOUNT_EXIST);
        console.log("[DEBUG Admin] Producto final:", finalProduct && finalProduct._id);

        res.status(200).json({
            product: finalProduct,
            related_products: objectRelateProducts,
            interest_products: objectInterestProducts,
            SALE_FLASH: saleFlash,
            REVIEWS: reviews,
            AVG_REVIEW: avg_review,
            COUNT_REVIEW: count_review,
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "debbug: ProductController show_admin_product - OCURRIÓ UN PROBLEMA" });
    }
}
/* --------------------------------------------------------------------------- */