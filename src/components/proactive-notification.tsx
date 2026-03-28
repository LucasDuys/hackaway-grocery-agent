"use client";

import { motion } from "motion/react";

interface ProactiveNotificationProps {
  daysSinceLastOrder: number;
  onDismiss: () => void;
  onAction: () => void;
}

export function ProactiveNotification({
  daysSinceLastOrder,
  onDismiss,
  onAction,
}: ProactiveNotificationProps) {
  return (
    <motion.div
      key="proactive-notification"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="shrink-0 border-l-4 border-l-[var(--picnic-red)] bg-[#FFF8F5] px-4 py-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-primary)]">
          It has been{" "}
          <span className="font-semibold">{daysSinceLastOrder}</span> days
          since your last order. Ready to prepare your weekly shop?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onAction}
            className="rounded-full bg-[var(--picnic-red)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
          >
            Prepare now
          </button>
          <button
            onClick={onDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="Dismiss notification"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
