import express from 'express';
import { requireTenant } from '../middlewares/tenant-auth.middleware.js';
import * as chatTenantController from '../controllers/chat/chat-tenant.controller.js';

const router = express.Router();

/**
 * Rutas multi-tenant para Smart Chat SaaS
 * Todas requieren tenant_id en headers o token
 */

// Configuración del chat
router.get('/config', requireTenant, chatTenantController.getTenantConfig);
router.put('/config', requireTenant, chatTenantController.updateTenantConfig);

// Conversaciones
router.get('/conversations', requireTenant, chatTenantController.getTenantConversations);
router.get('/conversations/:conversationId/messages', requireTenant, chatTenantController.getTenantConversationMessages);

// Enviar mensaje como agente
router.post('/messages/send', requireTenant, chatTenantController.sendTenantMessage);

// Estadísticas
router.get('/stats', requireTenant, chatTenantController.getTenantStats);

// Gestión de agentes
router.get('/agents', requireTenant, chatTenantController.getTenantAgents);
router.post('/agents', requireTenant, chatTenantController.inviteTenantAgent);

export default router;
