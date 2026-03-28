"use client";

import { type ReactNode, useState } from "react";

interface SplitPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  isRightPanelVisible: boolean;
}

type MobileTab = "cart" | "pipeline";

export function SplitPanelLayout({
  leftPanel,
  rightPanel,
  isRightPanelVisible,
}: SplitPanelLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("cart");

  return (
    <>
      {/* Desktop: original split-panel layout */}
      <div className="desktop-split h-full flex-1 overflow-hidden">
        {/* Left panel */}
        <div
          className="h-full overflow-hidden transition-all duration-300 ease-out"
          style={{ flex: isRightPanelVisible ? "0 0 60%" : "1 1 100%" }}
        >
          {leftPanel}
        </div>

        {/* Right panel */}
        <div
          className="h-full overflow-hidden border-l border-[var(--border-light)] bg-[var(--surface-agent)] transition-all duration-300 ease-out"
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
        {/* Tab bar */}
        <div className="mobile-tab-bar shrink-0 border-b border-[var(--border-light)] bg-[var(--surface)]">
          <button
            onClick={() => setActiveTab("cart")}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "cart"
                ? "border-b-2 border-[var(--picnic-red)] text-[var(--picnic-red)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            Your Cart
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "pipeline"
                ? "border-b-2 border-[var(--picnic-red)] text-[var(--picnic-red)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            How It Works
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "cart" ? (
            <div className="h-full overflow-hidden">{leftPanel}</div>
          ) : (
            <div className="h-full overflow-hidden bg-[var(--surface-agent)]">
              {rightPanel}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
