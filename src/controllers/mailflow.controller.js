import { MailflowSequence } from '../models/MailflowSequence.js';
import { MailflowContact } from '../models/MailflowContact.js';
import { generateSequence } from '../services/mailflowSequenceGenerator.js';
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

        // Obtener estadísticas de contactos
        const totalContacts = await MailflowContact.count({ where: { sequenceId } });
        const activeContacts = await MailflowContact.count({ where: { sequenceId, status: 'active' } });
        const completedContacts = await MailflowContact.count({ where: { sequenceId, status: 'completed' } });
        const failedContacts = await MailflowContact.count({ where: { sequenceId, status: 'failed' } });

        return res.json({
            status: 200,
            data: {
                sent: sequence.stats.sent || 0,
                pending: activeContacts,
                failed: sequence.stats.failed || 0,
                openRate: sequence.stats.opened && sequence.stats.sent 
                    ? (sequence.stats.opened / sequence.stats.sent * 100).toFixed(2) 
                    : null,
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
 */
export const listSequences = async (req, res) => {
    try {
        const where = {};
        
        if (req.user?.tenantId) {
            where.tenantId = req.user.tenantId;
        } else if (req.user?.id) {
            where.userId = req.user.id;
        }

        const sequences = await MailflowSequence.findAll({
            where,
            order: [['createdAt', 'DESC']],
            attributes: ['sequenceId', 'name', 'status', 'estimatedContacts', 'stats', 'createdAt', 'activatedAt']
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
