"use client";

interface HeaderProps {
  isTransparencyMode: boolean;
  onToggleMode: () => void;
  pipelineStatus?: string;
  demoMode?: boolean;
  onToggleDemo?: () => void;
}

export function Header({
  isTransparencyMode,
  onToggleMode,
  pipelineStatus,
  demoMode,
  onToggleDemo,
}: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-[var(--picnic-red)] px-5 shadow-sm">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
        <span className="text-lg font-bold text-white">
          Weekly Shop
        </span>
      </div>

      {/* Center: Pipeline status + Demo toggle */}
      <div className="flex items-center gap-3">
        {pipelineStatus && (
          <span className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                pipelineStatus === "Agents working..."
                  ? "animate-pulse bg-yellow-300"
                  : pipelineStatus === "Pipeline complete"
                    ? "bg-green-300"
                    : "bg-white/60"
              }`}
            />
            {pipelineStatus}
          </span>
        )}
        {onToggleDemo && (
          <button
            onClick={onToggleDemo}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              demoMode
                ? "bg-yellow-300 text-yellow-900"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {demoMode ? "Demo" : "Live"}
          </button>
        )}
      </div>

      {/* Right: Mode toggle */}
      <button
        onClick={onToggleMode}
        className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
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
            Agent View
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
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            Cart Only
          </>
        )}
      </button>
    </header>
  );
}
