"use client";

interface PriceBadgeProps {
  priceCents: number;
  originalPriceCents?: number;
  pricePerUnit?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: { price: "text-sm", original: "text-xs", unit: "text-[10px]" },
  md: { price: "text-base", original: "text-sm", unit: "text-xs" },
  lg: { price: "text-xl", original: "text-base", unit: "text-sm" },
} as const;

function formatEur(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `EUR ${euros}`;
}

export function PriceBadge({
  priceCents,
  originalPriceCents,
  pricePerUnit,
  size = "md",
}: PriceBadgeProps) {
  const classes = sizeClasses[size];
  const isOnSale = originalPriceCents != null && originalPriceCents > priceCents;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5">
        {isOnSale && (
          <span
            className={`${classes.original} font-medium text-[var(--text-muted)] line-through`}
          >
            {formatEur(originalPriceCents!)}
          </span>
        )}
        <span
          className={`${classes.price} font-bold ${
            isOnSale
              ? "text-[var(--danger)]"
              : "text-[var(--text-primary)]"
          }`}
        >
          {formatEur(priceCents)}
        </span>
      </div>
      {pricePerUnit && (
        <span className={`${classes.unit} text-[var(--text-muted)]`}>
          {pricePerUnit}
        </span>
      )}
    </div>
  );
}
