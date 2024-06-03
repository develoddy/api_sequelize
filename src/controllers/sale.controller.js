import { Op } from 'sequelize';
import { User } from "../models/User.js";
import { Sale } from "../models/Sale.js";
import { Cart } from "../models/Cart.js";
import { Variedad } from "../models/Variedad.js";
import { Product } from "../models/Product.js";
import { SaleDetail } from "../models/SaleDetail.js";
import { SaleAddress } from "../models/SaleAddress.js";

import fs from 'fs';
import path from "path";
import handlebars from 'handlebars';
import ejs from 'ejs';
import nodemailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';


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

        // Create a sale
        saleData.userId = saleData.user;
        const sale = await Sale.create(saleData);

        // Associate sale address with the sale
        saleAddressData.saleId = sale.id;
        await SaleAddress.create(saleAddressData);

        // Find all carts for the user
        const carts = await Cart.findAll({ where: { userId: sale.userId } });

        for (let cart of carts) {
            // Handle stock reduction and associate cart with the sale
            if ( cart.variedadId ) { // Multiple inventory
                const variedad = await Variedad.findByPk(cart.variedadId);
                const newStock = variedad.stock - cart.cantidad;
                await Variedad.update({ stock: newStock }, { where: { id: cart.variedadId } });
            } else { // Single inventory
                const product = await Product.findByPk(cart.productId);
                const newStock = product.stock - cart.cantidad;
                await Product.update({ stock: newStock }, { where: { id: cart.productId } });
            }

            const saleDetailData = {
                type_discount: cart.type_discount || 1, // Default value if not provided
                discount: cart.discount || 0, // Default value if not provided
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

        // Send email (assuming send_email is a defined function)
        await send_email(sale.id);

        res.status(200).json({
            message: "Success! La orden se generó correctamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: SaleController register OCURRIÓ UN PROBLEMA",
        });
        console.error(error);
    }
};


