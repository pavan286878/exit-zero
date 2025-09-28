/**
 * Cancel Intent API - Core ExitZero endpoint
 * Detects cancel intents and returns optimized offers in <100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { QLearningBandit, DEFAULT_OFFERS, Offer } from '@/lib/q-learning-bandit';
import { AICopyComposer, UserContext, OfferContext } from '@/lib/ai-copy-composer';
import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient } from 'redis';

// Initialize services
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = createRedisClient({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  password: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const bandit = new QLearningBandit(DEFAULT_OFFERS);
const copyComposer = new AICopyComposer();

export interface CancelIntentRequest {
  userId: string;
  customerId: string;
  subscriptionId: string;
  plan: string;
  mrr: number;
  cancelReason?: string;
  metadata?: Record<string, any>;
}

export interface CancelIntentResponse {
  status: 'offer' | 'cancel';
  offer?: {
    id: string;
    type: string;
    value: number;
    description: string;
    copy: {
      headline: string;
      body: string;
      cta: string;
    };
    expiresAt: string;
  };
  confidence: number;
  processingTime: number;
  banditMetrics?: {
    totalActions: number;
    avgReward: number;
    armPerformance: any[];
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: CancelIntentRequest = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.customerId || !body.subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, customerId, subscriptionId' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const rateLimitKey = `rate_limit:${body.customerId}`;
    const rateLimit = await redis.get(rateLimitKey);
    if (rateLimit && parseInt(rateLimit) > 10) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Increment rate limit counter
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 3600); // 1 hour window

    // Get user context from database
    const userContext = await getUserContext(body);
    
    // Check if user should receive an offer
    const shouldOffer = await shouldPresentOffer(userContext, body);
    
    if (!shouldOffer) {
      const processingTime = Date.now() - startTime;
      return NextResponse.json({
        status: 'cancel',
        confidence: 0.9,
        processingTime
      } as CancelIntentResponse);
    }

    // Select optimal offer using bandit
    const selectedOffer = bandit.selectAction();
    
    // Generate personalized copy
    const offerContext: OfferContext = {
      offer: selectedOffer,
      urgency: userContext.churnRisk > 0.7 ? 'high' : userContext.churnRisk > 0.4 ? 'medium' : 'low',
      channel: 'email' // Default to email, can be overridden
    };

    const generatedCopy = await copyComposer.generateCopy(userContext, offerContext);
    
    // Log the event for analytics
    await logCancelIntentEvent(body, selectedOffer, generatedCopy);
    
    // Cache the offer for tracking
    const offerId = `offer_${Date.now()}_${body.userId}`;
    await redis.setEx(
      `offer:${offerId}`,
      3600, // 1 hour expiry
      JSON.stringify({
        userId: body.userId,
        customerId: body.customerId,
        offer: selectedOffer,
        copy: generatedCopy,
        timestamp: new Date().toISOString()
      })
    );

    const processingTime = Date.now() - startTime;
    const response: CancelIntentResponse = {
      status: 'offer',
      offer: {
        id: offerId,
        type: selectedOffer.type,
        value: selectedOffer.value,
        description: selectedOffer.description,
        copy: {
          headline: generatedCopy.headline,
          body: generatedCopy.body,
          cta: generatedCopy.cta
        },
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
      },
      confidence: generatedCopy.confidence,
      processingTime,
      banditMetrics: bandit.getMetrics()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Cancel intent API error:', error);
    
    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      { 
        error: 'Internal server error',
        processingTime 
      },
      { status: 500 }
    );
  }
}

async function getUserContext(request: CancelIntentRequest): Promise<UserContext> {
  // Get user data from Supabase
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('customer_id', request.customerId)
    .single();

  if (error || !user) {
    // Return minimal context if user not found
    return {
      userId: request.userId,
      email: '',
      plan: request.plan,
      tenure: 0,
      usage: {
        logins: 0,
        features: [],
        lastActive: new Date()
      },
      mrr: request.mrr,
      churnRisk: 0.5
    };
  }

  // Get usage data
  const { data: usage } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  // Get support tickets if available
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  // Calculate churn risk (simplified)
  const churnRisk = calculateChurnRisk(user, usage || [], tickets || []);

  return {
    userId: request.userId,
    email: user.email,
    plan: request.plan,
    tenure: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    usage: {
      logins: usage?.length || 0,
      features: usage?.map(u => u.feature).filter(Boolean) || [],
      lastActive: usage?.[0]?.created_at ? new Date(usage[0].created_at) : new Date()
    },
    supportTickets: tickets?.length ? {
      sentiment: analyzeTicketSentiment(tickets),
      topics: extractTopics(tickets),
      recentCount: tickets.length
    } : undefined,
    mrr: request.mrr,
    churnRisk
  };
}

function calculateChurnRisk(user: any, usage: any[], tickets: any[]): number {
  let risk = 0.3; // Base risk

  // Usage-based risk
  if (usage.length < 5) risk += 0.2;
  if (usage.length === 0) risk += 0.3;

  // Support ticket risk
  const negativeTickets = tickets.filter(t => t.sentiment === 'negative').length;
  if (negativeTickets > 2) risk += 0.2;
  if (negativeTickets > 5) risk += 0.2;

  // Tenure risk
  const tenure = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (tenure < 7) risk += 0.2;
  if (tenure > 365) risk -= 0.1;

  return Math.max(0, Math.min(1, risk));
}

function analyzeTicketSentiment(tickets: any[]): 'positive' | 'neutral' | 'negative' {
  const sentiments = tickets.map(t => t.sentiment).filter(Boolean);
  if (sentiments.length === 0) return 'neutral';
  
  const negativeCount = sentiments.filter(s => s === 'negative').length;
  const positiveCount = sentiments.filter(s => s === 'positive').length;
  
  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > negativeCount) return 'positive';
  return 'neutral';
}

function extractTopics(tickets: any[]): string[] {
  const topics = new Set<string>();
  tickets.forEach(ticket => {
    if (ticket.topics) {
      ticket.topics.forEach((topic: string) => topics.add(topic));
    }
  });
  return Array.from(topics);
}

async function shouldPresentOffer(userContext: UserContext, request: CancelIntentRequest): Promise<boolean> {
  // Don't offer to users with very high churn risk (likely to churn anyway)
  if (userContext.churnRisk > 0.9) return false;
  
  // Don't offer to very new users (less than 3 days)
  if (userContext.tenure < 3) return false;
  
  // Don't offer if MRR is too low (not worth the cost)
  if (userContext.mrr < 10) return false;
  
  // Check if user has already received an offer recently
  const recentOfferKey = `recent_offer:${request.customerId}`;
  const recentOffer = await redis.get(recentOfferKey);
  if (recentOffer) return false;
  
  // Set flag to prevent multiple offers
  await redis.setEx(recentOfferKey, 86400, '1'); // 24 hours
  
  return true;
}

async function logCancelIntentEvent(
  request: CancelIntentRequest,
  offer: Offer,
  copy: any
): Promise<void> {
  try {
    await supabase.from('cancel_intent_events').insert({
      user_id: request.userId,
      customer_id: request.customerId,
      subscription_id: request.subscriptionId,
      plan: request.plan,
      mrr: request.mrr,
      cancel_reason: request.cancelReason,
      offer_id: offer.id,
      offer_type: offer.type,
      offer_value: offer.value,
      copy_headline: copy.headline,
      copy_confidence: copy.confidence,
      fallback_used: copy.fallbackUsed,
      metadata: request.metadata,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log cancel intent event:', error);
  }
}

// Handle offer response (when user accepts/declines)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, response, userId } = body;
    
    if (!offerId || !response || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get cached offer data
    const offerData = await redis.get(`offer:${offerId}`);
    if (!offerData) {
      return NextResponse.json(
        { error: 'Offer not found or expired' },
        { status: 404 }
      );
    }

    const offer = JSON.parse(offerData);
    
    // Calculate reward for bandit learning
    const reward = bandit.calculateReward(
      offer.offer.id,
      response,
      offer.mrr || 0,
      offer.offer.cost
    );
    
    // Update bandit
    bandit.update(offer.offer.id, reward);
    
    // Log the response
    await supabase.from('offer_responses').insert({
      offer_id: offerId,
      user_id: userId,
      response: response,
      reward: reward,
      created_at: new Date().toISOString()
    });
    
    // Clean up cached offer
    await redis.del(`offer:${offerId}`);
    
    return NextResponse.json({ success: true, reward });
    
  } catch (error) {
    console.error('Offer response error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
