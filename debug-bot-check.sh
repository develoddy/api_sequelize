#!/bin/bash
# Quick debug script to check bot filtering in production

echo "🔍 Checking inbox-zero-prevention tracking events..."
echo ""

# Database connection (update if needed)
DB_NAME="ecommerce_mean"
DB_USER="root"

# Query to check all events and their classification
mysql -u $DB_USER -p $DB_NAME << 'EOF'

-- All events with classification
SELECT 
    id,
    session_id,
    SUBSTRING(user_agent, 1, 60) as user_agent_preview,
    ip_address,
    CASE 
        WHEN user_agent LIKE '%Googlebot%' THEN '🤖 BOT'
        WHEN user_agent LIKE '%bot/%' THEN '🤖 BOT'  
        WHEN user_agent IS NULL THEN '⚠️ NULL'
        ELSE '✅ HUMAN'
    END AS classification,
    timestamp
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND event = 'prevention_demo_viewed'
ORDER BY timestamp DESC
LIMIT 25;

-- Summary counts
SELECT 
    '📊 SUMMARY' as info,
    COUNT(DISTINCT session_id) as total_unique_sessions,
    COUNT(DISTINCT CASE WHEN user_agent LIKE '%Googlebot%' THEN session_id END) as bot_sessions,
    COUNT(DISTINCT CASE WHEN user_agent NOT LIKE '%Googlebot%' AND user_agent NOT LIKE '%bot/%' AND user_agent IS NOT NULL THEN session_id END) as human_sessions_with_filter
FROM tracking_events
WHERE module = 'inbox-zero-prevention'
  AND event = 'prevention_demo_viewed';

EOF

echo ""
echo "Expected: 19 total, 3 bots, 16 humans"
