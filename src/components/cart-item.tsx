"use client";

import { useState, useRef } from "react";
import type { CartItem as CartItemType } from "@/types";
import { ReasoningChip } from "./reasoning-chip";
import { getPicnicImageUrl } from "@/lib/picnic/image";

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

  return (
    <div className="cart-item-swipeable rounded-xl">
      {/* Delete background (revealed on swipe) */}
      <div className="cart-item-delete-bg">
        Remove
      </div>

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

        {/* Expandable detail section */}
        {isExpanded && (
          <div className="border-t border-[var(--border)] px-3 py-3">
            <div className="flex gap-3">
              {/* Large product image */}
              {item.imageUrl && (
                <div className="h-20 w-20 shrink-0 rounded-lg bg-[var(--surface-muted)] overflow-hidden">
                  <img
                    src={getPicnicImageUrl(item.imageUrl, "large") || item.imageUrl}
                    alt={item.name}
                    className="h-full w-full rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {item.name}
                </p>
                <div className="mt-1 space-y-0.5 text-xs text-[var(--text-muted)]">
                  <p>Price per unit: EUR {centsToEur(item.price ?? 0)}</p>
                  <p>Quantity: {item.quantity}</p>
                  <p>Total: EUR {centsToEur((item.price ?? 0) * (item.quantity ?? 1))}</p>
                </div>
              </div>
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
