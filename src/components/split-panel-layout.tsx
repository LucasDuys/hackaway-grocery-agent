"use client";

import { type ReactNode } from "react";

interface SplitPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  isRightPanelVisible: boolean;
}

export function SplitPanelLayout({
  leftPanel,
  rightPanel,
  isRightPanelVisible,
}: SplitPanelLayoutProps) {
  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left panel */}
      <div
        className="h-full overflow-hidden transition-all duration-300 ease-out"
        style={{ flex: isRightPanelVisible ? "0 0 60%" : "1 1 100%" }}
      >
        {leftPanel}
      </div>

      {/* Right panel */}
      <div
        className="h-full overflow-hidden border-l border-[var(--border)] transition-all duration-300 ease-out"
        style={{
          flex: isRightPanelVisible ? "0 0 40%" : "0 0 0%",
          opacity: isRightPanelVisible ? 1 : 0,
        }}
      >
        {rightPanel}
      </div>
    </div>
  );
}
