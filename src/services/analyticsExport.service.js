import ExcelJS from 'exceljs';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exporta métricas a formato CSV
 * @param {Array} metrics - Array de métricas
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportMetricsToCSV(metrics, filename = 'metrics.csv') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'metricType', title: 'Type' },
        { id: 'revenue', title: 'Revenue' },
        { id: 'costs', title: 'Costs' },
        { id: 'profit', title: 'Profit' },
        { id: 'margin', title: 'Margin (%)' },
        { id: 'orderCount', title: 'Orders' },
        { id: 'syncedCount', title: 'Synced' },
        { id: 'pendingCount', title: 'Pending' },
        { id: 'shippedCount', title: 'Shipped' },
        { id: 'deliveredCount', title: 'Delivered' },
        { id: 'failedCount', title: 'Failed' },
        { id: 'successRate', title: 'Success Rate (%)' },
        { id: 'avgFulfillmentTime', title: 'Avg Fulfillment (hrs)' },
        { id: 'avgOrderValue', title: 'Avg Order Value' }
      ]
    });

    const records = metrics.map(m => ({
      date: m.date ? new Date(m.date).toISOString().split('T')[0] : '',
      metricType: m.metricType || '',
      revenue: m.revenue || 0,
      costs: m.costs || 0,
      profit: m.profit || 0,
      margin: m.margin || 0,
      orderCount: m.orderCount || 0,
      syncedCount: m.syncedCount || 0,
      pendingCount: m.pendingCount || 0,
      shippedCount: m.shippedCount || 0,
      deliveredCount: m.deliveredCount || 0,
      failedCount: m.failedCount || 0,
      successRate: m.successRate || 0,
      avgFulfillmentTime: m.avgFulfillmentTime || 0,
      avgOrderValue: m.avgOrderValue || 0
    }));

    await csvWriter.writeRecords(records);
    return filepath;

  } catch (error) {
    console.error('Error exportando métricas a CSV:', error);
    throw error;
  }
}

