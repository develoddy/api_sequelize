import { Op, Sequelize } from 'sequelize';
import { sequelize } from '../database/database.js';
// MODELS
import { Slider } from "../models/Slider.js";
import { Categorie } from "../models/Categorie.js";
import { Discount } from "../models/Discount.js";
import { Product } from "../models/Product.js";
import { Variedad } from "../models/Variedad.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { Galeria } from "../models/Galeria.js";

import { DiscountProduct } from "../models/DiscountProduct.js";
import { DiscountCategorie } from "../models/DiscountCategorie.js";

import { SaleDetail } from '../models/SaleDetail.js';
import { Sale } from '../models/Sale.js';
import { SaleAddress } from "../models/SaleAddress.js";
import { AddressClient } from "../models/AddressClient.js";
import { ProductVariants } from "../models/ProductVariants.js";
// Shipment not needed - tracking data is directly in Sale model

// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';

// PRINTFUL SERVICES
import { getPrintfulSizeGuideService } from '../services/proveedor/printful/printfulService.js';


export const list = async (req, res) => {
    try {

        // Definir sinónimos por categoría
        const CATEGORY_MAP = {
            sudaderas: ['hoodies', 'sudadera', 'sudaderas', 'hoodie', 'sweatshirt', 'sweatshirts'],
            tazas: ['mugs', 'taza', 'tazas', 'cup', 'cups'],
            camisetas: ['shirts', 'shirt', 'camiseta', 'camisetas', 'all shirts'],
            gorras: [
                'hats', 'hat',
                'cap', 'caps',
                'dad hat', 'dad hats',
                'baseball cap', 'baseball caps',
                'snapback', 'snapbacks',
                'trucker hat', 'trucker hats',
                'Dad hats / baseball caps', 'dad hats / baseball caps',
            ]
        };


        const TIME_NOW = req.query.TIME_NOW;

        // Obtener sliders
        let Sliders = await Slider.findAll({ where: { state: 1 } });
        Sliders = Sliders.map(slider => resources.Slider.slider_list(slider));

        // Obtener categorías
        let Categories = await Categorie.findAll({ where: { state: 1 } });
        Categories = Categories.map(categorie => resources.Categorie.categorie_list(categorie));

        // Obtener descuentos de campaña con sus productos y categorías
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


        // Obtener mejores productos
        let BestProducts = await Product.findAll({
            where: { state: 2 },
            include: [
                { model: Galeria },
                { model: Categorie }
            ],
            order: [['createdAt', 'DESC']]
        });

        let ObjectBestProducts = [];
        for (const product of BestProducts) {
            let variedades = await Variedad.findAll({ where: { productId: product.id } });
            let REVIEWS = await Review.findAll({ where: { productId: product.id } });
            let AVG_REVIEW = REVIEWS.length > 0 ? Math.ceil(REVIEWS.reduce((sum, item) => sum + item.cantidad, 0) / REVIEWS.length) : 0;
            let COUNT_REVIEW = REVIEWS.length;
            let DISCOUNT_EXIST = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1) { // Por producto
                    let products_a = CampaingDiscount.discounts_products.map(item => item.productId); // Corregir aquí
                    if (products_a.includes(product.id)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                } else { // Por categoría
                    let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId); // Corregir aquí
                    if (categories_a.includes(product.categoryId)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                }
            }

            ObjectBestProducts.push(resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST));
        }

        // Obtener nuestros productos
        let OurProducts = await Product.findAll({
            where: { state: 2 },
            include: [
                { model: Galeria },
                { model: Categorie }
            ],
            order: [['createdAt', 'ASC']]
        });


        let ObjectOurProducts = [];
        let HoodiesProducts = [];
        let MugsProducts = [];
        let CapsProducts = [];



        for (const product of OurProducts) {
            let variedades = await Variedad.findAll({ where: { productId: product.id } });
            let REVIEWS = await Review.findAll({ where: { productId: product.id } });
            let AVG_REVIEW = REVIEWS.length > 0 ? Math.ceil(REVIEWS.reduce((sum, item) => sum + item.cantidad, 0) / REVIEWS.length) : 0;
            let COUNT_REVIEW = REVIEWS.length;
            let DISCOUNT_EXIST = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1) { // Por producto
                    let products_a = CampaingDiscount.discounts_products.map(item => item.productId); // Corregir aquí
                    if (products_a.includes(product.id)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                } else { // Por categoría
                    let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId); // Corregir aquí
                    if (categories_a.includes(product.categoryId)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                }
            }

            // ObjectOurProducts.push(resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST));
            let productObject = resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST);
            //ObjectOurProducts.push(productObject);

            // Normalizar el nombre de categoría
            const categoryName = product.category?.title?.toLowerCase();

            // Separar por categoría
            if (CATEGORY_MAP.camisetas.includes(categoryName)) ObjectOurProducts.push(productObject);
            if (CATEGORY_MAP.sudaderas.includes(categoryName)) HoodiesProducts.push(productObject);
            if (CATEGORY_MAP.tazas.includes(categoryName)) MugsProducts.push(productObject);
            if (CATEGORY_MAP.gorras.includes(categoryName)) CapsProducts.push(productObject);
        }

        // Obtener ventas flash
        //let FlashSale = await Discount.findOne({
        let FlashSales = await Discount.findAll({
            where: {
                type_campaign: 2,
                start_date_num: { [Op.lte]: TIME_NOW },
                end_date_num: { [Op.gte]: TIME_NOW },
            },
            include: [{ 
                model: DiscountProduct,
                include: [{
                    model: Product,
                    include: [Galeria]
                }] 
            },
            ]
        });


        let ProductList = [];
        if (FlashSales) {
            for (const flash of FlashSales) {
                for (const discountProduct of flash.discounts_products) {
                    let ObjectT = discountProduct.product;
                    let variedades = await Variedad.findAll({ where: { productId: ObjectT.id } });

                    ProductList.push(resources.Product.product_list(ObjectT, variedades));
                }
            }
            
        } else {
            FlashSale = null;
            ProductList = [];
        }

        
        res.status(200).json({
            sliders: Sliders,
            categories: Categories,
            bes_products: ObjectBestProducts,
            our_products: ObjectOurProducts,
            hoodies_products: HoodiesProducts,
            mugs_products: MugsProducts,
            caps_products: CapsProducts,  
            FlashSales: FlashSales,
            campaign_products: ProductList,
        });


    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema"
        });
        console.log(error);
    }
}

