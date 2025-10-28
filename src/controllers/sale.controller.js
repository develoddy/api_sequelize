import { Op } from 'sequelize';
import { User } from "../models/User.js";
import { Guest } from "../models/Guest.js";
import { Sale } from "../models/Sale.js";
import { Cart } from "../models/Cart.js";
import { CartCache } from "../models/CartCache.js";
import { Variedad } from "../models/Variedad.js";
import { Categorie } from "../models/Categorie.js";
import { Product } from "../models/Product.js";
import { SaleDetail } from "../models/SaleDetail.js";
import { SaleAddress } from "../models/SaleAddress.js";
import { Galeria } from "../models/Galeria.js";
import { Option } from "../models/Option.js";
import { ProductVariants } from "../models/ProductVariants.js";
import { File } from "../models/File.js";
import fs from 'fs';
import path from "path";
import Handlebars from 'handlebars';
import ejs from 'ejs';
import nodemailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';

import { createPrintfulOrder } from './proveedor/printful/productPrintful.controller.js';


async function send_email(sale_id) {
    try {
        const readHTMLFile = (path, callback) => {
            fs.readFile( path, { encoding: 'utf-8' }, ( err, html ) => {
                if (err) {
                    return callback(err);
                }
                else {
                    callback(null, html);
                }
            });
        };

        const order = await Sale.findByPk(sale_id, {
            include: [
                { model: User },
                { model: Guest }
            ]
        });

        const orderDetails = await SaleDetail.findAll({
            where: { saleId: order.id },
            include: [
                { model: Product },
                { model: Variedad }
            ]
        });

        const addressSale = await SaleAddress.findOne({
            where: { saleId: order.id }
        });

        
        if ( orderDetails ) {
            orderDetails.forEach(orderDetail => {
                orderDetail.product.portada = `${process.env.URL_BACKEND}/api/products/uploads/product/${orderDetail.product.portada}`;
            });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: true, // true para puerto 465
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                // Para depurar problemas TLS, puede ser útil:
                rejectUnauthorized: false
            },
            logger: true,    // Para logging detallado de SMTP
            debug: false      // Mostrar detalles en consola
        });

        transporter.verify(function(error, success) {
            if (error) {
                console.log('SMTP connection error:', error);
            } else {
                console.log('SMTP server is ready to take messages');
            }
        });

        readHTMLFile(`${process.cwd()}/src/mails/email_sale.html`, (err, html) => {
            if (err) {
                return callback(err);
            }

            // Enriquecer detalles con precio unitario y total considerando descuentos
            const enrichedOrderDetails = orderDetails.map(detail => {
                const d = detail.toJSON();
                d.product = d.product; // conservar producto
                // Sequelize toJSON devuelve la variedad en d.variedade, renombramos a d.variedad
                d.variedad = d.variedad ?? d.variedade ?? null;
                
                // Precio original (sin descuento)
                const originalPrice = parseFloat(d.variedad?.retail_price ?? d.price_unitario);
                d.originalPrice = originalPrice;
                
                // Precio final considerando descuento
                const finalPrice = parseFloat(d.discount || d.code_discount || originalPrice);
                d.unitPrice = finalPrice;
                
                // Indicar si tiene descuento (comparando precio original vs precio final)
                d.hasDiscount = finalPrice < originalPrice;
                
                // calcular total por cantidad usando precio final
                d.total = parseFloat((finalPrice * d.cantidad).toFixed(2));
                return d;
            });
            
            // Recalcular subtotal total del pedido según detalles enriquecidos
            const enrichedOrder = order.toJSON ? order.toJSON() : { ...order };
            enrichedOrder.total = enrichedOrderDetails
                .reduce((sum, d) => sum + d.total, 0)
                .toFixed(2);
            
            const rest_html = ejs.render(html, {
                order: enrichedOrder,
                address_sale: addressSale,
                order_detail: enrichedOrderDetails
            });

            const template = Handlebars.compile(rest_html);
            const htmlToSend = template({ op: true });

            // COMPROBAR PORQUE ORDER ES NULL
            // LA COMPRA NO FUNCIONA EN MODO GUEST

            // 👇 Determinar el email según si es user o guest
            let emailDestino = null;

            if (order.user) {
                emailDestino = order.user.email;
            } else if (order.guest) {
                emailDestino = order.guest.email;
            }

            if (!emailDestino) {
                console.warn("No se encontró email del usuario ni del invitado.");
                return;
            }

            let subject = '';

            if (orderDetails.length === 1) {
              subject = `Pedido Nº ${order.id} - ${orderDetails[0].product.title}`;
            } else if (orderDetails.length > 1) {
              subject = `Pedido Nº ${order.id} - ${orderDetails[0].product.title} y ${orderDetails.length - 1} productos más`;
            } else {
              subject = `Pedido Nº ${order.id} procesado correctamente`;
            }

            const mailOptions = {
                from: `"tienda.lujandev.com" <${process.env.EMAIL_USER}>`,
                to: emailDestino,
                subject: subject,
                html: htmlToSend
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        });

    } catch (error) {
        console.log(error);
    }
}

