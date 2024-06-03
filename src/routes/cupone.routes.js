import { Router } from "express";
import auth from '../middlewares/auth.js';
import { 
    register,
    config,
    update,
    list,
    show,
    remove,
} from "../controllers/cupones.controller.js";

const router = Router();

router.post("/register", auth.verifyAdmin, register);
router.put("/update", auth.verifyAdmin, update);
router.get("/list", auth.verifyAdmin, list);
router.get("/config", auth.verifyAdmin, config);
router.get("/show", auth.verifyAdmin, show);
router.delete("/delete", auth.verifyAdmin, remove);


export default router;