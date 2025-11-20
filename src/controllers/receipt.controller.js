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

    // 🛒 Preparar detalles de venta
    const saleDetails = sale.sale_details.map(detail => {
      const d = detail.toJSON();
      const variedad = d.variedad || d.variedade || null;

      const retailPrice = parseFloat(variedad?.retail_price ?? d.price_unitario ?? 0);

      const variedadImage = getVariedadImage(variedad);

      // fallback: si no hay variedad con imágenes → usar portada del producto
      const finalImage =
        variedadImage ||
        (d.product?.portada
          ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
          : null);

      const finalPrice =
        d.discount != null
          ? parseFloat(d.discount)
          : d.code_discount != null
          ? parseFloat(d.code_discount)
          : retailPrice;

      const cantidad = parseFloat(d.cantidad ?? 1);
      const total = parseFloat((finalPrice * cantidad).toFixed(2));

      // Construir URL de portada si existe
      const portada = d.product?.portada 
        ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
        : null;

      //console.log("PRODUCT DEBUG:", d.product);

      return { 
        ...d, 
        variedad, 
        originalPrice: retailPrice, 
        unitPrice: finalPrice, 
        total, 
        finalImage,
        product: { ...d.product, portada } 
      };
    });

    //console.log('🔹 Detalles de venta procesados:', JSON.stringify(saleDetails, null, 2));

    // 🔹 Revisar si existen direcciones
    //console.log('🔹 sale.saleAddresses raw:', sale.saleAddresses);

    const sale_address = (sale.sale_addresses && sale.sale_addresses.length > 0)
    ? sale.sale_addresses[0]
    : null;


    //console.log('🔹 sale_address asignado:', sale_address);

    // 💰 Aplicar redondeo .95 a los detalles de la venta
    const saleDetailsWithRounding = saleDetails.map(detail => ({
      ...detail,
      unitPrice: applyRoundingTo95(detail.unitPrice || 0),
      total: applyRoundingTo95(detail.total || 0)
    }));

    // 💰 Aplicar redondeo .95 al total de la venta
    const saleData = {
      ...sale.dataValues,
      total: applyRoundingTo95(sale.dataValues.total || 0),
      shipping_cost: applyRoundingTo95(sale.dataValues.shipping_cost || 0),
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

    console.log(`[Client Receipt PDF] Usuario ${userId} solicitando PDF del recibo ${id}`);

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

      // Calcular precios como en el método admin
      const retailPrice = parseFloat(variedad?.retail_price ?? d.product?.price_usd ?? 0);
      const finalPrice = parseFloat(d.price_unitario ?? retailPrice);
      const cantidad = parseFloat(d.cantidad ?? 1);
      const total = parseFloat((finalPrice * cantidad).toFixed(2));

      // Construir URL de portada si existe
      const portada = d.product?.portada 
        ? process.env.URL_BACKEND + '/api/products/uploads/product/' + d.product.portada
        : null;

      return { 
        ...d.dataValues, 
        variedad, 
        originalPrice: retailPrice, 
        unitPrice: finalPrice, 
        total, 
        finalImage,
        product: d.product ? { 
          ...d.product.dataValues, 
          portada 
        } : null
      };
    });

    // 💰 Aplicar redondeo .95 a los detalles de la venta
    const saleDetailsWithRounding = saleDetails.map(detail => ({
      ...detail,
      unitPrice: applyRoundingTo95(detail.unitPrice || 0),
      total: applyRoundingTo95(detail.total || 0)
    }));

    // 💰 Aplicar redondeo .95 al total de la venta
    const saleData = {
      ...sale.dataValues,
      total: applyRoundingTo95(sale.dataValues.total || 0),
      shipping_cost: applyRoundingTo95(sale.dataValues.shipping_cost || 0),
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

    console.log(`✅ PDF generado exitosamente para cliente - Recibo ${id}`);

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
