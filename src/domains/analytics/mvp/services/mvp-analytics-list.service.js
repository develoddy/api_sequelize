import { findActiveAnalyticsModules } from "../repositories/mvp-analytics.repository.js";

import { calculateModuleAnalytics } from "../mvp-analytics.service.js";

/**
 * Obtener analytics de todos los módulos activos.
 */
async function getAllModuleAnalytics(period = "30d") {
  const activeModules = await findActiveAnalyticsModules();

  if (activeModules.length === 0) {
    return {
      analytics: [],
      message: "No active modules in testing or live",
      summary: {
        total_modules: 0,
        avg_score: 0,
        ready_to_promote: 0,
        needs_improvement: 0,
        to_archive: 0,
      },
    };
  }

  const analyticsPromises = activeModules.map((module) =>
    calculateModuleAnalytics(module.key, period),
  );

  const analytics = (await Promise.all(analyticsPromises)).filter(Boolean);

  analytics.sort((a, b) => b.healthScore - a.healthScore);

  const avgScore =
    analytics.length > 0
      ? Math.round(
          analytics.reduce((sum, item) => sum + item.healthScore, 0) /
            analytics.length,
        )
      : 0;

  return {
    analytics,
    summary: {
      total_modules: analytics.length,
      avg_score: avgScore,
      ready_to_promote: analytics.filter(
        (item) => item.recommendation.action === "validate",
      ).length,
      needs_improvement: analytics.filter(
        (item) => item.recommendation.action === "continue",
      ).length,
      to_archive: analytics.filter(
        (item) => item.recommendation.action === "archive",
      ).length,
    },
  };
}

/**
 * Obtener módulos con mejor rendimiento reciente.
 */
async function getTrendingModuleAnalytics({
  period = "7d",
  minimumHealthScore = 60,
  limit = 5,
} = {}) {
  const result = await getAllModuleAnalytics(period);

  return result.analytics
    .filter((item) => item.healthScore >= minimumHealthScore)
    .slice(0, limit);
}


export {
  getAllModuleAnalytics,
  getTrendingModuleAnalytics
};