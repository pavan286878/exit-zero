/**
 * Data Export API - SQL ownership for customers
 * Exports all customer data in SQL format for data ownership
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'sql';
    const customerId = searchParams.get('customerId');
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    if (format === 'sql') {
      const sqlExport = await generateSQLExport(customerId);
      
      return new NextResponse(sqlExport, {
        status: 200,
        headers: {
          'Content-Type': 'application/sql',
          'Content-Disposition': `attachment; filename="exitzero-export-${customerId}-${new Date().toISOString().split('T')[0]}.sql"`
        }
      });
    } else if (format === 'csv') {
      const csvExport = await generateCSVExport(customerId);
      
      return new NextResponse(csvExport, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="exitzero-export-${customerId}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Unsupported format. Use "sql" or "csv"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateSQLExport(customerId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  
  let sql = `-- ExitZero Data Export
-- Customer ID: ${customerId}
-- Export Date: ${timestamp}
-- 
-- This export contains all your retention data from ExitZero
-- You own this data and can import it into any SQL database
--

-- Cancel Intent Events
SELECT 
  'cancel_intent_events' as table_name,
  user_id,
  customer_id,
  subscription_id,
  plan,
  mrr,
  cancel_reason,
  offer_id,
  offer_type,
  offer_value,
  copy_headline,
  copy_confidence,
  fallback_used,
  metadata,
  created_at
FROM cancel_intent_events 
WHERE customer_id = '${customerId}'

UNION ALL

-- Offer Responses
SELECT 
  'offer_responses' as table_name,
  offer_id as user_id,
  user_id as customer_id,
  offer_id as subscription_id,
  response as plan,
  reward as mrr,
  NULL as cancel_reason,
  offer_id,
  response as offer_type,
  reward as offer_value,
  NULL as copy_headline,
  NULL as copy_confidence,
  NULL as fallback_used,
  NULL as metadata,
  created_at
FROM offer_responses 
WHERE user_id = '${customerId}'

UNION ALL

-- Webhook Offers
SELECT 
  'webhook_offers' as table_name,
  subscription_id as user_id,
  customer_id,
  subscription_id,
  offer_type as plan,
  offer_value as mrr,
  NULL as cancel_reason,
  offer_id,
  offer_type,
  offer_value,
  NULL as copy_headline,
  confidence as copy_confidence,
  NULL as fallback_used,
  json_build_object('processing_time', processing_time) as metadata,
  created_at
FROM webhook_offers 
WHERE customer_id = '${customerId}'

UNION ALL

-- Subscription Events
SELECT 
  'subscription_events' as table_name,
  subscription_id as user_id,
  customer_id,
  subscription_id,
  plan,
  mrr,
  cancel_reason,
  NULL as offer_id,
  event_type as offer_type,
  mrr as offer_value,
  NULL as copy_headline,
  NULL as copy_confidence,
  NULL as fallback_used,
  metadata,
  created_at
FROM subscription_events 
WHERE customer_id = '${customerId}'

ORDER BY created_at DESC;

-- Summary Statistics
SELECT 
  'SUMMARY' as section,
  'Total Cancel Intents' as metric,
  COUNT(*)::text as value
FROM cancel_intent_events 
WHERE customer_id = '${customerId}'

UNION ALL

SELECT 
  'SUMMARY' as section,
  'Total Offers Sent' as metric,
  COUNT(*)::text as value
FROM webhook_offers 
WHERE customer_id = '${customerId}'

UNION ALL

SELECT 
  'SUMMARY' as section,
  'Total Offers Accepted' as metric,
  COUNT(*)::text as value
FROM offer_responses 
WHERE customer_id = '${customerId}' AND response = 'accepted'

UNION ALL

SELECT 
  'SUMMARY' as section,
  'Save Rate (%)' as metric,
  CASE 
    WHEN (SELECT COUNT(*) FROM webhook_offers WHERE customer_id = '${customerId}') > 0 
    THEN ROUND(
      (SELECT COUNT(*) FROM offer_responses WHERE user_id = '${customerId}' AND response = 'accepted')::decimal / 
      (SELECT COUNT(*) FROM webhook_offers WHERE customer_id = '${customerId}') * 100, 2
    )::text
    ELSE '0' 
  END as value;

-- Bandit Performance (if available)
SELECT 
  'BANDIT' as section,
  key as metric,
  json_build_object(
    'q_value', value->>'q_value',
    'count', value->>'count',
    'avg_reward', CASE 
      WHEN (value->>'count')::int > 0 
      THEN ((value->>'q_value')::decimal / (value->>'count')::decimal)::text
      ELSE '0'
    END
  )::text as value
FROM bandit_states bs,
     jsonb_each(bs.q_values) as q_vals
WHERE bs.customer_id = '${customerId}'
  AND bs.last_updated >= NOW() - INTERVAL '7 days';

-- Data Ownership Notice
SELECT 
  'NOTICE' as section,
  'Data Ownership' as metric,
  'You own this data. ExitZero provides SQL exports to ensure complete data portability and ownership.' as value;
`;

  return sql;
}

async function generateCSVExport(customerId: string): Promise<string> {
  // Get all relevant data
  const { data: cancelIntents } = await supabase
    .from('cancel_intent_events')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const { data: offerResponses } = await supabase
    .from('offer_responses')
    .select('*')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false });

  const { data: webhookOffers } = await supabase
    .from('webhook_offers')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  // Convert to CSV format
  let csv = 'Table,Event Type,Date,Details\n';
  
  // Cancel intents
  cancelIntents?.forEach(event => {
    csv += `Cancel Intent,${event.cancel_reason || 'unknown'},${event.created_at},"Plan: ${event.plan}, MRR: $${event.mrr}, Offer: ${event.offer_type || 'none}"\n`;
  });

  // Offer responses
  offerResponses?.forEach(response => {
    csv += `Offer Response,${response.response},${response.created_at},"Offer ID: ${response.offer_id}, Reward: ${response.reward}"\n`;
  });

  // Webhook offers
  webhookOffers?.forEach(offer => {
    csv += `Webhook Offer,${offer.offer_type},${offer.created_at},"Value: ${offer.offer_value}, Confidence: ${offer.confidence}"\n`;
  });

  return csv;
}
