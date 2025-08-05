import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
// MODELS
import { Product } from "../models/Product.js";
import { Wishlist } from "../models/Wishlist.js";
import { Categorie } from "../models/Categorie.js";
import { Variedad } from "../models/Variedad.js";
import { File } from "../models/File.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { Galeria } from "../models/Galeria.js";

import { Discount } from "../models/Discount.js";
import { DiscountProduct } from "../models/DiscountProduct.js";
import { DiscountCategorie } from "../models/DiscountCategorie.js";
import { SaleDetail } from '../models/SaleDetail.js';
import { Sale } from '../models/Sale.js';
// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';


export const list = async (req, res) => {
    try {

        const TIME_NOW = req.query.TIME_NOW;
        let user_id = req.query.user_id;
        let productIds = req.query.productIds ? req.query.productIds.split(",") : []; // Recibir los productIds desde la query string

        if (user_id) {
            // Si hay un usuario autenticado, busca en la wishlist del usuario
            let wishlist = await Wishlist.findAll({
                where: { userId: user_id },
                include: [
                    { model: Variedad, include: { model: File } },
                    { model: Product, include: [ { model: Categorie }, { model: Galeria } ] }
                ]
            });

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

            let wishlistWithDetails = await Promise.all(wishlist.map(async (item) => {
                try {
                    let product = item.product;
                    let variedades = await Variedad.findAll({ where: { productId: product.id } });
                    let reviews = await Review.findAll({ where: { productId: product.id } });

                    let count_review = reviews.length;
                    let avg_review = count_review > 0
                        ? Math.ceil(reviews.reduce((sum, review) => sum + review.cantidad, 0) / count_review)
                        : 0;

                    let campaingDiscount = null; // Suponiendo que necesitas una lógica para encontrar descuentos en campaña
                    // Si tienes lógica para descuentos en campañas, añádelo aquí.
                    // Ejemplo:
                    if (CampaingDiscount) {
                        if (CampaingDiscount.type_segment === 1) {
                             let products_a = CampaingDiscount.discounts_products.map(item => item.productId);
                             if (products_a.includes(product.id)) {
                                 campaingDiscount = CampaingDiscount;
                             }
                         } else {
                             let categories_a = CampaingDiscount.discounts_categories.map(item => item.categoryId);
                             if (categories_a.includes(product.categoryId)) {
                                 campaingDiscount = CampaingDiscount;
                             }
                         }
                    }

                    return resources.Wishlist.product_list(item, product, variedades, avg_review, count_review, campaingDiscount);
                    
                } catch (error) {
                    console.error("Error fetching details for product", item.product.id, error);
                    return null; // O maneja el error según sea necesario
                }
            }));

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

                    ProductList.push(resources.Wishlist.product_list(ObjectT, variedades));
                }
            } else {
                FlashSale = null;
                ProductList = [];
            }

            // Filtrar resultados nulos
            wishlistWithDetails = wishlistWithDetails.filter(item => item !== null);

            // Enviar la respuesta
            res.status(200).json({
                wishlists: wishlistWithDetails,
                FlashSale: FlashSale,
                campaign_products: ProductList,
            });

        }
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "debug: WishlistController list OCURRIÓ UN PROBLEMA"
        });
    }
};

export const register = async (req, res) => {
    try {

        let data = req.body;

        // PRIMERO VAMOS A VALIDAR SI EL PRODUCTO EXISTE EN EL CARRITO DE COMPRA
        if (data.variedad) {
            let valid_wishlist = await Wishlist.findOne({
                where: {
                    userId: data.user,
                    productId: data.product,
                }
            });
            if ( valid_wishlist ) {
                res.status(200).json({
                    message: 403,
                    message_text: "El producto ya se encuentra en sus favoritos",
                });
                return;
            }
        } else {
            // AQUÍ SERÍA PRODUCTO DE INVENTARIO UNITARIO
            let valid_wishlist = await Wishlist.findOne({
                where: {
                    userId: data.user,
                    productId: data.product,
                }
            });
            if (valid_wishlist) {
                res.status(200).json({
                    message: 403,
                    message_text: "El producto ya se encuentra en sus favoritos",
                });
                return;
            }
        }

        // Insertar en la tabla Wishlist
        let newWishlist = await Wishlist.create({
            userId: data.user,
            productId: data.product,
            variedadId: data.variedad,
            type_discount: data.type_discount,
            discount: data.discount,
            cantidad: data.cantidad,
            code_cupon: data.code_cupon,
            code_discount: data.code_discount,
            price_unitario: data.price_unitario,
            subtotal: data.subtotal,
            total: data.total
        });

        // Obtener los favoritos con las asociaciones
        let newWishlistWithAssociations = await Wishlist.findByPk(newWishlist.id, {
            include: [
                { model: Variedad, include: { model: File }  },
                { model: Product, include: [{ model: Categorie }, { model: Galeria }] }
            ]
        });

        // Convertir los detalles de la wishlist en un formato adecuado
        let product = newWishlistWithAssociations.product;
        let variedades = await Variedad.findAll({ where: { productId: product.id } });
        let reviews = await Review.findAll({ where: { productId: product.id } });

        let count_review = reviews.length;
        let avg_review = count_review > 0
            ? Math.ceil(reviews.reduce((sum, review) => sum + review.cantidad, 0) / count_review)
            : 0;

        // Aquí puedes añadir lógica para los descuentos de campaña si es necesario
        let campaingDiscount = null;

        // Crear la respuesta final usando tu recurso `Wishlist`
        let wishlistWithDetails = resources.Wishlist.product_list(
            newWishlistWithAssociations,
            product,
            variedades,
            avg_review,
            count_review,
            campaingDiscount
        );

        res.status(200).json({
            wishlist: wishlistWithDetails,//resources.Wishlist.product_list(newWishlistWithAssociations.toJSON()),
            message_text: "El producto ha sido añadido a sus favoritos",
        });

    } catch (error) {
        res.status(500).send({
            message: "debug: WishlistController register: OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async (req, res) => {
    try {

        let _id = req.params.id;
        let wishlist = await Wishlist.findOne({ where: { id: _id } });
        if (wishlist) {
            await wishlist.destroy();
            res.status(200).json({
                message_text: "La lista de deseos ha sido eliminado correctamente",
            });
        } else {
            res.status(404).json({
                message: "Lista de deseos no encontrado"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debug: WishlistController delete OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
