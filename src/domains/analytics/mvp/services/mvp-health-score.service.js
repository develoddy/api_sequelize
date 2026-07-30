/**
 * MVP Health Score Service
 *
 * Calcula el health score de un MVP a partir de sus KPIs.
 */


const SCORE_WEIGHTS = {
  conversion_rate: 0.25,    // 25% - completar wizard
  helpful_rate: 0.35,       // 35% - feedback positivo
  download_rate: 0.20,      // 20% - descargas
  volume_score: 0.10,       // 10% - cantidad de sesiones
  retention_score: 0.10     // 10% - usuarios recurrentes
};

/**
 * Calcular Health Score (0-100)
 * Con penalización por datos insuficientes
 *
 * ✅ FIX: Fórmula separada para landing pages (inbox-zero-prevention)
 * Las landing pages no tienen wizard completions ni feedback_submitted.
 * Se evalúan por: volumen de visitas + tasa de conversión a waitlist.
 */
function calculateHealthScore(kpis, moduleType = 'wizard') {

  // Landing page formula
  if (moduleType === 'landing') {
    // volume_score: 100 pts cuando hay 20+ sesiones reales
    const volume_score = Math.min((kpis.totalSessions / 20) * 100, 100);
    // conversion_score: tasa waitlist_success / prevention_demo_viewed (0-100)
    const conversion_score = kpis.conversion_rate;

    const rawScore = Math.round(
      (volume_score    * 0.60) +   // 60% — cantidad de visitantes
      (conversion_score * 0.40)    // 40% — conversión a waitlist
    );

    if (kpis.insufficient_data) {
      // Cap 50 hasta tener suficientes datos
      return Math.max(0, Math.min(50, rawScore));
    }
    return Math.max(0, Math.min(100, rawScore));
  }

  // ── Generic wizard formula (unchanged) ───────────────────────────────────
  // Si hay datos insuficientes, penalizar el score
  if (kpis.insufficient_data) {
    // Score basado solo en lo que tenemos, pero con cap máximo de 50
    const volume_score = Math.min((kpis.totalSessions / 100) * 100, 100);
    
    const rawScore = Math.round(
      (kpis.conversion_rate * SCORE_WEIGHTS.conversion_rate) +
      (kpis.helpful_rate * SCORE_WEIGHTS.helpful_rate) +
      (kpis.download_rate * SCORE_WEIGHTS.download_rate) +
      (volume_score * SCORE_WEIGHTS.volume_score) +
      (kpis.retention_rate * SCORE_WEIGHTS.retention_score)
    );
    
    // Cap a 50 para indicar que necesita más datos
    return Math.max(0, Math.min(50, rawScore));
  }
  
  // Normalizar volume score (0-100 por sesiones)
  const volume_score = Math.min((kpis.totalSessions / 100) * 100, 100);
  
  const score = Math.round(
    (kpis.conversion_rate * SCORE_WEIGHTS.conversion_rate) +
    (kpis.helpful_rate * SCORE_WEIGHTS.helpful_rate) +
    (kpis.download_rate * SCORE_WEIGHTS.download_rate) +
    (volume_score * SCORE_WEIGHTS.volume_score) +
    (kpis.retention_rate * SCORE_WEIGHTS.retention_score)
  );
  
  return Math.max(0, Math.min(100, score));
}

export {
  calculateHealthScore
};