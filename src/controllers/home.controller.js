import { Op } from 'sequelize';
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

// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';

export const list = async (req, res) => {
    try {
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

            ObjectOurProducts.push(resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST));
        }

        // Obtener ventas flash
        let FlashSale = await Discount.findOne({
            where: {
                type_campaign: 2,
                start_date_num: { [Op.lte]: TIME_NOW },
                end_date_num: { [Op.gte]: TIME_NOW },
            },
            include: [
                { model: DiscountProduct },
            ]
        });

        let ProductList = [];
        if (FlashSale) {
            for (const product of FlashSale.discounts_products) { // Corregir aquí
                
                let ObjectT = await Product.findByPk(product.productId); // Corregir aquí

                let variedades = await Variedad.findAll({ where: { productId: product.productId } });

                ProductList.push(resources.Product.product_list(ObjectT, variedades));
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
            FlashSale: FlashSale,
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

        console.log("____ API: ", req.query);
        const SLUG = req.params.slug;
        const DISCOUNT_ID = req.query._id;

        // Buscar producto por slug y estado
        let product = await Product.findOne({
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

        // Obtener productos relacionados por categoría y estado
        let relatedProducts = await Product.findAll({
            where: {
                categoryId: product.categoryId,
                state: 2
            }
        });

        // Crear lista de productos relacionados con sus variedades y reviews
        let objectRelateProducts = [];
        for (const relatedProduct of relatedProducts) {
            let relatedVariedades = await Variedad.findAll({ where: { productId: relatedProduct.id } });
            let relatedReviews = await Review.findAll({ where: { productId: relatedProduct.id } });
            let relatedAvgReview = relatedReviews.length > 0 ? Math.ceil(relatedReviews.reduce((sum, item) => sum + item.cantidad, 0) / relatedReviews.length) : 0;
            let relatedCountReview = relatedReviews.length;
            objectRelateProducts.push(resources.Product.product_list(relatedProduct, relatedVariedades, relatedAvgReview, relatedCountReview));
        }

        // Obtener descuento de venta flash si se proporciona un ID de descuento
        let saleFlash = null;
        if (DISCOUNT_ID) {
            saleFlash = await Discount.findByPk(DISCOUNT_ID);
        }

        res.status(200).json({
            product: resources.Product.product_list(product, variedades),
            related_products: objectRelateProducts,
            SALE_FLASH: saleFlash,
            REVIEWS: reviews,
            AVG_REVIEW: avg_review,
            COUNT_REVIEW: count_review,
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

        // Obtener órdenes del usuario
        let Orders = await Sale.findAll({ where: { userId: user_id } });

        let sale_orders = [];
        for ( const order of Orders ) {
            // Obtener detalles de las órdenes con sus relaciones
            let detail_orders = await SaleDetail.findAll({
                where: { saleId: order.id },
                include: [
                    {
                        model: Product,
                        include: [
                            {
                                model: Categorie, 
                            }
                        ]
                    },
                    {
                        model: Variedad,
                    }
                ]
            });
            // Obtener dirección de la orden
            let sale_address = await SaleAddress.findAll({ where: { saleId: order.id } });

            let collection_detail_orders = [];
            for ( const detail_order of detail_orders ) {
                // Obtener review para el detalle de la orden
                let reviewS = await Review.findOne({ where: { saleDetailId: detail_order.id } });

                collection_detail_orders.push({
                    _id: detail_order.id,
                    product: {
                        _id: detail_order.product.id,
                        title: detail_order.product.title,
                        sku: detail_order.product.sku,
                        slug: detail_order.product.slug,
                        imagen: process.env.URL_BACKEND + '/api/products/uploads/product/' + detail_order.product.portada,
                        categorie: detail_order.product.category,
                        price_soles: detail_order.product.price_soles,
                        price_usd: detail_order.product.price_usd,
                    },
                    type_discount: detail_order.type_discount,
                    discount: detail_order.discount,
                    cantidad: detail_order.cantidad,
                    variedad: detail_order.variedad,
                    code_cupon: detail_order.code_cupon,
                    code_discount: detail_order.code_discount,
                    price_unitario: detail_order.price_unitario,
                    subtotal: detail_order.subtotal,
                    total: detail_order.total,
                    review: reviewS,
                });
            }

            sale_orders.push({
                sale: order,
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
            message: "Ocurrió un problema"
        });
        console.log(error);
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
            message: "Se ha guardado su información correctamente.",
            user: {
                name: updatedUser.name,
                surname: updatedUser.surname,
                email: updatedUser.email,
                id: updatedUser.id,
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
        const categories = await Categorie.findAll({ where: { state: 1 } });
        const variedades = await Variedad.findAll();

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
        const price_min = req.body.price_min;
        const price_max = req.body.price_max;

        const filter = {
            state: 2,
        };

        const categories_s = [];
        const products_s = [];

        // FILTRO DE VARIEDAD
        if (categories_selecteds.length > 0) {
            categories_selecteds.forEach(categorie => {
                categories_s.push(categorie);
            });
        }

        let campaingDiscount;
        // FILTRO DE DESCUENTO
        if (is_discount == 2) {
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
            
            if (campaingDiscount) {
                if (campaingDiscount.type_segment == 1) {
                    campaingDiscount.discounts_products.forEach(item => {
                        products_s.push(item.id);
                    });
                } else {
                    campaingDiscount.discounts_categories.forEach(item => {
                        categories_s.push(item.id);
                    });
                }
            }

            //console.log("___ FILTRO products_s & categories_s ", products_s, categories_s);
        }

        //console.log("-----API variedad_selected: ", variedad_selected);

        // FILTRO DE VARIEDAD
        if (variedad_selected) {
            const VAR = await Variedad.findByPk(variedad_selected.id);
            if ( VAR ) {
                products_s.push(VAR.productId);
            }
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

        const OurProducts = await Product.findAll({ where: filter, order: [["createdAt", "ASC"]] });

        const Products = [];
        for (const product of OurProducts) {
            const variedades = await Variedad.findAll({ where: { productId: product.id } });
            const REVIEWS = await Review.findAll({ where: { productId: product.id } });
            const AVG_REVIEW = REVIEWS.length > 0 ? Math.ceil(REVIEWS.reduce((sum, item) => sum + item.cantidad, 0) / REVIEWS.length) : 0;
            const COUNT_REVIEW = REVIEWS.length;
            let DISCOUNT_EXIST = null;

            if (campaingDiscount) {
                if (campaingDiscount.type_segment == 1) { // Por producto
                    const products_a = campaingDiscount.discounts_products.map(item => item.id);
                    if (products_a.includes(product.id)) {
                        DISCOUNT_EXIST = campaingDiscount;
                    }
                } else { // Por categoria
                    const categories_a = campaingDiscount.discounts_categories.map(item => item.id);
                    if (categories_a.includes(product.categoryId)) {
                        DISCOUNT_EXIST = campaingDiscount;
                    }
                }
            }
            Products.push(resources.Product.product_list(product, variedades, AVG_REVIEW, COUNT_REVIEW, DISCOUNT_EXIST));
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
