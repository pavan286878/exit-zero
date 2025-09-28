/**
 * AI Copy Composer for ExitZero
 * Generates personalized retention copy using Claude/GPT-4 with sentiment analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface UserContext {
  userId: string;
  email: string;
  plan: string;
  tenure: number; // days since signup
  usage: {
    logins: number;
    features: string[];
    lastActive: Date;
  };
  supportTickets?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
    recentCount: number;
  };
  mrr: number;
  churnRisk: number; // 0-1 score
}

export interface OfferContext {
  offer: {
    type: 'discount' | 'pause' | 'swap' | 'extension';
    value: number;
    description: string;
  };
  urgency: 'low' | 'medium' | 'high';
  channel: 'email' | 'slack' | 'modal';
}

export interface GeneratedCopy {
  headline: string;
  body: string;
  cta: string;
  confidence: number;
  fallbackUsed: boolean;
  sentiment: string;
  personalizationFactors: string[];
}

export class AICopyComposer {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private fallbackTemplates: Map<string, string>;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this.initializeFallbackTemplates();
  }

  private initializeFallbackTemplates(): void {
    this.fallbackTemplates = new Map([
      ['discount', 'We hate to see you go! How about 20% off your next 3 months?'],
      ['pause', 'Need a break? We can pause your subscription for 30 days.'],
      ['swap', 'Maybe a different plan would work better? Let\'s find the right fit.'],
      ['extension', 'We\'d love to give you 14 more days to explore all features.']
    ]);
  }

  /**
   * Generate personalized copy based on user context and offer
   */
  async generateCopy(
    userContext: UserContext,
    offerContext: OfferContext
  ): Promise<GeneratedCopy> {
    try {
      const prompt = this.buildPrompt(userContext, offerContext);
      
      // Try Claude first (better for nuanced copy)
      const claudeResult = await this.generateWithClaude(prompt);
      
      if (claudeResult.confidence >= 0.8) {
        return claudeResult;
      }

      // Fallback to GPT-4 if Claude confidence is low
      const gptResult = await this.generateWithGPT(prompt);
      
      if (gptResult.confidence >= 0.8) {
        return gptResult;
      }

      // Use fallback template if both AI models have low confidence
      return this.generateFallback(userContext, offerContext);

    } catch (error) {
      console.error('AI copy generation failed:', error);
      return this.generateFallback(userContext, offerContext);
    }
  }

  private buildPrompt(userContext: UserContext, offerContext: OfferContext): string {
    const sentimentContext = userContext.supportTickets 
      ? `Support sentiment: ${userContext.supportTickets.sentiment}. Recent topics: ${userContext.supportTickets.topics.join(', ')}.`
      : 'No recent support tickets.';

    return `
You are ExitZero, an AI retention specialist. Generate personalized copy to prevent churn.

USER CONTEXT:
- Plan: ${userContext.plan}
- Tenure: ${userContext.tenure} days
- Usage: ${userContext.usage.logins} logins, features: ${userContext.usage.features.join(', ')}
- MRR: $${userContext.mrr}
- Churn risk: ${(userContext.churnRisk * 100).toFixed(1)}%
- ${sentimentContext}

OFFER:
- Type: ${offerContext.offer.type}
- Value: ${offerContext.offer.value}
- Description: ${offerContext.offer.description}
- Urgency: ${offerContext.urgency}
- Channel: ${offerContext.channel}

REQUIREMENTS:
1. Address specific pain points based on sentiment and usage
2. Match tone to user's support history (empathetic if negative, celebratory if positive)
3. Create urgency without being pushy
4. Keep copy concise and actionable
5. Include specific value proposition

OUTPUT FORMAT (JSON):
{
  "headline": "Compelling 1-line headline",
  "body": "2-3 sentence personalized message",
  "cta": "Clear call-to-action button text",
  "confidence": 0.95,
  "sentiment": "empathetic|encouraging|celebratory",
  "personalizationFactors": ["factor1", "factor2"]
}

Generate copy that feels human and addresses their specific situation.
`;
  }

  private async generateWithClaude(prompt: string): Promise<GeneratedCopy> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const parsed = JSON.parse(content.text);
      return {
        ...parsed,
        fallbackUsed: false
      };
    } catch (error) {
      console.error('Claude generation failed:', error);
      throw error;
    }
  }

  private async generateWithGPT(prompt: string): Promise<GeneratedCopy> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content from GPT-4');
      }

      const parsed = JSON.parse(content);
      return {
        ...parsed,
        fallbackUsed: false
      };
    } catch (error) {
      console.error('GPT-4 generation failed:', error);
      throw error;
    }
  }

  private generateFallback(
    userContext: UserContext,
    offerContext: OfferContext
  ): GeneratedCopy {
    const template = this.fallbackTemplates.get(offerContext.offer.type) || 
                    this.fallbackTemplates.get('discount')!;

    const personalizationFactors = [];
    
    if (userContext.tenure > 365) {
      personalizationFactors.push('long_tenure');
    }
    
    if (userContext.supportTickets?.sentiment === 'negative') {
      personalizationFactors.push('negative_sentiment');
    }
    
    if (userContext.usage.logins < 5) {
      personalizationFactors.push('low_usage');
    }

    return {
      headline: 'We\'d hate to see you go!',
      body: template,
      cta: 'Keep My Account',
      confidence: 0.6,
      fallbackUsed: true,
      sentiment: 'empathetic',
      personalizationFactors
    };
  }

  /**
   * Analyze support ticket sentiment using AI
   */
  async analyzeTicketSentiment(ticketText: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
    confidence: number;
  }> {
    try {
      const prompt = `
Analyze this support ticket for sentiment and topics:

"${ticketText}"

Return JSON with:
- sentiment: "positive", "neutral", or "negative"
- topics: array of main topics/issues mentioned
- confidence: 0-1 confidence score
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(content.text);
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return {
        sentiment: 'neutral',
        topics: ['general'],
        confidence: 0.5
      };
    }
  }

  /**
   * Generate A/B test variants for copy optimization
   */
  async generateVariants(
    userContext: UserContext,
    offerContext: OfferContext,
    count: number = 3
  ): Promise<GeneratedCopy[]> {
    const variants: GeneratedCopy[] = [];
    
    for (let i = 0; i < count; i++) {
      const variantPrompt = this.buildPrompt(userContext, {
        ...offerContext,
        urgency: i === 0 ? 'low' : i === 1 ? 'medium' : 'high'
      });
      
      try {
        const variant = await this.generateWithClaude(variantPrompt);
        variants.push(variant);
      } catch (error) {
        // Fallback to template if AI fails
        variants.push(this.generateFallback(userContext, offerContext));
      }
    }
    
    return variants;
  }
}
