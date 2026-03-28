import type { AgentName, ActionType } from "@/types";

/**
 * Format cents as "EUR X.XX"
 */
function formatEur(cents: number): string {
  const euros = (cents / 100).toFixed(2);
  return `EUR ${euros}`;
}

// ---------------------------------------------------------------------------
// Order Analyst
// ---------------------------------------------------------------------------

export function narrateOrderAnalystSuggest(
  itemName: string,
  reason: string,
  quantity: number,
  totalOrders: number
): string {
  // Try to extract frequency info from the reason string
  const everyWeekMatch = reason.match(
    /(\d+)\s*(?:of|out of)\s*(\d+)/i
  );

  if (everyWeekMatch) {
    const count = parseInt(everyWeekMatch[1], 10);
    const total = parseInt(everyWeekMatch[2], 10);
    const ratio = count / total;

    if (ratio >= 0.9) {
      return `Looking at your last ${total} orders, you buy ${itemName} every week (${count} of ${total} orders). Adding ${quantity} to your cart.`;
    }
    return `You bought ${itemName} in ${count} of your last ${total} orders. Adding ${quantity} to this week's shop.`;
  }

  const overdueMatch = reason.match(
    /every\s*(\d+)\s*weeks?.*?(\d+)\s*days?/i
  );
  if (overdueMatch) {
    const weekInterval = parseInt(overdueMatch[1], 10);
    const daysSince = parseInt(overdueMatch[2], 10);
    return `You typically buy ${itemName} every ${weekInterval} weeks. It has been ${daysSince} days -- adding ${quantity}.`;
  }

  // Fallback: use totalOrders for context
  return `Based on your last ${totalOrders} orders, ${itemName} is a regular purchase. Adding ${quantity} to your cart.`;
}

export function narrateOrderAnalystSummary(
  itemCount: number,
  totalCost: number,
  householdInsight: string
): string {
  return `Based on your purchase patterns, I have selected ${itemCount} items totaling ${formatEur(totalCost)}. ${householdInsight}`;
}

// ---------------------------------------------------------------------------
// Budget Optimizer
// ---------------------------------------------------------------------------

export function narrateBudgetReject(
  totalCost: number,
  budget: number
): string {
  const over = totalCost - budget;
  return `Your cart is ${formatEur(over)} over your ${formatEur(budget)} budget. Let me find some savings.`;
}

export function narrateBudgetSubstitute(
  originalName: string,
  originalPrice: number,
  replacementName: string,
  replacementPrice: number,
  savings: number
): string {
  return `Swapping ${originalName} (${formatEur(originalPrice)}) for ${replacementName} (${formatEur(replacementPrice)}) saves ${formatEur(savings)}.`;
}

export function narrateBudgetRemoval(
  itemName: string,
  itemPrice: number,
  priority: string
): string {
  return `Removing ${itemName} (${formatEur(itemPrice)}) -- ${priority}.`;
}

export function narrateBudgetApprove(
  optimizedTotal: number,
  budget: number,
  swapCount: number,
  removalCount: number,
  totalSavings: number
): string {
  const under = budget - optimizedTotal;
  const parts: string[] = [];
  if (swapCount > 0) parts.push(`${swapCount} swap${swapCount === 1 ? "" : "s"}`);
  if (removalCount > 0) parts.push(`removed ${removalCount} occasional item${removalCount === 1 ? "" : "s"}`);
  const adjustmentText = parts.length > 0 ? ` I made ${parts.join(" and ")}, saving ${formatEur(totalSavings)} total.` : "";
  return `Done. Your cart is now ${formatEur(optimizedTotal)}, which is ${formatEur(under)} under budget.${adjustmentText}`;
}

// ---------------------------------------------------------------------------
// Meal Planner
// ---------------------------------------------------------------------------

export function narrateMealPlan(
  day: string,
  mealName: string,
  ingredientCount: number,
  isGuestEvent: boolean,
  guestCount?: number
): string {
  if (isGuestEvent && guestCount != null) {
    return `For ${day}'s dinner with friends (${guestCount} people), I have chosen ${mealName} -- adding ${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"} scaled for the group.`;
  }
  return `For ${day}, I have planned ${mealName} -- adding ${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"} to your cart.`;
}

// ---------------------------------------------------------------------------
// Schedule Agent
// ---------------------------------------------------------------------------