// Register de sale para usuarios Invitados (Guest)
export const registerGuest = async (req, res) => {
    try {
        const saleData = req.body.sale;
        // Si ya viene stripeSessionId, evitar duplicados: devolver venta existente
        if (saleData.stripeSessionId) {
            const existing = await Sale.findOne({ where: { stripeSessionId: saleData.stripeSessionId } });
            if (existing) {
                const saleDetails = await getSaleDetails(existing.id);
                return res.status(200).json({
                    message: "Venta ya procesada (invitado)",
                    sale: existing,
                    saleDetails: saleDetails
                });
            }
        }
       
        const saleAddressData = req.body.sale_address;

        // Validación mínima
        if (!saleData || !saleAddressData) {
            return res.status(400).json({ message: "Faltan datos para procesar la venta" });
        }

        // Asignar userId null si es invitado
        saleData.user = null;

        // Crear la venta y la dirección asociada
        const sale = await createSale(saleData);
    
        const saleAddress = await createSaleAddress(saleAddressData, sale.id);
       
        // Obtener todos los carritos del usuario
        const cartsCache = await getUserCartsCache(saleData.guestId);
       
        // Suponiendo que mandas `items` desde frontend:
        const { items, costs } = await prepareItemsForPrintful(cartsCache, sale); // items esperado en req.body

        const printfulOrderData = createPrintfulOrderData(saleAddress, items, costs);
        let result = await prepareCreatePrintfulOrder(printfulOrderData);

        if (result.error) {
            return res.status(403).json({
                code: 403,
                message: result.message,
            });
        }

        try {
            await sendEmail(sale.id);
        } catch (emailErr) {
            console.error('Error enviando email de confirmación (guest):', emailErr);
        }
        const saleDetails = await getSaleDetails(sale.id);

        return res.status(200).json({
            message: "Muy bien! La orden se generó correctamente (invitado)",
            sale: sale,
            saleDetails: saleDetails,
        });
    } catch (error) {
        console.log("------> DEBBUG : Error en registerGuest:", error);
        return res.status(500).send({
            message: "Debug: SaleController registerGuest - OCURRIÓ UN PROBLEMA",
        });
    }
};


