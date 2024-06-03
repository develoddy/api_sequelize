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

import { Cart } from "../models/Cart.js";
import { Cupone } from "../models/Cupone.js";
import { CuponeProduct } from "../models/CuponeProduct.js";
import { CuponeCategorie } from "../models/CuponeCategorie.js";

// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';


export const list = async (req, res) => {
    try {

        let user_id = req.query.user_id;

        // Utilizando Sequelize para buscar los carritos del usuario
        let carts = await Cart.findAll({
            where: {
                userId: user_id
            },
            include: [
                { model: Variedad },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Mapeando los resultados para transformarlos según sea necesario
        let CARTS = carts.map(cart => {
            return resources.Cart.cart_list(cart);
        });

        // Enviando la respuesta
        res.status(200).json({
            carts: CARTS,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "debug: CartController list OCURRIÓ UN PROBLEMA"
        });
    }
}

export const register = async (req, res) => {
    try {

        let data = req.body;
        
        // PRIMERO VAMOS A VALIDAR SI EL PRODUCTO EXISTE EN EL CARRITO DE COMPRA
        if (data.variedad) {
            let valid_cart = await Cart.findOne({
                where: {
                    userId: data.user,
                    variedadId: data.variedad,
                    productId: data.product,
                }
            });
            if (valid_cart) {
                res.status(200).json({
                    message: 403,
                    message_text: "El producto con la variedad ya existe en el carrito de compra",
                });
                return;
            }
        } else {
            // AQUÍ SERÍA PRODUCTO DE INVENTARIO UNITARIO
            let valid_cart = await Cart.findOne({
                where: {
                    userId: data.user,
                    productId: data.product,
                }
            });
            if (valid_cart) {
                res.status(200).json({
                    message: 403,
                    message_text: "El producto ya existe en el carrito de compra",
                });
                return;
            }
        }

        // SEGUNDO VAMOS A VALIDAR SI EL STOCK ESTÁ DISPONIBLE
        if (data.variedad) {
            let valid_variedad = await Variedad.findOne({
                where: {
                    id: data.variedad,
                }
            });
            if (valid_variedad.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "El stock no está disponible!",
                });
                return;
            }
        } else {
            // AQUÍ SERÍA PRODUCTO DE INVENTARIO UNITARIO
            let valid_product = await Product.findOne({
                where: {
                    id: data.product,
                }
            });
            if (valid_product.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "El stock no está disponible!",
                });
                return;
            }
        }

        // Insertar en la tabla Cart
        let newCart = await Cart.create({
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
        let newCartWithAssociations = await Cart.findByPk(newCart.id, {
            include: [
                { model: Variedad },
                { model: Product, include: { model: Categorie } }
            ]
        });

        res.status(200).json({
            cart: resources.Cart.cart_list(newCartWithAssociations.toJSON()),
            message_text: "Success! El carrito se registró con éxito",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController register: OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async (req, res) => {
    try {

        let _id = req.params.id;
        let cart = await Cart.findOne({ where: { id: _id } });
        if (cart) {
            await cart.destroy();
            res.status(200).json({
                message_text: "El cartito se eliminó correctamente!",
            });
        } else {
            res.status(404).json({
                message: "Cart no encontrado"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController delete OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}


export const update = async (req, res) => {
    try {

        console.log("--- Api: update cart ---");
        console.log(req.body);

        let data = req.body;


        // Validar si el stock está disponible
        if ( data.variedad ) {
            let validVariedad = await Variedad.findOne({
                where: { id: data.variedad }
            });

            if ( validVariedad.stock < data.cantidad ) {
                res.status(200).json({
                    message: 403,
                    message_text: "Ups! Ha superado el numero maximo de stock",
                });
                return;
            }
        } else {
            // Aquí sería producto de inventario unitario
            let validProduct = await Product.findOne({
                where: { id: data.product }
            });

            if (validProduct.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "Ups! Ha superado el numero maximo de stock",
                });
                return;
            }
        }

        let cart = await Cart.update(data, {
            where: { id: data._id }
        });

        // Volver a buscar el carrito actualizado con las asociaciones necesarias
        let newCart = await Cart.findOne({
            where: { id: data._id },
            include: [
                { model: Variedad },
                {
                    model: Product,
                    include: [{ model: Categorie }]
                }
            ]
        });

        console.log("-- api newCart --", newCart);

        res.status(200).json({
            cart: resources.Cart.cart_list(newCart),
            message_text: "El cartito se actualizó con éxito!",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const apllyCupon = async (req, res) => {
    try {

        console.log("--- API APLYCUPON ---", req.body);
        // { code: 'A2C2D3D5', user_id: 1 }
        let data = req.body;

        // Validar la existencia del cupón
        let cupon = await Cupone.findOne({
            where: { code: data.code },
            include: [
                { model: CuponeProduct, attributes: ['productId'] },
                { model: CuponeCategorie, attributes: ['categoryId'] }
            ]
        });

        

        if (!cupon) {
            res.status(200).json({
                message: 403,
                message_text: "El cupon ingresado no existe, digite otro nuevamente"
            });
            return;
        }

        
        // Parte operativa
        let carts = await Cart.findAll({
            where: { userId: data.user_id },
            include: [{ model: Product }]
        });


        let products = cupon.cupones_products.map(cuponeProduct => cuponeProduct.productId);
        let categories = cupon.cupones_categories.map(cuponeCategorie => cuponeCategorie.categoryId);

        

        for (const cart of carts) {
            let subtotal = 0;
            let total = 0;

            
            if (products.length > 0 && products.includes(cart.product.id)) {

                if ( cupon.type_discount == 1 ) { // Por porcentaje
                    subtotal = parseFloat((cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01)).toFixed(2));
                } else { // Por moneda
                    subtotal = cart.price_unitario - cupon.discount;
                }

                total = subtotal * cart.cantidad;

            
                await Cart.update({
                    subtotal: subtotal,
                    total: total,
                    type_discount: cupon.type_discount,
                    discount: cupon.discount,
                    code_cupon: cupon.code,
                }, {
                    where: { id: cart.id }
                });
            }


            if (categories.length > 0 && categories.includes(cart.product.categoryId)) {
                if ( cupon.type_discount == 1 ) { // Por porcentaje
                    subtotal = cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01);
                } else { // Por moneda
                    subtotal = cart.price_unitario - cupon.discount;
                }

                total = subtotal * cart.cantidad;
                await Cart.update({
                    subtotal: subtotal,
                    total: total,
                    type_discount: cupon.type_discount,
                    discount: cupon.discount,
                    code_cupon: cupon.code,
                }, {
                    where: { id: cart.id }
                });
            }
        }

        res.status(200).json({
            message: 200,
            message_text: "El cupon es aplicado correctamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController applyCupon OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
