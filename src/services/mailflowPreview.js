/**
 * MailFlow Preview Generator
 * 
 * Implementación específica de MailFlow para el sistema genérico de Preview Mode.
 * Registra el generador y conversor de previews para el módulo 'mailflow'.
 * 
 * Este archivo se debe importar en server.js para registrar automáticamente
 * las funciones de preview de MailFlow.
 * 
 * @module mailflow/preview
 */

import modulePreviewService from '../services/modulePreviewService.js';
import { generateSequence } from '../services/mailflowSequenceGenerator.js';
import { MailflowSequence } from '../models/MailflowSequence.js';
import { MailflowContact } from '../models/MailflowContact.js';

/**
 * Generador de preview para MailFlow
 * Crea secuencias de emails sin guardar en BD
 */
async function generateMailflowPreview(data) {
  const {
    industry = 'ecommerce',
    brandName = 'Your Brand',
    sequenceType = 'onboarding',
    goals = [],
    options = {}
  } = data;
  
  // Determinar el goal específico
  const goal = goals && goals.length > 0 ? goals[0] : 'onboarding';
  
  // Generar secuencia usando el servicio existente
  // generateSequence espera: (businessType, goal, brandName, emailTone)
  const sequence = await generateSequence(
    industry,      // businessType
    goal,          // goal
    brandName,     // brandName (string, no objeto)
    options.emailTone || 'friendly'  // emailTone
  );
  
  // Retornar preview sin guardar en BD
  return {
    sequenceName: sequence.name,
    sequenceType: goal,
    industry,
    brandName,
    emails: sequence.emails,
    stats: {
      totalEmails: sequence.emails.length,
      estimatedDuration: `${Math.ceil(sequence.emails[sequence.emails.length - 1].delayHours / 24)} days`,
      sequenceGoal: goal
    },
    // Datos adicionales para conversión
    _conversionData: {
      sequenceType: goal,
      industry,
      options
    }
  };
}

/**
 * Conversor de preview a configuración real para MailFlow
 * Guarda la secuencia en BD y la asocia al tenant
 */
async function convertMailflowPreview(previewData, tenantId, userId, options) {
  const { autoActivate = true } = options;
  
  // Crear secuencia en BD
  const sequence = await MailflowSequence.create({
    tenantId,
    userId,
    sequenceName: previewData.sequenceName,
    sequenceType: previewData.sequenceType,
    industry: previewData.industry,
    brandName: previewData.brandName,
    emails: previewData.emails,
    status: autoActivate ? 'active' : 'draft',
    isActive: autoActivate,
    emailsSent: 0,
    emailsDelivered: 0,
    emailsOpened: 0,
    emailsClicked: 0
  });
  
  // Si hay contactos pre-cargados en el preview, importarlos
  if (previewData.contacts && Array.isArray(previewData.contacts)) {
    const contactsToCreate = previewData.contacts.map(contact => ({
      sequenceId: sequence.sequenceId,
      email: contact.email,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      customFields: contact.customFields || {},
      status: 'pending',
      currentEmailOrder: 0
    }));
    
    await MailflowContact.bulkCreate(contactsToCreate);
  }
  
  return {
    success: true,
    sequenceId: sequence.sequenceId,
    sequenceName: sequence.sequenceName,
    status: sequence.status,
    totalContacts: previewData.contacts?.length || 0,
    message: autoActivate 
      ? 'MailFlow sequence created and activated successfully'
      : 'MailFlow sequence created as draft'
  };
}

/**
 * Registrar generador y conversor de MailFlow
 * Se ejecuta automáticamente al importar este módulo
 */
export function registerMailflowPreview() {
  modulePreviewService.registerPreviewGenerator('mailflow', generateMailflowPreview);
  modulePreviewService.registerPreviewConverter('mailflow', convertMailflowPreview);
  
  console.log('✅ MailFlow preview generator and converter registered');
}

// Auto-registrar al importar
registerMailflowPreview();

export default {
  generateMailflowPreview,
  convertMailflowPreview,
  registerMailflowPreview
};