// Registrar una venta y asociar dirección
// Register de sale para usuarios Autenticados
export const register = async (req, res) => {
    try {
        const saleData = req.body.sale;
        // Incluir stripeSessionId y evitar duplicados para usuarios autenticados
        if (saleData.stripeSessionId) {
            const existing = await Sale.findOne({ where: { stripeSessionId: saleData.stripeSessionId } });
            if (existing) {
                const saleDetails = await getSaleDetails(existing.id);
                return res.status(200).json({
                    message: "Venta ya procesada (auth)",
                    sale: existing,
                    saleDetails: saleDetails,
                    deliveryEstimate: { min: existing.minDeliveryDate, max: existing.maxDeliveryDate }
                });
            }
        }

        const saleAddressData = req.body.sale_address;

        // Crear una venta y asociar la dirección
        const sale = await createSale(saleData);
        // Guardar stripeSessionId si viene en el payload
        if (saleData.stripeSessionId) {
            await sale.update({ stripeSessionId: saleData.stripeSessionId });
        }
    
        const saleAddress = await createSaleAddress(saleAddressData, sale.id);

        // Obtener todos los carritos del usuario
        const carts = await getUserCarts(sale.userId);

        // Preparar los items para Printful
        const { items, costs } = await prepareItemsForPrintful(carts, sale); 

        // Crear datos de la orden para Printful
        const printfulOrderData = createPrintfulOrderData(saleAddress, items, costs);

        // Crear la orden en Printful
        let result = await prepareCreatePrintfulOrder(printfulOrderData);

        if (result.error) {
            return res.status(403).json({
                code: 403,
                message: result.message,
            });
        }

        // Obtener la fecha mínima desde la respuesta de Printful
        //const minDeliveryDate = new Date(result.data.minDeliveryDate);
        // Obtener la fecha mínima desde la respuesta de Printful
        let minDeliveryDate = result.data.minDeliveryDate ? new Date(result.data.minDeliveryDate) : null;

        // Verificar que sea válida
        if (!minDeliveryDate || isNaN(minDeliveryDate.getTime())) {
            minDeliveryDate = new Date(); // o null si prefieres
        }

        // Generar la fecha máxima añadiendo 7 días
        const maxDeliveryDate = new Date(minDeliveryDate);
        maxDeliveryDate.setDate(maxDeliveryDate.getDate() + 7);

        // Guardar ambas fechas en la venta
        await sale.update({
            minDeliveryDate: minDeliveryDate.toISOString().split('T')[0], // YYYY-MM-DD
            maxDeliveryDate: maxDeliveryDate.toISOString().split('T')[0]
        });

        // Guardar fechas de entrega en la venta
        //await sale.update({
        //    minDeliveryDate: result.data.minDeliveryDate,
        //    maxDeliveryDate: result.data.maxDeliveryDate
        //});

        // Enviar email de confirmación sin afectar el flujo
        try {
            await sendEmail(sale.id);
        } catch (emailErr) {
            console.error('Error enviando email de confirmación (auth):', emailErr);
        }

        // Obtener los detalles de la venta
        const saleDetails = await getSaleDetails(sale.id);

        res.status(200).json({
            message: "Muy bien! La orden se generó correctamente",
            sale: sale,
            saleDetails: saleDetails,
            deliveryEstimate: {
                min: sale.minDeliveryDate,
                max: sale.maxDeliveryDate
            }
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: SaleController register OCURRIÓ UN PROBLEMA",
        });
    }
};

// Crear una venta
const createSale = async (saleData) => {
    saleData.userId = saleData.user;
    return await Sale.create(saleData);
};

// Crear una dirección de venta
const createSaleAddress = async (saleAddressData, saleId) => {
    saleAddressData.saleId = saleId;
    return await SaleAddress.create(saleAddressData);
};

// Obtener todos los carritos del usuario
const getUserCarts = async (userId) => {
    return await Cart.findAll({ where: { userId } });
};

// Obtener todos los carritos del usuario
const getUserCartsCache = async (guest_id) => {
    return await CartCache.findAll({ where: { guest_id } });
};

// Preparar los datos de los items para enviar a Printful
const prepareItemsForPrintful = async (carts, sale) => {
    const items = [];
    let subtotal = 0;
    let discount = 0;
    let shipping = 0.00; // Ajusta el costo de envío según tus necesidades
    let tax = 0.00; // Ajusta el impuesto según tus necesidades

    for (const cart of carts) {
        const itemFiles = await getItemFiles(cart); // Solo url de imagen
        const itemOptions = await getItemOptions(cart); // Color, talla, etc.
        const item = await createItem(cart, itemFiles, itemOptions);
        items.push(item);

        // Reducir el stock del producto o variante
        await updateStock(cart);

        // Crear detalles de venta
        await createSaleDetail(cart, sale.id);

        // Eliminar el ítem del carrito
        await removeCartItem(cart);

        // Acumulando subtotal y descuentos
        subtotal += parseFloat(cart.subtotal);
        discount += parseFloat(cart.discount);
    }
    
    return {
        items,
        costs: {
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            shipping: shipping.toFixed(2),
            tax: tax.toFixed(2),
        }
    }
};

