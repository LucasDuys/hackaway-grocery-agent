"use client";

import { type ReactNode, useState } from "react";

interface SplitPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  isRightPanelVisible: boolean;
  leftLabel?: string;
  rightLabel?: string;
}

type MobileTab = "left" | "right";

export function SplitPanelLayout({
  leftPanel,
  rightPanel,
  isRightPanelVisible,
  leftLabel = "Results",
  rightLabel = "Details",
}: SplitPanelLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("left");

  return (
    <>
      {/* Desktop: split-panel layout */}
      <div className="desktop-split h-full flex-1 overflow-hidden">
        <div
          className="h-full overflow-hidden transition-all duration-300 ease-out"
          style={{ flex: isRightPanelVisible ? "0 0 60%" : "1 1 100%" }}
        >
          {leftPanel}
        </div>

        <div
          className="h-full overflow-hidden border-l border-[var(--border-light)] bg-[var(--surface-accent)] transition-all duration-300 ease-out"
          style={{
            flex: isRightPanelVisible ? "0 0 40%" : "0 0 0%",
            opacity: isRightPanelVisible ? 1 : 0,
          }}
        >
          {rightPanel}
        </div>
      </div>

      {/* Mobile: tabbed layout */}
      <div className="mobile-panel">
        <div className="mobile-tab-bar shrink-0 border-b border-[var(--border-light)] bg-[var(--surface)]">
          <button
            onClick={() => setActiveTab("left")}
            className={`flex-1 min-h-[44px] py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "left"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {leftLabel}
          </button>
          <button
            onClick={() => setActiveTab("right")}
            className={`flex-1 min-h-[44px] py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "right"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {rightLabel}
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "left" ? (
            <div className="h-full overflow-hidden">{leftPanel}</div>
          ) : (
            <div className="h-full overflow-hidden bg-[var(--surface-accent)]">
              {rightPanel}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
