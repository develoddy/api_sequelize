import { Receipt } from '../models/Receipt.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { File } from '../models/File.js';
import { Product } from '../models/Product.js'; 
import { Variedad } from '../models/Variedad.js';
import { SaleAddress } from '../models/SaleAddress.js';

// Resource for formatting receipt data
import ReceiptResource from '../resources/receipt.js'; 

// PDF generation libraries
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';

/**
 * 💰 HELPER: Aplica redondeo .95 para consistencia con frontend
 * @param {number} price - Precio a redondear
 * @returns {number} Precio redondeado terminando en .95
 */
const applyRoundingTo95 = (price) => {
  if (price < 0.95) {
    return 0.95; // Precio mínimo
  }

  const integerPart = Math.floor(price);
  const decimalPart = price - integerPart;

  // Si ya termina en .95, mantenerlo
  if (Math.abs(decimalPart - 0.95) < 0.001) {
    return parseFloat(price.toFixed(2));
  }

  // Si el decimal es menor a .95, redondear al .95 del mismo entero
  // Si es mayor o igual a .95, redondear al .95 del siguiente entero
  if (decimalPart < 0.95) {
    return parseFloat((integerPart + 0.95).toFixed(2));
  } else {
    return parseFloat(((integerPart + 1) + 0.95).toFixed(2));
  }
};

/**
 * Lista todos los recibos
 */
export const getList = async (req, res) => {
  try {
    const receipts = await Receipt.findAll({
      include: [User, Guest, Sale],
      order: [['createdAt', 'DESC']]
    });
    
    return res.json({ success:true, receipts: receipts }); //res.json(receipts);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los recibos' });
  }
};

/**
 * Obtener recibo por ID
 */
export const getById = async (req, res) => {
  try {
    const receipt = await Receipt.findByPk(req.params.id, {
      include: [
        { model: User },
        { model: Guest },
        {
          model: Sale,
          include: [
            {
              model: SaleDetail,
              include: [
                {
                  model: Product,
                  attributes: ['id', 'title', 'slug', 'portada', 'sku', 'price_usd', 'price_soles']
                },
                {
                  model: Variedad,
                  attributes: ['id', 'valor', 'color', 'sku', 'retail_price', 'currency'],
                  include: [
                    {
                      model: File,
                      attributes: ['id', 'url', 'preview_url', 'thumbnail_url', 'filename', 'type', 'mime_type']
                    }
                  ]
                }
              ]
            },
            {
              model: SaleAddress, 
              attributes: [
                'id',
                'name',
                'surname',
                'email',
                'telefono',
                'pais',
                'ciudad',
                'region',
                'address',
                'referencia',
                'nota',
                'zipcode'
              ]
            }
          ]
        }
      ]
    });

    if (!receipt) return res.status(404).json({ message: 'Recibo no encontrado' });

    const receiptResource = ReceiptResource.receipt_item(receipt);

    return res.json({ 
      success:true, 
      receipt: receiptResource 
    }); 
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el recibo' });
  }
};

/**
 * Crear nuevo recibo
 */