// Obtener archivos de un ítem (solo archivos que se van a imprimir, no previews)
const getItemFiles = async (cart) => {
    //console.log(JSON.stringify(cart, null, 2));
    let varietyId = cart.variedadId;
    const files = await File.findAll({ where: { varietyId } });

    if (!files || files.length === 0) {
        throw new Error(`No se encontraron archivos para la variedad ${varietyId}`);
    }

    // Filtrar archivos que no sean tipo "preview"
    const printFiles = files.filter(file => file.type !== "preview");

    return printFiles.map(file => ({
        url: file.preview_url, // si quieres mandar otro campo para Printful, cámbialo aquí
        type: file.type,
        filename: file.filename
    }));
};


// Obtener opciones asociadas a la variante
const getItemOptions = async (cart) => {
    const options = await Option.findAll({ where: { varietyId: cart.variedadId } });
    return options.reduce((itemOptions, option) => {
        let optionValue = parseOptionValue(option.value);
        if (option.idOption === 'stitch_color') {
            itemOptions[option.idOption] = validateStitchColor(optionValue);
        } else if (option.idOption.startsWith('thread_colors')) {
            itemOptions[option.idOption] = validateThreadColors(optionValue);
        } else {
            itemOptions[option.idOption] = Array.isArray(optionValue) ? optionValue[0] : optionValue;
        }
        return itemOptions;
    }, {});
};

const parseOptionValue = (value) => {
    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn(`Warning: Could not parse option value`);
        return value;
    }
};

const validateStitchColor = (color) => {
    const allowedValues = ['white', 'black'];
    return allowedValues.includes(color) ? color : 'white';
};

const validateThreadColors = (colors) => {
    const allowedThreadColors = [
        "#FFFFFF", "#000000", "#96A1A8", "#A67843", "#FFCC00",
        "#E25C27", "#CC3366", "#CC3333", "#660000", "#333366",
        "#005397", "#3399FF", "#6B5294", "#01784E", "#7BA35A"
    ];
    const filteredColors = Array.isArray(colors) ? colors.filter(color => allowedThreadColors.includes(color)) : [colors];
    return filteredColors.length > 0 ? filteredColors : ["#FFFFFF"];
};

// Crear el objeto de ítem
const createItem = async (cart, itemFiles, itemOptions) => {
    const variantId = cart.variedadId ? await getVariantId(cart.variedadId) : null;

    if (variantId && typeof variantId !== 'number') {
        throw new Error(`Expected variant_id to be a number, but got ${typeof variantId}`);
    }

    return {
        variant_id: variantId, // Asegúrate de que variant_id sea un número & Obligatorio: número
        quantity: cart.cantidad,
        name: await getProductTitle(cart.productId),
        price: cart.price_unitario.toString(),
        retail_price: cart.price_unitario.toString(),
        files: itemFiles,
        options: itemOptions,
        sku: null,
    };
};

// Obtener el variant_id de la variedad
const getVariantId = async (variedadId) => {
    const variedad = await Variedad.findByPk(variedadId);
    return variedad ? variedad.variant_id : null; // Asegúrate de que esto sea un número
};

// Obtener el título del producto
const getProductTitle = async (productId) => {
    const product = await Product.findByPk(productId);
    return product ? product.title : '';
};

// Actualizar el stock del producto o variante
const updateStock = async (cart) => {
    if (cart.variedadId) {
        const variedad = await Variedad.findByPk(cart.variedadId);
        const newStock = variedad.stock - cart.cantidad;
        await Variedad.update({ stock: newStock }, { where: { id: cart.variedadId } });
    } else {
        const product = await Product.findByPk(cart.productId);
        const newStock = product.stock - cart.cantidad;
        await Product.update({ stock: newStock }, { where: { id: cart.productId } });
    }
};

// Crear detalles de venta
const createSaleDetail = async (cart, saleId) => {
    const saleDetailData = {
        type_discount: cart.type_discount || 1,
        discount: cart.discount || 0,
        cantidad: cart.cantidad,
        code_cupon: cart.code_cupon || null,
        code_discount: cart.code_discount || null,
        price_unitario: cart.price_unitario,
        subtotal: cart.subtotal,
        total: cart.total,
        saleId: saleId,
        productId: cart.productId,
        variedadId: cart.variedadId || null
    };
    await SaleDetail.create(saleDetailData);
};

// Eliminar ítem del carrito
const removeCartItem = async (cart) => {
    await Cart.destroy({ where: { id: cart.id } });
};

