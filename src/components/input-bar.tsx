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
      className="flex shrink-0 items-center gap-2 border-t border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What do you need this week?"
        disabled={isRunning}
        className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--picnic-red)] focus:outline-none focus:ring-2 focus:ring-[var(--picnic-red-light)] disabled:opacity-50 transition-all"
      />
      <button
        type="submit"
        disabled={isRunning || !value.trim()}
        className="rounded-full bg-[var(--picnic-red)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--picnic-red-hover)] disabled:opacity-40"
      >
        {isRunning ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Working
          </span>
        ) : (
          "Go"
        )}
      </button>
      {showReset && !isRunning && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
        >
          Clear
        </button>
      )}
    </form>
  );
}
