/**
 * Churn Audit API - $99 one-time analysis
 * Analyzes 90-day historical data and generates SQL report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { AICopyComposer } from '@/lib/ai-copy-composer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const copyComposer = new AICopyComposer();

export interface ChurnAuditRequest {
  email: string;
  stripeCustomerId?: string;
  dataPeriodDays?: number;
  paymentIntentId?: string;
}

export interface ChurnAuditResponse {
  auditId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: {
    totalCustomers: number;
    churnedCustomers: number;
    churnRate: number;
    avgLifetime: number;
    topChurnReasons: string[];
    riskSegments: any[];
    recommendations: string[];
    sqlReport: string;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChurnAuditRequest = await request.json();
    
    if (!body.email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create audit record
    const { data: audit, error } = await supabase
      .from('churn_audits')
      .insert({
        email: body.email,
        stripe_payment_intent_id: body.paymentIntentId,
        data_period_days: body.dataPeriodDays || 90,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create audit record:', error);
      return NextResponse.json(
        { error: 'Failed to create audit' },
        { status: 500 }
      );
    }

    // Process audit asynchronously
    processAudit(audit.id, body).catch(console.error);

    return NextResponse.json({
      auditId: audit.id,
      status: 'pending'
    } as ChurnAuditResponse);

  } catch (error) {
    console.error('Churn audit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auditId = searchParams.get('auditId');
    
    if (!auditId) {
      return NextResponse.json(
        { error: 'Audit ID is required' },
        { status: 400 }
      );
    }

    const { data: audit, error } = await supabase
      .from('churn_audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (error || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      auditId: audit.id,
      status: audit.status,
      results: audit.results,
      error: audit.status === 'failed' ? 'Audit processing failed' : undefined
    } as ChurnAuditResponse);

  } catch (error) {
    console.error('Churn audit GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processAudit(auditId: string, request: ChurnAuditRequest) {
  try {
    // Update status to processing
    await supabase
      .from('churn_audits')
      .update({ status: 'processing' })
      .eq('id', auditId);

    // Get Stripe data
    const stripeData = await getStripeData(request);
    
    // Analyze the data
    const analysis = await analyzeChurnData(stripeData, request.dataPeriodDays || 90);
    
    // Generate SQL report
    const sqlReport = generateSQLReport(analysis);
    
    // Generate AI recommendations
    const recommendations = await generateRecommendations(analysis);
    
    // Compile results
    const results = {
      ...analysis,
      recommendations,
      sqlReport
    };

    // Update audit with results
    await supabase
      .from('churn_audits')
      .update({
        status: 'completed',
        results: results,
        sql_report: sqlReport,
        completed_at: new Date().toISOString()
      })
      .eq('id', auditId);

    // Send email with results
    await sendAuditResultsEmail(request.email, results);

  } catch (error) {
    console.error('Audit processing failed:', error);
    
    await supabase
      .from('churn_audits')
      .update({
        status: 'failed',
        results: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      .eq('id', auditId);
  }
}

async function getStripeData(request: ChurnAuditRequest) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (request.dataPeriodDays || 90));

  try {
    // Get customers
    const customers = await stripe.customers.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      },
      limit: 100
    });

    // Get subscriptions
    const subscriptions = await stripe.subscriptions.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      },
      limit: 100
    });

    // Get invoices
    const invoices = await stripe.invoices.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      },
      limit: 100
    });

    return {
      customers: customers.data,
      subscriptions: subscriptions.data,
      invoices: invoices.data,
      period: {
        start: startDate,
        end: endDate
      }
    };

  } catch (error) {
    console.error('Failed to fetch Stripe data:', error);
    throw new Error('Failed to fetch customer data from Stripe');
  }
}

async function analyzeChurnData(stripeData: any, periodDays: number) {
  const { customers, subscriptions, invoices } = stripeData;
  
  // Calculate basic metrics
  const totalCustomers = customers.length;
  const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active').length;
  const canceledSubscriptions = subscriptions.filter((s: any) => s.status === 'canceled').length;
  const churnRate = totalCustomers > 0 ? (canceledSubscriptions / totalCustomers) * 100 : 0;
  
  // Calculate average lifetime
  const canceledSubs = subscriptions.filter((s: any) => s.status === 'canceled');
  const avgLifetime = canceledSubs.length > 0 
    ? canceledSubs.reduce((sum: number, sub: any) => {
        const created = new Date(sub.created * 1000);
        const canceled = new Date(sub.canceled_at! * 1000);
        return sum + (canceled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / canceledSubs.length
    : 0;

  // Analyze churn reasons
  const churnReasons = subscriptions
    .filter((s: any) => s.status === 'canceled' && s.cancellation_details?.reason)
    .map((s: any) => s.cancellation_details!.reason!);
  
  const reasonCounts = churnReasons.reduce((acc: Record<string, number>, reason: string) => {
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topChurnReasons = Object.entries(reasonCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([reason]) => reason);

  // Risk segmentation
  const riskSegments = segmentCustomersByRisk(customers, subscriptions);

  return {
    totalCustomers,
    churnedCustomers: canceledSubscriptions,
    churnRate: Math.round(churnRate * 100) / 100,
    avgLifetime: Math.round(avgLifetime * 10) / 10,
    topChurnReasons,
    riskSegments,
    periodDays
  };
}

function segmentCustomersByRisk(customers: any[], subscriptions: any[]) {
  const segments: {
    high: any[];
    medium: any[];
    low: any[];
  } = {
    high: [],
    medium: [],
    low: []
  };

  customers.forEach((customer: any) => {
    const customerSubs = subscriptions.filter((s: any) => s.customer === customer.id);
    const activeSub = customerSubs.find((s: any) => s.status === 'active');
    const canceledSub = customerSubs.find((s: any) => s.status === 'canceled');
    
    let riskScore = 0;
    
    // Factors that increase risk
    if (canceledSub) riskScore += 0.4;
    if (customerSubs.length === 0) riskScore += 0.3;
    if (activeSub && activeSub.current_period_end < Date.now() / 1000 + 7 * 24 * 60 * 60) {
      riskScore += 0.2;
    }
    
    // Tenure factor
    const created = new Date(customer.created * 1000);
    const daysSinceCreated = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) riskScore += 0.2;
    if (daysSinceCreated > 365) riskScore -= 0.1;
    
    const segment = riskScore > 0.6 ? 'high' : riskScore > 0.3 ? 'medium' : 'low';
    segments[segment].push({
      id: customer.id,
      email: customer.email,
      riskScore: Math.round(riskScore * 100) / 100,
      created: customer.created,
      subscriptions: customerSubs.length
    });
  });

  return {
    high: segments.high.length,
    medium: segments.medium.length,
    low: segments.low.length,
    details: segments
  };
}

function generateSQLReport(analysis: any): string {
  return `
-- ExitZero Churn Audit Report
-- Generated on ${new Date().toISOString()}

-- Summary Statistics
SELECT 
  'Total Customers' as metric,
  ${analysis.totalCustomers} as value
UNION ALL
SELECT 
  'Churned Customers' as metric,
  ${analysis.churnedCustomers} as value
UNION ALL
SELECT 
  'Churn Rate (%)' as metric,
  ${analysis.churnRate} as value
UNION ALL
SELECT 
  'Avg Lifetime (days)' as metric,
  ${analysis.avgLifetime} as value;

-- Top Churn Reasons
${analysis.topChurnReasons.map((reason: string, i: number) => 
  `SELECT '${reason}' as reason, ${i + 1} as rank;`
).join('\n')}

-- Risk Segmentation
SELECT 
  'High Risk' as segment,
  ${analysis.riskSegments.high} as count
UNION ALL
SELECT 
  'Medium Risk' as segment,
  ${analysis.riskSegments.medium} as count
UNION ALL
SELECT 
  'Low Risk' as segment,
  ${analysis.riskSegments.low} as count;

-- Recommendations
-- 1. Focus on ${analysis.topChurnReasons[0]} issues
-- 2. Implement retention offers for high-risk customers
-- 3. Monitor customers with <30 day tenure
-- 4. Set up automated churn prediction alerts
`;
}

async function generateRecommendations(analysis: any): Promise<string[]> {
  const recommendations = [];
  
  if (analysis.churnRate > 10) {
    recommendations.push('High churn rate detected. Consider implementing immediate retention strategies.');
  }
  
  if (analysis.avgLifetime < 90) {
    recommendations.push('Short customer lifetime suggests onboarding or product-market fit issues.');
  }
  
  if (analysis.topChurnReasons.includes('too_expensive')) {
    recommendations.push('Price sensitivity detected. Consider offering discounts or plan downgrades.');
  }
  
  if (analysis.riskSegments.high > analysis.totalCustomers * 0.2) {
    recommendations.push('Large high-risk segment. Implement proactive outreach campaigns.');
  }
  
  if (analysis.topChurnReasons.includes('missing_features')) {
    recommendations.push('Feature gaps identified. Consider product roadmap adjustments or workarounds.');
  }
  
  recommendations.push('Set up automated churn prediction using ExitZero API.');
  recommendations.push('Implement A/B testing for retention offers.');
  recommendations.push('Create customer health scoring dashboard.');
  
  return recommendations;
}

async function sendAuditResultsEmail(email: string, results: any) {
  // This would integrate with your email service (SendGrid, Resend, etc.)
  console.log('Would send audit results email to:', email);
  console.log('Results:', results);
  
  // For now, just log the email content
  const emailContent = `
    Subject: Your ExitZero Churn Audit Results
    
    Hi there,
    
    Your churn audit is complete! Here are the key findings:
    
    📊 Summary:
    - Total Customers: ${results.totalCustomers}
    - Churn Rate: ${results.churnRate}%
    - Average Lifetime: ${results.avgLifetime} days
    
    🎯 Top Churn Reasons:
    ${results.topChurnReasons.map((reason: string, i: number) => `${i + 1}. ${reason}`).join('\n')}
    
    ⚠️ Risk Segments:
    - High Risk: ${results.riskSegments.high} customers
    - Medium Risk: ${results.riskSegments.medium} customers
    - Low Risk: ${results.riskSegments.low} customers
    
    💡 Recommendations:
    ${results.recommendations.map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n')}
    
    Your detailed SQL report is attached.
    
    Ready to implement these insights? Upgrade to ExitZero Pro for automated retention!
    
    Best,
    The ExitZero Team
  `;
  
  console.log('Email content:', emailContent);
}
