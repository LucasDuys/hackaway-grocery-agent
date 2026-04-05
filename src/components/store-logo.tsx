"use client";

import type { StoreSlug } from "@/lib/scrapers/types";

interface StoreLogoProps {
  slug: StoreSlug;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<StoreLogoProps["size"]>, string> = {
  sm: "h-6 min-w-6 px-1.5 text-[10px]",
  md: "h-8 min-w-8 px-2 text-xs",
  lg: "h-10 min-w-10 px-3 text-sm",
};

const storeStyles: Record<
  StoreSlug,
  { label: string; className: string; style?: React.CSSProperties }
> = {
  ah: {
    label: "AH",
    className: "text-white",
    style: { background: "#00a0e2" },
  },
  jumbo: {
    label: "Jumbo",
    className: "text-black",
    style: { background: "#ffc800" },
  },
  lidl: {
    label: "Lidl",
    className: "text-white",
    style: { background: "linear-gradient(135deg, #0050aa, #e60a14)" },
  },
  picnic: {
    label: "Picnic",
    className: "text-white",
    style: { background: "#ff6600" },
  },
  plus: {
    label: "Plus",
    className: "text-white",
    style: { background: "#00a651" },
  },
  aldi: {
    label: "Aldi",
    className: "text-white",
    style: { background: "linear-gradient(135deg, #00205b, #f06400)" },
  },
};

export function StoreLogo({ slug, size = "md" }: StoreLogoProps) {
  const config = storeStyles[slug];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold leading-none select-none ${sizeClasses[size]} ${config.className}`}
      style={config.style}
    >
      {config.label}
    </span>
  );
}
