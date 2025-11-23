import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
// MODELS
import { Slider } from "../models/Slider.js";
import { Categorie } from "../models/Categorie.js";
import { Discount } from "../models/Discount.js";
import { Product } from "../models/Product.js";
import { Variedad } from "../models/Variedad.js";
import { File } from "../models/File.js";
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
import { CartCache } from "../models/CartCache.js";
import { Cupone } from "../models/Cupone.js";
import { CuponeProduct } from "../models/CuponeProduct.js";
import { CuponeCategorie } from "../models/CuponeCategorie.js";

// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';



export const list = async (req, res) => {
    try {

        let user_id = req.query.user_id;

        if ( user_id ) {
            // Buscar productos en  carrito de compras del usuario
            let carts = await Cart.findAll({
                where: {
                    userId: user_id
                },
                include: [
                    { model: Variedad, include: { model: File } },
                    { model: Product, include: { model: Categorie } }
                ]
            });

            // Mapeando los resultados para transformarlos según sea necesario
            let CARTS = carts.map(cart => {
                return resources.Cart.cart_list(cart);
            });

            // 🔍 DEBUG LOG
            console.log('🛒 [CARTS LIST] Enviando carritos al frontend:', {
                count: CARTS.length,
                firstCart: CARTS[0] ? {
                    productTitle: CARTS[0].product?.title,
                    type_campaign: CARTS[0].type_campaign,
                    code_discount: CARTS[0].code_discount,
                    discount: CARTS[0].discount
                } : null
            });

            // Enviando la respuesta
            res.status(200).json({
                carts: CARTS,
            });

        } else {
            // Si no hay usuario autenticado, devolver un carrito vacío o el carrito desde el frontend
            res.status(200).json({ carts: [] });
        }
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
                    message_text: "El producto con esta variedad ya se encuentra en su carrito de compra",
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
                    message_text: "Este producto ya se encuentra en su carrito de compra",
                });
                return;
            }
        }

        // SEGUNDO VAMOS A VALIDAR SI EL STOCK ESTÁ DISPONIBLE
        if (data.variedad) {

            if( data.variedad == 'multiple' ) {
                return;
            }

            let valid_variedad = await Variedad.findOne({
                where: {
                    id: data.variedad,
                }
            });
            if (valid_variedad.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "V El stock no está disponible en este momento.",
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
                    message_text: "P IU El stock no está disponible en este momento.",
                });
                return;
            }
        }

        // Determinar type_campaign
        let type_campaign = null;
        if (data.code_cupon) {
            type_campaign = 3; // Cupón
        } else if (data.code_discount) {
            // Consultar tipo de campaña desde discounts
            const discount = await Discount.findByPk(data.code_discount);
            type_campaign = discount ? discount.type_campaign : null;
        } else if (data.discount && data.discount > 0) {
            type_campaign = 1; // Campaign Discount sin código
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
            type_campaign: type_campaign,
            price_unitario: data.price_unitario,
            subtotal: data.subtotal,
            total: data.total
        });        

        // Obtener el carrito con las asociaciones
        let newCartWithAssociations = await Cart.findByPk(newCart.id, {
            include: [
                { model: Variedad, include: { model: File }  },
                { model: Product, include: { model: Categorie } }
            ]
        });

        res.status(200).json({
            cart: resources.Cart.cart_list(newCartWithAssociations.toJSON()),
            message_text: "La cesta de compra ha sido registrado satisfactoriamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController register: OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const removeAll = async (req, res) => {
    try {
        // Obtenemos el user_id desde los parámetros de la solicitud
        let user_id = req.params.user_id;

        // Buscamos todos los productos del carrito del usuario
        let carts = await Cart.findAll({
            where: {
                userId: user_id
            }
        });

        // Si no hay productos en el carrito, enviamos una respuesta 404
        if (carts.length === 0) {
            return res.status(404).json({
                message: "No se encontraron productos en el carrito para el usuario especificado."
            });
        }

        // Eliminamos todos los productos del carrito del usuario
        await Cart.destroy({
            where: {
                userId: user_id
            }
        });

        // Respondemos con un mensaje de éxito
        res.status(200).json({
            message_text: "Todos los productos del carrito han sido eliminados correctamente."
        });

    } catch (error) {
        res.status(500).send({
            message: "debug: CartController removeAll OCURRIÓ UN PROBLEMA"
        });
    }
}

export const remove = async (req, res) => {
    try {

        let _id = req.params.id;
        let cart = await Cart.findOne({ where: { id: _id } });
        if (cart) {
            //await cart.destroy();
            // Eliminar el carrito específico pasando la condición `where` en el método destroy
            await cart.destroy({ where: { id: _id } });
            res.status(200).json({
                message_text: "El carrito de compra ha sido eliminado correctamente.",
            });
        } else {
            res.status(404).json({
                message: "Cesta no encontrado."
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
        let data = req.body;

        // Validar si el stock está disponible
        if ( data.variedad ) {
            let validVariedad = await Variedad.findOne({
                where: { id: data.variedad }
            });

            if ( validVariedad.stock < data.cantidad ) {
                res.status(200).json({
                    message: 403,
                    message_text: "Lo sentimos, ha excedido la cantidad máxima disponible en el stock.",
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
                    message_text: "Lo sentimos, ha excedido la cantidad máxima disponible en el stock.",
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

        res.status(200).json({
            cart: resources.Cart.cart_list(newCart),
            message_text: "La cesta se actualizó con éxito!",
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
        let data = req.body;
        console.log("💡 [applyCupon] Datos recibidos del front:", data);

        // Validar la existencia del cupón y sus condiciones
        const { Op } = await import('sequelize');
        
        let cupon = await Cupone.findOne({
            where: {
                code: data.code,
                state: 1, // Solo cupones activos
                [Op.or]: [
                    { type_count: 1 }, // Cupones ilimitados
                    { 
                        type_count: 2,     // Cupones limitados
                        num_use: { [Op.gt]: 0 } // Con usos restantes
                    }
                ]
            },
            include: [
                { model: CuponeProduct, attributes: ['productId'] },
                { model: CuponeCategorie, attributes: ['categoryId'] }
            ]
        });

        if (!cupon) {
            console.log("❌ [applyCupon] Cupón no encontrado o sin usos disponibles:", data.code);
            
            // Verificar si existe pero está agotado o inactivo
            const cuponExists = await Cupone.findOne({
                where: { code: data.code }
            });
            
            if (cuponExists) {
                if (cuponExists.state !== 1) {
                    return res.status(200).json({
                        message: 403,
                        message_text: "Este cupón no está disponible en este momento."
                    });
                } else if (cuponExists.type_count === 2 && cuponExists.num_use <= 0) {
                    return res.status(200).json({
                        message: 403,
                        message_text: "Este cupón ha alcanzado el límite de usos permitidos."
                    });
                }
            }
            
            return res.status(200).json({
                message: 403,
                message_text: "El cupón ingresado no es válido. Por favor, inténtelo con otro cupón."
            });
        }

        console.log("✅ [applyCupon] Cupón encontrado:", {
            code: cupon.code,
            type_discount: cupon.type_discount,
            discount: cupon.discount,
            type_count: cupon.type_count,
            num_use: cupon.num_use,
            state: cupon.state
        });

        // Verificar si el cupón ya está aplicado en algún item del carrito
        const existingCoupon = await Cart.findOne({
            where: { 
                userId: data.user_id,
                code_cupon: data.code
            }
        });

        if (existingCoupon) {
            console.log(`⚠️ [applyCupon] Cupón ya aplicado previamente:`, data.code);
            return res.status(200).json({
                message: 403,
                message_text: "Este cupón ya ha sido aplicado a tu carrito."
            });
        }

        // Parte operativa
        let carts = await Cart.findAll({
            where: { userId: data.user_id },
            include: [{ model: Product }]
        });

        console.log(`💼 [applyCupon] Carrito encontrado (${carts.length} items)`);


        let products = cupon.cupones_products.map(cuponeProduct => cuponeProduct.productId);
        let categories = cupon.cupones_categories.map(cuponeCategorie => cuponeCategorie.categoryId);
        console.log("📦 [applyCupon] Productos aplicables del cupón:", products);
        console.log("🗂️ [applyCupon] Categorías aplicables del cupón:", categories);

        for (const cart of carts) {
            let subtotal = cart.price_unitario;
            let total = subtotal * cart.cantidad;

            const appliesToProduct = products.length === 0 || products.includes(cart.product.id);
            const appliesToCategory = categories.length === 0 || categories.includes(cart.product.categoryId);

            // NUEVA VALIDACIÓN MEJORADA: Solo aplicar cupón si el producto NO tiene campaign discount REAL
            const hasExistingCampaignDiscount = cart.discount && cart.type_discount && !cart.code_cupon;
            const isEligibleForCoupon = !hasExistingCampaignDiscount;

            // DEBUG COMPLETO
            console.log(`🔍 [applyCupon] Analizando ${cart.product.title}:`);
            console.log(`   - discount: ${cart.discount}`);
            console.log(`   - code_cupon: ${cart.code_cupon}`);
            console.log(`   - type_discount: ${cart.type_discount}`);
            console.log(`   - appliesToProduct: ${appliesToProduct}`);
            console.log(`   - appliesToCategory: ${appliesToCategory}`);
            console.log(`   - hasExistingCampaignDiscount: ${hasExistingCampaignDiscount}`);
            console.log(`   - isEligibleForCoupon: ${isEligibleForCoupon}`);

            // LIMPIEZA: Si tiene discount pero no type_discount, limpiar datos residuales
            if (cart.discount && !cart.type_discount && !cart.code_cupon) {
                console.log(`🧹 [applyCupon] Limpiando datos residuales de ${cart.product.title}`);
                await Cart.update({
                    discount: null,
                    subtotal: cart.price_unitario,
                    total: cart.price_unitario * cart.cantidad
                }, {
                    where: { id: cart.id }
                });
                // Actualizar valores locales para esta iteración
                cart.discount = null;
            }

            if ((appliesToProduct || appliesToCategory) && isEligibleForCoupon) {
                if (cupon.type_discount == 1) { // Porcentaje
                    subtotal = parseFloat((cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01)).toFixed(2));
                } else { // Por monto fijo
                    subtotal = parseFloat((cart.price_unitario - cupon.discount).toFixed(2));
                }

                total = parseFloat((subtotal * cart.cantidad).toFixed(2));

                // 🔧 APLICAR REDONDEO .95 AL PRECIO FINAL DEL CUPÓN
                const finalPriceWithRounding = Math.floor(subtotal) + 0.95;
                const finalTotal = parseFloat((finalPriceWithRounding * cart.cantidad).toFixed(2));

                await Cart.update({
                    price_unitario: finalPriceWithRounding,  // ⚠️ ACTUALIZAR PRECIO UNITARIO
                    subtotal: finalPriceWithRounding,        // Usar precio con redondeo  
                    total: finalTotal,                       // Total recalculado
                    type_discount: cupon.type_discount,
                    discount: cupon.discount,
                    code_cupon: cupon.code,
                }, {
                    where: { id: cart.id }
                });

                console.log(`💰 [applyCupon] CUPÓN aplicado con redondeo .95: ${cart.price_unitario} → ${finalPriceWithRounding}`);

                console.log(`✅ [applyCupon] Descuento aplicado a ${cart.product.title}: subtotal=${subtotal}, total=${total}`);
            } else if ((appliesToProduct || appliesToCategory) && !isEligibleForCoupon) {
                console.log(`🚫 [applyCupon] ${cart.product.title} NO elegible - ya tiene campaign discount`);
            } else {
                console.log(`ℹ️ [applyCupon] Cupón NO aplica a ${cart.product.title} - producto/categoría no incluida`);
            }
        }

        // for (const cart of carts) {
        //     let subtotal = 0;
        //     let total = 0;

        //     if (products.length > 0 && products.includes(cart.product.id)) {
        //         if ( cupon.type_discount == 1 ) { // Por porcentaje
        //             subtotal = parseFloat((cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01)).toFixed(2));
        //         } else { // Por moneda
        //             subtotal = cart.price_unitario - cupon.discount;
        //         }

        //         total = subtotal * cart.cantidad;

        //         await Cart.update({
        //             subtotal: subtotal,
        //             total: total,
        //             type_discount: cupon.type_discount,
        //             discount: cupon.discount,
        //             code_cupon: cupon.code,
        //         }, {
        //             where: { id: cart.id }
        //         });

        //         console.log(`✅ [applyCupon] Descuento aplicado a ${cart.product.title}: subtotal=${subtotal}, total=${total}`);
        //     } else {
        //         console.log(`ℹ️ [applyCupon] Cupón NO aplica a ${cart.product.title}`);
        //     }


        //     if (categories.length > 0 && categories.includes(cart.product.categoryId)) {
        //         if ( cupon.type_discount == 1 ) { // Por porcentaje
        //             subtotal = cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01);
        //         } else { // Por moneda
        //             subtotal = cart.price_unitario - cupon.discount;
        //         }

        //         total = subtotal * cart.cantidad;
        //         await Cart.update({
        //             subtotal: subtotal,
        //             total: total,
        //             type_discount: cupon.type_discount,
        //             discount: cupon.discount,
        //             code_cupon: cupon.code,
        //         }, {
        //             where: { id: cart.id }
        //         });
        //     }
        // }

        res.status(200).json({
            message: 200,
            message_text: "El cupón ha sido aplicado correctamente.",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController applyCupon OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const removeCupon = async (req, res) => {
    try {
        let data = req.body;
        console.log("🗑️ [removeCupon] Datos recibidos del front:", data);

        if (!data.user_id) {
            res.status(200).json({
                message: 403,
                message_text: "ID de usuario requerido para remover cupón."
            });
            return;
        }

        // Obtener todos los carritos del usuario
        let carts = await Cart.findAll({
            where: { userId: data.user_id },
            include: [{ model: Product }]
        });

        console.log(`🛒 [removeCupon] Carrito encontrado (${carts.length} items)`);

        if (carts.length === 0) {
            res.status(200).json({
                message: 403,
                message_text: "No se encontraron productos en el carrito."
            });
            return;
        }

        // Verificar si hay cupones aplicados
        const cartsWithCoupons = carts.filter(cart => cart.code_cupon && cart.code_cupon.trim() !== '');
        
        if (cartsWithCoupons.length === 0) {
            res.status(200).json({
                message: 403,
                message_text: "No hay ningún cupón aplicado para remover."
            });
            return;
        }

        console.log(`🎫 [removeCupon] Productos con cupón encontrados: ${cartsWithCoupons.length}`);

        // Remover cupones SOLO de productos que tienen cupón aplicado
        // PRESERVAR campaign discounts en productos que no tienen cupón
        for (const cart of carts) {
            if (cart.code_cupon && cart.code_cupon.trim() !== '') {
                // 🔧 RESTAURAR PRECIO ORIGINAL (obtener de variedad o producto)
                let originalPrice = cart.price_unitario;
                
                // Buscar precio original desde variedad o producto
                if (cart.variedadId) {
                    try {
                        const variedad = await (await import('../models/Variedad.js')).Variedad.findByPk(cart.variedadId);
                        if (variedad && variedad.retail_price) {
                            originalPrice = parseFloat(variedad.retail_price);
                        }
                    } catch (e) {
                        console.log('Error obteniendo precio de variedad:', e.message);
                    }
                }
                
                if (originalPrice === cart.price_unitario && cart.product?.price_usd) {
                    originalPrice = parseFloat(cart.product.price_usd);
                }

                let subtotal = originalPrice;
                let total = subtotal * cart.cantidad;

                await Cart.update({
                    price_unitario: originalPrice,  // ⚠️ RESTAURAR PRECIO UNITARIO ORIGINAL
                    subtotal: subtotal,
                    total: total,
                    type_discount: null,
                    discount: null,
                    code_cupon: null,
                }, {
                    where: { id: cart.id }
                });

                console.log(`✅ [removeCupon] Cupón removido de ${cart.product.title}: ${cart.price_unitario} → ${originalPrice}`);
            } else if (cart.discount && !cart.code_cupon) {
                // Este producto tiene campaign discount SIN cupón -> PRESERVAR
                console.log(`ℹ️ [removeCupon] Preservando campaign discount en ${cart.product.title}: discount=${cart.discount}`);
                // NO hacer nada - mantener el campaign discount intacto
            }
        }

        res.status(200).json({
            message: 200,
            message_text: "El cupón ha sido removido correctamente.",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController removeCupon OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}


export const mergeCart = async (req, res) => {
    try {

        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        const backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un conjunto de claves para los artículos existentes en el carrito del backend
        const existingKeys = new Set(backendCartItems.map(item => `${item.productId}-${item.variedadId}`));
       
        // Fusionar los carritos
        const newCartItems = [];

        for (const localItem of localCartItems) {
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            if (!existingKeys.has(key)) {
                newCartItems.push({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Crear los nuevos artículos en el carrito si hay alguno nuevo
        if (newCartItems.length > 0) {
            await Cart.bulkCreate(newCartItems);
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        const updatedCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = updatedCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });

        // Borrar todos los artículos en cartsCache para el usuario autenticado
        await CartCache.destroy({
            where: { user_status: "Guest" }  // Asegúrate de que se borren solo los del usuario autenticado
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};



/*export const mergeCart = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        let backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un mapa de los artículos en el carrito del backend para búsqueda rápida
        const backendItemMap = new Map();
        backendCartItems.forEach(item => {
            const key = `${item.productId}-${item.variedadId}`; // Crear una clave única
            backendItemMap.set(key, item);
        });
       
        // Fusionar los carritos
        for (const localItem of localCartItems) {
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            const existingItem = backendItemMap.get(key);

            if (!existingItem) {
                // Si no existe, agregar el artículo al carrito del backend
                
                // Determinar type_campaign
                let type_campaign = null;
                if (localItem.code_cupon) {
                    type_campaign = 3; // Cupón
                } else if (localItem.code_discount) {
                    const discount = await Discount.findByPk(localItem.code_discount);
                    type_campaign = discount ? discount.type_campaign : null;
                } else if (localItem.discount && localItem.discount > 0) {
                    type_campaign = 1; // Campaign Discount sin código
                }
                
                await Cart.create({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    type_campaign: type_campaign,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = backendCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });

        // Borrar todos los artículos en cartsCache
        await CartCache.destroy({
            where: { user_status: "Guest" }  // Asegúrate de que se borren solo los del usuario autenticado
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};*/


/*
export const mergeCart = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        let backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un mapa de los artículos en el carrito del backend para búsqueda rápida
        const backendItemMap = new Map();
        backendCartItems.forEach(item => {
            const key = `${item.productId}-${item.variedadId}`; // Crear una clave única
            backendItemMap.set(key, item);
        });
       

        // Fusionar los carritos
        for (const localItem of localCartItems) {
            
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            const existingItem = backendItemMap.get(key);

            if (existingItem) {
                // Si existe, actualizar la cantidad (sumarla)
                existingItem.cantidad += localItem.cantidad;
                await existingItem.save();  // Guardar los cambios en la base de datos
            } else {
                // Si no existe, agregar el artículo al carrito del backend
                
                // Determinar type_campaign
                let type_campaign = null;
                if (localItem.code_cupon) {
                    type_campaign = 3; // Cupón
                } else if (localItem.code_discount) {
                    const discount = await Discount.findByPk(localItem.code_discount);
                    type_campaign = discount ? discount.type_campaign : null;
                } else if (localItem.discount && localItem.discount > 0) {
                    type_campaign = 1; // Campaign Discount sin código
                }
                
                await Cart.create({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    type_campaign: type_campaign,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = backendCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};
*/
