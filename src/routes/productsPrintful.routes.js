import { Router } from "express";
import auth from '../middlewares/auth.js';

import { 
    list,
    show,
    getDashboardStats,
} from "../controllers/proveedor/printful/productPrintful.controller.js";

import {
    getOrders,
    getOrderById,
    syncOrderStatus,
    cancelOrder,
    retryOrder,
    getOrderShipments,
    estimateOrderCosts
} from "../controllers/proveedor/printful/orderPrintful.controller.js";

import {
    getFinancialStats,
    getProductsRanking,
    getTimeline
} from "../controllers/proveedor/printful/analyticsPrintful.controller.js";

import {
    calculateShippingRates,
    getShippingCountries,
    getCountryStates
} from "../controllers/proveedor/printful/shippingPrintful.controller.js";

import {
    syncStock,
    getDiscontinuedProducts,
    getPriceChanges,
    updateProduct,
    getStockStats
} from "../controllers/proveedor/printful/stockSyncPrintful.controller.js";

import {
    handleWebhook,
    getWebhookLogs,
    getWebhookStats
} from "../controllers/proveedor/printful/webhookPrintful.controller.js";

import {
    syncOrderToPrintful
} from "../controllers/proveedor/printful/autoSyncPrintful.controller.js";

import {
    createTestReceipt,
    updateReceiptStatus
} from "../controllers/helpers/testReceipt.controller.js";

import {
    createTestSale
} from "../controllers/helpers/testSale.controller.js";

import {
    resetTestSale
} from "../controllers/helpers/resetSale.controller.js";

import {
    runRetryQueueNow
} from "../cron/cronJobs.js";

import {
    testSendShippedEmail,
    testSimulatePackageShipped,
    testSendPrintingEmail,
    testSimulateOrderCreated,
    testSendSyncFailedAlert,
    testSimulateOrderFailed,
    testSendDeliveredEmail,
    testSendDailyReport
} from "../controllers/helpers/testEmailNotifications.controller.js";

import {
    getFailedOrders,
    getRetryLogs,
    retryFailedOrder,
    cancelRetryJob,
    editAndRetry,
    getRetryStats
} from "../controllers/proveedor/adminRetry.controller.js";

const router = Router();

// Test endpoint para el frontend
router.get("/test", (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Printful', 
        timestamp: new Date().toISOString(),
        message: 'Printful service is operational' 
    });
});

// Product routes
router.get("/list", auth.verifyEcommerce, list);
router.get("/show/:id", auth.verifyEcommerce, show);
router.get("/dashboard-stats", auth.verifyEcommerce, getDashboardStats);

// Order routes
router.get("/orders", auth.verifyEcommerce, getOrders);
router.get("/orders/:id", auth.verifyEcommerce, getOrderById);
router.get("/orders/:id/sync", auth.verifyEcommerce, syncOrderStatus);
router.delete("/orders/:id", auth.verifyEcommerce, cancelOrder);
router.post("/orders/:id/retry", auth.verifyEcommerce, retryOrder);
router.get("/orders/:id/shipments", auth.verifyEcommerce, getOrderShipments);
router.post("/orders/estimate-costs", auth.verifyEcommerce, estimateOrderCosts);

// 🆕 AUTO-SYNC: Receipt → Sale → Printful (temporalmente sin auth para testing)
router.post("/sync-order", syncOrderToPrintful);

// Analytics routes
router.get("/analytics/financial", auth.verifyEcommerce, getFinancialStats);
router.get("/analytics/products", auth.verifyEcommerce, getProductsRanking);
router.get("/analytics/timeline", auth.verifyEcommerce, getTimeline);

// Shipping routes
router.post("/shipping/rates", auth.verifyEcommerce, calculateShippingRates);
router.get("/shipping/countries", auth.verifyEcommerce, getShippingCountries);
router.get("/shipping/countries/:code/states", auth.verifyEcommerce, getCountryStates);

// Stock Sync routes
router.get("/stock/sync", auth.verifyEcommerce, syncStock);
router.get("/stock/discontinued", auth.verifyEcommerce, getDiscontinuedProducts);
router.get("/stock/price-changes", auth.verifyEcommerce, getPriceChanges);
router.post("/stock/update/:id", auth.verifyEcommerce, updateProduct);
router.get("/stock/stats", auth.verifyEcommerce, getStockStats);

// 🧪 TEST ENDPOINTS (temporales - eliminar en producción)
router.post("/test/create-sale", createTestSale);
router.post("/test/create-receipt", createTestReceipt);
router.put("/test/receipt/:id/status", updateReceiptStatus);
router.post("/test/reset-sale", resetTestSale);

// 🧪 TEST EMAIL NOTIFICATIONS (Sprint 6B)
router.post("/test/send-shipped-email", testSendShippedEmail);
router.post("/test/simulate-package-shipped", testSimulatePackageShipped);
router.post("/test/send-printing-email", testSendPrintingEmail);
router.post("/test/simulate-order-created", testSimulateOrderCreated);
router.post("/test/send-sync-failed-alert", testSendSyncFailedAlert);
router.post("/test/simulate-order-failed", testSimulateOrderFailed);
router.post("/test/send-delivered-email", testSendDeliveredEmail);
router.post("/test/send-daily-report", testSendDailyReport);

// 🧪 TEST RETRY QUEUE (Sprint 6D)
router.post("/test/run-retry-queue", async (req, res) => {
  try {
    const result = await runRetryQueueNow();
    res.json({
      success: true,
      message: 'Retry queue ejecutado manualmente',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error ejecutando retry queue',
      error: error.message
    });
  }
});

router.get("/test/retry-stats", async (req, res) => {
  try {
    const { getRetryStats } = await import("../controllers/proveedor/adminRetry.controller.js");
    await getRetryStats(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo stats',
      error: error.message
    });
  }
});

router.get("/test/failed-orders", async (req, res) => {
  try {
    const { getFailedOrders } = await import("../controllers/proveedor/adminRetry.controller.js");
    await getFailedOrders(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo failed orders',
      error: error.message
    });
  }
});

// Webhook routes (⚠️ Sin autenticación - Printful necesita acceso público)
router.post("/webhook", handleWebhook);
router.get("/webhook/logs", auth.verifyEcommerce, getWebhookLogs);
router.get("/webhook/stats", auth.verifyEcommerce, getWebhookStats);

// 🆕 ADMIN RETRY MANAGEMENT (Sprint 6D)
router.get("/admin/failed-orders", auth.verifyEcommerce, getFailedOrders);
router.get("/admin/retry-logs/:jobId", auth.verifyEcommerce, getRetryLogs);
router.post("/admin/retry/:saleId", auth.verifyEcommerce, retryFailedOrder);
router.post("/admin/cancel-job/:jobId", auth.verifyEcommerce, cancelRetryJob);
router.patch("/admin/edit-and-retry/:saleId", auth.verifyEcommerce, editAndRetry);
router.get("/admin/retry-stats", auth.verifyEcommerce, getRetryStats);

export default router;