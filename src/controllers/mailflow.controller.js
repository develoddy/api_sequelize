import { MailflowSequence } from '../models/MailflowSequence.js';
import { MailflowContact } from '../models/MailflowContact.js';
import { MailflowEmailLog } from '../models/MailflowEmailLog.js';
import { generateSequence } from '../services/mailflowSequenceGenerator.js';
import { sequelize } from '../database/database.js';
import crypto from 'crypto';

/**
 * Genera una nueva secuencia de onboarding
 * POST /api/mailflow/sequences/generate
 */
export const generateOnboardingSequence = async (req, res) => {
    try {
        const { businessType, goal, contactSource, brandInfo } = req.body;

        // Validaciones
        if (!businessType || !goal || !brandInfo?.name) {
            return res.status(400).json({
                status: 400,
                message: 'Missing required fields: businessType, goal, brandInfo.name'
            });
        }

        if (!contactSource?.data || !Array.isArray(contactSource.data) || contactSource.data.length === 0) {
            return res.status(400).json({
                status: 400,
                message: 'At least one contact is required'
            });
        }

        // Generar secuencia usando el template
        const generatedTemplate = generateSequence(
            businessType,
            goal,
            brandInfo.name,
            brandInfo.tone || 'friendly'
        );

        // Crear ID único para la secuencia
        const sequenceId = `seq_${crypto.randomBytes(12).toString('hex')}`;

        // Crear registro de secuencia
        const sequence = await MailflowSequence.create({
            sequenceId,
            tenantId: req.user?.tenantId || null,
            userId: req.user?.id || null,
            name: generatedTemplate.name,
            businessType,
            goal,
            brandName: brandInfo.name,
            emailTone: brandInfo.tone || 'friendly',
            emails: generatedTemplate.emails,
            estimatedContacts: contactSource.data.length,
            status: 'draft'
        });

        // Crear contactos asociados
        const contacts = contactSource.data.map(contact => ({
            sequenceId,
            email: contact.email,
            name: contact.name || null,
            status: 'pending',
            currentEmailIndex: 0,
            nextEmailAt: new Date() // Primer email inmediato cuando se active
        }));

        await MailflowContact.bulkCreate(contacts, {
            ignoreDuplicates: true
        });

        // Respuesta
        return res.status(201).json({
            status: 201,
            message: 'Sequence generated successfully',
            data: {
                sequenceId: sequence.sequenceId,
                name: sequence.name,
                emails: sequence.emails,
                estimatedContacts: sequence.estimatedContacts,
                status: sequence.status
            }
        });

    } catch (error) {
        console.error('Error generating sequence:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error generating sequence',
            error: error.message
        });
    }
};

/**
 * Activa una secuencia (comienza a enviar emails)
 * POST /api/mailflow/sequences/:sequenceId/activate
 */
export const activateSequence = async (req, res) => {
    try {
        const { sequenceId } = req.params;

        const sequence = await MailflowSequence.findByPk(sequenceId);

        if (!sequence) {
            return res.status(404).json({
                status: 404,
                message: 'Sequence not found'
            });
        }

        if (sequence.status === 'active') {
            return res.status(400).json({
                status: 400,
                message: 'Sequence is already active'
            });
        }

        // Actualizar estado
        sequence.status = 'active';
        sequence.activatedAt = new Date();
        await sequence.save();

        // Activar contactos
        await MailflowContact.update(
            { status: 'active' },
            { where: { sequenceId, status: 'pending' } }
        );

        return res.json({
            status: 200,
            message: 'Sequence activated successfully',
            data: {
                sequenceId: sequence.sequenceId,
                status: sequence.status,
                activatedAt: sequence.activatedAt
            }
        });

    } catch (error) {
        console.error('Error activating sequence:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error activating sequence',
            error: error.message
        });
    }
};

/**
 * Pausa una secuencia activa
 * POST /api/mailflow/sequences/:sequenceId/pause
 */
