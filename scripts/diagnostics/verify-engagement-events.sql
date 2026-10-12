-- ================================================
-- 🔍 Verificación de Engagement Events
-- Módulo: inbox-zero-prevention
-- ================================================

-- QUERY 1: Ver TODOS los eventos existentes (sin filtrar)
-- ================================================
SELECT 
  event,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT session_id) as sesiones_unicas,
  MIN(created_at) as primera_fecha,
  MAX(created_at) as ultima_fecha
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND source NOT IN ('admin', 'internal')
GROUP BY event
ORDER BY total_eventos DESC;

-- QUERY 2: Detectar BOTS en los datos
-- ================================================
SELECT 
  'BOT DETECTION' as categoria,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT session_id) as sesiones,
  GROUP_CONCAT(DISTINCT user_agent SEPARATOR ' | ') as user_agents
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND (
    user_agent LIKE '%bot%' OR
    user_agent LIKE '%Bot%' OR
    user_agent LIKE '%Googlebot%' OR
    user_agent LIKE '%meta-externalagent%' OR
    user_agent LIKE '%crawler%'
  );

-- QUERY 3: Conteo de eventos SIN BOTS (datos limpios)
-- ================================================
SELECT 
  event,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT session_id) as sesiones_unicas
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND source NOT IN ('admin', 'internal')
  AND (
    user_agent IS NULL OR 
    (
      user_agent NOT LIKE '%bot%' AND
      user_agent NOT LIKE '%Bot%' AND
      user_agent NOT LIKE '%Googlebot%' AND
      user_agent NOT LIKE '%meta-externalagent%' AND
      user_agent NOT LIKE '%crawler%'
    )
  )
GROUP BY event
ORDER BY total_eventos DESC;

-- QUERY 4: Conteo de ENGAGEMENT EVENTS (5 tipos específicos)
-- ================================================
SELECT 
  SUM(CASE WHEN event = 'metric_clicked' THEN 1 ELSE 0 END) as metric_clicked,
  SUM(CASE WHEN event = 'cta_clicked' THEN 1 ELSE 0 END) as cta_clicked,
  SUM(CASE WHEN event = 'faq_expanded' THEN 1 ELSE 0 END) as faq_expanded,
  SUM(CASE WHEN event = 'chat_opened' THEN 1 ELSE 0 END) as chat_opened,
  SUM(CASE WHEN event = 'setup_request_submitted' THEN 1 ELSE 0 END) as setup_submitted,
  COUNT(*) as total_engagement_events
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND source NOT IN ('admin', 'internal')
  AND event IN ('metric_clicked', 'cta_clicked', 'faq_expanded', 'chat_opened', 'setup_request_submitted')
  AND (
    user_agent IS NULL OR 
    (
      user_agent NOT LIKE '%bot%' AND
      user_agent NOT LIKE '%Bot%' AND
      user_agent NOT LIKE '%Googlebot%' AND
      user_agent NOT LIKE '%meta-externalagent%' AND
      user_agent NOT LIKE '%crawler%'
    )
  );

-- QUERY 5: CÁLCULO FINAL DE ENGAGEMENT RATE (como el backend)
-- ================================================
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'prevention_demo_viewed' THEN session_id END) as demo_views,
  COUNT(DISTINCT CASE WHEN event IN ('metric_clicked', 'cta_clicked', 'faq_expanded', 'chat_opened', 'setup_request_submitted') 
    THEN session_id END) as sesiones_con_engagement,
  ROUND(
    (COUNT(DISTINCT CASE WHEN event IN ('metric_clicked', 'cta_clicked', 'faq_expanded', 'chat_opened', 'setup_request_submitted') 
      THEN session_id END) * 100.0) / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'prevention_demo_viewed' THEN session_id END), 0),
    0
  ) as engagement_rate_percent,
  COUNT(CASE WHEN event IN ('metric_clicked', 'cta_clicked', 'faq_expanded', 'chat_opened', 'setup_request_submitted') 
    THEN 1 END) as total_engagement_clicks,
  ROUND(
    COUNT(CASE WHEN event IN ('metric_clicked', 'cta_clicked', 'faq_expanded', 'chat_opened', 'setup_request_submitted') 
      THEN 1 END) * 1.0 / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'prevention_demo_viewed' THEN session_id END), 0),
    1
  ) as avg_clicks_per_view
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND source NOT IN ('admin', 'internal')
  AND (
    user_agent IS NULL OR 
    (
      user_agent NOT LIKE '%bot%' AND
      user_agent NOT LIKE '%Bot%' AND
      user_agent NOT LIKE '%Googlebot%' AND
      user_agent NOT LIKE '%meta-externalagent%' AND
      user_agent NOT LIKE '%crawler%'
    )
  );

