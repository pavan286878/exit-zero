/**
 * Stripe Webhook Handler for ExitZero
 * Detects subscription cancellations and triggers retention offers
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  try {
    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    
    // Get subscription details
    const subscriptionData = {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      currentPeriodEnd: subscription.current_period_end,
      plan: subscription.items.data[0]?.price?.nickname || 'Unknown',
      mrr: calculateMRR(subscription.items.data),
      cancelReason: subscription.cancellation_details?.reason || 'unknown'
    };

    // Log the cancellation event
    await supabase.from('subscription_events').insert({
      event_type: 'subscription_deleted',
      subscription_id: subscription.id,
      customer_id: subscription.customer as string,
      customer_email: (customer as Stripe.Customer).email,
      plan: subscriptionData.plan,
      mrr: subscriptionData.mrr,
      cancel_reason: subscriptionData.cancelReason,
      metadata: {
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        current_period_end: subscription.current_period_end
      },
      created_at: new Date().toISOString()
    });

    // Trigger cancel intent API if this is an immediate cancellation
    if (!subscription.cancel_at_period_end) {
      await triggerCancelIntent(subscriptionData);
    }

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);
  
  try {
    // Check if subscription was just canceled
    if (subscription.cancel_at_period_end && !subscription.canceled_at) {
      // This is a cancellation at period end
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      
      const subscriptionData = {
        id: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        currentPeriodEnd: subscription.current_period_end,
        plan: subscription.items.data[0]?.price?.nickname || 'Unknown',
        mrr: calculateMRR(subscription.items.data),
        cancelReason: subscription.cancellation_details?.reason || 'unknown'
      };

      // Log the cancellation event
      await supabase.from('subscription_events').insert({
        event_type: 'subscription_canceled_at_period_end',
        subscription_id: subscription.id,
        customer_id: subscription.customer as string,
        customer_email: (customer as Stripe.Customer).email,
        plan: subscriptionData.plan,
        mrr: subscriptionData.mrr,
        cancel_reason: subscriptionData.cancelReason,
        metadata: {
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end
        },
        created_at: new Date().toISOString()
      });

      // Trigger cancel intent API
      await triggerCancelIntent(subscriptionData);
    }

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id);
  
  try {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const customer = await stripe.customers.retrieve(invoice.customer as string);
      
      // Log the payment failure
      await supabase.from('subscription_events').insert({
        event_type: 'payment_failed',
        subscription_id: subscription.id,
        customer_id: invoice.customer as string,
        customer_email: (customer as Stripe.Customer).email,
        plan: subscription.items.data[0]?.price?.nickname || 'Unknown',
        mrr: calculateMRR(subscription.items.data),
        cancel_reason: 'payment_failed',
        metadata: {
          invoice_id: invoice.id,
          amount_due: invoice.amount_due,
          attempt_count: invoice.attempt_count
        },
        created_at: new Date().toISOString()
      });

      // For now, we'll focus on voluntary churn, but this could trigger
      // involuntary churn recovery flows in the future
    }

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log('Trial will end for subscription:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    
    // Log the trial ending event
    await supabase.from('subscription_events').insert({
      event_type: 'trial_will_end',
      subscription_id: subscription.id,
      customer_id: subscription.customer as string,
      customer_email: (customer as Stripe.Customer).email,
      plan: subscription.items.data[0]?.price?.nickname || 'Unknown',
      mrr: calculateMRR(subscription.items.data),
      cancel_reason: 'trial_ending',
      metadata: {
        trial_end: subscription.trial_end,
        current_period_end: subscription.current_period_end
      },
      created_at: new Date().toISOString()
    });

    // This could trigger trial conversion offers in the future

  } catch (error) {
    console.error('Error handling trial will end:', error);
  }
}

async function triggerCancelIntent(subscriptionData: any) {
  try {
    // Call our cancel intent API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cancel-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: subscriptionData.customerId,
        customerId: subscriptionData.customerId,
        subscriptionId: subscriptionData.id,
        plan: subscriptionData.plan,
        mrr: subscriptionData.mrr,
        cancelReason: subscriptionData.cancelReason,
        metadata: {
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
          currentPeriodEnd: subscriptionData.currentPeriodEnd
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result.status === 'offer') {
        // Log the offer generation
        await supabase.from('webhook_offers').insert({
          subscription_id: subscriptionData.id,
          customer_id: subscriptionData.customerId,
          offer_id: result.offer.id,
          offer_type: result.offer.type,
          offer_value: result.offer.value,
          confidence: result.confidence,
          processing_time: result.processingTime,
          created_at: new Date().toISOString()
        });

        // TODO: Send the offer via email/Slack
        await sendOfferNotification(subscriptionData, result.offer);
      }
    } else {
      console.error('Cancel intent API failed:', await response.text());
    }

  } catch (error) {
    console.error('Error triggering cancel intent:', error);
  }
}

async function sendOfferNotification(subscriptionData: any, offer: any) {
  try {
    // For now, just log that we would send the notification
    // In a real implementation, this would:
    // 1. Send email via SendGrid/Resend
    // 2. Send Slack message via Slack API
    // 3. Queue for async processing
    
    console.log('Would send offer notification:', {
      customerId: subscriptionData.customerId,
      offer: offer,
      copy: offer.copy
    });

    // Log the notification attempt
    await supabase.from('offer_notifications').insert({
      customer_id: subscriptionData.customerId,
      subscription_id: subscriptionData.id,
      offer_id: offer.id,
      channel: 'email', // or 'slack'
      status: 'queued',
      created_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending offer notification:', error);
  }
}

function calculateMRR(items: Stripe.SubscriptionItem[]): number {
  let totalMRR = 0;
  
  items.forEach(item => {
    const price = item.price;
    if (price.unit_amount) {
      let amount = price.unit_amount / 100; // Convert from cents
      
      // Convert to monthly if needed
      if (price.recurring?.interval === 'year') {
        amount = amount / 12;
      } else if (price.recurring?.interval === 'week') {
        amount = amount * 4.33; // Approximate weeks per month
      }
      
      totalMRR += amount * (item.quantity || 1);
    }
  });
  
  return totalMRR;
}