// Crear datos de la orden para Printful
const createPrintfulOrderData = (saleAddress, items, costs) => ({
    recipient: {
        name: saleAddress.name,
        address1: saleAddress.address,
        city: saleAddress.ciudad,
        state_code: 'CA', // Ajustar según tus necesidades
        country_code: 'ES', // Ajustar según tus necesidades
        zip: '91311', // Ajustar según tus necesidades
        phone: saleAddress.telefono,
        email: saleAddress.email,
    },
    items: items,
    retail_costs: {
        subtotal: costs.subtotal,
        discount: costs.discount,
        shipping: costs.shipping,
        tax: costs.tax
    },
});




// 👉 Ajusta la orden para enviar a Printful
// - Siempre limpiar los items con variant_id, quantity, name, retail_price y files.
// - Solo añadir "options" si item.options existe y tiene contenido válido.
// - Esto es automático: camisetas y tazas no tienen options, pero gorras bordadas sí.
// - Usa validateThreadColors() para asegurar que los colores están permitidos por Printful.

const prepareCreatePrintfulOrder = async (orderData, res) => {
    const cleanItems = orderData.items.map(item => {
        const cleanItem = {
            variant_id: item.variant_id,
            quantity: item.quantity,
            name: item.name,
            retail_price: item.retail_price,
            files: item.files.map(f => ({
                url: f.url,
                type: f.type,
                filename: f.filename
            }))
        };

        console.log("----- DEBUG: Procesando item.name ----- :", item.name);
        
        // ✅ Método mejorado para detectar si es un producto bordado
        // 1. Verificar por nombre (método actual)
        let isEmbroideredProduct = item.name.toLowerCase().includes('gorra') || 
            item.name.toLowerCase().includes('bordado') || 
            item.name.toLowerCase().includes('cap');
            
        // 2. Verificar por tipos de archivo (más confiable)
        if (!isEmbroideredProduct && item.files && item.files.length > 0) {
            // Si algún archivo tiene un tipo relacionado con bordado, es un producto bordado
            isEmbroideredProduct = item.files.some(file => 
                file.type.includes('embroidery') || 
                file.type.includes('thread') || 
                file.type.includes('stitch')
            );
        }
        
        // 3. Verificar por rangos de variant_id conocidos para productos bordados (si se conocen)
        // Esto requiere conocimiento específico de los rangos de IDs de Printful
        const embroideryVariantIdRanges = [
            { min: 7800, max: 8000 },  // Ejemplo: gorras bordadas
            { min: 12000, max: 12100 } // Ejemplo: otros productos bordados
            // Añadir más rangos según sea necesario
        ];
        
        if (!isEmbroideredProduct && item.variant_id) {
            isEmbroideredProduct = embroideryVariantIdRanges.some(
                range => item.variant_id >= range.min && item.variant_id <= range.max
            );
        }
        
        console.log("----- DEBUG: ¿Es producto bordado? ----- :", isEmbroideredProduct);
        
        // Solo añadir options para productos que realmente lo necesiten (gorras bordadas)
        if (item.options && Object.keys(item.options).length > 0 && isEmbroideredProduct) {
            // Filtrar solo las opciones relevantes para bordados y con valores válidos
            const validOptions = Object.entries(item.options)
                .filter(([id, value]) => {
                    // Ignorar opciones irrelevantes para camisetas/productos no bordados
                    if (!isEmbroideredProduct && (
                        id.includes('embroidery') || 
                        id.includes('thread_colors') ||
                        id === 'stitch_color' ||
                        id === 'lifelike'
                    )) {
                        return false;
                    }
                    
                    // Verificar si el valor es válido
                    if (value === undefined || value === null || value === '') return false;
                    if (Array.isArray(value) && value.length === 0) return false;
                    return true;
                })
                .map(([id, value]) => {
                    // Si es array de colores, validarlos
                    if (id.includes("thread_colors") && Array.isArray(value)) {
                        return { id, value: validateThreadColors(value) };
                    }
                    return { id, value };
                });
                
            // Solo asignar options si hay opciones válidas
            if (validOptions.length > 0) {
                cleanItem.options = validOptions;
            }
        }

        return cleanItem;
    });

    const cleanOrder = {
        recipient: orderData.recipient,
        items: cleanItems,
        retail_costs: orderData.retail_costs
    };

    // console.log("===== DEBUG: Orden limpia que se enviará a Printful =====");
    // console.log(JSON.stringify(cleanOrder, null, 2));
    // console.log("========================================================");
    // return { error: false, data: cleanOrder };

    let data = await createPrintfulOrder(cleanOrder);

    if (data === "error_order") {
        return { error: true, message: "Ups! Hubo un problema al generar la orden" };
    }

    return { error: false, data };
};







