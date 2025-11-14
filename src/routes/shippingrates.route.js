import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import {
    shippingRates,
} from "../controllers/shippingrates.controller.js";

const router = Router();

router.post("/rates",shippingRates);

export default router;