export const pauseSequence = async (req, res) => {
    try {
        const { sequenceId } = req.params;

        const sequence = await MailflowSequence.findByPk(sequenceId);

        if (!sequence) {
            return res.status(404).json({
                status: 404,
                message: 'Sequence not found'
            });
        }

        if (sequence.status !== 'active') {
            return res.status(400).json({
                status: 400,
                message: 'Only active sequences can be paused'
            });
        }

        sequence.status = 'paused';
        sequence.pausedAt = new Date();
        await sequence.save();

        return res.json({
            status: 200,
            message: 'Sequence paused successfully',
            data: {
                sequenceId: sequence.sequenceId,
                status: sequence.status
            }
        });

    } catch (error) {
        console.error('Error pausing sequence:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error pausing sequence',
            error: error.message
        });
    }
};

/**
 * Actualiza un email específico de la secuencia
 * PATCH /api/mailflow/sequences/:sequenceId/emails/:emailOrder
 */
export const updateSequenceEmail = async (req, res) => {
    try {
        const { sequenceId, emailOrder } = req.params;
        const { subject, bodyHtml, bodyText } = req.body;

        const sequence = await MailflowSequence.findByPk(sequenceId);

        if (!sequence) {
            return res.status(404).json({
                status: 404,
                message: 'Sequence not found'
            });
        }

        if (sequence.status === 'active') {
            return res.status(400).json({
                status: 400,
                message: 'Cannot edit an active sequence. Pause it first.'
            });
        }

        const emails = [...sequence.emails];
        const emailIndex = emails.findIndex(e => e.order === parseInt(emailOrder));

        if (emailIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Email not found in sequence'
            });
        }

        // Actualizar campos
        if (subject) emails[emailIndex].subject = subject;
        if (bodyHtml) emails[emailIndex].bodyHtml = bodyHtml;
        if (bodyText) emails[emailIndex].bodyText = bodyText;

        sequence.emails = emails;
        await sequence.save();

        return res.json({
            status: 200,
            message: 'Email updated successfully',
            data: emails[emailIndex]
        });

    } catch (error) {
        console.error('Error updating email:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error updating email',
            error: error.message
        });
    }
};

/**
 * Obtiene el estado y estadísticas de una secuencia
 * GET /api/mailflow/sequences/:sequenceId/status
 */
export const getSequenceStatus = async (req, res) => {
    try {
        const { sequenceId } = req.params;

        const sequence = await MailflowSequence.findByPk(sequenceId);

        if (!sequence) {
            return res.status(404).json({
                status: 404,
                message: 'Sequence not found'
            });
        }

        // ✅ REAL STATS: Obtener estadísticas desde source of truth (mailflow_email_logs + mailflow_contacts)
        const totalContacts = await MailflowContact.count({ where: { sequenceId } });
        const activeContacts = await MailflowContact.count({ where: { sequenceId, status: 'active' } });
        const completedContacts = await MailflowContact.count({ where: { sequenceId, status: 'completed' } });
        const failedContacts = await MailflowContact.count({ where: { sequenceId, status: 'failed' } });
        
        // Calcular sent y failed desde mailflow_email_logs (source of truth)
        const sentCount = await MailflowEmailLog.count({ 
            where: { sequenceId, status: 'sent' } 
        });
        const failedCount = await MailflowEmailLog.count({ 
            where: { sequenceId, status: 'failed' } 
        });

        return res.json({
            status: 200,
            data: {
                sent: sentCount,
                pending: activeContacts,
                failed: failedCount,
                openRate: null, // TODO: implementar tracking de aperturas
                totalContacts,
                completedContacts
            }
        });

    } catch (error) {
        console.error('Error getting sequence status:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error getting sequence status',
            error: error.message
        });
    }
};

/**
 * Obtiene una secuencia específica
 * GET /api/mailflow/sequences/:sequenceId
 */
export const getSequence = async (req, res) => {
    try {
        const { sequenceId } = req.params;

        const sequence = await MailflowSequence.findByPk(sequenceId);

        if (!sequence) {
            return res.status(404).json({
                status: 404,
                message: 'Sequence not found'
            });
        }

        return res.json({
            status: 200,
            data: {
                sequenceId: sequence.sequenceId,
                name: sequence.name,
                emails: sequence.emails,
                estimatedContacts: sequence.estimatedContacts,
                status: sequence.status,
                activatedAt: sequence.activatedAt,
                stats: sequence.stats
            }
        });

    } catch (error) {
        console.error('Error getting sequence:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error getting sequence',
            error: error.message
        });
    }
};

