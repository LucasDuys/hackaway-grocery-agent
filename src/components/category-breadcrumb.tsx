"use client";

interface CategoryBreadcrumbProps {
  categories: string[];
}

export function CategoryBreadcrumb({ categories }: CategoryBreadcrumbProps) {
  const segments = ["Home", ...categories];

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
            {isLast ? (
              <span className="font-medium text-[var(--text-primary)]">
                {segment}
              </span>
            ) : (
              <a
                href="#"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
              >
                {segment}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