export const show_landing_product = async (req, res) => {
    try {

        const SLUG = req.params.slug || null;
        const DISCOUNT_ID = req.query._id;

        let product = null;

        let relatedProducts = [];
        let objectRelateProducts = [];
        let objectInterestProducts = [];
        

        // Si se proporciona un slug, buscar el producto
        if (SLUG !== "null") {
            // Buscar producto principal por slug y estado
            product = await Product.findOne({
                where: {
                    slug: SLUG,
                    state: 2
                },
                include: [
                    { model: Galeria },
                    { model: Categorie }
                ],
            });

            // Verificar si el producto existe
            if (!product) {
                return res.status(404).json({ message: "Producto no encontrado" });
            }

            // Obtener variedades del producto
            let variedades = await Variedad.findAll({
                where: { productId: product.id }
            });

            // Obtener reviews del producto junto con los usuarios
            let reviews = await Review.findAll({
                where: { productId: product.id },
                include: [{ model: User }]
            });

            let avg_review = reviews.length > 0 ? Math.ceil(reviews.reduce((sum, item) => sum + item.cantidad, 0) / reviews.length) : 0;
            let count_review = reviews.length;

            // Productos relacionados: misma categoría, excluir el mismo producto
            relatedProducts = await Product.findAll({
                where: {
                    categoryId: product.categoryId,
                    state: 2,
                    id: { [Op.ne]: product.id }
                }
            });
        }

        // Si no hay slug o no hay productos relacionados, devolver productos de interés
        //if (SLUG === 'null' || !SLUG || relatedProducts.length === 0) {
            // Devolver productos genéricos o sugeridos
        //    relatedProducts = await Product.findAll({
        //        where: { state: 2 },
        //        limit: 4 // Limitar la cantidad de productos sugeridos
        //    });
        //}

        // Obtener productos de interés: diferentes a la categoría del producto principal
        let interestWhere = { state: 2 };
        if (product) interestWhere.categoryId = { [Op.ne]: product.categoryId };

        // Obtener productos de interés (siempre mostrar)
        const productsOfInterest = await Product.findAll({
          where: interestWhere,
          limit: 8
        });



        
        // Obtener variedades del producto si hay slug
        let variedades = product ? await Variedad.findAll({ where: { productId: product.id } }) : [];

        // Obtener reviews del producto si hay slug
        let reviews = product ? await Review.findAll({ where: { productId: product.id }, include: [{ model: User }] }) : [];
        let avg_review = reviews.length > 0 ? Math.ceil(reviews.reduce((sum, item) => sum + item.cantidad, 0) / reviews.length) : 0;
        let count_review = reviews.length;

        // Obtener descuento de campaña actual
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

        // Obtener Flash Sales activos
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

        // Verificar si el producto tiene descuento de campaña
        let DISCOUNT_EXIST = null;
        if (product && CampaingDiscount) {
            if (CampaingDiscount.type_segment === 1) { // Por producto
                let products_a = CampaingDiscount.discounts_products.map(item => item.productId);
                if (products_a.includes(product.id)) {
                    DISCOUNT_EXIST = CampaingDiscount;
                }
            } else { // Por categoría
                let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId);
                if (categories_a.includes(product.categoryId)) {
                    DISCOUNT_EXIST = CampaingDiscount;
                }
            }
        }

        // Crear lista de productos relacionados con sus variedades y reviews
        //let objectRelateProducts = [];
        for (const relatedProduct of relatedProducts) {
            let relatedVariedades = await Variedad.findAll({ where: { productId: relatedProduct.id } });
            let relatedReviews = await Review.findAll({ where: { productId: relatedProduct.id } });
            let relatedAvgReview = relatedReviews.length > 0 ? Math.ceil(relatedReviews.reduce((sum, item) => sum + item.cantidad, 0) / relatedReviews.length) : 0;
            let relatedCountReview = relatedReviews.length;

            // Calculamos descuento de campaña para el producto relacionado
            let relatedDiscount = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1) { // Por producto
                    let products_a = CampaingDiscount.discounts_products.map(item => item.productId);
                    if (products_a.includes(relatedProduct.id)) {
                        relatedDiscount = CampaingDiscount;
                    }
                } else { // Por categoría
                    let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId);
                    if (categories_a.includes(relatedProduct.categoryId)) {
                        relatedDiscount = CampaingDiscount;
                    }
                }
            }
            objectRelateProducts.push(resources.Product.product_list(relatedProduct, relatedVariedades, relatedAvgReview, relatedCountReview, relatedDiscount));
        }

        // Crear lista de productos de interés con el mismo formato
        for (const interestProduct of productsOfInterest) {
            const interestVariedades = await Variedad.findAll({ where: { productId: interestProduct.id } });
            const interestReviews = await Review.findAll({ where: { productId: interestProduct.id } });
            const interestAvgReview = interestReviews.length > 0
                ? Math.ceil(interestReviews.reduce((sum, item) => sum + item.cantidad, 0) / interestReviews.length)
                : 0;
            const interestCountReview = interestReviews.length;

            let interestDiscount = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment === 1 &&
                    CampaingDiscount.discounts_products.map(p => p.productId).includes(interestProduct.id)) {
                    interestDiscount = CampaingDiscount;
                } else if (CampaingDiscount.type_segment !== 1 &&
                    CampaingDiscount.discounts_categories.map(c => c.categoryId).includes(interestProduct.categoryId)) {
                    interestDiscount = CampaingDiscount;
                }
            }

            objectInterestProducts.push(
                resources.Product.product_list(interestProduct, interestVariedades, interestAvgReview, interestCountReview, interestDiscount)
            );
        }

        // Obtener descuento de venta flash si se proporciona un ID de descuento
        let saleFlash = null;
        if (DISCOUNT_ID) {
            // Si se proporciona un ID de descuento específico
            saleFlash = await Discount.findByPk(DISCOUNT_ID);
        } else if (product && SALE_FLASH_EXIST) {
            // Verificar si el producto está incluido en el Flash Sale activo
            if (SALE_FLASH_EXIST.type_segment === 1) { // Por producto
                let products_a = SALE_FLASH_EXIST.discounts_products.map(item => item.productId);
                if (products_a.includes(product.id)) {
                    saleFlash = SALE_FLASH_EXIST;
                }
            } else { // Por categoría
                let categories_a = SALE_FLASH_EXIST.discounts_categories.map(item => item.categoryId);
                if (categories_a.includes(product.categoryId)) {
                    saleFlash = SALE_FLASH_EXIST;
                }
            }
        }

        // 📏 Obtener guías de tallas de Printful si el producto existe
        let sizeGuides = null;
        if (product && product.idProduct) {
            try {
                sizeGuides = await getPrintfulSizeGuideService(product.idProduct);
            } catch (error) {
                sizeGuides = null;
            }
        }

        res.status(200).json({
            product: resources.Product.product_list(product, variedades, avg_review, count_review, DISCOUNT_EXIST),
            related_products: objectRelateProducts,
            interest_products: objectInterestProducts,
            SALE_FLASH: saleFlash,
            REVIEWS: reviews,
            AVG_REVIEW: avg_review,
            COUNT_REVIEW: count_review,
            SIZE_GUIDES: sizeGuides, // ✨ Nueva data de guías de tallas
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema"
        });
        console.log(error);
    }
}

