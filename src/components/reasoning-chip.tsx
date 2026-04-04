"use client";

export type ChipTag =
  | "cheapest"
  | "bulk-deal"
  | "store-brand"
  | "seasonal"
  | "organic"
  | "substitute";

const tagConfig: Record<ChipTag, { label: string; className: string }> = {
  cheapest: {
    label: "cheapest",
    className: "border-emerald-200 text-emerald-600 bg-emerald-50/60",
  },
  "bulk-deal": {
    label: "bulk deal",
    className: "border-amber-200 text-amber-600 bg-amber-50/60",
  },
  "store-brand": {
    label: "store brand",
    className: "border-sky-200 text-sky-600 bg-sky-50/60",
  },
  seasonal: {
    label: "seasonal",
    className: "border-orange-200 text-orange-500 bg-orange-50/60",
  },
  organic: {
    label: "organic",
    className: "border-lime-200 text-lime-600 bg-lime-50/60",
  },
  substitute: {
    label: "swap",
    className: "border-violet-200 text-violet-500 bg-violet-50/60",
  },
};

interface ReasoningChipProps {
  tag: ChipTag;
  supermarket?: string;
}

export function ReasoningChip({ tag, supermarket }: ReasoningChipProps) {
  const config = tagConfig[tag];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${config.className}`}
    >
      {supermarket && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      )}
      {config.label}
    </span>
  );
}
