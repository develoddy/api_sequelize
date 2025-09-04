import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import {
    register,
    list,
    listone,
    remove,
    removeAll,
    update,
    setGuestUsualShippingAddress
} from "../controllers/addressGuest.controller.js";

const router = Router();

router.post("/register", register);
router.put("/update", update);
router.get("/list", list);
router.delete("/delete/:id", remove);
router.delete("/delete/:guest_id", removeAll);
router.get("/listone", listone);
router.post("/set-guest-usual-shipping-address", setGuestUsualShippingAddress);



export default router;
