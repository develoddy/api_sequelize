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

const router = Router();

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

// Webhook routes (⚠️ Sin autenticación - Printful necesita acceso público)
router.post("/webhook", handleWebhook);
router.get("/webhook/logs", auth.verifyEcommerce, getWebhookLogs);
router.get("/webhook/stats", auth.verifyEcommerce, getWebhookStats);

export default router;