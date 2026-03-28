import { generateObject } from "ai";
import { getModel } from "@/lib/ai/models";
import { buildScheduleAgentPrompt } from "@/lib/prompts/schedule-agent";
import { scheduleAgentSchema } from "./schemas";
import type {
  PicnicData,
  AnalysisResult,
  PicnicOrder,
  ScheduleAgentOutput,
} from "@/types";

/**
 * Derive delivery patterns from order history.
 *
 * Computes the user's preferred delivery day and time window based on
 * historical order timestamps.
 */
function deriveDeliveryPatterns(orders: PicnicOrder[]) {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const dayDistribution: Record<string, number> = {};
  const timeWindows: Record<string, number> = {};

  for (const order of orders) {
    const date = new Date(order.delivery_time);
    const dayName = dayNames[date.getDay()];
    dayDistribution[dayName] = (dayDistribution[dayName] ?? 0) + 1;

    // Bucket into 2-hour windows
    const hour = date.getHours();
    const windowStart = Math.floor(hour / 2) * 2;
    const windowEnd = windowStart + 2;
    const window = `${String(windowStart).padStart(2, "0")}:00-${String(windowEnd).padStart(2, "0")}:00`;
    timeWindows[window] = (timeWindows[window] ?? 0) + 1;
  }

  // Find the most common day and time window
  const preferredDay =
    Object.entries(dayDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] ??
    "";
  const preferredTimeWindow =
    Object.entries(timeWindows).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";

  return {
    preferredDay,
    preferredTimeWindow,
    deliveryCount: orders.length,
    dayDistribution,
  };
}

/**
 * Run the Schedule Agent.
 *
 * Picks the best delivery slot based on historical delivery patterns.
 * Falls back to the earliest available slot if no pattern is detected.
 */
export async function runScheduleAgent(
  data: PicnicData,
  analysis: AnalysisResult
): Promise<ScheduleAgentOutput> {
  try {
    const patterns = deriveDeliveryPatterns(data.orders);

    const result = await generateObject({
      model: getModel("schedule-agent"),
      schema: scheduleAgentSchema,
      system: buildScheduleAgentPrompt(data.deliverySlots, patterns),
      prompt:
        "Select the best delivery slot based on the user's historical delivery patterns.",
    });

    return result.object;
  } catch (error) {
    console.error("Schedule Agent failed, returning fallback slot:", error);

    // Fallback: pick the first available slot
    const availableSlot = data.deliverySlots.find((s) => s.is_available);

    if (availableSlot) {
      return {
        selectedSlot: {
          slotId: availableSlot.slot_id,
          date: availableSlot.window_start.slice(0, 10),
          timeWindow: `${availableSlot.window_start.slice(11, 16)} - ${availableSlot.window_end.slice(11, 16)}`,
          reasoning:
            "Automatically selected the earliest available slot due to a processing error.",
        },
      };
    }

    return {
      selectedSlot: {
        slotId: "",
        date: "",
        timeWindow: "",
        reasoning: "No delivery slots available at this time.",
      },
    };
  }
}
