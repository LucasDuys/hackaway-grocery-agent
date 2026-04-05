export default function ListsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-accent)]" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--surface-accent)]" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--surface-accent)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-accent)]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-accent)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
