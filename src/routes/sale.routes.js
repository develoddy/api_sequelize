import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
    registerGuest
} from "../controllers/sale.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);
router.post("/register-guest", registerGuest);


export default router;