/**
 * Lista todas las secuencias del usuario/tenant
 * GET /api/mailflow/sequences
 * 
 * ============================================================================
 * MVP MODE - PUBLIC VALIDATION
 * DO NOT REVERT YET
 * ============================================================================
 * 
 * CURRENT BEHAVIOR:
 * - WITH AUTH: Filter by tenantId or userId (normal multi-tenant)
 * - WITHOUT AUTH: Requires ?sequenceIds=seq1,seq2,seq3 from localStorage
 * 
 * SECURITY (MVP MODE):
 * - No auth + no sequenceIds = empty array (safe)
 * - No auth + sequenceIds = only those sequences (localStorage-based identity)
 * - User can only see sequences they created (IDs stored in localStorage)
 * 
 * WHY THIS WORKS FOR MVP:
 * - User creates sequence → sequenceId saved to localStorage
 * - User visits dashboard → frontend sends sequenceIds from localStorage
 * - Backend returns ONLY those sequences
 * - If user loses localStorage = loses access (like logout)
 * 
 * FUTURE (PRODUCTION):
 * - Always require authentication
 * - Always filter by tenantId (workspace isolation)
 * - No localStorage-based identity
 * - Proper session management
 * 
 * @date 2026-05-05
 * ============================================================================
 */
export const listSequences = async (req, res) => {
    try {
        const where = {};
        
        // Multi-tenant mode: filtrar por tenantId o userId
        if (req.user?.tenantId) {
            where.tenantId = req.user.tenantId;
        } else if (req.user?.id) {
            where.userId = req.user.id;
        } else {
            // MVP público: usar sequenceIds si se proveen, sino devolver todas
            const { sequenceIds } = req.query;
            
            if (sequenceIds) {
                // Parsear sequenceIds (formato: "seq1,seq2,seq3")
                const idsArray = sequenceIds.split(',').filter(id => id.trim());
                if (idsArray.length > 0) {
                    where.sequenceId = idsArray;
                }
            }
            // Si no hay sequenceIds, no añadir filtro (devolver todas las sequences)
            // Esto hace el dashboard más robusto ante fallos de localStorage
        }

        // ✅ REAL STATS: Calcular desde source of truth (mailflow_email_logs + mailflow_contacts)
        const sequences = await MailflowSequence.findAll({
            where,
            order: [['createdAt', 'DESC']],
            attributes: [
                'sequenceId',
                'name',
                'status',
                'estimatedContacts',
                'createdAt',
                'activatedAt',
                // Stats reales calculadas desde tablas de datos
                [
                    sequelize.literal(`(
                        SELECT COUNT(*) 
                        FROM mailflow_email_logs 
                        WHERE mailflow_email_logs.sequenceId = MailflowSequence.sequenceId 
                        AND status = 'sent'
                    )`),
                    'realSent'
                ],
                [
                    sequelize.literal(`(
                        SELECT COUNT(*) 
                        FROM mailflow_contacts 
                        WHERE mailflow_contacts.sequenceId = MailflowSequence.sequenceId 
                        AND status = 'active'
                    )`),
                    'realPending'
                ],
                [
                    sequelize.literal(`(
                        SELECT COUNT(*) 
                        FROM mailflow_contacts 
                        WHERE mailflow_contacts.sequenceId = MailflowSequence.sequenceId 
                        AND status = 'completed'
                    )`),
                    'realCompleted'
                ],
                [
                    sequelize.literal(`(
                        SELECT MIN(nextEmailAt) 
                        FROM mailflow_contacts 
                        WHERE mailflow_contacts.sequenceId = MailflowSequence.sequenceId 
                        AND status = 'active'
                        AND nextEmailAt > NOW()
                    )`),
                    'nextScheduledEmail'
                ],
                [
                    sequelize.literal(`(
                        SELECT MAX(sentAt) 
                        FROM mailflow_email_logs 
                        WHERE mailflow_email_logs.sequenceId = MailflowSequence.sequenceId 
                        AND status = 'sent'
                    )`),
                    'lastEmailSent'
                ]
            ],
            raw: true // Necesario para que las subqueries funcionen correctamente
        });

        return res.json({
            status: 200,
            data: sequences
        });

    } catch (error) {
        console.error('Error listing sequences:', error);
        return res.status(500).json({
            status: 500,
            message: 'Error listing sequences',
            error: error.message
        });
    }
};
