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
            let productId = cart.productId;
            let varietyId = cart.variedadId;

            // Manejar la reducción de stock y asociar el carrito con la venta
            if ( cart.variedadId ) { // Inventario múltiple
                const variedad = await Variedad.findByPk(cart.variedadId);
                variantId = variedad.variant_id;
                productId = variedad.productId;
            }

            const product = await Product.findByPk(productId);

            // Obtener archivos asociados a la variante
            const files = await File.findOne({ where: { varietyId } });

            // Obtener opciones asociadas a la variante
            //const options = await Option.findAll({ where: { varietyId: varietyId } });
            //console.log("-------- API options -----------: ", options);

            /*const parseOptionValue = (value) => {
                if (!value) return [];
                
                // Remover comillas y corchetes
                const cleanedValue = value.replace(/[\[\]"]/g, '');
                
                // Separar por comas y limpiar espacios
                return cleanedValue.split(',').map(item => item.trim());
            };

            // Procesar opciones y filtrar solo las que tienen valores en 'value'
            const validItemOptions = options
                .map(option => ({
                    id: option.id,
                    value: parseOptionValue(option.value)
                }))
                .filter(option => option.value.length > 0);

        
            // Array para almacenar las opciones formateadas que tienen valores
            let optionsToInclude = [];

            // Filtrar las opciones que tienen valores en value
            validItemOptions.forEach(option => {
                if (option.value.length > 0) {
                    optionsToInclude.push({
                        id: `OptionKey_${option.id}`, // Ajustar el ID según sea necesario
                        value: option.value.join(", ") // Unir los valores del array en una cadena separada por comas
                    });
                }
            });

            const filteredOptions = optionsToInclude.filter(option => option.value.startsWith('#'));*/
            
            let item = {
                variant_id: variantId, 
                quantity: cart.cantidad,
                name: product.title,
                retail_price: cart.price_unitario.toString(), // Precio unitario
               // Mapear los archivos encontrados
                files: [{
                    url: files.url,
                    filename: files.filename,
                    type: files.type
                }],
                options: {
                    thread_colors_front_large: "#FFFFFF" // Color del hilo para la parte frontal grande
                }
            };

            console.log("_____ ITEM: ", item);
           
            items.push(item);

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

        /*
         *
         *  Crear la orden en Printful
         *
         */
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


