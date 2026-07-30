/**
 * MVP KPIs Service
 *
 * Interpreta eventos de tracking y calcula las métricas principales
 * utilizadas por el motor de MVP Analytics.
 */

// ==========================================
// EVENT HELPERS
// ==========================================

/**
 * Helper: Determinar si un evento es un "inicio" según el tipo de módulo
 * 
 * @param {Object} event - Evento de tracking
 * @param {String} moduleType - 'landing' | 'wizard'
 * @returns {Boolean}
 */
function isStartEvent(event, moduleType) {
  if (moduleType === 'landing') {
    return event.event === 'prevention_demo_viewed';
  }
  return event.event.includes('wizard_started') || event.event.includes('preview_started');
}

/**
 * Helper: Determinar si un evento es una "completion" según el tipo de módulo
 * 
 * @param {Object} event - Evento de tracking
 * @param {String} moduleType - 'landing' | 'wizard'
 * @returns {Boolean}
 */
function isCompletionEvent(event, moduleType) {
  if (moduleType === 'landing') {
    return event.event === 'waitlist_success';
  }
  
  try {
    const props = JSON.parse(event.properties || '{}');
    return (
      event.event.includes('completed') && 
      (props.step === 4 || props.completed === true)
    );
  } catch {
    return false;
  }
}

/**
 * Filtrar abandonos reales (excluir reloads rápidos)
 * 
 * Lógica: Si un wizard_abandoned es seguido de wizard_started en <10 seg
 * de la MISMA sesión, fue un reload (no un abandono real).
 * 
 * @param {Array} events - Array de tracking events ordenados por timestamp
 * @param {String} moduleKey - Identificador del módulo
 * @returns {Array} - Array de eventos wizard_abandoned REALES (sin reloads)
 */
function getRealAbandonments(events, moduleType) {
  const abandonedEvents = events.filter(e => e.event === 'wizard_abandoned');
  
  return abandonedEvents.filter(abandonEvent => {
    // Buscar eventos posteriores de la misma sesión
    const sessionEvents = events.filter(e => 
      e.session_id === abandonEvent.session_id &&
      new Date(e.timestamp) > new Date(abandonEvent.timestamp)
    );
    
    // Verificar si hay wizard_started dentro de los siguientes 10 segundos usando helper
    const hasReloadAfter = sessionEvents.some(e => {
      const isStart = isStartEvent(e, moduleType);
      const timeDiff = new Date(e.timestamp) - new Date(abandonEvent.timestamp);
      const isWithin10Sec = timeDiff < 10000; // 10 segundos en ms
      
      return isStart && isWithin10Sec;
    });
    
    // Solo contar como abandono real si NO hubo reload inmediato
    return !hasReloadAfter;
  });
}

/**
 * Detectar sesiones con múltiples wizard_starts (UX issue indicator)
 * 
 * Si un usuario reload el wizard 3+ veces, puede indicar:
 * - Confusión con la UX
 * - Errores técnicos
 * - Expectativas no cumplidas
 * 
 * @param {Array} events - Array de tracking events
 * @param {String} moduleKey - Identificador del módulo
 * @returns {Object} - { count: número de sesiones afectadas, maxReloads: máximo de reloads }
 */
function detectMultipleStarts(events, moduleType) {
  const wizardStartEvents = events.filter(e => isStartEvent(e, moduleType));
  
  // Agrupar por sesión
  const startsBySession = {};
  wizardStartEvents.forEach(e => {
    if (e.session_id) {
      startsBySession[e.session_id] = (startsBySession[e.session_id] || 0) + 1;
    }
  });
  
  // Contar sesiones con 3+ starts (threshold para UX issue)
  const sessionsWithMultipleStarts = Object.entries(startsBySession)
    .filter(([sessionId, count]) => count >= 3);
  
  const maxReloads = sessionsWithMultipleStarts.length > 0
    ? Math.max(...sessionsWithMultipleStarts.map(([_, count]) => count))
    : 0;
  
  return {
    count: sessionsWithMultipleStarts.length,
    maxReloads,
    sessions: sessionsWithMultipleStarts.map(([sessionId, count]) => ({
      session_id: sessionId,
      reload_count: count
    }))
  };
}


// ==========================================
// KPI CALCULATION
// ==========================================
/**
 * Calcular KPIs de eventos
 */
