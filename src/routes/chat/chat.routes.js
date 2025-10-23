import express from 'express';
const router = express.Router();
import chatController from '../../controllers/chat/chat.controller.js';
import auth from '../../middlewares/auth.js';

// Rutas públicas
router.post('/init', chatController.initChat);
router.get('/conversation/session/:session_id', chatController.getConversationBySession);

// Rutas protegidas (requieren autenticación)
router.get('/conversations', auth.verifyEcommerce, chatController.getActiveConversations);
router.get('/conversation/:id', auth.verifyEcommerce, chatController.getConversation);
router.get('/messages/:conversation_id', auth.verifyEcommerce, chatController.getMessages);
router.post('/message', auth.verifyEcommerce, chatController.sendMessage);
router.put('/messages/read/:conversation_id', auth.verifyEcommerce, chatController.markMessagesAsRead);
router.put('/assign/:conversation_id', auth.verifyEcommerce, chatController.assignAgent);
router.put('/close/:conversation_id', auth.verifyEcommerce, chatController.closeConversation);

export default router;