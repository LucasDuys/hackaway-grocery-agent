"use client";

import type { CartItem as CartItemType } from "@/types";
import { ReasoningChip } from "./reasoning-chip";
import { getPicnicImageUrl } from "@/lib/picnic/image";

interface CartItemProps {
  item: CartItemType;
}

const diffStyles: Record<string, string> = {
  added: "border-l-[3px] border-l-green-500 bg-green-50/60",
  removed: "border-l-[3px] border-l-red-500 bg-red-50/60 opacity-60",
  substituted: "border-l-[3px] border-l-yellow-500 bg-yellow-50/60",
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
      className={`flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 ${diffClass}`}
    >
      {/* Image placeholder */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-muted)] text-sm text-[var(--text-muted)]">
        {item.imageUrl ? (
          <img
            src={getPicnicImageUrl(item.imageUrl) || item.imageUrl}
            alt={item.name}
            className="h-10 w-10 rounded-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        {!item.imageUrl && (
          <span className="text-xs font-medium">{item.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Name + reasoning */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] font-medium text-[var(--text-primary)] truncate ${
            isRemoved ? "line-through" : ""
          }`}
        >
          {item.name}
        </p>
        {item.diffStatus === "substituted" && item.reasoning && (
          <p className="text-xs text-[var(--text-muted)] truncate">
            {item.reasoning}
          </p>
        )}
      </div>

      {/* Reason chip */}
      <ReasoningChip tag={item.reasonTag} agentSource={item.agentSource} />

      {/* Quantity */}
      <span className="text-sm font-medium text-[var(--text-secondary)] tabular-nums w-8 text-right">
        {item.quantity}x
      </span>

      {/* Price */}
      <span
        className={`text-base font-semibold font-mono tabular-nums w-20 text-right ${
          isRemoved
            ? "text-[var(--text-muted)] line-through"
            : "text-[var(--text-primary)]"
        }`}
      >
        {centsToEur(item.price * item.quantity)}
      </span>
    </div>
  );
}