export const create = async (req, res) => {
  try {
    const { userId, guestId, saleId, amount, paymentMethod, paymentDate, status, notes } = req.body;

    const newReceipt = await Receipt.create({
      userId: userId || null,
      guestId: guestId || null,
      saleId: saleId || null,
      amount,
      paymentMethod: paymentMethod || 'efectivo',
      paymentDate: paymentDate || new Date(),
      status: status || 'pendiente',
      notes: notes || ''
    });

    res.status(201).json(newReceipt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el recibo' });
  }
};

/**
 * Actualizar recibo
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ message: 'Recibo no encontrado' });

    await receipt.update(req.body);
    res.json(receipt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el recibo' });
  }
};

/**
 * Obtener todos los recibos de una venta específica
 */
export const getBySale = async (req, res) => {
  try {
    const { saleId } = req.params;
    const receipts = await Receipt.findAll({
      where: { saleId },
      include: [User, Guest, Sale],
      order: [['createdAt', 'DESC']]
    });
    return res.json({ 
      success:true, 
      receipts: receipts 
    }); 

    //res.json(receipts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los recibos de la venta' });
  }
};

/**
 * Generar PDF del recibo
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */


export const generatePdf = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔹 Generando PDF para recibo ID:', id);

    // 🔹 Obtener recibo con relaciones
    const receipt = await Receipt.findByPk(id, {
      include: [
        { model: User },
        { model: Guest },
        {
          model: Sale,
          include: [
            { 
              model: SaleDetail, 
              include: [
                {
                  model: Product,
                },
                {
                  model: Variedad,
                  include: [
                    {
                      model: File,
                      attributes: ['id', 'type', 'preview_url', 'thumbnail_url', 'url']
                    }
                  ]
                }
              ]
            },
            {
              model: SaleAddress, 
              attributes: [
                'id',
                'name',
                'surname',
                'email',
                'telefono',
                'pais',
                'ciudad',
                'region',
                'address',
                'referencia',
                'nota',
                'zipcode'
              ]
            }
          ]
        }
      ]
    });

    if (!receipt) {
      console.log('⚠️ Recibo no encontrado');
      return res.status(404).json({ message: 'Recibo no encontrado' });
    }

    console.log('🔹 Recibo obtenido:', JSON.stringify(receipt, null, 2));

    const sale = receipt.sale;

    if (!sale) {
      console.log('⚠️ No se encontró la venta asociada al recibo');
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    //console.log('🔹 Sale obtenido:', JSON.stringify(sale, null, 2));

    // 🛒 Preparar detalles de venta - USAR DATOS YA CALCULADOS Y GUARDADOS
    console.log('🔍 DEBUG PDF: Estructura completa del primer detalle:');
    console.log(JSON.stringify(sale.sale_details[0], null, 2));
    
    // Debug específico de campos de descuento para todos los productos
    sale.sale_details.forEach((detail, index) => {
      const d = detail.toJSON();
      console.log(`🔍 Producto ${index + 1} - Campos de descuento:`, {
        product_title: d.product?.title,
        price_unitario: d.price_unitario,
        code_cupon: d.code_cupon,
        code_discount: d.code_discount,
        discount: d.discount,
        type_discount: d.type_discount,
        cantidad: d.cantidad,
        variedad_retail_price: d.variedad?.retail_price || d.variedade?.retail_price,
        product_price_usd: d.product?.price_usd
      });
    });
    
    const saleDetails = sale.sale_details.map(detail => {
      const d = detail.toJSON();
      const variedad = d.variedad || d.variedade || null;

      // 🚫 NO RECALCULAR - USAR VALORES YA GUARDADOS EN LA BD
      
      // 1. PRECIO FINAL UNITARIO: usar price_unitario tal como está guardado
      const finalUnitPrice = parseFloat(d.price_unitario || 0);
      
      // 2. PRECIO ORIGINAL: usar el campo disponible en BD o calcular mínimo necesario
      let originalUnitPrice = 0;
      if (variedad?.retail_price) {
        originalUnitPrice = parseFloat(variedad.retail_price);
      } else if (d.product?.price_usd) {
        originalUnitPrice = parseFloat(d.product.price_usd);
      } else {
        // Fallback: si no hay precio original, asumir que finalPrice es correcto
        originalUnitPrice = finalUnitPrice;
      }
      
      // 3. CANTIDAD
      const cantidad = parseFloat(d.cantidad || 1);
      
      // 4. TOTAL (precio final * cantidad)
      const total = parseFloat((finalUnitPrice * cantidad).toFixed(2));
      
      // 5. DETECTAR DESCUENTO APLICADO (simple verificación)
      const hasDiscount = (originalUnitPrice > finalUnitPrice) || d.code_cupon || d.code_discount || d.discount;
      
      // 6. AHORRO POR UNIDAD (diferencia real entre precios guardados)
      const discountAmountPerUnit = hasDiscount ? (originalUnitPrice - finalUnitPrice) : 0;
      
      // 7. PORCENTAJE (basado en diferencia real)
      let discountPercentage = 0;
      if (hasDiscount && originalUnitPrice > 0) {
        if (d.code_cupon) {
          // Para cupones, extraer del código si es posible
          const cuponMatch = d.code_cupon.toUpperCase().match(/(\d+)/);
          discountPercentage = cuponMatch ? parseInt(cuponMatch[1]) : Math.round((discountAmountPerUnit / originalUnitPrice) * 100);
        } else {
          // Para otros descuentos, calcular basado en diferencia real
          discountPercentage = Math.round((discountAmountPerUnit / originalUnitPrice) * 100);
        }
      }
      
      // 8. TIPO DE DESCUENTO - USAR type_campaign
      let discountType = '';
      if (hasDiscount) {
        if (d.type_campaign === 3 || d.code_cupon) {
          discountType = `Cupón ${d.code_cupon || ''}`;
        } else if (d.type_campaign === 2) {
          discountType = 'Flash Sale';
        } else if (d.type_campaign === 1) {
          discountType = 'Campaign Discount';
        } else {
          // Fallback para registros antiguos sin type_campaign
          if (d.code_cupon) {
            discountType = `Cupón ${d.code_cupon}`;
          } else if (d.code_discount) {
            discountType = 'Flash Sale';
          } else if (d.discount) {
            discountType = 'Campaign Discount';
          } else {
            discountType = 'Descuento';
          }
        }
      }
      
      // 🔍 DEBUG DETALLADO POR PRODUCTO
      console.log(`📊 Producto: ${d.product?.title}`);
      console.log(`   Original: ${originalUnitPrice}, Final: ${finalUnitPrice}`);
      console.log(`   Ahorro: ${discountAmountPerUnit}, Porcentaje: ${discountPercentage}%`);
      console.log(`   Tipo: ${discountType}, hasDiscount: ${hasDiscount}`);

      const variedadImage = getVariedadImage(variedad);

      // fallback: si no hay variedad con imágenes → usar portada del producto
      const finalImage =
        variedadImage ||
        (d.product?.portada
          ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
          : null);

      // Construir URL de portada si existe
      const portada = d.product?.portada 
        ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
        : null;

      //console.log("PRODUCT DEBUG:", d.product);

      return { 
        ...d, 
        variedad, 
        originalPrice: originalUnitPrice, 
        unitPrice: finalUnitPrice, 
        total, 
        finalImage,
        product: { ...d.product, portada },
        // Campos adicionales para el template - USAR VALORES REALES
        hasDiscountApplied: hasDiscount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmountPerUnit, // POR UNIDAD
        discountType: discountType
      };
    });

    //console.log('🔹 Detalles de venta procesados:', JSON.stringify(saleDetails, null, 2));

    // 🔹 Revisar si existen direcciones
    //console.log('🔹 sale.saleAddresses raw:', sale.saleAddresses);

    const sale_address = (sale.sale_addresses && sale.sale_addresses.length > 0)
    ? sale.sale_addresses[0]
    : null;


    //console.log('🔹 sale_address asignado:', sale_address);

    // 💰 Aplicar redondeo .95 solo a precios unitarios, NO a totales individuales
    const saleDetailsWithRounding = saleDetails.map(detail => ({
      ...detail,
      unitPrice: applyRoundingTo95(detail.unitPrice || 0),
      total: parseFloat(detail.total || 0) // ✅ Mantener total exacto del producto
    }));

    // 💰 Total debe ser suma exacta, NO aplicar redondeo .95
    const saleData = {
      ...sale.dataValues,
      total: parseFloat(sale.dataValues.total || 0), // ✅ Suma exacta de productos
      shipping_cost: 0.00, // ✅ ENVÍO GRATIS - siempre mostrar 0.00€
      sale_details: saleDetailsWithRounding,
      sale_address
    };

    const customerName = receipt.user?.name || receipt.guest?.name || 'Invitado';
    //console.log('🔹 customerName:', customerName);

    // 📄 Leer template PDF
    const templatePath = path.resolve('src/mails/receipt_template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // 🔹 Renderizar HTML con EJS
    const html = ejs.render(templateContent, {
      order: saleData,
      address_sale: sale_address,
      order_detail: saleDetailsWithRounding,
      customerName
    });

    //console.log('🔹 HTML generado (primeros 300 chars):', html.substring(0, 300));

    if (!html || html.trim().length < 100) {
      console.error('⚠️ HTML vacío o inválido');
      return res.status(500).json({ message: 'Error al generar contenido HTML del PDF' });
    }

    // 🖨️ Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1800 });
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm' }
    });
    await page.close();
    await browser.close();

    // 📬 Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    res.status(500).json({ message: 'Error al generar el PDF' });
  }
};