// Crear la orden en Printful (modo debug, no enviar realmente)
/**const prepareCreatePrintfulOrder = async (orderData, res) => {

     // Limpiar cada item antes de enviarlo a Printful
    const cleanItems = orderData.items.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        name: item.name,
        retail_price: item.retail_price, // opcional, pero ok si lo quieres llevar
        files: item.files.map(f => ({
            url: f.url,
            type: f.type,
            filename: f.filename
        }))
    }));

    const cleanOrder = {
        recipient: orderData.recipient,
        items: cleanItems,
        retail_costs: orderData.retail_costs
    };

    //console.log("===== DEBUG: Orden limpia que se enviará a Printful =====");
    //console.log(JSON.stringify(cleanOrder, null, 2)); // Formato legible
    //console.log("=====================================================");
    // 🚨 Mientras pruebas puedes devolver solo el debug
    //return { error: false, data: cleanOrder };

    // ✅ Cuando lo quieras enviar de verdad:
    let data = await createPrintfulOrder(cleanOrder);

    if (data === "error_order") {
        return { error: true, message: "Ups! Hubo un problema al generar la orden" };
    }
    return { error: false, data };
};*/


// Enviar correo electrónico de confirmación
const sendEmail = async (saleId) => {
    // Implementar la función de envío de correo electrónico
    // Ejemplo: await sendEmailFunction(saleId);
    await send_email(saleId);
};

// Obtener detalles de la venta
const getSaleDetails = async (saleId) => {
    let saleDetails = await SaleDetail.findAll({
        where: { saleId },
        include: [
            { model: Product },
            { model: Variedad, include: { model: File } }
        ]
    });

    // Añadir la URL completa de la imagen a cada detalle de venta
    return saleDetails.map(detail => {
        detail = detail.toJSON();
        detail.product.imagen = `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`;
        return detail;
    });
};

// Recuperar venta y detalles por stripeSessionId
export const getSaleBySession = async (req, res) => {
    try {
        const { sessionId } = req.params;
            // Buscar la venta con el stripeSessionId
            const sale = await Sale.findOne({
                where: { stripeSessionId: sessionId },
                include: [
                    { model: SaleDetail },
                    { model: SaleAddress }
            ]
        });
        
    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada para sessionId ' + sessionId });
    }
    return res.json({ sale, saleDetails: sale.SaleDetails || [] });
  } catch (error) {
    console.error('Error en getSaleBySession:', error);
    return res.status(500).json({ message: 'Error recuperando la venta' });
  }
};

