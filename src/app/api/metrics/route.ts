/**
 * Metrics API - Real-time dashboard data
 * Provides churn metrics, save rates, and bandit performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const timeRange = searchParams.get('timeRange') || '30d';
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Calculate date range
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get churn metrics using the database function
    const { data: churnMetrics, error: churnError } = await supabase
      .rpc('get_churn_metrics', {
        customer_id_param: customerId,
        days_back: days
      });

    if (churnError) {
      console.error('Failed to get churn metrics:', churnError);
    }

    // Get bandit performance
    const { data: banditPerformance, error: banditError } = await supabase
      .rpc('get_bandit_performance', {
        customer_id_param: customerId
      });

    if (banditError) {
      console.error('Failed to get bandit performance:', banditError);
    }

    // Get MRR saved calculation
    const { data: mrrData, error: mrrError } = await supabase
      .from('offer_responses')
      .select(`
        response,
        webhook_offers!inner(
          customer_id,
          offer_value,
          offer_type
        )
      `)
      .eq('webhook_offers.customer_id', customerId)
      .gte('created_at', startDate.toISOString());

    let mrrSaved = 0;
    if (!mrrError && mrrData) {
      mrrSaved = mrrData
        .filter((item: any) => item.response === 'accepted')
        .reduce((sum: number, item: any) => {
          const offer = item.webhook_offers;
          if (offer.offer_type === 'discount') {
            return sum + (offer.offer_value || 0);
          }
          return sum;
        }, 0);
    }

    // Get recent activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('cancel_intent_events')
      .select(`
        *,
        webhook_offers!inner(
          offer_id,
          offer_type,
          offer_value
        )
      `)
      .eq('customer_id', customerId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate additional metrics
    const metrics = churnMetrics?.[0] || {
      total_cancellations: 0,
      total_offers_sent: 0,
      total_offers_accepted: 0,
      save_rate: 0,
      avg_processing_time: 0
    };

    const response = {
      totalCancellations: metrics.total_cancellations,
      totalOffersSent: metrics.total_offers_sent,
      totalOffersAccepted: metrics.total_offers_accepted,
      saveRate: metrics.save_rate,
      avgProcessingTime: metrics.avg_processing_time,
      mrrSaved: Math.round(mrrSaved),
      banditPerformance: banditPerformance || [],
      recentActivity: recentActivity || [],
      timeRange: timeRange,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
