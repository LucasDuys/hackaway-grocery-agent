export default function StoresLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center bg-[var(--accent)] px-4 sm:px-6">
        <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Title skeleton */}
          <div>
            <div className="h-7 w-40 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-[var(--border)]" />
          </div>

          {/* Controls skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--border)]" />
                <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
              </div>
              <div className="h-10 w-36 animate-pulse self-end rounded-lg bg-[var(--surface-muted)]" />
            </div>
            <div className="mt-4 flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-14 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
              ))}
            </div>
          </div>

          {/* Map skeleton */}
          <div className="h-[400px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />

          {/* Store cards skeleton */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="h-10 w-10 animate-pulse rounded-md bg-[var(--border)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-[var(--border)]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-muted)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-muted)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
