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
import http from 'http';
import https from 'https';
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
        console.log('[Sale Controller] Iniciando registro de venta...');
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
        console.log('[Sale Controller] register - fetched carts count for userId=', sale.userId, Array.isArray(carts) ? carts.length : 0);
        if (Array.isArray(carts) && carts.length > 0) {
            console.log('[Sale Controller] register - cart ids:', carts.map(c=>c.id));
        }

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

        // ✅ Guardar el estado inicial de Printful
        console.log('[Printful] Resultado recibido:', result);

        try {
            // Log the complete response structure for future debugging
            console.log('[Printful] Estructura de respuesta completa:', JSON.stringify(result, null, 2));

            if (result && result.data) {
                // Expected response shape:
                // {
                //   error: false,
                //   data: {
                //     orderId: 132374667,
                //     raw: { status: 'draft', ... }
                //   }
                // }
                const printfulResponse = result;

                const printfulOrderId = printfulResponse.data.orderId ?? null;
                const printfulStatus = (printfulResponse.data.raw && printfulResponse.data.raw.status) ? printfulResponse.data.raw.status : 'unknown';
                const printfulUpdatedAt = new Date();

                console.log('[Printful] Datos de orden recibidos:', { orderId: printfulOrderId, status: printfulStatus });

                await sale.update({
                    printfulOrderId,
                    printfulStatus,
                    printfulUpdatedAt
                });

                console.log('[Printful] Estado inicial guardado en BD:', {
                    printfulOrderId,
                    printfulStatus,
                });
            } else {
                console.warn('[Printful] No se recibió data válida de la orden.');
            }
        } catch (pfSaveErr) {
            console.error('[Printful] Error guardando estado en BD:', pfSaveErr && (pfSaveErr.message || pfSaveErr));
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

        console.log('[Sale Controller] Registro completado con éxito. Sale ID:', sale.id);

        res.status(200).json({
            message: "Muy bien! La orden se generó correctamente",
            sale: sale,
            saleDetails: saleDetails,
            deliveryEstimate: {
                min: sale.minDeliveryDate,
                max: sale.maxDeliveryDate
            },
            printful: {
                id: sale.printfulOrderId,
                status: sale.printfulStatus
            }
        });
    } catch (error) {
        console.log("------> DEBBUG : Error en register:", error.message);
        console.error("Stack:", error.stack);
        
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
        console.log('[prepareItemsForPrintful] processing cart id=', cart.id, 'productId=', cart.productId, 'variedadId=', cart.variedadId, 'cantidad=', cart.cantidad);
        const itemFiles = await getItemFiles(cart); // Solo url de imagen
        const itemOptions = await getItemOptions(cart); // Color, talla, etc.
        const item = await createItem(cart, itemFiles, itemOptions);
        items.push(item);

        // Reducir el stock del producto o variante
        await updateStock(cart);

        // Crear detalles de venta
        try {
            const createdDetail = await createSaleDetail(cart, sale.id);
            console.log('[prepareItemsForPrintful] createSaleDetail succeeded for cart id=', cart.id, 'detailId=', createdDetail && createdDetail.id);
        } catch (detailErr) {
            console.error('[prepareItemsForPrintful] createSaleDetail FAILED for cart id=', cart.id, detailErr && (detailErr.stack || detailErr.message || detailErr));
            throw detailErr; // bubble up so register fails visibly
        }

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

// Normaliza tipos de archivo entrantes a los tipos usados para Printful
const mapPrintfulFileType = (type) => {
    if (!type) return 'default';
    const t = String(type).toLowerCase();
    // Tipos relacionados con bordado
    if (t.includes('embroidery') || t.includes('thread') || t.includes('stitch')) return 'embroidery';
    // Previews o thumbnails
    if (t.includes('preview')) return 'preview';
    // Imágenes/prints estándar
    if (t.includes('print') || t.includes('image') || t.includes('default')) return 'default';
    // Fallback: devolver 'default' para evitar filtrados accidentales
    return 'default';
};

// Verifica si una URL es alcanzable (HEAD request) con timeout en ms
const isUrlReachable = (url, timeout = 5000) => {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string') return resolve(false);
        try {
            const parsed = new URL(url);
            const lib = parsed.protocol === 'https:' ? https : http;
            const options = {
                method: 'HEAD',
                host: parsed.hostname,
                path: parsed.pathname + (parsed.search || ''),
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                timeout
            };
            const req = lib.request(options, (res) => {
                const ok = res.statusCode >= 200 && res.statusCode < 400;
                res.resume();
                resolve(ok);
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.on('error', () => resolve(false));
            req.end();
        } catch (e) {
            return resolve(false);
        }
    });
};

// Validate that a URL is public and uses https (Printful requires publicly-accessible HTTPS URLs)
const isPublicHttpsUrl = (url) => {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        const host = u.hostname;
        // reject localhost, loopback and common private ranges
        if (host === 'localhost' || host === '127.0.0.1') return false;
        // simple private network detection
        if (/^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return false;
        if (host.endsWith('.local')) return false;
        return true;
    } catch (e) {
        return false;
    }
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
    // Ensure numeric/default fields to avoid DB constraint errors
    const price_unitario = cart.price_unitario != null ? Number(cart.price_unitario) : Number(cart.price || 0);
    const cantidad = cart.cantidad != null ? Number(cart.cantidad) : 1;
    const subtotalVal = cart.subtotal != null ? Number(cart.subtotal) : parseFloat((price_unitario * cantidad).toFixed(2));
    const totalVal = cart.total != null ? Number(cart.total) : subtotalVal;

    const saleDetailData = {
        type_discount: cart.type_discount || 1,
        discount: cart.discount || 0,
        cantidad: cantidad,
        code_cupon: cart.code_cupon || null,
        code_discount: cart.code_discount || null,
        price_unitario: price_unitario,
        subtotal: subtotalVal,
        total: totalVal,
        saleId: saleId,
        productId: cart.productId || null,
        variedadId: cart.variedadId || null
    };

    // Log the payload used to create the SaleDetail
    console.log('[createSaleDetail] creating sale detail', saleDetailData);

    const created = await SaleDetail.create(saleDetailData);
    return created;
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
            name: item.name || '',
            retail_price: item.retail_price,
            files: Array.isArray(item.files) ? item.files.map(f => ({ url: f.url, type: f.type, filename: f.filename })) : []
        };

        console.log("----- DEBUG: Procesando item.name ----- :", item.name);
        
        // ✅ Método mejorado para detectar si es un producto bordado
        // 1. Verificar por nombre (método actual)
        const itemNameLower = (item.name || '').toString().toLowerCase();
        let isEmbroideredProduct = itemNameLower.includes('gorra') || 
            itemNameLower.includes('bordado') || 
            itemNameLower.includes('cap');
            
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
        // Buscar la venta con el stripeSessionId e incluir direcciones y relaciones de user/guest
        console.log('[Sale Controller] getSaleBySession - buscando venta para stripeSessionId=', sessionId);
        const sale = await Sale.findOne({
            where: { stripeSessionId: sessionId },
            include: [
                { model: SaleAddress },
                { model: User },
                { model: Guest }
            ]
        });

        if (!sale) {
            console.log('[Sale Controller] getSaleBySession - no se encontró venta para stripeSessionId=', sessionId);
            return res.status(404).json({ message: 'Venta no encontrada para sessionId ' + sessionId });
        }

        // Obtener detalles con helper para mantener la forma esperada (product imagen, variedad, etc.)
        const saleDetails = await getSaleDetails(sale.id);
        console.log('[Sale Controller] getSaleBySession - saleId=', sale.id, 'saleDetails.count=', Array.isArray(saleDetails) ? saleDetails.length : 0);

        // Si aún no hay detalles, devolver vacío (el frontend tiene retry) pero logear para depuración
        if (!saleDetails || saleDetails.length === 0) {
            console.warn('[Sale Controller] getSaleBySession - venta sin detalles aún. stripeSessionId=', sessionId, 'saleId=', sale.id);
        }

        return res.json({ sale, saleDetails });
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
                include: [{ model: Product, required: true, where: { [Op.or]: [ { title: qLike }, { sku: qLike } ] } }],
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
                    sku: det.product ? det.product.sku : null,
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
                // Include Printful metadata so frontend can display printful status/order and delivery estimates
                printfulOrderId: s.printfulOrderId ?? null,
                printfulStatus: s.printfulStatus ?? s.status ?? null,
                minDeliveryDate: s.minDeliveryDate ?? null,
                maxDeliveryDate: s.maxDeliveryDate ?? null,
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

        console.log('[DEBUG Admin] Fetching sale id=', id);

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
        const items = await Promise.all(details.map(async d => {
            let image = null;
            if (d.product && d.product.portada) {
                image = `${process.env.URL_BACKEND}/api/products/uploads/product/${d.product.portada}`;
            } else if (d.variedad && d.variedad.Files && d.variedad.Files.length > 0) {
                image = d.variedad.Files[0].preview_url;
            }

            // normalize variedad naming and extract talla (valor)
            const variedadObj = d.variedad || d.variedade || null;
            const tallaVal = variedadObj ? (variedadObj.valor || variedadObj.name || variedadObj.valor_ ? variedadObj.valor_ : null) : null;

            // También adjuntar la lista completa de variedades del producto para el admin (útil al rectificar)
            let variedadesProducto = [];
            try {
                const pid = d.product && d.product.id ? d.product.id : (d.productId || null);
                if (pid) {
                    variedadesProducto = await Variedad.findAll({ where: { productId: pid } });
                }
            } catch (e) {
                console.warn('[DEBUG Admin] Error cargando variedades del producto para sale.detail:', e && e.message);
                variedadesProducto = [];
            }

            console.log('[DEBUG Admin] Variedades cargadas para productId=', d.product && d.product.id, 'count=', variedadesProducto.length);

            return {
                _id: d.id,
                product: {
                    ...d.product?.toJSON(),
                    imagen: image,
                    variedades: variedadesProducto
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
        }));

        console.log('[DEBUG Admin] Items mapped for sale:', items.length);

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

// Obtener la dirección asociada a una venta (para prefilling en admin)
export const address = async (req, res) => {
    try {
        const { id } = req.params;
        const addr = await SaleAddress.findOne({ where: { saleId: id } });
        if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
        return res.json({ success: true, address: addr });
    } catch (error) {
        console.error('Error fetching sale address:', error);
        return res.status(500).json({ success: false, message: 'Error fetching sale address' });
    }
};



// Crear una venta manual desde admin (envía a Printful primero, persiste solo si Printful acepta)
export const createAdminSale = async (req, res) => {
    try {
        // Expect payload: { sale: {...}, sale_address: {...}, items: [...], costs: {...} }
        const { sale: saleData = {}, sale_address: saleAddressData = {}, items = [], costs = {} } = req.body;
        console.log('🟡 createAdminSale payload items:', items && items.length);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided' });
        }

        // Basic normalization: ensure variant_id numbers and files types
        // Ensure each incoming item has a Printful variant_id.
        // The frontend may send `variedadId` (our internal id). Map it to Printful's variant_id via getVariantId().
    const cleanedItems = [];
        for (const it of items) {
            let variant_id = it.variant_id ? Number(String(it.variant_id).replace(/[^0-9]/g, '')) : null;
            // If variant_id not provided, try to resolve from variedadId
            if ((!variant_id || isNaN(variant_id)) && (it.variedadId || it.variedad || it.varietyId)) {
                try {
                    const variedadId = it.variedadId || (it.variedad && it.variedad.id) || it.varietyId;
                    if (variedadId) {
                        const resolved = await getVariantId(variedadId);
                        if (resolved) variant_id = Number(resolved);
                    }
                } catch (e) {
                    console.error('[DEBUG] Error resolving variant_id for variedadId', it.variedadId, e && e.message);
                }
            }

            const files = Array.isArray(it.files) ? it.files.map(f => ({ url: f.url || f.file_url || f.preview_url || '', type: mapPrintfulFileType(f.type), filename: f.filename || '' })).filter(f => f.url && f.type) : [];
            let name = it.name || it.title || null;
            if (!name && (it.productId || it.product_id)) {
                try {
                    const p = await Product.findByPk(it.productId || it.product_id);
                    if (p) name = p.title;
                } catch (e) { /* ignore */ }
            }
            cleanedItems.push({ ...it, variant_id, files, name });
        }

        // Validate cleanedItems not empty after normalization
        if (!Array.isArray(cleanedItems) || cleanedItems.length === 0) {
            console.error('createAdminSale: No valid items after normalization. Incoming payload items may be invalid.');
            return res.status(400).json({ success: false, message: 'No valid items after normalization. Check payload items format.' });
        }

        // Server-side fallback: for any cleaned item without files, try to fetch a public thumbnail_url from the Variedad's Files
        for (let ciIndex = 0; ciIndex < cleanedItems.length; ciIndex++) {
            const ci = cleanedItems[ciIndex];
            // Trigger fallback if no files provided by admin OR first file is not a public HTTPS URL
            const hasPublicFileFromAdmin = Array.isArray(ci.files) && ci.files.length > 0 && isPublicHttpsUrl(ci.files[0].url);
            if (!hasPublicFileFromAdmin) {
                if (Array.isArray(ci.files) && ci.files.length > 0) {
                    console.debug('createAdminSale: admin provided files but first is not public HTTPS, attempting DB fallback', { index: ciIndex, adminFile: ci.files[0] });
                }
                    // Determine variedadId from common locations
                    const variedadId = ci.variedadId || ci.varietyId || (ci.variedad && ci.variedad.id) || null;
                    if (variedadId) {
                        try {
                        const filesFromDb = await File.findAll({ where: { varietyId: variedadId } });
                        if (!filesFromDb || filesFromDb.length === 0) {
                            console.debug('createAdminSale: no files rows in DB for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public files available for variety ${variedadId}` });
                        }

                        const printFiles = filesFromDb.filter(f => (f.type || '').toString().toLowerCase() !== 'preview');
                        if (!printFiles || printFiles.length === 0) {
                            console.debug('createAdminSale: no printable files (non-preview) for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public files available for variety ${variedadId}` });
                        }

                        const publicFiles = printFiles
                            .map(f => ({ url: f.thumbnail_url || f.preview_url || f.url || null, file_url: f.thumbnail_url || f.preview_url || f.url || null, type: 'default', filename: f.filename || '' }))
                            .filter(f => f.url && isPublicHttpsUrl(f.url));

                        if (!publicFiles || publicFiles.length === 0) {
                            console.debug('createAdminSale: printable files exist but no public HTTPS URL for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public HTTPS files available for variety ${variedadId}` });
                        }

                        ci.files = publicFiles;
                        console.debug('createAdminSale: fallback populated ci.files from DB for variedad', variedadId, 'filesCount=', ci.files.length);
                        } catch (e) {
                            console.warn('createAdminSale: error fetching Files for variedad', variedadId, e && e.message);
                        }
                    }
                // If still no files, downstream validation will return 400 for non-embroidered products
            }
        }

        // After attempting fallback, ensure non-embroidered items have files (clear error if not)
        for (let ciIndex = 0; ciIndex < cleanedItems.length; ciIndex++) {
            const ci = cleanedItems[ciIndex];
            const nameLower = (ci.name || ci.title || '').toString().toLowerCase();
            const isEmbroidered = nameLower.includes('gorra') || nameLower.includes('bordado') || nameLower.includes('cap');
            if (!isEmbroidered && (!ci.files || ci.files.length === 0)) {
                const variedadId = ci.variedadId || ci.varietyId || (ci.variedad && ci.variedad.id) || null;
                console.error('createAdminSale: No public thumbnail_url available for Printful for item', { index: ciIndex, productId: ci.productId, variedadId });
                return res.status(400).json({ success: false, message: `No public thumbnail_url available for Printful for item index ${ciIndex} (productId=${ci.productId}, variedadId=${variedadId})` });
            }
        }

        // Build minimal payload expected by Printful and validate
        const itemsForPrintful = cleanedItems.map(ci => ({ variant_id: ci.variant_id != null ? Number(ci.variant_id) : null, quantity: ci.quantity || ci.cantidad || 1 }));
        console.log('Payload a Printful:', itemsForPrintful);
        // If any variant_id is missing, abort and do not call Printful
        const missing = itemsForPrintful.filter(i => i.variant_id == null || i.variant_id === 0);
        if (missing.length > 0) {
            console.error('Error: Missing variant_id for some items, aborting Printful call', missing);
            return res.status(400).json({ success: false, message: 'Missing variant_id for one or more items. Cannot send to Printful.' });
        }

        // Validate items before creating DB records by sending to Printful (prepareCreatePrintfulOrder)
        // Sanitize and log minimal payload for debugging (no sensitive fields)
        const sanitizedPayload = {
            items: cleanedItems.map((ci) => ({
                productId: ci.productId || ci.product_id || null,
                variedadId: ci.variedadId || ci.varietyId || null,
                variant_id: ci.variant_id || null,
                quantity: ci.quantity || ci.cantidad || 1,
                retail_price: ci.retail_price || ci.price || null,
                files: Array.isArray(ci.files) ? ci.files.map(f => ({ url: f.url, type: f.type })) : []
            })),
            costs: costs || {}
        };
        console.log('🔵 createAdminSale - sanitized payload:', JSON.stringify(sanitizedPayload, null, 2));

        // Debug: show final files for each cleaned item (sanitized)
        cleanedItems.forEach((ci, idx) => {
            console.debug('createAdminSale: final files for item', idx, Array.isArray(ci.files) ? ci.files.map(f => ({ url: f.url, type: f.type })) : []);
        });

        // Optional: check reachability of each file URL before sending to Printful
        for (let idx = 0; idx < sanitizedPayload.items.length; idx++) {
            const it = sanitizedPayload.items[idx];
            if (it.files && it.files.length > 0) {
                for (let fidx = 0; fidx < it.files.length; fidx++) {
                    const fu = it.files[fidx];
                    // Ensure URL is public https (Printful requirement)
                    if (!isPublicHttpsUrl(fu.url)) {
                        console.error(`createAdminSale: File URL not acceptable for Printful: ${fu.url}`);
                        return res.status(400).json({ success: false, message: `File URL not acceptable for Printful (must be public HTTPS): ${fu.url}` });
                    }
                    // Optionally skip HEAD check in development
                    if (process.env.SKIP_FILE_CHECK === 'true') {
                        console.log(`🔎 createAdminSale: skipping reachability check for ${fu.url} due to SKIP_FILE_CHECK=true`);
                    } else {
                        const reachable = await isUrlReachable(fu.url).catch(() => false);
                        console.log(`🔎 createAdminSale: item ${idx} file[${fidx}] reachable=${reachable} url=${fu.url} type=${fu.type}`);
                        if (!reachable) {
                            return res.status(400).json({ success: false, message: `File URL not reachable: ${fu.url}` });
                        }
                    }
                }
            }
        }

        // After attempting fallback, ensure non-embroidered items have files (clear error if not)
        for (let ciIndex = 0; ciIndex < cleanedItems.length; ciIndex++) {
            const ci = cleanedItems[ciIndex];
            const nameLower = (ci.name || ci.title || '').toString().toLowerCase();
            const isEmbroidered = nameLower.includes('gorra') || nameLower.includes('bordado') || nameLower.includes('cap');
            if (!isEmbroidered && (!ci.files || ci.files.length === 0)) {
                const variedadId = ci.variedadId || ci.varietyId || (ci.variedad && ci.variedad.id) || null;
                console.error('adminCorrectSale: No public thumbnail_url available for Printful for item', { index: ciIndex, productId: ci.productId, variedadId });
                return res.status(400).json({ success: false, message: `No public thumbnail_url available for Printful for item index ${ciIndex} (productId=${ci.productId}, variedadId=${variedadId})` });
            }
        }

        const pfOrderData = createPrintfulOrderData(saleAddressData || {}, cleanedItems, costs || {});
        console.log('🔵 Preparing Printful order for admin creation');
        const pfResult = await prepareCreatePrintfulOrder(pfOrderData);
        if (pfResult.error) {
            console.error('DEBUG createAdminSale: Printful rejected order', pfResult.message || pfResult);
            return res.status(400).json({ success: false, message: 'Printful validation failed', details: pfResult.message || null });
        }

        // Persist sale and related records
        const salePayload = {
            method_payment: saleData.method_payment || 'MANUAL',
            n_transaction: saleData.n_transaction || `ADMIN-${Date.now()}`,
            total: saleData.total || 0,
            currency_payment: saleData.currency_payment || 'EUR',
            userId: saleData.userId || saleData.user || null,
        };

        const newSale = await createSale(salePayload);
        if (saleAddressData && Object.keys(saleAddressData).length > 0) {
            const addr = { ...saleAddressData };
            addr.saleId = newSale.id;
            await createSaleAddress(addr, newSale.id);
        }

        // Create sale details for each item
        for (const it of items) {
            const det = {
                type_discount: it.type_discount || 1,
                discount: it.discount || 0,
                cantidad: it.quantity || it.cantidad || 1,
                code_cupon: it.code_cupon || null,
                code_discount: it.code_discount || null,
                price_unitario: it.retail_price || it.price || it.price_unitario || 0,
                subtotal: (parseFloat(it.retail_price || it.price || 0) * (it.quantity || it.cantidad || 1)).toFixed(2),
                total: (parseFloat(it.retail_price || it.price || 0) * (it.quantity || it.cantidad || 1)).toFixed(2),
                saleId: newSale.id,
                productId: it.productId || it.product_id || null,
                variedadId: it.variedadId || it.varietyId || null
            };
            await createSaleDetail(det, newSale.id);
        }

        // Log full Printful response and save Printful metadata (orderId, status)
        try {
            console.log('[Printful] Estructura de respuesta completa:', JSON.stringify(pfResult, null, 2));

            if (pfResult && pfResult.data) {
                const pfResp = pfResult;
                // Support multiple possible response shapes
                const printfulOrderId = pfResp.data.orderId ?? (pfResp.data.result && pfResp.data.result.id) ?? null;
                const printfulStatus = pfResp.data.raw?.status || (pfResp.data.result && pfResp.data.result.status) || 'unknown';
                const printfulUpdatedAt = new Date();

                console.log('[Printful] Datos de orden recibidos:', { orderId: printfulOrderId, status: printfulStatus });

                await newSale.update({
                    printfulOrderId,
                    printfulStatus,
                    printfulUpdatedAt
                });

                console.log('[Printful] Estado inicial guardado en BD:', {
                    printfulOrderId,
                    printfulStatus
                });

                // delivery dates may be in pfResp.data or pfResp.data.result
                const pfData = pfResp.data.result || pfResp.data || {};
                if (pfData.minDeliveryDate) {
                    const minD = new Date(pfData.minDeliveryDate);
                    const maxD = new Date(minD);
                    maxD.setDate(maxD.getDate() + 7);
                    await newSale.update({ minDeliveryDate: minD.toISOString().split('T')[0], maxDeliveryDate: maxD.toISOString().split('T')[0] });
                }
            } else {
                console.warn('[Printful] No se recibió data válida de la orden para admin create.');
            }
        } catch (pfSaveErr) {
            console.error('[Printful] Error guardando estado en BD (admin create):', pfSaveErr && (pfSaveErr.message || pfSaveErr));
        }

        try { await sendEmail(newSale.id); } catch (e) { console.error('Error sending admin creation email', e); }

        return res.json({ success: true, message: 'Admin sale created and sent to Printful', sale: newSale, pf: pfResult.data });
    } catch (error) {
        console.error('❌ Error in createAdminSale:', error);
        if (error && error.stack) console.error(error.stack);
        return res.status(500).json({ success: false, message: 'Error creating admin sale' });
    }
};

// Crear una corrección de pedido para un pedido existente (admin) — similar to replacement but more generic
export const adminCorrectSale = async (req, res) => {
    try {
        const { id } = req.params; // original sale id
        const { items = [], sale_address: saleAddressData = {}, costs = {} } = req.body;
        console.log('🟡 adminCorrectSale for original id:', id, 'items:', items && items.length);

        const original = await Sale.findByPk(id, { include: [{ model: SaleDetail, include: [{ model: Product }, { model: Variedad, include: { model: File } }] }, { model: SaleAddress }, { model: User }, { model: Guest }] });
        if (!original) return res.status(404).json({ success: false, message: 'Original sale not found' });

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided for correction' });
        }

        // Normalize items (populate product name if missing) and ensure variant_id via variedadId mapping
        const cleanedItems = [];
        for (const it of items) {
            let variant_id = it.variant_id ? Number(String(it.variant_id).replace(/[^0-9]/g, '')) : null;
            if ((!variant_id || isNaN(variant_id)) && (it.variedadId || it.variedad || it.varietyId)) {
                try {
                    const variedadId = it.variedadId || (it.variedad && it.variedad.id) || it.varietyId;
                    if (variedadId) {
                        const resolved = await getVariantId(variedadId);
                        if (resolved) variant_id = Number(resolved);
                    }
                } catch (e) {
                    console.error('[DEBUG] Error resolving variant_id for variedadId', it.variedadId, e && e.message);
                }
            }

            const files = Array.isArray(it.files) ? it.files.map(f => ({ url: f.url, type: mapPrintfulFileType(f.type), filename: f.filename })).filter(f => f.url && f.type) : [];
            let name = it.name || it.title || null;
            if (!name && (it.productId || it.product_id)) {
                try {
                    const p = await Product.findByPk(it.productId || it.product_id);
                    if (p) name = p.title;
                } catch (e) { /* ignore */ }
            }
            cleanedItems.push({ ...it, variant_id, files, name });
        }

        // Validate cleanedItems not empty after normalization
        if (!Array.isArray(cleanedItems) || cleanedItems.length === 0) {
            console.error('adminCorrectSale: No valid items after normalization. Incoming payload items may be invalid.');
            return res.status(400).json({ success: false, message: 'No valid items after normalization. Check payload items format.' });
        }

        // Server-side fallback: only when admin did not provide files, fetch printable files from DB (same as ecommerce)
        for (let ciIndex = 0; ciIndex < cleanedItems.length; ciIndex++) {
            const ci = cleanedItems[ciIndex];
            // fallback trigger: admin didn't send files OR admin file isn't public HTTPS
            const hasPublicFileFromAdmin = Array.isArray(ci.files) && ci.files.length > 0 && isPublicHttpsUrl(ci.files[0].url);
            if (!hasPublicFileFromAdmin) {
                if (Array.isArray(ci.files) && ci.files.length > 0) {
                    console.debug('adminCorrectSale: admin provided files but first is not public HTTPS, attempting DB fallback', { index: ciIndex, adminFile: ci.files[0] });
                }
                const variedadId = ci.variedadId || ci.varietyId || (ci.variedad && ci.variedad.id) || null;
                if (variedadId) {
                    try {
                        const filesFromDb = await File.findAll({ where: { varietyId: variedadId } });
                        if (!filesFromDb || filesFromDb.length === 0) {
                            console.debug('adminCorrectSale: no files rows in DB for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public files available for variety ${variedadId}` });
                        }

                        // Filter out preview files
                        const printFiles = filesFromDb.filter(f => (f.type || '').toString().toLowerCase() !== 'preview');
                        if (!printFiles || printFiles.length === 0) {
                            console.debug('adminCorrectSale: no printable files (non-preview) for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public files available for variety ${variedadId}` });
                        }

                        // Keep only public HTTPS URLs
                        const publicFiles = printFiles
                            .map(f => ({
                                url: f.thumbnail_url || f.preview_url || f.url || null,
                                file_url: f.thumbnail_url || f.preview_url || f.url || null,
                                type: 'default',
                                filename: f.filename || ''
                            }))
                            .filter(f => f.url && isPublicHttpsUrl(f.url));

                        if (!publicFiles || publicFiles.length === 0) {
                            console.debug('adminCorrectSale: printable files exist but no public HTTPS URL for variedad', variedadId);
                            return res.status(400).json({ success: false, message: `No public HTTPS files available for variety ${variedadId}` });
                        }

                        ci.files = publicFiles;
                        console.debug('adminCorrectSale: fallback populated ci.files from DB for variedad', variedadId, 'filesCount=', ci.files.length);
                    } catch (e) {
                        console.warn('adminCorrectSale: error fetching Files for variedad', variedadId, e && e.message);
                        return res.status(500).json({ success: false, message: 'Error fetching files for variety', details: e && e.message });
                    }
                } else {
                    console.debug('adminCorrectSale: variedadId not provided for item index', ciIndex);
                }
            }
            // debug final files for this item (sanitized)
            console.debug('adminCorrectSale: final files for item', { index: ciIndex, files: Array.isArray(ci.files) ? ci.files.map(f => ({ url: f.url, type: f.type })) : [] });
        }

        // Normalize files for each cleaned item: keep only one file per placement/type (first encountered)
        for (let ni = 0; ni < cleanedItems.length; ni++) {
            const ci = cleanedItems[ni];
            if (Array.isArray(ci.files) && ci.files.length > 0) {
                const acc = {};
                for (const f of ci.files) {
                    const placement = (f.type || 'default').toString();
                    if (!acc[placement]) {
                        acc[placement] = {
                            url: f.url || f.file_url || f.preview_url || '',
                            type: placement,
                            filename: f.filename || ''
                        };
                    }
                }
                ci.files = Object.values(acc);
                console.debug('adminCorrectSale: normalized files for item', { index: ni, files: ci.files.map(ff => ({ url: ff.url, type: ff.type })) });
            }
        }

        // Build minimal payload expected by Printful and validate, copying files from the original sale
        const originalItems = original && (original.SaleDetails || original.sale_details || original.saleDetails || []);

        const itemsForPrintful = cleanedItems.map(ci => {
            // try to find the corresponding original sale item to copy files
            const originalItem = originalItems ? originalItems.find(oi => {
                const o = oi.toJSON ? oi.toJSON() : oi;
                return (o.id && ci.id && o.id === ci.id) || (o.productId && ci.productId && o.productId === ci.productId) || (o.variedadId && ci.variedadId && o.variedadId === ci.variedadId) || (o.varietyId && ci.variedadId && o.varietyId === ci.variedadId);
            }) : null;

            // Prefer files sent by admin (ci.files). If none, fall back to original sale item's stored files.
            let files = Array.isArray(ci.files) && ci.files.length > 0 ? ci.files.map(f => ({ url: f.url || f.file_url || f.preview_url || '', type: f.type || '', filename: f.filename || '' })) : [];
            try {
                if ((!files || files.length === 0) && originalItem) {
                    const oi = originalItem ? (originalItem.toJSON ? originalItem.toJSON() : originalItem) : null;
                    // Prefer files stored in the Variedad relation (Variedad.Files)
                    const variedadObj = oi && (oi.Variedad || oi.variedad || oi.variedade);
                    if (variedadObj && variedadObj.Files && Array.isArray(variedadObj.Files) && variedadObj.Files.length > 0) {
                        files = variedadObj.Files.map(f => ({ url: f.preview_url || f.url || f.path || '', type: f.type || '', filename: f.filename || '' }));
                    } else if (oi && oi.files && Array.isArray(oi.files) && oi.files.length > 0) {
                        files = oi.files.map(f => ({ url: f.preview_url || f.url || '', type: f.type || '', filename: f.filename || '' }));
                    }
                }
            } catch (e) {
                console.warn('[DEBUG] Error extracting files from original item', e && e.message);
                files = files || [];
            }

            return {
                // ensure numeric variant_id
                variant_id: Number(ci.variant_id),
                quantity: ci.quantity || ci.cantidad || 1,
                name: ci.name || ci.title || '',
                retail_price: ci.retail_price || ci.price || null,
                files
            };
        });

        // Validate that non-embroidered items have files
        for (let idx = 0; idx < itemsForPrintful.length; idx++) {
            const item = itemsForPrintful[idx];
            const nameLower = (item.name || '').toString().toLowerCase();
            let isEmbroideredProduct = nameLower.includes('gorra') || nameLower.includes('bordado') || nameLower.includes('cap');
            if (!isEmbroideredProduct && item.files && item.files.length > 0) {
                // check file types
                isEmbroideredProduct = item.files.some(f => (f.type || '').toString().toLowerCase().includes('embroidery') || (f.type || '').toString().toLowerCase().includes('thread') || (f.type || '').toString().toLowerCase().includes('stitch'));
            }

            if (!isEmbroideredProduct && (!item.files || item.files.length === 0)) {
                console.error('Item requires files for Printful', { idx, item });
                return res.status(400).json({ success: false, message: `Item ${idx} requiere archivos para Printful` });
            }
        }

        console.log('Payload a Printful con archivos copiados:', JSON.stringify(itemsForPrintful, null, 2));

        // Sanitize and log minimal payload for debugging
        const sanitizedPayload = {
            originalSaleId: original.id,
            items: itemsForPrintful.map((ci) => ({
                variant_id: ci.variant_id || null,
                quantity: ci.quantity || 1,
                name: ci.name || '',
                retail_price: ci.retail_price || null,
                files: Array.isArray(ci.files) ? ci.files.map(f => ({ url: f.url, type: f.type })) : []
            })),
            costs: costs || {}
        };
        console.log('🔵 adminCorrectSale - sanitized payload:', JSON.stringify(sanitizedPayload, null, 2));

        // Validate file URLs reachable for items that include files
        for (let idx = 0; idx < sanitizedPayload.items.length; idx++) {
            const it = sanitizedPayload.items[idx];
            if (it.files && it.files.length > 0) {
                for (let fidx = 0; fidx < it.files.length; fidx++) {
                    const fu = it.files[fidx];
                    // Ensure URL is public https (Printful requirement)
                    if (!isPublicHttpsUrl(fu.url)) {
                        console.error(`adminCorrectSale: File URL not acceptable for Printful: ${fu.url}`);
                        return res.status(400).json({ success: false, message: `File URL not acceptable for Printful (must be public HTTPS): ${fu.url}` });
                    }
                    // Optionally skip HEAD check in development
                    if (process.env.SKIP_FILE_CHECK === 'true') {
                        console.log(`🔎 adminCorrectSale: skipping reachability check for ${fu.url} due to SKIP_FILE_CHECK=true`);
                    } else {
                        const reachable = await isUrlReachable(fu.url).catch(() => false);
                        console.log(`🔎 adminCorrectSale: item ${idx} file[${fidx}] reachable=${reachable} url=${fu.url} type=${fu.type}`);
                        if (!reachable) {
                            return res.status(400).json({ success: false, message: `File URL not reachable: ${fu.url}` });
                        }
                    }
                }
            }
        }

        // Use itemsForPrintful when preparing the Printful order so files are included
        const pfOrderData = createPrintfulOrderData(saleAddressData || (original.sale_addresses && original.sale_addresses[0] ? (original.sale_addresses[0].toJSON ? original.sale_addresses[0].toJSON() : original.sale_addresses[0]) : {}), itemsForPrintful, costs || {});
        const pfResult = await prepareCreatePrintfulOrder(pfOrderData);
        if (pfResult.error) {
            console.error('DEBUG adminCorrectSale: Printful rejected order', pfResult.message || pfResult);
            return res.status(400).json({ success: false, message: 'Printful validation failed', details: pfResult.message || null });
        }

        // Persist new sale (replacement) and details
        const salePayload = {
            method_payment: original.method_payment || 'MANUAL',
            n_transaction: `ADMIN-REPL-${Date.now()}`,
            total: items.reduce((s, it) => s + (parseFloat(it.retail_price || it.price || 0) * (it.quantity || it.cantidad || 1)), 0),
            currency_payment: original.currency_payment || 'EUR',
            userId: original.userId || original.user || null
        };

        const newSale = await createSale(salePayload);

        if (saleAddressData && Object.keys(saleAddressData).length > 0) {
            const addr = { ...saleAddressData };
            await createSaleAddress(addr, newSale.id);
        } else if (original.sale_addresses && original.sale_addresses.length > 0) {
            const addr = original.sale_addresses[0].toJSON ? original.sale_addresses[0].toJSON() : original.sale_addresses[0];
            delete addr.id;
            await createSaleAddress(addr, newSale.id);
        }

        for (const it of items) {
            const det = {
                type_discount: it.type_discount || 1,
                discount: it.discount || 0,
                cantidad: it.quantity || it.cantidad || 1,
                code_cupon: it.code_cupon || null,
                code_discount: it.code_discount || null,
                price_unitario: it.retail_price || it.price || it.price_unitario || 0,
                subtotal: (parseFloat(it.retail_price || it.price || 0) * (it.quantity || it.cantidad || 1)).toFixed(2),
                total: (parseFloat(it.retail_price || it.price || 0) * (it.quantity || it.cantidad || 1)).toFixed(2),
                saleId: newSale.id,
                productId: it.productId || it.product_id || null,
                variedadId: it.variedadId || it.varietyId || null
            };
            await createSaleDetail(det, newSale.id);
        }

        // Log Printful full response, save Printful metadata and delivery dates, and link replacement
        try {
            console.log('[Printful] Estructura de respuesta completa (admin correction):', JSON.stringify(pfResult, null, 2));

            if (pfResult && pfResult.data) {
                const pfResp = pfResult;
                const printfulOrderId = pfResp.data.orderId ?? (pfResp.data.result && pfResp.data.result.id) ?? null;
                const printfulStatus = pfResp.data.raw?.status || (pfResp.data.result && pfResp.data.result.status) || 'unknown';
                const printfulUpdatedAt = new Date();

                console.log('[Printful] Datos de orden recibidos (admin correction):', { orderId: printfulOrderId, status: printfulStatus });

                const updatePayload = {
                    printfulOrderId,
                    printfulStatus,
                    printfulUpdatedAt,
                    replacementOfId: original.id
                };

                // delivery dates may be present in different shapes
                const pfData = pfResp.data.result || pfResp.data || {};
                if (pfData.minDeliveryDate) {
                    const minD = new Date(pfData.minDeliveryDate);
                    const maxD = new Date(minD);
                    maxD.setDate(maxD.getDate() + 7);
                    updatePayload.minDeliveryDate = minD.toISOString().split('T')[0];
                    updatePayload.maxDeliveryDate = maxD.toISOString().split('T')[0];
                }

                await newSale.update(updatePayload);

                console.log('[Printful] Estado inicial guardado en BD (admin correction):', { printfulOrderId, printfulStatus });
            } else {
                // at minimum link replacement
                await newSale.update({ replacementOfId: original.id });
                console.warn('[Printful] No se recibió data válida de la orden para admin correction. Sólo se enlazó replacementOfId.');
            }
        } catch (pfSaveErr) {
            console.error('[Printful] Error guardando estado en BD (admin correction):', pfSaveErr && (pfSaveErr.message || pfSaveErr));
            // Ensure replacement link even on error
            try { await newSale.update({ replacementOfId: original.id }); } catch (e) { /* ignore */ }
        }

        try { await sendEmail(newSale.id); } catch (e) { console.error('Error sending admin correction email', e); }

        return res.json({ success: true, message: 'Correction order created and sent to Printful', newSale, pf: pfResult.data });

    } catch (error) {
        console.error('❌ Error in adminCorrectSale:', error);
        if (error && error.stack) console.error(error.stack);
        return res.status(500).json({ success: false, message: 'Error creating correction order' });
    }
};