// 🔹 Función para obtener la mejor imagen de la variedad
function getVariedadImage(variedad) {
  if (!variedad || !Array.isArray(variedad.files)) return null;

  // 1️⃣ Buscar preview
  const preview = variedad.files.find(f => f.type === 'preview');
  if (preview?.preview_url) return preview.preview_url;

  // 2️⃣ Buscar default
  const def = variedad.files.find(f => f.type === 'default');
  if (def?.preview_url) return def.preview_url;

  // 3️⃣ Cualquier otra imagen
  const any = variedad.files[0];
  if (any) return any.preview_url || any.thumbnail_url || any.url;

  return null;
}

// 🛒 ================ MÉTODOS PARA CLIENTES AUTENTICADOS ================ 🛒

/**
 * Obtener recibo de una venta específica para clientes autenticados
 * Solo permite acceso al dueño de la venta
 */
export const getClientReceiptBySale = async (req, res) => {
  try {
    const { saleId } = req.params;
    const userId = req.user.id; // Del middleware auth.verifyEcommerce (usa 'id' no '_id')
    
    console.log(`[Client Receipt] Usuario ${userId} solicitando recibo para venta ${saleId}`);

    // Verificar que la venta pertenece al usuario autenticado
    const sale = await Sale.findOne({
      where: { 
        id: saleId,
        userId: userId 
      }
    });

    if (!sale) {
      return res.status(404).json({ 
        message: 'Venta no encontrada o no tienes permisos para acceder a este recibo' 
      });
    }

    // Obtener el recibo de esta venta
    const receipt = await Receipt.findOne({
      where: { saleId },
      include: [
        { model: User },
        { model: Guest },
        {
          model: Sale,
          include: [
            {
              model: SaleDetail,
              include: [
                {
                  model: Product,
                  attributes: ['id', 'title', 'slug', 'portada', 'sku', 'price_usd', 'price_soles']
                },
                {
                  model: Variedad,
                  attributes: ['id', 'valor', 'color', 'sku', 'retail_price', 'currency'],
                  include: [
                    {
                      model: File,
                      attributes: ['id', 'url', 'preview_url', 'thumbnail_url', 'filename', 'type', 'mime_type']
                    }
                  ]
                }
              ]
            },
            {
              model: SaleAddress,
              attributes: [
                'id', 'name', 'surname', 'email', 'telefono', 'pais', 'ciudad', 
                'region', 'address', 'referencia', 'nota', 'zipcode'
              ]
            }
          ]
        }
      ]
    });

    if (!receipt) {
      return res.status(404).json({ message: 'Recibo no encontrado para esta venta' });
    }

    const receiptResource = ReceiptResource.receipt_item(receipt);

    return res.json({ 
      success: true, 
      receipt: receiptResource 
    }); 
    
  } catch (error) {
    console.error('[Client Receipt] Error:', error);
    res.status(500).json({ message: 'Error al obtener el recibo' });
  }
};

