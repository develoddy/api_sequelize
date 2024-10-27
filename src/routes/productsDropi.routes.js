import { Router } from "express";
import fs from 'fs';
//import auth from '../middlewares/auth.js';
import { 
    login_dropi,
} from "../controllers/proveedor/dropi/productDropi.controller.js";

const router = Router();

router.post( '/login-dropi', login_dropi );


export default router;