"use client";

interface HeaderProps {
  isTransparencyMode: boolean;
  onToggleMode: () => void;
  pipelineStatus?: string;
}

export function Header({
  isTransparencyMode,
  onToggleMode,
  pipelineStatus,
}: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold text-[var(--picnic-orange)]">
          Grocery Agent
        </span>
      </div>

      {/* Center: Pipeline status */}
      <div className="flex items-center gap-2">
        {pipelineStatus && (
          <span className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {pipelineStatus}
          </span>
        )}
      </div>

      {/* Right: Mode toggle */}
      <button
        onClick={onToggleMode}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      >
        {isTransparencyMode ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Transparency
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            User Mode
          </>
        )}
      </button>
    </header>
  );
}