/**
 * Generar y descargar PDF del recibo para clientes autenticados
 * Solo permite acceso al dueño del recibo
 */
export const generateClientReceiptPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Del middleware auth.verifyEcommerce (usa 'id' no '_id')

    console.log(`🔍 [Client Receipt PDF] Usuario ${userId} solicitando PDF del recibo ${id}`);

    // Obtener recibo con verificación de ownership
    const receipt = await Receipt.findByPk(id, {
      include: [
        { model: User },
        { model: Guest },
        {
          model: Sale,
          where: { userId: userId }, // Verificar que la venta pertenece al usuario
          include: [
            {
              model: SaleDetail,
              include: [
                {
                  model: Product,
                  attributes: ['id', 'title', 'slug', 'portada', 'sku', 'price_usd', 'price_soles']
                },
                {
                  model: Variedad,
                  attributes: ['id', 'valor', 'color', 'sku', 'retail_price', 'currency'],
                  include: [
                    {
                      model: File,
                      attributes: ['id', 'url', 'preview_url', 'thumbnail_url', 'filename', 'type', 'mime_type']
                    }
                  ]
                }
              ]
            },
            {
              model: SaleAddress,
              attributes: [
                'id', 'name', 'surname', 'email', 'telefono', 'pais', 'ciudad',
                'region', 'address', 'referencia', 'nota', 'zipcode'
              ]
            }
          ]
        }
      ]
    });

    if (!receipt || !receipt.sale) {
      return res.status(404).json({ 
        message: 'Recibo no encontrado o no tienes permisos para acceder a este recibo' 
      });
    }

    // Usar la misma lógica del PDF existente
    const sale = receipt.sale;
    const rawSaleDetails = sale.sale_details || [];
    const sale_address = sale.sale_addresses && sale.sale_addresses.length > 0 
      ? sale.sale_addresses[0] 
      : null;

    // Debug solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 DEBUG CLIENT PDF: Generando recibo para', rawSaleDetails.length, 'productos');
    }

    // Transformar saleDetails usando la misma lógica que el método admin
    const saleDetails = rawSaleDetails.map(d => {
      // Obtener la mejor imagen de la variedad
      let finalImage = getVariedadImage(d.variedade);
      
      // Preparar datos de variedad
      const variedad = d.variedade ? {
        id: d.variedade.id,
        valor: d.variedade.valor,
        color: d.variedade.color,
        sku: d.variedade.sku,
        retail_price: d.variedade.retail_price,
        currency: d.variedade.currency,
        files: d.variedade.files || []
      } : null;

      // 🔧 RECALCULAR PARA COINCIDIR CON FRONTEND (que aplica redondeo .95)
      
      // 1. PRECIO ORIGINAL: usar el campo disponible en BD
      let originalUnitPrice = 0;
      if (variedad?.retail_price) {
        originalUnitPrice = parseFloat(variedad.retail_price);
      } else if (d.product?.price_usd) {
        originalUnitPrice = parseFloat(d.product.price_usd);
      }
      
      // 2. DETECTAR TIPO DE DESCUENTO - USAR type_campaign
      let discountType = '';
      let discountPercentage = 0;
      let hasDiscount = false;
      
      if (d.type_campaign === 3 || d.code_cupon) {
        hasDiscount = true;
        discountType = `Cupón ${d.code_cupon || ''}`;
        // Para cupones, extraer porcentaje del código
        const cuponMatch = d.code_cupon ? d.code_cupon.toUpperCase().match(/(\d+)/) : null;
        discountPercentage = cuponMatch ? parseInt(cuponMatch[1]) : parseInt(d.discount || 50);
      } else if (d.type_campaign === 2) {
        hasDiscount = true;
        discountType = 'Flash Sale';
        discountPercentage = parseInt(d.discount || 10);
      } else if (d.type_campaign === 1) {
        hasDiscount = true;
        discountType = 'Campaign Discount';
        discountPercentage = parseInt(d.discount || 10);
      } else if (d.code_discount || d.discount) {
        // Fallback para registros antiguos sin type_campaign
        hasDiscount = true;
        if (d.code_discount) {
          discountType = 'Flash Sale';
        } else {
          discountType = 'Campaign Discount';
        }
        discountPercentage = parseInt(d.discount || 10);
      }
      
      // 3. CALCULAR PRECIO FINAL CORRECTO (como lo hace el frontend)
      let finalUnitPrice = originalUnitPrice;
      let discountAmountPerUnit = 0;
      
      if (hasDiscount && discountPercentage > 0) {
        // Calcular descuento basado en porcentaje
        discountAmountPerUnit = (originalUnitPrice * discountPercentage) / 100;
        finalUnitPrice = originalUnitPrice - discountAmountPerUnit;
        
        // Aplicar redondeo .95 (como hace el frontend)
        finalUnitPrice = Math.floor(finalUnitPrice) + 0.95;
        
        // Recalcular ahorro real basado en precio final con redondeo
        // El ahorro también debe terminar en .95 para ser consistente
        discountAmountPerUnit = originalUnitPrice - finalUnitPrice;
        // Redondear el ahorro para que termine en .95
        discountAmountPerUnit = Math.floor(discountAmountPerUnit) + 0.95;
      }
      
      // 4. CANTIDAD Y TOTAL
      const cantidad = parseFloat(d.cantidad || 1);
      const total = parseFloat((finalUnitPrice * cantidad).toFixed(2));
      
      // 🔍 DEBUG DETALLADO POR PRODUCTO (CLIENTE)
      console.log(`📊 Cliente Producto: ${d.product?.title}`);
      console.log(`   Original: ${originalUnitPrice}, Final calculado: ${finalUnitPrice}`);
      console.log(`   BD Final: ${d.price_unitario}, Ahorro calculado: ${discountAmountPerUnit}`);
      console.log(`   Porcentaje: ${discountPercentage}%, Tipo: ${discountType}`);

      // Construir URL de portada si existe
      const portada = d.product?.portada 
        ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
        : null;

      return { 
        ...d.dataValues, 
        variedad, 
        originalPrice: originalUnitPrice, 
        unitPrice: finalUnitPrice, 
        total, 
        finalImage,
        product: d.product ? { 
          ...d.product.dataValues, 
          portada 
        } : null,
        // Campos adicionales para el template - VALORES RECALCULADOS CORRECTOS
        hasDiscountApplied: hasDiscount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmountPerUnit, // POR UNIDAD
        discountType: discountType
      };
    });

    // 💰 Aplicar redondeo .95 solo a precios unitarios, NO a totales individuales
    const saleDetailsWithRounding = saleDetails.map(detail => ({
      ...detail,
      unitPrice: applyRoundingTo95(detail.unitPrice || 0),
      total: parseFloat(detail.total || 0) // ✅ Mantener total exacto del producto
    }));

    // 💰 Total debe ser suma exacta, NO aplicar redondeo .95
    const saleData = {
      ...sale.dataValues,
      total: parseFloat(sale.dataValues.total || 0), // ✅ Suma exacta de productos
      shipping_cost: 0.00, // ✅ ENVÍO GRATIS - siempre mostrar 0.00€
      sale_details: saleDetailsWithRounding,
      sale_address
    };

    const customerName = receipt.user?.name || receipt.guest?.name || 'Cliente';

    // Leer template PDF
    const templatePath = path.resolve('src/mails/receipt_template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Renderizar HTML con EJS
    const html = ejs.render(templateContent, {
      order: saleData,
      address_sale: sale_address,
      order_detail: saleDetailsWithRounding,
      customerName
    });

    if (!html || html.trim().length < 100) {
      console.error('⚠️ HTML vacío o inválido para cliente');
      return res.status(500).json({ message: 'Error generando el contenido del recibo' });
    }

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    console.log(`✅ PDF generado exitosamente para cliente - Recibo ID: ${id} | Sale ID: ${sale.id}`);

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=recibo-pedido-${receipt.saleId}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generando PDF para cliente:', error);
    res.status(500).json({ message: 'Error al generar el PDF del recibo' });
  }
};
