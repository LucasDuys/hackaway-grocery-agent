"use client";

import { useRef, useEffect } from "react";
import type { AgentEvent } from "@/types";
import { FeedEntry } from "./feed-entry";

interface AgentActivityFeedProps {
  events: AgentEvent[];
}

export function AgentActivityFeed({ events }: AgentActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Header with count */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Activity Feed
        </span>
        {events.length > 0 && (
          <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {events.length} events
          </span>
        )}
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">
              Waiting for agents to start...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {events.map((event, i) => (
              <FeedEntry key={`${event.timestamp}-${i}`} event={event} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