export function narrateScheduleSlot(
  date: string,
  timeWindow: string,
  reasoning: string
): string {
  return `Your groceries will arrive on ${date}, between ${timeWindow}. ${reasoning}`;
}

// ---------------------------------------------------------------------------
// Cart Finalized
// ---------------------------------------------------------------------------

export function narrateCartFinalized(
  itemCount: number,
  totalCost: number,
  deliveryDate: string | null,
  deliveryWindow: string | null
): string {
  const base = `Your weekly shop is ready: ${itemCount} item${itemCount === 1 ? "" : "s"} for ${formatEur(totalCost)}.`;
  if (deliveryDate && deliveryWindow) {
    return `${base} Delivery scheduled for ${deliveryDate} ${deliveryWindow}.`;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Event Dispatcher
// ---------------------------------------------------------------------------

export function narrateEvent(
  agent: AgentName,
  action: ActionType,
  rawMessage: string,
  context?: Record<string, unknown>
): string {
  try {
    if (agent === "order-analyst" && action === "SUGGEST" && context) {
      const itemName = context.itemName as string | undefined;
      const reason = context.reason as string | undefined;
      const quantity = context.quantity as number | undefined;
      const totalOrders = context.totalOrders as number | undefined;
      if (itemName && reason && quantity != null && totalOrders != null) {
        return narrateOrderAnalystSuggest(itemName, reason, quantity, totalOrders);
      }
    }

    if (agent === "order-analyst" && action === "APPROVE" && context) {
      const itemCount = context.itemCount as number | undefined;
      const totalCost = context.totalCost as number | undefined;
      const householdInsight = context.householdInsight as string | undefined;
      if (itemCount != null && totalCost != null && householdInsight) {
        return narrateOrderAnalystSummary(itemCount, totalCost, householdInsight);
      }
    }

    if (agent === "budget-optimizer" && action === "REJECT" && context) {
      const totalCost = context.totalCost as number | undefined;
      const budget = context.budget as number | undefined;
      if (totalCost != null && budget != null) {
        return narrateBudgetReject(totalCost, budget);
      }
    }

    if (agent === "budget-optimizer" && action === "SUBSTITUTE" && context) {
      const originalName = context.originalName as string | undefined;
      const originalPrice = context.originalPrice as number | undefined;
      const replacementName = context.replacementName as string | undefined;
      const replacementPrice = context.replacementPrice as number | undefined;
      const savings = context.savings as number | undefined;
      if (
        originalName &&
        originalPrice != null &&
        replacementName &&
        replacementPrice != null &&
        savings != null
      ) {
        return narrateBudgetSubstitute(
          originalName,
          originalPrice,
          replacementName,
          replacementPrice,
          savings
        );
      }
    }

    if (agent === "budget-optimizer" && action === "APPROVE" && context) {
      const optimizedTotal = context.optimizedTotal as number | undefined;
      const budget = context.budget as number | undefined;
      const swapCount = context.swapCount as number | undefined;
      const removalCount = context.removalCount as number | undefined;
      const totalSavings = context.totalSavings as number | undefined;
      if (
        optimizedTotal != null &&
        budget != null &&
        swapCount != null &&
        removalCount != null &&
        totalSavings != null
      ) {
        return narrateBudgetApprove(
          optimizedTotal,
          budget,
          swapCount,
          removalCount,
          totalSavings
        );
      }
    }

    if (agent === "meal-planner" && action === "SUGGEST" && context) {
      const day = context.day as string | undefined;
      const mealName = context.mealName as string | undefined;
      const ingredientCount = context.ingredientCount as number | undefined;
      const isGuestEvent = context.isGuestEvent as boolean | undefined;
      const guestCount = context.guestCount as number | undefined;
      if (day && mealName && ingredientCount != null) {
        return narrateMealPlan(day, mealName, ingredientCount, !!isGuestEvent, guestCount);
      }
    }

    if (agent === "schedule-agent" && action === "APPROVE" && context) {
      const date = context.date as string | undefined;
      const timeWindow = context.timeWindow as string | undefined;
      const reasoning = context.reasoning as string | undefined;
      if (date && timeWindow && reasoning) {
        return narrateScheduleSlot(date, timeWindow, reasoning);
      }
    }
  } catch {
    // If any narrative function throws, fall through to raw message
  }

  return rawMessage;
}
