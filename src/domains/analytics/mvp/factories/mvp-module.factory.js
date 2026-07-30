import { capitalize } from '../../../../utils/string.utils.js';

/**
 * Obtener el nombre base del concepto eliminando sufijos de fase.
 */
function getConceptName(moduleKey) {
  if (moduleKey.endsWith('-landing')) {
    return moduleKey.replace('-landing', '');
  }

  if (moduleKey.endsWith('-wizard')) {
    return moduleKey.replace('-wizard', '');
  }

  return moduleKey;
}

/**
 * Construir la configuración de preview de un módulo.
 */
function createPreviewConfig(moduleKey) {
  return {
    enabled: true,
    route: `/preview/${moduleKey}`,
    public_endpoint: `/api/${moduleKey}/preview`,
    show_in_store: true,
    demo_button_text: 'Try Demo - No signup required',
    generator_function: `generate${capitalize(moduleKey)}Preview`,
    conversion_config: {
      recovery_key: `${moduleKey}_preview`,
      redirect_route: `/${moduleKey}/onboarding`,
      auto_activate: true
    },
    rate_limiting: {
      max_requests: 10,
      window_minutes: 15
    }
  };
}

/**
 * Construir los datos necesarios para crear un módulo desde un MVP.
 */
function createModuleDataFromMVP({
  moduleKey,
  analytics,
  autoActivate = false,
  copyPreviewConfig = true,
  initialStatus = 'testing'
}) {
  return {
    key: moduleKey,
    name: capitalize(moduleKey.replace(/-/g, ' ')),
    description: `Validated MVP - ${analytics.totalSessions} sessions, ${analytics.healthScore} score`,
    type: 'saas',
    concept_name: getConceptName(moduleKey),
    status: initialStatus,
    is_active: autoActivate,
    validation_days: 14,
    validation_target_sales: 1,
    icon: 'fa-rocket',
    color: 'primary',
    preview_config: copyPreviewConfig
      ? createPreviewConfig(moduleKey)
      : null,
    base_price: null,
    tagline: `Validated with ${analytics.helpful_rate}% positive feedback`
  };
}

export {
  createModuleDataFromMVP
};