export const profile_client = async (req, res) => {
    try {

        let user_id = req.body.user_id;

        // Obtener órdenes del usuario ordenadas por fecha de creación descendente (más recientes primero)
        // Sale model ya contiene campos de tracking de Printful: trackingNumber, trackingUrl, carrier, syncStatus, shippedAt
        let Orders = await Sale.findAll({ 
            where: { userId: user_id },
            order: [['createdAt', 'DESC']]
        });

        let sale_orders = [];

        for ( const order of Orders ) {

            // Obtener detalles de las órdenes con sus relaciones
            let detail_orders = await SaleDetail.findAll({
                where: { saleId: order.id },
                include: [
                    {
                        model: Product,
                        include: [{
                                model: Categorie,
                            }
                        ]
                    },
                    {
                        model: Variedad,
                    },
                    {
                        model: Sale,
                    }
                ]
            });

            // Obtener dirección de la orden
            let sale_address = await SaleAddress.findAll({ where: { saleId: order.id } });

            let collection_detail_orders = [];
            for (const detail_order of detail_orders) {
                const d = detail_order.get({ plain: true }); // Convierte Sequelize instance a objeto plano

                // Obtener review para el detalle de la orden
                let reviewS = await Review.findOne({ where: { saleDetailId: d.id } });

                collection_detail_orders.push({
                    _id: d.id,
                    sale: order,
                    product: {
                    _id: d.product.id,
                    title: d.product.title,
                    sku: d.product.sku,
                    slug: d.product.slug,
                    imagen: process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada,
                    categorie: d.product.category,
                    price_soles: d.product.price_soles,
                    price_usd: d.product.price_usd,
                    },
                    type_discount: d.type_discount,
                    discount: d.discount,
                    cantidad: d.cantidad,
                    variedad: d.variedad,
                    code_cupon: d.code_cupon,
                    code_discount: d.code_discount,
                    price_unitario: d.price_unitario,
                    subtotal: d.subtotal,
                    total: d.total,
                    type_campaign: d.type_campaign ?? null, // ✅ Ahora sí llegará al frontend
                    review: reviewS,
                });
            }

            // Preparar información de la venta con tracking de Printful
            const saleWithShipments = {
                ...order.get({ plain: true }), // Convertir Sequelize instance a objeto plano
                shipments: order.shipments ? order.shipments.map(shipment => ({
                    id: shipment.id,
                    printfulShipmentId: shipment.printfulShipmentId,
                    carrier: shipment.carrier,
                    service: shipment.service,
                    trackingNumber: shipment.trackingNumber,
                    trackingUrl: shipment.trackingUrl,
                    status: shipment.status,
                    shippedAt: shipment.shippedAt,
                    deliveredAt: shipment.deliveredAt,
                    createdAt: shipment.createdAt,
                    updatedAt: shipment.updatedAt
                })) : []
            };

            sale_orders.push({
                sale: saleWithShipments,
                sale_details: collection_detail_orders,
                sale_address: sale_address,
            });
        }

        // Obtener direcciones del cliente
        let addressClient = await AddressClient.findAll({
            where: { userId: user_id },
            include: [
                {
                    model: User,
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            sale_orders: sale_orders,
            address_client: addressClient,
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema",
            error: error
        });
        console.log(" [Internal error] ---->", error);
    }
}

export const update_client = async (req, res) => {
    try {
        let updateData = { ...req.body };

        if (req.files && req.files.length > 0) {
            const avatarFile = req.files.find(file => file.fieldname === 'avatar');
            if (avatarFile) {
                var img_path = avatarFile.path;
                var name = img_path.split('/');
                var avatar_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                updateData.avatar = avatar_name;
            }
        }

        // Encriptar la contraseña si está presente
        if ( req.body.password ) {
            updateData.password = await bcrypt.hash(req.body.password, 10);
        }

        // Actualizar el usuario
        await User.update(updateData, { where: { id: req.body._id } });

        // Obtener el usuario actualizado
        const updatedUser = await User.findOne({ where: { id: req.body._id } });

        res.status(200).json({
            status:200,
            message: "Tus datos han sido modificados en nuestra base de datos.",
            user: {
                name: updatedUser.name,
                surname: updatedUser.surname,
                email: updatedUser.email,
                _id: updatedUser.id,
            }
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema"
        });
        console.log(error);
    }
}

export const search_product = async (req, res) => {
    try {
        const TIME_NOW = req.query.TIME_NOW;
        const search_product = req.body.search_product;

        const OurProducts = await Product.findAll({
            where: {
                state: 2,
                title: {
                    [Op.like]: `%${search_product}%`
                }
            },
            include: [
                { model: Galeria },
                { model: Categorie }
            ],
            order: [["createdAt", "ASC"]]
        });

        const CampaingDiscount = await Discount.findOne({
            where: {
                type_campaign: 1,
                start_date_num: { [Op.lte]: TIME_NOW },
                end_date_num: { [Op.gte]: TIME_NOW }
            },
            include: [
                { model: DiscountProduct },
                { model: DiscountCategorie }
            ]
        });

        const Products = [];
        for (const Product of OurProducts) {
            const variedades = await Variedad.findAll({
                where: {
                    productId: Product.id
                }
            });
            const REVIEWS = await Review.findAll({
                where: {
                    productId: Product.id
                }
            });
            const AVG_REVIEW = REVIEWS.length > 0 ? Math.ceil(REVIEWS.reduce((sum, item) => sum + item.cantidad, 0) / REVIEWS.length) : 0;
            const COUNT_REVIEW = REVIEWS.length;
            let DISCOUNT_EXIST = null;
            if (CampaingDiscount) {
                if (CampaingDiscount.type_segment == 1) {
                    const products_a = CampaingDiscount.discounts_products.map(item => item.id);
                    if (products_a.includes(Product.id)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                } else {
                    const categories_a = CampaingDiscount.discounts_categories.map(item => item.id);
                    if (categories_a.includes(Product.categorie_id)) {
                        DISCOUNT_EXIST = CampaingDiscount;
                    }
                }
            }
            Products.push(resources.Product.product_list(Product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST));
        }

        res.status(200).json({
            products: Products,
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrio un problema"
        });
        console.log(error);
    }
}

export const config_initial = async (req, res) => {
    try {
        //let categories = await Categorie.findAll({ where: { state: 1 } });
        let categories = await Categorie.findAll({
            where: { state: 1 },
            attributes: {
                include: [
                    // Añadimos un campo adicional con el total de productos
                    [Sequelize.fn("COUNT", Sequelize.col("products.id")), "total_products"]
                ]
            },
            include: [{
                model: Product,
                attributes: [], // No necesitamos traer los productos, solo contarlos
                required: false // Por si hay categorías sin productos
            }],
            group: ['categories.id'] // Agrupamos por categoría
        });

        const variedades = await Variedad.findAll();

        //categories = categories.map((categorie) => {
        //    return resources.Categorie.categorie_list(categorie);
        //});
        categories = categories.map((categorie) => {
            const formattedCategorie = resources.Categorie.categorie_list(categorie);
            formattedCategorie.total_products = categorie.dataValues.total_products; // Añadimos el total
            return formattedCategorie;
        });

        res.status(200).json({
            categories: categories,
            variedades: variedades,
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema"
        });
        console.log(error);
    }
}

export const filters_products = async (req, res) => {
    try {
        const TIME_NOW = req.query.TIME_NOW;
        const search_product = req.body.search_product;
        const categories_selecteds = req.body.categories_selecteds;
        const is_discount = req.body.is_discount;
        const variedad_selected = req.body.variedad_selected;
        const selectedColors = req.body.selectedColors;
        const price_min = req.body.price_min;
        const price_max = req.body.price_max;
        const logo_position_selected = req.body.logo_position_selected; // new filter logo center or lateral

        const filter = {
            state: 2,
        };

        const categories_s = [];
        const products_s = [];

        // FILTRO DE VARIEDAD
        if (categories_selecteds.length > 0) {
            categories_selecteds.forEach(categorie => {
                // Asegurar que sea número
                categories_s.push(Number(categorie));
            });
        }
        
        let campaingDiscount = null;
        let flashSales = null;
        
        // FILTRO POR CAMPAING DISCOUNT
        if (is_discount == 1 ) {
            campaingDiscount = await Discount.findOne({
                where: {
                    type_campaign: 1,
                    start_date_num: { [Op.lte]: TIME_NOW },
                    end_date_num: { [Op.gte]: TIME_NOW }
                },
                include: [
                    { model: DiscountProduct },
                    { model: DiscountCategorie }
                ]
            });

            
        }

        // FILTRO POR FLASH SALE
        if (is_discount == 2) {
            flashSales = await Discount.findOne({
                where: {
                    type_campaign: 2,
                    start_date_num: { [Op.lte]: TIME_NOW },
                    end_date_num: { [Op.gte]: TIME_NOW },
                },
                include: [{ 
                    model: DiscountProduct,
                    include: [{
                        model: Product,
                        include: [Galeria]
                    }] 
                },
                ]
            });
        }


        let variedadWhere = {};

        if (variedad_selected && variedad_selected.valor) {
            variedadWhere.valor = variedad_selected.valor;
        }

        // -- SI HAY COLORES SELECCIONADO, SE AÑADRE AL FILTRO
        if (selectedColors && selectedColors.length > 0) {
            variedadWhere.color = { [Op.in]: selectedColors };
        }

        if (Object.keys(variedadWhere).length > 0) {
            const VARIEDADES = await Variedad.findAll({
                where: variedadWhere
            });

            const productIdsVariedades = VARIEDADES.map(v => v.productId);

            productIdsVariedades.forEach(id => {
                if (!products_s.includes(id)) {
                    products_s.push(id);
                }
            });
        }

        if (categories_s.length > 0) {
            filter.categoryId = { [Op.in]: categories_s };
        }

        if (products_s.length > 0) {
            filter.id = { [Op.in]: products_s };
        }

        if (price_min > 0 && price_max > 0) {
            filter.price_usd = { [Op.between]: [price_min, price_max] };
        }

        console.log("------> logo_position_selected : ", logo_position_selected);
        
        if (logo_position_selected && logo_position_selected !== '') {
            filter.logo_position = logo_position_selected;
        }

        // Buscar productos según filtro construido
        let OurProducts = await Product.findAll({
            where: filter, //state: 2,
            include: [
                { model: Galeria },
                { model: Categorie }
            ],
            order: [
              ['createdAt', 'ASC'] // ASC = 1, DESC = -1
            ]
        });
          
        const Products = [];
        
        for (const product of OurProducts) {
            const variedades = await Variedad.findAll({ where: { productId: product.id } });
            const REVIEWS = await Review.findAll({ where: { productId: product.id } });
            const AVG_REVIEW = REVIEWS.length > 0 ? Math.ceil(REVIEWS.reduce((sum, item) => sum + item.cantidad, 0) / REVIEWS.length) : 0;
            const COUNT_REVIEW = REVIEWS.length;
            let DISCOUNT_EXIST = null;
            if (campaingDiscount) {
                if (campaingDiscount.type_segment == 1) { // Por producto
                    const products_a = campaingDiscount.discounts_products.map(item => item.productId);
                    
                    // Comprueba si product.id está dentro del array products_a.
                    if (products_a.includes(product.id)) {
                        DISCOUNT_EXIST = campaingDiscount;
                    }
                } else { // Por categoria
                    const categories_a = campaingDiscount.discounts_categories.map(item => item.categoryId);
                    if (categories_a.includes(product.categoryId)) {
                        DISCOUNT_EXIST = campaingDiscount;
                    }
                }
            }

            if (flashSales) {
                if (flashSales.type_segment === 1) { // Por producto
                    const products_a = flashSales.discounts_products.map(item => item.productId); // Corregir aquí

                    if (products_a.includes(product.id)) {
                        DISCOUNT_EXIST = flashSales;

                    }
                } else { // Por categoría
                    const categories_a = flashSales.discounts_categories.map(item => item.categoryId); // Corregir aquí
                    if (categories_a.includes(product.categoryId)) {
                        DISCOUNT_EXIST = flashSales;
                    }
                }
            }

            const finalProduct = resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST);
            Products.push(finalProduct);
        }

        res.status(200).json({
            products: Products,
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Ocurrio un problema"
        });
    }
}
