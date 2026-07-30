// ==========================================
// CONFIGURACIÓN DE THRESHOLDS
// ==========================================

/**
 * MVP Analytics Configuration
 *
 * Umbrales compartidos por recomendaciones, alertas
 * y criterios del motor de validación.
 */
const DECISION_THRESHOLDS = {
  // Mínimos para análisis
  min_sessions_to_analyze: 10,
  min_days_to_analyze: 3,
  
  // Crear módulo formal
  create_module_score: 70,
  create_module_downloads: 50,
  create_module_feedback_rate: 80,
  
  // Archivar MVP
  archive_score: 40,
  archive_min_sessions: 20,
  
  // Alertas
  alert_high_abandonment: 50, // % abandono en step
  alert_low_feedback_rate: 60,
  alert_feedback_decline: 15 // % decline vs prev period
};

export {
  DECISION_THRESHOLDS
};