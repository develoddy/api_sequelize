import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
    list,
    remove,
    update,
} from "../controllers/addressClient.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);
router.put("/update", auth.verifyEcommerce, update);
router.get("/list", auth.verifyEcommerce, list);
router.delete("/delete/:id", auth.verifyEcommerce, remove);

export default router;