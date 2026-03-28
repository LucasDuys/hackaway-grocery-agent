"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CartItem as CartItemType } from "@/types";
import { ReasoningChip } from "./reasoning-chip";
import { getPicnicImageUrl } from "@/lib/picnic/image";
import {
  fetchProductDetail,
  type ProductDetail,
} from "@/lib/picnic/product-detail";

interface CartItemProps {
  item: CartItemType;
}

const diffStyles: Record<string, string> = {
  added: "ring-1 ring-green-200 bg-green-50/40",
  removed: "ring-1 ring-red-200 bg-red-50/30 opacity-50",
  substituted: "border-l-3 border-l-amber-400",
  unchanged: "",
};

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CartItemRow({ item }: CartItemProps) {
  const diffClass = item.diffStatus ? diffStyles[item.diffStatus] : "";
  const isRemoved = item.diffStatus === "removed";
  const [isExpanded, setIsExpanded] = useState(false);

  // Product detail state
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch product detail on first expand
  useEffect(() => {
    if (!isExpanded || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setIsLoading(true);
    fetchProductDetail(item.itemId).then((detail) => {
      setProductDetail(detail);
      setIsLoading(false);
    });
  }, [isExpanded, item.itemId]);

  // Swipe state
  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = swipeX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startXRef.current === null) return;
    const diff = e.touches[0].clientX - startXRef.current;
    const newX = Math.min(0, Math.max(-80, currentXRef.current + diff));
    setSwipeX(newX);
  }

  function handleTouchEnd() {
    startXRef.current = null;
    // Snap: if dragged more than 40px, keep open; otherwise snap back
    if (swipeX < -40) {
      setSwipeX(-80);
    } else {
      setSwipeX(0);
    }
  }

  // Determine the best image to show in expanded view
  const largeImageUrl =
    productDetail?.images?.[0]
      ? getPicnicImageUrl(productDetail.images[0], "large")
      : productDetail?.image_url
        ? getPicnicImageUrl(productDetail.image_url, "large")
        : item.imageUrl
          ? getPicnicImageUrl(item.imageUrl, "large")
          : undefined;

  // Extract key nutritional values
  const nutritionalSummary = productDetail?.nutritional_info
    ? extractNutritionSummary(productDetail.nutritional_info)
    : null;

  return (
    <div className="cart-item-swipeable rounded-xl">
      {/* Delete background (revealed on swipe, hidden by default) */}
      {swipeX < 0 && (
        <div className="cart-item-delete-bg" style={{ display: "flex" }}>
          Remove
        </div>
      )}

      {/* Foreground content */}
      <div
        className={`cart-item-content rounded-xl bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${diffClass}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Clickable row */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {/* Product image */}
          <div className="cart-item-img flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-sm text-[var(--text-muted)] overflow-hidden">
            {item.imageUrl ? (
              <img
                src={getPicnicImageUrl(item.imageUrl, "medium") || item.imageUrl}
                alt={item.name}
                className="h-full w-full rounded-lg object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const sibling = target.nextElementSibling;
                  if (sibling) sibling.classList.remove("hidden");
                }}
              />
            ) : null}
            {item.imageUrl && (
              <span className="hidden text-sm font-semibold text-[var(--text-muted)]">
                {item.name.charAt(0).toUpperCase()}
              </span>
            )}
            {!item.imageUrl && (
              <span className="text-sm font-semibold text-[var(--text-muted)]">
                {item.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name + reasoning */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              className={`text-sm font-medium text-[var(--text-primary)] truncate ${
                isRemoved ? "line-through" : ""
              }`}
            >
              {item.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[var(--text-muted)]">
                {item.quantity}x
              </span>
              <ReasoningChip tag={item.reasonTag} agentSource={item.agentSource} />
            </div>
            {item.diffStatus === "substituted" && item.reasoning && (
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                {(() => {
                  const savingsMatch = item.reasoning.match(/saves?\s+EUR\s+([\d.,]+)/i);
                  return savingsMatch ? `Swapped -- EUR ${savingsMatch[1]} saved` : "Swapped";
                })()}
              </p>
            )}
          </div>

          {/* Price -- right aligned */}
          <span
            className={`ml-2 shrink-0 text-sm tabular-nums whitespace-nowrap min-w-[70px] text-right bg-transparent ${
              isRemoved
                ? "text-[var(--text-muted)] line-through"
                : "text-[var(--text-primary)]"
            }`}
          >
            EUR {centsToEur((item.price ?? 0) * (item.quantity ?? 1))}
          </span>
        </div>

        {/* Expandable detail section with smooth animation */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-[var(--border)] px-3 py-3">
                {isLoading ? (
                  <DetailSkeleton />
                ) : (
                  <ExpandedDetail
                    item={item}
                    detail={productDetail}
                    largeImageUrl={largeImageUrl}
                    nutritionalSummary={nutritionalSummary}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded detail sub-component
// ---------------------------------------------------------------------------

interface ExpandedDetailProps {
  item: CartItemType;
  detail: ProductDetail | null;
  largeImageUrl: string | undefined;
  nutritionalSummary: NutritionSummary | null;
}

function ExpandedDetail({
  item,
  detail,
  largeImageUrl,
  nutritionalSummary,
}: ExpandedDetailProps) {
  const displayName = detail?.name || item.name;
  const unitQuantity = detail?.unit_quantity;
  const brand = detail?.brand;
  const description = detail?.description;

  return (
    <>
      <div className="flex gap-3">
        {/* Large product image */}
        {largeImageUrl && (
          <div className="h-20 w-20 shrink-0 rounded-lg bg-[var(--surface-muted)] overflow-hidden">
            <img
              src={largeImageUrl}
              alt={displayName}
              className="h-full w-full rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {displayName}
          </p>
          {brand && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{brand}</p>
          )}
          {unitQuantity && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {unitQuantity}
            </p>
          )}
          <div className="mt-1.5 space-y-0.5 text-xs text-[var(--text-muted)]">
            <p>
              Price per unit: EUR {centsToEur(item.price ?? 0)}
            </p>
            <p>Quantity: {item.quantity}</p>
            <p className="font-medium text-[var(--text-primary)]">
              Total: EUR {centsToEur((item.price ?? 0) * (item.quantity ?? 1))}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      )}

      {/* Nutritional info summary */}
      {nutritionalSummary && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {nutritionalSummary.calories && (
            <NutritionBadge label="Calories" value={nutritionalSummary.calories} />
          )}
          {nutritionalSummary.protein && (
            <NutritionBadge label="Protein" value={nutritionalSummary.protein} />
          )}
          {nutritionalSummary.carbs && (
            <NutritionBadge label="Carbs" value={nutritionalSummary.carbs} />
          )}
          {nutritionalSummary.fat && (
            <NutritionBadge label="Fat" value={nutritionalSummary.fat} />
          )}
        </div>
      )}

      {/* Agent reasoning */}
      {item.reasoning && (
        <div className="mt-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
          <p className="text-xs text-[var(--text-secondary)]">
            {item.reasoning}
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            Added by {item.agentSource}
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="h-20 w-20 shrink-0 rounded-lg bg-[var(--surface-muted)]" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 w-3/4 rounded bg-[var(--surface-muted)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--surface-muted)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nutrition helpers
// ---------------------------------------------------------------------------

interface NutritionSummary {
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
}

function NutritionBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-muted)] px-2 py-1.5 text-center">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="text-xs font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function extractNutritionSummary(
  info: { name: string; value: string; sub_values?: { name: string; value: string }[] }[]
): NutritionSummary | null {
  const summary: NutritionSummary = {};

  for (const entry of info) {
    const nameLower = entry.name.toLowerCase();

    if (nameLower.includes("energy") || nameLower.includes("calorie") || nameLower.includes("energie")) {
      // Prefer kcal value if available
      const kcalMatch = entry.value.match(/([\d.,]+)\s*kcal/i);
      summary.calories = kcalMatch ? `${kcalMatch[1]} kcal` : entry.value;
    } else if (nameLower.includes("protein") || nameLower.includes("eiwit")) {
      summary.protein = entry.value;
    } else if (nameLower.includes("carbohydrate") || nameLower.includes("koolhydra")) {
      summary.carbs = entry.value;
    } else if (nameLower === "fat" || nameLower === "vet" || nameLower.includes("total fat")) {
      summary.fat = entry.value;
    }

    // Also check sub_values for nested nutritional data
    if (entry.sub_values) {
      for (const sub of entry.sub_values) {
        const subLower = sub.name.toLowerCase();
        if ((subLower.includes("protein") || subLower.includes("eiwit")) && !summary.protein) {
          summary.protein = sub.value;
        } else if ((subLower.includes("carbohydrate") || subLower.includes("koolhydra")) && !summary.carbs) {
          summary.carbs = sub.value;
        } else if ((subLower === "fat" || subLower === "vet") && !summary.fat) {
          summary.fat = sub.value;
        }
      }
    }
  }

  const hasAny = summary.calories || summary.protein || summary.carbs || summary.fat;
  return hasAny ? summary : null;
}
