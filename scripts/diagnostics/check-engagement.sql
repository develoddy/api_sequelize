-- Query eventos críticos para engagement rate
SELECT 
  event,
  COUNT(*) as count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND event IN ('prevention_demo_viewed', 'metric_clicked', 'waitlist_success')
GROUP BY event
ORDER BY event;