// Listar ventas (admin) con filtros y paginación
export const list = async (req, res) => {
    try {
        const { page = 1, limit = 20, q, status, userId, dateFrom, dateTo, sortBy = 'createdAt', order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};

        if (status) {
            where.status = status;
        }

        if (userId) {
            where.userId = userId;
        }

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                // include end of day
                const toDate = new Date(dateTo);
                toDate.setHours(23,59,59,999);
                where.createdAt[Op.lte] = toDate;
            }
        }

        // Search across id and stripeTransaction or associated user email/name
        let include = [
            { model: User },
            { model: Guest },
            { model: SaleDetail, include: [ { model: Product }, { model: Variedad } ] }
        ];

        // Basic text search on id, n_transaction or user email/name/product title
        if (q) {
            const qLike = { [Op.like]: `%${q}%` };

            // First, try to find saleIds that contain products with matching title.
            // We do this with a separate query to avoid fragile $...$ path substitution in WHERE clauses.
            const productMatches = await SaleDetail.findAll({
                attributes: ['saleId'],
                include: [{ model: Product, required: true, where: { title: qLike } }],
                where: {},
                raw: true
            });

            const saleIdsFromProduct = Array.from(new Set(productMatches.map(pm => pm.saleId)));

            // Aquí buscamos por id exacto o número de transacción parcial o email de user/guest
            // Además añadimos la condición por id si algún saleId fue encontrado por título de producto
            const orConditions = [
                { id: parseInt(q) || 0 },
                { n_transaction: qLike },
                { '$User.email$': qLike },
                { '$Guest.email$': qLike }
            ];

            if (saleIdsFromProduct.length > 0) {
                orConditions.push({ id: { [Op.in]: saleIdsFromProduct } });
            }

            where[Op.or] = orConditions;

            // For text search include user/guest so we can filter by their email via the OR conditions
            // Do NOT add a `where` on the include because that would null out the association when the email doesn't match
            include = [
                { model: User, required: false },
                { model: Guest, required: false }
            ];
        }

        const { count, rows } = await Sale.findAndCountAll({
            where,
            include,
            distinct: true, // importante para que el count no duplique por joins
            limit: parseInt(limit),
            offset,
            order: [[sortBy, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']]
        });

        // Map results to a lighter payload for admin list
        const sales = await Promise.all(rows.map(async sale => {
            const s = sale.toJSON ? sale.toJSON() : sale;

            // Get a small preview of products and an image if available
            const details = await SaleDetail.findAll({ where: { saleId: s.id }, include: [ { model: Product }, { model: Variedad, include: { model: File } } ], limit: 5 });
            //console.log(JSON.stringify(details, null, 2));
            
            const items = details.map(d => {
                const det = d.toJSON ? d.toJSON() : d;
                let image = null;
                if (det.product && det.product.portada) {
                    image = `${process.env.URL_BACKEND}/api/products/uploads/product/${det.product.portada}`;
                } else if (det.variedad && det.variedad.Files && det.variedad.Files.length > 0) {
                    image = det.variedad.Files[0].preview_url;
                }
                return {
                    id: det.id,
                    productId: det.productId,
                    title: det.product ? det.product.title : null,
                    cantidad: det.cantidad,
                    price_unitario: det.price_unitario,
                    imagen: image,
                    talla: det.variedade ? det.variedade.valor || det.variedade.name : null
                };
            });

            return {
                id: s.id,
                n_transaction: s.n_transaction,
                method_payment: s.method_payment,
                user: s.user || null,
                guest: s.guest || null,
                total: s.total,
                status: s.status,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                items
            };
        }));

        return res.json({
            success: true,
            total: count,
            page: parseInt(page),
            pages: Math.ceil(count / parseInt(limit)),
            sales
        });
    } catch (error) {
        console.error('Error in sale.list:', error);
        return res.status(500).json({ success: false, message: 'Error retrieving sales' });
    }
};


export const show = async (req, res) => {
  try {
        const { id } = req.params;

        const sale = await Sale.findOne({
            where: { id },
            include: [
                { model: User },
                { model: Guest },
            ]
        });

        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        // Obtener detalles de la venta con sus relaciones
        const details = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [
                { model: Product },
                { model: Variedad, include: { model: File } },
                { model: Sale },
            ],
        });

        // Mapear items para enviar imagen y demás info al front
        const items = details.map(d => {
            let image = null;
            if (d.product && d.product.portada) {
                image = `${process.env.URL_BACKEND}/api/products/uploads/product/${d.product.portada}`;
            } else if (d.variedad && d.variedad.Files && d.variedad.Files.length > 0) {
                image = d.variedad.Files[0].preview_url;
            }
            // normalize variedad naming and extract talla (valor)
            const variedadObj = d.variedad || d.variedade || null;
            const tallaVal = variedadObj ? (variedadObj.valor || variedadObj.name || variedadObj.valor_ ? variedadObj.valor_ : null) : null;

            return {
                _id: d.id,
                product: {
                    ...d.product?.toJSON(),
                    imagen: image,
                },
                cantidad: d.cantidad,
                price_unitario: d.price_unitario,
                subtotal: d.subtotal,
                total: d.total,
                variedad: variedadObj,
                talla: tallaVal,
                type_discount: d.type_discount,
                discount: d.discount,
                code_cupon: d.code_cupon,
                code_discount: d.code_discount,
            };
        });

        return res.json({
            success: true,
            sale: {
                ...sale.toJSON(),
                items,
            },
        });
    } catch (error) {
        console.error('Error fetching sale:', error);
        return res.status(500).json({ success: false, message: 'Error fetching sale' });
    }
};
