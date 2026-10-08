import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';

import { 
    list,
    getGelatoProducts,
} from "../domains/commerce/integrations/gelato/controllers/productGelato.controller.js";

const router = Router();

router.get("/list", auth.verifyEcommerce, list);


export default router;