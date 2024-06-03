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
} from "../controllers/users.controller.js";

const router = Router();

router.post( '/register', register);
router.post( '/register_admin', auth.verifyAdmin, register_admin);
router.put( '/update', update);
router.get( '/list', auth.verifyAdmin, list);
router.post( '/login', login );
router.post( '/login_admin', login_admin);
router.delete("/delete", remove);

export default router;