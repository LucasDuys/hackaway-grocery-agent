import type { PicnicOrder, AnalysisResult } from "@/types";
import { classifyItems } from "./staple-detection";
import { predictReplenishment } from "./replenishment-predictor";
import { analyzeBudget } from "./budget-analysis";
import { findCoPurchases } from "./co-purchase";
import { estimateHousehold } from "./household-estimation";

export { classifyItems } from "./staple-detection";
export { predictReplenishment } from "./replenishment-predictor";
export { analyzeBudget } from "./budget-analysis";
export { findCoPurchases } from "./co-purchase";
export { estimateHousehold } from "./household-estimation";

export function runFullAnalysis(orders: PicnicOrder[]): AnalysisResult {
  return {
    classifications: classifyItems(orders),
    recommendations: predictReplenishment(orders),
    budget: analyzeBudget(orders),
    household: estimateHousehold(orders),
    coPurchases: findCoPurchases(orders),
  };
}
