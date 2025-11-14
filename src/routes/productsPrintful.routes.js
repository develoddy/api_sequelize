import { Router } from "express";
import auth from '../middlewares/auth.js';

import { 
    list,
    show,
} from "../controllers/proveedor/printful/productPrintful.controller.js";

const router = Router();

router.get("/list", auth.verifyEcommerce, list);
router.get("/show/:id", auth.verifyEcommerce, show);




export default router;