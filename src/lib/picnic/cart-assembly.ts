/**
 * Cart Assembly -- translates orchestrator output into Picnic API cart operations.
 *
 * Sequence: clear cart -> add items sequentially -> set delivery slot -> verify.
 */

import { PicnicClient } from "./client";
import type { RawCartResponse } from "./types";

export interface CartAssemblyResult {
  success: boolean;
  addedCount: number;
  failedItems: Array<{ itemId: string; error: string }>;
  verifiedCart: RawCartResponse;
}

/**
 * Assemble a cart by clearing it, adding items sequentially, optionally setting
 * a delivery slot, and verifying the final state.
 *
 * @param items  - Array of { itemId, quantity } to add
 * @param slotId - Optional delivery slot ID to set after adding items
 */
export async function assembleCart(
  items: Array<{ itemId: string; quantity: number }>,
  slotId?: string
): Promise<CartAssemblyResult> {
  const client = new PicnicClient();
  await client.authenticate();

  const failedItems: Array<{ itemId: string; error: string }> = [];
  let addedCount = 0;

  // 1. Clear the current cart
  try {
    await client.post("hackathon-clear-cart", {});
  } catch (err) {
    // If clear fails, still attempt to proceed -- the cart may already be empty
    console.warn(
      "[cart-assembly] Failed to clear cart, proceeding anyway:",
      err instanceof Error ? err.message : err
    );
  }

  // 2. Add items sequentially (avoid race conditions)
  for (const item of items) {
    try {
      const result = await client.post<Record<string, unknown>>(
        "hackathon-add-to-cart",
        { selling_unit_id: item.itemId, count: item.quantity }
      );

      // Check for API-level error in response
      if (result && typeof result === "object" && "error" in result) {
        const apiError = result as {
          error: { code?: string; message?: string };
        };
        const code = apiError.error?.code ?? "UNKNOWN";
        const message = apiError.error?.message ?? "Unknown error";

        if (code === "JAVASCRIPT_INTERNAL_ERROR") {
          // Product ID doesn't exist
          console.warn(
            `[cart-assembly] Product ${item.itemId} not found (JAVASCRIPT_INTERNAL_ERROR), skipping`
          );
          failedItems.push({
            itemId: item.itemId,
            error: `Product not found (${code})`,
          });
        } else {
          failedItems.push({
            itemId: item.itemId,
            error: `${code}: ${message}`,
          });
        }
        continue;
      }

      addedCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[cart-assembly] Failed to add ${item.itemId}: ${message}`
      );
      failedItems.push({ itemId: item.itemId, error: message });
    }
  }

  // 3. Set delivery slot if provided
  if (slotId) {
    try {
      await client.postDirect("/api/15/cart/set_delivery_slot", {
        slot_id: slotId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Empty body 500 means invalid slot ID
      console.warn(
        `[cart-assembly] Failed to set delivery slot ${slotId}: ${message}`
      );
      // Don't fail the whole operation -- items are still in the cart
    }
  }

  // 4. Verify the cart by fetching full product details
  let verifiedCart: RawCartResponse;
  try {
    verifiedCart = await client.get<RawCartResponse>("hackathon-get-cart");
  } catch (err) {
    console.warn(
      "[cart-assembly] Failed to verify cart:",
      err instanceof Error ? err.message : err
    );
    verifiedCart = { items: [] };
  }

  // Check for mismatches between expected and actual cart contents
  const cartItemIds = new Set(
    (verifiedCart.items ?? []).map((ci) => ci.selling_unit_id)
  );
  const expectedSuccessIds = items
    .filter((i) => !failedItems.some((f) => f.itemId === i.itemId))
    .map((i) => i.itemId);

  for (const expectedId of expectedSuccessIds) {
    if (!cartItemIds.has(expectedId)) {
      console.warn(
        `[cart-assembly] Mismatch: ${expectedId} was reported as added but not found in verified cart`
      );
    }
  }

  const success = failedItems.length === 0 && addedCount === items.length;

  return {
    success,
    addedCount,
    failedItems,
    verifiedCart,
  };
}
