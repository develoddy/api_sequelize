import express from 'express';
import { listExperiments } from './lab.controller.js';

const router = express.Router();

// Catálogo público de experimentos de LujanDev Lab
router.get('/lab/experiments', listExperiments);

export default router;
