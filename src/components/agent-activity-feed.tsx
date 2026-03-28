"use client";

import { useRef, useEffect, useState } from "react";
import type { AgentEvent } from "@/types";
import { FeedEntry } from "./feed-entry";

interface AgentActivityFeedProps {
  events: AgentEvent[];
}

export function AgentActivityFeed({ events }: AgentActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [storyMode, setStoryMode] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Header with count and Story/Log toggle */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-light)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Activity Feed
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStoryMode((prev) => !prev)}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: "var(--surface-muted)",
            }}
          >
            {storyMode ? "Story" : "Log"}
          </button>
          {events.length > 0 && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {events.length} events
            </span>
          )}
        </div>
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-2 py-2">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">
              Waiting for agents to start...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {events.map((event, i) => (
              <FeedEntry
                key={`${event.timestamp}-${i}`}
                event={event}
                storyMode={storyMode}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
