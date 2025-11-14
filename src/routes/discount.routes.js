import { Router } from "express";
import auth from '../middlewares/auth.js';
import { 
    register,
    update,
    show,
    list,
    remove,
    config,
} from "../controllers/discount.controller.js";

const router = Router();

router.post("/register", auth.verifyAdmin, register);
router.put("/update", auth.verifyAdmin, update);
router.get("/list", auth.verifyAdmin, list);
router.get("/config", auth.verifyAdmin, config);
router.get("/show", auth.verifyAdmin, show);
router.delete("/delete", auth.verifyAdmin, remove);


export default router;