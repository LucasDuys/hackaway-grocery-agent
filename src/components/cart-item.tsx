"use client";

import type { CartItem as CartItemType } from "@/types";
import { ReasoningChip } from "./reasoning-chip";
import { getPicnicImageUrl } from "@/lib/picnic/image";

interface CartItemProps {
  item: CartItemType;
}

const diffStyles: Record<string, string> = {
  added: "ring-1 ring-green-200 bg-green-50/40",
  removed: "ring-1 ring-red-200 bg-red-50/30 opacity-50",
  substituted: "ring-1 ring-amber-200 bg-amber-50/30",
  unchanged: "",
};

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CartItemRow({ item }: CartItemProps) {
  const diffClass = item.diffStatus ? diffStyles[item.diffStatus] : "";
  const isRemoved = item.diffStatus === "removed";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${diffClass}`}
    >
      {/* Product image */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-sm text-[var(--text-muted)] overflow-hidden">
        {item.imageUrl ? (
          <img
            src={getPicnicImageUrl(item.imageUrl) || item.imageUrl}
            alt={item.name}
            className="h-12 w-12 rounded-xl object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        {!item.imageUrl && (
          <span className="text-sm font-semibold text-[var(--text-muted)]">{item.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Name + reasoning */}
      <div className="min-w-0 flex-1">
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
            {item.reasoning}
          </p>
        )}
      </div>

      {/* Price -- right aligned, prominent */}
      <span
        className={`text-sm font-bold tabular-nums text-right whitespace-nowrap ${
          isRemoved
            ? "text-[var(--text-muted)] line-through"
            : "text-[var(--text-primary)]"
        }`}
      >
        EUR {centsToEur(item.price * item.quantity)}
      </span>
    </div>
  );
}
