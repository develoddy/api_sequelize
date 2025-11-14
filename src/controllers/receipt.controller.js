import { Receipt } from '../models/Receipt.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
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
                  attributes: ['id', 'valor', 'color', 'sku', 'retail_price', 'currency']
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
              include: [Product, Variedad] 
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

    console.log('🔹 Sale obtenido:', JSON.stringify(sale, null, 2));

    // 🛒 Preparar detalles de venta
    const saleDetails = sale.sale_details.map(detail => {
      const d = detail.toJSON();
      const variedad = d.variedad || d.variedade || null;

      const retailPrice = parseFloat(variedad?.retail_price ?? d.price_unitario ?? 0);
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

      return { ...d, variedad, originalPrice: retailPrice, unitPrice: finalPrice, total, product: { ...d.product, portada } };
    });

    console.log('🔹 Detalles de venta procesados:', JSON.stringify(saleDetails, null, 2));

    // 🔹 Revisar si existen direcciones
    console.log('🔹 sale.saleAddresses raw:', sale.saleAddresses);

    const sale_address = (sale.sale_addresses && sale.sale_addresses.length > 0)
    ? sale.sale_addresses[0]
    : null;


    console.log('🔹 sale_address asignado:', sale_address);

    const saleData = {
      ...sale.dataValues,
      sale_details: saleDetails,
      sale_address
    };

    const customerName = receipt.user?.name || receipt.guest?.name || 'Invitado';
    console.log('🔹 customerName:', customerName);

    // 📄 Leer template PDF
    const templatePath = path.resolve('src/mails/receipt_template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // 🔹 Renderizar HTML con EJS
    const html = ejs.render(templateContent, {
      order: saleData,
      address_sale: sale_address,
      order_detail: saleDetails,
      customerName
    });

    console.log('🔹 HTML generado (primeros 300 chars):', html.substring(0, 300));

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
