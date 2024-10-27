import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    list,
    show_landing_product,
    profile_client,
    update_client,
    config_initial,
    search_product,
    filters_products
} from "../controllers/home.controller.js";

const router = Router();

router.get("/list", list);
router.get("/show_landing_product/:slug?", show_landing_product);
router.post("/search_product", search_product);
router.get("/config_initial", config_initial);
router.post("/profile_client", auth.verifyEcommerce, profile_client);
router.post("/update_client", auth.verifyEcommerce, update_client);
router.post("/filters_products", filters_products);


export default router;