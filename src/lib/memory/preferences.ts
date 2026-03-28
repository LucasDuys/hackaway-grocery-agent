import * as fs from "fs";
import * as path from "path";
import type {
  Preferences,
  CartSummary,
  ParsedIntent,
  BudgetOptimizerOutput,
} from "@/types";

const PREFERENCES_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "preferences.json"
);

/** Returns a fresh set of empty preferences. */
export function getDefaultPreferences(): Preferences {
  return {
    brandPreferences: [],
    budgetPatterns: {
      averageBudget: 0,
      lastStatedBudget: null,
      typicalSpend: 0,
    },
    deliveryPreferences: {
      preferredDay: null,
      preferredTimeWindow: null,
    },
    dietaryRestrictions: [],
    neverSuggest: [],
    alwaysInclude: [],
    runCount: 0,
    lastRunAt: "",
  };
}

/** Read preferences from disk, returning defaults if the file is missing or corrupt. */
export function loadPreferences(): Preferences {
  try {
    const raw = fs.readFileSync(PREFERENCES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Preferences;
    return parsed;
  } catch {
    return getDefaultPreferences();
  }
}

/** Persist preferences to disk. */
export function savePreferences(prefs: Preferences): void {
  try {
    fs.writeFileSync(PREFERENCES_PATH, JSON.stringify(prefs, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to save preferences:", err);
  }
}

/**
 * Derive updated preferences from the current pipeline run.
 *
 * - Extracts brand preferences from budget optimizer adjustments
 * - Updates budget patterns from intent and actual spend
 * - Updates delivery preferences from the selected slot
 * - Increments runCount and updates lastRunAt
 * - Preserves existing neverSuggest and alwaysInclude lists
 */
export function derivePreferences(
  cartSummary: CartSummary,
  intent: ParsedIntent,
  budgetResult: BudgetOptimizerOutput | null,
  existingPrefs: Preferences
): Preferences {
  const now = new Date().toISOString();

  // --- Brand preferences from budget optimizer adjustments ---
  const brandPreferences = [...existingPrefs.brandPreferences];
  if (budgetResult?.adjustments) {
    for (const adj of budgetResult.adjustments) {
      const alreadyKnown = brandPreferences.some(
        (bp) =>
          bp.preferred === adj.replacement.name &&
          bp.rejected === adj.original.name
      );
      if (!alreadyKnown) {
        brandPreferences.push({
          category: adj.reasoning || "general",
          preferred: adj.replacement.name,
          rejected: adj.original.name,
          learnedAt: now,
        });
      }
    }
  }

  // --- Budget patterns ---
  const previousRuns = existingPrefs.runCount;
  const prevAvg = existingPrefs.budgetPatterns.averageBudget;
  const actualSpend = cartSummary.totalCost;

  // Running average of actual spend
  const newAverage =
    previousRuns > 0
      ? Math.round((prevAvg * previousRuns + actualSpend) / (previousRuns + 1))
      : actualSpend;

  const budgetPatterns = {
    averageBudget: newAverage,
    lastStatedBudget: intent.budget ?? existingPrefs.budgetPatterns.lastStatedBudget,
    typicalSpend: actualSpend,
  };

  // --- Delivery preferences ---
  let preferredDay = existingPrefs.deliveryPreferences.preferredDay;
  let preferredTimeWindow = existingPrefs.deliveryPreferences.preferredTimeWindow;

  if (cartSummary.deliverySlot) {
    const slot = cartSummary.deliverySlot;
    // Extract day name from the date string
    if (slot.date) {
      try {
        const dayName = new Date(slot.date).toLocaleDateString("en-US", {
          weekday: "long",
        });
        preferredDay = dayName;
      } catch {
        // keep existing
      }
    }
    if (slot.timeWindow) {
      preferredTimeWindow = slot.timeWindow;
    }
  }

  // --- Dietary restrictions ---
  // Use intent restrictions if provided, otherwise preserve existing
  const dietaryRestrictions =
    intent.dietaryRestrictions && intent.dietaryRestrictions.length > 0
      ? [...intent.dietaryRestrictions]
      : [...(existingPrefs.dietaryRestrictions ?? [])];

  return {
    brandPreferences,
    budgetPatterns,
    deliveryPreferences: {
      preferredDay,
      preferredTimeWindow,
    },
    dietaryRestrictions,
    neverSuggest: [...existingPrefs.neverSuggest],
    alwaysInclude: [...existingPrefs.alwaysInclude],
    runCount: previousRuns + 1,
    lastRunAt: now,
  };
}

/**
 * Render preferences as a prompt-friendly context block.
 *
 * Returns an empty string when there are no prior runs, so the prompt
 * is not polluted with an empty preferences section on the first run.
 */
export function formatPreferencesForPrompt(prefs: Preferences): string {
  if (prefs.runCount === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("<preferences>");
  lines.push(
    `You have served this household ${prefs.runCount} time${prefs.runCount === 1 ? "" : "s"} before. Here is what you have learned:`
  );

  // Brand preferences
  for (const bp of prefs.brandPreferences) {
    const runsAgo = prefs.runCount; // simplified -- we track learnedAt but not exact run index
    lines.push(
      `- They prefer ${bp.preferred} over ${bp.rejected} (learned ${formatLearnedAgo(bp.learnedAt, prefs.lastRunAt)})`
    );
  }

  // Budget
  if (prefs.budgetPatterns.averageBudget > 0) {
    const avgEur = (prefs.budgetPatterns.averageBudget / 100).toFixed(0);
    const typicalEur = (prefs.budgetPatterns.typicalSpend / 100).toFixed(0);
    lines.push(
      `- Their typical weekly budget is EUR ${avgEur}-${typicalEur}`
    );
  }

  // Delivery
  if (prefs.deliveryPreferences.preferredDay) {
    let deliveryLine = `- They prefer ${prefs.deliveryPreferences.preferredDay}`;
    if (prefs.deliveryPreferences.preferredTimeWindow) {
      deliveryLine += ` deliveries (${prefs.deliveryPreferences.preferredTimeWindow})`;
    } else {
      deliveryLine += " deliveries";
    }
    lines.push(deliveryLine);
  }

  // Never suggest
  if (prefs.neverSuggest.length > 0) {
    lines.push(`- Never suggest: ${prefs.neverSuggest.join(", ")}`);
  }

  // Always include
  if (prefs.alwaysInclude.length > 0) {
    lines.push(`- Always include: ${prefs.alwaysInclude.join(", ")}`);
  }

  // Dietary restrictions
  if (prefs.dietaryRestrictions && prefs.dietaryRestrictions.length > 0) {
    lines.push(`- Dietary restrictions: ${prefs.dietaryRestrictions.join(", ")}`);
  }

  lines.push("</preferences>");
  return lines.join("\n");
}

/** Helper: describe how long ago something was learned relative to lastRunAt. */
function formatLearnedAgo(learnedAt: string, lastRunAt: string): string {
  if (!learnedAt || !lastRunAt) {
    return "recently";
  }
  try {
    const learned = new Date(learnedAt).getTime();
    const last = new Date(lastRunAt).getTime();
    const diffMs = last - learned;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return "this session";
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  } catch {
    return "recently";
  }
}
