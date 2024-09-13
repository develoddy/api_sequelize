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
// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';


export const list = async (req, res) => {
    try {
        let user_id = req.query.user_id;

        // Buscar productos en la lista de deseos del usuario
        let wishlist = await Wishlist.findAll({
            where: {
                userId: user_id,
            },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Mapeando los resultados para transformarlos según sea necesario
        let WISHLIST = wishlist.map(wishlist => {
            return resources.Wishlist.wishlist_list(wishlist);
        });

        // Usar Promise.all para obtener los reviews de cada producto en la wishlist
        const wishlistWithReviews = await Promise.all(WISHLIST.map(async (item) => {
            try {
                // Obtener reviews del producto actual en la wishlist
                let reviews = await Review.findAll({
                    where: { productId: item.product._id },
                    include: [{ model: User }]
                });

                // Calcular el promedio de reviews (AVG_REVIEW) y la cantidad de reviews (COUNT_REVIEW)
                let count_review = reviews.length;
                let avg_review = count_review > 0
                    ? Math.ceil(reviews.reduce((sum, item) => sum + item.cantidad, 0) / count_review)
                    : 0;

                // Incluir reviews, promedio y cantidad dentro del objeto de cada producto
                return {
                    ...item, // Mantener las propiedades originales del item
                    REVIEWS: reviews,
                    AVG_REVIEW: avg_review,
                    COUNT_REVIEW: count_review
                };
            } catch (error) {
                console.error("Error fetching reviews for product", item.product._id, error);
                return { ...item, REVIEWS: [], AVG_REVIEW: 0, COUNT_REVIEW: 0 };
            }
        }));

        // Enviar la respuesta final
        res.status(200).json({
            wishlists: wishlistWithReviews
        });
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

        // Obtener el carrito con las asociaciones
        let newWishlistWithAssociations = await Wishlist.findByPk(newWishlist.id, {
            include: [
                { model: Variedad, include: { model: File }  },
                { model: Product, include: { model: Categorie } }
            ]
        });

        res.status(200).json({
            wishlist: resources.Wishlist.wishlist_list(newWishlistWithAssociations.toJSON()),
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
