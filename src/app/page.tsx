import { Header } from "@/components/header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-2xl text-center">
          {/* Hero */}
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            GroceryOptimizer
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)] sm:text-xl">
            Find the cheapest groceries across all Dutch supermarkets
          </p>

          {/* Search prompt */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-light)]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-[var(--text-muted)]"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="text-sm text-[var(--text-muted)]">
                  Search for products or build a shopping list...
                </span>
              </div>
            </div>
          </div>

          {/* Supermarket badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["Albert Heijn", "Jumbo", "Lidl", "Aldi", "Plus", "Dirk"].map(
              (store) => (
                <span
                  key={store}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                >
                  {store}
                </span>
              )
            )}
          </div>

          {/* Tagline */}
          <p className="mt-12 text-sm text-[var(--text-muted)]">
            Compare prices. Build lists. Save money every week.
          </p>
        </div>
      </main>
    </div>
  );
}
