import {
  DECISION_THRESHOLDS
} from '../config/mvp-analytics.config.js';

/**
 * Generar alertas inteligentes
 */
function generateAlerts(kpis, healthScore, events, moduleType = 'wizard') {
  const alerts = [];
  
  // 🚨 Alert PRIORITARIO: Datos insuficientes
  if (kpis.insufficient_data) {
    const missingData = [];
    if (kpis.totalSessions < 5) missingData.push(`${kpis.totalSessions} sessions (min: 5)`);
    if (kpis.wizard_starts < 3) missingData.push(`${kpis.wizard_starts} wizard starts (min: 3)`);
    // Para landing: validar waitlist signups en lugar de feedbacks
    if (moduleType === 'landing') {
      const signups = kpis.landing_metrics?.waitlist_signups ?? 0;
      if (signups < 3) missingData.push(`${signups} waitlist signups (min: 3)`);
    } else {
      if (kpis.total_feedback < 3) missingData.push(`${kpis.total_feedback} feedbacks (min: 3)`);
    }
    
    alerts.push({
      type: 'warning',
      title: '📊 Insufficient Data',
      message: `MVP with low data: ${missingData.join(', ')}. KPIs may not be representative.`,
      action: 'collect_more_data',
      priority: 'high'
    });
  }
  
  // 🔧 FIX #4: Alert UX Issue - Usuarios reloading wizard múltiples veces
  if (kpis._sessions_multiple_starts && kpis._sessions_multiple_starts.count > 0) {
    const confusedRate = kpis._meta.confused_user_rate;
    if (confusedRate >= 15) { // >15% usuarios confundidos
      alerts.push({
        type: 'warning',
        title: '🔄 UX Issue Detected',
        message: `${kpis._sessions_multiple_starts.count} users (${confusedRate}%) reloaded wizard ${kpis._sessions_multiple_starts.maxReloads}+ times. Possible UX confusion or technical errors.`,
        action: 'review_wizard_ux',
        priority: 'high'
      });
    } else if (confusedRate >= 5) {
      alerts.push({
        type: 'info',
        title: '🔄 Multiple Reloads Detected',
        message: `${kpis._sessions_multiple_starts.count} users (${confusedRate}%) reloaded wizard multiple times. Monitor UX.`,
        action: 'monitor_ux',
        priority: 'medium'
      });
    }
  }
  
  // ⚠️ Alert: Inconsistent metrics (wizard starts > sessions)
  if (kpis.wizard_starts > kpis.totalSessions * 3) {
    alerts.push({
      type: 'info',
      title: '⚠️ Inconsistent Metric',
      message: `${kpis.wizard_starts} wizard starts vs ${kpis.totalSessions} sessions. Check session_id tracking.`,
      action: 'check_tracking',
      priority: 'medium'
    });
  }
  
  // ✅ Alert: Ready to validate (change to 'live')
  if (
    !kpis.insufficient_data &&
    healthScore >= DECISION_THRESHOLDS.create_module_score &&
    kpis.downloads >= DECISION_THRESHOLDS.create_module_downloads
  ) {
    alerts.push({
      type: 'success',
      title: '🎉 MVP Validated',
      message: `Ready to validate and activate! Score ${healthScore}, ${kpis.downloads} downloads.`,
      action: 'validate',
      priority: 'high'
    });
  }
  
  // ⚠️ Alert: Low conversion
  if (kpis.conversion_rate < 50 && kpis.wizard_starts >= 20) {
    alerts.push({
      type: 'warning',
      title: '⚠️ Low Conversion',
      message: `Only ${kpis.conversion_rate}% complete the wizard. Review UX.`,
      action: 'improve_ux',
      priority: 'medium'
    });
  }
  
  // ⚠️ Alert: High negative feedback
  if (kpis.helpful_rate < 60 && kpis.total_feedback >= 10) {
    alerts.push({
      type: 'warning',
      title: '😞 High Negative Feedback',
      message: `${100 - kpis.helpful_rate}% negative feedback. Improve quality.`,
      action: 'improve_quality',
      priority: 'high'
    });
  }
  
  // 🔥 Alert: High demand
  if (kpis.totalSessions > 100 && events.length > 500) {
    alerts.push({
      type: 'info',
      title: '🔥 High Demand',
      message: `${kpis.totalSessions} sessions. Big market interest.`,
      action: 'scale_up',
      priority: 'low'
    });
  }
  
  // ℹ️ Alert: Low downloads
  if (kpis.download_rate < 50 && kpis.wizard_completions >= 20) {
    alerts.push({
      type: 'info',
      title: 'ℹ️ Low Downloads',
      message: `Only ${kpis.download_rate}% download. Add more visible CTA.`,
      action: 'improve_cta',
      priority: 'low'
    });
  }
  
  // ❌ Alert: Few sessions (only if no insufficient_data alert)
  if (!kpis.insufficient_data && kpis.totalSessions < DECISION_THRESHOLDS.min_sessions_to_analyze) {
    alerts.push({
      type: 'info',
      title: '📊 Needs More Data',
      message: `Only ${kpis.totalSessions} sessions. Promote more.`,
      action: 'promote',
      priority: 'low'
    });
  }
  
  return alerts;
}

export {
  generateAlerts
};