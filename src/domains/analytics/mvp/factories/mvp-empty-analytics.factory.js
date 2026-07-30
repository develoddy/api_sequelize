import { capitalize } from "../../../../utils/string.utils.js";

/**
 * Construye el resultado analytics de un módulo sin eventos.
 */
function createEmptyAnalyticsResult({
  moduleKey,
  module,
  moduleType,
  period,
  dateFrom,
  dateTo,
}) {
  return {
    moduleKey,
    moduleId: module?.id || null, // 🆕 Module ID for API calls
    moduleName: module?.name || capitalize(moduleKey.replace(/-/g, " ")),
    status: module?.status || "draft",
    moduleType, // 🏗️ 'landing' | 'wizard'
    conceptName: module?.concept_name || moduleKey, // 🆕 Concept grouping
    phaseOrder: module?.phase_order || 0, // 🆕 Phase order (0=landing, 1=wizard, 2=live)
    parentModuleId: module?.parent_module_id || null, // 🆕 Parent module reference
    landing_metrics: null,
    totalSessions: 0,
    uniqueUsers: 0,
    wizard_starts: 0,
    wizard_completions: 0,
    downloads: 0,
    returningUsers: 0,
    total_feedback: 0,
    helpful_feedback: 0,
    feedback_rate: 0,
    helpful_rate: 0,
    organic_count: 0,
    ads_count: 0,
    conversion_rate: 0,
    download_rate: 0,
    retention_rate: 0,
    monetization_intent_count: 0,
    pro_email_submitted_count: 0,
    pro_modal_dismissed_count: 0,
    preview_to_intent_rate: 0,
    intent_to_email_rate: 0,
    healthScore: 0,
    insufficient_data: true,
    recommendation: {
      action: "continue",
      confidence: "low",
      reason: "No tracking data. Needs activity to evaluate.",
      next_steps: [
        "Generate traffic to wizard/preview",
        "Share on social media",
        "Request feedback from beta users",
        "Verify that tracking is correctly implemented",
      ],
    },
    alerts: [],
    trends: {
      sessions_change: 0,
      completions_change: 0,
      downloads_change: 0,
      trend_direction: "down",
    },
    actionCriteria: {
      can_validate: false,
      can_archive: false,
      can_continue: true,
      validation_criteria: {
        sessions_min: false,
        completions_min: false,
        feedback_min: false,
        days_min: false,
        signal_positive: false,
      },
      archive_criteria: {
        sessions_min: false,
        signal_negative: false,
      },
      days_running: 0,
      blocking_reasons: {
        validate: ["Not enough data to decide"],
        archive: ["Needs at least 15 sessions to confirm the pattern"],
      },
    },
    period,
    date_from: dateFrom.toISOString(),
    date_to: dateTo.toISOString(),
  };
}

export { createEmptyAnalyticsResult };
