import { Router } from "express";
import auth from '../middlewares/auth.js';
import {
    register,
    register_admin,
    login,
    login_admin,
    list,
    update,
    remove,
    detail_user,
    requestPasswordReset,
    resetPassword
} from "../controllers/users.controller.js";

const router = Router();

router.post( '/register', register);
router.post( '/register_admin', auth.verifyAdmin, register_admin);
router.put( '/update', update);
router.get( '/list', auth.verifyAdmin, list);
router.post( '/login', login );
router.post( '/login_admin', login_admin);
router.delete("/delete", remove);
router.post( '/detail_user', auth.verifyEcommerce, detail_user );

// Ruta para solicitar un restablecimiento de contraseña
router.post('/request-reset-password', requestPasswordReset);

// Ruta para restablecer la contraseña
router.post('/reset-password', resetPassword);


export default router;
