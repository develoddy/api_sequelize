import { Op } from 'sequelize';
import { User } from "../models/User.js";
import { Sale } from "../models/Sale.js";
import { Cart } from "../models/Cart.js";
import { Variedad } from "../models/Variedad.js";
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
            fs.readFile(path, { encoding: 'utf-8' }, (err, html) => {
                if (err) {
                    throw err;
                    callback(err);
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


export const register = async (req, res) => {
    try {
        const saleData = req.body.sale;
        const saleAddressData = req.body.sale_address;

        // Crear una venta
        saleData.userId = saleData.user;
        const sale = await Sale.create(saleData);

        // Asociar la dirección de venta con la venta
        saleAddressData.saleId = sale.id;
        const saleAddress = await SaleAddress.create(saleAddressData);

        // Obtener todos los carritos del usuario
        const carts = await Cart.findAll({ where: { userId: sale.userId } });

        let items = [];
        for (let cart of carts) {
            let variantId = null;
            let idFile = null;
            let productId = cart.productId;
            let varietyId = cart.variedadId;

            // Manejar la reducción de stock y asociar el carrito con la venta
            //let selectedOption = null; // Esta variable contendrá la opción seleccionada (por ejemplo, la talla)
            if ( cart.variedadId ) { // Inventario múltiple
                const variedad = await Variedad.findByPk(cart.variedadId);
                variantId = variedad.variant_id;
                productId = variedad.productId;
                //selectedOption = variedad.valor;
            }

            const product = await Product.findByPk(productId);

            const files = await File.findAll({ where: { varietyId: varietyId } });

            // Depuración para verificar los archivos obtenidos
            console.log(`Archivos obtenidos para el ID de variedad ${varietyId}:`, files);

            // Validaciones de los archivos
            if (!files || files.length === 0) {
                throw new Error(`No se encontraron archivos para la variedad con ID ${varietyId}`);
            }
            
            // Mapear los archivos encontrados
            let itemFiles = [];
            files.forEach(file => {
                itemFiles.push({
                    url: file.url || file.thumbnail_url,
                    filename: file.filename,
                    type: file.type,
                });
            });

            // Obtener opciones asociadas a la variante
            const options = await Option.findAll({ where: { varietyId: varietyId } });

            let itemOptions = {};
            const allowedThreadColors = [
                "#FFFFFF", "#000000", "#96A1A8", "#A67843", "#FFCC00",
                "#E25C27", "#CC3366", "#CC3333", "#660000", "#333366",
                "#005397", "#3399FF", "#6B5294", "#01784E", "#7BA35A"
            ];

            options.forEach(option => {
                let optionValue = option.value;
                try {
                    optionValue = JSON.parse(option.value);
                } catch (error) {
                    console.warn(`Warning: Could not parse option value for ${option.idOption}`);
                }

                if (option.idOption === 'stitch_color') {
                    const allowedValues = ['white', 'black'];
                    const color = Array.isArray(optionValue) ? optionValue[0] : optionValue;
                    itemOptions[option.idOption] = allowedValues.includes(color) ? color : 'white';
                } else if (option.idOption.startsWith('thread_colors')) {
                    // Para opciones que comienzan con 'thread_colors'
                    const colors = Array.isArray(optionValue) ? optionValue : [optionValue];
                    itemOptions[option.idOption] = colors.filter(color => allowedThreadColors.includes(color));
                    // Si no hay colores válidos, asignamos un valor por defecto
                    if (itemOptions[option.idOption].length === 0) {
                        itemOptions[option.idOption] = ["#FFFFFF"]; // valor por defecto
                    }
                } else {
                    itemOptions[option.idOption] = Array.isArray(optionValue) ? optionValue[0] : optionValue;
                }
            });

            // Validar que `thread_colors_front_large` esté presente y sea correcto
            if (!itemOptions['thread_colors_front_large'] || !allowedThreadColors.includes(itemOptions['thread_colors_front_large'][0])) {
                itemOptions['thread_colors_front_large'] = "#FFFFFF"; // valor por defecto
            }

            
            let item = {
                variant_id: variantId, 
                quantity: cart.cantidad,
                name: product.title,
                retail_price: cart.price_unitario.toString(), 
                files: itemFiles,
                options: itemOptions,
            };

            console.log("API_____ item one, ",item);
            items.push(item);
            

            //console.log("API_____ ITEM, ",item);

            // Reducir el stock del producto o variante
            if (varietyId) {
                const variedad = await Variedad.findByPk(varietyId);
                const newStock = variedad.stock - cart.cantidad;
                await Variedad.update({ stock: newStock }, { where: { id: cart.variedadId } });
            } else {
                const newStock = product.stock - cart.cantidad;
                await Product.update({ stock: newStock }, { where: { id: cart.productId } });
            }

            const saleDetailData = {
                type_discount: cart.type_discount || 1, 
                discount: cart.discount || 0, 
                cantidad: cart.cantidad,
                code_cupon: cart.code_cupon || null,
                code_discount: cart.code_discount || null,
                price_unitario: cart.price_unitario,
                subtotal: cart.subtotal,
                total: cart.total,
                saleId: sale.id,
                productId: cart.productId,
                variedadId: cart.variedadId || null
            };

            await SaleDetail.create(saleDetailData);

            // Remove the cart item
            await Cart.destroy({ where: { id: cart.id } });
        }

        console.log("API_____ items muchos, ",items);

        // Crear la orden en Printful
        const printfulOrderData = {
            recipient: {
                name: saleAddress.name,
                address1: saleAddress.address,
                city: saleAddress.ciudad,
                state_code: 'CA',//saleAddress.region,
                country_code: 'US', // US, ES Ajustar según tus necesidades
                zip: '91311', // Ajustar según tus necesidades
            },
            items: items
        };
        
        await createPrintfulOrder(printfulOrderData);

        // Send email (assuming send_email is a defined function)
        await send_email(sale.id);

        res.status(200).json({
            message: "Muy bien! La orden se generó correctamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: SaleController register OCURRIÓ UN PROBLEMA",
        });
        console.error(error);
    }
};


