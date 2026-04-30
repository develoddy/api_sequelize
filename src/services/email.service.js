import { User } from "../models/User.js";
import { Guest } from "../models/Guest.js";
import { Sale } from "../models/Sale.js";
import { Product } from "../models/Product.js";
import { SaleDetail } from "../models/SaleDetail.js";
import { SaleAddress } from "../models/SaleAddress.js";
import { Variedad } from "../models/Variedad.js";
import { Module } from "../models/Module.js";
import { Tenant } from "../models/Tenant.js";
import fs from 'fs';
import Handlebars from 'handlebars';
import ejs from 'ejs';
import nodemailer from 'nodemailer';

export async function sendOrderConfirmationEmail(sale_id) {
    console.log('📧 ===== INICIO send_email =====');
    console.log('📧 [send_email] Sale ID:', sale_id);
    
    try {
        // Función para formatear precios a 2 decimales estándar
        const formatPrice = (price) => {
            if (price <= 0) return 0.00;
            return parseFloat(price.toFixed(2));
        };

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

        console.log('📧 [send_email] Buscando venta...');
        const order = await Sale.findByPk(sale_id, {
            include: [
                { model: User },
                { model: Guest }
            ]
        });
        
        if (!order) {
            console.error('❌ [send_email] No se encontró la venta con ID:', sale_id);
            return;
        }
        
        console.log('✅ [send_email] Venta encontrada, tenant_id:', order.tenant_id);
        
        // 🏢 Buscar tenant por separado si existe tenant_id (no hay asociación definida)
        let tenant = null;
        if (order.tenant_id) {
            try {
                console.log('🔍 [send_email] Buscando tenant con ID:', order.tenant_id);
                const tenantRecord = await Tenant.findByPk(order.tenant_id);
                if (tenantRecord) {
                    tenant = tenantRecord.toJSON();
                    console.log('✅ [send_email] Tenant encontrado:', tenant.name);
                    
                    // Parsear settings si es string JSON
                    if (tenant.settings && typeof tenant.settings === 'string') {
                        try {
                            tenant.settings = JSON.parse(tenant.settings);
                            console.log('✅ [send_email] Settings parseados:', Object.keys(tenant.settings));
                        } catch (e) {
                            console.warn('⚠️ Error parseando tenant.settings:', e.message);
                            tenant.settings = {};
                        }
                    }
                } else {
                    console.warn('⚠️ [send_email] No se encontró tenant con ID:', order.tenant_id);
                }
            } catch (error) {
                console.error('❌ [send_email] Error buscando tenant:', error.message);
            }
        } else {
            console.log('ℹ️ [send_email] No hay tenant_id, usando valores por defecto');
        }
        
        console.log('✅ [send_email] Venta encontrada:', {
            id: order.id,
            total: order.total,
            module_id: order.module_id,
            user_id: order.user_id,
            guest_id: order.guest_id,
            hasUser: !!order.user,
            hasGuest: !!order.guest
        });

        console.log('📧 [send_email] Buscando detalles de venta...');
        const orderDetails = await SaleDetail.findAll({
            where: { saleId: order.id },
            include: [
                { model: Product },
                { model: Variedad },
                { model: Module, as: 'module' } // 🆕 Incluir módulo
            ]
        });
        
        console.log('✅ [send_email] Detalles encontrados:', {
            count: orderDetails.length,
            details: orderDetails.map(d => ({
                product_id: d.product_id,
                module_id: d.module_id,
                hasProduct: !!d.product,
                hasModule: !!d.module,
                moduleName: d.module?.name
            }))
        });

        console.log('📧 [send_email] Buscando dirección de venta...');
        const addressSale = await SaleAddress.findOne({
            where: { saleId: order.id }
        });
        
        console.log('✅ [send_email] Dirección encontrada:', {
            hasAddress: !!addressSale,
            email: addressSale?.email,
            name: addressSale?.name
        });

        
        if ( orderDetails ) {
            orderDetails.forEach(orderDetail => {
                // 🆕 Proteger para módulos (product puede ser null)
                if (orderDetail.product && orderDetail.product.portada) {
                    orderDetail.product.portada = `${process.env.URL_BACKEND}/api/products/uploads/product/${orderDetail.product.portada}`;
                }
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

        console.log('🔍 [DEBUG] Llamando readHTMLFile...');
        console.log('🔍 [DEBUG] Path:', `${process.cwd()}/src/mails/email_sale.html`);
        
        readHTMLFile(`${process.cwd()}/src/mails/email_sale.html`, (err, html) => {
            console.log('🔍 [DEBUG] readHTMLFile callback ejecutado');
            
            if (err) {
                console.error('❌ [DEBUG] Error leyendo HTML:', err);
                return; // Salir del callback si hay error
            }
            
            console.log('🔍 [DEBUG] HTML leído exitosamente, length:', html?.length);

            // Enriquecer detalles con precio unitario y total considerando descuentos
            const enrichedOrderDetails = orderDetails.map(detail => {
                const d = detail.toJSON();
                
                // 🆕 Para módulos, no hay product ni variedad
                d.product = d.product || null;
                d.variedad = d.variedad ?? d.variedade ?? null;
                
                // Precio original (sin descuento) - para módulos usar price_unitario directamente
                const originalPrice = parseFloat(d.variedad?.retail_price ?? d.price_unitario ?? 0);
                d.originalPrice = originalPrice;
                
                // ✅ LÓGICA CORREGIDA: Calcular precio final usando la misma lógica del frontend
                let finalPrice = originalPrice;
                
                // Si hay descuento aplicado, calcular según el tipo
                if (d.type_discount && (d.discount || d.code_discount)) {
                    const discountValue = parseFloat(d.discount) || 0;
                    
                    if (d.code_cupon) {
                        // CUPONES REALES: usar type_discount para determinar cómo calcular
                        if (d.type_discount === 1) {
                            // Cupón porcentual
                            finalPrice = originalPrice * (1 - discountValue / 100);
                        } else if (d.type_discount === 2) {
                            // Cupón monto fijo
                            finalPrice = originalPrice - discountValue;
                        }
                    } else if (d.code_discount && !d.code_cupon) {
                        // FLASH SALES: usar type_discount del Flash Sale
                        if (d.type_discount === 1) {
                            // Flash Sale porcentual
                            finalPrice = originalPrice * (1 - discountValue / 100);
                        } else if (d.type_discount === 2) {
                            // Flash Sale monto fijo
                            finalPrice = originalPrice - discountValue;
                        }
                    } else if (!d.code_cupon && !d.code_discount && d.discount) {
                        // CAMPAIGN DISCOUNTS: discount contiene el precio final O el porcentaje
                        
                        // Para Campaign Discounts, necesitamos determinar si es precio final o porcentaje
                        if (d.type_discount === 1) {
                            // Si type_discount es 1 y el valor parece un precio final (mayor que 5 y menor que original)
                            if (discountValue > 5 && discountValue < originalPrice) {
                                // Tratar como precio final
                                finalPrice = discountValue;
                            } else if (discountValue <= 100) {
                                // Tratar como porcentaje
                                finalPrice = originalPrice * (1 - discountValue / 100);
                            }
                        } else if (d.type_discount === 2) {
                            // Descuento fijo
                            finalPrice = originalPrice - discountValue;
                        }
                    }
                }
                
                // Asegurar que el precio final no sea negativo
                finalPrice = Math.max(0, finalPrice);
                
                // Aplicar formateo estándar a 2 decimales
                if (d.code_cupon || (d.code_discount && !d.code_cupon)) {
                    finalPrice = formatPrice(finalPrice);
                }
                
                d.unitPrice = parseFloat(finalPrice.toFixed(2));
                
                // Indicar si tiene descuento (comparando precio original vs precio final)
                d.hasDiscount = d.unitPrice < originalPrice;
                
                // Calcular descuento total aplicado (por todas las unidades)
                const discountPerUnit = originalPrice - d.unitPrice;
                d.totalDiscount = parseFloat((discountPerUnit * d.cantidad).toFixed(2));
                
                // calcular total por cantidad usando precio final
                d.total = parseFloat((d.unitPrice * d.cantidad).toFixed(2));
                
                
                return d;
            });
            
            // Recalcular subtotal total del pedido según detalles enriquecidos
            const enrichedOrder = order.toJSON ? order.toJSON() : { ...order };
            enrichedOrder.total = enrichedOrderDetails
                .reduce((sum, d) => sum + d.total, 0)
                .toFixed(2);
            
            // Calcular subtotal original (sin descuentos) y descuento total
            const originalSubtotal = enrichedOrderDetails
                .reduce((sum, d) => sum + (d.originalPrice * d.cantidad), 0);
            const totalDiscount = enrichedOrderDetails
                .reduce((sum, d) => sum + (d.totalDiscount || 0), 0);
            
            enrichedOrder.originalSubtotal = parseFloat(originalSubtotal.toFixed(2));
            enrichedOrder.totalDiscount = parseFloat(totalDiscount.toFixed(2));
            
            // 🆕 Detectar si es compra de módulo
            const isModulePurchase = !!(enrichedOrder.module_id || (enrichedOrderDetails.length > 0 && enrichedOrderDetails[0].module_id));
            
            console.log('🎨 [send_email] Preparando render de template...');
            console.log('🎨 [send_email] Tenant disponible:', !!tenant);
            console.log('🎨 [send_email] Tenant name:', tenant?.name);
            console.log('🎨 [send_email] Tenant settings:', tenant?.settings ? Object.keys(tenant.settings) : 'none');
            
            let rest_html;
            try {
                rest_html = ejs.render(html, {
                    order: enrichedOrder,
                    address_sale: addressSale,
                    order_detail: enrichedOrderDetails,
                    country: order.country || 'es',
                    locale: order.locale || 'es',
                    isModulePurchase: isModulePurchase, // 🆕 Flag para template
                    tenant: tenant, // 🏢 Tenant para personalización multi-tenant
                    process: { env: process.env } // Para acceder a URL_FRONTEND, etc.
                });
                
                console.log('✅ [send_email] Template renderizado correctamente, length:', rest_html?.length);
            } catch (ejsError) {
                console.error('❌ [send_email] ERROR EN EJS.RENDER:', ejsError.message);
                console.error('❌ [send_email] Stack:', ejsError.stack);
                throw ejsError;
            }

            const template = Handlebars.compile(rest_html);
            const htmlToSend = template({ op: true });

            console.log('🔍 [Email] Determinando email de destino...');
            console.log('🔍 [Email] order.user:', !!order.user);
            console.log('🔍 [Email] order.guest:', !!order.guest);
            console.log('🔍 [Email] addressSale:', !!addressSale);
            console.log('🔍 [Email] addressSale?.email:', addressSale?.email);

            // 👇 Determinar el email según si es user, guest o address
            let emailDestino = null;

            if (order.user && order.user.email) {
                emailDestino = order.user.email;
                console.log('✅ [Email] Email from order.user:', emailDestino);
            } else if (order.guest && order.guest.email) {
                emailDestino = order.guest.email;
                console.log('✅ [Email] Email from order.guest:', emailDestino);
            } else if (addressSale && addressSale.email) {
                // 🆕 Para invitados sin cuenta guest, usar email de address
                emailDestino = addressSale.email;
                console.log('✅ [Email] Email from sale_address (guest without account):', emailDestino);
            }

            if (!emailDestino) {
                console.error('❌ [Email] No se encontró email del usuario, invitado ni en address_sale');
                console.error('❌ [Email] order.user:', order.user);
                console.error('❌ [Email] order.guest:', order.guest);
                console.error('❌ [Email] addressSale:', addressSale);
                console.warn("No se encontró email del usuario, invitado ni en address_sale.");
                return;
            }
            
            console.log('✅ [Email] Email de destino determinado:', emailDestino);

            // 🔍 Validar que el email tenga un dominio válido antes de enviar
            const invalidDomains = [
                'example.com', 
                'example.org', 
                'example.net', 
                'test.com',
                'localhost',
                'fake.com',
                'dummy.com',
                'sample.com'
            ];
            
            const emailDomain = emailDestino.split('@')[1]?.toLowerCase();
            
            console.log('🔍 [Email] Validando dominio:', emailDomain);
            
            if (!emailDomain || invalidDomains.includes(emailDomain)) {
                console.warn(`⚠️ [Email] Email con dominio inválido o de prueba: ${emailDestino}. Email de confirmación no será enviado.`);
                return;
            }
            
            // Validar formato básico de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailDestino)) {
                console.warn(`⚠️ [Email] Formato de email inválido: ${emailDestino}. Email de confirmación no será enviado.`);
                return;
            }
            
            console.log('✅ [Email] Email validado correctamente:', emailDestino);

            let subject = '';

            if (orderDetails.length === 1) {
              // 🆕 Usar enrichedOrderDetails que ya tiene el módulo cargado
              const itemName = enrichedOrderDetails[0].product?.title || enrichedOrderDetails[0].module?.name || 'producto';
              subject = `Pedido Nº ${order.id} - ${itemName}`;
            } else if (orderDetails.length > 1) {
              const itemName = enrichedOrderDetails[0].product?.title || enrichedOrderDetails[0].module?.name || 'producto';
              subject = `Pedido Nº ${order.id} - ${itemName} y ${orderDetails.length - 1} productos más`;
            } else {
              subject = `Pedido Nº ${order.id} procesado correctamente`;
            }
            
            console.log('📧 [Email] Subject:', subject);

            // 🏢 Usar branding del tenant (consistente con emails de Printful)
            const storeName = tenant?.settings?.store_name || process.env.STORE_NAME || 'Store';
            
            const mailOptions = {
                from: `"${storeName}" <${process.env.EMAIL_USER}>`,
                to: emailDestino,
                subject: subject,
                html: htmlToSend
            };
            
            console.log('📧 [Email] Mail options preparadas:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                htmlLength: htmlToSend.length
            });

            // 📧 Intentar enviar email con manejo robusto de errores
            console.log('📧 [DEBUG] ===== INTENTANDO ENVIAR EMAIL =====');
            console.log('🔍 [DEBUG] to:', mailOptions.to);
            console.log('🔍 [DEBUG] subject:', mailOptions.subject);
            console.log('🔍 [DEBUG] timestamp:', new Date().toISOString());
            
            try {
                transporter.sendMail(mailOptions, (error, info) => {
                    console.log('🔍 [DEBUG] sendMail CALLBACK ejecutado');
                    
                    if (error) {
                        console.error('❌ [DEBUG] TRANSPORTER ERROR:',error.message);
                        console.error('❌ [DEBUG] Error code:', error.code);
                        console.error('❌ [DEBUG] Error response:', error.response);
                        console.error('❌ [Email] Error enviando email de confirmación:', error.message || error);
                        console.error('❌ [Email] Error completo:', error);
                        // Si el error es de dominio rechazado (nullMX), registrarlo pero no lanzar excepción
                        if (error.message?.includes('nullMX') || error.message?.includes('Recipient address rejected')) {
                            console.warn(`⚠️ [Email] Dominio de email rechazado: ${emailDestino}. El email no puede ser entregado.`);
                        }
                    } else {
                        console.log('✅ [DEBUG] ===== EMAIL ENVIADO EXITOSAMENTE =====');
                        console.log('✅ [DEBUG] Response:', info.response);
                        console.log('✅ [DEBUG] MessageId:', info.messageId);
                        console.log('✅ [DEBUG] Accepted:', info.accepted);
                        console.log('✅ [DEBUG] Rejected:', info.rejected);
                        console.log('✅ [Email] Email de confirmación enviado exitosamente!');
                        console.log('✅ [Email] Info response:', info.response);
                        console.log('✅ [Email] MessageId:', info.messageId);
                    }
                });
            } catch (sendError) {
                console.error('❌ [Email] Excepción al intentar enviar email:', sendError.message || sendError);
                console.error('❌ [Email] Excepción completa:', sendError);
                // No lanzar error para evitar bloquear el flujo de la venta
            }
        });

    } catch (error) {
        console.error('❌ [send_email] Error general en send_email():', error.message || error);
        console.error('❌ [send_email] Error stack:', error.stack);
        // No propagar el error para evitar bloquear operaciones críticas
    } finally {
        console.log('📧 ===== FIN send_email =====');
    }
}
