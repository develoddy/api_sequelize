import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
} from "../controllers/sale.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);

export default router;