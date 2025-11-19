import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import {
    list,
    register,
    update,
    remove,
    removeAll,
    apllyCupon,
    removeCupon,
    mergeCart
} from "../controllers/carts.controller.js";

const router = Router();

router.get("/list", list);
router.post("/register", auth.verifyEcommerce, register);
router.put("/update", auth.verifyEcommerce, update);
router.delete("/delete/:id", auth.verifyEcommerce, remove);
router.delete('/delete-all/:user_id', auth.verifyEcommerce, removeAll);
router.post("/aplly_cupon", auth.verifyEcommerce, apllyCupon);
router.post("/remove_cupon", auth.verifyEcommerce, removeCupon);

router.post("/merge", auth.verifyEcommerce, mergeCart);

export default router;
