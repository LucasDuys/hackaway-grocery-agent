"use client";

export interface FeedEvent {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

const typeColorMap: Record<FeedEvent["type"], string> = {
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--danger)",
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface FeedEntryProps {
  event: FeedEvent;
}

export function FeedEntry({ event }: FeedEntryProps) {
  const color = typeColorMap[event.type];

  return (
    <div className="animate-slide-up flex items-start gap-2 rounded-md px-3 py-2 text-sm">
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
        {formatTimestamp(event.timestamp)}
      </span>

      {/* Source */}
      <span className="shrink-0 font-semibold text-xs" style={{ color }}>
        {event.source}
      </span>

      {/* Message */}
      <span className="min-w-0 break-words text-[var(--text-primary)]">
        {event.message}
      </span>
    </div>
  );
}
