export default function ProductsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {/* Header skeleton */}
      <div className="h-14 shrink-0 bg-[var(--accent)]" />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Sidebar skeleton -- desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg bg-[var(--surface-muted)]"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Search bar skeleton */}
          <div className="h-12 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />

          {/* Filter row skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface-muted)]"
                  style={{ animationDelay: `${i * 75}ms` }}
                />
              ))}
            </div>
            <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          </div>

          {/* Card grid skeleton */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mb-3 h-5 w-3/4 rounded bg-[var(--surface-muted)]" />
                <div className="mb-2 h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                <div className="mb-4 h-6 w-1/3 rounded bg-[var(--surface-muted)]" />
                <div className="flex gap-1 border-t border-[var(--border-light)] pt-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-6 w-10 rounded-md bg-[var(--surface-muted)]"
                    />
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
