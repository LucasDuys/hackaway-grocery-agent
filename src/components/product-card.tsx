"use client";

import { motion } from "motion/react";
import type { StoreSlug } from "@/lib/scrapers/types";
import { PriceBadge } from "./price-badge";
import { StoreLogo } from "./store-logo";

export interface ProductCardProduct {
  name: string;
  brand?: string;
  imageUrl?: string;
  priceCents: number;
  originalPriceCents?: number;
  unitSize?: string;
  storeSlugs?: StoreSlug[];
}

interface ProductCardProps {
  product: ProductCardProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <motion.div
      className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-shadow"
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.2 }}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-muted)]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain p-3"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        {product.originalPriceCents != null &&
          product.originalPriceCents > product.priceCents && (
            <span className="absolute top-2 right-2 rounded-full bg-[var(--danger)] px-2 py-0.5 text-[10px] font-bold text-white">
              SALE
            </span>
          )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Brand + name */}
        <div className="min-w-0">
          {product.brand && (
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {product.brand}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
            {product.name}
          </h3>
          {product.unitSize && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {product.unitSize}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto">
          <PriceBadge
            priceCents={product.priceCents}
            originalPriceCents={product.originalPriceCents}
            size="sm"
          />
        </div>

        {/* Store logos */}
        {product.storeSlugs && product.storeSlugs.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-[var(--border-light)] pt-2">
            {product.storeSlugs.map((slug) => (
              <StoreLogo key={slug} slug={slug} size="sm" />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
