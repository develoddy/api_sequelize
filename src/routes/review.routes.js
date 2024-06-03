/*
import routerx from "express-promise-router";
import reviewClientController from "../controllers/ReviewClientController";
import auth from '../middlewares/auth';

const router = routerx();

router.post("/register", auth.verifyEcommerce, reviewClientController.register);
router.put("/update", auth.verifyEcommerce, reviewClientController.update);
export default router;
*/


import { Router } from "express";
import auth from '../middlewares/auth.js';
import { 
	register,
	update,
} from "../controllers/review.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);
router.put("/update", auth.verifyEcommerce, update);

export default router;