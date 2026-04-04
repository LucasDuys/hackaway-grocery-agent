"use client";

import { useState } from "react";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function InputBar({
  onSubmit,
  isLoading,
  placeholder = "What do you need this week?",
}: InputBarProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  }

  return (
    <div className="shrink-0 border-t border-[var(--border-light)] bg-[var(--surface)]">
      <form
        onSubmit={handleSubmit}
        className="input-bar-mobile flex items-center gap-2 px-4 py-3"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] disabled:opacity-50 transition-all"
        />

        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Searching
            </span>
          ) : (
            "Search"
          )}
        </button>
      </form>
    </div>
  );
}
