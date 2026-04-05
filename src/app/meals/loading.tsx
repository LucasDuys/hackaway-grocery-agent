export default function MealsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center bg-[var(--accent)] px-4 sm:px-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-white/30" />
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Title skeleton */}
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-accent)]" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-[var(--surface-accent)]" />
          </div>

          {/* Form skeleton */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n}>
                  <div className="mb-1.5 h-4 w-24 animate-pulse rounded bg-[var(--surface-accent)]" />
                  <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>

            {/* Dietary pills skeleton */}
            <div className="mt-5">
              <div className="mb-2 h-4 w-36 animate-pulse rounded bg-[var(--surface-accent)]" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="h-8 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]"
                  />
                ))}
              </div>
            </div>

            {/* Preferences skeleton */}
            <div className="mt-5">
              <div className="mb-1.5 h-4 w-28 animate-pulse rounded bg-[var(--surface-accent)]" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
            </div>

            {/* Button skeleton */}
            <div className="mt-6">
              <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--surface-accent)]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
