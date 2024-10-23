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
} from "../controllers/cartsCache.controller.js";

const router = Router();

router.get("/list", list);
router.post("/register", register);
router.put("/update", update);
router.delete("/delete/:id", remove);
router.delete('/delete-all/:isGuest', removeAll);

export default router;
