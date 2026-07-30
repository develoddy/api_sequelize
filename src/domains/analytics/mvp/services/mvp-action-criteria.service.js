/**
 * Validar criterios de acciones del motor
 * Determina qué acciones están habilitadas y por qué
 */
function validateActionCriteria(kpis, healthScore, events, moduleType = 'wizard') {
  const daysRunning = calculateDaysRunning(events);

  // Landing page (pain/demand validation)
  if (moduleType === 'landing') {
    const validationCriteria = {
      sessions_min:    kpis.totalSessions >= 20,
      completions_min: kpis.wizard_completions >= 1,   // waitlist_success
      feedback_min:    true,                            // no aplica — siempre OK
      days_min:        daysRunning >= 3,
      signal_positive: kpis.wizard_completions >= 1 || kpis.conversion_rate >= 5
    };

    const archiveCriteria = {
      sessions_min:     kpis.totalSessions >= 20,
      signal_negative:  kpis.wizard_completions === 0 && kpis.totalSessions >= 20
    };

    const canValidate = Object.values(validationCriteria).every(v => v === true);
    const canArchive  = Object.values(archiveCriteria).every(v => v === true);

    return {
      can_validate: canValidate,
      can_archive:  canArchive,
      can_continue: true,
      validation_criteria: validationCriteria,
      archive_criteria:    archiveCriteria,
      days_running:        daysRunning,
      blocking_reasons: {
        validate: !canValidate ? getBlockingReasons(validationCriteria, 'validate') : [],
        archive:  !canArchive  ? getBlockingReasons(archiveCriteria, 'archive')  : []
      }
    };
  }
  
  // 🟢 Criterios para VALIDAR MÓDULO (cambiar status a 'live')
  const validationCriteria = {
    sessions_min: kpis.totalSessions >= 20,
    completions_min: kpis.wizard_completions >= 5,
    feedback_min: kpis.total_feedback >= 5,
    days_min: daysRunning >= 3,
    // Al menos una señal positiva fuerte
    signal_positive: (
      kpis.conversion_rate >= 15 ||
      kpis.helpful_rate >= 60 ||
      kpis.retention_rate >= 20
    )
  };
  
  const canValidate = Object.values(validationCriteria).every(v => v === true);
  
  // 🔴 Criterios para ARCHIVAR
  const archiveCriteria = {
    sessions_min: kpis.totalSessions >= 15,
    // Al menos una señal negativa clara
    signal_negative: (
      (kpis.wizard_completions === 0 && kpis.wizard_starts >= 10) ||
      (kpis.helpful_rate < 30 && kpis.total_feedback >= 5) ||
      (healthScore < 40 && kpis.totalSessions >= 20)
    )
  };
  
  const canArchive = Object.values(archiveCriteria).every(v => v === true);
  
  // ⏸️ CONTINUAR siempre disponible
  const canContinue = true;
  
  return {
    can_validate: canValidate,
    can_archive: canArchive,
    can_continue: canContinue,
    validation_criteria: validationCriteria,
    archive_criteria: archiveCriteria,
    days_running: daysRunning,
    blocking_reasons: {
      validate: !canValidate ? getBlockingReasons(validationCriteria, 'validate') : [],
      archive: !canArchive ? getBlockingReasons(archiveCriteria, 'archive') : []
    }
  };
}

/**
 * Calcular días desde el primer evento
 */
function calculateDaysRunning(events) {
  if (events.length === 0) return 0;
  
  const firstEventDate = new Date(events[0].timestamp);
  const now = new Date();
  const diffMs = now - firstEventDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Obtener razones específicas del bloqueo
 */
function getBlockingReasons(criteria, actionType) {
  const reasons = [];
  
  if (actionType === 'validate') {
    if (!criteria.sessions_min) reasons.push('Minimum 20 sessions required');
    if (!criteria.completions_min) reasons.push('Minimum 5 wizard completions required');
    if (!criteria.feedback_min) reasons.push('Minimum 5 feedbacks required');
    if (!criteria.days_min) reasons.push('Minimum 3 validation days required');
    if (!criteria.signal_positive) reasons.push('Needs at least one strong positive signal (conversion ≥15% or feedback ≥60% or retention ≥20%)');
  }
  
  if (actionType === 'archive') {
    if (!criteria.sessions_min) reasons.push('Needs at least 15 sessions to confirm the pattern');
    if (!criteria.signal_negative) reasons.push('No clear negative signal strong enough to archive');
  }
  
  return reasons;
}

export {
  validateActionCriteria
};