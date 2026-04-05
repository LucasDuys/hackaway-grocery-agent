"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {error.message || "Failed to load dashboard. Please try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
