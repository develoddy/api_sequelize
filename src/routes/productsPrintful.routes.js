import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';

import { 
    list,
    show,
    getPrintfulProducts,
} from "../controllers/proveedor/printful/productPrintful.controller.js";

const router = Router();

router.get("/list", auth.verifyEcommerce, list);
router.post("/show/:id", auth.verifyEcommerce, show);
//router.get("/synProducts", auth.verifyEcommerce, getPrintfulProducts);


export default router;