function calculateKPIs(events, moduleType) {
  // Sesiones únicas (filtrar nulls/undefined)
  const sessionIds = events.map(e => e.session_id).filter(Boolean);
  const uniqueSessions = sessionIds.length > 0 ? new Set(sessionIds).size : 0;
  
  // � DEBUG: Log KPIs calculation
  console.log(`📊 KPIs Calculation (${moduleType}):`);
  console.log(`   - Total events received: ${events.length}`);
  console.log(`   - Unique sessions calculated: ${uniqueSessions}`);
  
  // �🔧 FIX #1: Usuarios únicos = sesiones únicas para tráfico anónimo
  // IMPORTANTE: user_id solo se llena cuando hay login (usuarios autenticados)
  // Para MVPs con tráfico público/anónimo, session_id es el identificador correcto
  // Cada session_id = 1 usuario único (aunque no esté autenticado)
  const userIds = events.map(e => e.user_id).filter(Boolean);
  const uniqueUsers = uniqueSessions;
  
  // 🔧 FIX #1: Deduplicar wizard_starts por sesión (eliminar reloads)
  // En vez de contar eventos, contar sesiones únicas que iniciaron wizard
  // Usar helper isStartEvent para reconocer diferentes tipos de módulos
  const wizardStartEvents = events.filter(e => isStartEvent(e, moduleType));
  const uniqueWizardStarts = new Set(
    wizardStartEvents.map(e => e.session_id).filter(Boolean)
  ).size;
  const wizardStarts = uniqueWizardStarts || wizardStartEvents.length; // Fallback si no hay session_id
  
  // Usar helper isCompletionEvent para reconocer diferentes tipos de módulos
  const wizardCompletions = events.filter(e => isCompletionEvent(e, moduleType)).length;
  
  // ✅ Downloads: solo eventos explícitos de descarga (NO contar 'generated')
  const downloads = events.filter(e => 
    e.event.includes('download') && !e.event.includes('generated')
  ).length;
  
  // Feedback
  const feedbackEvents = events.filter(e => 
    e.event.includes('feedback')
  );
  
  const helpfulFeedback = feedbackEvents.filter(e => {
    try {
      const props = JSON.parse(e.properties || '{}');
      return props.helpful === true;
    } catch {
      return false;
    }
  }).length;
  
  // Objetivos (específico para video-express)
  const objectiveEvents = events.filter(e => {
    try {
      const props = JSON.parse(e.properties || '{}');
      return props.objective;
    } catch {
      return false;
    }
  });
  
  const organicCount = objectiveEvents.filter(e => {
    try {
      return JSON.parse(e.properties || '{}').objective === 'organic';
    } catch {
      return false;
    }
  }).length;
  
  const adsCount = objectiveEvents.filter(e => {
    try {
      return JSON.parse(e.properties || '{}').objective === 'ads';
    } catch {
      return false;
    }
  }).length;
  
  // Tasas de conversión
  const conversion_rate = wizardStarts > 0 
    ? Math.round((wizardCompletions / wizardStarts) * 100) 
    : 0;
    
  const download_rate = wizardCompletions > 0 
    ? Math.round((downloads / wizardCompletions) * 100) 
    : 0;
    
  const feedback_rate = wizardCompletions > 0 
    ? Math.round((feedbackEvents.length / wizardCompletions) * 100) 
    : 0;
    
  const helpful_rate = feedbackEvents.length > 0 
    ? Math.round((helpfulFeedback / feedbackEvents.length) * 100) 
    : 0;
  
  // === MONETIZATION METRICS (Nuevo: Feb 2026) ===
  const monetizationIntentEvents = events.filter(e => 
    e.event === 'monetization_intent_clicked'
  );
  
  const proEmailSubmittedEvents = events.filter(e => 
    e.event === 'pro_email_submitted'
  );
  
  const proModalDismissedEvents = events.filter(e => 
    e.event === 'pro_modal_dismissed'
  );
  
  // Tasa de conversión monetización: preview → intent
  const preview_to_intent_rate = wizardCompletions > 0
    ? Math.round((monetizationIntentEvents.length / wizardCompletions) * 100)
    : 0;
  
  // Tasa de conversión monetización: intent → email
  const intent_to_email_rate = monetizationIntentEvents.length > 0
    ? Math.round((proEmailSubmittedEvents.length / monetizationIntentEvents.length) * 100)
    : 0;
  
  // Tasa de dismissal sin email
  const modal_dismissal_rate = monetizationIntentEvents.length > 0
    ? Math.round((proModalDismissedEvents.length / monetizationIntentEvents.length) * 100)
    : 0;
  
  // Usuarios recurrentes (multiple sessions)
  const sessionsByUser = {};
  events.forEach(e => {
    const id = e.user_id || e.session_id;
    if (id) {
      sessionsByUser[id] = (sessionsByUser[id] || 0) + 1;
    }
  });
  
  const returningUsers = Object.values(sessionsByUser).filter(count => count > 1).length;
  const retention_rate = uniqueSessions > 0 
    ? Math.round((returningUsers / uniqueSessions) * 100) 
    : 0;
  
  // 🔧 FIX #2: Filtrar wizard_abandoned con reload inmediato (<10 seg)
  const realAbandonments = getRealAbandonments(events, moduleType);
  
  // 🔧 FIX #3: Detectar sesiones con múltiples wizard_starts (UX issue)
  const sessionsWithMultipleStarts = detectMultipleStarts(events, moduleType);
  
  // Flag de datos insuficientes
  // ✅ FIX: Module-aware — landing pages no tienen feedback_submitted,
  // no castigar por ausencia de una métrica que no aplica al flujo.
  let insufficient_data;
  if (moduleType === 'landing') {
    // Landing page: solo validar sesiones y vistas (no feedback)
    insufficient_data = uniqueSessions < 5 || wizardStarts < 3;
  } else {
    // Wizards normales: requieren feedback
    insufficient_data = (
      uniqueSessions < 5 ||
      wizardStarts < 3 ||
      feedbackEvents.length < 3
    );
  }
  
  // === LANDING METRICS (only for module_type='landing') ===
  // Extraer métricas especializadas para prototipos/landing de validación de dolor
  let landing_metrics = null;
  if (moduleType === 'landing') {
    // 🔧 FIX: Engagement incluye múltiples tipos de interacción, no solo metric_clicked
    const engagementEvents = events.filter(e => 
      e.event === 'metric_clicked' ||           // Click en tarjetas de métricas
      e.event === 'cta_clicked' ||              // Click en CTAs de pricing
      e.event === 'faq_expanded' ||             // Expansión de FAQ
      e.event === 'chat_opened' ||              // Apertura de chat widget
      e.event === 'setup_request_submitted'     // Envío de formulario setup
    );
    const waitlistSignups = events.filter(e => e.event === 'waitlist_success').length;
    const demoViews = wizardStartEvents.length; // prevention_demo_viewed

    // 🔧 FIX: Engagement Rate = % de usuarios que hicieron al menos 1 click (max 100%)
    // No debe ser total_clicks/views porque eso puede superar 100%
    const uniqueSessionsWithClicks = new Set(
      engagementEvents.map(e => e.session_id).filter(Boolean)
    ).size;
    
    const engagement_rate = demoViews > 0 
      ? Math.round((uniqueSessionsWithClicks / demoViews) * 100) 
      : 0;
    
    // Métrica adicional: promedio de clicks por usuario (puede ser > 1)
    const avg_clicks_per_view = demoViews > 0 
      ? Math.round((engagementEvents.length / demoViews) * 10) / 10 // 1 decimal
      : 0;

    // Mapa de puntos de dolor: cuáles métricas resonaron más
    const painPointMap = {};
    engagementEvents.forEach(e => {
      try {
        const props = typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties;
        const metric = props?.metric;
        if (metric) painPointMap[metric] = (painPointMap[metric] || 0) + 1;
      } catch {}
    });

    const top_pain_points = Object.entries(painPointMap)
      .map(([metric, clicks]) => ({ metric, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    landing_metrics = {
      demo_views:          demoViews,
      engagement_clicks:   engagementEvents.length,
      engagement_rate,     // % de usuarios que hicieron al menos 1 click (max 100%)
      avg_clicks_per_view, // Promedio de pain points explorados por usuario
      waitlist_signups:    waitlistSignups,
      waitlist_conversion: demoViews > 0 ? Math.round((waitlistSignups / demoViews) * 100) : 0,
      top_pain_points
    };
  }

  return {
    totalSessions: uniqueSessions,
    uniqueUsers,
    wizard_starts: wizardStarts,
    wizard_completions: wizardCompletions,
    downloads,
    total_feedback: feedbackEvents.length,
    helpful_feedback: helpfulFeedback,
    organic_count: organicCount,
    ads_count: adsCount,
    conversion_rate,
    download_rate,
    feedback_rate,
    helpful_rate,
    retention_rate,
    returningUsers,
    insufficient_data,
    // === MONETIZATION METRICS ===
    monetization_intent_count: monetizationIntentEvents.length,
    pro_email_submitted_count: proEmailSubmittedEvents.length,
    pro_modal_dismissed_count: proModalDismissedEvents.length,
    preview_to_intent_rate,
    intent_to_email_rate,
    modal_dismissal_rate,
    // Metadata adicional para debug
    _meta: {
      total_events: events.length,
      events_with_session_id: sessionIds.length,
      events_with_user_id: userIds.length,
      unique_identifiers: Object.keys(sessionsByUser).length,
      // 🔧 FIX #3: Métricas de calidad de datos
      raw_wizard_starts: wizardStartEvents.length,
      unique_wizard_starts: uniqueWizardStarts,
      reload_events_filtered: wizardStartEvents.length - uniqueWizardStarts,
      total_abandonments: events.filter(e => e.event === 'wizard_abandoned').length,
      real_abandonments: realAbandonments.length,
      false_positive_abandonments: events.filter(e => e.event === 'wizard_abandoned').length - realAbandonments.length,
      sessions_with_multiple_starts: sessionsWithMultipleStarts.count,
      confused_user_rate: uniqueSessions > 0 ? Math.round((sessionsWithMultipleStarts.count / uniqueSessions) * 100) : 0,
      data_confidence: uniqueSessions >= 30 ? 'high' : uniqueSessions >= 10 ? 'medium' : 'low'
    },
    // Exponer abandonos reales para uso en alerts
    _abandonments: realAbandonments,
    _sessions_multiple_starts: sessionsWithMultipleStarts,
    // 🏗️ Landing-specific metrics (null para wizard modules)
    landing_metrics
  };
}

export {
    calculateKPIs
};