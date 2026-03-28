"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { SplitPanelLayout } from "@/components/split-panel-layout";
import { CartView } from "@/components/cart-view";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { InputBar } from "@/components/input-bar";
import { StreamedText } from "@/components/streamed-text";
import { useOrchestration } from "@/hooks/use-orchestration";

export default function Home() {
  const [isTransparencyMode, setIsTransparencyMode] = useState(true);

  const {
    agentStates,
    activityLog,
    cartSummary,
    streamedText,
    isRunning,
    error,
    demoMode,
    setDemoMode,
    orchestrate,
    reset,
  } = useOrchestration();

  const pipelineStatus = isRunning
    ? "Agents working..."
    : cartSummary
      ? "Pipeline complete"
      : "Ready";

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Header
        isTransparencyMode={isTransparencyMode}
        onToggleMode={() => setIsTransparencyMode((prev) => !prev)}
        pipelineStatus={pipelineStatus}
        demoMode={demoMode}
        onToggleDemo={() => {
          reset();
          setDemoMode((prev) => !prev);
        }}
      />
      <SplitPanelLayout
        isRightPanelVisible={isTransparencyMode}
        leftPanel={
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
              {cartSummary ? (
                <CartView summary={cartSummary} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                  <div className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--text-muted)]"
                    >
                      <circle cx="8" cy="21" r="1" />
                      <circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Your cart is empty
                  </p>
                  <p className="max-w-xs text-xs text-[var(--text-muted)]">
                    Describe your week below and the agents will build a smart grocery cart for you.
                  </p>
                </div>
              )}
            </div>

            {/* Streamed explanation text */}
            <StreamedText text={streamedText} isRunning={isRunning} />

            {/* Input bar */}
            <InputBar
              onSubmit={orchestrate}
              isRunning={isRunning}
              onReset={reset}
              showReset={!!(cartSummary || activityLog.length > 0)}
            />

            {/* Error display */}
            {error && (
              <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">
                  Something went wrong
                </p>
                <p className="mt-0.5 text-sm text-red-600">{error}</p>
                {!demoMode && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Check that OPENAI_API_KEY, PICNIC_EMAIL, and PICNIC_PASSWORD are set in your .env file. You can also try demo mode using the toggle in the header.
                  </p>
                )}
              </div>
            )}
          </div>
        }
        rightPanel={
          <div className="flex h-full flex-col">
            <AgentStatusPanel agentStates={agentStates} />
            <div className="flex-1 overflow-hidden">
              <AgentActivityFeed events={activityLog} />
            </div>
          </div>
        }
      />
    </div>
  );
}