/**
 * Exporta métricas a formato Excel
 * @param {Array} metrics - Array de métricas
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportMetricsToExcel(metrics, filename = 'metrics.xlsx') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Metrics');

    // Configurar columnas
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'metricType', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 12 },
      { header: 'Costs', key: 'costs', width: 12 },
      { header: 'Profit', key: 'profit', width: 12 },
      { header: 'Margin (%)', key: 'margin', width: 12 },
      { header: 'Orders', key: 'orderCount', width: 10 },
      { header: 'Synced', key: 'syncedCount', width: 10 },
      { header: 'Pending', key: 'pendingCount', width: 10 },
      { header: 'Shipped', key: 'shippedCount', width: 10 },
      { header: 'Delivered', key: 'deliveredCount', width: 10 },
      { header: 'Failed', key: 'failedCount', width: 10 },
      { header: 'Success Rate (%)', key: 'successRate', width: 15 },
      { header: 'Avg Fulfillment (hrs)', key: 'avgFulfillmentTime', width: 18 },
      { header: 'Avg Order Value', key: 'avgOrderValue', width: 15 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    // Agregar datos
    metrics.forEach(m => {
      worksheet.addRow({
        date: m.date ? new Date(m.date).toISOString().split('T')[0] : '',
        metricType: m.metricType || '',
        revenue: m.revenue || 0,
        costs: m.costs || 0,
        profit: m.profit || 0,
        margin: m.margin || 0,
        orderCount: m.orderCount || 0,
        syncedCount: m.syncedCount || 0,
        pendingCount: m.pendingCount || 0,
        shippedCount: m.shippedCount || 0,
        deliveredCount: m.deliveredCount || 0,
        failedCount: m.failedCount || 0,
        successRate: m.successRate || 0,
        avgFulfillmentTime: m.avgFulfillmentTime || 0,
        avgOrderValue: m.avgOrderValue || 0
      });
    });

    // Formato de números
    worksheet.getColumn('revenue').numFmt = '€#,##0.00';
    worksheet.getColumn('costs').numFmt = '€#,##0.00';
    worksheet.getColumn('profit').numFmt = '€#,##0.00';
    worksheet.getColumn('margin').numFmt = '0.00"%"';
    worksheet.getColumn('successRate').numFmt = '0.00"%"';
    worksheet.getColumn('avgFulfillmentTime').numFmt = '0.00';
    worksheet.getColumn('avgOrderValue').numFmt = '€#,##0.00';

    await workbook.xlsx.writeFile(filepath);
    return filepath;

  } catch (error) {
    console.error('Error exportando métricas a Excel:', error);
    throw error;
  }
}

/**
 * Exporta analytics de productos a CSV
 * @param {Array} products - Array de productos con analytics
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportProductsToCSV(products, filename = 'products.csv') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'productId', title: 'Product ID' },
        { id: 'productName', title: 'Product Name' },
        { id: 'unitsSold', title: 'Units Sold' },
        { id: 'revenue', title: 'Revenue' },
        { id: 'printfulCost', title: 'Printful Cost' },
        { id: 'profit', title: 'Profit' },
        { id: 'margin', title: 'Margin (%)' },
        { id: 'orderCount', title: 'Orders' },
        { id: 'avgPrice', title: 'Avg Price' }
      ]
    });

    const records = products.map(p => ({
      date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
      productId: p.productId || '',
      productName: p.product?.titulo || 'N/A',
      unitsSold: p.unitsSold || 0,
      revenue: p.revenue || 0,
      printfulCost: p.printfulCost || 0,
      profit: p.profit || 0,
      margin: p.margin || 0,
      orderCount: p.orderCount || 0,
      avgPrice: p.avgPrice || 0
    }));

    await csvWriter.writeRecords(records);
    return filepath;

  } catch (error) {
    console.error('Error exportando productos a CSV:', error);
    throw error;
  }
}

/**
 * Exporta analytics de productos a Excel
 * @param {Array} products - Array de productos con analytics
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportProductsToExcel(products, filename = 'products.xlsx') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products Analytics');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Product ID', key: 'productId', width: 12 },
      { header: 'Product Name', key: 'productName', width: 40 },
      { header: 'Units Sold', key: 'unitsSold', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 12 },
      { header: 'Printful Cost', key: 'printfulCost', width: 15 },
      { header: 'Profit', key: 'profit', width: 12 },
      { header: 'Margin (%)', key: 'margin', width: 12 },
      { header: 'Orders', key: 'orderCount', width: 10 },
      { header: 'Avg Price', key: 'avgPrice', width: 12 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    // Agregar datos
    products.forEach(p => {
      worksheet.addRow({
        date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
        productId: p.productId || '',
        productName: p.product?.titulo || 'N/A',
        unitsSold: p.unitsSold || 0,
        revenue: p.revenue || 0,
        printfulCost: p.printfulCost || 0,
        profit: p.profit || 0,
        margin: p.margin || 0,
        orderCount: p.orderCount || 0,
        avgPrice: p.avgPrice || 0
      });
    });

    // Formato de números
    worksheet.getColumn('revenue').numFmt = '€#,##0.00';
    worksheet.getColumn('printfulCost').numFmt = '€#,##0.00';
    worksheet.getColumn('profit').numFmt = '€#,##0.00';
    worksheet.getColumn('margin').numFmt = '0.00"%"';
    worksheet.getColumn('avgPrice').numFmt = '€#,##0.00';

    await workbook.xlsx.writeFile(filepath);
    return filepath;

  } catch (error) {
    console.error('Error exportando productos a Excel:', error);
    throw error;
  }
}

/**
 * Exporta reporte de costos a Excel con múltiples sheets
 * @param {Object} costsData - Datos de costos estructurados
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportCostsReport(costsData, filename = 'costs_report.xlsx') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Resumen de costos
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC000' }
    };

    summarySheet.addRows([
      { metric: 'Total Costs', value: costsData.totalCosts || 0 },
      { metric: 'Total Shipping', value: costsData.totalShipping || 0 },
      { metric: 'Total Tax', value: costsData.totalTax || 0 },
      { metric: 'Orders Processed', value: costsData.ordersProcessed || 0 },
      { metric: 'Webhooks Analyzed', value: costsData.webhooksAnalyzed || 0 }
    ]);

    summarySheet.getColumn('value').numFmt = '€#,##0.00';

    // Sheet 2: Costos por orden
    if (costsData.orderCosts && Object.keys(costsData.orderCosts).length > 0) {
      const ordersSheet = workbook.addWorksheet('Orders');
      ordersSheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Total Cost', key: 'cost', width: 15 },
        { header: 'Shipping', key: 'shipping', width: 15 },
        { header: 'Tax', key: 'tax', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Items Count', key: 'itemsCount', width: 12 }
      ];

      ordersSheet.getRow(1).font = { bold: true };
      ordersSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }
      };

      Object.entries(costsData.orderCosts).forEach(([orderId, data]) => {
        ordersSheet.addRow({
          orderId,
          cost: data.cost || 0,
          shipping: data.shipping || 0,
          tax: data.tax || 0,
          currency: data.currency || 'EUR',
          itemsCount: data.items?.length || 0
        });
      });

      ordersSheet.getColumn('cost').numFmt = '€#,##0.00';
      ordersSheet.getColumn('shipping').numFmt = '€#,##0.00';
      ordersSheet.getColumn('tax').numFmt = '€#,##0.00';
    }

    // Sheet 3: Costos por producto
    if (costsData.productCosts && Object.keys(costsData.productCosts).length > 0) {
      const productsSheet = workbook.addWorksheet('Products');
      productsSheet.columns = [
        { header: 'Product ID', key: 'productId', width: 15 },
        { header: 'Total Cost', key: 'cost', width: 15 }
      ];

      productsSheet.getRow(1).font = { bold: true };
      productsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }
      };

      Object.entries(costsData.productCosts).forEach(([productId, cost]) => {
        productsSheet.addRow({
          productId,
          cost
        });
      });

      productsSheet.getColumn('cost').numFmt = '€#,##0.00';
    }

    await workbook.xlsx.writeFile(filepath);
    return filepath;

  } catch (error) {
    console.error('Error exportando reporte de costos:', error);
    throw error;
  }
}

/**
 * Exporta reporte de órdenes fallidas
 * @param {Array} failedOrders - Array de órdenes fallidas
 * @param {string} filename - Nombre del archivo
 * @returns {string} Path del archivo generado
 */
