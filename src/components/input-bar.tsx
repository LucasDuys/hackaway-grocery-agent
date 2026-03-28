"use client";

import { useState } from "react";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isRunning: boolean;
  onReset?: () => void;
  showReset?: boolean;
}

export function InputBar({ onSubmit, isRunning, onReset, showReset }: InputBarProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Sort this week's shop..."
        disabled={isRunning}
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--picnic-orange)] focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isRunning || !value.trim()}
        className="rounded-lg bg-[var(--picnic-orange)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isRunning ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Running
          </span>
        ) : (
          "Go"
        )}
      </button>
      {showReset && !isRunning && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
        >
          Reset
        </button>
      )}
    </form>
  );
}
