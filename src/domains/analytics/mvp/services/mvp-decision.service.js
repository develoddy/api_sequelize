import {
  markModuleAsValidated,
  archiveModuleTrackingEvents
} from '../repositories/mvp-analytics.repository.js';

const VALID_MVP_ACTIONS = [
  'continue',
  'archive',
  'validate'
];

/**
 * Comprobar si una acción MVP es válida.
 */
function isValidMVPDecisionAction(action) {
  return VALID_MVP_ACTIONS.includes(action);
}

/**
 * Ejecutar una decisión sobre un MVP.
 */
async function executeMVPDecisionAction({
  moduleKey,
  action,
  reason
}) {
  switch (action) {
    case 'validate':
      await markModuleAsValidated(moduleKey);

      return {
        validated: true,
        status: 'live',
        reason
      };

    case 'archive':
      await archiveModuleTrackingEvents(moduleKey);

      return {
        archived: true,
        reason
      };

    case 'continue':
      return {
        continue: true,
        reason
      };

    default:
      throw new Error(
        'Invalid action. Must be: continue, archive, or validate'
      );
  }
}

export {
  isValidMVPDecisionAction,
  executeMVPDecisionAction
};