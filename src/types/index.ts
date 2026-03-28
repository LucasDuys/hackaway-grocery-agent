// === Picnic API Types ===

export interface PicnicOrder {
  delivery_id: string;
  delivery_time: number; // epoch ms
  status: string;
  items: PicnicOrderItem[];
}

export interface PicnicOrderItem {
  selling_unit_id: string; // prefixed with 's'
  name: string;
  quantity: number;
  price: number; // integer cents
  image_url?: string;
}

export interface PicnicDeliverySlot {
  slot_id: string;
  window_start: string;
  window_end: string;
  is_available: boolean;
}

export interface PicnicProduct {
  selling_unit_id: string;
  name: string;
  price: number; // cents
  image_url?: string;
  unit_quantity?: string;
}

export interface PicnicData {
  orders: PicnicOrder[];
  favorites: PicnicProduct[];
  cart: PicnicCartItem[];
  deliverySlots: PicnicDeliverySlot[];
  searchResults: Record<string, PicnicProduct[]>;
  recipes: PicnicRecipe[];
}

export interface PicnicCartItem {
  selling_unit_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

export interface PicnicRecipe {
  id: string;
  name: string;
  portions: number;
  ingredients: Array<{
    selling_unit_id: string;
    name: string;
    quantity: number;
  }>;
}

// === Analysis Layer Types ===

export interface ItemClassification {
  itemId: string;
  name: string;
  category: "staple" | "regular" | "occasional" | "one-time";
  frequencyRatio: number;
}

export interface Recommendation {
  itemId: string;
  name: string;
  score: number;
  reason: string;
  reasonTag: ReasonTag;
  suggestedQuantity: number;
  lastBought: string; // ISO date
  pricePerUnit: number; // cents
}

export interface BudgetAnalysis {
  avgWeeklySpend: number; // cents
  spendTrend: "increasing" | "stable" | "decreasing";
  trendSlope: number;
}

export interface HouseholdEstimate {
  estimatedSize: "single" | "couple" | "small-family" | "large-family";
  avgSpendPerOrder: number;
}

export interface CoPurchaseRule {
  itemA: string;
  itemB: string;
  support: number;
  confidence: number;
  lift: number;
}

export interface AnalysisResult {
  classifications: ItemClassification[];
  recommendations: Recommendation[];
  budget: BudgetAnalysis;
  household: HouseholdEstimate;
  coPurchases: CoPurchaseRule[];
}

// === Agent Pipeline Types ===

export interface OrderAnalystOutput {
  recommendedItems: Recommendation[];
  totalEstimatedCost: number; // cents
  householdInsight: string;
}

export interface MealPlannerOutput {
  meals: Array<{
    day: string;
    mealName: string;
    ingredients: Array<{
      itemId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    estimatedCost: number; // cents
    portionSize: number;
  }>;
  additionalIngredients: Recommendation[];
}

export interface BudgetOptimizerOutput {
  approved: boolean;
  originalTotal: number; // cents
  optimizedTotal: number; // cents
  adjustments: Array<{
    original: { itemId: string; name: string; price: number };
    replacement: { itemId: string; name: string; price: number };
    savings: number; // cents
    reasoning: string;
  }>;
}

export interface ScheduleAgentOutput {
  selectedSlot: {
    slotId: string;
    date: string;
    timeWindow: string;
    reasoning: string;
  };
}

// === SSE / Streaming Types ===

export type AgentName =
  | "prefetch"
  | "order-analyst"
  | "meal-planner"
  | "budget-optimizer"
  | "schedule-agent"
  | "orchestrator";

export type AgentStatus = "pending" | "running" | "complete" | "error";
export type ActionType = "SUGGEST" | "REJECT" | "APPROVE" | "QUERY" | "SUBSTITUTE";
export type ReasonTag = "repeat" | "substitution" | "recipe" | "suggestion" | "overdue" | "co-purchase";

export interface AgentEvent {
  agent: AgentName;
  action: ActionType;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// === Cart UI Types ===

export interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number; // cents
  imageUrl?: string;
  reasonTag: ReasonTag;
  reasoning: string;
  agentSource: AgentName;
  diffStatus?: "added" | "removed" | "substituted" | "unchanged";
}

export interface CartSummary {
  items: CartItem[];
  totalCost: number; // cents
  budget: number; // cents
  isOverBudget: boolean;
  savings: number; // cents
  substitutionCount: number;
  deliverySlot: ScheduleAgentOutput["selectedSlot"] | null;
  mode?: "auto" | "custom";
}

// === User Intent ===

export interface ParsedIntent {
  rawInput: string;
  meals: Array<{ day: string; dish: string }>;
  guestEvents: Array<{ day: string; guestCount: number; description: string }>;
  budget: number | null; // cents, null = no explicit budget
  specialRequests: string[];
}