export async function exportFailedOrdersReport(failedOrders, filename = 'failed_orders.xlsx') {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filepath = path.join(exportDir, filename);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Failed Orders');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 12 },
      { header: 'Sale ID', key: 'saleId', width: 12 },
      { header: 'Error Type', key: 'errorType', width: 20 },
      { header: 'Error Code', key: 'errorCode', width: 25 },
      { header: 'Error Message', key: 'errorMessage', width: 50 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Attempt Count', key: 'attemptCount', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Next Retry', key: 'nextRetryAt', width: 20 }
    ];

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC00000' }
    };
    worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    failedOrders.forEach(order => {
      worksheet.addRow({
        orderId: order.id || '',
        saleId: order.saleId || '',
        errorType: order.errorType || 'unknown',
        errorCode: order.errorCode || '',
        errorMessage: order.errorMessage || '',
        status: order.status || '',
        attemptCount: order.attemptCount || 0,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : '',
        nextRetryAt: order.nextRetryAt ? new Date(order.nextRetryAt).toISOString() : ''
      });
    });

    await workbook.xlsx.writeFile(filepath);
    return filepath;

  } catch (error) {
    console.error('Error exportando reporte de órdenes fallidas:', error);
    throw error;
  }
}

/**
 * Limpia archivos de exportación antiguos (más de X días)
 * @param {number} days - Días de retención
 * @returns {number} Archivos eliminados
 */
export async function cleanOldExports(days = 7) {
  try {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      return 0;
    }

    const files = fs.readdirSync(exportDir);
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (const file of files) {
      const filepath = path.join(exportDir, file);
      const stats = fs.statSync(filepath);

      if (stats.isFile() && stats.mtimeMs < cutoffDate) {
        fs.unlinkSync(filepath);
        deleted++;
      }
    }

    console.log(`🗑️  Limpiados ${deleted} archivos de exportación antiguos`);
    return deleted;

  } catch (error) {
    console.error('Error limpiando exportaciones antiguas:', error);
    return 0;
  }
}
