import { Op } from 'sequelize';
import { User } from "../models/User.js";
import { Sale } from "../models/Sale.js";
import { Cart } from "../models/Cart.js";
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
import handlebars from 'handlebars';
import ejs from 'ejs';
import nodemailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';

import { createPrintfulOrder } from './proveedor/printful/productPrintful.controller.js';


async function send_email(sale_id) {

    try {
        const readHTMLFile = (path, callback) => {
            fs.readFile( path, { encoding: 'utf-8' }, ( err, html ) => {
                if ( err ) {
                    throw err;
                    callback( err );
                } else {
                    callback(null, html);
                }
            });
        };

        const order = await Sale.findByPk(sale_id, {
            include: [{ model: User }]
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

        const transporter = nodemailer.createTransport(smtpTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            auth: {
                user: 'eddylujann@gmail.com',
                pass: 'ignfrlipfginoieb'
            }
        }));

        readHTMLFile(`${process.cwd()}/src/mails/email_sale.html`, (err, html) => {
            if (err) throw err;

            const rest_html = ejs.render(html, {
                order,
                address_sale: addressSale,
                order_detail: orderDetails
            });

            const template = handlebars.compile(rest_html);
            const htmlToSend = template({ op: true });

            const mailOptions = {
                from: 'eddylujann@gmail.com',
                to: order.user.email,
                subject: `Finaliza tu compra ${order.id}`,
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

// Registrar una venta y asociar dirección
export const register = async (req, res) => {
    try {
        const saleData = req.body.sale;
        const saleAddressData = req.body.sale_address;

        // Crear una venta y asociar la dirección
        const sale = await createSale(saleData);
        const saleAddress = await createSaleAddress(saleAddressData, sale.id);

        // Obtener todos los carritos del usuario
        const carts = await getUserCarts(sale.userId);

        // Preparar los items para Printful
        const { items, costs } = await prepareItemsForPrintful(carts, sale); 

        // Crear datos de la orden para Printful
        const printfulOrderData = createPrintfulOrderData(saleAddress, items, costs);
        //console.log("Items: ", JSON.stringify(printfulOrderData, null, 2));

        // Crear la orden en Printful
        let data = await prepareCreatePrintfulOrder(printfulOrderData);

        if (data === "error_order") {
            return res.status(200).json({
                code: 403,
                message: "Ups! Hubo un problema al generar la orden",
            });
        }

        // Enviar email de confirmación
        await sendEmail(sale.id);

        // Obtener los detalles de la venta
        const saleDetails = await getSaleDetails(sale.id);

        res.status(200).json({
            message: "Muy bien! La orden se generó correctamente",
            sale: sale,
            saleDetails: saleDetails,
        });
    } catch (error) {
        console.error("Error en el proceso de registro de venta:", error);
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

// Preparar los datos de los items para enviar a Printful
const prepareItemsForPrintful = async (carts, sale) => {
    const items = [];
    let subtotal = 0;
    let discount = 0;
    let shipping = 5.00; // Ajusta el costo de envío según tus necesidades
    let tax = 0.00; // Ajusta el impuesto según tus necesidades

    for (const cart of carts) {
        const itemFiles = await getItemFiles(cart);
        const itemOptions = await getItemOptions(cart);
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
    
    //return items;
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

// Obtener los archivos asociados a un ítem
const getItemFiles = async (cart) => {
    let variantId = null;
    let productId = cart.productId;
    let varietyId = cart.variedadId;

    if (varietyId) {
        const variety = await Variedad.findByPk(varietyId);
        variantId = variety.variant_id;
        productId = variety.productId;
    }

    const product = await Product.findByPk(productId);
    const files = await File.findAll({
        where: { varietyId },
        include: [{
            model: Variedad,
            include: [{
                model: Product,
                include: [Categorie],
            }]
        }],
    });

    if (!files || files.length === 0) {
        throw new Error(`No se encontraron archivos para la variedad con ID ${varietyId}`);
    }

    return files.map((file, index) => processFile(file, index));
};

// Procesar cada archivo
const processFile = (file, index) => {
    const printAreas = {
        "Long sleeve shirts": { width: 12, height: 16 },
        "Hoodies": { width: 14, height: 14 },
        "hat": { width: 5, height: 3 },
    };

    const categoryTitle = file.variedade.product.category.title;
    const printArea = printAreas[categoryTitle];
    if (!printArea) {
        throw new Error(`Área de impresión no definida para el producto tipo: ${categoryTitle}`);
    }

    const printAreaWidthPixels = printArea.width * file.dpi;
    const printAreaHeightPixels = printArea.height * file.dpi;

    const position = index === 0 
        ? calculatePositionForFirstFile(file, printAreaWidthPixels, printAreaHeightPixels) 
        : calculatePositionForSecondFile(file, printAreaWidthPixels, printAreaHeightPixels);

    return {
        url: file.preview_url,
        filename: file.filename,
        type: file.type,
        position: position
    };
};

const calculatePositionForFirstFile = (file, printAreaWidthPixels, printAreaHeightPixels) => {
    let leftPosition = (printAreaWidthPixels - file.width) / 2;
    let topPosition = 0;
    const marginRight = 0.8 * printAreaWidthPixels;
    const marginTop = 0.2 * printAreaWidthPixels;
    leftPosition = Math.min(leftPosition + marginRight, printAreaWidthPixels - (file.width / 2));
    topPosition = Math.max(topPosition, +marginTop);

    const scaleFactor = 0.5;
    const scaledWidth = file.width * scaleFactor;
    const scaledHeight = file.height * scaleFactor;

    return {
        "area_width": printAreaWidthPixels,
        "area_height": printAreaHeightPixels,
        "width": scaledWidth,
        "height": scaledHeight,
        "top": topPosition,
        "left": leftPosition,
        "limit_to_print_area": true
    };
};

const calculatePositionForSecondFile = (file, printAreaWidthPixels, printAreaHeightPixels) => ({
    "area_width": printAreaWidthPixels,
    "area_height": printAreaHeightPixels,
    "width": file.width,
    "height": file.height,
    "top": 0,
    "left": 0,
    "limit_to_print_area": true
});

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
        variant_id: variantId, // Asegúrate de que variant_id sea un número
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

// Crear la orden en Printful
const prepareCreatePrintfulOrder = async (orderData) => {
    // Implementar la llamada a la API de Printful
    // Ejemplo: return await axios.post('https://api.printful.com/orders', orderData);
    let data = await createPrintfulOrder(orderData);

        if (data == "error_order") {
            res.status( 200 ).json({
                code: 403,
                message: "Ups! Hubo un problema al generar la orden",
            });
            return;
        }
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


