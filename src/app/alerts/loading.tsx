export default function AlertsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center bg-[var(--accent)] px-4 sm:px-6">
        <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Title skeleton */}
          <div>
            <div className="h-7 w-32 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--border)]" />
          </div>

          {/* Create alert form skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-4 space-y-4">
              <div>
                <div className="h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
                <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
              </div>
              <div>
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--border)]" />
                <div className="mt-2 h-10 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-lg bg-[var(--border)]" />
            </div>
          </div>

          {/* Active alerts skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 animate-pulse rounded bg-[var(--border)]" />
                    <div className="h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
                  </div>
                  <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
