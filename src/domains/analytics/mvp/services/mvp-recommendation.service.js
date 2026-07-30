import {
  DECISION_THRESHOLDS
} from '../config/mvp-analytics.config.js';

/**
 * Generar recomendación automatizada
 */
function generateRecommendation(kpis, healthScore, totalEvents, moduleType = 'wizard') {
  const { 
    create_module_score,
    create_module_downloads,
    create_module_feedback_rate,
    archive_score,
    archive_min_sessions,
    min_sessions_to_analyze
  } = DECISION_THRESHOLDS;

  // Landing page (pain/demand validation)
  if (moduleType === 'landing') {
    if (kpis.insufficient_data) {
      return {
        action: 'continue',
        confidence: 'low',
        reason: `Few visits yet (${kpis.totalSessions} sessions). Score: ${healthScore}. Needs more real traffic to evaluate.`,
        next_steps: [
          'Share the landing on Discord, Reddit and Twitter',
          'Request at least 20 real visits before evaluating',
          'Verify that tracking fires on every visit'
        ]
      };
    }
    // With sufficient data: evaluate by waitlist conversion
    if (kpis.wizard_completions > 0) {
      return {
        action: 'validate',
        confidence: 'high',
        reason: `${kpis.wizard_completions} waitlist signup(s) from ${kpis.totalSessions} visits. Positive signal of real demand.`,
        next_steps: [
          'Onboard first users',
          'Validate willingness to pay',
          'Scale distribution'
        ]
      };
    }
    return {
      action: 'continue',
      confidence: 'low',
      reason: `${kpis.totalSessions} visits, 0 waitlist conversions. Score ${healthScore}. Optimize CTA and checkout.`,
      next_steps: [
        'Check if "Join Waitlist" button is visible on mobile',
        'Add more strength to CTA (urgency / concrete benefit)',
        'Increase organic traffic volume'
      ]
    };
  }
  
  // PRIORITY CASE: Insufficient data
  if (kpis.insufficient_data) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Insufficient data to decide. Only ${kpis.totalSessions} sessions, ${kpis.total_feedback} feedbacks. Score: ${healthScore} (penalized by low data).`,
      next_steps: [
        'Continue collecting data (min: 5 sessions, 3 feedbacks)',
        'Promote MVP on social media',
        'Request direct user feedback',
        'Review session_id tracking'
      ]
    };
  }
  
  // Case 1: Validate and activate module (change status to 'live')
  if (
    healthScore >= create_module_score &&
    kpis.downloads >= create_module_downloads &&
    kpis.helpful_rate >= create_module_feedback_rate
  ) {
    return {
      action: 'validate',
      confidence: 'high',
      reason: `Excellent performance: Score ${healthScore}, ${kpis.downloads} downloads, ${kpis.helpful_rate}% positive feedback`,
      next_steps: [
        'Validate module (change status to "live")',
        'Configure pricing and plans',
        'Prepare documentation',
        'Promote publicly'
      ]
    };
  }
  
  // Case 2: Archive
  if (
    kpis.totalSessions >= archive_min_sessions &&
    healthScore < archive_score
  ) {
    return {
      action: 'archive',
      confidence: 'medium',
      reason: `Low score (${healthScore}) after ${kpis.totalSessions} sessions. Did not validate user pain.`,
      next_steps: [
        'Archive MVP',
        'Analyze negative feedback',
        'Consider pivot or new MVP'
      ]
    };
  }
  
  // Case 3: Needs specific improvements
  if (kpis.conversion_rate < 50) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Low conversion (${kpis.conversion_rate}%). Improve wizard UX.`,
      next_steps: [
        'Analyze abandonment by step',
        'Simplify forms',
        'Add contextual help'
      ]
    };
  }
  
  if (kpis.helpful_rate < 60 && kpis.total_feedback > 5) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `High negative feedback (${100 - kpis.helpful_rate}%). Improve output quality.`,
      next_steps: [
        'Review negative feedback',
        'Improve generator algorithm',
        'Adjust user expectations'
      ]
    };
  }
  
  // Case 4: Continue validating (default)
  if (kpis.totalSessions < min_sessions_to_analyze) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Few sessions (${kpis.totalSessions}). Needs more data to decide.`,
      next_steps: [
        'Continue validating',
        'Promote on social media',
        'Request direct feedback'
      ]
    };
  }
  
  return {
    action: 'continue',
    confidence: 'medium',
    reason: `In validation. Score: ${healthScore}. Improve metrics before deciding.`,
    next_steps: [
      'Increase volume',
      'Improve feedback rate',
      'Optimize conversion'
    ]
  };
}

export {
  generateRecommendation
};