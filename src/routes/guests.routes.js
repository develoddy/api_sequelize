import { Router } from "express";
import {
    register,
    remove,
    removeAll  // Importamos el nuevo método removeAll
} from "../controllers/guests.controller.js";

const router = Router();

// Ruta para registrar un nuevo invitado
router.post( '/register', register);

// Ruta para eliminar un invitado específico (por ID)
router.delete('/remove', remove);

// Ruta para eliminar todos los datos de los invitados y sus direcciones
router.delete('/removeAll', removeAll);  // Añadimos la nueva ruta para eliminar todos los datos de los invitados

export default router;
