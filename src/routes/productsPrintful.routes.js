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




export default router;