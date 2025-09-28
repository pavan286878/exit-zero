/**
 * Q-Learning Bandit for ExitZero Offer Optimization
 * Optimizes for (MRR saved - discount cost) with epsilon-greedy exploration
 */

export interface Offer {
  id: string;
  type: 'discount' | 'pause' | 'swap' | 'extension';
  value: number; // percentage discount, days pause, etc.
  cost: number; // cost to business (0-1)
  description: string;
}

export interface BanditState {
  qValues: Record<string, number>;
  actionCounts: Record<string, number>;
  totalReward: number;
  lastUpdated: Date;
}

export class QLearningBandit {
  private arms: Offer[];
  private qValues: Record<string, number>;
  private actionCounts: Record<string, number>;
  private alpha: number; // learning rate
  private gamma: number; // discount factor
  private epsilon: number; // exploration rate
  private totalReward: number;
  private lastUpdated: Date;

  constructor(
    arms: Offer[],
    alpha: number = 0.1,
    gamma: number = 0.9,
    epsilon: number = 0.1
  ) {
    this.arms = arms;
    this.alpha = alpha;
    this.gamma = gamma;
    this.epsilon = epsilon;
    this.qValues = {};
    this.actionCounts = {};
    this.totalReward = 0;
    this.lastUpdated = new Date();

    // Initialize Q-values for each arm
    arms.forEach(arm => {
      this.qValues[arm.id] = 0;
      this.actionCounts[arm.id] = 0;
    });
  }

  /**
   * Select an action using epsilon-greedy strategy
   */
  selectAction(): Offer {
    const shouldExplore = Math.random() < this.epsilon;
    
    if (shouldExplore) {
      // Explore: randomly select an arm
      const randomIndex = Math.floor(Math.random() * this.arms.length);
      return this.arms[randomIndex];
    } else {
      // Exploit: select arm with highest Q-value
      const bestArmId = Object.keys(this.qValues).reduce((a, b) => 
        this.qValues[a] > this.qValues[b] ? a : b
      );
      return this.arms.find(arm => arm.id === bestArmId) || this.arms[0];
    }
  }

  /**
   * Update Q-value based on reward
   * Reward calculation: MRR_saved - discount_cost
   */
  update(actionId: string, reward: number): void {
    if (!this.qValues.hasOwnProperty(actionId)) {
      console.warn(`Unknown action ID: ${actionId}`);
      return;
    }

    const oldQ = this.qValues[actionId];
    const newQ = oldQ + this.alpha * (reward - oldQ);
    
    this.qValues[actionId] = newQ;
    this.actionCounts[actionId]++;
    this.totalReward += reward;
    this.lastUpdated = new Date();
  }

  /**
   * Calculate reward based on user response and offer cost
   */
  calculateReward(
    actionId: string,
    userResponse: 'accepted' | 'declined' | 'ignored',
    mrrValue: number,
    offerCost: number
  ): number {
    const action = this.arms.find(arm => arm.id === actionId);
    if (!action) return 0;

    let baseReward = 0;
    
    switch (userResponse) {
      case 'accepted':
        // Positive reward: MRR saved minus offer cost
        baseReward = mrrValue * (1 - action.cost);
        break;
      case 'declined':
        // Small negative reward for failed attempt
        baseReward = -0.1;
        break;
      case 'ignored':
        // Neutral reward for no response
        baseReward = 0;
        break;
    }

    // Apply cost adjustment to prevent over-discounting
    const costAdjustedReward = baseReward - (offerCost * 0.1);
    
    return Math.max(-1, Math.min(1, costAdjustedReward)); // Clamp between -1 and 1
  }

  /**
   * Get current state for persistence
   */
  getState(): BanditState {
    return {
      qValues: { ...this.qValues },
      actionCounts: { ...this.actionCounts },
      totalReward: this.totalReward,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Load state from persistence
   */
  loadState(state: BanditState): void {
    this.qValues = { ...state.qValues };
    this.actionCounts = { ...state.actionCounts };
    this.totalReward = state.totalReward;
    this.lastUpdated = state.lastUpdated;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const totalActions = Object.values(this.actionCounts).reduce((a, b) => a + b, 0);
    const avgReward = totalActions > 0 ? this.totalReward / totalActions : 0;
    
    const armPerformance = this.arms.map(arm => ({
      id: arm.id,
      type: arm.type,
      qValue: this.qValues[arm.id],
      count: this.actionCounts[arm.id],
      avgReward: this.actionCounts[arm.id] > 0 
        ? this.qValues[arm.id] / this.actionCounts[arm.id] 
        : 0
    }));

    return {
      totalActions,
      avgReward,
      explorationRate: this.epsilon,
      armPerformance,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Decay epsilon for less exploration over time
   */
  decayEpsilon(decayRate: number = 0.99): void {
    this.epsilon = Math.max(0.01, this.epsilon * decayRate);
  }
}

// Default offer configurations
export const DEFAULT_OFFERS: Offer[] = [
  {
    id: 'discount_10',
    type: 'discount',
    value: 10,
    cost: 0.1,
    description: '10% discount for 3 months'
  },
  {
    id: 'discount_20',
    type: 'discount',
    value: 20,
    cost: 0.2,
    description: '20% discount for 2 months'
  },
  {
    id: 'pause_30',
    type: 'pause',
    value: 30,
    cost: 0.05,
    description: 'Pause subscription for 30 days'
  },
  {
    id: 'pause_60',
    type: 'pause',
    value: 60,
    cost: 0.1,
    description: 'Pause subscription for 60 days'
  },
  {
    id: 'extension_14',
    type: 'extension',
    value: 14,
    cost: 0.02,
    description: '14-day free extension'
  },
  {
    id: 'swap_plan',
    type: 'swap',
    value: 0,
    cost: 0.15,
    description: 'Downgrade to lower plan'
  }
];
