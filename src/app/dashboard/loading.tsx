export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center bg-[var(--accent)] px-4 sm:px-6">
        <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Savings hero skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-6 sm:p-8">
            <div className="mx-auto flex flex-col items-center gap-3">
              <div className="h-4 w-40 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-12 w-48 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
            </div>
          </div>

          {/* Bar chart skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-6 w-20 animate-pulse rounded bg-[var(--border)]" />
                  <div className="h-7 flex-1 animate-pulse rounded bg-[var(--surface-muted)]" style={{ width: `${80 - i * 8}%` }} />
                  <div className="h-4 w-20 animate-pulse rounded bg-[var(--border)]" />
                </div>
              ))}
            </div>
          </div>

          {/* Trends + Deals grid skeleton */}
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((col) => (
              <div key={col} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
                <div className="mt-4 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 animate-pulse rounded bg-[var(--border)]" />
                        <div className="h-4 w-28 animate-pulse rounded bg-[var(--border)]" />
                      </div>
                      <div className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
