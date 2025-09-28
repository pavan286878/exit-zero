-- ExitZero Database Schema
-- Supabase PostgreSQL schema for AI-native retention infrastructure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (customers from Stripe)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    plan TEXT,
    mrr DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- User usage tracking
CREATE TABLE user_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support tickets (from Zendesk/Intercom)
CREATE TABLE support_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticket_id TEXT UNIQUE NOT NULL,
    subject TEXT,
    content TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    topics TEXT[],
    status TEXT,
    priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription events from Stripe webhooks
CREATE TABLE subscription_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_email TEXT,
    plan TEXT,
    mrr DECIMAL(10,2),
    cancel_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cancel intent events (when users hit cancel)
CREATE TABLE cancel_intent_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    plan TEXT,
    mrr DECIMAL(10,2),
    cancel_reason TEXT,
    offer_id TEXT,
    offer_type TEXT,
    offer_value DECIMAL(10,2),
    copy_headline TEXT,
    copy_confidence DECIMAL(3,2),
    fallback_used BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offer responses (when users accept/decline offers)
CREATE TABLE offer_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    offer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    response TEXT CHECK (response IN ('accepted', 'declined', 'ignored')),
    reward DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook-generated offers
CREATE TABLE webhook_offers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    offer_type TEXT NOT NULL,
    offer_value DECIMAL(10,2),
    confidence DECIMAL(3,2),
    processing_time INTEGER, -- milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offer notifications (email/Slack)
CREATE TABLE offer_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    channel TEXT CHECK (channel IN ('email', 'slack', 'modal')),
    status TEXT CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Churn audits (one-time $99 analysis)
CREATE TABLE churn_audits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    stripe_payment_intent_id TEXT,
    data_period_days INTEGER DEFAULT 90,
    results JSONB,
    sql_report TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Bandit learning state (Q-learning)
CREATE TABLE bandit_states (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    q_values JSONB NOT NULL,
    action_counts JSONB NOT NULL,
    total_reward DECIMAL(10,2) DEFAULT 0,
    epsilon DECIMAL(3,2) DEFAULT 0.1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE api_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    response_time INTEGER, -- milliseconds
    status_code INTEGER,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(8,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_customer_id ON users(customer_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_user_usage_created_at ON user_usage(created_at);
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_sentiment ON support_tickets(sentiment);
CREATE INDEX idx_subscription_events_customer_id ON subscription_events(customer_id);
CREATE INDEX idx_subscription_events_created_at ON subscription_events(created_at);
CREATE INDEX idx_cancel_intent_events_customer_id ON cancel_intent_events(customer_id);
CREATE INDEX idx_cancel_intent_events_created_at ON cancel_intent_events(created_at);
CREATE INDEX idx_offer_responses_offer_id ON offer_responses(offer_id);
CREATE INDEX idx_offer_responses_user_id ON offer_responses(user_id);
CREATE INDEX idx_bandit_states_customer_id ON bandit_states(customer_id);
CREATE INDEX idx_api_usage_customer_id ON api_usage(customer_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_intent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandit_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (customer_id = current_setting('app.current_customer_id'));

CREATE POLICY "Users can view own usage" ON user_usage
    FOR SELECT USING (user_id IN (
        SELECT id FROM users WHERE customer_id = current_setting('app.current_customer_id')
    ));

CREATE POLICY "Users can view own support tickets" ON support_tickets
    FOR SELECT USING (user_id IN (
        SELECT id FROM users WHERE customer_id = current_setting('app.current_customer_id')
    ));

-- Service role can access all data
CREATE POLICY "Service role full access" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON user_usage
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON support_tickets
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON subscription_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON cancel_intent_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON offer_responses
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON webhook_offers
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON offer_notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON churn_audits
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON bandit_states
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON api_usage
    FOR ALL USING (auth.role() = 'service_role');

-- Functions for analytics
CREATE OR REPLACE FUNCTION get_churn_metrics(customer_id_param TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_cancellations BIGINT,
    total_offers_sent BIGINT,
    total_offers_accepted BIGINT,
    save_rate DECIMAL(5,2),
    avg_processing_time DECIMAL(8,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT cie.id) as total_cancellations,
        COUNT(DISTINCT wo.id) as total_offers_sent,
        COUNT(DISTINCT or.id) FILTER (WHERE or.response = 'accepted') as total_offers_accepted,
        CASE 
            WHEN COUNT(DISTINCT wo.id) > 0 THEN 
                (COUNT(DISTINCT or.id) FILTER (WHERE or.response = 'accepted')::DECIMAL / COUNT(DISTINCT wo.id) * 100)
            ELSE 0 
        END as save_rate,
        AVG(wo.processing_time) as avg_processing_time
    FROM cancel_intent_events cie
    LEFT JOIN webhook_offers wo ON cie.customer_id = wo.customer_id 
        AND cie.created_at >= wo.created_at - INTERVAL '1 hour'
    LEFT JOIN offer_responses or ON wo.offer_id = or.offer_id
    WHERE cie.customer_id = customer_id_param
        AND cie.created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;

-- Function to get bandit performance
CREATE OR REPLACE FUNCTION get_bandit_performance(customer_id_param TEXT)
RETURNS TABLE (
    arm_id TEXT,
    q_value DECIMAL(8,4),
    action_count BIGINT,
    avg_reward DECIMAL(8,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        key as arm_id,
        (value->>'q_value')::DECIMAL(8,4) as q_value,
        (value->>'count')::BIGINT as action_count,
        CASE 
            WHEN (value->>'count')::BIGINT > 0 THEN 
                (value->>'q_value')::DECIMAL(8,4) / (value->>'count')::DECIMAL(8,4)
            ELSE 0 
        END as avg_reward
    FROM bandit_states bs,
         jsonb_each(bs.q_values) as q_vals,
         jsonb_each(bs.action_counts) as action_vals
    WHERE bs.customer_id = customer_id_param
        AND q_vals.key = action_vals.key
        AND bs.last_updated >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
